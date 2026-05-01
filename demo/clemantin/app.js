/* ============================================================
   Clemantin demo — single-file client app
   Combines main.js, calculator.js, projects filter logic, and adds:
   - Client-side i18n (data-i18n, RU/RO via localStorage 'vs_lang')
   - Hero slider, header scroll, counters, mobile nav, FAQ, reviews
   - House-projects filter (price/floors/type)
   - Calculator (porting calculator.js exactly + Telegram submit)
   - Contact form → Telegram bot
   - Service worker registration
   ============================================================ */
(function () {
'use strict';

// ============================================================
// SW HANDLING — runs FIRST so a stale install can self-clean
// ============================================================

// One-shot URL escape hatch: visit ?reset-sw=1 to nuke the old SW + caches
// (used when an earlier broken cache is sticking around).
if (location.search.indexOf('reset-sw=1') !== -1 && 'serviceWorker' in navigator) {
  Promise.all([
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      return Promise.all(regs.map(function (r) { return r.unregister(); }));
    }),
    'caches' in window
      ? caches.keys().then(function (keys) { return Promise.all(keys.map(function (k) { return caches.delete(k); })); })
      : Promise.resolve()
  ]).then(function () {
    location.replace(location.pathname);
  });
  return; // stop further bootstrap on this load
}

// On every visit, ask the existing registration to re-fetch sw.js so a
// fresh server-side update doesn't have to wait the default 24h interval.
if ('serviceWorker' in navigator && navigator.serviceWorker.getRegistration) {
  navigator.serviceWorker.getRegistration().then(function (r) {
    if (r) r.update();
  }).catch(function () {});
}

// ============================================================
// CONFIG
// ============================================================

// SAME Telegram bot as the portfolio + renome demo. Token is exposed in
// client code; see plan "Out of scope" — fix later via serverless proxy.
var TG_BOT_TOKEN = '8631897124:AAH4-C90jNUbRv5dNXdsdQqIv_9OaP_t9cE';
var TG_CHAT_ID = '7269255846';

var LANG_KEY = 'vs_lang';

// ============================================================
// I18N
// ============================================================

var i18n = null;
var currentLang = 'ru';

function getStoredLang() {
  try {
    var saved = localStorage.getItem(LANG_KEY);
    if (saved === 'ru' || saved === 'ro') return saved;
  } catch (e) {}
  return 'ru';
}

function lookupKey(obj, path) {
  var parts = path.split('.');
  var cur = obj;
  for (var i = 0; i < parts.length; i++) {
    if (cur == null) return null;
    cur = cur[parts[i]];
  }
  return cur;
}

function applyI18n() {
  if (!i18n || !i18n[currentLang]) return;
  var dict = i18n[currentLang];

  function resolve(key) {
    var v = lookupKey(dict, key);
    return (typeof v === 'string') ? v : null;
  }

  document.querySelectorAll('[data-i18n]').forEach(function (el) {
    var v = resolve(el.dataset.i18n);
    if (v != null) el.textContent = v;
  });
  document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
    var v = resolve(el.dataset.i18nHtml);
    if (v != null) el.innerHTML = v;
  });
  document.querySelectorAll('[data-i18n-attr-placeholder]').forEach(function (el) {
    var v = resolve(el.dataset.i18nAttrPlaceholder);
    if (v != null) el.placeholder = v;
  });
  document.querySelectorAll('[data-i18n-attr-aria-label]').forEach(function (el) {
    var v = resolve(el.dataset.i18nAttrAriaLabel);
    if (v != null) el.setAttribute('aria-label', v);
  });

  document.documentElement.lang = currentLang;
  document.querySelectorAll('.lang-switch__btn').forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.lang === currentLang);
  });
}

function setLang(lang) {
  if (lang !== 'ro' && lang !== 'ru') lang = 'ru';
  currentLang = lang;
  try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
  applyI18n();
  // Re-render dynamic content
  if (document.getElementById('servicesGrid')) renderServices();
  if (document.getElementById('housesGrid')) renderHouses();
  if (document.getElementById('reviewsTrack')) renderReviews();
  if (document.getElementById('faqList')) renderFaq();
  if (document.getElementById('teamGrid')) renderTeam();
  if (document.getElementById('certsGrid')) renderCerts();
  if (document.getElementById('housesTeaser')) renderHousesTeaser();
}

