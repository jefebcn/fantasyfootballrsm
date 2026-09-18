import * as S from '../state.js';
import { SV_STATUSES } from '../engine.js';
import { esc, badge, voteRow, logo, icon, dateIt, timeIt } from '../ui.js';

/**
 * Perche' i voti di una gara non ci sono, detto a parole.
 *
 * Prima la nota era una sola riga con dentro "art. 10" e "S.V." per
 * QUALSIASI stato diverso da "giocata", e per gli stati senza una frase
 * propria stampava la parola del database: sullo schermo si leggeva
 * "TRE FIORI - VIRTUS / scheduled / art. 10 / S.V." su una partita che
 * semplicemente non si era ancora giocata.
 */
const STATI = {
  scheduled: { ic: 'clock', cls: 'attesa', t: 'Non ancora giocata' },
  postponed: { ic: 'warn', cls: 'fermo', t: 'Gara rinviata', d: 'Si recupera entro martedì alle 18:00 (art. 10).' },
  suspended_before_45: { ic: 'warn', cls: 'fermo', t: "Sospesa prima del 45'", d: 'Gli eventi della gara sono annullati (art. 10).' },
  suspended_after_45: { ic: 'warn', cls: 'fermo', t: "Sospesa dopo il 45'", d: 'Gli eventi restano validi, il risultato no (art. 10).' },
  awarded: { ic: 'flag', cls: 'tavolino', t: 'Decisa a tavolino', d: 'Il campo non fa testo: la gara è assegnata a tavolino (art. 10).' },
};
/** La riga di stato in cima alla lista dei voti di una gara. */
function notaStato(m) {
  if (m.status === 'played') return '';
  const s = STATI[m.status] || { ic: 'clock', cls: 'attesa', t: 'Voti non disponibili' };
  // Per una gara ancora da giocare la cosa utile e' quando si gioca: la data
  // ce l'ha il calendario. Se l'ora e' gia' passata si aspetta il referto.
  const quando = m.kickoffAt && new Date(m.kickoffAt) > S.now()
    ? `Si gioca ${dateIt(m.kickoffAt)} alle ${timeIt(m.kickoffAt)}.`
    : 'I voti arrivano quando il Giudice Dati carica il referto.';
  // "S.V. per tutti" solo dove e' vero davvero: la lista degli stati senza
  // voto e' quella del motore (art. 10), non una copia scritta qui.
  const sv = SV_STATUSES.has(m.status) ? '<span class="vnota-e">S.V. per tutti</span>' : '';
  return `<div class="vnota vnota--${s.cls}">${icon(s.ic)}<div class="vnota-t"><b>${esc(s.t)}</b><span>${esc(s.d || quando)}</span></div>${sv}</div>`;
}

/**
 * La barra della giornata in corso.
 *
 * Una pastiglia larga mezza schermata con dentro due parole e basta non dice
 * niente: la domanda vera, con la giornata aperta, e' "quante partite sono
 * gia' arrivate". Quelle arrivano dall'import della FSGC (ogni mattina, o
 * dalle mani del Giudice Dati), quindi qui si conta e si mostra: pastiglia,
 * avanzamento, conteggio.
 */
function barraLive(n) {
  const gare = S.matchesOf(n);
  const arrivate = gare.filter((m) => m.status !== 'scheduled').length;
  const quota = gare.length ? Math.round((arrivate / gare.length) * 100) : 0;
  return `<div class="statolive">${badge('live')}
    <i class="statolive-t" role="progressbar" aria-valuenow="${arrivate}" aria-valuemin="0" aria-valuemax="${gare.length}" aria-label="Partite con i voti"><i style="width:${quota}%"></i></i>
    <b>${arrivate}/${gare.length}</b></div>`;
}

