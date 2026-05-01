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

// ---------- CLEMANTIN (placeholder for next session) ----------

async function buildClemantin() {
  console.log('\n=== Building clemantin demo ===');
  console.log('  (skipped — implement in next phase)');
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
