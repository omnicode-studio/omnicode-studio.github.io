// ===== index.html specific JS =====
// Shared code (cursor, nav, currency, language, etc.) is in shared.js

// ===== Animated Counters =====
function animateCounters() {
    document.querySelectorAll('[data-count]').forEach(counter => {
        if (counter.dataset.animated) return;
        const target = parseInt(counter.dataset.count);
        if (isNaN(target)) return;
        counter.dataset.animated = 'true';
        const duration = 1200;
        const start = performance.now();
        function update(now) {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            counter.textContent = Math.round(target * eased);
            if (progress < 1) requestAnimationFrame(update);
            else counter.textContent = target;
        }
        requestAnimationFrame(update);
    });
}

const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            animateCounters();
            counterObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.3 });

document.querySelectorAll('.hero__stats, .case-study__results').forEach(el => counterObserver.observe(el));

// ===== Active Nav Link Tracking =====
const sections = document.querySelectorAll('section[id]');
const navItems = document.querySelectorAll('.nav__links a');

function highlightNavLink() {
    const scrollPos = window.scrollY + window.innerHeight / 3;
    sections.forEach(section => {
        const top = section.offsetTop;
        const height = section.offsetHeight;
        const id = section.getAttribute('id');
        navItems.forEach(link => {
            if (link.getAttribute('href') === '#' + id) {
                const isActive = scrollPos >= top && scrollPos < top + height;
                link.style.color = isActive ? 'var(--accent)' : '';
            }
        });
    });
}

window.addEventListener('scroll', highlightNavLink, { passive: true });
highlightNavLink();

// ===== Parallax =====
(function() {
    const parallaxElements = document.querySelectorAll('[data-parallax]');
    if (!parallaxElements.length || window.innerWidth < 768) return;

    function updateParallax() {
        const scrollY = window.scrollY;
        parallaxElements.forEach(el => {
            const speed = parseFloat(el.dataset.parallax) || 0;
            el.style.transform = `translate3d(0, ${scrollY * speed}px, 0)`;
        });
    }

    window.addEventListener('scroll', updateParallax, { passive: true });
})();

// ===== FAQ Accordion =====
document.querySelectorAll('.faq__q').forEach(btn => {
    btn.addEventListener('click', () => {
        const item = btn.parentElement;
        const isActive = item.classList.contains('active');
        document.querySelectorAll('.faq__item.active').forEach(el => el.classList.remove('active'));
        if (!isActive) item.classList.add('active');
    });
});

// ===== Contact Form — Telegram Bot =====
(function() {
    // TODO: Создать бота через @BotFather в Telegram:
    // 1. Открыть @BotFather → /newbot → задать имя (например, PortfolioFormBot)
    // 2. Скопировать токен сюда в BOT_TOKEN
    // 3. Написать боту /start, затем открыть https://api.telegram.org/bot<TOKEN>/getUpdates
    // 4. Найти chat_id из ответа и вставить в CHAT_ID
    const BOT_TOKEN = '8631897124:AAH4-C90jNUbRv5dNXdsdQqIv_9OaP_t9cE';
    const CHAT_ID = '7269255846';

    function sendToTelegram(form, data) {
        const btn = form.querySelector('button[type="submit"]');
        const original = btn ? btn.innerHTML : '';

        if (!BOT_TOKEN || !CHAT_ID) {
            if (btn) {
                btn.innerHTML = '<span>Отправлено!</span>';
                btn.style.background = 'var(--green)';
            }
            setTimeout(() => {
                if (btn) { btn.innerHTML = original; btn.style.background = ''; }
                form.reset();
            }, 2500);
            return;
        }

        if (btn) { btn.innerHTML = '<span>Отправляю...</span>'; btn.disabled = true; }

        const text = [
            '\u{1F4E9} Новая заявка с портфолио!',
            '',
            '\u{1F464} Имя: ' + (data.name || '\u2014'),
            '\u{1F4F1} Контакт: ' + (data.contact || '\u2014'),
            data.service ? '\u{1F4CB} Услуга: ' + data.service : '',
            data.message ? '\u{1F4AC} Сообщение: ' + data.message : ''
        ].filter(Boolean).join('\n');

        fetch('https://api.telegram.org/bot' + BOT_TOKEN + '/sendMessage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: CHAT_ID, text: text, parse_mode: 'HTML' })
        })
        .then(r => r.json())
        .then(result => {
            if (result.ok) {
                if (btn) { btn.innerHTML = '<span>Отправлено!</span>'; btn.style.background = 'var(--green)'; }
                showFormStatus(form, 'Заявка отправлена! Отвечу в течение 2 часов.', 'success');
            } else {
                throw new Error('Telegram API error');
            }
            setTimeout(() => { if (btn) { btn.innerHTML = original; btn.style.background = ''; btn.disabled = false; } form.reset(); }, 2500);
        })
        .catch(() => {
            if (btn) { btn.innerHTML = original; btn.disabled = false; }
            showFormStatus(form, 'Ошибка отправки. Напишите напрямую в Telegram.', 'error');
        });
    }

    function showFormStatus(form, message, type) {
        let status = form.querySelector('.contact__form-status');
        if (!status) {
            status = document.createElement('div');
            status.className = 'contact__form-status';
            form.appendChild(status);
        }
        status.textContent = message;
        status.className = 'contact__form-status ' + type;
        setTimeout(() => { status.className = 'contact__form-status'; }, 4000);
    }

    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', e => {
            e.preventDefault();
            const formData = new FormData(contactForm);
            sendToTelegram(contactForm, {
                name: formData.get('name'),
                contact: formData.get('contact'),
                service: formData.get('service'),
                message: formData.get('message')
            });
        });
    }

    const exitForm = document.getElementById('exitForm');
    if (exitForm) {
        exitForm.addEventListener('submit', e => {
            e.preventDefault();
            const formData = new FormData(exitForm);
            sendToTelegram(exitForm, {
                name: formData.get('name'),
                contact: formData.get('contact'),
                message: '(Заявка из exit-popup)'
            });
            setTimeout(() => {
                const popup = document.getElementById('exitPopup');
                if (popup) popup.classList.remove('active');
            }, 2600);
        });
    }
})();

