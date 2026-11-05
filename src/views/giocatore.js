import * as S from '../state.js';
import { esc, fmt, icon, roleChip, voteRow, avatarGrande, t } from '../ui.js';
import { roleName } from '../engine.js';

export const giocatore = {
  title: 'Giocatore', appbar: 'back', sub: ({ params }) => S.playersById.get(params.id)?.name || t('Giocatore'),
  render({ params }) {
    const p = S.playersById.get(params.id); if (!p) return `<main class="a-body"><div class="empty"><p>${t('Giocatore non trovato.')}</p></div></main>`;
    const club = S.clubsById.get(p.clubId); let owner = null; for (const m of S.base.managers) if (S.base.rosters[m.id].some((r) => r.playerId === p.id)) owner = m;
    const hist = []; let sum = 0, cnt = 0;
    for (let n = 1; n <= S.currentMatchday(); n++) { const r = S.ratingsOf(n).get(p.id); const m = S.matchesOf(n).find((x) => x.homeClubId === p.clubId || x.awayClubId === p.clubId); const evs = m ? S.eventsOf(m.id).filter((e) => e.playerId === p.id) : []; hist.push({ n, r, m, evs }); if (r && !r.isSV) { sum += r.fantaVote; cnt++; } }
    return `<main class="a-body">
      <div class="a-card" style="display:flex;gap:14px;align-items:center">${avatarGrande(p, club)}<div style="flex:1"><b style="font:700 18px var(--font-display)">${esc(p.firstName)} ${esc(p.lastName)}</b>${(() => { const q = S.squalifica(p.id); return q ? ` <i class="squal" title="${esc(q.motivo)}">${t('SQUALIFICATO')}</i><br><span class="small" style="color:var(--negative)">${t('Salta la {n}ª giornata: {motivo}', { n: S.giornataDaSchierare(), motivo: esc(q.motivo) })}</span>` : ''; })()}<br><span class="small muted">${esc(club.name)} · ${t(roleName(p.role))} · ${p.isActive ? (owner ? t('di {squadra}', { squadra: esc(owner.teamName) }) : t('svincolato')) : `<b style="color:var(--negative)">${t('fuori dal campionato (art. 3.3)')}</b>`}</span>${S.haAderito(p.id) ? `<br><span class="aderito" title="${t('Ha confermato che il suo nome può comparire nel gioco')}">${icon('check')}${t('Ha aderito a Fantatitano')}</span>` : ''}</div>${roleChip(p.role)}</div>
      <div class="a-card a-stats"><div><b>${p.quotation}</b><span>${t('Quotazione')}</span></div><div><b>${cnt ? fmt(sum / cnt) : '–'}</b><span>${t('Media FV')}</span></div><div><b>${cnt}</b><span>${t('Presenze')}</span></div><div><b>${hist.reduce((s, h) => s + h.evs.filter((e) => e.type === 'goal').length, 0)}</b><span>${t('Gol')}</span></div></div>
      <a class="a-btn sec" href="#/confronto/${esc(p.id)}" style="text-decoration:none;justify-content:center">${t('Confronta con un altro {ruolo}', { ruolo: t(roleName(p.role)).toLowerCase() })}</a>
      <div class="vlist"><div class="vhead">${t('Storico giornate')}</div>${hist.map(({ n, r, m, evs }) => voteRow({ ...p, name: t('Giornata {n}', { n }) }, m ? { name: `${S.clubsById.get(m.homeClubId).name} ${m.status === 'played' ? `${m.homeGoals}-${m.awayGoals}` : '—'} ${S.clubsById.get(m.awayClubId).name}` } : null, r ? { ...r, events: evs } : null, { minutes: r?.minutes })).join('') || `<p class="small muted" style="padding:12px">${t('Nessuna giornata giocata.')}</p>`}</div>
    </main>`;
  },
};
