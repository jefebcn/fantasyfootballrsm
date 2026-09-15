import * as S from '../state.js';
import { esc, fmt, icon, faccia, avatarGrande, ROLE_NAME } from '../ui.js';
import { roleName } from '../engine.js';

/**
 * Due giocatori affiancati.
 *
 * Nasce dalla domanda che si fa ogni settimana e a cui l'app non rispondeva:
 * "schiero questo o quello?". Prima bisognava aprire due schede e tenere i
 * numeri a mente. Con voti oggettivi il confronto vale anche di piu' che nel
 * fantacalcio normale: non c'e' un giudizio di redazione da interpretare,
 * sono presenze, gol, cartellini e minuti.
 */

const P = (id) => S.playersById.get(id);
const CB = (id) => S.clubsById.get(P(id)?.clubId);

/** La colonnina delle ultime cinque: alta quanto il voto, grigia se S.V. */
function tendenza(r) {
  if (!r.ultime.length) return '<p class="small muted">Nessuna giornata giocata.</p>';
  return `<div class="tend" role="img" aria-label="${r.ultime.map((x) => x.sv ? `giornata ${x.n} senza voto` : `giornata ${x.n} ${fmt(x.fv)}`).join(', ')}">
    ${r.ultime.map((x) => {
    // la scala parte da 3 e arriva a 10: sotto il 3 non si scende quasi mai e
    // partire da zero appiattirebbe tutte le colonne sullo stesso terzo
    const h = x.sv ? 8 : Math.max(8, Math.min(100, ((x.fv - 3) / 7) * 100));
    return `<span class="cl${x.sv ? ' sv' : x.fv >= 6.5 ? ' bene' : x.fv < 5.5 ? ' male' : ''}">
        <i style="height:${h}%"></i><small>${x.sv ? '–' : fmt(x.fv)}</small><b>${x.n}</b></span>`;
  }).join('')}</div>`;
}

const RIGHE = [
  ['Media fantavoto', (r) => r.media === null ? '–' : fmt(r.media), true],
  ['Media Voto Titano', (r) => r.mediaBase === null ? '–' : fmt(r.mediaBase), true],
  ['Ultime 5', (r) => r.mediaUltime === null ? '–' : fmt(r.mediaUltime), true],
  ['Presenze', (r) => `${r.presenze}/${r.giocabili}`, true],
  ['Minuti', (r) => r.minuti ? `${r.minuti}'` : '–', true],
  ['Gol', (r) => r.eventi.goal || '–', true],
  ['Assist', (r) => (r.eventi.assist + r.eventi.assist_set) || '–', true],
  ['Ammonizioni', (r) => r.eventi.yellow || '–', false],
  ['Espulsioni', (r) => (r.eventi.second_yellow + r.eventi.red_direct) || '–', false],
  // La quotazione non ha un verso migliore: costare piu' non vuol dire valere
  // di piu', e evidenziarla come una vittoria sarebbe un consiglio sbagliato.
  ['Quotazione', (r) => r.player?.quotation ?? '–', null],
];

/** Chi si può confrontare: stesso ruolo. Prima la propria rosa. */
function candidati(ruolo, escludi) {
  const me = S.me();
  const miei = me ? S.rosterOf(me.id).filter((x) => x.player.role === ruolo && x.playerId !== escludi) : [];
  const avuti = new Set();
  for (const m of S.base.managers) for (const r of (S.base.rosters[m.id] || [])) avuti.add(r.playerId);
  const altri = S.base.players
    .filter((p) => p.role === ruolo && p.isActive && p.id !== escludi && !miei.some((x) => x.playerId === p.id))
    .sort((a, b) => b.quotation - a.quotation).slice(0, 40);
  return { miei, altri, avuti };
}

