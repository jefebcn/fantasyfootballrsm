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
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, theme: 'system' }));
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

  // --- IL MERCATO CHIUDE. Non si tocca il calendario — il Giudice Dati lo
  // riallinea da solo a ogni apertura, e la prova si guarderebbe le mani —
  // si sposta l'OROLOGIO oltre la chiusura delle formazioni della 5ª, che è
  // la prima giornata di chi è entrato oggi.
  await ctx.clock.setFixedTime(new Date('2026-10-10T12:00:00Z'));
  await p.reload({ waitUntil: 'load' }); await w(1800);
  await p.evaluate(() => { location.hash = '#/negozio'; }); await w(1200);
  const chiuso = await p.evaluate(() => ({
    avviso: document.querySelector('.neg-quando')?.innerText.replace(/\n/g, ' ') || '',
    compra: document.querySelectorAll('[data-compra]:not([disabled])').length,
    vendi: document.querySelectorAll('[data-vendi]').length,
  }));
  et(/chiuso/i.test(chiuso.avviso), `a mercato chiuso lo dice (${chiuso.avviso})`);
  et(chiuso.compra === 0 && chiuso.vendi === 0, `e non si compra né si vende (${chiuso.compra} bottoni)`);

  // e il rifiuto non sta solo nella schermata: si chiama la funzione a mano
  const forzato = await p.evaluate(async () => {
    const S = await import('/src/state.js');
    try { await S.compraGiocatore(S.base.players[0].id); return 'passata'; }
    catch (e) { return e.message; }
  });
  et(/chiuso/i.test(forzato), `e chi aggira la schermata trova la stessa regola sotto ("${forzato}")`);

  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
  await b.close();
  for (const t of ok) console.log('  ok  ' + t);
  for (const t of ko) console.log('  KO  ' + t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
