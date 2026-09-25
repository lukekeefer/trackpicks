const TRACKPICKS_SW_VERSION = '1.4.5';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
    } catch (_) {}
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  const isNavigation = req.mode === 'navigate';
  const isVersionFile = url.pathname.endsWith('/version.json');

  if (isNavigation || isVersionFile) {
    event.respondWith((async () => {
      try {
        return await fetch(new Request(req, { cache: 'no-store' }));
      } catch (_) {
        return fetch(req);
      }
    })());
  }
});
