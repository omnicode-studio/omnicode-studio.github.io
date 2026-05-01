#!/usr/bin/env node
/**
 * Build script for portfolio static demos.
 *
 * Extracts data from sister projects (renome, clemantin) and produces:
 *   - data/*.json — menu, categories, i18n
 *   - img/**.webp — optimized images
 *
 * Usage:
 *   node scripts/build-demos.js            # builds all demos
 *   node scripts/build-demos.js renome     # only renome
 *   node scripts/build-demos.js clemantin  # only clemantin
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const WS = path.resolve(ROOT, '..');

const projects = {
  renome: {
    src: path.join(WS, 'renome'),
    out: path.join(ROOT, 'demo', 'renome'),
  },
  clemantin: {
    src: path.join(WS, 'clemantin'),
    out: path.join(ROOT, 'demo', 'clemantin'),
  },
};

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
}

function writeJson(file, obj) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf-8');
  console.log(`  [json] ${path.relative(ROOT, file)} (${(JSON.stringify(obj).length / 1024).toFixed(1)} KB)`);
}

async function optimizeImage(srcFile, dstFile, width) {
  ensureDir(path.dirname(dstFile));
  await sharp(srcFile)
    .resize({ width, withoutEnlargement: true, fit: 'inside' })
    .webp({ quality: 80 })
    .toFile(dstFile);
}

// ---------- RENOME ----------

async function buildRenome() {
  const proj = projects.renome;
  console.log('\n=== Building renome demo ===');

  // 1. Extract data from SQLite (live DB)
  const Database = require('better-sqlite3');
  const dbFile = path.join(proj.src, 'database', 'renome.db');
  if (!fs.existsSync(dbFile)) throw new Error(`renome.db not found at ${dbFile}`);
  const db = new Database(dbFile, { readonly: true, fileMustExist: true });

  const categories = db.prepare(
    'SELECT id, name, name_ru, slug, icon, sort_order FROM categories ORDER BY sort_order'
  ).all();

  const items = db.prepare(`
    SELECT id, category_id, name, name_ru, slug,
           description, description_ru,
           price, old_price, image, weight,
           is_popular, is_new, is_available, sort_order
    FROM menu_items
    WHERE is_available = 1
    ORDER BY category_id, sort_order
  `).all();

  // Strip leading "/img/menu/" prefix and rewrite extension to .webp.full
  // We'll convert images later.
  for (const it of items) {
    if (it.image && it.image.startsWith('/img/')) {
      it.image = it.image.replace(/^\/img\//, '');
    }
    it.is_popular = !!it.is_popular;
    it.is_new = !!it.is_new;
    it.is_available = !!it.is_available;
  }
  db.close();

  writeJson(path.join(proj.out, 'data', 'categories.json'), categories);
  writeJson(path.join(proj.out, 'data', 'menu.json'), items);

  // 2. Merge locales into i18n.json
  const ro = JSON.parse(fs.readFileSync(path.join(proj.src, 'locales', 'ro.json'), 'utf-8'));
  const ru = JSON.parse(fs.readFileSync(path.join(proj.src, 'locales', 'ru.json'), 'utf-8'));
  writeJson(path.join(proj.out, 'data', 'i18n.json'), { ro, ru });

  // 3. Optimize images
  console.log('  [img] optimizing...');
  const imgSrc = path.join(proj.src, 'public', 'img');

  // Logo + hero (single-size, full quality copy)
  for (const f of ['logo.png', 'logo-clean.png', 'hero-bg.jpg']) {
    const src = path.join(imgSrc, f);
    if (!fs.existsSync(src)) continue;
    const base = f.replace(/\.[^.]+$/, '');
    await optimizeImage(src, path.join(proj.out, 'img', `${base}.webp`), 1200);
  }

  // Categories — single small webp each
  const catDir = path.join(imgSrc, 'cat');
  if (fs.existsSync(catDir)) {
    for (const f of fs.readdirSync(catDir)) {
      const src = path.join(catDir, f);
      const slug = f.replace(/\.[^.]+$/, '');
      await optimizeImage(src, path.join(proj.out, 'img', 'cat', `${slug}.webp`), 600);
    }
  }

  // Menu items — two sizes (thumb 320, full 800)
  const menuDir = path.join(imgSrc, 'menu');
  if (fs.existsSync(menuDir)) {
    const files = fs.readdirSync(menuDir).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
    let count = 0;
    for (const f of files) {
      const src = path.join(menuDir, f);
      const base = f.replace(/\.[^.]+$/, '');
      await optimizeImage(src, path.join(proj.out, 'img', 'menu', `${base}.thumb.webp`), 320);
      await optimizeImage(src, path.join(proj.out, 'img', 'menu', `${base}.full.webp`), 800);
      count++;
    }
    console.log(`  [img] menu: ${count} items × 2 sizes = ${count * 2} webp files`);
  }

  // Report final size
  const outSize = dirSize(path.join(proj.out, 'img'));
  console.log(`  [img] total: ${(outSize / 1024 / 1024).toFixed(1)} MB`);
}

// ---------- CLEMANTIN ----------

async function buildClemantin() {
  const proj = projects.clemantin;
  console.log('\n=== Building clemantin demo ===');

  // 1. Extract hard-coded data arrays + i18n from server.js by isolating
  //    the declarations between `const houseProjects = [...]` and the
  //    closing brace of `const t = {...}` and running them in a Function
  //    sandbox. Avoids actually starting the express server.
  const serverPath = path.join(proj.src, 'server.js');
  const src = fs.readFileSync(serverPath, 'utf-8');

  const start = src.indexOf('const houseProjects');
  if (start < 0) throw new Error('Cannot locate `const houseProjects` in server.js');
  const tDef = src.indexOf('const t = {', start);
  if (tDef < 0) throw new Error('Cannot locate `const t = {` in server.js');
  // Find end of `t` by brace-matching.
  let i = src.indexOf('{', tDef);
  let depth = 0;
  // single-pass: track strings/templates so we ignore braces inside them
  let inSingle = false, inDouble = false, inTpl = false, inLineCmt = false, inBlockCmt = false;
  for (; i < src.length; i++) {
    const c = src[i], n = src[i + 1];
    if (inLineCmt) { if (c === '\n') inLineCmt = false; continue; }
    if (inBlockCmt) { if (c === '*' && n === '/') { inBlockCmt = false; i++; } continue; }
    if (inSingle) { if (c === '\\') { i++; continue; } if (c === "'") inSingle = false; continue; }
    if (inDouble) { if (c === '\\') { i++; continue; } if (c === '"') inDouble = false; continue; }
    if (inTpl)    { if (c === '\\') { i++; continue; } if (c === '`') inTpl = false; continue; }
    if (c === '/' && n === '/') { inLineCmt = true; i++; continue; }
    if (c === '/' && n === '*') { inBlockCmt = true; i++; continue; }
    if (c === "'") { inSingle = true; continue; }
    if (c === '"') { inDouble = true; continue; }
    if (c === '`') { inTpl = true; continue; }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) { i++; break; }
    }
  }
  const dataSection = src.slice(start, i);

  let extracted;
  try {
    extracted = Function(
      dataSection +
      ';\nreturn { houseProjects, articles, portfolioProjects, services, reviews, team, faq, certificates, t };'
    )();
  } catch (e) {
    throw new Error('Failed to eval clemantin data section: ' + e.message);
  }

  // 2. Write per-array JSON files (only the ones MVP demo actually consumes,
  //    plus articles/portfolioProjects which are cheap and useful for the
  //    next phase if we expand)
  const dataDir = path.join(proj.out, 'data');
  writeJson(path.join(dataDir, 'house-projects.json'), extracted.houseProjects);
  writeJson(path.join(dataDir, 'services.json'),       extracted.services);
  writeJson(path.join(dataDir, 'reviews.json'),        extracted.reviews);
  writeJson(path.join(dataDir, 'team.json'),           extracted.team);
  writeJson(path.join(dataDir, 'faq.json'),            extracted.faq);
  writeJson(path.join(dataDir, 'certificates.json'),   extracted.certificates);
  writeJson(path.join(dataDir, 'articles.json'),       extracted.articles);
  writeJson(path.join(dataDir, 'portfolio-projects.json'), extracted.portfolioProjects);
  writeJson(path.join(dataDir, 'i18n.json'),           extracted.t);

  // 3. Optimize images. clemantin has ~25 images: logo, about, bg, blog, portfolio.
  console.log('  [img] optimizing...');
  const imgSrc = path.join(proj.src, 'public', 'images');
  const imgDst = path.join(proj.out, 'images');

  async function walkAndOptimize(srcDir, dstDir, maxWidth) {
    if (!fs.existsSync(srcDir)) return 0;
    let count = 0;
    for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
      const s = path.join(srcDir, entry.name);
      if (entry.isDirectory()) {
        count += await walkAndOptimize(s, path.join(dstDir, entry.name), maxWidth);
      } else if (/\.(jpg|jpeg|png)$/i.test(entry.name)) {
        const base = entry.name.replace(/\.[^.]+$/, '');
        await optimizeImage(s, path.join(dstDir, base + '.webp'), maxWidth);
        count++;
      }
    }
    return count;
  }
  const count = await walkAndOptimize(imgSrc, imgDst, 1600);
  console.log(`  [img] ${count} images → webp`);

  const outSize = dirSize(path.join(proj.out, 'images'));
  console.log(`  [img] total: ${(outSize / 1024 / 1024).toFixed(1)} MB`);
}

// ---------- helpers ----------

function dirSize(dir) {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  function walk(d) {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      const stat = fs.statSync(p);
      if (stat.isDirectory()) walk(p);
      else total += stat.size;
    }
  }
  walk(dir);
  return total;
}

// ---------- main ----------

(async () => {
  const arg = process.argv[2];
  if (!arg || arg === 'renome') await buildRenome();
  if (!arg || arg === 'clemantin') await buildClemantin();
  console.log('\nDone.');
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
