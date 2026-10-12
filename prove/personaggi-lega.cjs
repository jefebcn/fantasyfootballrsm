/**
 * I PERSONAGGI NELLA LISTA DEI PARTECIPANTI.
 *
 * Alex, 12/10: «ogni persona si veda in questa schermata il personaggio che
 * hanno scelto». In Profilo lega, accanto allo stemma, c'era sempre la
 * maglia. Ora chi ha scelto un personaggio (La mia squadra) lo mostra, come
 * nella copertina della home; chi non l'ha scelto tiene la maglia.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const USCITA = process.env.USCITA || '/tmp';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', colorScheme: 'dark' });
  await ctx.addInitScript(() => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    localStorage.setItem('fcs:auth', 'supabase');
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'system' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  const p = await ctx.newPage(); const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  const w = (ms = 700) => p.waitForTimeout(ms);
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await p.fill('#email', 'p@e.it'); await p.fill('#name', 'Hyrox12');
  await p.fill('#password', 'password123'); await p.click('#primary'); await w(1200);
  await p.click('[data-form="create"]'); await p.fill('#lname', 'Titano Open Season 1'); await p.fill('#team', 'Chirinquito Ducks');
  await p.click('#go-create'); await w(1500);
  // io ho TITO, un altro ha il personaggio 1, un terzo tiene la maglia
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    const mio = s.tables.league_members.find((m) => m.user_id === s.userId);
    mio.kit = { ...(mio.kit || {}), personaggio: 30 };
    const base = { league_id: mio.league_id, role: 'manager', credits: 500, color: '#1B84C6' };
    s.tables.profiles.push({ id: 'u_enea', display_name: 'Enea' }, { id: 'u_mirco', display_name: 'Mirco' });
    s.tables.league_members.push({ ...base, id: 'm_enea', user_id: 'u_enea', team_name: 'Ac Haramball', owner_name: 'Enea', initials: 'AH', kit: { personaggio: 1 } },
      { ...base, id: 'm_mirco', user_id: 'u_mirco', team_name: 'Ccc', owner_name: 'Mirco', initials: 'C', color: '#27AE60' });
    localStorage.setItem('fcs:mock', JSON.stringify(s));
  });
  await p.reload({ waitUntil: 'load' }); await w(1500);
  await p.evaluate(() => { location.hash = '#/lega'; }); await w(1500);
  const righe = await p.evaluate(() => [...document.querySelectorAll('.prow.conmaglia')].map((r) => ({
    nome: r.querySelector('.ptxt b')?.textContent.trim(),
    pers: r.querySelector('.pmg img.pers')?.getAttribute('src') || null,
    maglia: !!r.querySelector('.pmg .maglia'),
    h: r.querySelector('.pmg img.pers')?.getBoundingClientRect().height || 0,
  })));
  const di = (n) => righe.find((r) => (r.nome || '').startsWith(n)) || {};
  et(/avatar\/30\.webp/.test(di('Chirinquito').pers || ''), `la mia squadra mostra TITO (${di('Chirinquito').pers})`);
  et(/avatar\/1\.webp/.test(di('Ac Haramball').pers || ''), `chi ha scelto un personaggio lo mostra (${di('Ac Haramball').pers})`);
  et(di('Ccc').maglia && !di('Ccc').pers, 'chi non l\'ha scelto tiene la maglia');
  et(di('Chirinquito').h >= 40, `il personaggio si vede, non e' un francobollo (${Math.round(di('Chirinquito').h)} px)`);
  await p.screenshot({ path: `${USCITA}/personaggi-lega.png` }).catch(() => {});
  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
  await b.close();
  for (const t of ok) console.log('  ok  ' + t);
  for (const t of ko) console.log('  KO  ' + t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
