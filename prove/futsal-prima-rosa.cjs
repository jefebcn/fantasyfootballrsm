/**
 * La prima rosa si compra sempre (futsal-14, Alex 25/11/2026).
 *
 * Martedì 24/11 a mezzogiorno l'11ª si sta ancora giocando (l'ultima partita
 * è giovedì 26): il mercato della 12ª aspetta i referti. Chi si iscrive
 * adesso però non aspetta: fa la prima rosa subito, ai prezzi di oggi, e
 * l'app glielo dice.
 *
 *   BASE=http://app.local node -r ./prove/strumenti/servi-da-disco.cjs prove/futsal-prima-rosa.cjs
 */
const { chromium } = require('playwright');
const { fermaDatiFutsal } = require('./strumenti/futsal-dati-fino.cjs');
const BASE = process.env.BASE || 'http://localhost:4173';
const ORA = '2026-11-24T12:00:00+01:00';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, timezoneId: 'Europe/Rome', locale: 'it-IT', isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await fermaDatiFutsal(ctx, 11); // l'11ª senza referti, come quel martedì
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
  const vai = async (h, ms = 900) => { await p.evaluate((x) => { location.hash = x; }, h); await w(ms); };

  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await w(250);
  await p.fill('#email', 'nuovo@e.it'); await p.fill('#name', 'Nuovo'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1200);

  await vai('#/futsal');
  await p.fill('#fs-squadra', 'Nuovi Arrivati'); await p.selectOption('#fs-cuore', 'murata');
  await p.click('#fs-iscriviti'); await w(1200);
  et(/futsal\/squadra/.test(await p.evaluate(() => location.hash)), 'iscritto: si va al campo');

  const cr = await p.evaluate(() => document.querySelector('.fs-cruscotto')?.innerText.replace(/\s+/g, ' ') || '');
  et(/12ª/.test(cr) && /Aperto/i.test(cr), `prima rosa della 12ª col mercato aperto, anche senza i referti dell'11ª (${cr})`);
  const t = await p.evaluate(() => document.querySelector('main')?.innerText || '');
  et(/compri ai prezzi di oggi/i.test(t), 'la scheda dice che si compra ai prezzi di oggi');
  et(/prezzi provvisori fino ai referti della 11ª/i.test(t), 'la nota dice prezzi provvisori fino ai referti');

  await p.click('[data-slot="P:0"]'); await w(400);
  const compra = await p.$$('#sheet [data-compra]:not([disabled])');
  et(compra.length > 0, `le Porte si possono comprare (${compra.length})`);
  if (compra.length) { await compra[0].click(); await w(400); }
  et(!!(await p.$('[data-slot="P:0"] .fs-carta, [data-slot="P:0"].fs-carta, .fs-carta.arrivo')) || !(await p.$('#sheet')), 'la Porta comprata entra in campo');

  et(errori.length === 0, `nessun errore in pagina${errori.length ? ` (${errori.join(' | ')})` : ''}`);
  for (const x of ok) console.log(`  ok  ${x}`);
  for (const x of ko) console.log(`  KO  ${x}`);
  await b.close();
  process.exit(ko.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