let filter = { role: null, mine: false };
export const voti = {
  title: 'Voti', sub: ({ params }) => `Voti · Giornata ${params.n || S.currentMatchday()}`,
  render({ params }) {
    const n = Math.min(30, Math.max(1, +params.n || S.currentMatchday())); const st = S.matchdayStatus(n); const me = S.me();
    const mine = new Set(S.rosterIds(me.id)); const ratings = S.ratingsOf(n);
    const evByPlayer = (matchId) => { const m = {}; for (const e of S.eventsOf(matchId)) (m[e.playerId] ||= []).push(e); return m; };
    const blocks = S.matchesOf(n).map((m) => {
      const h = S.clubsById.get(m.homeClubId), a = S.clubsById.get(m.awayClubId); const evs = evByPlayer(m.id);
      let rows = S.appearancesOf(m.id).map((ap) => ({ ap, p: S.playersById.get(ap.playerId), r: ratings.get(ap.playerId) }));
      if (filter.role) rows = rows.filter((x) => x.p.role === filter.role);
      if (filter.mine) rows = rows.filter((x) => mine.has(x.p.id));
      rows.sort((x, y) => (y.r?.isSV ? -1 : y.r?.fantaVote ?? -1) - (x.r?.isSV ? -1 : x.r?.fantaVote ?? -1));
      const nota = notaStato(m);
      if (!rows.length && !nota) return '';
      const title = m.status === 'played' ? `${esc(h.name)} ${m.homeGoals} – ${m.awayGoals} ${esc(a.name)}` : `${esc(h.name)} — ${esc(a.name)}`;
      return `<div class="vlist"><div class="vhead">${title} <span>${m.venue ? esc(m.venue) : ''}</span></div>${nota}${rows.map(({ ap, p, r }) => voteRow(p, S.clubsById.get(p.clubId), r ? { ...r, events: evs[p.id] || [] } : null, { minutes: ap.minutesPlayed, extra: st === 'provisional' ? `<a href="#" data-contest="${p.id}" data-match="${m.id}">Segnala un errore</a>` : '' })).join('')}</div>`;
    }).join('');
    return `<main class="a-body">
      <div class="topbar">${st === 'live' ? barraLive(n) : badge(st, st === 'provisional' ? 'fino a mar 18:00' : '')}<select id="gsel-v" class="select" aria-label="Giornata">${Array.from({ length: 30 }, (_, i) => `<option value="${i + 1}" ${i + 1 === n ? 'selected' : ''}>Giornata ${i + 1}</option>`).join('')}</select></div>
      <div class="chips sticky"><button class="chip${!filter.role && !filter.mine ? ' on' : ''}" data-f="all">Tutti</button><button class="chip${filter.mine ? ' on' : ''}" data-f="mine">Solo miei</button>${['P', 'D', 'C', 'A'].map((r) => `<button class="chip${filter.role === r ? ' on' : ''}" data-f="${r}">${r}</button>`).join('')}</div>
      ${blocks || `<div class="empty">${logo()}<p>Nessun voto per la giornata ${n}: ${st === 'open' || st === 'scheduled' ? 'le partite non sono ancora state giocate.' : 'nessun evento inserito.'}</p></div>`}
    </main>`;
  },
  mount(root, ctx) {
    root.querySelector('#gsel-v').onchange = (e) => ctx.go(`voti/${e.target.value}`);
    root.querySelector('main').addEventListener('click', (e) => {
      const f = e.target.closest('[data-f]'); if (f) { const v = f.dataset.f; filter = v === 'all' ? { role: null, mine: false } : v === 'mine' ? { ...filter, mine: !filter.mine } : { ...filter, role: filter.role === v ? null : v }; ctx.render(); return; }
      const c = e.target.closest('[data-contest]'); if (c) {
        e.preventDefault(); const p = S.playersById.get(c.dataset.contest); const m = S.match(c.dataset.match);
        ctx.sheet(`<h3>Segnala un errore</h3><p class="small muted">${esc(p.name)} · ${esc(S.clubsById.get(m.homeClubId).name)} — ${esc(S.clubsById.get(m.awayClubId).name)}. Indica evento e minuto (art. 9.3). Scadenza martedì 18:00.</p>
          <label class="lbl" for="c-min">Minuto</label><input class="field-input" id="c-min" type="number" min="0" max="90" placeholder="es. 78">
          <label class="lbl" for="c-txt" style="margin-top:10px">Cosa contesti</label><input class="field-input" id="c-txt" placeholder="es. assist non registrato">
          <button class="a-btn" id="c-send" style="margin-top:12px">Invia contestazione</button>`);
        document.getElementById('c-send').onclick = () => { const txt = document.getElementById('c-txt').value.trim(); if (!txt) { ctx.toast('Descrivi l\'evento contestato'); return; } S.addContestazione({ playerId: p.id, matchId: m.id, minute: +document.getElementById('c-min').value || null, text: txt }); ctx.sheet(null); ctx.toast('Contestazione inviata al Giudice Dati'); };
      }
    });
  },
};
