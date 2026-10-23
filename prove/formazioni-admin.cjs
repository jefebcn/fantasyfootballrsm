/**
 * Formazioni preparate ma non confermate, e la conferma da amministratore (046).
 *
 * Alex, 23/10: «da admin vedere se la gente ha messo la formazione, se l'ha
 * confermata, e in caso confermargliela io». Qui:
 *  - chi prepara la formazione lascia una bozza sul server, senza toccare
 *    «Conferma» (e aprire la schermata senza cambiare niente non la lascia);
 *  - la Console, scheda Consegne, mostra squadra per squadra: preparata e
 *    non confermata, niente, consegnata;
 *  - «Conferma per lui» consegna la bozza; «Come la …ª» ripete l'ultima.
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
  const w = (ms = 450) => p.waitForTimeout(ms);
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1200);
  await p.click('[data-tab="up"]'); await w(250);
  await p.fill('#email', 'admin@e.it'); await p.fill('#name', 'Alex'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1000);
  await p.click('[data-form="create"]'); await w(250);
  await p.fill('#lname', 'Lega Prova'); await p.fill('#team', 'Alex FC'); await p.click('#go-create'); await w(1500);

  // Il resto lo si prepara nel database finto: io amministratore, una rosa a
  // testa per tre squadre, Bruno con la formazione della giornata prima e una
  // bozza per questa, Carla senza niente.
  const n = await p.evaluate(async () => (await import('/src/state.js')).giornataDaSchierare());
  await p.evaluate(async (n) => {
    const S = await import('/src/state.js');
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    const io = s.tables.profiles.find((x) => x.id === s.userId); Object.assign(io, { is_admin: true, is_owner: true });
    const lega = s.tables.league_members.find((m) => m.user_id === s.userId).league_id;
    const mio = s.tables.league_members.find((m) => m.user_id === s.userId).id;
    const ora = new Date().toISOString();
    for (const [id, nome] of [['m_bruno', 'Bruno'], ['m_carla', 'Carla']]) {
      s.tables.profiles.push({ id: `u_${id}`, display_name: nome, created_at: ora });
      s.tables.league_members.push({ id, league_id: lega, user_id: `u_${id}`, role: 'fantallenatore', team_name: `${nome} United`, owner_name: nome, credits: 0, created_at: ora });
    }
    // rose separate: 2 P, 6 D, 6 C, 4 A a testa, dal listone vero
    const per = (r) => S.base.players.filter((x) => x.role === r && !x.doppioneDi && x.isActive !== false);
    const quanti = { P: 2, D: 6, C: 6, A: 4 };
    const rosa = {};
    [mio, 'm_bruno', 'm_carla'].forEach((m, k) => {
      rosa[m] = Object.entries(quanti).flatMap(([r, q]) => per(r).slice(k * q, (k + 1) * q).map((x) => x.id));
      rosa[m].forEach((pid, i) => (s.tables.rosters ||= []).push({ id: `r_${m}_${i}`, league_id: lega, member_id: m, player_id: pid, price_paid: 1, acquired_at: ora, released_at: null }));
    });
    const undici = (m) => { const r = rosa[m]; const of = (role) => r.filter((id) => S.playersById.get(id).role === role);
      return { formation: '4-4-2', starters: [...of('P').slice(0, 1), ...of('D').slice(0, 4), ...of('C').slice(0, 4), ...of('A').slice(0, 2)], bench: [], captainId: null, viceCaptainId: null }; };
    (s.tables.lineups ||= []).push({ league_id: lega, member_id: 'm_bruno', matchday: n - 1, lineup: undici('m_bruno'), submitted_at: ora });
    (s.tables.formazioni_bozze ||= []).push({ league_id: lega, member_id: 'm_bruno', matchday: n, lineup: undici('m_bruno'), updated_at: ora });
    (s.tables.matchday_locks ||= []).forEach((k) => { if (k.matchday === n) k.lock_at = new Date(Date.now() + 86400000).toISOString(); });
    localStorage.setItem('fcs:mock', JSON.stringify(s));
  }, n);
  await p.reload({ waitUntil: 'load' }); await w(1800);

  // ---- chi prepara la formazione lascia la bozza
  const bozze = () => p.evaluate(() => (JSON.parse(localStorage.getItem('fcs:mock')).tables.formazioni_bozze || []).filter((x) => !String(x.member_id).startsWith('m_')).length);
  await p.evaluate(() => { location.hash = '#/rosa/formazione'; }); await w(2500);
  et(await bozze() === 0, 'aprire la formazione senza cambiare niente non lascia una bozza');
  const modulo = await p.$('[data-mod="3-4-3"]') || await p.$('[data-mod]:not(.on)');
  if (modulo) { await modulo.click(); await w(2200); }
  et(await bozze() === 1, 'cambiare la formazione lascia la bozza sul server, senza toccare «Conferma»');

  // ---- Console, scheda Consegne
  await p.evaluate(() => { location.hash = '#/admin/console'; }); await w(1200);
  await p.evaluate(() => [...document.querySelectorAll('[data-atab]')].find((x) => x.dataset.atab === 'formazioni')?.click()); await w(1500);
  const testo = await p.evaluate(() => document.querySelector('main')?.innerText || '');
  et(new RegExp(`Formazioni · ${n}ª giornata`, 'i').test(testo), `la scheda dice la giornata (${n}ª)`);
  et(/Bruno United[\s\S]*Preparata[\s\S]*non confermata/i.test(testo), 'Bruno: preparata e non confermata');
  et(/Carla United[\s\S]*Niente[\s\S]*non ha mai consegnato/i.test(testo), 'Carla: niente, e non ha mai consegnato');
  et(await p.$('[data-form-conf$="m_bruno|bozza"]') !== null, 'per Bruno c\'è «Conferma per lui»');
  et(await p.$(`[data-form-conf$="m_bruno|ultima"]`) !== null, `e «Come la ${n - 1}ª»`);
  et(await p.$('[data-form-conf*="m_carla"]') === null, 'per Carla nessun tasto: non c\'è niente da consegnare');

  if (process.env.SCATTO) await p.screenshot({ path: process.env.SCATTO, fullPage: true });
  await p.click('[data-form-conf$="m_bruno|bozza"]'); await w(1500);
  const consegnata = await p.evaluate((n) => (JSON.parse(localStorage.getItem('fcs:mock')).tables.lineups || []).some((x) => x.member_id === 'm_bruno' && x.matchday === n), n);
  et(consegnata, 'confermata dall\'amministratore: la formazione di Bruno risulta consegnata');
  const dopo = await p.evaluate(() => document.querySelector('main')?.innerText || '');
  et(!/Bruno United/.test(dopo), 'e Bruno sparisce dalle squadre da sistemare');
  await p.click('[data-form-filtro="tutte"]'); await w(500);
  et(/Bruno United[\s\S]*Consegnata/i.test(await p.evaluate(() => document.querySelector('main')?.innerText || '')), 'in «Tutte» compare come consegnata');

  et(!errori.length, `nessun errore in pagina${errori.length ? ': ' + errori.join(' | ') : ''}`);
  await b.close();
  ok.forEach((t) => console.log('  ok ', t)); ko.forEach((t) => console.log('  KO ', t));
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