function loadI18n() {
  return fetch('data/i18n.json').then(function (r) { return r.json(); }).then(function (data) {
    i18n = data;
    currentLang = getStoredLang();
    applyI18n();
  }).catch(function (e) { console.warn('i18n load failed', e); });
}

// pick localized field from object: L(item, 'title') → item.title.ru when ru
function L(obj, field) {
  if (!obj) return '';
  var v = obj[field];
  if (v == null) return '';
  if (typeof v === 'object') return v[currentLang] || v.ru || v.ro || '';
  return v;
}

// ============================================================
// DATA LOADERS
// ============================================================

var dataCache = {};
function loadJson(file) {
  if (dataCache[file]) return Promise.resolve(dataCache[file]);
  return fetch('data/' + file).then(function (r) { return r.json(); }).then(function (d) {
    dataCache[file] = d;
    return d;
  });
}

// ============================================================
// HOME PAGE — DYNAMIC SECTIONS
// ============================================================

function renderServices() {
  var grid = document.getElementById('servicesGrid');
  if (!grid) return;
  loadJson('services.json').then(function (services) {
    grid.innerHTML = services.map(function (s) {
      var subs = (s.subs && s.subs[currentLang]) || [];
      return (
        '<a href="services.html#' + s.slug + '" class="home-service-card" data-animate="up">' +
        '  <div class="home-service-card__icon">' + iconSvg(s.icon) + '</div>' +
        '  <h3 class="home-service-card__title">' + escapeHtml(L(s, 'title')) + '</h3>' +
        '  <p class="home-service-card__desc">' + escapeHtml(L(s, 'desc')) + '</p>' +
        (subs.length ? '<ul class="home-service-card__subs">' + subs.slice(0, 3).map(function (sub) { return '<li>' + escapeHtml(sub) + '</li>'; }).join('') + '</ul>' : '') +
        '</a>'
      );
    }).join('');
  });
}

function renderHousesTeaser() {
  var grid = document.getElementById('housesTeaser');
  if (!grid) return;
  loadJson('house-projects.json').then(function (houses) {
    // Pick 6 — first 2 premium, then 4 mixed
    var premiums = houses.filter(function (h) { return h.type === 'premium'; }).slice(0, 2);
    var others = houses.filter(function (h) { return h.type !== 'premium'; }).slice(0, 4);
    var picked = premiums.concat(others);
    grid.innerHTML = picked.map(houseCardHtml).join('');
  });
}

