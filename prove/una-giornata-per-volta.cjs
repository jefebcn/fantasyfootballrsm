/**
 * Una giornata per volta: finché quella in corso non è finita, non si schiera
 * per la prossima.
 *
 * Nasce da uno schermo vero, sabato 19 settembre alle 10:20. In cima alla
 * dashboard c'era "Giornata corrente · 5ª giornata" con dentro il tasto
 * INSERISCI FORMAZIONE e la nota "si chiude ven 9/10" — mentre la 4ª aveva
 * ancora cinque partite da giocare, due delle quali quel pomeriggio stesso.
 * Le due cose insieme non stanno in piedi: chi apre l'app la domenica mattina
 * vuole vedere come sta andando la sua giornata, non consegnare quella dopo.
 *
 * Qui si guarda la regola in tre momenti: mentre si gioca, a giornata finita,
 * e con il lock della prossima ormai vicino (la valvola, che apre lo stesso —
 * senza, una partita mai giocata bloccherebbe la consegna fino al lock, e chi
 * non consegna perde 0-3 a tavolino, art. 8.4).
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

// La 4a giornata si gioca fra il 18 e il 20 settembre, la 5a il 9 ottobre.
const MOMENTI = [
  { quando: '2026-09-19T08:20:00Z', giocate: 3, bloccata: true, etichetta: 'mentre si gioca la 4ª' },
  { quando: '2026-09-21T08:00:00Z', giocate: 8, bloccata: false, etichetta: 'a 4ª finita' },
  { quando: '2026-10-08T08:00:00Z', giocate: 3, bloccata: false, etichetta: 'col lock della 5ª vicino (valvola)' },
];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  for (const m of MOMENTI) {
    const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    await ctx.addInitScript(({ iso }) => {
      window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
      localStorage.setItem('fcs:auth', 'supabase');
      localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, theme: 'system' }));
      localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
      const Vero = Date; const scarto = new Vero(iso).getTime() - Vero.now();
      class Finto extends Vero {
        constructor(...a) { if (!a.length) super(Vero.now() + scarto); else super(...a); }
        static now() { return Vero.now() + scarto; }
      }
      window.Date = Finto;
    }, { iso: m.quando });
    const p = await ctx.newPage(); p.on('dialog', (d) => d.accept());
    const errori = []; p.on('pageerror', (e) => errori.push(e.message));
    const w = (ms = 450) => p.waitForTimeout(ms);
    // Quante partite della 4a hanno un risultato: si riscrive il calendario,
    // che nel frattempo il campionato fa cambiare da solo.
    await p.route('**/calendario-dati.js', async (route) => {
      const r = await route.fetch(); let t = await r.text(); let n = 0;
      t = t.replace(/(\[4,[^\n]*?),(?:null|\d+),(?:null|\d+)\]/g, (x, a) => (n++ < m.giocate ? `${a},2,1]` : `${a},null,null]`));
      await route.fulfill({ body: t, headers: { 'content-type': 'text/javascript' } });
    });
    await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
    await p.click('[data-tab="up"]'); await w(250);
    await p.fill('#email', 'a@e.it'); await p.fill('#name', 'Conti25'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1000);
    await p.click('[data-form="create"]'); await w(250);
    await p.fill('#lname', 'Torneo Titano'); await p.fill('#team', 'Hasta El Roxy'); await p.click('#go-create'); await w(1400);
    // La lega è nata prima della 4ª: se no la 4ª non è sua e non deve
    // aspettarla (una lega creata a metà giornata parte dalla prossima).
    await p.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('fcs:mock'));
      s.tables.leagues[0].created_at = '2026-09-16T10:00:00Z';
      // un'avversaria, se no non c'e' uno scontro e la card della giornata
      // corrente non ha niente da mostrare
      const io = s.tables.league_members[0];
      s.tables.profiles.push({ id: 'u_riv', display_name: 'Wesly', is_judge: false });
      s.tables.league_members.push({ ...io, id: 'm_riv', user_id: 'u_riv', role: 'fantallenatore', team_name: 'Fuego Roxy', owner_name: 'Wesly', color: '#c0392b', initials: 'FR' });
      localStorage.setItem('fcs:mock', JSON.stringify(s));
      location.hash = '#/';            // creata la lega si finisce sulla sua gestione
    });
    await p.reload({ waitUntil: 'load' }); await w(2200);

    const dash = await p.evaluate(() => {
      const card = [...document.querySelectorAll('.a-sec')].find((x) => /Giornata corrente/i.test(x.innerText));
      const corpo = card?.nextElementSibling;
      return {
        titolo: card ? card.innerText.replace(/\n/g, ' ') : '',
        nota: corpo?.querySelector('.mnota')?.innerText || '',
        tasto: corpo?.querySelector('.mact a')?.innerText.trim() || '',
        promemoria: /manca la formazione/i.test(document.body.innerText),
        // quante volte la pagina porta ai voti della giornata in corso: una
        // card e una scheda che dicono la stessa cosa sono una di troppo
        rimandi: document.querySelectorAll('.a-body a[href^="#/voti/"]').length,
      };
    });
    const g = (dash.titolo.match(/(\d+)ª/) || [])[1];

    if (m.bloccata) {
      et(g === '4', `${m.etichetta}: la card resta sulla 4ª (dice la ${g || '?'}ª)`);
      et(!/Inserisci formazione|Modifica la formazione/i.test(dash.tasto),
        `${m.etichetta}: niente tasto per schierare ("${dash.tasto}")`);
      et(/si apre a giornata finita/i.test(dash.nota),
        `${m.etichetta}: e dice quando si aprirà ("${dash.nota}")`);
      et(!dash.promemoria, `${m.etichetta}: nessun promemoria per una cosa che non si può fare`);
      et(dash.rimandi === 1, `${m.etichetta}: un solo rimando ai voti della giornata in corso (${dash.rimandi})`);

      // ROSA → FORMAZIONE MENTRE SI GIOCA non e' un muro: e' la squadra in
      // campo. Prima qui c'era solo l'avviso "la 4ª è ancora in corso", e la
      // squadra che stava giocando non si vedeva da nessuna parte — ed e' la
      // cosa che si apre l'app per guardare, la domenica pomeriggio.
      //
      // Si schiera apposta un undici di gente che ha giocato davvero la prima
      // partita della giornata: cosi' i voti ci sono tutti e si conta.
      const undici = await p.evaluate(async () => {
        const S = await import('/src/state.js');
        // Sei giocatori dalla prima partita della giornata, che si e' giocata
        // (e quindi hanno il voto) e cinque da una che non si e' ancora
        // giocata: e' la situazione vera di una domenica pomeriggio, e serve a
        // guardare come l'app spiega il totale.
        const perRuolo = (lista) => { const o = { P: [], D: [], C: [], A: [] }; for (const id of lista) { const g = S.playersById.get(id); if (g) o[g.role].push(g.id); } return o; };
        const giocata = perRuolo(S.appearancesOf('md4_m1').map((a) => a.playerId));
        // Una gara di cui la FSGC non ha ancora pubblicato il referto: i suoi
        // giocatori non hanno voto. Si cerca per referto e non per risultato,
        // perche' i due dati arrivano in momenti diversi e il file dei
        // tabellini cambia da solo a ogni import.
        const gara = S.matchesOf(4).find((m) => !S.appearancesOf(m.id).length);
        const ferma = perRuolo(S.base.players.filter((g) => g.clubId === gara.homeClubId).map((g) => g.id));
        const titolari = [
          ...giocata.P.slice(0, 1), ...giocata.D.slice(0, 2), ...giocata.C.slice(0, 2), ...giocata.A.slice(0, 1),
          ...ferma.D.slice(0, 2), ...ferma.C.slice(0, 2), ...ferma.A.slice(0, 1),
        ];
        if (titolari.length < 11) return 0;
        S.saveLineup(4, S.me().id, { formation: '4-4-2', starters: titolari, bench: [], captainId: titolari[0], viceCaptainId: titolari[1] });
        return titolari.length;
      });
      await p.reload({ waitUntil: 'load' }); await w(2000);
      await p.evaluate(() => { location.hash = '#/rosa/formazione'; }); await w(1200);
      const schermo = await p.evaluate(() => ({
        campo: !!document.querySelector('.campo'),
        pieni: document.querySelectorAll('.slot:not(.vuoto)').length,
        voti: document.querySelectorAll('.fvc').length,
        conferma: !!document.querySelector('#confirm'),
        moduli: [...document.querySelectorAll('[data-mod]')].filter((x) => !x.disabled).length,
        aiVoti: !!document.querySelector('a[href="#/voti/4"]'),
        totale: +(document.querySelector('.fase-punti b')?.innerText.replace(',', '.') || 0),
        sommaVoti: [...document.querySelectorAll('.fvc')].reduce((s, x) => s + (+x.innerText.replace(',', '.') || 0), 0),
        testo: document.body.innerText.replace(/\n/g, ' '),
      }));
      et(schermo.campo && schermo.pieni >= 11, `${m.etichetta}: la squadra in campo si vede (${schermo.pieni} caselle piene)`);
      et(undici === 11 && schermo.voti === 6, `${m.etichetta}: chi ha giocato porta il suo voto, gli altri no (${schermo.voti} badge su ${undici} titolari)`);
      // DA DOVE VIENE IL TOTALE. Con sei voti sul campo e un totale di 62,5 la
      // domanda e' legittima: chi non ha ancora giocato non vale zero, vale il
      // voto d'ufficio (art. 8.6). Se il numero non si spiega sembra sbagliato.
      et(/Punti se finisse adesso/i.test(schermo.testo), `${m.etichetta}: il totale dice di essere un "se finisse adesso"`);
      et(/6 su 11/.test(schermo.testo), `${m.etichetta}: e dice quanti hanno il voto`);
      et(/5 valgono 5,5 d'ufficio/.test(schermo.testo) || /5 valgono 5,5 d’ufficio/.test(schermo.testo),
        `${m.etichetta}: e che gli altri valgono il voto d'ufficio (art. 8.6)`);
      // IL CONTO DEVE TORNARE con quello che si vede: i numeri in campo piu'
      // i voti d'ufficio di chi non ha ancora giocato fanno il totale. Prima
      // in campo compariva il voto grezzo del capitano (1,5) mentre nel totale
      // pesava il doppio del malus (-2,5), e il conto non tornava di quattro
      // punti — senza che niente lo dicesse.
      et(Math.abs(schermo.totale - (schermo.sommaVoti + (11 - 6) * 5.5)) < 0.06,
        `${m.etichetta}: e il conto torna (${schermo.totale} = ${schermo.sommaVoti} in campo + 5 × 5,5)`);
      et(!schermo.conferma && schermo.moduli === 0, `${m.etichetta}: ma non si tocca niente (conferma ${schermo.conferma ? 'c\'è' : 'no'}, moduli ${schermo.moduli})`);
      et(schermo.aiVoti, `${m.etichetta}: e si passa ai voti della giornata`);
      await p.screenshot({ path: `${process.env.USCITA || '/tmp'}/formazione-in-corso.png`, fullPage: true }).catch(() => {});
      et(/si apre quando la 4ª è finita|si apre a giornata finita/i.test(schermo.testo),
        `${m.etichetta}: e dice quando si potrà schierare la prossima`);

      // e la regola vale dove si scrive, non solo dove si guarda
      const scritto = await p.evaluate(async () => {
        const S = await import('/src/state.js');
        try { S.saveLineup(S.giornataDaSchierare(), S.me().id, { formation: '4-4-2', starters: [], bench: [] }); return 'passata'; }
        catch (e) { return e.message; }
      });
      et(/ancora in corso/i.test(scritto), `${m.etichetta}: e il salvataggio si rifiuta ("${String(scritto).slice(0, 50)}")`);
    } else {
      et(g === '5', `${m.etichetta}: la card passa alla 5ª (dice la ${g || '?'}ª)`);
      et(/Inserisci formazione|Modifica la formazione/i.test(dash.tasto),
        `${m.etichetta}: il tasto per schierare c'è ("${dash.tasto}")`);
      await p.evaluate(() => { location.hash = '#/rosa/formazione'; }); await w(1000);
      const schermo = await p.evaluate(() => ({ campo: !!document.querySelector('.campo') }));
      et(schermo.campo, `${m.etichetta}: e il campo si apre`);
    }
    et(errori.length === 0, `${m.etichetta}: nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
    await ctx.close();
  }
  await b.close();
  for (const t of ok) console.log('  ok  ' + t);
  for (const t of ko) console.log('  KO  ' + t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
