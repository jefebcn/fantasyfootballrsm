// Un giocatore nuovo nel referto prima che il telefono abbia il listone.
//
// 25/10, errori sui telefoni: «Cannot read properties of undefined (reading
// 'clubId')» su #/voti, quattro volte in un giorno, da versioni 4.2.220-224.
// L'import aveva messo nel database le presenze di Brighi (La Fiorita, nuovo
// dal referto); chi aveva l'app di prima non lo aveva nel listone, e la pagina
// Voti intera si rompeva su quella riga. Ora la riga si salta e il resto si
// vede.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    localStorage.setItem('fcs:auth', 'supabase');
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'system' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  const p = await ctx.newPage(); p.on('dialog', (d) => d.accept());
  const w = (ms = 500) => p.waitForTimeout(ms);
  const ko = [];
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1200);
  await p.click('[data-tab="up"]'); await w(300);
  await p.fill('#email', 'a@e.it'); await p.fill('#name', 'Alessandro'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1200);
  await p.click('[data-form="create"]'); await w(300);
  await p.fill('#lname', 'Lega Titano'); await p.fill('#team', 'Hasta El Chapo FC'); await p.click('#go-create'); await w(1200);
  await p.evaluate(() => {
    const K = 'fcs:mock'; const s = JSON.parse(localStorage.getItem(K)); const lg = s.tables.leagues[0];
    [['Serravalle United', 'Marco', '#c0392b', 'SU'], ['Borgo Maggiore FC', 'Luca', '#27ae60', 'BM'], ['Domagnano Stars', 'Sara', '#8e44ad', 'DS']].forEach(([t, o, c, i], k) => {
      s.tables.league_members.push({ id: 'fk' + k, league_id: lg.id, user_id: 'fu' + k, role: 'fantallenatore', team_name: t, owner_name: o, color: c, initials: i, credits: 500, created_at: new Date().toISOString() });
    });
    localStorage.setItem(K, JSON.stringify(s));
  });
  await p.reload({ waitUntil: 'load' }); await w(1500);
  await p.evaluate(() => { location.hash = '#/lega'; }); await w(600); await p.click('#draft').catch(() => {}); await w(2000);
  await p.evaluate(() => { location.hash = '#/impostazioni/avanzate'; }); await w(600);
  if (!(await p.evaluate(() => { const x = document.querySelector('[data-act="seed"]'); if (x) x.click(); return !!x; }))) throw new Error('niente giornate da caricare');
  await w(3500);

  const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  const gara = await p.evaluate(() => {
    const K = 'fcs:mock'; const s = JSON.parse(localStorage.getItem(K));
    const una = s.tables.match_appearances.find((a) => String(a.match_id).startsWith('md4_'));
    s.tables.match_appearances.push({ ...una, player_id: 'lafiorita_999' });
    localStorage.setItem(K, JSON.stringify(s));
    return una.match_id;
  });
  await p.reload({ waitUntil: 'load' }); await w(1500);
  await p.evaluate(() => { location.hash = '#/voti/4'; }); await w(1200);
  const partite = await p.evaluate(() => document.querySelectorAll('.vlist').length);
  if (errori.length) ko.push(`errori sulla pagina: ${errori.join(' | ')}`);
  if (partite < 8) ko.push(`si vedono ${partite} partite della 4a, non 8 (presenza in piu' su ${gara})`);
  for (const x of ko) console.log('  KO ', x);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  await b.close(); process.exit(ko.length ? 1 : 0);
})();