function renderPortfolio() {
  var grid = document.getElementById('portfolioGrid');
  if (!grid) return;
  loadJson('portfolio-projects.json').then(function (items) {
    grid.innerHTML = items.map(function (p) {
      var img = p.thumb || p.images && p.images[0] || '';
      // remap '/images/...' to relative 'images/...' + .webp swap
      img = img.replace(/^\//, '').replace(/\.(jpg|jpeg|png)$/i, '.webp');
      return (
        '<div class="portfolio__item" data-category="' + (p.catKey || 'all') + '">' +
        '  <img src="' + img + '" alt="' + escapeAttr(L(p, 'title')) + '" class="portfolio__img" loading="lazy">' +
        '  <div class="portfolio__overlay">' +
        '    <div class="portfolio__info">' +
        '      <span class="portfolio__cat">' + escapeHtml(L(p, 'category')) + '</span>' +
        '      <h3 class="portfolio__name">' + escapeHtml(L(p, 'title')) + '</h3>' +
        '    </div>' +
        '  </div>' +
        '</div>'
      );
    }).join('');

    // Filter buttons
    var filterBar = document.getElementById('portfolioFilters');
    if (filterBar) {
      filterBar.querySelectorAll('.portfolio__filter').forEach(function (btn) {
        btn.addEventListener('click', function () {
          filterBar.querySelectorAll('.portfolio__filter').forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
          var f = btn.dataset.filter;
          grid.querySelectorAll('.portfolio__item').forEach(function (item) {
            var match = f === 'all' || item.dataset.category === f;
            item.style.display = match ? '' : 'none';
          });
        });
      });
    }
  });
}

function renderHouses() {
  var grid = document.getElementById('housesGrid');
  if (!grid) return;
  loadJson('house-projects.json').then(function (houses) {
    initHousesFilter(houses);
  });
}

function houseCardHtml(h) {
  return (
    '<article class="house-card" data-id="' + h.id + '" data-floors="' + h.floors + '" data-type="' + h.type + '" data-price="' + h.price + '">' +
    '  <div class="house-card__head">' +
    '    <span class="house-card__id">' + h.id + '</span>' +
    '    <span class="house-card__type house-card__type--' + h.type + '">' + typeLabel(h.type) + '</span>' +
    '  </div>' +
    '  <p class="house-card__desc">' + escapeHtml(h.desc) + '</p>' +
    '  <div class="house-card__meta">' +
    '    <span>' + h.floors + ' ' + (currentLang === 'ro' ? (h.floors === 1 ? 'etaj' : 'etaje') : (h.floors === 1 ? 'этаж' : 'этажа')) + '</span>' +
    '    <span class="house-card__price">€ ' + h.price.toLocaleString('de-DE') + '</span>' +
    '  </div>' +
    '</article>'
  );
}

function typeLabel(t) {
  var ro = { standard: 'Standard', mansard: 'Mansardă', premium: 'Premium', cottage: 'Vilă' };
  var ru = { standard: 'Стандарт', mansard: 'С мансардой', premium: 'Премиум', cottage: 'Коттедж' };
  return (currentLang === 'ro' ? ro : ru)[t] || t;
}

function initHousesFilter(houses) {
  var grid = document.getElementById('housesGrid');
  var totalLabel = document.getElementById('housesCount');

  // Filter state
  var state = { floors: 'all', type: 'all', maxPrice: null };
  var maxPrice = Math.max.apply(null, houses.map(function (h) { return h.price; }));
  var minPrice = Math.min.apply(null, houses.map(function (h) { return h.price; }));
  state.maxPrice = maxPrice;

  // Wire price slider
  var priceRange = document.getElementById('priceRange');
  var priceValue = document.getElementById('priceValue');
  if (priceRange) {
    priceRange.min = minPrice;
    priceRange.max = maxPrice;
    priceRange.value = maxPrice;
    priceRange.style.setProperty('--fill', '100%');
    if (priceValue) priceValue.textContent = '€ ' + maxPrice.toLocaleString('de-DE');
    priceRange.addEventListener('input', function () {
      state.maxPrice = parseInt(this.value);
      var pct = (this.value - this.min) / (this.max - this.min) * 100;
      this.style.setProperty('--fill', pct + '%');
      if (priceValue) priceValue.textContent = '€ ' + parseInt(this.value).toLocaleString('de-DE');
      apply();
    });
  }

  // Wire button groups
  document.querySelectorAll('[data-filter-group]').forEach(function (group) {
    var key = group.dataset.filterGroup;
    group.querySelectorAll('button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        group.querySelectorAll('button').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        state[key] = btn.dataset.value;
        apply();
      });
    });
  });

  function apply() {
    var visible = houses.filter(function (h) {
      if (state.floors !== 'all' && String(h.floors) !== state.floors) return false;
      if (state.type !== 'all' && h.type !== state.type) return false;
      if (h.price > state.maxPrice) return false;
      return true;
    });
    grid.innerHTML = visible.map(houseCardHtml).join('') ||
      '<p class="houses-empty">' + (currentLang === 'ru' ? 'По заданным фильтрам ничего не найдено' : 'Nimic găsit pentru filtrele selectate') + '</p>';
    if (totalLabel) totalLabel.textContent = visible.length;
  }

  apply();
}

