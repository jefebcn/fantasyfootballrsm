/**
 * "Nuova versione pronta": quando il service worker nuovo prende il controllo,
 * l'app lo dice con un bottone. Non ricarica da sola.
 *
 * Nasce dall'app installata sull'iPhone di Alex, che e' rimasta quella del
 * giorno prima per un giorno intero: sulla schermata Home una PWA resta
 * sospesa e torna su com'era, e il codice nuovo — gia' scaricato — aspettava
 * una riapertura che non arrivava.
 *
 * Il service worker qui e' bloccato, ma l'evento che conta si puo' lanciare a
 * mano su navigator.serviceWorker. Il primo passaggio di controllo e' la
 * prima installazione e non deve dire niente; dal secondo in poi e' un
 * aggiornamento.
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
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, theme: 'system' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  const p = await ctx.newPage(); p.on('dialog', d => d.accept());
  const errori = []; p.on('pageerror', e => errori.push(e.message));
  const w = (ms = 450) => p.waitForTimeout(ms);
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1200);
  await p.click('[data-tab="up"]'); await w(250);
  await p.fill('#email', 'a@e.it'); await p.fill('#name', 'Alessandro'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1000);
  await p.click('[data-form="create"]'); await w(250);
  await p.fill('#lname', 'Prova'); await p.fill('#team', 'Prova FC'); await p.click('#go-create'); await w(1200);
  await p.evaluate(() => { location.hash = '#/'; }); await w(800);

  const barra = () => p.evaluate(() => document.getElementById('aggiorna')?.innerText || '');
  et((await barra()) === '', 'niente barra finche\' non cambia niente');

  await p.evaluate(() => navigator.serviceWorker.dispatchEvent(new Event('controllerchange'))); await w(200);
  et((await barra()) === '', 'il primo passaggio di controllo e\' la prima installazione: silenzio');

  await p.evaluate(() => navigator.serviceWorker.dispatchEvent(new Event('controllerchange'))); await w(200);
  const testo = await barra();
  et(/Nuova versione pronta/.test(testo), `il secondo e\' un aggiornamento: compare la barra ("${testo.split('\n')[0]}")`);
  et(/Aggiorna/.test(testo), 'con il bottone "Aggiorna"');

  await p.evaluate(() => navigator.serviceWorker.dispatchEvent(new Event('controllerchange'))); await w(200);
  et((await p.evaluate(() => document.querySelectorAll('#aggiorna').length)) === 1, 'un altro passaggio non ne aggiunge una seconda');

  // non copre la navigazione ne' esce dallo schermo
  const geo = await p.evaluate(() => {
    const r = (s) => document.querySelector(s)?.getBoundingClientRect();
    const a = r('#aggiorna'), nav = r('.a-nav') || r('nav');
    return { a: a && { top: a.top, bottom: a.bottom, left: a.left, right: a.right }, nav: nav && { top: nav.top }, h: innerHeight, w: innerWidth };
  });
  et(geo.a && geo.a.left >= 0 && geo.a.right <= geo.w && geo.a.bottom <= geo.h, `sta dentro lo schermo (${JSON.stringify(geo.a)})`);
  et(!geo.nav || geo.a.bottom <= geo.nav.top + 1, `non copre la navigazione (barra fino a ${geo.a?.bottom}, nav da ${geo.nav?.top})`);

  // il bottone ricarica davvero
  const prima = await p.evaluate(() => performance.timeOrigin);
  await Promise.all([p.waitForEvent('load'), p.click('#aggiorna button')]); await w(600);
  const dopo = await p.evaluate(() => performance.timeOrigin);
  et(dopo > prima, 'il bottone ricarica la pagina');
  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);

  await b.close();
  for (const t of ok) console.log('  ok  ' + t);
  for (const t of ko) console.log('  KO  ' + t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
