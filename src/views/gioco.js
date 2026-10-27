import * as S from '../state.js';
import { esc, avatarGrande, faccia } from '../ui.js';
import { oggi, numero, misteroDel, statistiche, confronta, condivisione, serie, TENTATIVI } from '../gioco.js';

/**
 * «Chi è?», la schermata. La logica (chi e' il giocatore del giorno, gli
 * indizi) sta in src/gioco.js.
 *
 * Per ora non c'e' nel menu: si apre da #/gioco, finche' Alex non decide di
 * lanciarlo. Le partite restano sul telefono (localStorage); la classifica
 * fra chi gioca arriva col database, in un secondo passo.
 */

const CHIAVE = 'fcs:gioco';
const leggi = () => { try { return JSON.parse(localStorage.getItem(CHIAVE)) || {}; } catch { return {}; } };
const scrivi = (s) => { try { localStorage.setItem(CHIAVE, JSON.stringify(s)); } catch { /* telefono senza spazio o in privato: si gioca lo stesso */ } };

// Le statistiche si rifanno solo quando cambiano i dati della stagione.
let stat = null, statDi = null;
const dati = () => { if (statDi !== S.base) { stat = statistiche(S.base); statDi = S.base; } return stat; };

let q = '';
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
      <div class="ce-num"><b>#${numero(giorno)}</b><span>Il giocatore del giorno</span></div>
      <div class="ce-conti"><span><b>${tentativi.length}/${TENTATIVI}</b> tentativi</span><span><b>${fiamma}</b> di fila</span></div>
    </div>`;
    const volto = finito
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
    return `<main class="a-body ce">${testa}${volto}${griglia}${sotto}${legenda}</main>`;
  },
  mount(root, ctx) {
    const inp = root.querySelector('#ce-q');
    if (inp) {
      inp.oninput = () => {
        q = inp.value;
        const giorno = oggi(S.now());
        root.querySelector('#ce-sugs').innerHTML = suggerimenti((leggi()[giorno] || { tentativi: [] }).tentativi);
      };
    }
    root.querySelector('main').addEventListener('click', async (e) => {
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
