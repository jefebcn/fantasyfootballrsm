/**
 * La home del futsal per chi ha già la squadra (Alex, 25/11/2026): in cima la
 * squadra, poi i punti dell'ultima giornata (migliore, capitano), poi la
 * prossima giornata con mercato, crediti e dove giocano i tuoi, e il tasto
 * per la formazione. «Nome e colore della squadra» scende in fondo.
 *
 *   BASE=http://app.local node -r ./prove/strumenti/servi-da-disco.cjs prove/futsal-home.cjs
 */
const { chromium } = require('playwright');
const path = require('path');
const { fermaDatiFutsal } = require('./strumenti/futsal-dati-fino.cjs');
const BASE = process.env.BASE || 'http://localhost:4173';
const USCITA = process.env.USCITA || '/tmp';
const ORA = '2026-11-25T12:50:00+01:00';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, timezoneId: 'Europe/Rome', locale: 'it-IT', isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await fermaDatiFutsal(ctx, 12); // la 12ª non ancora giocata
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
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await w(250);
  await p.fill('#email', 'casa@e.it'); await p.fill('#name', 'Casa'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1200);
  await p.evaluate(() => { location.hash = '#/futsal'; }); await w(900);
  await p.fill('#fs-squadra', 'MagicTrip'); await p.selectOption('#fs-cuore', 'pennarossa'); await p.click('#fs-iscriviti'); await w(1200);

  // una squadra valida dalla 10ª: Porta del Cailungo e otto che hanno giocato l'11ª, uno per squadra
  await p.evaluate(async () => {
    const F = await import('/src/futsal-dati.js');
    const giocano = new Set(F.CALENDARIO.filter((c) => c[0] === 11 || c[0] === 12).flatMap((c) => [c[1], c[2]]));
    const presenti = new Set(F.REFERTI.filter((r) => r.g === 11).flatMap((r) => r.distinte.flat()));
    const usati = new Set(['cailungo']); const D = [], A = [];
    for (const [id, club, , , ruolo] of F.GIOCATORI) {
      const r = /port/i.test(ruolo) ? 'P' : /difens|centrale|laterale|univers/i.test(ruolo) ? 'D' : 'A';
      if (r === 'P' || !giocano.has(club) || usati.has(club) || !presenti.has(id)) continue;
      if (r === 'D' && D.length < 4) { D.push(id); usati.add(club); } else if (r === 'A' && A.length < 4) { A.push(id); usati.add(club); }
    }
    const f = { schema: '2-2', porta: 'cailungo', D, A, titolari: [D[0], D[1], A[0], A[1]], sesto: D[2], capitano: A[0], vice: D[0] };
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    s.tables.futsal_formazioni = [10, 11, 12].map((g) => ({ user_id: s.userId, giornata: g, formazione: f, consegnata_at: new Date().toISOString() }));
    localStorage.setItem('fcs:mock', JSON.stringify(s));
  });
  await p.reload({ waitUntil: 'load' }); await w(1500);
  await p.evaluate(() => { location.hash = '#/futsal'; }); await w(1500);

  const ordine = await p.evaluate(() => ['.fs-banda', '.fs-ultima', '.fs-prossima', '.fs-camp', '#fs-modifica-squadra']
    .map((s) => document.querySelector(s)?.getBoundingClientRect().top ?? null));
  et(ordine.every((x) => x !== null), `ci sono testata, ultima giornata, prossima giornata, campionati e «Nome e colore» (${ordine})`);
  et(ordine.every((x, i) => i === 0 || x > ordine[i - 1]), 'in quest\'ordine: «Nome e colore» in fondo');
  const ult = await p.evaluate(() => document.querySelector('.fs-ultima')?.innerText.replace(/\s+/g, ' ') || '');
  et(/11ª giornata/i.test(ult) && /\d+,\d+\s*pt/i.test(ult), `l'ultima giornata coi punti (${ult.slice(0, 80)})`);
  et(/capitano/i.test(ult), 'e il capitano');
  et((await p.getAttribute('.fs-ultima', 'href')) === '#/futsal/squadra/11', 'tocca e apre la squadra dell\'11ª');
  const pr = await p.evaluate(() => document.querySelector('.fs-prossima')?.innerText.replace(/\s+/g, ' ') || '');
  et(/12ª giornata/i.test(pr) && /chiude lun 30\/11 alle 20:05/i.test(pr), `la prossima giornata con la chiusura (${pr.slice(0, 80)})`);
  et(/Dove giocano i tuoi/i.test(pr) && (await p.$$('.fs-prossima .fs-tua')).length > 0, 'e le partite dei tuoi');
  et(!!(await p.$('.fs-prossima a.a-btn[href="#/futsal/squadra/12"]')), 'con «Prepara la formazione»');
  await p.screenshot({ path: path.join(USCITA, 'futsal-home-1.png') });
  await p.evaluate(() => { const m = document.querySelector('.a-body'); m.scrollTop = 760; }); await w(300);
  await p.screenshot({ path: path.join(USCITA, 'futsal-home-2.png') });

  et(errori.length === 0, `nessun errore in pagina${errori.length ? ` (${errori.join(' | ')})` : ''}`);
  for (const x of ok) console.log(`  ok  ${x}`);
  for (const x of ko) console.log(`  KO  ${x}`);
  await b.close();
  process.exit(ko.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