function renderReviews() {
  var track = document.getElementById('reviewsTrack');
  if (!track) return;
  loadJson('reviews.json').then(function (reviews) {
    track.innerHTML = reviews.map(function (r) {
      var stars = '';
      for (var i = 0; i < r.stars; i++) stars += '<svg width="14" height="14" viewBox="0 0 24 24" fill="#FBBF24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
      var initials = L(r, 'name').split(' ').map(function (s) { return s.charAt(0); }).join('').slice(0, 2);
      return (
        '<article class="review-card">' +
        '  <div class="review-card__stars">' + stars + '</div>' +
        '  <p class="review-card__text">' + escapeHtml(L(r, 'text')) + '</p>' +
        '  <div class="review-card__author">' +
        '    <div class="review-card__avatar">' + initials + '</div>' +
        '    <div>' +
        '      <span class="review-card__name">' + escapeHtml(L(r, 'name')) + '</span>' +
        '      <span class="review-card__project">' + escapeHtml(L(r, 'project')) + '</span>' +
        '    </div>' +
        '  </div>' +
        '</article>'
      );
    }).join('');
  });
}

function renderFaq() {
  var list = document.getElementById('faqList');
  if (!list) return;
  loadJson('faq.json').then(function (faqs) {
    list.innerHTML = faqs.map(function (f, i) {
      return (
        '<div class="faq-item">' +
        '  <button class="faq-item__question" aria-expanded="false">' +
        '    <span>' + escapeHtml(L(f, 'q')) + '</span>' +
        '    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>' +
        '  </button>' +
        '  <div class="faq-item__answer"><p>' + L(f, 'a') + '</p></div>' +
        '</div>'
      );
    }).join('');

    // FAQ accordion behavior
    list.querySelectorAll('.faq-item__question').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var item = this.closest('.faq-item');
        if (!item) return;
        var isActive = item.classList.contains('active');
        list.querySelectorAll('.faq-item').forEach(function (el) { el.classList.remove('active'); });
        if (!isActive) item.classList.add('active');
      });
    });
  });
}

function renderTeam() {
  var grid = document.getElementById('teamGrid');
  if (!grid) return;
  loadJson('team.json').then(function (team) {
    grid.innerHTML = team.map(function (m) {
      return (
        '<div class="team-card">' +
        '  <div class="team-card__avatar" style="background:' + m.color + '">' + m.initials + '</div>' +
        '  <h4 class="team-card__name">' + escapeHtml(L(m, 'name')) + '</h4>' +
        '  <p class="team-card__role">' + escapeHtml(L(m, 'role')) + '</p>' +
        '  <p class="team-card__exp">' + escapeHtml(L(m, 'exp')) + '</p>' +
        '</div>'
      );
    }).join('');
  });
}

function renderCerts() {
  var grid = document.getElementById('certsGrid');
  if (!grid) return;
  loadJson('certificates.json').then(function (certs) {
    grid.innerHTML = certs.map(function (c) {
      return (
        '<div class="cert-card">' +
        '  <div class="cert-card__icon">' + iconSvg(c.icon) + '</div>' +
        '  <h4 class="cert-card__title">' + escapeHtml(L(c, 'title')) + '</h4>' +
        '  <p class="cert-card__desc">' + escapeHtml(L(c, 'desc')) + '</p>' +
        '</div>'
      );
    }).join('');
  });
}

// ============================================================
// SERVICES PAGE
// ============================================================

function renderServicesFull() {
  var container = document.getElementById('servicesFull');
  if (!container) return;
  loadJson('services.json').then(function (services) {
    container.innerHTML = services.map(function (s) {
      var subs = (s.subs && s.subs[currentLang]) || [];
      return (
        '<section class="service-block" id="' + s.slug + '">' +
        '  <div class="service-block__head">' +
        '    <div class="service-block__icon">' + iconSvg(s.icon) + '</div>' +
        '    <h2 class="service-block__title">' + escapeHtml(L(s, 'title')) + '</h2>' +
        '  </div>' +
        '  <p class="service-block__desc">' + escapeHtml(L(s, 'desc')) + '</p>' +
        (subs.length ? '<ul class="service-block__subs">' + subs.map(function (sub) { return '<li>' + escapeHtml(sub) + '</li>'; }).join('') + '</ul>' : '') +
        '</section>'
      );
    }).join('');
  });
}

