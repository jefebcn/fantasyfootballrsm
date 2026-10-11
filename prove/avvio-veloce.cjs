/**
 * L'app si apre senza fare la fila.
 *
 * All'avvio l'app chiedeva al database una quindicina di cose UNA DOPO
 * L'ALTRA, anche quelle che non dipendono fra loro: profilo, leghe, voti,
 * lega, rose, formazioni, scambi, offerte, sponsor... Su un telefono in 4G
 * ogni richiesta costa 100-200 ms, quindi la sola fila valeva 2-3 secondi di
 * schermata di caricamento. Qui il finto server risponde dopo 150 ms a ogni
 * richiesta, e si misura quanto ci mette la dashboard a comparire.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const RITARDO = 150;
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript((r) => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    localStorage.setItem('fcs:auth', 'supabase');
    if (!localStorage.getItem('fcs:prefs')) localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'system' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
    if (sessionStorage.getItem('lento')) window.__RITARDO_QUERY__ = r;
  }, RITARDO);
  const p = await ctx.newPage(); p.on('dialog', (d) => d.accept());
  const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  const w = (ms = 450) => p.waitForTimeout(ms);
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1200);
  await p.click('[data-tab="up"]'); await p.fill('#email', 'a@e.it'); await p.fill('#name', 'Alex'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1000);
  await p.click('[data-form="create"]'); await p.fill('#lname', 'Prova'); await p.fill('#team', 'Prova FC'); await p.click('#go-create'); await w(1500);
  await p.evaluate(() => { location.hash = '#/'; }); await p.waitForSelector('.a-hero');

  // da qui ogni richiesta al database costa RITARDO ms
  await p.evaluate(() => sessionStorage.setItem('lento', '1'));
  const tempi = [];
  for (let i = 0; i < 3; i++) {
    const t0 = Date.now();
    await p.reload({ waitUntil: 'load' });
    await p.waitForSelector('.a-hero', { timeout: 20000 });
    tempi.push(Date.now() - t0);
  }
  tempi.sort((x, y) => x - y);
  const mediano = tempi[1];
  console.log(`  dashboard in ${tempi.join(' / ')} ms con ${RITARDO} ms per richiesta (circa ${Math.round(mediano / RITARDO)} richieste in fila)`);
  et(mediano < 12 * RITARDO, `la dashboard compare in meno di ${12 * RITARDO} ms con ${RITARDO} ms per richiesta (${mediano} ms)`);
  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
  await b.close();
  ok.forEach((t) => console.log('  ok  ' + t)); ko.forEach((t) => console.log('  KO  ' + t));
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
