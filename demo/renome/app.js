/* ============================================================
   Renome demo — single-file client app
   Combines original cart.js, main.js, and adds:
   - Client-side i18n (data-i18n attributes, ro/ru via localStorage)
   - Menu rendering from data/menu.json + categories.json
   - Search/filter for menu page
   - Cart page rendering + checkout → Telegram bot
   ============================================================ */
(function () {
'use strict';

// ============================================================
// CONFIG
// ============================================================

// Telegram bot for form submissions. SAME bot as portfolio/script.js — token
// is exposed in client-side code. See plan: "Out of scope" — fix later via
// serverless proxy.
var TG_BOT_TOKEN = '8631897124:AAH4-C90jNUbRv5dNXdsdQqIv_9OaP_t9cE';
var TG_CHAT_ID = '7269255846';

var LANG_KEY = 'vs_lang';
var CART_KEY = 'renome_cart';
var DELIVERY_FEE = 50;
var FREE_DELIVERY_FROM = 500;

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

  // Custom strings not in renome's locales (demo banner, thanks, etc.)
  var customRu = {
    'demoBanner.text': 'Это демо-витрина. Заказы не передаются в реальный ресторан.',
    'demoBanner.back': '← к портфолио',
    'menu.searchPlaceholder': 'Поиск по меню...',
    'thanks.title': 'Заказ принят!',
    'thanks.subtitle': 'В реальном Renome менеджер связался бы с вами в течение 5 минут. Это демо — заявка ушла в Telegram-бот разработчика для теста.',
    'thanks.viewMenu': 'Вернуться в меню',
    'thanks.backToPortfolio': 'К портфолио',
    'cart.demoNote': 'Demo: заказ отправится в Telegram-бот разработчика, не в ресторан.',
    'footer.devCredit': 'Дизайн и разработка',
    'meta.menuH1': 'Меню кафе Renome — Бельцы',
    'cart.products': 'Товары'
  };
  var customRo = {
    'demoBanner.text': 'Aceasta este o vitrină demo. Comenzile nu ajung la restaurantul real.',
    'demoBanner.back': '← înapoi la portofoliu',
    'menu.searchPlaceholder': 'Căutare în meniu...',
    'thanks.title': 'Comandă primită!',
    'thanks.subtitle': 'În Renome real, un manager v-ar contacta în 5 minute. Acesta este demo — cererea a fost trimisă în botul Telegram al dezvoltatorului pentru test.',
    'thanks.viewMenu': 'Înapoi la meniu',
    'thanks.backToPortfolio': 'Înapoi la portofoliu',
    'cart.demoNote': 'Demo: comanda va fi trimisă în botul Telegram al dezvoltatorului, nu la restaurant.',
    'footer.devCredit': 'Design și dezvoltare',
    'meta.menuH1': 'Meniu Cafenea Renome — Bălți',
    'cart.products': 'Produse'
  };
  var fallback = currentLang === 'ro' ? customRo : customRu;

  function resolve(key) {
    var v = lookupKey(dict, key);
    if (v == null || typeof v !== 'string') v = fallback[key];
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
  document.querySelectorAll('[data-i18n-attr-alt]').forEach(function (el) {
    var v = resolve(el.dataset.i18nAttrAlt);
    if (v != null) el.alt = v;
  });

  // Reflect lang in <html> + lang button states
  document.documentElement.lang = currentLang;
  document.querySelectorAll('.header__lang-btn, .mobile-nav__lang-btn').forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.lang === currentLang);
  });
}

function setLang(lang) {
  if (lang !== 'ro' && lang !== 'ru') lang = 'ru';
  currentLang = lang;
  try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
  applyI18n();

  // Re-render dynamic content if present (menu cards, cart items, categories)
  if (document.getElementById('catGrid')) renderCategoriesGrid();
  if (document.getElementById('menuMain')) renderMenu();
  if (document.getElementById('cartItems')) renderCart();
}

function loadI18n() {
  return fetch('data/i18n.json').then(function (r) { return r.json(); }).then(function (data) {
    i18n = data;
    currentLang = getStoredLang();
    applyI18n();
  }).catch(function (e) {
    console.warn('i18n load failed', e);
  });
}