// ============================================================
// CALCULATOR
// ============================================================

function initCalculator() {
  var calc = document.getElementById('calcRoot');
  if (!calc) return;

  var state = { type: 'house', area: 120, floors: 1, walls: 'aerated', roof: 'metal', finish: 'red' };

  var typeCoeff = { house: 1, cottage: 1.15, townhouse: 0.9, commercial: 1.25 };
  var wallsCoeff = { aerated: 1, brick: 1.2, frame: 0.8, monolith: 1.3 };
  var roofCoeff = { metal: 1, soft: 1.15, profiled: 0.85 };
  var finishBase = { red: 250, gray: 350, white: 480, turnkey: 650 };
  var floorCoeff = { 1: 1, 2: 0.92, 3: 0.88 };
  var breakdown = {
    red:     { foundation: 0.35, walls: 0.50, roof: 0.15, finish: 0    },
    gray:    { foundation: 0.25, walls: 0.40, roof: 0.20, finish: 0.15 },
    white:   { foundation: 0.20, walls: 0.35, roof: 0.15, finish: 0.30 },
    turnkey: { foundation: 0.15, walls: 0.30, roof: 0.12, finish: 0.43 }
  };

  function calculate() {
    var base = finishBase[state.finish];
    var total = Math.round(state.area * base * typeCoeff[state.type] * wallsCoeff[state.walls] * roofCoeff[state.roof] * floorCoeff[state.floors]);
    var bd = breakdown[state.finish];
    var fnd = Math.round(total * bd.foundation);
    var wls = Math.round(total * bd.walls);
    var rf = Math.round(total * bd.roof);
    var fn = total - fnd - wls - rf;
    setText('totalPrice', '€ ' + total.toLocaleString('de-DE'));
    setText('priceFoundation', '€ ' + fnd.toLocaleString('de-DE'));
    setText('priceWalls', '€ ' + wls.toLocaleString('de-DE'));
    setText('priceRoof', '€ ' + rf.toLocaleString('de-DE'));
    setText('priceFinish', '€ ' + fn.toLocaleString('de-DE'));
  }

  // Option groups
  document.querySelectorAll('.calc__options').forEach(function (group) {
    var param = group.dataset.param;
    group.querySelectorAll('.calc__opt').forEach(function (btn) {
      btn.addEventListener('click', function () {
        group.querySelectorAll('.calc__opt').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var val = btn.dataset.value;
        state[param] = (param === 'floors') ? parseInt(val) : val;
        calculate();
      });
    });
  });

  // Area range
  var areaRange = document.getElementById('areaRange');
  var areaValue = document.getElementById('areaValue');
  if (areaRange) {
    areaRange.addEventListener('input', function () {
      state.area = parseInt(this.value);
      areaValue.textContent = this.value;
      var pct = (this.value - this.min) / (this.max - this.min) * 100;
      this.style.setProperty('--fill', pct + '%');
      calculate();
    });
    areaRange.style.setProperty('--fill', ((120 - 50) / (500 - 50) * 100) + '%');
  }

  // Modal request flow
  var modal = document.getElementById('calcModal');
  var reqBtn = document.getElementById('calcRequestBtn');
  var closeBtn = document.getElementById('calcModalClose');
  var overlay = document.getElementById('calcModalOverlay');
  function openModal() {
    if (!modal) return;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    var labels = {
      type: { house: currentLang === 'ru' ? 'Дом' : 'Casă', cottage: currentLang === 'ru' ? 'Коттедж' : 'Vilă', townhouse: 'Townhouse', commercial: currentLang === 'ru' ? 'Коммерческое' : 'Comercial' },
      walls: { aerated: currentLang === 'ru' ? 'Газобетон' : 'Beton celular', brick: currentLang === 'ru' ? 'Кирпич' : 'Cărămidă', frame: currentLang === 'ru' ? 'Каркас' : 'Cadru', monolith: currentLang === 'ru' ? 'Монолит' : 'Monolit' },
      roof: { metal: currentLang === 'ru' ? 'Металлочерепица' : 'Țiglă metalică', soft: currentLang === 'ru' ? 'Мягкая' : 'Moale', profiled: currentLang === 'ru' ? 'Профнастил' : 'Tablă cutată' },
      finish: { red: currentLang === 'ru' ? '«Красный»' : 'Roșu', gray: currentLang === 'ru' ? '«Серый»' : 'Gri', white: currentLang === 'ru' ? '«Белый»' : 'Alb', turnkey: currentLang === 'ru' ? 'Под ключ' : 'La cheie' }
    };
    var price = (document.getElementById('totalPrice') || {}).textContent || '';
    var summary = document.getElementById('calcSummary');
    if (summary) {
      summary.innerHTML =
        '<div class="calc-modal__param">' + labels.type[state.type] + ', ' + state.area + ' m², ' + state.floors + ' ' + (currentLang === 'ru' ? 'эт.' : 'et.') + '</div>' +
        '<div class="calc-modal__param">' + labels.walls[state.walls] + ' / ' + labels.roof[state.roof] + ' / ' + labels.finish[state.finish] + '</div>' +
        '<div class="calc-modal__price">' + price + '</div>';
    }
  }
  function closeModal() {
    if (!modal) return;
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
  if (reqBtn) reqBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (overlay) overlay.addEventListener('click', closeModal);

  // Form submit → Telegram
  var calcForm = document.getElementById('calcForm');
  if (calcForm) {
    calcForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = calcForm.querySelector('[name="name"]').value.trim();
      var phone = calcForm.querySelector('[name="phone"]').value.trim();
      if (!name || !phone) return;
      var price = (document.getElementById('totalPrice') || {}).textContent || '';
      var text =
        '\u{1F3D7}️ *Clemantin demo — заявка с калькулятора*\n\n' +
        '\u{1F464} ' + name + '\n' +
        '\u{1F4DE} ' + phone + '\n\n' +
        '*Параметры:* ' + state.type + ', ' + state.area + ' m², ' + state.floors + ' эт.\n' +
        '*Стены:* ' + state.walls + '  ·  *Кровля:* ' + state.roof + '  ·  *Отделка:* ' + state.finish + '\n' +
        '*Итого:* ' + price + '\n\n' +
        '_Источник: portfolio/demo/clemantin/calculator_';
      sendToTelegram(text).then(function () {
        closeModal();
        calcForm.reset();
        showToast(currentLang === 'ru' ? 'Заявка отправлена! (демо)' : 'Cerere trimisă! (demo)');
      }).catch(function () {
        showToast(currentLang === 'ru' ? 'Ошибка. Попробуйте позже.' : 'Eroare. Încercați mai târziu.');
      });
    });
  }

  calculate();
}

