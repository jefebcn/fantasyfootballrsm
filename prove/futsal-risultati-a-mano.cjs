/**
 * Il risultato provvisorio scritto a mano (futsal-12): la sera della partita
 * un amministratore scrive il finale pubblicato dalle società, e il
 * calendario lo mostra con «voti in arrivo» finché non c'è il referto FSGC.
 * Chi non è amministratore non vede il pulsante.
 */
const { chromium } = require('playwright');
const path = require('path');
const { fermaDatiFutsal } = require('./strumenti/futsal-dati-fino.cjs');
const BASE = process.env.BASE || 'http://localhost:4173';
const USCITA = process.env.USCITA || '/tmp';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, timezoneId: 'Europe/Rome', locale: 'it-IT', isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  // lunedì sera dell'11ª: cinque partite cominciate, due ancora da giocare,
  // nessun referto ancora (vedi strumenti/futsal-dati-fino.cjs)
  await fermaDatiFutsal(ctx, 11);
  await ctx.clock.setFixedTime(new Date('2026-11-23T22:40:00+01:00'));
  await ctx.addInitScript(() => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js'; window.__PROVA_FUTSAL__ = true;
    localStorage.setItem('fcs:auth', 'supabase');
    localStorage.setItem('fcs:fs-benvenuto', '1'); // il benvenuto ha la sua prova (futsal-benvenuto.cjs)
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'light' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  const p = await ctx.newPage();
  const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  const w = (ms = 500) => p.waitForTimeout(ms);
  const foto = (nome) => p.screenshot({ path: path.join(USCITA, `futsal-a-mano-${nome}.png`) });
  const provv = () => p.$$eval('.fs-provv', (x) => x.map((e) => e.textContent));

  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await w(250);
  await p.fill('#email', 'alex@e.it'); await p.fill('#name', 'Alex'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1200);
  await p.goto(`${BASE}/?futsal=1#/futsal/giornata/11`, { waitUntil: 'load' }); await w(1500);
  et((await p.$$('[data-a-mano]')).length === 0, 'chi non è amministratore non vede «Scrivi il risultato a mano»');

  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('fcs:mock')); Object.assign(s.tables.profiles.find((x) => x.id === s.userId), { is_admin: true, is_owner: true }); localStorage.setItem('fcs:mock', JSON.stringify(s)); });
  await p.reload({ waitUntil: 'load' }); await w(1800);
  const n = (await p.$$('[data-a-mano]')).length;
  et(n === 5, `l'amministratore lo vede sotto le 5 partite già cominciate (${n})`);
  await foto('1-calendario');
  await p.click('[data-a-mano]'); await w(500);
  await foto('2-foglio');
  await p.fill('#fs-am-gc', '2'); await p.click('#fs-am-salva'); await w(500);
  et(!!(await p.$('#fs-am-salva')), 'senza i gol di tutte e due le squadre non salva');
  await p.fill('#fs-am-go', '1'); await p.click('#fs-am-salva'); await w(1200);
  let t = await provv();
  et(t[0] === '2 – 1voti in arrivo', `salvato: «${t[0]}»`);
  await foto('3-salvato');
  await p.reload({ waitUntil: 'load' }); await w(1800);
  t = await provv();
  et(t.length === 1, 'resta dopo aver riaperto l\'app');
  et(/Correggi/.test(await p.$eval('[data-a-mano]', (e) => e.textContent)), 'il pulsante diventa «Correggi»');
  await p.click('[data-a-mano]'); await w(500); await p.click('#fs-am-togli'); await w(1200);
  et((await provv()).length === 0, 'si toglie');

  et(!errori.length, `nessun errore in pagina${errori.length ? `: ${errori.join(' | ')}` : ''}`);
  await b.close();
  for (const x of ok) console.log(`  ok  ${x}`);
  for (const x of ko) console.log(`  NO  ${x}`);
  console.log(`\nrisultati a mano: ${ok.length} ok, ${ko.length} no — screenshot in ${USCITA}`);
  process.exit(ko.length ? 1 : 0);
})();
