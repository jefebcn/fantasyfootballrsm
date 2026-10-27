import * as S from '../state.js';
import { esc, avatarGrande, faccia } from '../ui.js';
import { oggi, numero, misteroDel, statistiche, confronta, condivisione, serie, punti, MEDAGLIE, prossimaMedaglia, TENTATIVI } from '../gioco.js';

/**
 * «Chi è?», la schermata. La logica (chi e' il giocatore del giorno, gli
 * indizi) sta in src/gioco.js.
 *
 * Si apre dalla carta in Home (views/dashboard.js). La partita sta sul
 * telefono (localStorage); al database va solo com'e' andata (048), che
 * serve ai conteggi dell'admin e alla classifica del mese e alle serie (049).
 *
 * PERCHE' CONTINUARE (Alex, 27/10: «spiegargli che cosa si vince tenendo la
 * serie o una classifica»): i punti del mese, la classifica di tutti e della
 * propria lega, il «Re del Titano» del mese prima, le medaglie della serie.
 * Tutto spiegato nella scheda «Perché giocare ogni giorno», che si apre da
 * sola la prima volta e poi dal tasto ⓘ.
 */

const CHIAVE = 'fcs:gioco';
const leggi = () => { try { return JSON.parse(localStorage.getItem(CHIAVE)) || {}; } catch { return {}; } };
const scrivi = (s) => { try { localStorage.setItem(CHIAVE, JSON.stringify(s)); } catch { /* telefono senza spazio o in privato: si gioca lo stesso */ } };

// Le statistiche si rifanno solo quando cambiano i dati della stagione.
let stat = null, statDi = null;
const dati = () => { if (statDi !== S.base) { stat = statistiche(S.base); statDi = S.base; } return stat; };

let q = '';
// classifica e serie dal database: si chiedono una volta per giorno e per
// classifica scelta (tutti o lega), e si richiedono dopo ogni partita finita
let extra = { chiave: null, classifica: undefined, re: undefined, mio: undefined };
let ambito = 'tutti';
const VISTA = 'fcs:gioco:spiegato';
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const mesePrima = (giorno) => { const [a, m] = giorno.split('-').map(Number); return m === 1 ? `${a - 1}-12-01` : `${a}-${String(m - 1).padStart(2, '0')}-01`; };
const legaId = () => (S.appState() === 'ready' ? S.base.league?.id || null : null);

function spiegazione() {
  return `<h3>Perché giocare ogni giorno</h3>
    <div class="ce-perche">
      <p><b>🎯 Punti</b>Indovinato al 1° tentativo vale 6 punti, al 2° 5, fino a 1 punto al 6°. Si sommano per tutto il mese.</p>
      <p><b>🏆 Classifica del mese</b>Quella di tutti e quella della tua lega, sfida gli amici. Ogni 1° del mese si riparte da zero.</p>
      <p><b>👑 Re del Titano</b>Chi chiude il mese al primo posto è il Re del Titano: la corona accanto al nome per tutto il mese dopo, e il nome nella storia di Fantatitano su Instagram.</p>
      <p><b>🔥 Serie e medaglie</b>Indovina più giorni di fila: ${MEDAGLIE.map((m) => `${m.icona} ${m.giorni} giorni «${m.nome}»`).join(', ')}. Le medaglie restano anche se la serie si rompe.</p>
    </div>
    <button class="a-btn" data-chiudi>Ho capito, si gioca</button>`;
}