// ============================================================
// CONTACT FORM (contacts.html)
// ============================================================

function initContactForm() {
  var form = document.getElementById('contactForm');
  if (!form) return;
  var submitBtn = form.querySelector('[type="submit"]');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = form.querySelector('[name="name"]').value.trim();
    var phone = form.querySelector('[name="phone"]').value.trim();
    var email = (form.querySelector('[name="email"]') || {}).value || '';
    var message = (form.querySelector('[name="message"]') || {}).value || '';
    if (!name || !phone) {
      showToast(currentLang === 'ru' ? 'Заполните имя и телефон' : 'Completați numele și telefonul');
      return;
    }
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.dataset.label = submitBtn.textContent;
      submitBtn.textContent = currentLang === 'ru' ? 'Отправка…' : 'Se trimite…';
    }
    var text =
      '\u{1F3D7}️ *Clemantin demo — заявка с контактов*\n\n' +
      '\u{1F464} ' + name + '\n' +
      '\u{1F4DE} ' + phone + '\n' +
      (email ? '\u{2709} ' + email + '\n' : '') +
      (message ? '\u{1F4AC} ' + message + '\n' : '') +
      '\n_Источник: portfolio/demo/clemantin/contacts_';
    sendToTelegram(text).then(function () {
      showToast(currentLang === 'ru' ? 'Заявка отправлена! (демо)' : 'Cerere trimisă! (demo)');
      form.reset();
    }).catch(function () {
      showToast(currentLang === 'ru' ? 'Ошибка отправки' : 'Eroare la trimitere');
    }).finally(function () {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = submitBtn.dataset.label || (currentLang === 'ru' ? 'Отправить' : 'Trimite');
      }
    });
  });
}