// Helper to pick localized field from object: L(item, 'name') → item.name_ru when ru, item.name otherwise
function L(obj, field) {
  if (!obj) return '';
  if (currentLang === 'ru') return obj[field + '_ru'] || obj[field] || '';
  return obj[field] || obj[field + '_ru'] || '';
}

// ============================================================
// CART (localStorage)
// ============================================================

var Cart = {
  getItems: function () {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY)) || [];
    } catch (e) { return []; }
  },
  saveItems: function (items) {
    try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch (e) {}
    Cart.updateBadge();
  },
  addItem: function (id, name, price, image, weight, category) {
    var items = Cart.getItems();
    var existing = items.find(function (i) { return i.id === id; });
    if (existing) {
      existing.quantity++;
    } else {
      items.push({
        id: id, name: name, price: parseFloat(price),
        image: image || '', weight: weight || '', category: category || '',
        quantity: 1
      });
    }
    Cart.saveItems(items);
  },
  removeItem: function (id) {
    Cart.saveItems(Cart.getItems().filter(function (i) { return i.id !== id; }));
  },
  updateQuantity: function (id, qty) {
    var items = Cart.getItems();
    var item = items.find(function (i) { return i.id === id; });
    if (item) item.quantity = Math.max(1, Math.min(99, qty));
    Cart.saveItems(items);
  },
  getTotal: function () {
    return Cart.getItems().reduce(function (sum, i) { return sum + i.price * i.quantity; }, 0);
  },
  getCount: function () {
    return Cart.getItems().reduce(function (sum, i) { return sum + i.quantity; }, 0);
  },
  clear: function () {
    try { localStorage.removeItem(CART_KEY); } catch (e) {}
    Cart.updateBadge();
  },
  updateBadge: function () {
    var count = Cart.getCount();
    var badge = document.getElementById('headerCartBadge');
    if (badge) badge.textContent = count > 0 ? count : '';
    var mobileBadge = document.getElementById('mobileCartBadge');
    if (mobileBadge) {
      mobileBadge.textContent = count > 0 ? count : '';
      mobileBadge.classList.toggle('show', count > 0);
    }
  }
};

// ============================================================
// IMAGE PATH HELPERS
// ============================================================

function thumbUrl(itemImage) {
  // itemImage from JSON is like "menu/breakfast-omlet.jpg" — strip extension, add .thumb.webp
  if (!itemImage) return '';
  var base = itemImage.replace(/\.(jpg|jpeg|png)$/i, '');
  return 'img/' + base + '.thumb.webp';
}

function fullUrl(itemImage) {
  if (!itemImage) return '';
  var base = itemImage.replace(/\.(jpg|jpeg|png)$/i, '');
  return 'img/' + base + '.full.webp';
}

// ============================================================
// CATEGORIES GRID (home page)
// ============================================================

var dataCache = {};

function loadJson(file) {
  if (dataCache[file]) return Promise.resolve(dataCache[file]);
  return fetch('data/' + file).then(function (r) { return r.json(); }).then(function (d) {
    dataCache[file] = d;
    return d;
  });
}

function renderCategoriesGrid() {
  var grid = document.getElementById('catGrid');
  if (!grid) return;
  loadJson('categories.json').then(function (cats) {
    grid.innerHTML = cats.map(function (cat) {
      return (
        '<a href="menu.html#' + cat.slug + '" class="cat-card">' +
        '  <img src="img/cat/' + cat.slug + '.webp" alt="' + escapeAttr(L(cat, 'name')) + ' — Renome" class="cat-card__img" loading="lazy" onerror="this.style.display=\'none\'">' +
        '  <span class="cat-card__name">' + escapeHtml(L(cat, 'name')) + '</span>' +
        '</a>'
      );
    }).join('');
  });
}

// ============================================================
// MENU PAGE
// ============================================================

