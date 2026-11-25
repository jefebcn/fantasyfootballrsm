/**
 * La scheda da condividere dentro l'app, nella lega pubblica.
 *
 * Prima la scheda conosceva solo lo scontro diretto: nella lega pubblica (a
 * punti) il tasto «Condividi» della home portava a «Nessuna partita giocata da
 * condividere». Qui si consegna una formazione, la si porta su una giornata
 * gia' giocata del campionato vero (referti in src/eventi-dati.js) e la
 * scheda deve mostrare l'immagine 1080x1920 con i fantapunti di quella
 * giornata.
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
    if (!localStorage.getItem('fcs:prefs')) localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'dark' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  const p = await ctx.newPage(); p.on('dialog', (d) => d.accept());
  const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  const w = (ms = 700) => p.waitForTimeout(ms);

  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await p.fill('#email', 'card@e.it'); await p.fill('#name', 'Alex');
  await p.fill('#password', 'password123'); await p.click('#primary'); await w(1200);
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    s.tables.profiles.find((x) => x.id === s.userId).is_admin = true;
    localStorage.setItem('fcs:mock', JSON.stringify(s));
  });
  await p.reload({ waitUntil: 'load' }); await w(1600);
  await p.click('[data-form="pubblica"]'); await w(500);
  await p.fill('#pname', 'Titano Open'); await p.fill('#pbudget', '300'); await p.fill('#pmax', '50');
  await p.fill('#team', 'Card FC'); await p.click('#go-pubblica'); await w(1600);

  // Senza giornate giocate in lega: un messaggio, non un errore
  await p.evaluate(() => { location.hash = '#/scheda'; }); await w(900);
  const vuota = await p.evaluate(() => document.querySelector('.empty p')?.innerText || '');
  et(/prima giornata/i.test(vuota), `prima della sua prima giornata la scheda lo dice («${vuota}»)`);

  // rosa completa e calendario dei lock, poi la formazione dalla schermata vera
  await p.evaluate(async () => {
    const S = await import('/src/state.js');
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    s.tables.matchday_locks = S.base.matchdays.map((md) => ({ matchday: md.number, lock_at: new Date(md.lockAt).toISOString() }));
    const m = s.tables.league_members[0]; const quote = { P: 3, D: 8, C: 8, A: 6 };
    s.tables.rosters = Object.entries(quote).flatMap(([r, q]) => S.base.players.filter((x) => x.role === r && x.isActive).slice(0, q))
      .map((x) => ({ id: `r_${x.id}`, league_id: m.league_id, member_id: m.id, player_id: x.id, price_paid: 1, released_at: null }));
    localStorage.setItem('fcs:mock', JSON.stringify(s));
  });
  await p.reload({ waitUntil: 'load' }); await w(1600);
  await p.evaluate(() => { location.hash = '#/rosa/formazione'; }); await w(1300);
  await p.click('#confirm'); await w(1500);

  // la lega "nasce" a inizio stagione e la formazione vale per l'ultima giornata giocata
  const n = await p.evaluate(async () => {
    const S = await import('/src/state.js');
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    s.tables.leagues[0].created_at = '2026-08-01T00:00:00Z';
    const giocate = S.base.matchdays.filter((md) => new Date(md.lockAt) < new Date()).map((md) => md.number);
    const n = Math.max(...giocate);
    const l = s.tables.lineups[0];
    s.tables.lineups.push({ ...l, id: `${l.id}_g${n}`, matchday: n });
    localStorage.setItem('fcs:mock', JSON.stringify(s));
    return n;
  });
  await p.reload({ waitUntil: 'load' }); await w(1600);
  await p.evaluate(() => { location.hash = '#/scheda'; }); await w(2500);
  const r = await p.evaluate(async () => {
    const img = document.querySelector('#card-g img');
    const { datiScheda } = await import('/src/views/scheda.js');
    const d = datiScheda();
    return { w: img?.naturalWidth, h: img?.naturalHeight, d: { giornata: d.giornata, punti: d.punti, numeri: d.numeri, migliori: d.migliori?.length, vuota: d.vuota },
      tasto: !!document.querySelector('#share-img:not([hidden])') || !!document.querySelector('#salva-img:not([hidden])') };
  });
  et(!r.d.vuota, `la scheda ha i dati (${r.d.vuota || `giornata ${r.d.giornata}, ${r.d.punti} fantapunti`})`);
  et(r.d.giornata === n, `giornata ${r.d.giornata} (formazione portata sulla ${n}ª)`);
  et(r.w === 1080 && r.h === 1920, `immagine 1080x1920 nella pagina (${r.w}x${r.h})`);
  et(r.d.numeri?.length === 2 && /ª$/.test(r.d.numeri[0].valore), `posto nella giornata e in classifica (${JSON.stringify(r.d.numeri)})`);
  et(r.d.migliori > 0, `i migliori della formazione (${r.d.migliori})`);
  et(r.tasto, 'c\'e\' un tasto per condividere o salvare l\'immagine');
  if (process.env.USCITA) await p.screenshot({ path: `${process.env.USCITA}/scheda-card.png` });

  // dalla home, «Condividi» porta qui
  await p.evaluate(() => { location.hash = '#/'; }); await w(1200);
  const href = await p.evaluate(() => document.querySelector('.hero-azioni a[href="#/scheda"]') ? '#/scheda' : '');
  et(href === '#/scheda', 'il tasto «Condividi» della home apre la scheda');

  et(!errori.length, `nessun errore nella pagina (${errori.join(' | ')})`);
  await b.close();
  ok.forEach((x) => console.log('  ok  ', x)); ko.forEach((x) => console.log('  KO  ', x));
  console.log(`scheda-card: ${ok.length} ok, ${ko.length} KO`);
  process.exit(ko.length ? 1 : 0);
})();