function sendToTelegram(text) {
  return fetch('https://api.telegram.org/bot' + TG_BOT_TOKEN + '/sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TG_CHAT_ID, text: text, parse_mode: 'Markdown' })
  }).then(function (r) { return r.json(); }).then(function (res) {
    if (!res.ok) throw new Error(res.description || 'TG error');
    return res;
  });
}

// ============================================================
// SHARED UI (slider, mobile nav, scroll, counters, toast)
// ============================================================

function initShared() {
  // Hero slider
  var slider = document.getElementById('heroSlider');
  if (slider) {
    var slides = slider.querySelectorAll('.hero-slide');
    var dots = slider.querySelectorAll('.hero-slider__dot');
    var prev = slider.querySelector('[data-slider-prev]');
    var next = slider.querySelector('[data-slider-next]');
    var progressBar = slider.querySelector('.hero-slider__progress-bar');
    var current = 0;
    var interval = 6500;
    var timer = null;

    function show(idx) {
      slides[current].classList.remove('active');
      if (dots[current]) dots[current].classList.remove('active');
      current = (idx + slides.length) % slides.length;
      slides[current].classList.add('active');
      if (dots[current]) dots[current].classList.add('active');
      restartProgress();
    }
    function restartProgress() {
      if (progressBar) {
        progressBar.style.transition = 'none';
        progressBar.style.width = '0%';
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            progressBar.style.transition = 'width ' + interval + 'ms linear';
            progressBar.style.width = '100%';
          });
        });
      }
      clearTimeout(timer);
      timer = setTimeout(function () { show(current + 1); }, interval);
    }
    if (prev) prev.addEventListener('click', function () { show(current - 1); });
    if (next) next.addEventListener('click', function () { show(current + 1); });
    dots.forEach(function (dot, i) { dot.addEventListener('click', function () { show(i); }); });
    restartProgress();
  }

  // Header scroll effect
  var header = document.getElementById('header');
  if (header) {
    function onScroll() { header.classList.toggle('header--scrolled', window.scrollY > 60); }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Mobile nav
  var burger = document.getElementById('burgerBtn');
  var mobileNav = document.getElementById('mobileNav');
  var mobileClose = document.getElementById('mobileNavClose');
  function openMobileNav() {
    if (mobileNav) mobileNav.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (burger) burger.setAttribute('aria-expanded', 'true');
  }
  function closeMobileNav() {
    if (mobileNav) mobileNav.classList.remove('open');
    document.body.style.overflow = '';
    if (burger) burger.setAttribute('aria-expanded', 'false');
  }
  if (burger) burger.addEventListener('click', openMobileNav);
  if (mobileClose) mobileClose.addEventListener('click', closeMobileNav);
  if (mobileNav) mobileNav.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') closeMobileNav();
  });

  // Counter animation
  var counters = document.querySelectorAll('[data-count]');
  if (counters.length && 'IntersectionObserver' in window) {
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { animateCounter(e.target); co.unobserve(e.target); }
      });
    }, { threshold: 0.4 });
    counters.forEach(function (c) { co.observe(c); });
  }

  // Scroll reveal
  var revealEls = document.querySelectorAll('[data-animate]');
  if (revealEls.length && 'IntersectionObserver' in window) {
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('visible'); ro.unobserve(e.target); }
      });
    }, { threshold: 0.1, rootMargin: '-30px' });
    revealEls.forEach(function (el) { ro.observe(el); });
  }

  // Lang switch buttons
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.lang-switch__btn');
    if (!btn) return;
    e.preventDefault();
    setLang(btn.dataset.lang);
  });

  // Back to top
  var backToTop = document.getElementById('backToTop');
  if (backToTop) {
    window.addEventListener('scroll', function () {
      backToTop.classList.toggle('visible', window.scrollY > 400);
    }, { passive: true });
    backToTop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  }
}

