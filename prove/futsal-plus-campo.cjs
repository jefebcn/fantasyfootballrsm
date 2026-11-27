/**
 * La plusvalenza sul campo (Alex, 27/11/2026): sotto il nome, in piccolo, di
 * quanto si e' mosso il valore del giocatore — verde se sale, rosso se
 * scende, grigio se resta. A giornata chiusa (11ª) quella della giornata;
 * nella formazione da preparare (12ª) quella dell'ultima giornata conclusa.
 *
 *   BASE=http://app.local node -r ./prove/strumenti/servi-da-disco.cjs prove/futsal-plus-campo.cjs
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const ORA = '2026-11-27T18:00:00+01:00';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);
const SQUADRA = { A: ['f220', 'f83', 'f1234', 'f44'], D: ['f546', 'f139', 'f149', 'f145'], vice: 'f546', porta: 'murata', sesto: 'f149', schema: '2-2', capitano: 'f83', titolari: ['f546', 'f139', 'f220', 'f83'] };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, timezoneId: 'Europe/Rome', locale: 'it-IT', isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.clock.setFixedTime(new Date(ORA));
  await ctx.addInitScript(() => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    localStorage.setItem('fcs:auth', 'supabase');
    localStorage.setItem('fcs:fs-benvenuto', '1');
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'light' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
    localStorage.setItem('fcs:futsal', '1'); window.__PROVA_FUTSAL__ = true;
  });
  const p = await ctx.newPage();
  const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  const w = (ms = 500) => p.waitForTimeout(ms);
  const vai = async (h, ms = 1200) => { await p.evaluate((x) => { location.hash = x; }, h); await w(ms); };

  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await w(250);
  await p.fill('#email', 'alex@e.it'); await p.fill('#name', 'Alex'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1200);
  await vai('#/futsal');
  await p.fill('#fs-squadra', 'MagicTrip'); await p.selectOption('#fs-cuore', 'pennarossa'); await p.click('#fs-iscriviti'); await w(1200);
  await p.evaluate((f) => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    s.tables.futsal_formazioni = [{ user_id: s.userId, giornata: 11, formazione: f, consegnata_at: '2026-11-21T13:57:24Z' }];
    localStorage.setItem('fcs:mock', JSON.stringify(s));
  }, SQUADRA);
  await p.reload({ waitUntil: 'load' }); await w(1500);

  const chip = () => p.evaluate(() => [...document.querySelectorAll('.fs-campo .fs-plus, .fs-panca .fs-plus')].map((x) => `${x.className.split(' ').pop()}:${x.innerText.trim()}`));
  const coerente = (c) => c.every((x) => { const [k, v] = x.split(':'); return k === 'su' ? v.startsWith('+') : k === 'giu' ? v.startsWith('−') : v === '0'; });

  await vai('#/futsal/squadra/11', 1500);
  if (process.env.FOTO) await p.screenshot({ path: `${process.env.FOTO}-11.png` });
  const c11 = await chip();
  et(c11.length === 9, `11ª chiusa: un chip per la Porta e gli otto (${c11.length})`);
  et(coerente(c11), `verde col +, rosso col −, grigio con lo 0 (${c11.join(' ')})`);
  et(c11.some((x) => x.startsWith('zero:')), 'la Porta del Murata riposa: grigio 0');

  await vai('#/futsal/squadra/12', 1500);
  if (process.env.FOTO) { await p.screenshot({ path: `${process.env.FOTO}-12.png` }); await p.evaluate(() => document.querySelector('.fs-panca')?.scrollIntoView({ block: 'center' })); await w(300); await p.screenshot({ path: `${process.env.FOTO}-panca.png` }); await p.evaluate(() => window.scrollTo(0, 0)); }
  const c12 = await chip();
  et(c12.length === 9 && coerente(c12), `12ª da preparare: chip dell'11ª accanto ai crediti (${c12.join(' ')})`);
  const larghe = await p.evaluate(() => [...document.querySelectorAll('.fs-carta')].filter((c) => c.scrollWidth > c.clientWidth + 1).length);
  et(larghe === 0, `nessun cartellino deborda (${larghe})`);
  // con tre attaccanti sulla stessa linea i cartellini ci stanno ancora
  await p.evaluate(() => [...document.querySelectorAll('.fs-schemi button, button')].find((x) => x.innerText.trim() === '1-3')?.click()); await w(800);
  if (process.env.FOTO) await p.screenshot({ path: `${process.env.FOTO}-13.png` });
  const fuori = await p.evaluate(() => { const c = document.querySelector('.fs-campo').getBoundingClientRect(); return [...document.querySelectorAll('.fs-campo .fs-carta')].filter((x) => { const r = x.getBoundingClientRect(); return r.left < c.left || r.right > c.right; }).length; });
  et(fuori === 0, `1-3: tutti i cartellini dentro il campo (${fuori})`);
  et(!errori.length, `nessun errore (${errori.join(' | ')})`);

  await b.close();
  for (const x of ok) console.log(`ok  ${x}`);
  for (const x of ko) console.log(`KO  ${x}`);
  process.exit(ko.length ? 1 : 0);
})();
