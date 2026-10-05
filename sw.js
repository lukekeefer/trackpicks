const TRACKPICKS_SW_VERSION = '2.7-logo-cache-1';
const TEAM_LOGO_CACHE = `trackpicks-team-logos-${TRACKPICKS_SW_VERSION}`;
const TEAM_LOGO_URLS = [
  'https://a.espncdn.com/i/teamlogos/ncaa/500/103.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/113.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/12.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/120.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/127.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/130.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/135.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/142.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/145.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/150.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/151.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/152.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/153.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/154.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/158.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/16.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/164.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/166.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/167.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/183.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/189.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/193.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/194.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/195.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/197.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/2.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/2005.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/2006.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/201.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/202.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/2026.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/2032.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/204.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/2050.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/2084.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/21.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/2116.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/2117.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/213.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/2132.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/218.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/2199.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/221.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/2226.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/2229.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/2247.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/228.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/2294.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/23.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/2305.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/2306.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/2309.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/2335.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/2348.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/235.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/238.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/239.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/2390.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/2393.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/24.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/242.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/2426.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/2429.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/2433.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/2439.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/2440.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/2449.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/245.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/2459.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/248.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/2483.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/249.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/25.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/2509.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/251.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/252.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/2534.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/254.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/256.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/2567.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/2572.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/2579.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/258.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/259.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/26.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/2623.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/2628.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/2633.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/2636.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/2638.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/264.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/2641.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/2649.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/265.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/2653.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/2655.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/2711.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/275.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/2751.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/276.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/277.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/278.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/290.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/295.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/30.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/309.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/324.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/326.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/328.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/333.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/338.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/344.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/349.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/356.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/36.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/38.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/41.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/48.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/5.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/52.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/55.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/57.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/58.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/59.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/6.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/61.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/62.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/66.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/68.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/77.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/8.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/84.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/87.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/9.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/96.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/97.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/98.png',
  'https://a.espncdn.com/i/teamlogos/ncaa/500/99.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    self.skipWaiting();
    const cache = await caches.open(TEAM_LOGO_CACHE);
    // Do not let one unavailable logo block the service-worker update.
    await Promise.allSettled(TEAM_LOGO_URLS.map(url => cache.add(url)));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys
        .filter(key => key.startsWith('trackpicks-team-logos-') && key !== TEAM_LOGO_CACHE)
        .map(key => caches.delete(key)));
    } catch (_) {}
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET') return;

  const isEspnTeamLogo = url.hostname === 'a.espncdn.com' &&
    url.pathname.startsWith('/i/teamlogos/ncaa/500/') &&
    url.pathname.endsWith('.png');

  if (isEspnTeamLogo) {
    event.respondWith((async () => {
      const cache = await caches.open(TEAM_LOGO_CACHE);
      const cached = await cache.match(req, { ignoreSearch: true });
      if (cached) return cached;
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) await cache.put(req, fresh.clone());
        return fresh;
      } catch (_) {
        return cached || Response.error();
      }
    })());
    return;
  }

  if (url.origin !== self.location.origin) return;
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
