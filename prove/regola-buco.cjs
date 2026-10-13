/**
 * ART. 8.6: SENZA SOSTITUTO, IL BUCO.
 *
 * Alex, 13/10: «se non c'e' il sostituto devi avere il buco: un giocatore
 * che non ha giocato non avra' il voto». Dalla 6ª giornata un titolare senza
 * voto e senza sostituto conta 0; fino alla 5ª (schierate e congelate con la
 * regola di prima) resta il 5,5 d'ufficio. Il motore lo prova
 * tests/engine.test.js; qui si guarda che il regolamento lo dica cosi'.
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
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'light' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  const p = await ctx.newPage(); const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  const w = (ms = 700) => p.waitForTimeout(ms);
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await p.fill('#email', 'buco@e.it'); await p.fill('#name', 'Alex');
  await p.fill('#password', 'password123'); await p.click('#primary'); await w(1200);
  await p.click('[data-form="create"]'); await p.fill('#lname', 'Torneo'); await p.fill('#team', 'Prova FC');
  await p.click('#go-create'); await w(1300);
  await p.evaluate(() => { location.hash = '#/regolamento'; }); await w(900);
  const t = await p.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
  et(/senza sostituto il titolare non ha voto e conta 0\b/i.test(t), 'il regolamento dice che senza sostituto si conta 0');
  et(/dalla 6ª giornata; fino alla 5ª valeva 5,5 d'ufficio/.test(t), 'e da quando: dalla 6ª, prima valeva 5,5');
  et(!/il titolare vale 5,5/.test(t), 'la frase di prima non c\'e\' piu\'');
  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
  await b.close();
  for (const x of ok) console.log('  ok  ' + x);
  for (const x of ko) console.log('  KO  ' + x);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
