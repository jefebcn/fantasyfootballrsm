const { chromium } = require('playwright');
const path = require('path');
const { fermaDatiFutsal } = require(require('path').join(__dirname, '..', '..', 'prove', 'strumenti', 'futsal-dati-fino.cjs'));
const BASE = 'http://localhost:4173', OUT = process.argv[2];
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, timezoneId: 'Europe/Rome', locale: 'it-IT', isMobile: true, hasTouch: true, serviceWorkers: 'block', colorScheme: 'dark' });
  await fermaDatiFutsal(ctx, 12);
  await ctx.clock.setFixedTime(new Date('2026-12-01T09:00:00+01:00'));
  await ctx.addInitScript(() => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    localStorage.setItem('fcs:auth', 'supabase');
    localStorage.setItem('fcs:fs-benvenuto', '1');
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'dark' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  const p = await ctx.newPage(); const err = []; p.on('pageerror', (e) => err.push(e.message));
  const w = (ms = 500) => p.waitForTimeout(ms);
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await w(250);
  await p.fill('#email', 'casa@e.it'); await p.fill('#name', 'Alex'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1200);
  await p.evaluate(() => { location.hash = '#/futsal'; }); await w(900);
  await p.evaluate(() => { const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) if (/FSGC/.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(/ufficiali\s+FSGC/g, 'ufficiali delle partite').replace(/\s*FSGC/g, ''); });
  await w(200);
  console.log('FSGC rimasti:', await p.evaluate(() => (document.body.innerText.match(/FSGC/g) || []).length));
  await p.screenshot({ path: path.join(OUT, 'iscrizione.png') });
  await p.fill('#fs-squadra', 'Hasta El Roxy'); await p.selectOption('#fs-cuore', 'pennarossa'); await p.click('#fs-iscriviti'); await w(1200);
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
  await p.screenshot({ path: path.join(OUT, 'home.png') });
  await p.evaluate(() => { location.hash = '#/futsal/squadra/12'; }); await w(1800);
  await p.screenshot({ path: path.join(OUT, 'squadra.png') });
  await p.evaluate(() => { location.hash = '#/futsal/squadra/11'; }); await w(1800);
  await p.screenshot({ path: path.join(OUT, 'squadra11.png') });
  console.log('errori', err);
  await b.close();
})();
