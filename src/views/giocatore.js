import * as S from '../state.js';
import { esc, fmt, roleChip, voteRow, avatarGrande } from '../ui.js';
import { roleName } from '../engine.js';

export const giocatore = {
  title: 'Giocatore', appbar: 'back', sub: ({ params }) => S.playersById.get(params.id)?.name || 'Giocatore',
  render({ params }) {
    const p = S.playersById.get(params.id); if (!p) return '<main class="a-body"><div class="empty"><p>Giocatore non trovato.</p></div></main>';
    const club = S.clubsById.get(p.clubId); let owner = null; for (const m of S.base.managers) if (S.base.rosters[m.id].some((r) => r.playerId === p.id)) owner = m;
    const hist = []; let sum = 0, cnt = 0;
    for (let n = 1; n <= S.currentMatchday(); n++) { const r = S.ratingsOf(n).get(p.id); const m = S.matchesOf(n).find((x) => x.homeClubId === p.clubId || x.awayClubId === p.clubId); const evs = m ? S.eventsOf(m.id).filter((e) => e.playerId === p.id) : []; hist.push({ n, r, m, evs }); if (r && !r.isSV) { sum += r.fantaVote; cnt++; } }
    return `<main class="a-body">
      <div class="a-card" style="display:flex;gap:14px;align-items:center">${avatarGrande(p, club)}<div style="flex:1"><b style="font:700 18px var(--font-display)">${esc(p.firstName)} ${esc(p.lastName)}</b><br><span class="small muted">${esc(club.name)} · ${roleName(p.role)} · ${p.isActive ? (owner ? `di ${esc(owner.teamName)}` : 'svincolato') : '<b style="color:var(--negative)">fuori dal campionato (art. 3.3)</b>'}</span></div>${roleChip(p.role)}</div>
      <div class="a-card a-stats"><div><b>${p.quotation}</b><span>Quotazione</span></div><div><b>${cnt ? fmt(sum / cnt) : '–'}</b><span>Media FV</span></div><div><b>${cnt}</b><span>Presenze</span></div><div><b>${hist.reduce((s, h) => s + h.evs.filter((e) => e.type === 'goal').length, 0)}</b><span>Gol</span></div></div>
      <div class="vlist"><div class="vhead">Storico giornate</div>${hist.map(({ n, r, m, evs }) => voteRow({ ...p, name: `Giornata ${n}` }, m ? { name: `${S.clubsById.get(m.homeClubId).name} ${m.status === 'played' ? `${m.homeGoals}-${m.awayGoals}` : '—'} ${S.clubsById.get(m.awayClubId).name}` } : null, r ? { ...r, events: evs } : null, { minutes: r?.minutes })).join('') || '<p class="small muted" style="padding:12px">Nessuna giornata giocata.</p>'}</div>
    </main>`;
  },
};