function animateCounter(el) {
  var target = parseInt(el.dataset.count);
  if (isNaN(target)) return;
  var suffix = el.dataset.suffix || '';
  var duration = 1500;
  var t0 = null;
  function step(t) {
    if (!t0) t0 = t;
    var p = Math.min((t - t0) / duration, 1);
    var eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.floor(eased * target) + suffix;
    if (p < 1) requestAnimationFrame(step);
    else el.textContent = target + suffix;
  }
  requestAnimationFrame(step);
}

// ============================================================
// HELPERS
// ============================================================

var toastTimer;
function showToast(msg) {
  var toast = document.getElementById('toast');
  if (!toast) { console.log('toast:', msg); return; }
  var text = document.getElementById('toastText');
  if (text) text.textContent = msg; else toast.textContent = msg;
  toast.classList.add('show', 'active');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { toast.classList.remove('show', 'active'); }, 3500);
}

function setText(id, val) {
  var el = document.getElementById(id);
  if (el) el.textContent = val;
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function iconSvg(name) {
  var icons = {
    home:        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    refresh:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>',
    blueprint:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>',
    facade:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="2" width="16" height="20" rx="1"/><line x1="9" y1="6" x2="9" y2="6.01"/><line x1="15" y1="6" x2="15" y2="6.01"/><line x1="9" y1="11" x2="9" y2="11.01"/><line x1="15" y1="11" x2="15" y2="11.01"/><line x1="12" y1="16" x2="12" y2="22"/></svg>',
    interior:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 21h18M5 21V7a2 2 0 012-2h10a2 2 0 012 2v14"/><path d="M9 9h6v4H9z"/></svg>',
    landscape:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="6" r="3"/><path d="M12 9v6M9 12h6M5 21h14a2 2 0 002-2v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2a2 2 0 002 2z"/></svg>',
    engineering: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9 1.65 1.65 0 004.27 7.18l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>',
    roof:        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 13l10-8 10 8M5 13v8h14v-8"/></svg>',
    license:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>',
    certificate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>',
    shield:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>',
    insurance:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L3 7v6c0 5 3.5 9.5 9 11 5.5-1.5 9-6 9-11V7l-9-5z"/></svg>'
  };
  return icons[name] || '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/></svg>';
}

// Service worker: actively unregister any previously installed SW.
// PWA was dropped because cached SWs from earlier broken builds kept
// serving stale assets. Plain HTTP caching is now the only mechanism.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function (regs) {
    regs.forEach(function (r) { r.unregister(); });
  }).catch(function () {});
  if ('caches' in window) {
    caches.keys().then(function (keys) {
      keys.forEach(function (k) { caches.delete(k); });
    }).catch(function () {});
  }
}

// ============================================================
// BOOTSTRAP
// ============================================================

document.addEventListener('DOMContentLoaded', function () {
  initShared();
  loadI18n().then(function () {
    if (document.getElementById('servicesGrid')) renderServices();
    if (document.getElementById('housesTeaser')) renderHousesTeaser();
    if (document.getElementById('housesGrid')) renderHouses();
    if (document.getElementById('portfolioGrid')) renderPortfolio();
    if (document.getElementById('reviewsTrack')) renderReviews();
    if (document.getElementById('faqList')) renderFaq();
    if (document.getElementById('teamGrid')) renderTeam();
    if (document.getElementById('certsGrid')) renderCerts();
    if (document.getElementById('servicesFull')) renderServicesFull();
    if (document.getElementById('calcRoot')) initCalculator();
    if (document.getElementById('contactForm')) initContactForm();
  });
});

})();
