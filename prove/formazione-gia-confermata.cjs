/**
 * FORMAZIONE GIA' CONFERMATA.
 *
 * Chi ha gia' consegnato e riapre la formazione vedeva ancora «Conferma
 * formazione · 11/11», come se non l'avesse fatto (Alex 29/10). Ora il tasto
 * dice «Formazione già confermata»; se si cambia qualcosa torna a chiedere
 * la conferma, come «Conferma modifiche».
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    localStorage.setItem('fcs:auth', 'supabase');
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'dark' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  const p = await ctx.newPage(); p.on('dialog', (d) => d.accept()); const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  const w = (ms = 700) => p.waitForTimeout(ms);
  const tasto = () => p.evaluate(() => { const t = document.querySelector('#confirm'); return { testo: t?.innerText.trim() || '', gia: !!t?.classList.contains('gia-confermata') }; });
  const consegnate = () => p.evaluate(() => JSON.parse(localStorage.getItem('fcs:mock')).tables.lineups.length);
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await p.fill('#email', 'gia@e.it'); await p.fill('#name', 'Alex');
  await p.fill('#password', 'password123'); await p.click('#primary'); await w(1200);
  await p.click('[data-form="create"]'); await p.fill('#lname', 'Torneo'); await p.fill('#team', 'Prova FC');
  await p.click('#go-create'); await w(1400);
  await p.evaluate(() => { location.hash = '#/lega'; }); await w(700); await p.click('#draft'); await w(2200);
  await p.evaluate(() => { location.hash = '#/rosa/formazione'; }); await w(1200);

  const prima = await tasto();
  et(/conferma formazione/i.test(prima.testo) && !prima.gia, `prima della consegna chiede la conferma («${prima.testo}»)`);
  await p.click('#confirm'); await w(1200);
  const dopo = await tasto();
  et(/già confermata/i.test(dopo.testo) && dopo.gia, `consegnata: «${dopo.testo}»`);
  const n = await consegnate();

  await p.reload({ waitUntil: 'load' }); await w(1500);
  await p.evaluate(() => { location.hash = '#/rosa/formazione'; }); await w(1200);
  const riaperta = await tasto();
  et(riaperta.gia, `riaprendo l'app resta «già confermata» («${riaperta.testo}»)`);
  await p.locator('#confirm').scrollIntoViewIfNeeded(); await w(300);
  await p.screenshot({ path: process.env.SCATTO || '/tmp/formazione-gia-confermata.png' });
  await p.click('#confirm'); await w(900);
  et(await consegnate() === n, 'toccarlo non consegna un\'altra volta');

  await p.click('[data-down="0"]'); await w(900);
  const cambiata = await tasto();
  et(/conferma modifiche/i.test(cambiata.testo) && !cambiata.gia, `cambiata la panchina chiede di confermare le modifiche («${cambiata.testo}»)`);
  await p.click('#confirm'); await w(1200);
  et((await tasto()).gia, 'e confermate torna «già confermata»');
  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
  await b.close();
  for (const t of ok) console.log('  ok ', t);
  for (const t of ko) console.log('  KO ', t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
