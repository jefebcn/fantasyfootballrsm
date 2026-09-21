/**
 * La lega pubblica, dal creare al giocare.
 *
 * Tre cose che una lega fra amici non ha, e che qui si provano nell'ordine in
 * cui le incontra chi arriva: si crea senza codice, ci si entra dall'elenco,
 * e la classifica e' la somma dei fantapunti con i premi in cima.
 *
 * La quarta, quella che regge tutto il resto, e' che i giocatori non sono
 * esclusivi: si controlla che a un secondo iscritto l'elenco dei giocatori
 * resti intero anche dopo che il primo ha fatto la sua rosa.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

// Il secondo utente eredita le TABELLE del primo (la lega esiste gia') ma non
// chi era collegato: senza azzerare userId l'app si ritrova dentro come il
// primo e la schermata d'accesso non compare nemmeno.
const prepara = (ctx, stato) => ctx.addInitScript((stato) => {
  window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
  localStorage.setItem('fcs:auth', 'supabase');
  localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, theme: 'system' }));
  localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  if (stato) {
    const s = JSON.parse(stato); s.userId = null;
    localStorage.setItem('fcs:mock', JSON.stringify(s));
  }
}, stato);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const w = (p, ms = 450) => p.waitForTimeout(ms);
  const errori = [];

  // ---- primo utente: crea la lega pubblica
  let ctx = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await prepara(ctx, null);
  let p = await ctx.newPage(); p.on('dialog', d => d.accept()); p.on('pageerror', e => errori.push('1: ' + e.message));
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(p, 1300);
  await p.click('[data-tab="up"]'); await w(p, 250);
  await p.fill('#email', 'uno@e.it'); await p.fill('#name', 'Uno'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(p, 1000);

  // La lega pubblica la apre solo chi amministra l'app (014). Il primo
  // amministratore si nomina dal database, come il Giudice Dati: qui si fa
  // quello, che e' il percorso vero e non una scorciatoia della prova.
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    s.tables.profiles.find((x) => x.id === s.userId).is_admin = true;
    localStorage.setItem('fcs:mock', JSON.stringify(s));
  });
  await p.reload({ waitUntil: 'load' }); await w(p, 1600);
  await p.click('[data-form="pubblica"]'); await w(p, 500);
  const modulo = await p.evaluate(() => !!document.querySelector('#pname') && !!document.querySelector('#pbudget') && !!document.querySelector('#pmax') && !!document.querySelector('#ppremio'));
  et(modulo, 'il modulo della lega pubblica chiede nome, crediti, massimo e premio');
  await p.fill('#pname', 'Titano Open'); await p.fill('#pbudget', '300'); await p.fill('#pmax', '50');
  await p.fill('#ppremio', 'Una cena offerta'); await p.fill('#team', 'Squadra Uno');
  await p.click('#go-pubblica'); await w(p, 1600);
  const dopoCrea = await p.evaluate(() => ({ hash: location.hash, lega: JSON.parse(localStorage.getItem('fcs:mock')).tables.leagues[0] }));
  et(dopoCrea.lega?.pubblica === true && dopoCrea.lega?.classifica === 'punti', `nasce pubblica e a punti (${dopoCrea.lega?.classifica})`);
  et(dopoCrea.lega?.rules?.budget === 300 && dopoCrea.lega?.max_membri === 50, `crediti 300 e massimo 50 (${dopoCrea.lega?.rules?.budget}/${dopoCrea.lega?.max_membri})`);
  et((dopoCrea.lega?.premi || []).length === 1 && dopoCrea.lega.premi[0].premio === 'Una cena offerta', 'il premio del primo posto è salvato');

  // il menu dice che è pubblica e porta alla propria rosa
  await p.evaluate(() => { location.hash = '#/'; }); await w(p, 800);
  await p.click('[data-open-drawer]'); await w(p, 600);
  const menu = await p.evaluate(() => ({ testo: document.querySelector('.a-drawer .panel')?.innerText || '', rosa: !!document.querySelector('.a-drawer a[href="#/negozio"]') }));
  et(menu.rosa, 'nel menu c\'è "La tua rosa"');
  et(/Premi in palio/.test(menu.testo), 'e per l\'amministratore la voce dei premi');
  await p.evaluate(() => { document.querySelector('.a-drawer .scrim')?.click(); }); await w(p, 300);

  // ---- la propria rosa: si compra da soli, dal negozio
  //
  // L'asta qui non c'e' piu': in una lega aperta i giocatori non sono
  // esclusivi, quindi non c'e' niente da contendersi. Chi arriva su #/asta
  // per un vecchio collegamento trova la strada, non un vicolo cieco.
  await p.evaluate(() => { location.hash = '#/asta'; }); await w(p, 1000);
  const dirotta = await p.evaluate(() => ({
    testo: document.body.innerText,
    verso: document.querySelector('a[href="#/negozio"]')?.getAttribute('href') || '',
  }));
  et(dirotta.verso === '#/negozio', `da #/asta si viene mandati al negozio (${dirotta.verso || 'da nessuna parte'})`);
  et(/non c'è l'asta|non sono esclusivi|rosa te la fai/i.test(dirotta.testo), 'spiegando perché qui l\'asta non serve');

  // Il listino, come in produzione (supabase/seed-quotazioni.sql).
  await p.evaluate(async () => {
    const S = await import('/src/state.js');
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    s.tables.quotazioni = S.base.players.map((g) => ({ player_id: g.id, ruolo: g.role, quotazione: g.quotation, nome: g.name }));
    s.tables.matchday_locks = S.base.matchdays.map((md) => ({ matchday: md.number, lock_at: new Date(md.lockAt).toISOString() }));
    localStorage.setItem('fcs:mock', JSON.stringify(s));
  });
  await p.reload({ waitUntil: 'load' }); await w(p, 1600);
  await p.evaluate(() => { location.hash = '#/negozio'; }); await w(p, 1200);
  const primoId = await p.evaluate(() => document.querySelector('[data-compra]:not([disabled])')?.dataset.compra || null);
  et(!!primoId, 'nel negozio ci sono giocatori da comprare');
  await p.click(`[data-compra="${primoId}"]`); await w(p, 1400);
  const comprato = await p.evaluate((pid) => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    return { mio: (s.tables.rosters || []).some((r) => r.player_id === pid),
      crediti: s.tables.league_members[0].credits };
  }, primoId);
  et(comprato.mio, 'il giocatore entra nella mia rosa');
  et(comprato.crediti < 300, `i crediti scendono (${comprato.crediti} di 300)`);
  const statoMock = await p.evaluate(() => localStorage.getItem('fcs:mock'));
  await ctx.close();

  // ---- secondo utente: entra dall'elenco, senza codice
  ctx = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await prepara(ctx, statoMock);
  p = await ctx.newPage(); p.on('dialog', d => d.accept()); p.on('pageerror', e => errori.push('2: ' + e.message));
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(p, 1300);
  await p.click('[data-tab="up"]'); await w(p, 250);
  await p.fill('#email', 'due@e.it'); await p.fill('#name', 'Due'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(p, 1300);

  const elenco = await p.evaluate(() => ({
    testo: document.body.innerText,
    bottone: !!document.querySelector('[data-pubblica]'),
    riga: document.querySelector('[data-pubblica]')?.innerText || '',
  }));
  et(elenco.bottone, 'la lega pubblica compare nell\'elenco a chi non c\'è dentro');
  et(/Titano Open/.test(elenco.testo) && /Una cena offerta/.test(elenco.riga), `e mostra nome, squadre e premio ("${elenco.riga.replace(/\n/g, ' ').slice(0, 80)}")`);
  et(!/codice/i.test(elenco.riga), 'senza chiedere un codice');

  await p.click('[data-pubblica]'); await w(p, 500);
  await p.fill('#team', 'Squadra Due');
  await p.click('#go-entra'); await w(p, 1800);
  const dentro = await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    return { membri: s.tables.league_members.length, crediti: s.tables.league_members[1]?.credits, hash: location.hash };
  });
  et(dentro.membri === 2, `il secondo è dentro (${dentro.membri} squadre)`);
  et(dentro.crediti === 300, `e parte coi crediti della lega (${dentro.crediti})`);

  // LA COSA CHE REGGE TUTTO: il giocatore preso dal primo è ancora disponibile
  await p.evaluate(() => { location.hash = '#/negozio'; }); await w(p, 1300);
  const ancora = await p.evaluate((pid) => ({
    presente: !!document.querySelector(`[data-compra="${pid}"]`),
    quanti: document.querySelectorAll('[data-compra]').length,
  }), primoId);
  et(ancora.presente, 'il giocatore già preso dal primo resta disponibile per il secondo');

  // ---- la classifica: a punti, coi premi
  await p.evaluate(() => { location.hash = '#/classifica'; }); await w(p, 1100);
  const cls = await p.evaluate(() => ({ testo: document.body.innerText, incontri: !!document.querySelector('[data-vista="giornata"]'), premi: !!document.querySelector('.premi') }));
  et(!cls.incontri, 'la classifica non offre la scheda "Giornata": non ci sono incontri');
  // I premi sono il motivo per cui uno entra: si devono vedere PRIMA che la
  // classifica esista, non dopo la prima giornata.
  et(cls.premi && /Una cena offerta/.test(cls.testo), 'i premi si vedono anche a classifica non partita');
  et(/non è ancora partita/.test(cls.testo), 'e non finge di sapere chi sta vincendo');
  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
  await ctx.close();
  await b.close();

  for (const t of ok) console.log('  ok  ' + t);
  for (const t of ko) console.log('  KO  ' + t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