function renderMenu() {
  var sidebar = document.getElementById('menuSidebarNav');
  var main = document.getElementById('menuMain');
  if (!sidebar || !main) return;

  Promise.all([loadJson('categories.json'), loadJson('menu.json')]).then(function (results) {
    var cats = results[0];
    var items = results[1];

    // Group items by category slug
    var byCat = {};
    cats.forEach(function (c) { byCat[c.slug] = { cat: c, items: [] }; });
    items.forEach(function (item) {
      var c = cats.find(function (cc) { return cc.id === item.category_id; });
      if (c && byCat[c.slug]) byCat[c.slug].items.push(item);
    });

    // Sidebar
    sidebar.innerHTML = cats.filter(function (c) {
      return byCat[c.slug] && byCat[c.slug].items.length > 0;
    }).map(function (cat) {
      return (
        '<a href="#' + cat.slug + '" class="menu-sidebar__link" data-category="' + cat.slug + '">' +
        '  <span class="menu-sidebar__link-name">' + escapeHtml(L(cat, 'name')) + '</span>' +
        '  <span class="menu-sidebar__count">' + byCat[cat.slug].items.length + '</span>' +
        '</a>'
      );
    }).join('');

    // Main
    main.innerHTML = cats.filter(function (c) {
      return byCat[c.slug] && byCat[c.slug].items.length > 0;
    }).map(function (cat) {
      var its = byCat[cat.slug].items;
      var cards = its.map(function (item) { return menuCardHtml(item, cat); }).join('');
      return (
        '<section class="menu-category" id="' + cat.slug + '" data-category="' + cat.slug + '">' +
        '  <h2 class="menu-category__title">' + escapeHtml(L(cat, 'name')) + '</h2>' +
        '  <div class="menu-grid">' + cards + '</div>' +
        '</section>'
      );
    }).join('');

    // Hook up search
    initMenuSearch();
  });
}

function menuCardHtml(item, cat) {
  var name = L(item, 'name');
  var desc = L(item, 'description');
  var img = item.image ? '<img src="' + thumbUrl(item.image) + '" alt="' + escapeAttr(name) + '" loading="lazy">' :
    '<div class="menu-card__placeholder"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg></div>';

  var badge = '';
  if (item.is_new) badge = '<span class="menu-card__badge menu-card__badge--new">' + (currentLang === 'ru' ? 'НОВОЕ' : 'Nou') + '</span>';
  else if (item.is_popular) badge = '<span class="menu-card__badge menu-card__badge--popular">' + (currentLang === 'ru' ? 'ПОПУЛЯРНОЕ' : 'Popular') + '</span>';

  var addBtn = (currentLang === 'ru' ? 'В корзину' : 'Adaugă');

  return (
    '<article class="menu-card" data-name-search="' + escapeAttr((name + ' ' + (desc || '')).toLowerCase()) + '">' +
    '  <div class="menu-card__visual">' +
    '    ' + badge +
    '    <div class="menu-card__img-wrap">' + img +
    '      <div class="menu-card__overlay"><span class="menu-card__overlay-text">' + (currentLang === 'ru' ? 'Подробнее' : 'Vezi') + '</span></div>' +
    '    </div>' +
    '  </div>' +
    '  <div class="menu-card__content">' +
    '    <h3 class="menu-card__name">' + escapeHtml(name) + '</h3>' +
    '    <div class="menu-card__ornament"><span></span><span></span><span></span></div>' +
    (desc ? '    <p class="menu-card__desc">' + escapeHtml(desc) + '</p>' : '') +
    (item.weight ? '    <span class="menu-card__weight">' + escapeHtml(item.weight) + '</span>' : '') +
    '    <div class="menu-card__price-row">' +
    '      <span class="menu-card__price">' + item.price + ' <small>MDL</small></span>' +
    (item.old_price ? '      <span class="menu-card__price-old">' + item.old_price + ' MDL</span>' : '') +
    '    </div>' +
    '    <button class="menu-card__cart-btn" data-id="' + item.id + '" data-name="' + escapeAttr(name) + '" data-price="' + item.price + '" data-image="' + escapeAttr(item.image || '') + '" data-weight="' + escapeAttr(item.weight || '') + '" data-category="' + escapeAttr(cat.slug) + '">' +
    '      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
    '      <span>' + addBtn + '</span>' +
    '    </button>' +
    '  </div>' +
    '</article>'
  );
}