function premi(giorno, serieQui, finito, vinto, nTent) {
  const mio = extra.mio;
  const migliore = Math.max(mio?.serie_max || 0, serieQui);
  const medaglie = `<div class="ce-medaglie">${MEDAGLIE.map((m) => `<span class="ce-med${migliore >= m.giorni ? ' on' : ''}" title="${esc(m.nome)}"><i aria-hidden="true">${m.icona}</i><b>${esc(m.nome)}</b><small>${migliore >= m.giorni ? 'presa' : `${m.giorni} di fila`}</small></span>`).join('')}</div>`;
  const prossima = prossimaMedaglia(serieQui);
  const stimolo = finito
    ? `<p class="ce-stimolo">${vinto ? `+${punti(nTent, true)} punti oggi. ` : ''}${prossima ? `${vinto ? `Domani fai ${serieQui + 1} di fila` : 'Domani riparti'}: a ${prossima.giorni} prendi ${prossima.icona} «${esc(prossima.nome)}».` : 'Sei una leggenda: tieni la serie!'}</p>`
    : '';
  const [, mm] = giorno.split('-').map(Number);
  let tabella;
  if (extra.classifica === undefined) tabella = '<p class="small muted">Carico la classifica…</p>';
  else if (extra.classifica === null) tabella = '<p class="small muted">La classifica si vede con un account, a gioco online.</p>';
  else if (!extra.classifica.length) tabella = `<p class="small muted">${ambito === 'lega' ? 'Nessuno della tua lega' : 'Nessuno'} ha ancora giocato questo mese: il primo posto è libero.</p>`;
  else {
    tabella = `<ol class="ce-classifica">${extra.classifica.map((r) => `<li class="${r.io ? 'io' : ''}"><span class="pos">${r.posizione}</span><span class="nm">${esc(r.nome)}${extra.re && extra.re === r.nome ? ' <i aria-label="Re del Titano">👑</i>' : ''}${r.io ? ' <small>tu</small>' : ''}</span><span class="pt"><b>${r.punti}</b> pt</span></li>`).join('')}</ol>`;
  }
  const scelta = legaId() ? `<div class="chips"><button class="chip${ambito === 'tutti' ? ' on' : ''}" data-ambito="tutti">Tutti</button><button class="chip${ambito === 'lega' ? ' on' : ''}" data-ambito="lega">La mia lega</button></div>` : '';
  const re = extra.re ? `<p class="ce-re">👑 Re del Titano di ${MESI[(mm + 10) % 12]}: <b>${esc(extra.re)}</b></p>` : '';
  return { stimolo, resto: `
    <div class="a-sec"><b>Medaglie</b><span>serie più lunga: ${migliore}</span></div>${medaglie}
    <div class="a-sec"><b>Classifica di ${MESI[mm - 1]}</b><span>punti del mese</span></div>${scelta}${re}${tabella}` };
}

async function caricaPremi(ctx) {
  const giorno = oggi(S.now());
  const lega = ambito === 'lega' ? legaId() : null;
  const chiave = `${giorno}|${ambito}|${lega}|${(leggi()[giorno] || { tentativi: [] }).tentativi.length}`;
  if (extra.chiave === chiave) return;
  extra = { chiave, classifica: extra.classifica, re: extra.re, mio: extra.mio };
  const [classifica, prima, mio] = await Promise.all([S.classificaGioco(null, lega), S.classificaGioco(mesePrima(giorno), lega), S.mioGioco()]);
  if (extra.chiave !== chiave) return;
  extra = { chiave, classifica, re: prima?.find((r) => r.posizione === 1)?.nome || null, mio };
  if (location.hash.startsWith('#/gioco')) ctx.render();
}
const piano = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const NOMI = { squadra: 'Club', ruolo: 'Ruolo', eta: 'Età', quotazione: 'Quot.', presenze: 'Pres.', gol: 'Gol' };
const ESITO = { si: 'giusto', vicino: 'vicino', no: 'sbagliato' };

function cella(x) {
  const v = x.chiave === 'squadra' ? S.clubsById.get(x.valore)?.shortName || x.valore : x.valore;
  const freccia = x.verso === 'su' ? '↑' : x.verso === 'giu' ? '↓' : '';
  const detto = `${NOMI[x.chiave]} ${v}: ${ESITO[x.esito]}${x.verso === 'su' ? ', il giocatore del giorno ne ha di più' : x.verso === 'giu' ? ', il giocatore del giorno ne ha di meno' : ''}`;
  return `<span class="ce-c ${x.esito}" role="img" aria-label="${esc(detto)}"><b>${esc(v)}</b>${freccia ? `<i aria-hidden="true">${freccia}</i>` : ''}</span>`;
}

