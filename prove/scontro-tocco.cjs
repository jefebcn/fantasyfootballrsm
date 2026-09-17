/**
 * In dashboard, il tocco sulle due squadre della giornata corrente apre il
 * pre-match a tutto campo. La pagina c'era gia', ma ci si arrivava solo dal
 * link "Probabili e altro" sotto il bottone, che nessuno vedeva.
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
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, theme: 'system' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  const p = await ctx.newPage(); p.on('dialog', d => d.accept());
  const errori = []; p.on('pageerror', e => errori.push(e.message));
  const w = (ms = 450) => p.waitForTimeout(ms);
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1200);
  await p.click('[data-tab="up"]'); await w(250);
  await p.fill('#email', 'a@e.it'); await p.fill('#name', 'Alessandro'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1000);
  await p.click('[data-form="create"]'); await w(250);
  await p.fill('#lname', 'Prova'); await p.fill('#team', 'Prova FC'); await p.click('#go-create'); await w(1200);
  // Con una squadra sola non c'e' scontro: si mette un avversario nel mock,
  // come farebbe join_league da un altro telefono.
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    const io = s.tables.league_members[0];
    s.tables.profiles.push({ id: 'u_rivale', display_name: 'Wesly', is_judge: false });
    s.tables.league_members.push({ ...io, id: 'm_rivale', user_id: 'u_rivale', role: 'fantallenatore', team_name: 'Fuego Roxy', owner_name: 'Wesly', color: '#c0392b', initials: 'FR' });
    localStorage.setItem('fcs:mock', JSON.stringify(s));
  });
  await p.evaluate(() => { location.hash = '#/'; });
  await p.reload({ waitUntil: 'load' }); await w(1800);

  const c = await p.evaluate(() => !!document.querySelector('a.mrow.tocca'));
  et(c, 'la riga delle due squadre e\' un link');
  if (c) {
    await p.click('a.mrow.tocca'); await w(900);
    const dove = await p.evaluate(() => location.hash);
    et(/^#\/live\//.test(dove), `il tocco apre lo scontro (${dove})`);
    const campo = await p.evaluate(() => ({ field: !!document.querySelector('.field'), testo: document.body.innerText.slice(0, 600) }));
    et(campo.field, 'e si vede il campo con le due squadre');
    et(/Probabili formazioni/.test(campo.testo), 'in pre-match, con le probabili');
    et(/0-3 a tavolino/.test(campo.testo), 'e dice che senza consegna e\' 0-3 a tavolino');
  }
  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
  await b.close();
  for (const t of ok) console.log('  ok  ' + t);
  for (const t of ko) console.log('  KO  ' + t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
