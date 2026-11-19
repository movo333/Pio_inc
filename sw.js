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

// The game sends the list of assets it just loaded; we store them right away (first visit too).
self.addEventListener('message', e => {
  if (!e.data || e.data.type !== 'precache') return;
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.all((e.data.urls || []).map(u =>
        cache.match(u).then(hit => hit || cache.add(u).catch(() => {}))
      ))
    )
  );
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
