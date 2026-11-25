/**
 * Il traguardo inviti (070, docs/CRESCITA.md): 3 amici attivi.
 *
 * Un amico arrivato dal link conta solo se ha confermato lui la formazione in
 * 2 giornate diverse. Qui tre amici nel finto database:
 *   - Uno: due conferme vere (giornata 9 e giornata 10)  -> attivo
 *   - Due: una conferma sola, copiata dalla lega pubblica sulle giornate dopo
 *          (stesso submitted_at, 050)                    -> non attivo
 *   - Tre: nessuna formazione                            -> non attivo
 * Il riquadro dei Reclutatori deve dire «1 su 3», e la console deve mostrare
 * la riga di chi ha invitato.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    window.__MOCK_023__ = true;
    localStorage.setItem('fcs:auth', 'supabase');
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
    if (!localStorage.getItem('fcs:prefs')) localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'light' }));
  });
  const p = await ctx.newPage(); p.on('dialog', (d) => d.accept());
  const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  const w = (ms = 700) => p.waitForTimeout(ms);

  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await p.fill('#email', 'org@e.it'); await p.fill('#name', 'Alex');
  await p.fill('#password', 'password123'); await p.click('#primary'); await w(1200);
  await p.click('[data-form="create"]'); await p.fill('#lname', 'Torneo Titano'); await p.fill('#team', 'Hasta El Roxy');
  await p.click('#go-create'); await w(1500);

  // tre amici portati da Alex, con le loro formazioni
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    const io = s.tables.profiles.find((x) => x.id === s.userId); io.is_admin = true;
    const lega = s.tables.leagues[0].id;
    const amico = (id, nome) => {
      s.tables.profiles.push({ id, email: `${id}@e.it`, display_name: nome, invitato_da: s.userId, reclutati: 0, created_at: new Date().toISOString() });
      s.tables.league_members.push({ id: `m_${id}`, league_id: lega, user_id: id, role: 'fantallenatore', team_name: `${nome} FC`, owner_name: nome, color: '#1B84C6', initials: nome.slice(0, 2).toUpperCase(), credits: 500, created_at: new Date().toISOString() });
    };
    amico('uno', 'Uno'); amico('due', 'Due'); amico('tre', 'Tre');
    const f = (member, matchday, quando) => (s.tables.lineups ||= []).push({ league_id: lega, member_id: member, matchday, lineup: {}, submitted_at: quando });
    f('m_uno', 9, '2026-11-14T10:00:00Z'); f('m_uno', 10, '2026-11-21T10:00:00Z');
    // Due conferma una volta: le giornate dopo sono copie con lo stesso istante
    f('m_due', 9, '2026-11-14T11:00:00Z'); f('m_due', 10, '2026-11-14T11:00:00Z'); f('m_due', 11, '2026-11-14T11:00:00Z');
    io.reclutati = 3;
    localStorage.setItem('fcs:mock', JSON.stringify(s));
  });
  await p.reload({ waitUntil: 'load' }); await w(1500);
  await p.evaluate(() => { location.hash = '#/lega'; }); await w(1300);
  const trag = await p.evaluate(() => ({
    testo: document.querySelector('.recl-card .trag')?.innerText || '',
    barra: document.querySelector('.recl-card .trag-barra i')?.style.width || '',
  }));
  et(/1 su 3/.test(trag.testo), `il riquadro dice «1 su 3» («${trag.testo.replace(/\s+/g, ' ').slice(0, 80)}»)`);
  et(trag.barra === '33%', `la barra è a un terzo (${trag.barra})`);
  et(/2 tuoi amici non ci sono ancora arrivati/.test(trag.testo), 'dice quanti amici non sono ancora attivi');

  // la console, scheda «numeri»
  await p.evaluate(() => { location.hash = '#/admin/console'; }); await w(2500);
  const riga = await p.evaluate(() => {
    const sez = [...document.querySelectorAll('.a-sec')].find((x) => /traguardo inviti/i.test(x.innerText));
    const tab = sez?.nextElementSibling?.querySelector('tbody tr');
    return tab ? [...tab.querySelectorAll('td')].map((td) => td.innerText.trim()) : null;
  });
  et(riga && riga[1] === '3' && riga[2] === '1', `nella console: amici 3, attivi 1 (${JSON.stringify(riga)})`);

  et(!errori.length, `nessun errore nella pagina (${errori.join(' | ')})`);
  if (process.env.USCITA) { await p.evaluate(() => { location.hash = '#/lega'; }); await w(1000); await p.screenshot({ path: `${process.env.USCITA}/traguardo-inviti.png`, fullPage: true }); }
  await b.close();
  ok.forEach((x) => console.log('  ok  ', x)); ko.forEach((x) => console.log('  KO  ', x));
  console.log(`traguardo-inviti: ${ok.length} ok, ${ko.length} KO`);
  process.exit(ko.length ? 1 : 0);
})();
