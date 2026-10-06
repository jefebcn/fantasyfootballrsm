// "Voti in arrivo" con il filtro "Solo miei".
//
// Dallo schermo di Alex, 6 ottobre: nella 4a giornata, congelata da due
// settimane, Murata-Cosmos e Pennarossa-Fiorentino dicevano "Voti in arrivo
// — i voti compaiono quando il referto viene caricato in lega". I referti
// c'erano, e i voti pure. Era acceso "Solo miei": in quelle due partite Alex
// non aveva giocatori, le righe da mostrare erano zero, e zero righe la nota
// le leggeva come "nessun voto". Il filtro diceva una cosa falsa sulla gara.
//
// La regola: la nota parla della PARTITA, non di quello che il filtro lascia
// vedere. Quindi le "Voti in arrivo" con un filtro acceso sono le stesse che
// senza filtro, e una partita dove il filtro non lascia nessuno sparisce,
// come succede col filtro per ruolo.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    localStorage.setItem('fcs:auth', 'supabase');
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, theme: 'system' }));
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

  const conta = () => p.evaluate(() => [...document.querySelectorAll('.vlist')].map((v) => ({
    gara: v.querySelector('.vhead')?.firstChild?.textContent.trim(),
    attesa: !!v.querySelector('.vnota--attesa'),
    righe: v.querySelectorAll('.vr, .vrow, [data-toggle]').length,
  })));
  await p.evaluate(() => { location.hash = '#/voti/4'; }); await w(900);
  await p.click('[data-f="all"]').catch(() => {}); await w(400);
  const tutti = await conta();
  await p.click('[data-f="mine"]'); await w(600);
  const miei = await conta();

  const attesaTutti = tutti.filter((x) => x.attesa).map((x) => x.gara).sort();
  const attesaMiei = miei.filter((x) => x.attesa).map((x) => x.gara).sort();
  if (tutti.length < 8) ko.push(`senza filtro si vedono ${tutti.length} partite della 4a, non 8`);
  if (attesaMiei.length > attesaTutti.length) {
    ko.push(`con "Solo miei" ${attesaMiei.length} partite dicono "Voti in arrivo", senza filtro ${attesaTutti.length}: ${attesaMiei.filter((g) => !attesaTutti.includes(g)).join(', ')}`);
  }
  for (const x of miei) if (!x.attesa && x.righe === 0) ko.push(`con "Solo miei" resta una partita vuota: ${x.gara}`);
  if (!miei.some((x) => x.righe > 0)) ko.push('con "Solo miei" non resta nessun mio giocatore: la prova non prova niente');
  console.log(ko.length ? ko.join('\n') : 'nessun problema');
  await b.close();
  process.exit(ko.length ? 1 : 0);
})();