function initMenuSearch() {
  var search = document.getElementById('menuSearch');
  if (!search) return;
  search.addEventListener('input', function () {
    var q = search.value.trim().toLowerCase();
    document.querySelectorAll('.menu-category').forEach(function (cat) {
      var visibleCount = 0;
      cat.querySelectorAll('.menu-card').forEach(function (card) {
        var match = !q || (card.dataset.nameSearch || '').indexOf(q) !== -1;
        card.style.display = match ? '' : 'none';
        if (match) visibleCount++;
      });
      cat.style.display = visibleCount === 0 && q ? 'none' : '';
    });
  });
}

// ============================================================
// CART PAGE
// ============================================================

function renderCart() {
  var emptyEl = document.getElementById('cartEmpty');
  var contentEl = document.getElementById('cartContent');
  var itemsEl = document.getElementById('cartItems');
  if (!itemsEl) return;

  var items = Cart.getItems();

  if (items.length === 0) {
    if (emptyEl) emptyEl.style.display = '';
    if (contentEl) contentEl.style.display = 'none';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';
  if (contentEl) contentEl.style.display = '';

  itemsEl.innerHTML = items.map(function (item) {
    var img = item.image ? '<img src="' + thumbUrl(item.image) + '" alt="' + escapeAttr(item.name) + '">' :
      '<div class="cart-item__placeholder"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></div>';
    return (
      '<div class="cart-item" data-id="' + item.id + '">' +
      '  <div class="cart-item__visual">' + img + '</div>' +
      '  <div class="cart-item__body">' +
      '    <h3 class="cart-item__name">' + escapeHtml(item.name) + '</h3>' +
      (item.weight ? '<span class="cart-item__weight">' + escapeHtml(item.weight) + '</span>' : '') +
      '    <div class="cart-item__price">' + item.price + ' MDL</div>' +
      '  </div>' +
      '  <div class="cart-item__qty">' +
      '    <button class="cart-item__qty-btn" data-action="dec">−</button>' +
      '    <input type="number" class="cart-item__qty-input" value="' + item.quantity + '" min="1" max="99">' +
      '    <button class="cart-item__qty-btn" data-action="inc">+</button>' +
      '  </div>' +
      '  <div class="cart-item__total">' + (item.price * item.quantity) + ' MDL</div>' +
      '  <button class="cart-item__remove" aria-label="Remove">' +
      '    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 01-2 2H9a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>' +
      '  </button>' +
      '</div>'
    );
  }).join('');

  updateCartTotals();
}

function updateCartTotals() {
  var items = Cart.getItems();
  var subtotal = items.reduce(function (s, i) { return s + i.price * i.quantity; }, 0);
  var deliveryType = (document.querySelector('input[name="delivery_type"]:checked') || {}).value || 'delivery';
  var isDelivery = deliveryType === 'delivery';
  var fee = (isDelivery && subtotal > 0 && subtotal < FREE_DELIVERY_FROM) ? DELIVERY_FEE : 0;
  var total = subtotal + fee;

  var subEl = document.getElementById('cartSubtotal');
  var feeEl = document.getElementById('cartDeliveryCost');
  var totalEl = document.getElementById('cartTotal');
  var countEl = document.getElementById('cartCount');
  var addressGroup = document.getElementById('addressGroup');

  if (subEl) subEl.textContent = subtotal + ' MDL';
  if (countEl) countEl.textContent = Cart.getCount();
  if (totalEl) totalEl.textContent = total + ' MDL';
  if (feeEl) {
    if (!isDelivery) {
      feeEl.textContent = '—';
      feeEl.className = 'cart-summary__muted';
    } else if (fee === 0) {
      feeEl.textContent = currentLang === 'ru' ? 'Бесплатно' : 'Gratuită';
      feeEl.className = 'cart-summary__free';
    } else {
      feeEl.textContent = fee + ' MDL';
      feeEl.className = '';
    }
  }
  if (addressGroup) addressGroup.style.display = isDelivery ? '' : 'none';
}

function initCartPage() {
  var itemsEl = document.getElementById('cartItems');
  if (!itemsEl) return;
  renderCart();

  itemsEl.addEventListener('click', function (e) {
    var btn = e.target.closest('button');
    if (!btn) return;
    var row = btn.closest('.cart-item');
    if (!row) return;
    var id = parseInt(row.dataset.id);
    if (btn.classList.contains('cart-item__remove')) {
      Cart.removeItem(id);
      renderCart();
      return;
    }
    var act = btn.dataset.action;
    if (act === 'inc' || act === 'dec') {
      var item = Cart.getItems().find(function (i) { return i.id === id; });
      if (!item) return;
      Cart.updateQuantity(id, item.quantity + (act === 'inc' ? 1 : -1));
      renderCart();
    }
  });

  itemsEl.addEventListener('change', function (e) {
    var input = e.target;
    if (!input.classList || !input.classList.contains('cart-item__qty-input')) return;
    var row = input.closest('.cart-item');
    if (!row) return;
    var id = parseInt(row.dataset.id);
    Cart.updateQuantity(id, parseInt(input.value) || 1);
    renderCart();
  });

  document.querySelectorAll('input[name="delivery_type"]').forEach(function (r) {
    r.addEventListener('change', updateCartTotals);
  });

  var form = document.getElementById('checkoutForm');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      submitOrderToTelegram(form);
    });
  }
}

