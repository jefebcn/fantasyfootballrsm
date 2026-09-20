/**
 * I referti della FSGC entrano in lega da soli, e una sola volta.
 *
 * Il risultato di una partita di campionato e i voti dei giocatori sono due
 * cose diverse: il risultato arriva dall'import dentro il calendario, i voti
 * nascono dagli eventi scritti nel database. Finche' gli eventi non ci sono,
 * una gara finita in lega non ha voti — ed e' quello che si vedeva sabato
 * mattina: partite giocate e nessun voto.
 *
 * Prima quel passo era un bottone in Impostazioni, da premere a mano e UNA
 * VOLTA SOLA: gli eventi si inseriscono e non si aggiornano, quindi la
 * seconda premuta avrebbe duplicato tutto e ogni gol sarebbe valso doppio.
 *
 * Qui si prova la regola nuova: all'apertura del Giudice Dati le giornate col
 * referto entrano da sole, quelle gia' in lega non si toccano, e riaprire
 * l'app non aggiunge una riga.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

const conta = (p) => p.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('fcs:mock'));
  const per = {};
  for (const e of s.tables.match_events || []) {
    const n = +((e.match_id || '').match(/^md(\d+)/) || [])[1];
    per[n] = (per[n] || 0) + 1;
  }
  return { totale: (s.tables.match_events || []).length, presenze: (s.tables.match_appearances || []).length, per };
});

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    localStorage.setItem('fcs:auth', 'supabase');
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, theme: 'system' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  const p = await ctx.newPage(); p.on('dialog', (d) => d.accept());
  const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  // Gli errori che l'app gia' prende (rete, database) non arrivano a
  // 'pageerror': finiscono in console e in un avviso a schermo. Per sapere se
  // il Giudice si becca un errore in faccia bisogna guardare li'.
  // (le lamentele della rete non contano: qui interessa solo quella della
  //  giornata congelata, che e' l'errore che si prenderebbe il Giudice)
  const lamentele = []; p.on('console', (m) => { if (m.type() === 'error' && /congelat/i.test(m.text())) lamentele.push(m.text()); });
  const w = (ms = 450) => p.waitForTimeout(ms);
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await w(250);
  await p.fill('#email', 'a@e.it'); await p.fill('#name', 'Conti25'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1000);
  await p.click('[data-form="create"]'); await w(250);
  await p.fill('#lname', 'Torneo Titano'); await p.fill('#team', 'Hasta El Roxy'); await p.click('#go-create'); await w(1400);

  // Nel mock il primo iscritto e' il Giudice Dati, come sul vero database si
  // fa a mano: quindi appena la lega esiste il caricamento e' gia' successo.
  const primo = await conta(p);
  et(primo.totale > 100, `all'apertura del Giudice i referti entrano da soli (${primo.totale} eventi, ${primo.presenze} presenze)`);
  et(primo.per[1] > 10, `la 1ª giornata e' dentro per intero (${primo.per[1] || 0} eventi)`);
  et(primo.per[4] > 10, `e la 4ª, appena giocata, entra con la sua (${primo.per[4] || 0} eventi)`);

  // Riaprire non deve aggiungere niente: e' la premuta due volte del vecchio
  // bottone, quella che avrebbe fatto contare i gol doppi.
  await p.reload({ waitUntil: 'load' }); await w(2600);
  const secondo = await conta(p);
  et(secondo.totale === primo.totale && secondo.presenze === primo.presenze,
    `riaprire l'app non duplica niente (${secondo.totale} eventi, ${secondo.presenze} presenze)`);

  // UNA PARTITA TOCCATA A MANO NON SI TOCCA, LE ALTRE DELLA SUA GIORNATA SI'.
  //
  // Qui stava il guasto vero: la regola guardava la GIORNATA intera — "se in
  // lega ha gia' qualcosa non la tocco" — ma una giornata arriva a pezzi, il
  // venerdi' sera tre partite e il sabato altre tre. Con la giornata gia'
  // "sporca" delle prime, le altre non entravano piu': sullo schermo "FOLGORE
  // 2 - 0 SM ACADEMY · Voti in arrivo" per sempre.
  //
  // Si svuota la 3ª e ci si lascia dentro un solo evento su una partita sola,
  // come se ce l'avesse messo il Giudice.
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    const suaGiornata = (r) => /^md3_/.test(r.match_id);
    s.tables.match_events = s.tables.match_events.filter((r) => !suaGiornata(r));
    s.tables.match_appearances = s.tables.match_appearances.filter((r) => !suaGiornata(r));
    s.tables.match_events.push({ id: 'ev_mano', match_id: 'md3_m1', player_id: 'academy_10', club_id: 'academy', minute: 72, type: 'yellow', created_by: s.userId });
    localStorage.setItem('fcs:mock', JSON.stringify(s));
  });
  await p.reload({ waitUntil: 'load' }); await w(2600);
  const terzo = await conta(p);
  const perGara = await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    const o = {};
    for (const e of s.tables.match_events) if (/^md3_/.test(e.match_id)) o[e.match_id] = (o[e.match_id] || 0) + 1;
    return o;
  });
  et(perGara.md3_m1 === 1, `la partita toccata dal Giudice resta com'è (md3_m1: ${perGara.md3_m1 || 0} eventi)`);
  et(Object.keys(perGara).length > 1 && terzo.per[3] > 1,
    `ma le altre partite della stessa giornata entrano lo stesso (${Object.keys(perGara).length} partite, ${terzo.per[3] || 0} eventi)`);

  // UNA GIORNATA VUOTA INVECE SI RICARICA: senza questo il controllo di sopra
  // sarebbe vero anche se il caricamento non funzionasse piu'.
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    s.tables.match_events = s.tables.match_events.filter((r) => !/^md1_/.test(r.match_id));
    s.tables.match_appearances = s.tables.match_appearances.filter((r) => !/^md1_/.test(r.match_id));
    localStorage.setItem('fcs:mock', JSON.stringify(s));
  });
  await p.reload({ waitUntil: 'load' }); await w(2600);
  const quarto = await conta(p);
  et(quarto.per[1] === primo.per[1], `una giornata svuotata torna dentro per intero (1ª: ${quarto.per[1] || 0}, attesi ${primo.per[1]})`);
  et(quarto.per[3] === terzo.per[3], `e la 3ª resta com'era (${quarto.per[3] || 0})`);

  // UNA GIORNATA CONGELATA non si tocca: e' chiusa per sempre (art. 9.2) e il
  // database rifiuta di scriverci. Senza questo controllo il Giudice si
  // sarebbe preso un errore in faccia a ogni apertura.
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    s.tables.match_events = s.tables.match_events.filter((r) => !/^md1_/.test(r.match_id));
    s.tables.match_appearances = s.tables.match_appearances.filter((r) => !/^md1_/.test(r.match_id));
    (s.tables.matchday_status ||= []).push({ matchday: 1, status: 'frozen' });
    localStorage.setItem('fcs:mock', JSON.stringify(s));
  });
  const primaDelGelo = errori.length, lamentelePrima = lamentele.length;
  await p.reload({ waitUntil: 'load' }); await w(2600);
  const gelata = await conta(p);
  et(!gelata.per[1], `una giornata congelata non si prova nemmeno a caricarla (1ª: ${gelata.per[1] || 0} eventi)`);
  et(errori.length === primaDelGelo && lamentele.length === lamentelePrima,
    `e non prende un errore in faccia (${lamentele.slice(lamentelePrima)[0] || 'nessun errore sulla giornata congelata'})`);
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    s.tables.matchday_status = s.tables.matchday_status.filter((r) => r.matchday !== 1);
    localStorage.setItem('fcs:mock', JSON.stringify(s));
  });
  await p.reload({ waitUntil: 'load' }); await w(2600);
  const scongelata = await conta(p);
  et(scongelata.per[1] === primo.per[1], `e appena si scongela rientra (1ª: ${scongelata.per[1] || 0})`);

  // E i voti adesso ci sono davvero: la schermata Voti della 1ª ha le righe.
  await p.evaluate(() => { location.hash = '#/voti/1'; }); await w(1200);
  const voti = await p.evaluate(() => {
    const righe = [...document.querySelectorAll('.vlist .vr')];
    const numeri = righe.map((r) => r.querySelector('.fv')?.innerText.trim()).filter(Boolean);
    return { righe: righe.length, numeri: numeri.slice(0, 3), testo: document.body.innerText.slice(0, 120).replace(/\n/g, ' ') };
  });
  et(voti.righe > 20, `la 1ª giornata ha i suoi voti sullo schermo (${voti.righe} righe)`);
  et(voti.numeri.some((n) => /\d/.test(n)), `e sono numeri (${voti.numeri.join(', ')})`);

  // La 4ª: gare finite, voti caricati, niente piu' "Voti in arrivo".
  await p.evaluate(() => { location.hash = '#/voti/4'; }); await w(1200);
  const quarta = await p.evaluate(() => ({
    righe: document.querySelectorAll('.vlist .vr').length,
    inArrivo: [...document.querySelectorAll('.vnota')].filter((x) => /Voti in arrivo/.test(x.innerText)).length,
  }));
  et(quarta.righe > 20, `anche la 4ª ha i voti delle gare giocate (${quarta.righe} righe)`);
  et(quarta.inArrivo === 0, `e nessuna gara resta con "Voti in arrivo" (${quarta.inArrivo})`);

  // CHI NON E' GIUDICE DATI NON SCRIVE. Sul database vero lo impediscono le
  // regole della tabella; qui si prova che l'app non ci prova nemmeno.
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    s.tables.profiles.find((x) => x.id === s.userId).is_judge = false;
    s.tables.match_events = s.tables.match_events.filter((r) => !/^md3_/.test(r.match_id));
    s.tables.match_appearances = s.tables.match_appearances.filter((r) => !/^md3_/.test(r.match_id));
    localStorage.setItem('fcs:mock', JSON.stringify(s));
  });
  await p.reload({ waitUntil: 'load' }); await w(2600);
  const quinto = await conta(p);
  et(!quinto.per[3], `chi non e' Giudice Dati non carica niente (3ª: ${quinto.per[3] || 0} eventi)`);

  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
  await b.close();
  for (const t of ok) console.log('  ok  ' + t);
  for (const t of ko) console.log('  KO  ' + t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
