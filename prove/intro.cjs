/**
 * La presentazione della prima apertura: il video c'e', e se non si puo'
 * leggere non lascia un buco nero.
 *
 * Il video l'ho tolto una volta e Alex l'ha rivoluto — "non c'e' piu' il
 * video di sfondo quando si ha la presentazione dell'app". Qui si controlla
 * che la schermata sia quella giusta, che il video ci sia col suo file e che
 * il file arrivi davvero dal server (200 e video/mp4).
 *
 * QUELLO CHE QUESTA PROVA NON PUO' DIRE: che si veda. Il Chromium delle
 * prove non ha i decodificatori proprietari — canPlayType per H.264 risponde
 * "" — quindi qui il video non parte mai, e un video buono e uno rotto si
 * somigliano. Il formato lo controlla tests/intro-video.test.js guardando
 * dentro il file. Qui si controlla l'altra meta': che con un video che non
 * parte la schermata resti guardabile, perche' e' esattamente quello che
 * succede su un browser senza quei codec.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  // NIENTE fcs:prefs: e' la prima apertura, quella con la presentazione. Con
  // onboarded a true si finisce sull'accesso e non si prova niente.
  await ctx.addInitScript(() => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  const p = await ctx.newPage();
  const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  const risposte = [];
  p.on('response', (r) => { if (/intro\.mp4/.test(r.url())) risposte.push({ stato: r.status(), tipo: r.headers()['content-type'] || '' }); });
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' });
  await p.waitForSelector('.intro', { timeout: 10000 });
  await p.waitForTimeout(2500);

  const r = await p.evaluate(() => {
    const v = document.querySelector('#intro-video'), cv = document.querySelector('#intro-fx');
    const body = document.querySelector('.intro-body');
    const vis = (e) => { if (!e) return false; const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
    return {
      presentazione: !!document.querySelector('.intro'),
      video: !!v, sorgente: v?.querySelector('source')?.getAttribute('src') || null,
      attributi: v ? ['muted', 'autoplay', 'playsinline', 'loop'].filter((a) => v.hasAttribute(a)) : [],
      canvas: !!cv, canvasSiVede: vis(cv),
      // senza codec il video resta trasparente: e' la classe .on che lo accende
      opacita: v ? getComputedStyle(v).opacity : null,
      sfocato: v ? /blur/.test(getComputedStyle(v).filter) : null,
      testoSiVede: vis(body) && body.innerText.trim().length > 10,
      titolo: document.querySelector('.intro-body h1')?.innerText.trim() || '',
    };
  });

  et(r.presentazione, 'alla prima apertura si apre la presentazione');
  et(r.video, 'il video di sfondo c\'e\'');
  et(r.sorgente === 'media/intro.mp4', `e punta al suo file (${r.sorgente})`);
  et(r.attributi.length === 4, `con muted, autoplay, playsinline e loop — senza, su iPhone non parte da solo (${r.attributi.join(', ')})`);
  et(risposte.length > 0 && risposte[0].stato === 200, `il file arriva dal server (${risposte.map((x) => x.stato).join(',') || 'nessuna richiesta'})`);
  et(risposte[0] && /video\/mp4/.test(risposte[0].tipo), `servito come video (${risposte[0]?.tipo})`);
  et(r.canvas && r.canvasSiVede, 'sotto c\'e\' lo sfondo animato di riserva');
  et(r.sfocato, 'il video e\' sfocato, cosi\' il testo sopra si legge');
  et(r.opacita === '0', `senza codec resta trasparente invece di lasciare un buco nero (opacita' ${r.opacita})`);
  et(r.testoSiVede, `e il testo della presentazione si legge lo stesso ("${r.titolo.slice(0, 40)}")`);
  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);

  await ctx.close();
  await b.close();
  for (const t of ok) console.log('  ok  ' + t);
  for (const t of ko) console.log('  KO  ' + t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
