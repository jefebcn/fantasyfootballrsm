/**
 * La console di chi amministra l'app, e la porta che la chiude agli altri.
 *
 * Tre ruoli diversi e non vanno confusi: chi amministra l'APP (apre le leghe
 * pubbliche, nomina gli altri, guarda i numeri), il Giudice Dati (i referti
 * del campionato) e chi amministra UNA lega. Qui si prova il primo.
 *
 * La cosa che conta di piu' e' la porta: un utente normale non deve vedere
 * niente, non deve poter aprire una lega pubblica e non deve potersi
 * promuovere.
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
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, theme: 'dark' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  const p = await ctx.newPage(); p.on('dialog', d => d.accept());
  const errori = []; p.on('pageerror', e => errori.push(e.message));
  const w = (ms = 450) => p.waitForTimeout(ms);
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await w(250);
  await p.fill('#email', 'a@e.it'); await p.fill('#name', 'Conti25'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1200);

  // ---- da utente normale: niente console e niente lega pubblica
  const prima = await p.evaluate(() => ({
    pubblica: !!document.querySelector('[data-form="pubblica"]'),
    testo: document.body.innerText,
  }));
  et(!prima.pubblica, 'un utente normale non vede la scheda "Crea una lega pubblica"');
  await p.evaluate(() => { location.hash = '#/admin/console'; }); await w(1100);
  const chiusa = await p.evaluate(() => ({
    numeri: !!document.querySelector('.adm-numeri'),
    testo: document.querySelector('.empty')?.innerText.replace(/\n/g, ' ') || '',
  }));
  et(!chiusa.numeri, 'e aprendo la console a mano non vede i numeri');
  et(/amministra l'app/i.test(chiusa.testo), `la console lo dice ("${chiusa.testo.slice(0, 60)}")`);
  et(/non da qui|database/i.test(chiusa.testo), 'e spiega che il primo amministratore si nomina dal database');

  // ---- si diventa amministratori come si fa per davvero: dal database
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    s.tables.profiles.find((x) => x.id === s.userId).is_admin = true;
    s.tables.profiles.push({ id: 'u_tizio', display_name: 'Tizio', email: 'tizio@example.org', is_judge: false, is_admin: false, created_at: new Date().toISOString() });
    // una lega altrui: chi amministra deve vederla anche non facendone parte
    // le tabelle esistono solo se qualcuno le ha toccate: questo utente non ha
    // ancora leghe, quindi vanno create qui
    (s.tables.leagues ||= []).push({ id: 'l_altrui', name: 'Lega di Tizio', short_name: 'LDT', invite_code: 'ABCDEF',
      rules: {}, created_by: 'u_tizio', created_at: new Date().toISOString(), started: false, pubblica: false });
    (s.tables.league_members ||= []).push({ id: 'm_tizio', league_id: 'l_altrui', user_id: 'u_tizio', role: 'admin',
      team_name: 'Squadra di Tizio', owner_name: 'Tizio', color: '#1B84C6', initials: 'ST', credits: 500, created_at: new Date().toISOString() });
    localStorage.setItem('fcs:mock', JSON.stringify(s));
  });
  await p.evaluate(() => { location.hash = '#/admin/console'; });
  await p.reload({ waitUntil: 'load' }); await w(2000);

  const num = await p.evaluate(() => ({
    schede: document.querySelectorAll('.adm-numeri .adm-n').length,
    testo: document.body.innerText.replace(/\n/g, ' '),
    tab: [...document.querySelectorAll('[data-atab]')].map((x) => x.innerText.trim()),
  }));
  et(num.schede >= 6, `da amministratore la console mostra i numeri (${num.schede} riquadri)`);
  // Cinque da quando c'e' lo spazio dello sponsor (017): il numero e' qui
  // perche' una scheda che sparisce senza che nessuno se ne accorga e' un
  // pezzo di console che smette di esistere.
  et(num.tab.length === 5 && /Sponsor/.test(num.tab.join(' ')), `con cinque schede (${num.tab.join(', ')})`);
  // Le etichette escono in maiuscolo: il CSS ha text-transform e innerText
  // restituisce il testo RESO. Confronto senza distinguere le maiuscole.
  et(/iscritti/i.test(num.testo) && /leghe/i.test(num.testo), 'fra cui iscritti e leghe');
  // l'andamento delle iscrizioni: quattordici colonne, e quella di oggi piena
  const graf = await p.evaluate(() => {
    const col = [...document.querySelectorAll('.adm-graf.iscrizioni .col')];
    const alte = col.map((c) => parseFloat(getComputedStyle(c.querySelector('i')).height));
    return { quante: col.length, ultima: alte[alte.length - 1] || 0, max: Math.max(0, ...alte) };
  });
  et(graf.quante === 14, `e l'andamento delle iscrizioni a quattordici giorni (${graf.quante} colonne)`);
  et(graf.ultima > 2, `con la colonna di oggi piena (${graf.ultima}px): gli iscritti di prova sono di oggi`);

  // ---- CHI CONSEGNA, GIORNATA PER GIORNATA (020)
  // «Formazioni consegnate» e' un totale che sale e basta: dopo dieci giornate
  // dice 900 sia con novanta squadre ogni domenica sia con trecento alla prima
  // e trenta all'ultima. Qui si guarda che la console mostri la differenza.
  //
  // Le giornate NON si inventano: il calendario vero viene riallineato a ogni
  // apertura, quindi le righe scritte a mano sparirebbero. Si prendono le due
  // piu' recenti gia' chiuse, e la prima ancora aperta per la prova al
  // contrario.
  const gio = await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    const ora = Date.now();
    const chiuse = (s.tables.matchday_locks || []).filter((l) => new Date(l.lock_at) <= ora)
      .sort((a, b) => a.matchday - b.matchday).map((l) => l.matchday);
    const aperta = (s.tables.matchday_locks || []).filter((l) => new Date(l.lock_at) > ora)
      .sort((a, b) => a.matchday - b.matchday)[0]?.matchday || null;
    return { penultima: chiuse[chiuse.length - 2], ultima: chiuse[chiuse.length - 1], aperta, quante: chiuse.length };
  });
  et(gio.ultima && gio.aperta, `il calendario ha giornate chiuse (${gio.quante}) e una ancora aperta (${gio.aperta})`);
  await p.evaluate((g) => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    const fa = (gg) => new Date(Date.now() - gg * 86400000).toISOString();
    // due squadre iscritte da un mese, una arrivata oggi
    for (const m of (s.tables.league_members ||= [])) m.created_at = fa(40);
    s.tables.league_members.push({ id: 'm_vecchia', league_id: 'l_altrui', user_id: 'u_tizio', role: 'fantallenatore',
      team_name: 'Da Sempre FC', color: '#555', initials: 'DS', credits: 500, created_at: fa(40) });
    s.tables.league_members.push({ id: 'm_tardi', league_id: 'l_altrui', user_id: 'u_tizio', role: 'fantallenatore',
      team_name: 'Arrivata Oggi FC', color: '#888', initials: 'AO', credits: 500, created_at: new Date().toISOString() });
    // alla penultima consegnano in due, all'ultima uno solo: il calo che il
    // totale nasconde. E una formazione sulla giornata ancora aperta, che non
    // deve comparire.
    s.tables.lineups = [
      { league_id: 'l_altrui', member_id: 'm_tizio', matchday: g.penultima, lineup: {} },
      { league_id: 'l_altrui', member_id: 'm_vecchia', matchday: g.penultima, lineup: {} },
      { league_id: 'l_altrui', member_id: 'm_tizio', matchday: g.ultima, lineup: {} },
      { league_id: 'l_altrui', member_id: 'm_tizio', matchday: g.aperta, lineup: {} },
    ];
    localStorage.setItem('fcs:mock', JSON.stringify(s));
  }, gio);
  await p.reload({ waitUntil: 'load' }); await w(2000);
  const cons = await p.evaluate(() => {
    const g = document.querySelector('.adm-graf.consegne');
    const col = g ? [...g.querySelectorAll('.col')] : [];
    return { etichette: col.map((c) => c.querySelector('small')?.textContent.trim()),
      valori: col.map((c) => c.querySelector('b')?.textContent.trim() || '0'),
      riga: g?.nextElementSibling?.innerText.replace(/\s+/g, ' ').trim() || '' };
  });
  const dove = cons.etichette.indexOf(String(gio.ultima));
  et(dove >= 0, `la serie mostra l'ultima giornata chiusa, la ${gio.ultima}ª (${cons.etichette.join(',')})`);
  et(!cons.etichette.includes(String(gio.aperta)), `e non la ${gio.aperta}ª, ancora aperta: li' si consegna ancora`);
  et(cons.valori[dove] === '1' && cons.valori[dove - 1] === '2',
    `col calo che il totale nascondeva: 2 alla ${gio.penultima}ª e 1 alla ${gio.ultima}ª (${cons.valori.join(',')})`);
  et(/consegnato/.test(cons.riga), `sotto c'è la lettura a parole ("${cons.riga.slice(0, 70)}…")`);
  et(!/\b1 squadre\b/.test(cons.riga), `e al singolare dice "1 squadra", non "1 squadre" ("${cons.riga.slice(0, 55)}…")`);
  // il denominatore e' quello di allora: la squadra iscritta oggi non gonfia
  // le giornate gia' chiuse
  et(/su 2 /.test(cons.riga), `e il denominatore è di allora, non di oggi ("${cons.riga.slice(0, 95)}")`);
  et(/sponsor/i.test(cons.riga), 'e dice a cosa serve quel numero: è quello che si porta a uno sponsor');

  // ---- persone: e-mail, ultimo accesso, e i poteri si danno
  await p.evaluate(() => { const x = [...document.querySelectorAll('[data-atab]')].find((e) => /persone/i.test(e.textContent)); x.click(); }); await w(1200);
  const gente = await p.evaluate(() => ({
    righe: document.querySelectorAll('.adm-u').length,
    testo: document.body.innerText,
    reset: !!document.querySelector('[data-reset]'),
  }));
  et(gente.righe >= 2, `l'elenco delle persone c'è (${gente.righe})`);
  et(/tizio@example\.org/.test(gente.testo), 'con l\'e-mail, che serve a rispondere a chi non riesce a entrare');
  et(/ultimo accesso/.test(gente.testo), 'e l\'ultimo accesso');
  et(gente.reset, 'col tasto per mandare il link della password');
  et(/non la può leggere né scrivere nessuno/.test(gente.testo), 'e dice chiaro che la password non si legge né si scrive');

  // nominare un Giudice Dati
  await p.evaluate(() => { const x = [...document.querySelectorAll('[data-ruolo]')].find((e) => /Fai giudice/i.test(e.textContent)); x.click(); }); await w(1500);
  const nominato = await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    return s.tables.profiles.filter((x) => x.is_judge).length;
  });
  et(nominato >= 1, `da qui si nomina un Giudice Dati (${nominato})`);

  // togliersi l'amministrazione da soli: non si puo'
  const errPrima = errori.length;
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    window.__io = s.userId;
  });
  await p.evaluate(() => { const x = [...document.querySelectorAll('[data-ruolo]')].find((e) => e.dataset.ruolo === `is_admin:${window.__io}:off`); if (x) x.click(); }); await w(1500);
  const ancoraAdmin = await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    return !!s.tables.profiles.find((x) => x.id === s.userId)?.is_admin;
  });
  et(ancoraAdmin, 'non si toglie l\'amministrazione a se stessi: si resterebbe chiusi fuori');

  // ---- MODERAZIONE (015): rinominare quello che si vede, fermare chi lo scrive
  await p.evaluate(() => { const x = [...document.querySelectorAll('[data-atab]')].find((e) => /squadre/i.test(e.textContent)); x.click(); }); await w(1200);
  const sq = await p.evaluate(() => ({
    righe: document.querySelectorAll('.adm-u').length,
    testo: document.body.innerText.replace(/\n/g, ' '),
    rinomina: !!document.querySelector('[data-rinomina]'),
  }));
  et(sq.righe >= 1, `la scheda delle squadre elenca le squadre di tutti (${sq.righe})`);
  et(/Squadra di Tizio/.test(sq.testo), 'comprese quelle delle leghe di cui non fa parte');
  et(sq.rinomina, 'con il tasto per rinominare');

  // il nome nuovo arriva dal prompt: il gestore generale lo accetterebbe
  // vuoto, e un nome vuoto viene (giustamente) rifiutato
  p.removeAllListeners('dialog');
  p.on('dialog', (d) => d.accept(d.type() === 'prompt' ? 'Nome Pulito FC' : ''));
  // si cerca il bottone per id della squadra e non per nome: se la rinomina
  // NON funzionasse, cercare per nome farebbe scoppiare la prova invece di
  // segnare il controllo fallito
  await p.click('[data-rinomina="m_tizio"]'); await w(1500);
  const dopoNome = await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    const m = s.tables.league_members.find((x) => x.id === 'm_tizio');
    return { squadra: m.team_name, iniziali: m.initials, schermo: document.body.innerText };
  });
  et(dopoNome.squadra === 'Nome Pulito FC', `rinomina la squadra altrui (${dopoNome.squadra})`);
  et(dopoNome.iniziali === 'NPF', `e ricalcola le iniziali dello stemma (${dopoNome.iniziali})`);
  et(/Nome Pulito FC/.test(dopoNome.schermo), 'e l\'elenco lo mostra subito');

  // sospendere
  await p.click('[data-sosp="u_tizio:on"]'); await w(1500);
  const dopoSosp = await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    return { sospeso: !!s.tables.profiles.find((x) => x.id === 'u_tizio').sospeso, schermo: document.body.innerText };
  });
  et(dopoSosp.sospeso, 'e sospende chi l\'aveva scritto');
  et(/sospeso/i.test(dopoSosp.schermo), 'segnandolo nell\'elenco');

  // e da sospeso l'app si chiude: si entra come lui e si guarda
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    s.userId = 'u_tizio'; localStorage.setItem('fcs:mock', JSON.stringify(s));
  });
  await p.evaluate(() => { location.hash = '#/'; });
  await p.reload({ waitUntil: 'load' }); await w(2000);
  const daSospeso = await p.evaluate(() => ({
    dove: location.hash,
    testo: document.body.innerText.replace(/\n/g, ' '),
    impostazioni: !!document.querySelector('a[href="#/impostazioni"]'),
  }));
  et(/sospeso/i.test(daSospeso.dove) || /Account sospeso/i.test(daSospeso.testo),
    `chi e' sospeso trova la schermata che glielo dice (${daSospeso.dove})`);
  et(/non puoi schierare/i.test(daSospeso.testo), 'e che dice cosa non puo\' fare');
  et(/non vengono cancellati|restano/i.test(daSospeso.testo), 'e cosa gli resta');
  et(daSospeso.impostazioni, 'con le impostazioni ancora aperte: i dati si scaricano e l\'account si cancella');
  // e non si riprende la dashboard scrivendola a mano
  await p.evaluate(() => { location.hash = '#/rosa'; }); await w(1200);
  et(/sospeso/i.test(await p.evaluate(() => location.hash)), 'e scrivendo un altro indirizzo torna li\'');

  // si torna amministratori per il resto della prova. Va ripulita anche la
  // lega corrente: entrando come Tizio l'app si e' ricordata la SUA lega, e
  // chi amministra non ne fa parte — al riavvio il caricamento fallirebbe e
  // l'indirizzo scritto a mano andrebbe perso nella catena dei rimbalzi.
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    s.userId = s.tables.profiles.find((x) => x.is_admin).id;
    localStorage.setItem('fcs:mock', JSON.stringify(s));
    const pr = JSON.parse(localStorage.getItem('fcs:prefs')); pr.currentLeagueId = null;
    localStorage.setItem('fcs:prefs', JSON.stringify(pr));
  });
  await p.reload({ waitUntil: 'load' }); await w(1600);
  await p.evaluate(() => { location.hash = '#/admin/console'; }); await w(1500);

  // ---- leghe: si vedono tutte, anche quelle di cui non fa parte
  await p.evaluate(() => { const x = [...document.querySelectorAll('[data-atab]')].find((e) => /leghe/i.test(e.textContent)); x.click(); }); await w(1200);
  const lg = await p.evaluate(() => ({ righe: document.querySelectorAll('.adm-u').length, testo: document.body.innerText }));
  et(lg.righe >= 1, `la scheda delle leghe mostra anche quelle altrui (${lg.righe})`);
  et(/Lega di Tizio/.test(lg.testo), 'con nome e creatore');
  et(/privata/i.test(lg.testo), 'e dice se è privata o pubblica');

  // ---- e adesso la lega pubblica si puo' creare
  await p.evaluate(() => { location.hash = '#/leghe'; }); await w(1300);
  et(await p.evaluate(() => !!document.querySelector('[data-form="pubblica"]')),
    'da amministratore compare la scheda "Crea una lega pubblica"');
  et(errori.length === errPrima, `nessun errore JS${errori.length ? ' — ' + errori[errori.length - 1] : ''}`);

  await b.close();
  for (const t of ok) console.log('  ok  ' + t);
  for (const t of ko) console.log('  KO  ' + t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
