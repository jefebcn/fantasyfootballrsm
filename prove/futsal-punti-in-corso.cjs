/**
 * I punti a giornata in corso (Alex, 26/11/2026). Giovedì 26/11 alle 18 l'11ª
 * ha sei referti su sette: manca Virtus–Tre Penne (alle 22:00) e il Murata
 * riposa. Prima chi giocava la sera e chi riposava comparivano tutti e due
 * con «la squadra non gioca» e 0, come dei senza voto veri.
 *
 * La squadra è quella vera di Alex dell'11ª: Porta e vice del Murata, sesto
 * uomo del Tre Penne, due panchinari della Virtus.
 *
 *   BASE=http://app.local node -r ./prove/strumenti/servi-da-disco.cjs prove/futsal-punti-in-corso.cjs
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { datiFino } = require('./strumenti/futsal-dati-fino.cjs');
const BASE = process.env.BASE || 'http://localhost:4173';
const ORA = '2026-11-26T18:00:00+01:00';
const FILE = path.join(__dirname, '..', 'src', 'futsal-dati.js');
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

// i dati fino all'11ª, senza il referto (e il risultato) di Virtus–Tre Penne
const dati = datiFino(fs.readFileSync(FILE, 'utf8'), 12)
  .replace(/^ {2}\{g:11,casa:"virtus",.*$\n/m, '')
  .replace(/^( {2}\[11,"virtus","trepenne","[^"]+","[^"]*"),-?\d+,-?\d+\]/m, '$1,null,null]');

const SQUADRA = { A: ['f220', 'f83', 'f1234', 'f44'], D: ['f546', 'f139', 'f149', 'f145'], vice: 'f546', porta: 'murata', sesto: 'f149', schema: '2-2', capitano: 'f83', titolari: ['f546', 'f139', 'f220', 'f83'] };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, timezoneId: 'Europe/Rome', locale: 'it-IT', isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.route('**/src/futsal-dati.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: dati }));
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

  await vai('#/futsal/squadra/11', 1500);
  if (process.env.FOTO) { await p.evaluate(() => document.querySelector('.fs-list')?.scrollIntoView()); await w(300); await p.screenshot({ path: process.env.FOTO }); }
  const testo = await p.evaluate(() => document.querySelector('main')?.innerText.replace(/\s+/g, ' ') || '');
  const righe = await p.evaluate(() => [...document.querySelectorAll('.fs-list .vr')].map((r) => r.innerText.replace(/\s+/g, ' ')));
  const di = (re) => righe.find((r) => re.test(r)) || '';
  et(/parziali/i.test(testo) && /manca 1 partita/i.test(testo), 'in alto: punti parziali, manca 1 partita');
  et(/riposa · a fine giornata prende la media/.test(di(/Porta Murata/)), `la Porta del Murata riposa e prende la media a fine giornata (${di(/Porta Murata/)})`);
  const virtus = righe.filter((r) => /gioca gio 26\/11 alle 22:00/.test(r));
  et(virtus.length === 3, `sesto uomo e due panchinari giocano stasera alle 22 (${virtus.length})`);
  et(!righe.some((r) => /la squadra non gioca/.test(r)), 'nessuno è più «la squadra non gioca»');
  et([...virtus, di(/Porta Murata/)].every((r) => /–$/.test(r.trim())), 'chi aspetta ha un trattino, non uno 0');
  et(/^.*Parziale manca 1 partita 19,5$/.test(di(/Parziale/)), `la riga del totale dice «Parziale» (${di(/Parziale|Totale/)})`);
  const campo = await p.evaluate(() => [...document.querySelectorAll('.fs-pti')].map((x) => x.innerText.trim()));
  et(campo.includes('R') && campo.includes('22:00') && !campo.includes('S.V.'), `sul campo R e 22:00 al posto di S.V. (${campo.join(' ')})`);

  // la scheda di un giocatore della Virtus: l'11ª non è un S.V.
  await vai('#/futsal/giocatore/f145', 1200);
  await p.click('[data-tab="partite"]'); await w(600);
  const sch = await p.evaluate(() => [...document.querySelectorAll('main .vr')].map((r) => r.innerText.replace(/\s+/g, ' ')).find((r) => /^11ª/.test(r)) || '');
  et(/gioca gio 26\/11 alle 22:00/.test(sch) && !/S\.V\./.test(sch), `scheda del giocatore: l'11ª gioca stasera (${sch})`);

  et(errori.length === 0, `nessun errore in pagina${errori.length ? ` (${errori.join(' | ')})` : ''}`);
  for (const x of ok) console.log(`  ok  ${x}`);
  for (const x of ko) console.log(`  KO  ${x}`);
  await b.close();
  process.exit(ko.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