function suggerimenti(gia) {
  const t = piano(q);
  if (t.length < 2) return '';
  const presi = new Set(gia);
  const lista = S.base.players
    .filter((p) => p.isActive && !p.doppioneDi && !presi.has(p.id) && (piano(p.lastName).includes(t) || piano(`${p.firstName} ${p.lastName}`).includes(t)))
    .sort((a, b) => (piano(a.lastName).startsWith(t) ? 0 : 1) - (piano(b.lastName).startsWith(t) ? 0 : 1) || b.quotation - a.quotation)
    .slice(0, 6);
  if (!lista.length) return '<p class="small muted ce-niente">Nessun giocatore con questo nome.</p>';
  return lista.map((p) => { const c = S.clubsById.get(p.clubId);
    return `<button class="ce-sug" data-pick="${p.id}">${faccia(p, c)}<span class="nm"><b>${esc(p.firstName)} ${esc(p.lastName)}</b><span>${esc(c?.name || '')}</span></span></button>`; }).join('');
}

/**
 * Come sta la partita di oggi, per la carta in Home: il numero, se e' gia'
 * giocata, com'e' finita, la serie.
 */
export function partitaDiOggi() {
  const giorno = oggi(S.now());
  const mistero = misteroDel(giorno, S.base.players, dati());
  if (!mistero) return null;
  const storico = leggi();
  const partita = storico[giorno] || { tentativi: [] };
  const vinto = !!partita.vinto;
  return { numero: numero(giorno), tentativi: partita.tentativi.length, vinto,
    finito: vinto || partita.tentativi.length >= TENTATIVI, serie: serie(storico, giorno), mistero };
}

