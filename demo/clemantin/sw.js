// Demo PWA service worker for /demo/clemantin/
// All paths are RELATIVE so the SW works regardless of host (works under
// /demo/clemantin/ on GitHub Pages, where scope is the SW directory).
var CACHE_NAME = 'clemantin-demo-v1';
var APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './images/logo-white.webp',
  './images/logo.webp'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) { return cache.addAll(APP_SHELL); })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; })
            .map(function (k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;

  // Same-origin only — never cache cross-origin (Telegram API, fonts CDN, etc.)
  if (new URL(event.request.url).origin !== self.location.origin) return;

  // Network-first for HTML so fresh updates land quickly
  var accept = event.request.headers.get('accept') || '';
  if (accept.indexOf('text/html') !== -1) {
    event.respondWith(
      fetch(event.request).catch(function () { return caches.match(event.request); })
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      return cached || fetch(event.request).then(function (response) {
        if (response && response.status === 200 && response.type === 'basic') {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, clone); });
        }
        return response;
      });
    })
  );
});
