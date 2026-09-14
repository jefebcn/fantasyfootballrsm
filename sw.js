/* Service worker — shell in cache, aggiornamento in background. */
const VERSION = 'fcs-v0.2.0';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './styles/app.css', './design/tokens/tokens.css',
  './src/app.js', './src/state.js', './src/data.js', './src/engine.js', './src/ui.js', './src/sprite.js', './src/config.js', './src/backend.js',
  './src/views/index.js', './src/views/dashboard.js', './src/views/rosa.js', './src/views/formazione.js', './src/views/calendario.js',
  './src/views/classifica.js', './src/views/voti.js', './src/views/live.js', './src/views/listone.js', './src/views/giocatore.js',
  './src/views/regolamento.js', './src/views/scheda.js', './src/views/impostazioni.js', './src/views/mercato.js', './src/views/admin.js', './src/views/auth.js', './src/views/leghe.js', './src/views/lega.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // font e risorse esterne: rete, con fallback cache
  if (url.origin !== location.origin) {
    e.respondWith(caches.open(VERSION + '-ext').then(async (c) => { try { const r = await fetch(e.request); if (r.ok) c.put(e.request, r.clone()); return r; } catch { return (await c.match(e.request)) || Response.error(); } }));
    return;
  }
  // shell: stale-while-revalidate
  e.respondWith(caches.open(VERSION).then(async (c) => {
    const cached = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => null);
    return cached || (await net) || (e.request.mode === 'navigate' ? c.match('./index.html') : Response.error());
  }));
});
