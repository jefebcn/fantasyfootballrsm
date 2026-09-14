import * as S from '../state.js';
import { esc, fmt, icon, badge, voteRow, roleChip, logo } from '../ui.js';

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
      const svNote = m.status !== 'played' ? `<div class="vb on"><div><span>${{ postponed: 'Gara rinviata · recupero entro mar 18:00', suspended_before_45: 'Sospesa prima del 45\': eventi annullati', suspended_after_45: 'Sospesa dopo il 45\': eventi validi, niente esito', awarded: 'A tavolino: S.V. per tutti' }[m.status] || m.status}<em>art. 10</em></span><span>S.V.</span></div></div>` : '';
      if (!rows.length && !svNote) return '';
      const title = m.status === 'played' ? `${esc(h.name)} ${m.homeGoals} – ${m.awayGoals} ${esc(a.name)}` : `${esc(h.name)} — ${esc(a.name)}`;
      return `<div class="vlist"><div class="vhead">${title} <span>${esc(m.venue)}</span></div>${svNote}${rows.map(({ ap, p, r }) => voteRow(p, S.clubsById.get(p.clubId), r ? { ...r, events: evs[p.id] || [] } : null, { minutes: ap.minutesPlayed, extra: st === 'provisional' ? `<a href="#" data-contest="${p.id}" data-match="${m.id}">Segnala un errore</a>` : '' })).join('')}</div>`;
    }).join('');
    return `<main class="a-body">
      <div class="topbar">${badge(st)}<select id="gsel-v" class="select" aria-label="Giornata">${Array.from({ length: 30 }, (_, i) => `<option value="${i + 1}" ${i + 1 === n ? 'selected' : ''}>Giornata ${i + 1}</option>`).join('')}</select></div>
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