export const confronto = {
  title: 'Confronto', appbar: 'back', sub: () => 'Due giocatori, stessi numeri',
  render({ params }) {
    const a = P(params.a);
    if (!a) return `<main class="a-body"><div class="empty"><p>Giocatore non trovato.</p></div></main>`;
    const b = params.b ? P(params.b) : null;

    if (!b) {
      const { miei, altri } = candidati(a.role, a.id);
      const riga = (p, extra = '') => `<a class="vr" href="#/confronto/${esc(a.id)}/${esc(p.id)}" style="text-decoration:none">
        ${faccia(p, S.clubsById.get(p.clubId))}
        <span class="nm"><b>${esc(p.name)}</b><span>${esc(S.clubsById.get(p.clubId).name)} · quot. ${p.quotation}${extra}</span></span>
        ${icon('chev', 'ic sm chev')}</a>`;
      return `<main class="a-body">
        <div class="a-card" style="display:flex;gap:12px;align-items:center">${faccia(a, CB(a.id))}
          <div style="flex:1;min-width:0"><b>${esc(a.name)}</b><br><span class="small muted">${roleName(a.role)} · con chi lo confronti?</span></div></div>
        ${miei.length ? `<div class="vlist"><div class="vhead">Dalla tua rosa <span>${miei.length}</span></div>${miei.map((x) => riga(x.player)).join('')}</div>` : ''}
        <div class="vlist"><div class="vhead">${ROLE_NAME[a.role]} del campionato <span>per quotazione</span></div>${altri.map((p) => riga(p)).join('')}</div>
      </main>`;
    }

    const ra = S.rendimento(a.id), rb = S.rendimento(b.id);
    const testa = (p, r) => `<div class="cc">${avatarGrande(p, S.clubsById.get(p.clubId))}
      <b>${esc(p.lastName)}</b><span>${esc(S.clubsById.get(p.clubId).name)}</span>
      ${r.media !== null ? `<em>${fmt(r.media)}</em>` : '<em class="niente">–</em>'}</div>`;

    const righe = RIGHE.map(([etichetta, valore, altoMeglio]) => {
      const va = valore(ra), vb = valore(rb);
      // Il confronto si evidenzia solo quando i due numeri sono davvero
      // confrontabili: con un "–" da una parte non c'e' un vincitore.
      const na = Number(String(va).replace(',', '.')), nb = Number(String(vb).replace(',', '.'));
      let vinceA = false, vinceB = false;
      if (altoMeglio !== null && Number.isFinite(na) && Number.isFinite(nb) && na !== nb) {
        const meglioA = altoMeglio ? na > nb : na < nb;
        vinceA = meglioA; vinceB = !meglioA;
      }
      return `<div class="cr"><span class="v${vinceA ? ' top' : ''}">${va}</span>
        <span class="et">${etichetta}</span><span class="v${vinceB ? ' top' : ''}">${vb}</span></div>`;
    }).join('');

    const forma = (r) => r.scarto === null ? ''
      : `<span class="scarto ${r.scarto > 0.2 ? 'su' : r.scarto < -0.2 ? 'giu' : 'pari'}">${r.scarto > 0 ? '+' : ''}${fmt(r.scarto)} sulla media</span>`;

    return `<main class="a-body">
      <div class="a-card conf"><div class="ctesta">${testa(a, ra)}<span class="vs">vs</span>${testa(b, rb)}</div>
        ${righe}</div>
      <div class="a-sec"><b>Ultime cinque giornate</b><span>di chi ha giocato</span></div>
      <div class="a-card"><p class="small muted" style="margin:0 0 8px">${esc(a.lastName)} ${forma(ra)}</p>${tendenza(ra)}</div>
      <div class="a-card"><p class="small muted" style="margin:0 0 8px">${esc(b.lastName)} ${forma(rb)}</p>${tendenza(rb)}</div>
      <div class="vlist"><div class="vhead">Le schede</div>
        <a class="vr" href="#/giocatore/${esc(a.id)}" style="text-decoration:none">${faccia(a, CB(a.id))}<span class="nm"><b>${esc(a.name)}</b><span>storico giornata per giornata</span></span>${icon('chev', 'ic sm chev')}</a>
        <a class="vr" href="#/giocatore/${esc(b.id)}" style="text-decoration:none">${faccia(b, CB(b.id))}<span class="nm"><b>${esc(b.name)}</b><span>storico giornata per giornata</span></span>${icon('chev', 'ic sm chev')}</a></div>
      <a class="a-btn sec" href="#/confronto/${esc(a.id)}" style="text-decoration:none;justify-content:center">Confronta ${esc(a.lastName)} con un altro</a>
    </main>`;
  },
};

