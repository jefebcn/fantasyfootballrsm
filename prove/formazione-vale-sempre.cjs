/**
 * LEGA PUBBLICA: LA FORMAZIONE CONSEGNATA VALE ANCHE DOPO.
 *
 * Alex, 30/10: «nella lega pubblica le formazioni che sono state consegnate
 * una volta vadano bene sempre [...] chi si scorda di rientrare ha sempre la
 * formazione confermata, e solo se cambi personaggi allora c'è bisogno di
 * riconfermarla». Si consegna una giornata, si torna una settimana dopo (con
 * l'orologio del browser spostato) e la giornata nuova risulta gia'
 * confermata; venduto un titolare, non lo e' piu'.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const init = () => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    localStorage.setItem('fcs:auth', 'supabase');
    if (!localStorage.getItem('fcs:prefs')) localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'dark' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  };
  const opzioni = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' };
  const ctx = await b.newContext(opzioni); await ctx.addInitScript(init);
  let p = await ctx.newPage(); p.on('dialog', (d) => d.accept()); const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  const w = (ms = 700) => p.waitForTimeout(ms);
  const tasto = () => p.evaluate(() => { const t = document.querySelector('#confirm'); return { testo: t?.innerText.trim() || '', gia: !!t?.classList.contains('gia-confermata') }; });

  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await p.fill('#email', 'sempre@e.it'); await p.fill('#name', 'Alex');
  await p.fill('#password', 'password123'); await p.click('#primary'); await w(1200);
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    s.tables.profiles.find((x) => x.id === s.userId).is_admin = true;
    localStorage.setItem('fcs:mock', JSON.stringify(s));
  });
  await p.reload({ waitUntil: 'load' }); await w(1600);
  await p.click('[data-form="pubblica"]'); await w(500);
  await p.fill('#pname', 'Titano Open'); await p.fill('#pbudget', '300'); await p.fill('#pmax', '50');
  await p.fill('#team', 'Sempre FC'); await p.click('#go-pubblica'); await w(1600);
  // calendario dei lock e una rosa completa (3 P, 8 D, 8 C, 6 A), scritti nel finto database
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
  const n = await p.evaluate(async () => (await import('/src/state.js')).giornataDaSchierare());
  et(/conferma formazione/i.test((await tasto()).testo), `giornata ${n}: prima si conferma`);
  await p.click('#confirm'); await w(1500);
  const righe = await p.evaluate((n) => JSON.parse(localStorage.getItem('fcs:mock')).tables.lineups.map((l) => l.matchday).filter((x) => x > n), n);
  et(righe.length >= 2 && righe.includes(n + 1), `consegnata la ${n}ª, il database la porta anche alle giornate dopo (${righe.length})`);
  const nota = await p.evaluate(() => document.querySelector('.a-body > p.small.muted:last-of-type')?.innerText || '');
  et(/prossime giornate/i.test(nota), `e la schermata lo dice («${nota.slice(0, 60)}»)`);

  // una settimana dopo: due ore prima del lock della giornata successiva
  const lockDopo = await p.evaluate(async (n) => (await import('/src/state.js')).matchday(n + 1).lockAt, n);
  const stato = await ctx.storageState();
  await ctx.close();
  const ctx2 = await b.newContext({ ...opzioni, storageState: stato }); await ctx2.addInitScript(init);
  await ctx2.clock.install({ time: new Date(+new Date(lockDopo) - 2 * 3600000) });
  p = await ctx2.newPage(); p.on('dialog', (d) => d.accept()); p.on('pageerror', (e) => errori.push(e.message));
  await p.goto(`${BASE}/#/rosa/formazione`, { waitUntil: 'load' }); await w(2200);
  const n2 = await p.evaluate(async () => (await import('/src/state.js')).giornataDaSchierare());
  et(n2 === n + 1, `si e' passati alla ${n2}ª`);
  const dopo = await tasto();
  et(dopo.gia, `senza rientrare la ${n2}ª risulta gia' confermata («${dopo.testo}»)`);
  const daFare = await p.evaluate(() => !!document.querySelector('.fase-lock .da-fare'));
  et(!daFare, 'e non dice «da consegnare»');

  // si vende un titolare (in una finestra di mercato di riparazione, 039):
  // quella formazione non vale piu', va rifatta
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    s.tables.finestre_mercato = [{ id: 'f1', nome: 'Riparazione', inizio: new Date(Date.now() - 864e5).toISOString(), fine: new Date(Date.now() + 864e5).toISOString() }];
    localStorage.setItem('fcs:mock', JSON.stringify(s));
  });
  await p.reload({ waitUntil: 'load' }); await w(2000);
  const titolare = await p.evaluate(async (n2) => { const S = await import('/src/state.js'); return S.savedLineup(n2, S.me().id).starters[0]; }, n2);
  await p.evaluate(async (id) => { const S = await import('/src/state.js'); await S.vendiGiocatore(id); }, titolare); await w(1200);
  const tolta = await p.evaluate(async (n2) => { const S = await import('/src/state.js'); return !S.savedLineup(n2, S.me().id); }, n2);
  et(tolta, 'venduto un titolare, la formazione va riconfermata');
  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
  await b.close();
  for (const x of ok) console.log('  ok  ' + x);
  for (const x of ko) console.log('  KO  ' + x);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