function submitOrderToTelegram(form) {
  var items = Cart.getItems();
  if (items.length === 0) return;

  var data = new FormData(form);
  var phone = (data.get('phone') || '').trim();
  if (phone.replace(/\D/g, '').length < 6) {
    showToast(currentLang === 'ru' ? 'Введите корректный номер телефона' : 'Introduceți un telefon valid');
    return;
  }
  var deliveryType = data.get('delivery_type') || 'delivery';
  var isDelivery = deliveryType === 'delivery';
  if (isDelivery && !(data.get('address') || '').trim()) {
    showToast(currentLang === 'ru' ? 'Укажите адрес доставки' : 'Specificați adresa');
    return;
  }

  var subtotal = items.reduce(function (s, i) { return s + i.price * i.quantity; }, 0);
  var fee = (isDelivery && subtotal < FREE_DELIVERY_FROM) ? DELIVERY_FEE : 0;
  var total = subtotal + fee;

  var lines = items.map(function (i) { return '  • ' + i.name + ' × ' + i.quantity + ' = ' + (i.price * i.quantity) + ' MDL'; });
  var text =
    '\u{1F35D} *Renome demo — новый заказ*\n' +
    '\n' +
    '\u{1F464} ' + (data.get('name') || '—') + '\n' +
    '\u{1F4DE} ' + phone + '\n' +
    (data.get('email') ? '\u{2709} ' + data.get('email') + '\n' : '') +
    '\u{1F4E6} ' + (deliveryType === 'delivery' ? 'Доставка' : 'Самовывоз') + '\n' +
    (isDelivery && data.get('address') ? '\u{1F4CD} ' + data.get('address') + '\n' : '') +
    (data.get('comment') ? '\u{1F4AC} ' + data.get('comment') + '\n' : '') +
    '\n' +
    '*Состав заказа:*\n' + lines.join('\n') + '\n' +
    (fee > 0 ? '\n*Доставка:* ' + fee + ' MDL' : '') +
    '\n*Итого:* ' + total + ' MDL\n' +
    '\n_Источник: portfolio/demo/renome_';

  var btn = document.getElementById('submitOrderBtn');
  if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = (currentLang === 'ru' ? 'Отправка…' : 'Trimit…'); }

  fetch('https://api.telegram.org/bot' + TG_BOT_TOKEN + '/sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TG_CHAT_ID, text: text, parse_mode: 'Markdown' })
  }).then(function (r) { return r.json(); }).then(function (res) {
    if (res.ok) {
      Cart.clear();
      window.location.href = 'thanks.html';
    } else {
      throw new Error('TG ' + (res.description || 'error'));
    }
  }).catch(function (err) {
    showToast(currentLang === 'ru' ? 'Ошибка отправки. Попробуйте ещё раз.' : 'Eroare. Încercați din nou.');
    if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label || ''; }
    console.warn('order submit', err);
  });
}

// ============================================================
// SHARED INTERACTIONS (mobile nav, header scroll, add-to-cart, toast)
// ============================================================

