/**
 * Il bollino «squalificato» (042). Un utente (15/10): «esistono le probabili
 * formazioni, o almeno sapere chi è squalificato?». Ufficiali non ce ne sono;
 * qui si fa il pezzo che si può fare.
 * - Chi è espulso in una giornata salta la successiva: lo calcola l'app.
 * - Il Giudice Dati segna le altre squalifiche dalla sua pagina, anche per
 *   più giornate, e toglie il bollino a un'espulsione annullata.
 * - Il bollino si vede nella scheda del giocatore (e in Rosa e Formazione).
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    localStorage.setItem('fcs:auth', 'supabase');
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'system' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  const p = await ctx.newPage();
  const risposte = ['2', 'squalificato per 2 giornate (somma di ammonizioni)'];
  p.on('dialog', (d) => d.accept(d.type() === 'prompt' ? risposte.shift() : undefined));
  const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  const w = (ms = 450) => p.waitForTimeout(ms);

  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await w(250);
  await p.fill('#email', 'g@e.it'); await p.fill('#name', 'Giudice'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1000);
  await p.click('[data-form="create"]'); await w(250);
  await p.fill('#lname', 'Torneo'); await p.fill('#team', 'Ducks'); await p.click('#go-create'); await w(1400);

  // il Giudice, e un'espulsione nella giornata prima di quella da schierare
  const g = await p.evaluate(async () => {
    const S = await import('/src/state.js');
    const n = S.giornataDaSchierare();
    const m = S.matchesOf(n - 1)[0];
    const espulso = S.base.players.find((x) => x.clubId === m.homeClubId && !x.doppioneDi);
    const altro = S.base.players.find((x) => x.clubId === m.awayClubId && !x.doppioneDi);
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    Object.assign(s.tables.profiles.find((x) => x.id === s.userId), { is_judge: true });
    (s.tables.match_events ||= []).push({ id: 'ev_rosso', match_id: m.id, player_id: espulso.id, club_id: m.homeClubId, minute: 70, type: 'red_direct' });
    localStorage.setItem('fcs:mock', JSON.stringify(s));
    return { n, espulso: espulso.id, cognomeEspulso: espulso.lastName, altro: altro.id, cognomeAltro: altro.lastName };
  });
  await p.reload({ waitUntil: 'load' }); await w(1800);

  const auto = await p.evaluate(async (id) => { const S = await import('/src/state.js'); return S.squalifica(id); }, g.espulso);
  et(auto && /espulso alla/.test(auto.motivo), `espulso alla ${g.n - 1}ª: squalificato alla ${g.n}ª senza che nessuno lo scriva (${JSON.stringify(auto)})`);
  await p.evaluate((id) => { location.hash = `#/giocatore/${id}`; }, g.espulso); await w(900);
  const scheda = await p.evaluate(() => document.querySelector('main')?.innerText || '');
  et(/SQUALIFICATO/.test(scheda) && /Salta la/.test(scheda), 'nella scheda del giocatore c\'e\' il bollino e dice quale giornata salta');

  // il Giudice segna un'altra squalifica, per due giornate
  await p.evaluate(() => { location.hash = '#/admin'; }); await w(1000);
  const card = await p.evaluate(() => document.querySelector('main')?.innerText || '');
  et(new RegExp(`Squalificati per la ${g.n}`).test(card), 'la pagina del Giudice ha gli squalificati della prossima giornata');
  await p.fill('#sq-cerca', g.cognomeAltro); await p.press('#sq-cerca', 'Enter'); await w(500);
  await p.click(`[data-sq-add="${g.altro}"]`);
  await p.waitForFunction(() => /segnata/.test(document.getElementById('toast')?.textContent || ''), null, { timeout: 8000 }).catch(() => {});
  const due = await p.evaluate(async ({ id, n }) => { const S = await import('/src/state.js'); return [S.squalifica(id, n), S.squalifica(id, n + 1), S.squalifica(id, n + 2)]; }, { id: g.altro, n: g.n });
  et(due[0] && due[1] && !due[2], `per due giornate: la ${g.n}ª e la ${g.n + 1}ª, non la ${g.n + 2}ª (${JSON.stringify(due.map(Boolean))})`);
  const righe = await p.evaluate(() => (JSON.parse(localStorage.getItem('fcs:mock')).tables.squalifiche || []).length);
  et(righe === 2, `scritte nel database (${righe} righe)`);

  // l'espulsione annullata dalla FSGC: il bollino si toglie
  await p.click(`[data-sq-via^="${g.espulso}|"]`); await w(700);
  const tolta = await p.evaluate(async (id) => { const S = await import('/src/state.js'); return S.squalifica(id); }, g.espulso);
  et(tolta === null, 'il Giudice toglie il bollino a un\'espulsione annullata');
  await p.reload({ waitUntil: 'load' }); await w(1800);
  const dopo = await p.evaluate(async ({ a, b }) => { const S = await import('/src/state.js'); return [S.squalifica(a), !!S.squalifica(b)]; }, { a: g.espulso, b: g.altro });
  et(dopo[0] === null && dopo[1], 'e riaprendo l\'app resta tutto com\'era stato deciso');

  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
  await b.close();
  for (const t of ok) console.log('  ok  ' + t);
  for (const t of ko) console.log('  KO  ' + t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
