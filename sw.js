// Super Cowboy — keeps images and sounds on the device so they are NOT downloaded every time.
// To force players to re-download changed assets, bump the version below (v1 -> v2).
const CACHE = 'super-cowboy-assets-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// The game sends the list of assets it just loaded + the assets version from version.json.
// If the version changed, the old saved assets are deleted so the new files are downloaded.
const META = new URL('__assets_version__', self.registration.scope).href;

self.addEventListener('message', e => {
  const d = e.data;
  if (!d || d.type !== 'precache') return;
  e.waitUntil((async () => {
    let cache = await caches.open(CACHE);
    if (d.version) {
      const stored = await cache.match(META).then(r => r ? r.text() : null);
      if (stored !== String(d.version)) {
        await caches.delete(CACHE);
        cache = await caches.open(CACHE);
        await cache.put(META, new Response(String(d.version)));
      }
    }
    await Promise.all((d.urls || []).map(u =>
      cache.match(u).then(hit => hit || cache.add(u).catch(() => {}))
    ));
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;            // never touch Pi / Supabase / payments
  if (!/\/assets\//.test(url.pathname)) return;          // only images/sounds; code stays fresh

  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }))
    )
  );
});
