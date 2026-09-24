/**
 * La presentazione della prima apertura: il video c'e', e se non si puo'
 * leggere non lascia un buco nero.
 *
 * Il video l'ho tolto una volta e Alex l'ha rivoluto — "non c'e' piu' il
 * video di sfondo quando si ha la presentazione dell'app". Qui si controlla
 * che la schermata sia quella giusta, che il video ci sia col suo file e che
 * il file arrivi davvero dal server (200 e video/mp4).
 *
 * QUELLO CHE QUESTA PROVA NON PUO' DIRE: che si veda. Dipende dai
 * decodificatori proprietari del browser che la esegue — il Chromium
 * scaricato da Playwright H.264 non lo legge, quello che si trova sulle
 * macchine di GitHub si' — e infatti la prova era rossa su GitHub e verde
 * qui: dava per scontato che il video non partisse mai e pretendeva un video
 * trasparente, mentre la' il video partiva davvero. Sbagliava lei: il
 * formato lo controlla tests/intro-video.test.js guardando dentro il file, e
 * quello che conta qui e' la regola, vera dovunque — il video si accende
 * SOLO con un fotogramma pronto, se no resta trasparente e sotto si vede lo
 * sfondo animato. Niente buchi neri.
 *
 * Il caso "video che non arriva" non si aspetta piu' che sia il browser a
 * non saperlo leggere: si stacca il file e si guarda cosa resta.
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
      // .on accende il video, e la mette solo chi ha visto un fotogramma
      opacita: v ? getComputedStyle(v).opacity : null,
      pronto: v ? v.readyState >= 2 : null,
      sfocato: v ? /blur/.test(getComputedStyle(v).filter) : null,
      testoSiVede: vis(body) && body.innerText.trim().length > 10,
      titolo: document.querySelector('.intro-body h1')?.innerText.trim() || '',
      // Il nome dell'app nella prima schermata e' il MARCHIO, non una scritta
      // che gli somiglia: stesso peso, stessa spaziatura, stesse lettere.
      marchio: (() => { const m = document.querySelector('.intro-marchio .marchio'); if (!m) return null;
        const b = m.getBoundingClientRect(); return { largo: Math.round(b.width), alto: Math.round(b.height) }; })(),
    };
  });

  et(r.presentazione, 'alla prima apertura si apre la presentazione');
  et(r.video, 'il video di sfondo c\'e\'');
  et(r.sorgente === 'media/intro.mp4', `e punta al suo file (${r.sorgente})`);
  et(r.attributi.length === 4, `con muted, autoplay, playsinline e loop — senza, su iPhone non parte da solo (${r.attributi.join(', ')})`);
  // 200 o 206: un video si chiede a pezzi, e un server che risponde alle
  // richieste Range (http-server, Vercel, qualunque CDN) manda 206 — e' la
  // risposta giusta, non un errore. Pretendere 200 faceva fallire la prova
  // in base a CHI stava servendo i file, che non e' quello che si sta
  // guardando: quello che conta e' che il file arrivi.
  et(risposte.length > 0 && [200, 206].includes(risposte[0].stato), `il file arriva dal server (${risposte.map((x) => x.stato).join(',') || 'nessuna richiesta'})`);
  et(risposte[0] && /video\/mp4/.test(risposte[0].tipo), `servito come video (${risposte[0]?.tipo})`);
  et(r.canvas && r.canvasSiVede, 'sotto c\'e\' lo sfondo animato di riserva');
  et(r.sfocato, 'il video e\' sfocato, cosi\' il testo sopra si legge');
  et(r.opacita === '0' || r.pronto, `si accende solo con un fotogramma pronto, se no resta trasparente (opacita' ${r.opacita}, fotogramma ${r.pronto ? 'si' : 'no'})`);
  et(r.testoSiVede, 'e il testo della presentazione si legge lo stesso');
  et(!!r.marchio && r.marchio.largo >= 200, `il nome e' il marchio vero, non una scritta rifatta (${r.marchio ? `${r.marchio.largo}x${r.marchio.alto}` : 'assente'})`);
  et(!r.titolo, `e non c'e' anche un titolo scritto a parte (${r.titolo || 'nessuno'})`);
  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);

  await ctx.close();

  // --- il video che non arriva ------------------------------------------
  // Un file mancante, o un formato che il browser non legge, finiscono nello
  // stesso posto: l'elemento va via e sotto resta lo sfondo animato. Qui si
  // stacca proprio il file, cosi' la prova non dipende piu' da quali codec
  // ha la macchina che la esegue.
  const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx2.addInitScript(() => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  const p2 = await ctx2.newPage();
  const errori2 = []; p2.on('pageerror', (e) => errori2.push(e.message));
  await p2.route('**/intro.mp4', (route) => route.abort());
  await p2.goto(`${BASE}/#/`, { waitUntil: 'load' });
  await p2.waitForSelector('.intro', { timeout: 10000 });
  await p2.waitForTimeout(2000);
  const senza = await p2.evaluate(() => {
    const v = document.querySelector('#intro-video'), cv = document.querySelector('#intro-fx');
    const body = document.querySelector('.intro-body');
    const vis = (e) => { if (!e) return false; const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
    return {
      video: !!v, opacita: v ? getComputedStyle(v).opacity : null,
      canvas: vis(cv), testo: vis(body) && body.innerText.trim().length > 10,
      marchio: !!document.querySelector('.intro-marchio .marchio'),
    };
  });
  et(!senza.video || senza.opacita === '0', `video staccato: niente buco nero (${senza.video ? `opacita' ${senza.opacita}` : 'elemento tolto'})`);
  et(senza.canvas, 'video staccato: sotto resta lo sfondo animato');
  et(senza.testo && senza.marchio, `video staccato: e la presentazione si legge lo stesso, marchio compreso (${senza.marchio ? 'marchio ok' : 'marchio assente'})`);
  et(errori2.length === 0, `video staccato: nessun errore JS${errori2.length ? ' — ' + errori2[0] : ''}`);
  await ctx2.close();

  await b.close();
  for (const t of ok) console.log('  ok  ' + t);
  for (const t of ko) console.log('  KO  ' + t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
