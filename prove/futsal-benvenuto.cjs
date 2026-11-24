/**
 * Il benvenuto del FantaFutsal (src/views/futsal-benvenuto.js): la prima
 * volta, a chi non ha ancora una squadra, sei schermate da scorrere sopra la
 * home; l'ultima porta all'iscrizione. Non torna più dopo; si rivede dal
 * Regolamento. Gli screenshot (uno per schermata) finiscono in $USCITA.
 */
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:4173';
const USCITA = process.env.USCITA || '/tmp';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, timezoneId: 'Europe/Rome', locale: 'it-IT', isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.clock.setFixedTime(new Date('2026-11-30T18:00:00+01:00'));
  await ctx.addInitScript(() => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js'; window.__PROVA_FUTSAL__ = true;
    localStorage.setItem('fcs:auth', 'supabase');
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'light' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  const p = await ctx.newPage();
  const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  const w = (ms = 500) => p.waitForTimeout(ms);
  const foto = (nome) => p.screenshot({ path: path.join(USCITA, `futsal-benvenuto-${nome}.png`) });

  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await w(250);
  await p.fill('#email', 'nuovo@e.it'); await p.fill('#name', 'Nuovo'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1200);
  await p.goto(`${BASE}/?futsal=1#/futsal`, { waitUntil: 'load' }); await w(1800);

  et(!!(await p.$('.fsb')), 'la prima volta, senza squadra, si apre il benvenuto');
  const pagine = await p.$$eval('.fsb-pag', (x) => x.length);
  et(pagine === 6, `sei schermate (${pagine})`);
  for (let i = 1; i <= pagine; i++) {
    await foto(i);
    if (i < pagine) { await p.click('[data-fsb-avanti]'); await w(700); }
  }
  et(await p.$eval('[data-fsb-fine]', (e) => !e.hidden && /Crea la tua squadra/.test(e.textContent)), "nell'ultima c'è «Crea la tua squadra»");
  et(await p.$eval('[data-fsb-avanti]', (e) => e.hidden), 'e «Avanti» sparisce');
  const testi = await p.$$eval('.fsb-pag p', (x) => x.map((e) => e.textContent).join(' '));
  et(/70 crediti/.test(testi) && /×1,5/.test(testi) && /parte da 6/.test(testi), 'i numeri vengono dal regolamento (70 crediti, capitano ×1,5, voto 6)');
  await p.click('[data-fsb-fine]'); await w(900);
  et(!(await p.$('.fsb')), 'si chiude');
  et(await p.evaluate(() => document.activeElement?.id === 'fs-squadra'), 'e porta al nome della squadra da creare');
  await foto('7-iscrizione');

  await p.reload({ waitUntil: 'load' }); await w(1800);
  et(!(await p.$('.fsb')), 'la seconda volta non torna');
  await p.evaluate(() => { location.hash = '#/futsal/regolamento'; }); await w(800);
  await p.click('a[href="#/futsal/benvenuto"]'); await w(800);
  et(!!(await p.$('.fsb')), 'dal Regolamento «Rivedi il benvenuto» lo riapre');
  await p.click('.fsb-salta'); await w(800);
  et(/#\/futsal$/.test(await p.evaluate(() => location.hash)), '«Salta» riporta alla home del futsal');

  et(!errori.length, `nessun errore in pagina${errori.length ? `: ${errori.join(' | ')}` : ''}`);
  await b.close();
  for (const x of ok) console.log(`  ok  ${x}`);
  for (const x of ko) console.log(`  NO  ${x}`);
  console.log(`\nbenvenuto futsal: ${ok.length} ok, ${ko.length} no — screenshot in ${USCITA}`);
  process.exit(ko.length ? 1 : 0);
})();
