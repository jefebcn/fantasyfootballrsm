/**
 * "Installa l'app" nel menu: finche' non e' sullo Store, la strada e' la
 * schermata Home del telefono.
 *
 * LA COSA CHE SI GUARDA. Non e' lo stesso bottone su tutti i telefoni, e non
 * per capriccio: su Android esiste una richiesta di sistema e il tocco la
 * apre; su iPhone quella richiesta NON ESISTE — Apple non la fornisce — e
 * l'unica strada e' Condividi → Aggiungi alla schermata Home. Un bottone che
 * li' non fa niente sarebbe peggio di nessun bottone.
 *
 * E a app gia' installata la voce deve sparire: e' il modo piu' corto di
 * dire che hai finito.
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

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const errori = [];

  const entra = async (ctx) => {
    const p = await ctx.newPage(); p.on('dialog', (d) => d.accept());
    p.on('pageerror', (e) => errori.push(e.message));
    const w = (ms = 700) => p.waitForTimeout(ms);
    await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1400);
    await p.click('[data-tab="up"]'); await w(300);
    await p.fill('#email', `u${Math.random().toString(36).slice(2, 7)}@e.it`); await p.fill('#name', 'Marco');
    await p.fill('#password', 'password123'); await p.click('#primary'); await w(1300);
    await p.evaluate(() => { location.hash = '#/'; }); await w(900);
    return [p, w];
  };

  // --- iPhone nel browser: la voce c'e' e spiega la strada di Apple
  let ctx = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true,
    serviceWorkers: 'block', userAgent: IPHONE });
  await base(ctx, null);
  let [p, w] = await entra(ctx);
  await p.evaluate(() => document.querySelector('[data-open-drawer]')?.click()); await w(800);
  const voce = await p.evaluate(() => {
    const b2 = document.querySelector('[data-installa]');
    return b2 ? { testo: b2.innerText.replace(/\n/g, ' · '), alto: Math.round(b2.getBoundingClientRect().height) } : null;
  });
  et(!!voce, `nel menu c'è la voce per installare (${voce ? voce.testo : 'assente'})`);
  et(voce && /Condividi/.test(voce.testo), 'e su iPhone dice già dov\'è il comando, senza doverla aprire');
  await p.evaluate(() => document.querySelector('[data-installa]')?.click()); await w(900);
  const foglio = await p.evaluate(() => (document.getElementById('sheet')?.innerText || '').replace(/\n+/g, ' / '));
  et(/Aggiungi alla schermata Home/i.test(foglio), `il foglio dà i passi di Safari ("${foglio.slice(0, 90)}…")`);
  et(/Safari/.test(foglio), 'e avverte che da Chrome su iPhone quella voce non c\'è');
  et(!/tre puntini/.test(foglio), 'senza dare istruzioni da Android a chi ha un iPhone');
  // il menu si chiude, se no il foglio esce da sotto il pannello
  et(await p.evaluate(() => !document.querySelector('.a-drawer.on')), 'e il menu si chiude, se no il foglio resta sotto');
  await ctx.close();

  // --- Android: c'è la richiesta di sistema, e il tocco la apre
  ctx = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await base(ctx, null);
  await ctx.addInitScript(() => {
    // il browser di prova non la lancia: si mette quella vera in mano all'app
    window.__chiamate = 0;
    window.__installPrompt = { prompt() { window.__chiamate++; }, userChoice: Promise.resolve({ outcome: 'accepted' }) };
  });
  [p, w] = await entra(ctx);
  await p.evaluate(() => document.querySelector('[data-open-drawer]')?.click()); await w(800);
  const vocea = await p.evaluate(() => document.querySelector('[data-installa]')?.innerText.replace(/\n/g, ' · ') || null);
  et(!!vocea && !/Condividi/.test(vocea), `su Android la voce non manda a Condividi (${vocea})`);
  await p.evaluate(() => document.querySelector('[data-installa]')?.click()); await w(900);
  const esito = await p.evaluate(() => ({ chiamate: window.__chiamate, foglio: (document.getElementById('sheet')?.innerText || '').trim() }));
  et(esito.chiamate === 1, `il tocco apre la richiesta di sistema (chiamate: ${esito.chiamate})`);
  et(!esito.foglio, 'e non apre anche le istruzioni a mano, che li\' sarebbero di troppo');
  await ctx.close();

  // --- app già installata: la voce sparisce
  ctx = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true,
    serviceWorkers: 'block', userAgent: IPHONE });
  await base(ctx, 'installata');
  [p, w] = await entra(ctx);
  await p.evaluate(() => document.querySelector('[data-open-drawer]')?.click()); await w(800);
  et(await p.evaluate(() => !document.querySelector('[data-installa]')), 'ad app già installata la voce non compare più');
  await ctx.close();

  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
  await b.close();
  for (const t of ok) console.log('  ok  ' + t);
  for (const t of ko) console.log('  KO  ' + t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