function initShared() {
  // Mobile burger
  var burger = document.getElementById('burgerBtn');
  var mobileNav = document.getElementById('mobileNav');
  var mobileNavClose = document.getElementById('mobileNavClose');
  function closeMobileNav() {
    if (mobileNav) mobileNav.classList.remove('open');
    if (burger) burger.classList.remove('open');
    document.body.style.overflow = '';
    var ov = document.querySelector('.mobile-nav-overlay');
    if (ov) ov.remove();
  }
  function openMobileNav() {
    if (mobileNav) mobileNav.classList.add('open');
    if (burger) burger.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (!document.querySelector('.mobile-nav-overlay')) {
      var ov = document.createElement('div');
      ov.className = 'mobile-nav-overlay';
      ov.addEventListener('click', closeMobileNav);
      document.body.appendChild(ov);
      ov.offsetHeight;
      ov.classList.add('open');
    }
  }
  if (burger && mobileNav) {
    burger.addEventListener('click', function () {
      if (mobileNav.classList.contains('open')) closeMobileNav();
      else openMobileNav();
    });
    if (mobileNavClose) mobileNavClose.addEventListener('click', closeMobileNav);
    mobileNav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') closeMobileNav();
    });
  }

  // Header scroll effect
  var header = document.getElementById('siteHeader');
  if (header) {
    window.addEventListener('scroll', function () {
      header.classList.toggle('scrolled', window.scrollY > 30);
    }, { passive: true });
  }

  // Smooth scroll
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"], a[href*=".html#"]');
    if (!a) return;
    var href = a.getAttribute('href');
    var hashIdx = href.indexOf('#');
    if (hashIdx === -1) return;
    var hash = href.substring(hashIdx);
    if (!hash || hash === '#') return;
    var samePage = href.startsWith('#') ||
      (window.location.pathname.endsWith(href.substring(0, hashIdx)) || window.location.pathname.endsWith('/' + href.substring(0, hashIdx)));
    if (!samePage) return;
    var target = document.querySelector(hash);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  // Add-to-cart click
  document.addEventListener('click', function (e) {
    var addBtn = e.target.closest('.menu-card__cart-btn');
    if (!addBtn || addBtn.disabled) return;
    e.preventDefault();
    e.stopPropagation();
    var id = parseInt(addBtn.dataset.id);
    var name = addBtn.dataset.name;
    var price = addBtn.dataset.price;
    Cart.addItem(id, name, price, addBtn.dataset.image, addBtn.dataset.weight, addBtn.dataset.category);
    showToast(name + ' — ' + (currentLang === 'ru' ? 'добавлено' : 'adăugat'));
    addBtn.style.transform = 'scale(1.2)';
    setTimeout(function () { addBtn.style.transform = ''; }, 200);
  });

  // Language switcher buttons (header + mobile)
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.header__lang-btn, .mobile-nav__lang-btn');
    if (!btn) return;
    e.preventDefault();
    setLang(btn.dataset.lang);
  });

  // Copyright year
  var year = document.getElementById('copyrightYear');
  if (year) year.textContent = new Date().getFullYear();

  Cart.updateBadge();
}

// ============================================================
// HELPERS
// ============================================================

var toastTimer;
function showToast(msg) {
  var toast = document.getElementById('toast');
  if (!toast) return;
  var text = document.getElementById('toastText');
  if (text) text.textContent = msg; else toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 2500);
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function escapeAttr(str) { return escapeHtml(str); }

// ============================================================
// BOOTSTRAP
// ============================================================

document.addEventListener('DOMContentLoaded', function () {
  initShared();
  loadI18n().then(function () {
    if (document.getElementById('catGrid')) renderCategoriesGrid();
    if (document.getElementById('menuMain')) renderMenu();
    if (document.getElementById('cartItems')) initCartPage();

    // If page lands with #<slug> on menu page, scroll to category
    if (document.getElementById('menuMain') && location.hash) {
      setTimeout(function () {
        var t = document.querySelector(location.hash);
        if (t) t.scrollIntoView({ behavior: 'smooth' });
      }, 500);
    }
  });
});

})();
