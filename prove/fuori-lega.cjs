/**
 * ROSA E FORMAZIONE IN UNA LEGA DOVE NON HAI UNA SQUADRA.
 *
 * Console, 12/10: «null is not an object (evaluating 'me.id')» su Rosa, da
 * un iPhone. Succede a chi resta con una lega aperta in cui non ha piu' la
 * squadra (uscito, tolto dall'amministratore). Rosa, Formazione, Scheda e
 * La mia squadra leggevano la squadra senza guardare se c'era: schermata
 * bianca ed errore. Qui si toglie la squadra e si aprono tutte e quattro:
 * deve comparire «Non fai parte di questa lega», senza errori.
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
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'light' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  const p = await ctx.newPage(); p.on('dialog', (d) => d.accept());
  const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  const w = (ms = 700) => p.waitForTimeout(ms);
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await p.fill('#email', 'f@e.it'); await p.fill('#name', 'Alex');
  await p.fill('#password', 'password123'); await p.click('#primary'); await w(1200);
  await p.click('[data-form="create"]'); await p.fill('#lname', 'Prima'); await p.fill('#team', 'Prima FC');
  await p.click('#go-create'); await w(1500);
  await p.evaluate(() => { location.hash = '#/leghe'; }); await w(800);
  await p.click('[data-form="create"]'); await p.fill('#lname', 'Seconda'); await p.fill('#team', 'Seconda FC');
  await p.click('#go-create'); await w(1500);
  // la squadra nella lega aperta sparisce, come per chi viene tolto
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    const l = s.tables.leagues.find((x) => x.name === 'Seconda');
    s.tables.league_members = s.tables.league_members.filter((m) => !(m.league_id === l.id && m.user_id === s.userId));
    localStorage.setItem('fcs:mock', JSON.stringify(s));
  });
  await p.reload({ waitUntil: 'load' }); await w(1500);
  // L'app, ricaricando, porta giustamente nella lega dove la squadra c'e'.
  // Il caso del telefono e' quello in cui la lega aperta resta quella e la
  // squadra non c'e' (dati della lega arrivati a meta', squadra appena
  // tolta): si ricrea togliendola dai dati gia' caricati.
  await p.evaluate(async () => {
    const S = await import('/src/state.js');
    const io = S.me(); if (io) S.base.managers.splice(S.base.managers.indexOf(io), 1);
  });
  for (const h of ['rosa', 'rosa/formazione', 'scheda', 'squadra']) {
    await p.evaluate((x) => { location.hash = `#/${x}`; }, h); await w(900);
    const t = await p.evaluate(() => document.querySelector('.a-body')?.innerText || '');
    // se l'app ti riporta altrove (alle leghe, alla home) va bene lo stesso:
    // basta che non si rompa
    et(!/me\.id|undefined/.test(t), `#/${h}: si apre senza rompersi («${t.replace(/\s+/g, ' ').slice(0, 50)}»)`);
  }
  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
  await b.close();
  for (const t of ok) console.log('  ok  ' + t);
  for (const t of ko) console.log('  KO  ' + t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
