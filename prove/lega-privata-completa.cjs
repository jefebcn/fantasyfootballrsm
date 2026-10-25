/**
 * UNA LEGA PRIVATA DALL'INIZIO ALLA FINE (Alex, 25/10: «controlla che nelle
 * leghe private funzioni tutto: dall'asta alla formazione a chi vince
 * arrivando a determinati punti»).
 *
 *  1. Alex crea la lega e tre amici entrano col codice.
 *  2. L'asta, dalla console: acquisti, crediti che scendono, il tetto
 *     dell'offerta massima, lo stesso giocatore che non si vende due volte, il
 *     ruolo pieno, l'annullo che restituisce i crediti. Il resto delle rose si
 *     completa con la stessa funzione che usa la console (S.addRosterPlayer),
 *     con calciatori titolari nella 5ª giornata vera.
 *  3. Ognuno entra col suo account e conferma la formazione della 5ª.
 *  4. L'orologio va a martedi' sera dopo la 5ª: il Giudice calcola la giornata.
 *  5. I conti si rifanno QUI, per conto loro, dai referti FSGC e dal
 *     regolamento (art. 4, 5, 6, 11, 12): voto di ogni titolare rimasto in
 *     campo almeno 60', fantapunti di squadra, gol della conversione,
 *     vincitore, punti in classifica. Se la prova usasse il codice dell'app
 *     per controllare l'app, un errore passerebbe in tutti e due.
 */
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const BASE = process.env.BASE || 'http://localhost:4173';
const USCITA = process.env.USCITA || '/tmp';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);
const r1 = (x) => Math.round(x * 10) / 10;

// --- i referti della 5ª, letti dal file come testo: niente codice dell'app
const REFERTI = (() => {
  const t = fs.readFileSync(path.join(__dirname, '../src/eventi-dati.js'), 'utf8');
  const out = [];
  for (const m of t.matchAll(/\{g:5,casa:"([a-z]+)",ospite:"([a-z]+)",[^\n]*?titolari:(\[\[.*?\]\]),eventi:(\[.*?\]),cambi:(\[.*?\])\}/g)) {
    out.push({ casa: m[1], ospite: m[2], titolari: JSON.parse(m[3]), eventi: JSON.parse(m[4]), cambi: JSON.parse(m[5]) });
  }
  return out;
})();
const REGOLE = { base: 6, esito: { v: 0.5, n: 0, p: -0.5 }, gol: { P: 6, D: 4, C: 3.5, A: 3 }, assist: 1,
  inviolata: { P: 3, D: 1.5, C: 0, A: 0 }, subitoP: -1, giallo: -0.5, rosso: -2, autogol: -2, rigoreSbagliato: -3 };

/**
 * Il voto di un titolare rimasto in campo almeno 60', dal referto e dal
 * regolamento. null quando la prova non sa dirlo con certezza (meno di 60',
 * espulso, entrato dalla panchina): quei casi li lascia stare.
 */
