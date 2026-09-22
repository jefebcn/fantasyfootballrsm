/**
 * "Installa l'app": finche' non e' sullo Store, la strada e' la schermata
 * Home del telefono.
 *
 * LE DUE COSE CHE SI GUARDANO.
 *
 * 1. CHE SI POSSA PREMERE DAVVERO. La prima versione di questa prova
 *    chiedeva solo se [data-installa] stesse nel DOM, e passava: il pannello
 *    laterale viene scritto in pagina sempre, anche dove non c'e' nessun
 *    hamburger per aprirlo — senza una lega l'appbar e' 'none'. Una voce
 *    nel DOM e irraggiungibile col dito e' una voce che non c'e'. Quindi
 *    qui si clicca per davvero e si chiede al browser CHI c'e' in quel
 *    punto dello schermo (elementFromPoint).
 *
 * 2. CHE NON SIA LO STESSO BOTTONE SU TUTTI I TELEFONI, e non per
 *    capriccio: su Android esiste una richiesta di sistema e il tocco apre
 *    quella; su iPhone quella richiesta NON ESISTE — Apple non la fornisce —
 *    e l'unica strada e' Condividi → Aggiungi alla schermata Home. Un
 *    bottone che li' non fa niente sarebbe peggio di nessun bottone.
 *
 * E a app gia' installata sparisce da tutte e due i posti: e' il modo piu'
 * corto di dire che hai finito.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

const base = (ctx, extra) => ctx.addInitScript((extra) => {
  window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
  localStorage.setItem('fcs:auth', 'supabase');
  localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, theme: 'light' }));
  localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  if (extra === 'installata') Object.defineProperty(navigator, 'standalone', { get: () => true, configurable: true });
}, extra);

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

/** C'e' e si puo' premere: chi risponde al centro del suo riquadro e' lui. */
const premibile = (p, sel) => p.evaluate((sel) => {
  const el = document.querySelector(sel);
  if (!el) return { c: false, perche: 'non c\'è in pagina' };
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return { c: false, perche: 'riquadro di 0 pixel' };
  if (r.bottom < 0 || r.top > innerHeight) return { c: false, perche: 'fuori dallo schermo' };
  const sopra = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return { c: !!sopra && (el === sopra || el.contains(sopra) || sopra.contains(el)),
    perche: sopra ? `in quel punto c'è ${sopra.tagName.toLowerCase()}.${sopra.className}` : 'in quel punto non c\'è niente' };
}, sel);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const errori = [];

  const entra = async (ctx, conLega) => {
    const p = await ctx.newPage(); p.on('dialog', (d) => d.accept());
    p.on('pageerror', (e) => errori.push(e.message));
    const w = (ms = 700) => p.waitForTimeout(ms);
    await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1400);
    await p.click('[data-tab="up"]'); await w(300);
    await p.fill('#email', `u${Math.random().toString(36).slice(2, 7)}@e.it`); await p.fill('#name', 'Marco');
    await p.fill('#password', 'password123'); await p.click('#primary'); await w(1300);
    await p.evaluate(() => { location.hash = '#/'; }); await w(900);
    if (conLega) {
      await p.click('[data-form="create"]'); await w(400);
      await p.fill('#lname', 'Torneo Titano'); await p.fill('#team', 'Hasta El Roxy');
      await p.click('#go-create'); await w(1600);
      await p.evaluate(() => { location.hash = '#/'; }); await w(900);
    }
    return [p, w];
  };

  // --- iPhone, dentro una lega: il menu si apre col dito e la voce si preme
  let ctx = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true,
    serviceWorkers: 'block', userAgent: IPHONE });
  await base(ctx, null);
  let [p, w] = await entra(ctx, true);
  et(await p.evaluate(() => !!document.querySelector('[data-open-drawer]')), 'dentro una lega il menu ha il suo tasto in barra');
  await p.click('[data-open-drawer]'); await w(800);
  await p.evaluate(() => document.querySelector('[data-installa]')?.scrollIntoView({ block: 'center' })); await w(300);
  const voce = await p.evaluate(() => {
    const b2 = document.querySelector('[data-installa]');
    return b2 ? b2.innerText.replace(/\n/g, ' · ') : null;
  });
  et(!!voce, `nel menu c'è la voce per installare (${voce || 'assente'})`);
  let dito = await premibile(p, '[data-installa]');
  et(dito.c, `e col menu aperto si preme davvero (${dito.perche})`);
  et(voce && /Home/.test(voce), 'su iPhone dice già dove va a finire, senza doverla aprire');
  // L'etichetta intera, non "Installa l'a...". Le altre voci del menu hanno
  // la nota corta ("1", "tutte le sezioni") e ci stanno in una riga sola;
  // qui la nota e' lunga, si prendeva la sua colonna e tagliava il nome.
  const tagliata = await p.evaluate(() => {
    const e = document.querySelector('[data-installa] .et');
    return e ? { troppo: e.scrollWidth - e.clientWidth, testo: e.innerText } : null;
  });
  et(tagliata && tagliata.troppo <= 1, `e il nome ci sta tutto, non "Installa l'a…" (${tagliata ? `${tagliata.troppo}px di troppo` : 'non misurabile'})`);
  if (dito.c) await p.click('[data-installa]'); await w(900);
  const foglio = await p.evaluate(() => (document.getElementById('sheet')?.innerText || '').replace(/\n+/g, ' / '));
  et(/Aggiungi alla schermata Home/i.test(foglio), `il foglio dà i passi di Safari ("${foglio.slice(0, 80)}…")`);
  et(/Safari/.test(foglio), 'e avverte che da Chrome su iPhone quella voce non c\'è');
  et(!/tre puntini/.test(foglio), 'senza dare istruzioni da Android a chi ha un iPhone');
  et(await p.evaluate(() => !document.querySelector('.a-drawer.on')), 'e il menu si chiude, se no il foglio resta sotto');
  await ctx.close();

  // --- iPhone, senza lega: li' il menu NON si apre, e la voce deve stare in pagina
  ctx = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true,
    serviceWorkers: 'block', userAgent: IPHONE });
  await base(ctx, null);
  [p, w] = await entra(ctx, false);
  et(await p.evaluate(() => !document.querySelector('[data-open-drawer]')),
    'sulla schermata d\'ingresso il menu non ha nessun tasto: se la voce stesse solo lì, non si aprirebbe mai');
  await p.evaluate(() => document.querySelector('.rigainstalla')?.scrollIntoView({ block: 'center' })); await w(300);
  dito = await premibile(p, '.rigainstalla');
  et(dito.c, `quindi la riga sta in pagina e si preme (${dito.perche})`);
  // se la riga non c'e' il clic andrebbe in timeout dopo 30 secondi e la
  // prova morirebbe con uno stack invece di dire cosa manca
  if (dito.c) {
    await p.click('.rigainstalla'); await w(900);
    et(await p.evaluate(() => /Aggiungi alla schermata Home/i.test(document.getElementById('sheet')?.innerText || '')),
      'e apre gli stessi passi del menu');
  } else et(false, 'e apre gli stessi passi del menu (non c\'è niente da premere)');
  await ctx.close();

  // --- Android: c'è la richiesta di sistema, e il tocco la apre
  ctx = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await base(ctx, null);
  await ctx.addInitScript(() => {
    // il browser di prova non la lancia: si mette quella vera in mano all'app
    window.__chiamate = 0;
    window.__installPrompt = { prompt() { window.__chiamate++; }, userChoice: Promise.resolve({ outcome: 'accepted' }) };
  });
  [p, w] = await entra(ctx, true);
  await p.click('[data-open-drawer]'); await w(800);
  await p.evaluate(() => document.querySelector('[data-installa]')?.scrollIntoView({ block: 'center' })); await w(300);
  const vocea = await p.evaluate(() => document.querySelector('[data-installa]')?.innerText.replace(/\n/g, ' · ') || null);
  et(!!vocea && !/Home|Condividi/.test(vocea), `su Android la voce non manda alla schermata Home di Apple (${vocea})`);
  await p.click('[data-installa]'); await w(900);
  const esito = await p.evaluate(() => ({ chiamate: window.__chiamate, foglio: (document.getElementById('sheet')?.innerText || '').trim() }));
  et(esito.chiamate === 1, `il tocco apre la richiesta di sistema (chiamate: ${esito.chiamate})`);
  et(!esito.foglio, 'e non apre anche le istruzioni a mano, che li\' sarebbero di troppo');
  await ctx.close();

  // --- app già installata: sparisce da tutti e due i posti
  ctx = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true,
    serviceWorkers: 'block', userAgent: IPHONE });
  await base(ctx, 'installata');
  [p, w] = await entra(ctx, false);
  et(await p.evaluate(() => !document.querySelector('.rigainstalla')), 'ad app già installata la riga d\'ingresso non compare più');
  await p.evaluate(() => { location.hash = '#/'; }); await w(600);
  et(await p.evaluate(() => !document.querySelector('[data-installa]')), 'e nemmeno la voce nel menu');
  await ctx.close();

  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
  await b.close();
  for (const t of ok) console.log('  ok  ' + t);
  for (const t of ko) console.log('  KO  ' + t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
