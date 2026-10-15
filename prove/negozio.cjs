/**
 * Il negozio della lega aperta: entri, e in dieci tocchi hai la squadra.
 *
 * PERCHE' ESISTE. Chi entra in una lega aperta si trovava dentro senza
 * giocatori e senza un modo per averne: l'asta e' roba da lega privata, e la
 * schermata che ci provava aveva i gestori dei tocchi dietro un "se non
 * amministri la lega, esci". Funzionava per una persona sola.
 *
 * LA COSA CHE SI GUARDA DAVVERO. Il prezzo lo decide il LISTINO, non chi
 * compra: prima il prezzo si scriveva a mano in un campo, e in una lega con
 * un montepremi quel campo e' una cassa aperta. Qui si compra e si controlla
 * che in rosa sia finita la quotazione vera.
 *
 * E i limiti che fanno di un negozio un gioco: le quote per ruolo, i crediti,
 * e la chiusura del mercato quando comincia la prima giornata.
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
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'system' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  const p = await ctx.newPage(); p.on('dialog', (d) => d.accept());
  const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  const w = (ms = 500) => p.waitForTimeout(ms);

  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await w(250);
  await p.fill('#email', 'uno@e.it'); await p.fill('#name', 'Uno'); await p.fill('#password', 'password123');
  await p.click('#primary'); await w(1000);

  // La lega aperta la crea chi amministra l'app (014).
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    s.tables.profiles.find((x) => x.id === s.userId).is_admin = true;
    localStorage.setItem('fcs:mock', JSON.stringify(s));
  });
  await p.reload({ waitUntil: 'load' }); await w(1600);
  await p.click('[data-form="pubblica"]'); await w(500);
  await p.fill('#pname', 'Titano Open'); await p.fill('#pbudget', '300'); await p.fill('#pmax', '50');
  await p.fill('#team', 'Squadra Uno'); await p.click('#go-pubblica'); await w(1600);

  // IL LISTINO E IL CALENDARIO DEI LOCK, come in produzione: il primo lo
  // carica supabase/seed-quotazioni.sql, il secondo la migrazione 012. Qui si
  // riempiono dagli stessi dati dell'app, che e' la sorgente di entrambi.
  await p.evaluate(async () => {
    const S = await import('/src/state.js');
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    s.tables.quotazioni = S.base.players.map((g) => ({ player_id: g.id, ruolo: g.role, quotazione: g.quotation, nome: g.name }));
    s.tables.matchday_locks = S.base.matchdays.map((md) => ({ matchday: md.number, lock_at: new Date(md.lockAt).toISOString() }));
    localStorage.setItem('fcs:mock', JSON.stringify(s));
  });
  await p.reload({ waitUntil: 'load' }); await w(1800);
  // Dopo aver creato la lega si resta sulla schermata della lega: l'invito si
  // guarda in home, che e' dove lo incontra chi apre l'app.
  await p.evaluate(() => { location.hash = '#/'; }); await w(1200);

  // --- l'invito in home: e' la prima cosa che deve vedere chi non ha la rosa
  const invito = await p.evaluate(() => {
    const a = document.querySelector('[data-negozio]'); if (!a) return null;
    const r = a.getBoundingClientRect();
    return { testo: a.innerText.replace(/\n/g, ' · '), href: a.getAttribute('href'), alto: Math.round(r.height), y: Math.round(r.top) };
  });
  et(!!invito, 'in home c\'è l\'invito a costruire la rosa');
  if (invito) {
    et(invito.href === '#/negozio', `porta al negozio (${invito.href})`);
    et(/25/.test(invito.testo) && /300/.test(invito.testo), `e dice quanti ne mancano e quanto hai (${invito.testo})`);
    et(invito.alto >= 56, `è un bottone vero, non una riga (${invito.alto}pt)`);
  }
  // e NON compare piu' il messaggio da lega privata
  const vecchio = await p.evaluate(() => document.body.innerText);
  et(!/Rose non ancora assegnate/.test(vecchio), 'e non dice più "le assegna l\'admin dopo l\'asta", che qui sarebbe falso');

  // --- il negozio
  await p.click('[data-negozio]'); await w(1200);
  const testa = await p.evaluate(() => ({
    crediti: document.querySelector('.neg-num b')?.innerText || '',
    testo: document.querySelector('.neg-testa')?.innerText.replace(/\n/g, ' ') || '',
    quando: document.querySelector('.neg-quando')?.innerText || '',
    bottoni: document.querySelectorAll('[data-compra]').length,
  }));
  et(testa.crediti === '300', `la testata mostra i crediti (${testa.crediti})`);
  et(/0\/25|0\s*\/\s*25/.test(testa.testo.replace(/\s/g, '')) || /0/.test(testa.testo), `e quanti ne hai in rosa (${testa.testo})`);
  et(/fino a/.test(testa.quando), `dice fino a quando si può cambiare (${testa.quando.replace(/\n/g, ' ')})`);
  et(testa.bottoni > 0, `e ci sono giocatori da comprare (${testa.bottoni})`);

  // --- IL PREZZO LO DECIDE IL LISTINO
  const scelto = await p.evaluate(() => {
    const b = document.querySelector('[data-compra]:not([disabled])');
    return b ? b.dataset.compra : null;
  });
  const atteso = await p.evaluate(async (id) => {
    const S = await import('/src/state.js');
    return S.playersById.get(id).quotation;
  }, scelto);
  await p.click(`[data-compra="${scelto}"]`); await w(1400);
  const dopo = await p.evaluate((id) => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    const r = (s.tables.rosters || []).find((x) => x.player_id === id);
    return { pagato: r ? r.price_paid : null, crediti: s.tables.league_members[0].credits };
  }, scelto);
  et(dopo.pagato === atteso, `si paga la quotazione del listino (${dopo.pagato} contro ${atteso})`);
  et(dopo.crediti === 300 - atteso, `e i crediti scendono di quello (${dopo.crediti})`);

  const notaModulo = await p.evaluate(() => [...document.querySelectorAll('.nota')].map((x) => x.innerText).find((t) => /modulo/i.test(t)) || '');
  et(/ogni giornata/.test(notaModulo) && /3-4-3/.test(notaModulo), `il negozio dice che il modulo si sceglie a ogni giornata, e quali ("${notaModulo.slice(0, 70)}…")`);

  // --- IL TOCCO SI VEDE SUBITO (Alex, 10/10: «il tasto risponde con un po'
  // di ritardo»). La rete qui risponde dopo un secondo e mezzo, come su un
  // telefono lento: il giocatore deve risultare preso, e i crediti scesi,
  // prima che il database abbia risposto.
  const veloce = await p.evaluate(() => document.querySelector('[data-compra]:not([disabled])')?.dataset.compra || null);
  if (veloce) {
    const creditiPrima = await p.evaluate(async () => (await import('/src/state.js')).negozio().crediti);
    await p.evaluate(() => { window.__RITARDO_RPC__ = 1500; });
    const t0 = Date.now();
    await p.click(`[data-compra="${veloce}"]`);
    await p.waitForFunction((id) => !document.querySelector(`[data-compra="${id}"]`), veloce, { timeout: 1200 }).catch(() => {});
    const dopoMs = Date.now() - t0;
    const subito = await p.evaluate(async (id) => { const S = await import('/src/state.js'); return { preso: S.rosterIds(S.me().id).includes(id), crediti: S.negozio().crediti, scritto: (JSON.parse(localStorage.getItem('fcs:mock')).tables.rosters || []).some((x) => x.player_id === id) }; }, veloce);
    et(subito.preso && !subito.scritto && dopoMs < 1000, `il giocatore entra in rosa al tocco, prima che risponda il database (${dopoMs} ms)`);
    et(subito.crediti < creditiPrima, `e i crediti scendono subito (${creditiPrima} → ${subito.crediti})`);
    await w(2200);
    const confermato = await p.evaluate((id) => (JSON.parse(localStorage.getItem('fcs:mock')).tables.rosters || []).some((x) => x.player_id === id), veloce);
    et(confermato, 'poi il database lo conferma');
    await p.evaluate(() => { window.__RITARDO_RPC__ = 0; });
  }

  // --- la quota per ruolo: tre portieri e il quarto no
  await p.evaluate(() => { const t = document.querySelector('[data-ruolo="P"]'); if (t) t.click(); }); await w(700);
  for (let i = 0; i < 4; i++) {
    const libero = await p.evaluate(() => document.querySelector('[data-compra]:not([disabled])')?.dataset.compra || null);
    if (!libero) break;
    await p.click(`[data-compra="${libero}"]`); await w(1100);
  }
  const portieri = await p.evaluate(async () => {
    const S = await import('/src/state.js');
    const io = S.me();
    return S.rosterOf(io.id).filter((r) => r.player.role === 'P').length;
  });
  et(portieri === 3, `più di tre portieri non entrano (${portieri})`);
  const spenti = await p.evaluate(() => {
    const b = [...document.querySelectorAll('[data-compra]')];
    return { tutti: b.length, spenti: b.filter((x) => x.disabled).length, perche: document.body.innerText.match(/hai già \d+ portieri/i)?.[0] || '' };
  });
  et(spenti.tutti > 0 && spenti.spenti === spenti.tutti, `e i bottoni si spengono (${spenti.spenti} di ${spenti.tutti})`);
  et(!!spenti.perche, `dicendo perché ("${spenti.perche}")`);

  await p.evaluate(() => { const t = document.querySelector('[data-ruolo=""]'); if (t) t.click(); }); await w(700);
  await p.screenshot({ path: `${process.env.USCITA || '/tmp'}/negozio.png` }).catch(() => {});

  // --- si vende, e i crediti tornano interi
  const prima = await p.evaluate(() => JSON.parse(localStorage.getItem('fcs:mock')).tables.league_members[0].credits);
  const viaId = await p.evaluate(() => document.querySelector('[data-vendi]')?.dataset.vendi || null);
  const costo = await p.evaluate((id) => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    return (s.tables.rosters || []).find((x) => x.player_id === id)?.price_paid;
  }, viaId);
  await p.click(`[data-vendi="${viaId}"]`); await w(1300);
  const reso = await p.evaluate(() => JSON.parse(localStorage.getItem('fcs:mock')).tables.league_members[0].credits);
  et(reso === prima + costo, `venduto, tornano esattamente i crediti pagati (${prima} + ${costo} = ${reso})`);

  // --- LA FORMAZIONE ASPETTA LA ROSA INTERA (037, Alex 14/10). Con mezza
  // rosa il bottone non conferma: porta al negozio, e sotto il database
  // rifiuta comunque.
  await p.evaluate(() => { location.hash = '#/rosa/formazione'; }); await w(1300);
  const form = await p.evaluate(() => ({
    conferma: !!document.querySelector('#confirm'),
    completa: document.querySelector('#completa-rosa')?.getAttribute('href') || null,
    avviso: document.querySelector('.rosa-incompleta')?.innerText.replace(/\n/g, ' ') || '',
  }));
  et(!form.conferma && form.completa === '#/negozio', `con mezza rosa niente "Conferma": il bottone porta al negozio (${form.completa})`);
  et(/Rosa incompleta/.test(form.avviso) && /25/.test(form.avviso), `e dice quanti ne mancano (${form.avviso.slice(0, 80)})`);
  const salvaForzato = await p.evaluate(async () => {
    const S = await import('/src/state.js');
    const n = S.currentMatchday();
    try { await S.saveLineup(n, S.me().id, S.lineupFor(n, S.me().id)); return 'salvata'; } catch (e) { return e.message; }
  });
  et(/rosa completa/.test(salvaForzato), `e chi aggira il bottone trova la regola sotto ("${salvaForzato.slice(0, 70)}")`);

  // --- IL MERCATO CHIUDE. Non si tocca il calendario — il Giudice Dati lo
  // riallinea da solo a ogni apertura, e la prova si guarderebbe le mani —
  // si sposta l'OROLOGIO un'ora oltre la chiusura delle formazioni della
  // prima giornata di chi è entrato oggi. Quale sia lo dice l'app: con una
  // data scritta qui la prova scadeva da sola (il 9/10 la 5ª si è chiusa e
  // chi entrava quel giorno partiva dalla 6ª, col mercato ancora aperto).
  const primoLock = await p.evaluate(async () => {
    const S = await import('/src/state.js');
    return S.matchday(S.primaGiornata()).lockAt;
  });
  await ctx.clock.setFixedTime(new Date(+new Date(primoLock) + 3600000));
  await p.reload({ waitUntil: 'load' }); await w(1800);
  // --- MERCATO CHIUSO, ROSA A META': si compra ancora, solo per completarla
  await p.evaluate(() => { location.hash = '#/negozio'; }); await w(1200);
  const meta = await p.evaluate(() => ({
    avviso: document.querySelector('.neg-quando')?.innerText.replace(/\n/g, ' ') || '',
    compra: document.querySelectorAll('[data-compra]:not([disabled])').length,
    vendi: document.querySelectorAll('[data-vendi]').length,
    riserva: document.querySelector('.neg-riserva')?.innerText || '',
  }));
  et(/Riserva crediti/.test(meta.riserva), `dice quanti crediti tenere da parte per completarla (${meta.riserva.slice(0, 60)})`);
  et(/Completa la rosa/.test(meta.avviso), `a mercato chiuso con la rosa a metà dice di completarla (${meta.avviso.slice(0, 70)})`);
  et(meta.compra > 0 && meta.vendi > 0, `si compra ancora, e si può togliere per liberare crediti (038) (${meta.compra} da comprare, ${meta.vendi} da togliere)`);
  const preso = await p.evaluate(async () => {
    const S = await import('/src/state.js');
    const miei = new Set(S.rosterIds(S.me().id)); const n = S.negozio();
    const g = S.base.players.find((x) => !miei.has(x.id) && n.manca[x.role] && x.quotation <= n.crediti && !x.doppioneDi);
    try { await S.compraGiocatore(g.id); return 'preso'; } catch (e) { return e.message; }
  });
  et(preso === 'preso', `e il database lo lascia comprare (${preso})`);

  // --- MERCATO CHIUSO, ROSA COMPLETA: chiuso davvero
  await p.evaluate(async () => {
    const S = await import('/src/state.js');
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    const io = s.tables.league_members.find((m) => m.user_id === s.userId);
    const miei = new Set(s.tables.rosters.filter((r) => r.member_id === io.id && !r.released_at).map((r) => r.player_id));
    const quote = { P: 3, D: 8, C: 8, A: 6 }; const per = { P: 0, D: 0, C: 0, A: 0 };
    for (const id of miei) per[S.playersById.get(id).role]++;
    for (const g of S.base.players) {
      if (miei.has(g.id) || g.doppioneDi || per[g.role] >= quote[g.role]) continue;
      s.tables.rosters.push({ id: 'r' + g.id, league_id: io.league_id, member_id: io.id, player_id: g.id, price_paid: 1, released_at: null });
      per[g.role]++;
    }
    localStorage.setItem('fcs:mock', JSON.stringify(s));
  });
  await p.reload({ waitUntil: 'load' }); await w(1800);
  await p.evaluate(() => { location.hash = '#/negozio'; }); await w(1200);
  const chiuso = await p.evaluate(() => ({
    avviso: document.querySelector('.neg-quando')?.innerText.replace(/\n/g, ' ') || '',
    compra: document.querySelectorAll('[data-compra]:not([disabled])').length,
    vendi: document.querySelectorAll('[data-vendi]').length,
  }));
  et(/chiuso/i.test(chiuso.avviso), `a mercato chiuso e rosa completa lo dice (${chiuso.avviso})`);
  et(chiuso.compra === 0 && chiuso.vendi === 0, `e non si compra né si vende (${chiuso.compra} bottoni)`);

  // e il rifiuto non sta solo nella schermata: si chiama la funzione a mano
  const forzato = await p.evaluate(async () => {
    const S = await import('/src/state.js');
    const miei = new Set(S.rosterIds(S.me().id));
    try { await S.compraGiocatore(S.base.players.find((g) => !miei.has(g.id)).id); return 'passata'; }
    catch (e) { return e.message; }
  });
  et(/chiuso/i.test(forzato), `e chi aggira la schermata trova la stessa regola sotto ("${forzato}")`);
  const dopoRifiuto = await p.evaluate(async () => { const S = await import('/src/state.js'); return { rosa: S.rosterIds(S.me().id).length, db: (JSON.parse(localStorage.getItem('fcs:mock')).tables.rosters || []).filter((r) => !r.released_at).length }; });
  et(dopoRifiuto.rosa === dopoRifiuto.db, `rifiutato dal database, l'acquisto anticipato sullo schermo torna indietro (${dopoRifiuto.rosa} in rosa, ${dopoRifiuto.db} nel database)`);

  // --- IL MERCATO DI RIPARAZIONE (039): con la finestra aperta, a rosa
  // completa e mercato chiuso, si torna a togliere e comprare.
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    const ora = Date.now();   // l'orologio della pagina e' gia' spostato oltre il lock
    s.tables.finestre_mercato = [{ id: 1, nome: 'Mercato di riparazione', inizio: new Date(ora - 3600000).toISOString(), fine: new Date(ora + 86400000).toISOString() }];
    localStorage.setItem('fcs:mock', JSON.stringify(s));
  });
  await p.reload({ waitUntil: 'load' }); await w(1800);
  await p.evaluate(() => { location.hash = '#/negozio'; }); await w(1200);
  const rip = await p.evaluate(() => ({
    avviso: document.querySelector('.neg-quando')?.innerText.replace(/\n/g, ' ') || '',
    vendi: document.querySelectorAll('[data-vendi]').length,
  }));
  et(/Mercato di riparazione aperto/.test(rip.avviso) && rip.vendi > 0, `con la finestra di riparazione il negozio si riapre a rosa completa (${rip.avviso.slice(0, 60)} · ${rip.vendi} da togliere)`);
  await p.evaluate(() => { location.hash = '#/'; }); await w(1200);
  const tileRip = await p.evaluate(() => /Mercato di riparazione aperto/i.test(document.body.innerText));
  et(tileRip, 'e la home lo annuncia');
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('fcs:mock')); s.tables.finestre_mercato = []; localStorage.setItem('fcs:mock', JSON.stringify(s)); });

  // a rosa completa la formazione si conferma (orologio di nuovo prima del
  // lock: a giornata bloccata il bottone non c'e' per nessuno)
  await ctx.clock.setFixedTime(new Date(+new Date(primoLock) - 2 * 3600000));
  await p.reload({ waitUntil: 'load' }); await w(1800);
  await p.evaluate(() => { location.hash = '#/rosa/formazione'; }); await w(1300);
  const pronta = await p.evaluate(() => ({ conferma: !!document.querySelector('#confirm'), completa: !!document.querySelector('#completa-rosa') }));
  et(pronta.conferma && !pronta.completa, 'a rosa completa torna il bottone "Conferma formazione"');
  // 040: col mercato aperto si salva la formazione e poi si vende un
  // titolare: la formazione va riconfermata, non resta col giocatore ceduto.
  const venduto = await p.evaluate(async () => {
    const S = await import('/src/state.js');
    const n = S.base.matchdays.find((m) => new Date(m.lockAt) > new Date()).number;
    const lu = S.lineupFor(n, S.me().id);
    await S.saveLineup(n, S.me().id, { ...lu, bench: (lu.bench || []).filter(Boolean) });
    await new Promise((r) => setTimeout(r, 300));
    const prima = !!S.savedLineup(n, S.me().id);
    const esito = await S.vendiGiocatore(lu.starters[0]);
    return { prima, tolte: esito?.formazioni_tolte, dopo: !!S.savedLineup(n, S.me().id) };
  });
  et(venduto.prima && venduto.tolte === 1 && !venduto.dopo, `vendendo un titolare la formazione salvata si toglie e va riconfermata (${JSON.stringify(venduto)})`);

  // La bozza della formazione era gia' aperta col giocatore venduto dentro:
  // tornandoci non deve piu' esserci (15/10, Android: "Il giocatore
  // trefiori_19 non è nella tua rosa" dal server, con l'id grezzo).
  await p.evaluate(() => { location.hash = '#/rosa'; }); await w(600);
  await p.evaluate(() => { location.hash = '#/rosa/formazione'; }); await w(1300);
  const bozza = await p.evaluate(() => ({
    avviso: document.querySelector('.ceduti')?.innerText || '',
    vuoti: document.querySelectorAll('.slot.vuoto').length,
  }));
  et(/non è più nella tua rosa/.test(bozza.avviso) && bozza.vuoti === 1,
    `nella bozza aperta il venduto lascia il posto vuoto e lo dice (${bozza.avviso.slice(0, 50)} · ${bozza.vuoti} vuoto)`);
  const rifiuto = await p.evaluate(async () => {
    const S = await import('/src/state.js');
    const n = S.base.matchdays.find((m) => new Date(m.lockAt) > new Date()).number;
    const lu = S.lineupFor(n, S.me().id);
    const ruolo = S.playersById.get(lu.starters.find(Boolean)).role;
    const fuori = () => S.base.players.filter((g) => !S.rosterIds(S.me().id).includes(g.id) && g.role === ruolo).sort((a, b) => a.quotation - b.quotation);
    // la rosa torna a 25 (se no la regola della rosa completa parla per prima)
    const preso = await S.compraGiocatore(fuori()[0].id).then(() => true, () => false);
    const venduto = fuori()[0];
    if (!preso) return 'acquisto rifiutato';
    const starters = [...lu.starters]; starters[starters.findIndex((id) => id && S.playersById.get(id).role === ruolo)] = venduto.id;
    try { S.saveLineup(n, S.me().id, { ...lu, starters, bench: [] }); return 'passata'; }
    catch (e) { return e.message; }
  });
  et(/non è più nella tua rosa/.test(rifiuto) && !/_\d/.test(rifiuto), `e chi ci prova lo stesso legge il nome, non l'id ("${rifiuto}")`);

  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
  await b.close();
  for (const t of ok) console.log('  ok  ' + t);
  for (const t of ko) console.log('  KO  ' + t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
