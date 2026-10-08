// Service Worker – Offline-Fähigkeit. Alle Pfade relativ zum Scope, damit die App auch unter
// https://<user>.github.io/<repo>/ funktioniert. Bei jeder Änderung VERSION erhöhen.
const VERSION = 'tc2026-v1.1.0';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/util.js', 'js/icons.js', 'js/store.js', 'js/crypto.js', 'js/data.js', 'js/model.js', 'js/ui.js',
  'js/details.js', 'js/weather.js', 'js/overpass.js', 'js/privacy.js', 'js/version.js',
  'js/views/home.js', 'js/views/plan.js', 'js/views/discover.js', 'js/views/map.js', 'js/views/more.js',
  'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css',
  'vendor/leaflet/images/marker-icon.png', 'vendor/leaflet/images/marker-icon-2x.png', 'vendor/leaflet/images/marker-shadow.png',
  'vendor/leaflet/images/layers.png', 'vendor/leaflet/images/layers-2x.png',
  'fonts/InterVariable.woff2', 'fonts/Fraunces.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
  'data/private.enc.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL.map((p) => new Request(p, { cache: 'reload' })))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Fremd-APIs (Wetter, OSM, Kacheln) nicht cachen

  // Seitenaufrufe: App-Shell aus dem Cache (Hash-Routing → immer index.html)
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      return (await cache.match('index.html')) || fetch(req).catch(() => new Response('Offline', { status: 503 }));
    })());
    return;
  }

  // Verschlüsselte Daten: zuerst Netz (aktuellste Version), sonst Cache
  if (url.pathname.endsWith('/data/private.enc.json')) {
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      try { const res = await fetch(req); if (res.ok) cache.put(req, res.clone()); return res; }
      catch { return (await cache.match(req, { ignoreSearch: true })) || new Response('{}', { status: 503 }); }
    })());
    return;
  }

  // Übrige App-Dateien: Cache zuerst, sonst Netz
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    } catch { return new Response('', { status: 504 }); }
  })());
});
