/* Service worker — shell in cache, aggiornamento in background. */
const VERSION = 'fcs-v4.2.19';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './styles/app.css', './styles/logo.css', './styles/font.css', './design/tokens/tokens.css',
  // I caratteri stanno in casa: nella cache ci vanno, se no senza rete si vede
  // il ripiego di sistema. Solo le varianti latin, le altre entrano al bisogno.
  './media/font/lato-400-latin.woff2', './media/font/lato-700-latin.woff2',
  './media/font/lato-900-latin.woff2', './media/font/ibm-plex-mono-500-latin.woff2',
  './src/app.js', './src/state.js', './src/data.js', './src/engine.js', './src/ui.js', './src/ui-esc.js', './src/avatar.js', './src/maglia.js', './src/personaggio.js', './src/sprite.js', './src/config.js', './src/backend.js', './src/auth-clerk.js',
  './src/views/index.js', './src/views/dashboard.js', './src/views/rosa.js', './src/views/formazione.js', './src/views/calendario.js',
  './src/views/classifica.js', './src/views/voti.js', './src/views/live.js', './src/views/listone.js', './src/views/giocatore.js',
  './src/views/regolamento.js', './src/views/scheda.js', './src/views/impostazioni.js', './src/views/mercato.js', './src/views/admin.js', './src/views/auth.js', './src/views/leghe.js', './src/views/lega.js', './src/views/setup.js', './src/views/onboarding.js', './src/views/gestione.js', './src/views/squadra.js', './src/views/vice.js', './src/views/legali.js', './src/notifiche.js', './src/schermo.js', './vendor/supabase-js.js', './src/views/asta.js', './src/views/video.js', './src/video.js', './src/video-dati.js', './src/views/regole.js', './src/views/scambi.js', './src/views/confronto.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png',
  // icone evento: compaiono su Voti, Live e Giudice Dati, quindi valgono il precache.
  // Le altre (menu, eventi di secondo livello) entrano in cache al primo uso.
  './media/icone/eventi/gol.png', './media/icone/eventi/assist.png', './media/icone/eventi/autogol.png',
  './media/icone/eventi/ammonizione.png', './media/icone/eventi/espulsione.png', './media/icone/eventi/espulsione-x2.png',
  './media/icone/eventi/rigore-sbagliato.png', './media/icone/eventi/rigore-parato.png',
  // Le sagome della barra in basso stanno su ogni schermata: vanno precaricate.
  './media/icone/nav/campo.png', './media/icone/nav/maglia-10.png', './media/icone/nav/calendario.png',
  './media/icone/nav/coppa.png', './media/icone/nav/grafico.png',
  // Sfondo della schermata d'accesso: è la prima cosa che si vede.
  './media/sfondo-accesso.jpg',
  // La maglia sta in copertina: e' la prima immagine della dashboard.
  './media/maglia-base.webp', './media/sfondo-home.jpg',
  // Sfondo della schermata d'accesso: è la prima cosa che si vede.
  // La maglia sta in copertina: e' la prima immagine della dashboard.
  
];
/**
 * Il guscio si riscarica dalla RETE, non dalla cache del browser.
 * Con un semplice addAll() le richieste passano dalla cache HTTP, e la nuova
 * versione del service worker finiva per riempirsi dei file VECCHI: il numero
 * di versione cambiava ma l'app restava quella di prima.
 */
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => Promise.all(
    SHELL.map((u) => fetch(new Request(u, { cache: 'reload' }))
      .then((r) => (r.ok ? c.put(u, r) : null))
      .catch(() => null)),
  )).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== VERSION + '-ext' && k !== VERSION + '-api').map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
/* Notifiche push: il service worker e' l'unico che le puo' mostrare, ed e'
   l'unica parte che gira a telefono chiuso. Chi le spedisce sta in
   supabase/functions/promemoria. */
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  const titolo = d.titolo || 'Fantacampionato Sammarinese';
  e.waitUntil(self.registration.showNotification(titolo, {
    body: d.corpo || '',
    tag: d.tag || 'fcs',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    data: { url: d.url || './#/rosa/formazione' },
  }));
});

/* Toccare la notifica porta dove serve, e riusa la finestra se c'e' gia'
   aperta invece di aprirne un'altra. */
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const dove = (e.notification.data && e.notification.data.url) || './#/rosa/formazione';
  e.waitUntil((async () => {
    const aperte = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of aperte) {
      if (c.url.includes(self.registration.scope)) { await c.focus(); return c.navigate(dove).catch(() => null); }
    }
    return self.clients.openWindow(dove);
  })());
});

self.addEventListener('fetch', (e) => {
  // Le estensioni del browser passano di qui con schemi tipo chrome-extension://
  // che la Cache API rifiuta: senza questa riga ogni loro richiesta finiva in
  // "Failed to execute 'put' on 'Cache'", quindici volte di fila nella console,
  // e il rumore copriva gli errori veri. Non sono roba nostra: si lasciano
  // passare senza toccarle.
  if (!e.request.url.startsWith('http')) return;

  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Media: Safari li chiede a pezzi (Range) e la Cache API rifiuta le risposte 206.
  // Passano direttamente alla rete, senza cache.
  if (e.request.headers.has('range') || /\.(mp4|webm|mov|m4v)$/i.test(url.pathname)) return;
  // Le notizie sono dati freschi, non guscio: prima la rete, e se manca si usa
  // l'ultima copia. Senza questo, stale-while-revalidate servirebbe notizie vecchie.
  if (url.origin === location.origin && url.pathname.startsWith('/api/')) {
    e.respondWith(caches.open(VERSION + '-api').then(async (c) => {
      try { const r = await fetch(e.request); if (r.status === 200) await c.put(e.request, r.clone()).catch(() => null); return r; }
      catch { return (await c.match(e.request)) || new Response('{"notizie":[]}', { headers: { 'content-type': 'application/json' } }); }
    }));
    return;
  }
  // font e risorse esterne: rete, con fallback cache
  if (url.origin !== location.origin) {
    e.respondWith(caches.open(VERSION + '-ext').then(async (c) => { try { const r = await fetch(e.request); if (r.status === 200) await c.put(e.request, r.clone()).catch(() => null); return r; } catch { return (await c.match(e.request)) || Response.error(); } }));
    return;
  }
  // shell: stale-while-revalidate
  e.respondWith(caches.open(VERSION).then(async (c) => {
    const cached = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(async (r) => { if (r.status === 200) await c.put(e.request, r.clone()).catch(() => null); return r; }).catch(() => null);
    return cached || (await net) || (e.request.mode === 'navigate' ? c.match('./index.html') : Response.error());
  }));
});
