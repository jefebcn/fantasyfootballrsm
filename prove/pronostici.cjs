// I pronostici della giornata (#/pronostici, migrazione 071).
//
// Chi si iscrive e non ha una lega apre i pronostici dal menu; tocca 1 X 2 e
// il risultato esatto, si salva da solo, ricaricando resta; ritoccare lo
// stesso segno lo toglie. Dopo la chiusura (finto database) ci sono punti,
// percentuali e classifica. Schermata a 375 di larghezza senza sbordare.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const OUT = process.env.USCITA || '/tmp';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ko = [];
  const vero = (c, m) => { if (!c) ko.push(m); };
  const ctx = await b.newContext({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    localStorage.setItem('fcs:auth', 'supabase');
    if (!localStorage.getItem('fcs:prefs')) localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'system' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  const p = await ctx.newPage(); p.on('dialog', (d) => d.accept());
  const err = []; p.on('pageerror', (e) => err.push(e.message));
  const w = (ms = 500) => p.waitForTimeout(ms);
  const db = () => p.evaluate(() => JSON.parse(localStorage.getItem('fcs:mock')).tables);

  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1200);
  await p.click('[data-tab="up"]'); await w(250);
  await p.fill('#email', 'pro@e.it'); await p.fill('#name', 'Alex'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1400);
  // i blocchi delle giornate, come in produzione
  await p.evaluate(async () => {
    const S = await import('/src/state.js');
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    s.tables.matchday_locks = S.base.matchdays.map((md) => ({ matchday: md.number, lock_at: new Date(md.lockAt).toISOString() }));
    localStorage.setItem('fcs:mock', JSON.stringify(s));
  });
  await p.reload({ waitUntil: 'load' }); await w(1400);

  // 1. senza lega si apre lo stesso
  await p.evaluate(() => { location.hash = '#/pronostici'; }); await w(1300);
  vero((await p.evaluate(() => location.hash)) === '#/pronostici', `senza lega i pronostici portano a ${await p.evaluate(() => location.hash)}`);
  const n = await p.evaluate(async () => (await import('/src/state.js')).giornataDaSchierare());
  const partite = await p.$$eval('.pr-partita', (x) => x.length);
  const attese = await p.evaluate(async (n) => (await import('/src/state.js')).matchesOf(n).length, n);
  vero(partite === attese && partite > 0, `giornata ${n}: ${partite} partite in pagina, ${attese} in calendario`);

  // 2. un segno, poi il risultato esatto che lo cambia
  await p.click('.pr-partita >> nth=0 >> [data-segno="1"]'); await w(500);
  await p.click('.pr-partita >> nth=1 >> [data-segno="X"]'); await w(500);
  let righe = (await db()).pronostici || [];
  vero(righe.length === 2 && righe.every((r) => r.matchday === n), `dopo due tocchi ${righe.length} pronostici nel database`);
  // il risultato esatto: niente prima del segno, poi chiuso dietro «+ risultato esatto»
  const terza = await p.$$eval('.pr-partita >> nth=2 >> .pr-piu, .pr-partita >> nth=2 >> .pr-gol', (x) => x.length).catch(() => -1);
  vero(terza === 0, `senza segno niente risultato esatto (${terza})`);
  vero(await p.$('.pr-partita >> nth=0 >> .pr-piu') && !(await p.$('.pr-partita >> nth=0 >> .pr-gol')), 'dopo il segno compare «+ risultato esatto», chiuso');
  vero(!(await p.textContent('main')).includes('facoltativo'), 'la regola dei 3 punti non si ripete in ogni partita');
  await p.click('.pr-partita >> nth=0 >> .pr-piu'); await w(300);
  const prima = await p.$('.pr-partita >> nth=0');
  await (await prima.$('[data-gol="c"]')).selectOption('0');
  await (await prima.$('[data-gol="o"]')).selectOption('2'); await w(500);
  righe = (await db()).pronostici;
  const r0 = righe.find((r) => r.gol_casa === 0 && r.gol_ospite === 2);
  vero(r0 && r0.segno === '2', `0-2 esatto: il segno diventa 2 (${JSON.stringify(r0)})`);
  vero(await p.$eval('.pr-partita >> nth=0 >> [data-segno="2"]', (x) => x.classList.contains('on')).catch(() => false), 'il tasto 2 si accende da solo');

  // 3. ricaricando resta; ritoccare lo stesso segno lo toglie
  await p.reload({ waitUntil: 'load' }); await w(1500);
  const accesi = await p.$$eval('.pr-s.on', (x) => x.length);
  vero(accesi === 2, `ricaricando ${accesi} segni accesi invece di 2`);
  await p.click('.pr-partita >> nth=1 >> [data-segno="X"]'); await w(500);
  vero(((await db()).pronostici || []).length === 1, 'ritoccare X lo toglie');
  await p.screenshot({ path: `${OUT}/pronostici-aperta.png`, fullPage: true });
  const intro = await p.$eval('.pr-intro', (x) => Math.round(x.getBoundingClientRect().height / (parseFloat(getComputedStyle(x).fontSize) * 1.5)));
  vero(intro <= 1, `l'introduzione sta su ${intro} righe`);
  const troncati = await p.$$eval('.pr-squadre b', (x) => x.filter((e) => e.scrollWidth > e.clientWidth + 1).length);
  vero(troncati === 0, `${troncati} nomi di squadra troncati`);
  const largo = await p.evaluate(() => document.documentElement.scrollWidth);
  vero(largo <= 375, `la pagina sborda: ${largo}px`);

  // 4. la giornata si chiude; un'altra persona aveva pronosticato; arriva il risultato vero
  const m0 = await p.evaluate(async (n) => { const m = (await import('/src/state.js')).matchesOf(n)[0]; return { c: m.homeClubId, o: m.awayClubId }; }, n);
  // il finto database vive in memoria: si scrive e si ricarica
  await p.evaluate(({ n, m0 }) => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    s.tables.profiles.push({ id: 'bea', display_name: 'Bea' });
    s.tables.pronostici.push({ user_id: 'bea', matchday: n, casa: m0.c, ospite: m0.o, segno: '1', gol_casa: null, gol_ospite: null });
    s.tables.matchday_locks.find((k) => k.matchday === n).lock_at = new Date(Date.now() - 60000).toISOString();
    // il primo iscritto del finto database e' Giudice, e il Giudice riallinea i blocchi al calendario
    s.tables.profiles.find((x) => x.id === s.userId).is_judge = false;
    localStorage.setItem('fcs:mock', JSON.stringify(s));
  }, { n, m0 });
  await p.reload({ waitUntil: 'load' }); await w(1400);
  // il risultato vero non c'e' ancora: la classifica si prova con una chiamata
  // diretta, nello stesso formato che usa la pagina
  const cl = await p.evaluate(async ({ n, m0 }) => (await import('/src/backend.js')).pronosticiClassifica([{ g: n, c: m0.c, o: m0.o, gc: 0, go: 2 }]), { n, m0 });
  vero(cl.length === 2 && cl[0].punti === 3 && cl[0].mio && cl[1].punti === 0, `classifica dopo 0-2: ${JSON.stringify(cl)}`);

  await p.evaluate(() => { location.hash = '#/'; }); await w(600);
  await p.evaluate(() => { location.hash = '#/pronostici'; }); await w(1300);
  vero(await p.$('.pr-classifica'), 'la classifica c\'è');
  vero(err.length === 0, `errori nella pagina: ${err.join(' | ')}`);
  await p.screenshot({ path: `${OUT}/pronostici-classifica.png`, fullPage: true });

  await b.close();
  if (ko.length) { console.log('KO\n - ' + ko.join('\n - ')); process.exit(1); }
  console.log('ok  pronostici: senza lega, 1 X 2, esatto, ricarica, toglie, classifica');
})();