function votoAtteso(pid, ruolo) {
  const club = pid.replace(/_\d+$/, '');
  const r = REFERTI.find((x) => x.casa === club || x.ospite === club);
  if (!r) return null;
  const casa = r.casa === club;
  if (!r.titolari[casa ? 0 : 1].includes(pid)) return null;
  const esce = r.cambi.find(([, fuori]) => fuori === pid);
  if (esce && esce[2] < 60) return null;
  const ev = r.eventi.filter(([p]) => p === pid);
  if (ev.some(([, , t]) => t.startsWith('red'))) return null;
  const golDi = (lato) => r.eventi.filter(([p, , t]) => (t === 'goal' && (p.replace(/_\d+$/, '') === lato))
    || (t === 'own_goal' && (p.replace(/_\d+$/, '') !== lato))).length;
  const fatti = golDi(club), subiti = golDi(casa ? r.ospite : r.casa);
  let v = REGOLE.base + (fatti > subiti ? REGOLE.esito.v : fatti < subiti ? REGOLE.esito.p : 0);
  for (const [, , t] of ev) {
    if (t === 'goal') v += REGOLE.gol[ruolo];
    else if (t === 'assist') v += REGOLE.assist;
    else if (t === 'yellow') v += REGOLE.giallo;
    else if (t === 'own_goal') v += REGOLE.autogol;
    else if (t === 'pen_missed') v += REGOLE.rigoreSbagliato;
  }
  if (subiti === 0) v += REGOLE.inviolata[ruolo];
  if (ruolo === 'P') {
    if (esce) return null;                 // il portiere uscito: i gol subiti dipendono dal minuto
    // Fino alla 5ª il gol subito nel recupero non toglieva il punto al portiere
    // (corretto dalla 6ª, src/engine.js recuperoAlPortiereDal): la 5ª resta com'era.
    const avversari = casa ? r.ospite : r.casa;
    const neiNovanta = r.eventi.filter(([p, m, t]) => m <= 90 && ((t === 'goal' && p.replace(/_\d+$/, '') === avversari)
      || (t === 'own_goal' && p.replace(/_\d+$/, '') === club))).length;
    v += REGOLE.subitoP * neiNovanta;
  }
  return r1(v);
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    localStorage.setItem('fcs:auth', 'supabase');
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'light' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  // Mercoledi' 7/10: la 5ª giornata (prima gara venerdi' 9/10) e' ancora aperta,
  // quindi una lega nata adesso parte da li'.
  await ctx.clock.install({ time: new Date('2026-10-07T10:00:00Z') });
  const p = await ctx.newPage(); p.on('dialog', (d) => d.accept());
  const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  // I referti e i risultati veri stanno gia' nei file, anche quelli che il 7/10
  // erano futuro: un'app che li vede considera la 5ª gia' giocata e chiude le
  // formazioni. Quindi fino a dove arriva l'orologio della prova, le giornate
  // dalla «taglia» in poi non hanno ne' risultati ne' referti.
  let taglia = 5;
  await ctx.route('**/calendario-dati.js*', async (route) => {
    const t = await (await route.fetch()).text();
    await route.fulfill({ contentType: 'text/javascript', body: t.replace(/(\[(\d+),[^\n]*?),(?:null|\d+),(?:null|\d+)\]/g, (m, testa, g) => (+g >= taglia ? `${testa},null,null]` : m)) });
  });
  await ctx.route('**/eventi-dati.js*', async (route) => {
    const t = await (await route.fetch()).text();
    await route.fulfill({ contentType: 'text/javascript', body: t.split('\n').filter((r) => { const g = r.match(/^\s*\{g:(\d+),/); return !g || +g[1] < taglia; }).join('\n') });
  });
  const w = (ms = 500) => p.waitForTimeout(ms);
  const vai = async (h, ms = 900) => { await p.evaluate((x) => { location.hash = x; }, h); await w(ms); };
  const esci = async () => { await vai('#/impostazioni', 600); await p.click('[data-act="logout"]'); await w(900); await p.waitForSelector('#password'); };
  const entra = async (email) => { await p.fill('#email', email); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1400); };
  const iscrivi = async (email, nome) => {
    await p.click('[data-tab="up"]'); await w(250);
    await p.fill('#email', email); await p.fill('#name', nome); await p.fill('#password', 'password123');
    await p.click('#primary'); await w(1100);
  };

  // ---- 1. la lega e i quattro
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await iscrivi('alex@e.it', 'Alex');
  await p.click('[data-form="create"]'); await w(250);
  await p.fill('#lname', 'Lega degli Amici'); await p.fill('#team', 'Alex FC'); await p.click('#go-create'); await w(1500);
  const codice = await p.evaluate(() => document.body.innerText.match(/[Cc]odice(?: invito)?\s*([A-Z0-9]{6})/)?.[1]);
  et(!!codice, `lega creata, codice ${codice}`);
  const AMICI = [['bea@e.it', 'Bea', 'Bea United'], ['cri@e.it', 'Cri', 'Cri Rovers'], ['dado@e.it', 'Dado', 'Dado Calcio']];
  for (const [email, nome, squadra] of AMICI) {
    await esci(); await iscrivi(email, nome);
    await p.click('[data-form="join"]'); await w(250);
    await p.fill('#code', codice); await p.fill('#team', squadra); await p.click('#go-join'); await w(1300);
  }
  await esci(); await entra('alex@e.it');
  const lega = await p.evaluate(async () => {
    const S = await import('/src/state.js');
    return { squadre: S.base.managers.map((m) => m.teamName), prima: S.primaGiornata(), admin: S.isLeagueAdmin(),
      privata: !S.legaPubblica(), crediti: S.base.managers.map((m) => m.credits) };
  });
  et(lega.squadre.length === 4, `in lega 4 squadre (${lega.squadre.join(', ')})`);
  et(lega.privata && lega.admin, 'lega privata, Alex la amministra');
  et(lega.prima === 5, `la lega comincia dalla 5ª giornata (${lega.prima}ª)`);
  et(lega.crediti.every((c) => c === 500), `500 crediti a testa (${lega.crediti.join(', ')})`);

  // ---- 2. l'asta, dalla console
  await vai('#/asta', 1200);
  const sq = await p.evaluate(async () => { const S = await import('/src/state.js'); return S.base.managers.map((m) => ({ id: m.id, nome: m.teamName })); });
  const id = Object.fromEntries(sq.map((x) => [x.nome, x.id]));
  const titolari5 = [...new Set(REFERTI.flatMap((r) => r.titolari.flat()))];
  const ruoli = await p.evaluate(async (ids) => { const S = await import('/src/state.js'); return Object.fromEntries(ids.map((x) => [x, S.playersById.get(x)?.role])); }, titolari5);
  const pool = { P: [], D: [], C: [], A: [] };
  for (const x of titolari5) if (ruoli[x]) pool[ruoli[x]].push(x);

  // un acquisto vero dalla console: squadra, ricerca, prezzo, «Assegna»
  const compra = async (squadra, pid, prezzo) => {
    await p.click(`[data-sq="${id[squadra]}"]`); await w(250);
    const nome = await p.evaluate(async (x) => { const S = await import('/src/state.js'); return S.playersById.get(x).lastName; }, pid);
    await p.fill('#cerca', nome); await w(350);
    // un giocatore gia' venduto non e' nemmeno nell'elenco dei liberi
    if (!(await p.$(`[data-pl="${pid}"]`))) { await p.fill('#cerca', ''); await w(250); return { spento: true, motivo: 'non è fra i liberi: già venduto' }; }
    // ruolo pieno o niente crediti: la riga c'e' ma non si tocca
    if (await p.$eval(`[data-pl="${pid}"]`, (x) => x.disabled)) {
      const motivo = await p.$eval(`[data-pl="${pid}"] .q`, (x) => x.innerText);
      await p.fill('#cerca', ''); await w(250); return { spento: true, motivo };
    }
    await p.click(`[data-pl="${pid}"]`); await w(350);
    await p.fill('#sheet #prezzo', String(prezzo)); await p.dispatchEvent('#sheet #prezzo', 'input'); await w(150);
    const stato = await p.evaluate(() => ({ spento: document.querySelector('#sheet #assegna')?.disabled, motivo: document.querySelector('#sheet #motivo')?.innerText || '' }));
    if (!stato.spento) { await p.click('#sheet #assegna'); await w(700); }
    else await p.evaluate(() => document.getElementById('sheet-scrim')?.click());
    await p.fill('#cerca', ''); await w(250);
    return stato;
  };
  const crediti = (squadra) => p.evaluate(async (x) => { const S = await import('/src/state.js'); return S.managersById.get(x).credits; }, id[squadra]);

  const [stella] = pool.A;
  let s = await compra('Alex FC', stella, 120);
  et(!s.spento && await crediti('Alex FC') === 380, `Alex compra ${stella} a 120: crediti 500 → ${await crediti('Alex FC')}`);
  s = await compra('Bea United', stella, 130);
  et(s.spento && !(await p.evaluate(async (x) => { const S = await import('/src/state.js'); return S.proprietari().get(x).managerId; }, stella) !== id['Alex FC']),
    `lo stesso giocatore non si vende due volte (la console lo nasconde o rifiuta: «${s.motivo.slice(0, 60)}»)`);
  s = await compra('Bea United', pool.A[1], 480);
  et(s.spento && /massim|credit/i.test(s.motivo), `un'offerta oltre il massimo (480 con 24 caselle vuote) non parte: «${s.motivo.slice(0, 70)}»`);
  for (const pid of pool.P.slice(0, 3)) await compra('Cri Rovers', pid, 5);
  s = await compra('Cri Rovers', pool.P[3], 5);
  const porti = await p.evaluate(async (x) => { const S = await import('/src/state.js'); return S.statoAsta(x).per.P; }, id['Cri Rovers']);
  et(porti === 3, `Cri prende tre portieri e il quarto non entra (portieri in rosa: ${porti})`);
  // l'annullo: si tocca l'ultimo acquisto e i crediti tornano
  const prima = await crediti('Cri Rovers');
  await p.click(`[data-annulla="${pool.P[2]}"]`); await w(800);
  et(await crediti('Cri Rovers') === prima + 5, `annullato un acquisto: 5 crediti tornano a Cri (${prima} → ${await crediti('Cri Rovers')})`);

  // il resto delle rose con la stessa funzione della console (regole comprese)
  const riempi = await p.evaluate(async ({ pool, id }) => {
    const S = await import('/src/state.js');
    const presi = new Set(S.proprietari().keys());
    const errori = [];
    for (const m of S.base.managers) {
      for (const ruolo of ['P', 'D', 'C', 'A']) {
        while (S.statoAsta(m.id).per[ruolo] < S.statoAsta(m.id).serve[ruolo]) {
          const pid = pool[ruolo].find((x) => !presi.has(x));
          if (!pid) { errori.push(`${m.teamName}: finiti i ${ruolo}`); break; }
          presi.add(pid);
          try { await S.addRosterPlayer(m.id, pid, 3); } catch (e) { errori.push(`${pid}: ${e.message}`); }
        }
      }
    }
    return { errori, rose: S.base.managers.map((m) => ({ nome: m.teamName, n: S.rosterIds(m.id).length, crediti: S.managersById.get(m.id).credits, ok: S.statoAsta(m.id).vuote === 0 })) };
  }, { pool, id });
  et(!riempi.errori.length, `rose completate senza errori${riempi.errori.length ? ': ' + riempi.errori.slice(0, 2).join(' | ') : ''}`);
  et(riempi.rose.every((r) => r.n === 25 && r.ok), `quattro rose da 25 (${riempi.rose.map((r) => `${r.nome} ${r.n}`).join(', ')})`);
  et(riempi.rose.every((r) => r.crediti >= 0), `nessuno sotto zero coi crediti (${riempi.rose.map((r) => r.crediti).join(', ')})`);

  // ---- 3. la formazione, ognuno col suo account
  const conferma = async (chi) => {
    await vai('#/rosa/formazione', 1300);
    const r = await p.evaluate(async () => {
      document.querySelector('#confirm')?.click();
      await new Promise((x) => setTimeout(x, 1000));
      const S = await import('/src/state.js');
      const l = S.lineupOf ? S.lineupOf(5, S.me().id) : null;
      const st = JSON.parse(localStorage.getItem('fcs:mock')).tables.lineups || [];
      const mia = st.filter((x) => x.member_id === S.me().id || x.manager_id === S.me().id).at(-1);
      const lu = mia?.lineup || l;
      return lu ? { tit: lu.starters.filter(Boolean).length, panca: lu.bench.filter(Boolean).length } : null;
    });
    et(r && r.tit === 11 && r.panca === 7, `${chi}: formazione della 5ª confermata (${r ? `${r.tit} titolari, ${r.panca} in panchina` : 'niente'})`);
  };
  await conferma('Alex');
  for (const [email, nome] of AMICI) { await esci(); await entra(email); await conferma(nome); }
  await esci(); await entra('alex@e.it');

  // ---- 4. martedi' 13/10 sera: la 5ª e' finita e si calcola
  taglia = 6;   // ora la 5ª e' passata: i suoi referti esistono, quelli della 6ª ancora no
  await p.clock.setFixedTime(new Date('2026-10-13T19:30:00Z'));
  await p.reload({ waitUntil: 'load' }); await w(2600);
  const calc = await p.evaluate(async () => {
    await new Promise((x) => setTimeout(x, 400));
    const btn = document.querySelector('#chiudi-giornata');
    if (btn && !btn.disabled) { btn.click(); await new Promise((x) => setTimeout(x, 1500)); }
    const S = await import('/src/state.js');
    return { cera: !!btn, spento: btn?.disabled, stato: S.matchdayStatus(5) };
  });
  et(calc.cera && calc.stato === 'frozen', `il Giudice calcola la 5ª (tasto ${calc.cera ? (calc.spento ? 'spento' : 'acceso') : 'assente'}, stato «${calc.stato}»)`);

  // ---- 5. i conti, rifatti qui
  const esiti = await p.evaluate(async () => {
    const S = await import('/src/state.js');
    return S.fixturesOf(5).map((f) => {
      const r = S.fixtureResult(f);
      const riga = (x) => ({ pid: x.playerId, ruolo: x.role, fv: x.fantaVote, cap: x.isCaptain, entra: !!x.subFor, sv: x.isSV });
      return { casa: S.managersById.get(f.homeManagerId).teamName, ospite: S.managersById.get(f.awayManagerId).teamName,
        played: r.played, hs: r.homeScore, as: r.awayScore, hg: r.homeGoals, ag: r.awayGoals, forfait: r.forfait,
        hr: (r.home?.rows || []).map(riga), ar: (r.away?.rows || []).map(riga) };
    });
  });
  const art11 = await (async () => { await vai('#/classifica', 1200); return p.evaluate(() => document.body.innerText.match(/primo gol scatta a ([\d,]+) e se ne aggiunge uno ogni ([\d,]+)/)); })();
  const soglia = art11 ? parseFloat(art11[1].replace(',', '.')) : null, passo = art11 ? parseFloat(art11[2].replace(',', '.')) : null;
  et(soglia != null, `la classifica dice la regola dell'art. 11: primo gol a ${soglia}, poi uno ogni ${passo}`);
  const golDa = (pt) => (pt < soglia ? 0 : Math.floor((pt - soglia) / passo) + 1);

  let controllati = 0; const sbagliati = [];
  const punti = {};
  for (const e of esiti) {
    et(e.played && !e.forfait, `${e.casa}–${e.ospite}: giocata, nessun tavolino`);
    for (const [righe, tot, nome] of [[e.hr, e.hs, e.casa], [e.ar, e.as, e.ospite]]) {
      for (const x of righe) {
        if (x.cap || x.entra || x.sv) continue;
        const atteso = votoAtteso(x.pid, x.ruolo);
        if (atteso == null) continue;
        controllati++;
        if (Math.abs(atteso - x.fv) > 0.05) sbagliati.push(`${x.pid} app ${x.fv} atteso ${atteso}`);
      }
      const somma = r1(righe.reduce((s2, x) => s2 + x.fv, 0));
      et(Math.abs(somma - tot) < 0.05, `${nome}: fantapunti ${tot} = somma degli undici in campo (${somma})`);
    }
    et(e.hg === golDa(e.hs) && e.ag === golDa(e.as), `${e.casa} ${e.hs} → ${e.hg} gol, ${e.ospite} ${e.as} → ${e.ag} gol (atteso ${golDa(e.hs)}-${golDa(e.as)})`);
    const [a, b2] = e.hg > e.ag ? [3, 0] : e.hg < e.ag ? [0, 3] : [1, 1];
    punti[e.casa] = (punti[e.casa] || 0) + a; punti[e.ospite] = (punti[e.ospite] || 0) + b2;
  }
  et(controllati >= 20 && !sbagliati.length, `voti dei titolari rimasti in campo 60': ${controllati} rifatti dal referto, ${sbagliati.length} diversi${sbagliati.length ? ' — ' + sbagliati.slice(0, 3).join(' | ') : ''}`);

  const classifica = await p.evaluate(async () => { const S = await import('/src/state.js'); return S.standings().map((r) => ({ nome: S.managersById.get(r.managerId).teamName, punti: r.points })); });
  et(classifica.every((r) => r.punti === punti[r.nome]), `classifica: ${classifica.map((r) => `${r.nome} ${r.punti}`).join(', ')} (attesi ${Object.entries(punti).map(([k, v]) => `${k} ${v}`).join(', ')})`);
  const ordinata = classifica.every((r, i) => i === 0 || classifica[i - 1].punti >= r.punti);
  et(ordinata, 'e in ordine di punti');
  await vai('#/classifica', 1000);
  await p.screenshot({ path: `${USCITA}/lega-privata-classifica.png` }).catch(() => {});
  console.log('  esiti:', esiti.map((e) => `${e.casa} ${e.hs} (${e.hg}) – ${e.ospite} ${e.as} (${e.ag})`).join(' | '));

  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
  await b.close();
  for (const x of ok) console.log('  ok  ' + x);
  for (const x of ko) console.log('  KO  ' + x);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
