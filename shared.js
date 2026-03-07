// ===== Loading Screen =====
(function() {
    const loader = document.getElementById('loader');
    if (!loader) return;
    window.addEventListener('load', () => {
        setTimeout(() => {
            loader.classList.add('hidden');
            document.body.style.overflow = '';
        }, 900);
    });
    if (document.readyState === 'complete') {
        setTimeout(() => loader.classList.add('hidden'), 900);
    }
})();

// ===== Custom Cursor =====
(function() {
    const cursor = document.getElementById('cursor');
    const dot = document.getElementById('cursorDot');
    if (!cursor || !dot || window.innerWidth < 768) return;

    let cx = -100, cy = -100, dx = -100, dy = -100;

    document.addEventListener('mousemove', e => {
        cx = e.clientX;
        cy = e.clientY;
        dot.style.left = cx + 'px';
        dot.style.top = cy + 'px';
    });

    function animate() {
        dx += (cx - dx) * 0.12;
        dy += (cy - dy) * 0.12;
        cursor.style.left = dx + 'px';
        cursor.style.top = dy + 'px';
        requestAnimationFrame(animate);
    }
    animate();

    const hoverTargets = 'a, button, .btn, .magnetic-btn, .service-card, .mini-card, .review-card, .tilt-card, .pricing-card, input, textarea, select';
    document.querySelectorAll(hoverTargets).forEach(el => {
        el.addEventListener('mouseenter', () => cursor.classList.add('hover'));
        el.addEventListener('mouseleave', () => cursor.classList.remove('hover'));
    });
})();

// ===== Scroll Progress Bar =====
(function() {
    const bar = document.getElementById('scrollProgress');
    if (!bar) return;
    function updateProgress() {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
        bar.style.width = progress + '%';
    }
    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();
})();

// ===== Navigation Scroll =====
(function() {
    const nav = document.querySelector('.nav');
    if (!nav) return;
    window.addEventListener('scroll', () => {
        nav.classList.toggle('nav--scrolled', window.scrollY > 50);
    }, { passive: true });
})();

// ===== Mobile Burger =====
(function() {
    const burger = document.getElementById('burger');
    const navLinks = document.getElementById('navLinks');
    if (!burger || !navLinks) return;

    burger.addEventListener('click', () => {
        burger.classList.toggle('active');
        navLinks.classList.toggle('active');
        var isOpen = navLinks.classList.contains('active');
        document.body.style.overflow = isOpen ? 'hidden' : '';
        document.body.classList.toggle('menu-open', isOpen);
    });
    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            burger.classList.remove('active');
            navLinks.classList.remove('active');
            document.body.style.overflow = '';
            document.body.classList.remove('menu-open');
        });
    });
})();

// ===== Scroll Animations (IntersectionObserver) =====
(function() {
    const aosObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                aosObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });
    document.querySelectorAll('[data-aos]').forEach(el => aosObserver.observe(el));
})();

// ===== Text Reveal Animation =====
(function() {
    const reveals = document.querySelectorAll('.text-reveal');
    if (!reveals.length) return;

    reveals.forEach(el => {
        const text = el.textContent;
        el.innerHTML = '';
        [...text].forEach((char, i) => {
            const span = document.createElement('span');
            span.className = 'char';
            span.textContent = char === ' ' ? '\u00A0' : char;
            span.style.transitionDelay = (i * 30) + 'ms';
            el.appendChild(span);
        });
    });

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.3 });

    reveals.forEach(el => revealObserver.observe(el));
})();

// ===== Magnetic Buttons =====
(function() {
    if (window.innerWidth < 768) return;
    document.querySelectorAll('.magnetic-btn').forEach(btn => {
        btn.addEventListener('mousemove', e => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            btn.style.transform = `translate(${x * 0.2}px, ${y * 0.2}px)`;
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = '';
        });
    });
})();

// ===== 3D Tilt Effect =====
(function() {
    if (window.innerWidth < 768) return;
    document.querySelectorAll('.tilt-card').forEach(card => {
        card.addEventListener('mousemove', e => {
            const rect = card.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            const tiltX = (y - 0.5) * 8;
            const tiltY = (x - 0.5) * -8;
            card.style.transform = `perspective(800px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale3d(1.02,1.02,1.02)`;
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
            card.style.transition = 'transform .5s ease';
            setTimeout(() => { card.style.transition = ''; }, 500);
        });
    });
})();

// ===== Smooth Scroll =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
        const targetId = anchor.getAttribute('href');
        if (targetId === '#') return;
        const target = document.querySelector(targetId);
        if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth' });
        }
    });
});

