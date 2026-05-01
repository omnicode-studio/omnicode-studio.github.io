// KILL-SWITCH SW. On install: skip waiting → activate immediately.
// On activate: delete every cache, unregister this SW, force every
// open tab to reload itself. After this, no SW is registered for the
// origin and no Cache Storage entry remains.
//
// This replaces the previous PWA SW so any user who visited during
// the broken cache window gets cleaned up automatically the moment
// their browser does its next routine sw.js re-check (default 24h,
// or sooner per spec — many browsers re-fetch on each navigation).

self.addEventListener('install', function (event) {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    (async () => {
      try {
        if ('caches' in self) {
          var keys = await caches.keys();
          await Promise.all(keys.map(function (k) { return caches.delete(k); }));
        }
        await self.registration.unregister();
        var clients = await self.clients.matchAll({ type: 'window' });
        clients.forEach(function (c) {
          // navigate forces a clean reload that re-fetches everything
          if (c && c.navigate) c.navigate(c.url).catch(function () {});
        });
      } catch (e) { /* swallow */ }
    })()
  );
});

// Pass-through: never serve anything from cache. Any fetch is just a
// network request (effectively, no SW interception).
self.addEventListener('fetch', function () { /* noop */ });
