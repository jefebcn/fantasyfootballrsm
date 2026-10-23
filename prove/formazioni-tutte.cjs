/**
 * LE FORMAZIONI DI TUTTI (#/formazioni). Alex, 23/10: «di solito nei
 * fantacalci è possibile consultare le formazioni di tutti i partecipanti».
 * Qui: dal menu e dalla classifica si arriva alla pagina; per la giornata
 * chiusa ci sono tutte le squadre, con l'undici per ruoli e il capitano; chi
 * non ha consegnato lo dice; la ricerca filtra; toccando si apre sul campo;
 * per la giornata ancora aperta la pagina dice da quando si vedranno.
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
  await p.click('[data-tab="up"]'); await p.fill('#email', 'tutte@e.it'); await p.fill('#name', 'Alex'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1000);
  await p.click('[data-form="create"]'); await p.fill('#lname', 'Lega Prova'); await p.fill('#team', 'Alex FC'); await p.click('#go-create'); await w(1500);

  // nel database finto: la lega nata a settembre, tre squadre con la rosa,
  // Bruno e io con la formazione della giornata prima, Carla senza
  const n = await p.evaluate(async () => (await import('/src/state.js')).giornataDaSchierare());
  await p.evaluate(async (n) => {
    const S = await import('/src/state.js');
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    const lega = s.tables.league_members.find((m) => m.user_id === s.userId).league_id;
    s.tables.leagues.find((l) => l.id === lega).created_at = '2026-09-01T10:00:00Z';
    const mio = s.tables.league_members.find((m) => m.user_id === s.userId).id;
    const ora = new Date().toISOString();
    for (const [id, nome] of [['m_bruno', 'Bruno'], ['m_carla', 'Carla']]) {
      s.tables.profiles.push({ id: `u_${id}`, display_name: nome, created_at: ora });
      s.tables.league_members.push({ id, league_id: lega, user_id: `u_${id}`, role: 'fantallenatore', team_name: `${nome} United`, owner_name: nome, credits: 0, created_at: '2026-09-01T10:00:00Z' });
    }
    const per = (r) => S.base.players.filter((x) => x.role === r && !x.doppioneDi && x.isActive !== false);
    const quanti = { P: 2, D: 6, C: 6, A: 4 }; const rosa = {};
    [mio, 'm_bruno', 'm_carla'].forEach((m, k) => {
      // la prima punta e' la stessa per me e per Bruno: si vede in evidenza
      rosa[m] = Object.entries(quanti).flatMap(([r, q]) => per(r).slice(k * q, (k + 1) * q).map((x) => x.id));
      if (m === 'm_bruno') rosa[m][rosa[m].length - 4] = rosa[mio][rosa[mio].length - 4];
      rosa[m].forEach((pid, i) => (s.tables.rosters ||= []).push({ id: `r_${m}_${i}`, league_id: lega, member_id: m, player_id: pid, price_paid: 1, acquired_at: ora, released_at: null }));
    });
    const undici = (m) => { const r = rosa[m]; const of = (role) => r.filter((id) => S.playersById.get(id).role === role);
      return { formation: '4-4-2', starters: [...of('P').slice(0, 1), ...of('D').slice(0, 4), ...of('C').slice(0, 4), ...of('A').slice(0, 2)], bench: [], captainId: of('A')[0], viceCaptainId: of('C')[0] }; };
    (s.tables.lineups ||= []).push({ league_id: lega, member_id: 'm_bruno', matchday: n - 1, lineup: undici('m_bruno'), submitted_at: ora });
    s.tables.lineups.push({ league_id: lega, member_id: mio, matchday: n - 1, lineup: undici(mio), submitted_at: ora });
    localStorage.setItem('fcs:mock', JSON.stringify(s));
  }, n);
  await p.reload({ waitUntil: 'load' }); await w(1800);

  // ---- ci si arriva dal menu
  await p.click('[data-open-drawer]').catch(() => {}); await w(400);
  et(!!(await p.$('.a-drawer a[href="#/formazioni"]')), 'nel menu c\'è «Formazioni di tutti»');
  await p.evaluate(() => { location.hash = '#/formazioni'; }); await w(1200);
  const testo = await p.evaluate(() => document.querySelector('main')?.innerText || '');
  et(new RegExp(`Giornata ${n - 1}`).test(testo), `si apre sull'ultima giornata chiusa (${n - 1}ª)`);
  et(/2\s+su 3 hanno consegnato/.test(testo), 'dice quanti hanno consegnato: 2 su 3');
  const bruno = await p.evaluate(() => { const c = [...document.querySelectorAll('.fx-sq')].find((x) => /Bruno United/.test(x.innerText)); return c && { righe: c.querySelectorAll('.fx-r').length, nomi: c.querySelectorAll('.fx-r > span > span').length, cap: !!c.querySelector('.fx-c:not(.v)'), anche: c.querySelectorAll('.anche').length, href: c.getAttribute('href') }; });
  et(bruno && bruno.righe === 4 && bruno.nomi === 11, `Bruno: l'undici per ruoli, 11 nomi in 4 righe (${JSON.stringify(bruno)})`);
  et(bruno?.cap, 'con il capitano segnato');
  et(bruno?.anche === 1, 'e in evidenza il giocatore che ho schierato anch\'io');
  et(/Carla United[\s\S]*non consegnata/.test(testo), 'Carla: non consegnata');
  et(new RegExp(`Quelle della ${n}ª si vedono da`).test(testo), `per la ${n}ª, ancora aperta, dice da quando si vedranno`);

  // ---- la ricerca
  if (await p.$('#fx-cerca')) {
    await p.fill('#fx-cerca', 'carla'); await w(200);
    const viste = await p.evaluate(() => [...document.querySelectorAll('.fx-sq')].filter((x) => !x.hidden).length);
    et(viste === 1, 'la ricerca filtra le squadre');
    await p.fill('#fx-cerca', ''); await w(200);
  } else ok.push('(ricerca solo da 7 squadre in su)');

  // ---- toccando si apre sul campo
  await p.click(`.fx-sq[href="${bruno.href}"]`); await w(1000);
  et(await p.evaluate(() => location.hash) === bruno.href, `toccando Bruno si apre la sua formazione (${bruno.href})`);

  // ---- e dalla classifica
  await p.evaluate(() => { location.hash = '#/classifica'; }); await w(1000);
  et(!!(await p.$('a[href="#/formazioni"]')) || !(await p.evaluate(async () => (await import('/src/state.js')).legaPubblica())), 'dalla classifica (lega a punti) c\'è «Le formazioni di tutti»');

  et(!errori.length, `nessun errore in pagina${errori.length ? ': ' + errori.join(' | ') : ''}`);
  await b.close();
  ok.forEach((t) => console.log('  ok ', t)); ko.forEach((t) => console.log('  KO ', t));
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