// ===== Exit Intent Popup =====
(function() {
    const popup = document.getElementById('exitPopup');
    const closeBtn = document.getElementById('exitPopupClose');
    if (!popup || window.innerWidth < 768) return;

    let shown = false;

    document.addEventListener('mouseout', e => {
        if (shown) return;
        if (e.clientY <= 5 && e.relatedTarget === null) {
            try {
                if (sessionStorage.getItem('vs_exit_shown')) return;
                sessionStorage.setItem('vs_exit_shown', '1');
            } catch(err) {}
            shown = true;
            popup.classList.add('active');
        }
    });

    if (closeBtn) {
        closeBtn.addEventListener('click', () => popup.classList.remove('active'));
    }

    popup.querySelector('.exit-popup__backdrop').addEventListener('click', () => {
        popup.classList.remove('active');
    });
})();

// ===== Sticky Mobile CTA =====
(function() {
    const stickyCta = document.getElementById('stickyCta');
    if (!stickyCta) return;

    function checkSticky() {
        if (window.innerWidth >= 768) {
            stickyCta.classList.remove('visible');
            return;
        }
        const contactSection = document.getElementById('contact');
        if (!contactSection) return;
        const contactTop = contactSection.getBoundingClientRect().top;
        const show = window.scrollY > 400 && contactTop > window.innerHeight;
        stickyCta.classList.toggle('visible', show);
    }

    window.addEventListener('scroll', checkSticky, { passive: true });
    window.addEventListener('resize', checkSticky);
    checkSticky();
})();

// ===== Typewriter Effect =====
(function() {
    const el = document.getElementById('typewriter');
    if (!el) return;
    const phrases = ['Fullstack Web Developer', 'UI / UX Designer', 'Automation Expert'];
    let phraseIdx = 0, charIdx = 0, isDeleting = false;

    const cursorSpan = document.createElement('span');
    cursorSpan.className = 'typewriter-cursor';
    cursorSpan.textContent = '|';
    el.appendChild(cursorSpan);

    const textSpan = document.createElement('span');
    el.insertBefore(textSpan, cursorSpan);

    function tick() {
        const current = phrases[phraseIdx];
        if (isDeleting) {
            charIdx--;
            textSpan.textContent = current.substring(0, charIdx);
            if (charIdx === 0) {
                isDeleting = false;
                phraseIdx = (phraseIdx + 1) % phrases.length;
                setTimeout(tick, 400);
                return;
            }
            setTimeout(tick, 40);
        } else {
            charIdx++;
            textSpan.textContent = current.substring(0, charIdx);
            if (charIdx === current.length) {
                isDeleting = true;
                setTimeout(tick, 2000);
                return;
            }
            setTimeout(tick, 80);
        }
    }
    setTimeout(tick, 600);
})();

// ===== Floating Particles =====
(function() {
    const canvas = document.getElementById('heroParticles');
    if (!canvas || window.innerWidth < 768) return;
    const ctx = canvas.getContext('2d');
    let particles = [];
    const count = 35;
    const colors = ['rgba(99,102,241,', 'rgba(6,182,212,', 'rgba(16,185,129,'];

    function resize() {
        const hero = canvas.parentElement;
        canvas.width = hero.offsetWidth;
        canvas.height = hero.offsetHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < count; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            r: Math.random() * 1.5 + 0.5,
            dx: (Math.random() - 0.5) * 0.3,
            dy: (Math.random() - 0.5) * 0.3,
            opacity: Math.random() * 0.3 + 0.1,
            color: colors[Math.floor(Math.random() * colors.length)]
        });
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.x += p.dx;
            p.y += p.dy;
            if (p.x < 0) p.x = canvas.width;
            if (p.x > canvas.width) p.x = 0;
            if (p.y < 0) p.y = canvas.height;
            if (p.y > canvas.height) p.y = 0;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = p.color + p.opacity + ')';
            ctx.fill();
        });
        requestAnimationFrame(draw);
    }
    draw();
})();

// ===== Hero Entrance Animation =====
(function heroEntrance() {
    const elements = [
        document.querySelector('.hero__badge'),
        document.querySelector('.hero__title'),
        document.querySelector('.hero__role'),
        document.querySelector('.hero__desc'),
        document.querySelector('.hero__actions'),
        document.querySelector('.hero__stats')
    ].filter(Boolean);

    elements.forEach((el, i) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        setTimeout(() => {
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        }, 200 + i * 120);
    });
})();