export const gioco = {
  title: 'Chi è?', sub: () => 'Chi è?',
  render() {
    const giorno = oggi(S.now());
    const mistero = misteroDel(giorno, S.base.players, dati());
    if (!mistero) return '<main class="a-body"><div class="empty"><p>Il gioco parte a stagione iniziata: torna dopo le prime giornate.</p></div></main>';
    const storico = leggi();
    const partita = storico[giorno] || { tentativi: [] };
    const tentativi = partita.tentativi.map((id) => S.playersById.get(id)).filter(Boolean);
    const vinto = tentativi.some((p) => p.id === mistero.id);
    const finito = vinto || tentativi.length >= TENTATIVI;
    const club = S.clubsById.get(mistero.clubId);
    const righe = tentativi.map((p) => ({ p, r: confronta(p, mistero, dati()) }));
    const fiamma = serie(storico, giorno);

    const testa = `<div class="a-card ce-testa">
      <div class="ce-num"><b>#${numero(giorno)} <button class="ce-info" data-info aria-label="Perché giocare ogni giorno">ⓘ</button></b><span>Il giocatore del giorno</span></div>
      <div class="ce-conti"><span><b>${tentativi.length}/${TENTATIVI}</b> tentativi</span><span><b>${fiamma}</b> di fila</span></div>
    </div>`;
    // Chi non l'ha indovinato sceglie se scoprirlo (Alex, 27/10: «clicchi e
    // c'e' scritto rivela il giocatore»): magari vuole chiederlo agli amici.
    const volto = finito && !vinto && !partita.rivelato
      ? `<div class="a-card ce-mistero ce-perso"><span class="ce-sagoma" aria-hidden="true">?</span><div><b>Non l'hai indovinato</b><p>Sei tentativi finiti. Vuoi sapere chi era?</p><button class="a-btn sec" data-rivela>Rivela il giocatore</button></div></div>`
      : finito
      ? `<div class="a-card ce-rivela">${avatarGrande(mistero, club)}<div><span class="small muted">${vinto ? `Indovinato in ${tentativi.length}` : 'Era lui'}</span><b>${esc(mistero.firstName)} ${esc(mistero.lastName)}</b><span>${esc(club?.name || '')}</span></div></div>`
      : `<div class="a-card ce-mistero"><span class="ce-sagoma" aria-hidden="true">?</span><p>Un giocatore del Campionato Sammarinese. Scrivi un nome: per squadra, ruolo, età, quotazione, presenze e gol ti dico quanto ci sei vicino.</p></div>`;
    const griglia = righe.length ? `<div class="ce-griglia" role="table" aria-label="I tuoi tentativi">
      <div class="ce-riga ce-intesta" role="row"><span></span>${Object.values(NOMI).map((n) => `<span role="columnheader">${n}</span>`).join('')}</div>
      ${righe.map(({ p, r }) => `<div class="ce-riga" role="row"><span class="ce-chi">${esc(p.lastName)}</span>${r.map(cella).join('')}</div>`).join('')}
    </div>` : '';
    const sotto = finito
      ? `<div class="ce-fine"><button class="a-btn" id="ce-condividi">Condividi il risultato</button><p class="small muted">Domani un giocatore nuovo, dalla mezzanotte.</p></div>`
      : `<div class="ce-cerca"><input class="field-input" id="ce-q" placeholder="Scrivi un cognome" value="${esc(q)}" autocomplete="off" autocapitalize="words" enterkeyhint="search"><div class="ce-sugs" id="ce-sugs">${suggerimenti(partita.tentativi)}</div></div>`;
    const legenda = `<p class="small muted ce-legenda"><span class="ce-c si"></span> giusto · <span class="ce-c vicino"></span> vicino (età ±2, quotazione ±3, presenze e gol ±1) · ↑↓ il giocatore del giorno ne ha di più o di meno</p>`;
    const pr = premi(giorno, fiamma, finito, vinto, tentativi.length);
    return `<main class="a-body ce">${testa}${volto}${griglia}${sotto}${pr.stimolo}${pr.resto}${legenda}</main>`;
  },
  mount(root, ctx) {
    caricaPremi(ctx);
    let gia = true; try { gia = !!localStorage.getItem(VISTA); } catch { /* niente */ }
    if (!gia) { try { localStorage.setItem(VISTA, '1'); } catch { /* niente */ } ctx.sheet(spiegazione()); }
    const foglio = document.getElementById('sheet');
    if (foglio && !foglio.dataset.giocoChiudi) { foglio.dataset.giocoChiudi = '1'; foglio.addEventListener('click', (e) => { if (e.target.closest('[data-chiudi]')) ctx.sheet(null); }); }
    const inp = root.querySelector('#ce-q');
    if (inp) {
      inp.oninput = () => {
        q = inp.value;
        const giorno = oggi(S.now());
        root.querySelector('#ce-sugs').innerHTML = suggerimenti((leggi()[giorno] || { tentativi: [] }).tentativi);
      };
    }
    root.querySelector('main').addEventListener('click', async (e) => {
      if (e.target.closest('[data-info]')) { ctx.sheet(spiegazione()); return; }
      if (e.target.closest('[data-rivela]')) {
        const giorno = oggi(S.now()); const storico = leggi();
        if (storico[giorno]) { storico[giorno].rivelato = true; scrivi(storico); }
        ctx.render(); return;
      }
      const am = e.target.closest('[data-ambito]');
      if (am) { ambito = am.dataset.ambito; extra = { chiave: null, classifica: undefined, re: undefined, mio: extra.mio }; ctx.render(); return; }
      const b = e.target.closest('[data-pick]');
      if (b) {
        const giorno = oggi(S.now());
        const storico = leggi();
        const partita = storico[giorno] || { tentativi: [] };
        if (partita.tentativi.length >= TENTATIVI || partita.vinto) return;
        partita.tentativi.push(b.dataset.pick);
        const mistero = misteroDel(giorno, S.base.players, dati());
        partita.vinto = b.dataset.pick === mistero?.id;
        storico[giorno] = partita;
        scrivi(storico);
        // ai conteggi dell'admin va solo com'e' andata, non i nomi scritti
        S.salvaPartitaGioco(giorno, partita.tentativi.length, partita.vinto);
        q = '';
        ctx.render();
        if (partita.vinto || partita.tentativi.length < TENTATIVI) root.querySelector('#ce-q')?.focus();
        return;
      }
      if (e.target.closest('#ce-condividi')) {
        const giorno = oggi(S.now());
        const partita = leggi()[giorno];
        const mistero = misteroDel(giorno, S.base.players, dati());
        if (!partita || !mistero) return;
        const righe = partita.tentativi.map((id) => S.playersById.get(id)).filter(Boolean).map((p) => confronta(p, mistero, dati()));
        const text = condivisione(giorno, righe, !!partita.vinto);
        if (navigator.share) { try { await navigator.share({ text }); } catch { /* annullato */ } } else { try { await navigator.clipboard.writeText(text); ctx.toast('Risultato copiato'); } catch { ctx.toast('Copia non riuscita'); } }
      }
    });
  },
};