// ===== Currency System (4 zones + dropdown) =====
var CurrencySystem = (function() {
    var ZONES = ['md', 'cis', 'eur', 'usd'];
    var ZONE_DATA = {
        md:  { label: 'MDL', flag: '\u{1F1F2}\u{1F1E9}', suffix: 'mdl' },
        cis: { label: 'RUB', flag: '\u{1F1F7}\u{1F1FA}', suffix: 'rub' },
        eur: { label: 'EUR', flag: '\u{1F1EA}\u{1F1FA}', suffix: 'eur' },
        usd: { label: 'USD', flag: '\u{1F1FA}\u{1F1F8}', suffix: 'usd' }
    };
    var CIS_CODES = ['RU','UA','BY','KZ','UZ','KG','TJ','AM','AZ','GE'];
    var EU_CODES = [
        'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE',
        'IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE',
        'GB','CH','NO','IS','LI','AL','BA','ME','MK','RS','XK'
    ];
    var currentZone = 'md';

    function countryToZone(code) {
        if (code === 'MD') return 'md';
        if (CIS_CODES.indexOf(code) !== -1) return 'cis';
        if (EU_CODES.indexOf(code) !== -1) return 'eur';
        return 'usd';
    }

    function applyRegion(zone) {
        currentZone = zone;
        var data = ZONE_DATA[zone];
        document.querySelectorAll('[data-price-' + data.suffix + ']').forEach(function(el) {
            el.textContent = el.getAttribute('data-price-' + data.suffix);
        });
        document.querySelectorAll('[data-text-' + data.suffix + ']').forEach(function(el) {
            el.textContent = el.getAttribute('data-text-' + data.suffix);
        });
        // Update dropdown UI
        var flagEl = document.querySelector('.currency-dropdown__flag');
        var labelEl = document.querySelector('.currency-dropdown__label');
        if (flagEl) flagEl.textContent = data.flag;
        if (labelEl) labelEl.textContent = data.label;
        document.querySelectorAll('.currency-dropdown__item').forEach(function(item) {
            item.classList.toggle('active', item.dataset.zone === zone);
        });
        try { sessionStorage.setItem('ae_region', zone); } catch (e) {}
    }

    // Dropdown logic
    var dropdown = document.getElementById('currencyDropdown');
    if (dropdown) {
        var toggle = dropdown.querySelector('.currency-dropdown__toggle');
        if (toggle) {
            toggle.addEventListener('click', function(e) {
                e.stopPropagation();
                dropdown.classList.toggle('open');
            });
        }
        document.addEventListener('click', function(e) {
            if (!dropdown.contains(e.target)) dropdown.classList.remove('open');
        });
        dropdown.querySelectorAll('.currency-dropdown__item').forEach(function(item) {
            item.addEventListener('click', function() {
                applyRegion(item.dataset.zone);
                dropdown.classList.remove('open');
            });
        });
    }

    // Init: check cache, then API, fallback to md
    var CACHE_VER = 'v3';
    try {
        var cachedVer = sessionStorage.getItem('ae_ver');
        var cached = sessionStorage.getItem('ae_region');
        if (cachedVer === CACHE_VER && cached && ZONES.indexOf(cached) !== -1) {
            applyRegion(cached);
            return { setZone: applyRegion };
        }
        sessionStorage.removeItem('ae_region');
        sessionStorage.setItem('ae_ver', CACHE_VER);
    } catch (e) {}

    fetch('https://api.country.is/')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            applyRegion(countryToZone((data.country || '').toUpperCase()));
        })
        .catch(function() {
            fetch('https://ipwho.is/')
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    applyRegion(countryToZone((data.country_code || '').toUpperCase()));
                })
                .catch(function() { applyRegion('md'); });
        });

    return { setZone: applyRegion };
})();

// ===== Back to Top =====
(function() {
    const btn = document.getElementById('backToTop');
    if (!btn) return;
    window.addEventListener('scroll', () => {
        btn.classList.toggle('visible', window.scrollY > 500);
    }, { passive: true });
    btn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
})();

// ===== Language Switcher =====
(function() {
    const toggle = document.getElementById('langToggle');
    if (!toggle) return;

    let currentLang = localStorage.getItem('vs_lang') || 'ru';

    function applyLang(lang) {
        currentLang = lang;
        localStorage.setItem('vs_lang', lang);
        document.documentElement.lang = lang === 'en' ? 'en' : 'ru';
        toggle.textContent = lang === 'en' ? 'RU' : 'EN';

        document.querySelectorAll('[data-en]').forEach(el => {
            if (!el.dataset.ru) el.dataset.ru = el.innerHTML;
            el.innerHTML = lang === 'en' ? el.dataset.en : el.dataset.ru;
        });

        document.querySelectorAll('[data-en-ph]').forEach(el => {
            if (!el.dataset.ruPh) el.dataset.ruPh = el.placeholder;
            el.placeholder = lang === 'en' ? el.dataset.enPh : el.dataset.ruPh;
        });
    }

    toggle.addEventListener('click', () => {
        applyLang(currentLang === 'ru' ? 'en' : 'ru');
    });

    if (currentLang === 'en') applyLang('en');
})();

// ===== Dynamic Copyright Year =====
(function() {
    var yearEl = document.getElementById('copyrightYear');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
    var copyEl = document.getElementById('footerCopy');
    if (copyEl && copyEl.dataset.en) {
        copyEl.dataset.en = copyEl.dataset.en.replace('{year}', new Date().getFullYear());
    }
})();
