/**
 * Gli highlights si guardano dentro l'app.
 *
 * Alex, 10/10: «una volta si potevano vedere direttamente dall'app». Il
 * lettore incorporato c'era, ma dalla home si finiva sulla lista e bisognava
 * cercare la partita e toccare play una seconda volta; e su iPhone, senza
 * playsinline, il video voleva il lettore di sistema e dall'app sulla Home
 * restava nero. Qui si guarda che:
 *   - toccando una partita negli highlights della home si apre la pagina
 *     Video con QUEL video gia' nel lettore, dentro l'app;
 *   - il lettore e' quello di youtube-nocookie, con playsinline e origin;
 *   - prima del tocco nessuna richiesta va a YouTube.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    localStorage.setItem('fcs:auth', 'supabase');
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'system' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  const p = await ctx.newPage(); p.on('dialog', (d) => d.accept());
  const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  const aYouTube = []; p.on('request', (r) => { if (/youtube/.test(r.url())) aYouTube.push(r.url()); });
  // il lettore vero non serve: basta sapere che l'app lo chiede, e come
  await p.route(/youtube/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>lettore</p>' }));
  const w = (ms = 450) => p.waitForTimeout(ms);

  await p.goto(`${BASE}/#/login`, { waitUntil: 'load' }); await w(1200);
  await p.click('[data-tab="up"]'); await w(250);
  await p.fill('#email', 'v@e.it'); await p.fill('#name', 'Alex'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1200);
  await p.click('[data-form="create"]'); await w(250);
  await p.fill('#lname', 'Torneo'); await p.fill('#team', 'Hasta El Roxy'); await p.click('#go-create'); await w(1400);
  await p.evaluate(() => { location.hash = '#/'; }); await w(1500);

  const riga = p.locator('.vh[data-apri-video]').first();
  et(await riga.count() === 1, 'in home ci sono gli highlights con la partita da aprire');
  if (await riga.count()) {
    et(aYouTube.length === 0, `prima di toccare niente nessuna richiesta a YouTube (${aYouTube.length})`);
    const id = await riga.getAttribute('data-apri-video');
    await riga.tap(); await w(1500);
    et((await p.evaluate(() => location.hash)) === '#/video', 'il tocco porta alla pagina Video');
    const src = await p.evaluate((vid) => document.querySelector(`[data-vid="${vid}"] iframe`)?.getAttribute('src') || '', id);
    et(src.includes(`youtube-nocookie.com/embed/${id}`), `parte proprio quella partita, dentro l'app (${src.slice(0, 60) || 'nessun lettore'})`);
    et(/playsinline=1/.test(src), 'il lettore ha playsinline, se no su iPhone resta nero');
    et(/origin=http/.test(src), 'il lettore dice da che sito e\' incorporato (origin)');
    const inVista = await p.evaluate((vid) => { const r = document.querySelector(`[data-vid="${vid}"]`).getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }, id);
    et(inVista, 'e il video e\' in vista, non da cercare scorrendo');
    await p.screenshot({ path: `${process.env.USCITA || '/tmp'}/video-in-app.png` }).catch(() => {});
    // e il play sulle altre schede funziona ancora
    const altra = p.locator('.vid-play').first();
    if (await altra.count()) {
      await altra.tap(); await w(500);
      et(await p.locator('.vid-cop.in iframe').count() === 2, 'il play sulle altre partite apre il lettore anche li\'');
    }
  }
  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
  await b.close();
  for (const t of ok) console.log('  ok  ' + t);
  for (const t of ko) console.log('  KO  ' + t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
