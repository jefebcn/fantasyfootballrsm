import * as S from '../state.js';
import { esc, fmt, roleChip, ROLE_NAME, ROLE_ORDER, badge, icon } from '../ui.js';

export const rosa = {
  title: 'Rosa', sub: () => 'Rosa · 25 giocatori',
  render() {
    const me = S.me(); const r = S.rosterOf(me.id); const n = S.currentMatchday(); const ratings = S.ratingsOf(n);
    const groups = ROLE_ORDER.map((role) => {
      const list = r.filter((x) => x.player.role === role).sort((a, b) => b.player.quotation - a.player.quotation);
      return `<div class="vlist"><div class="vhead">${ROLE_NAME[role]} <span>${list.length}/${S.rules().roster[role]}</span></div>${list.map((x) => {
        const rt = ratings.get(x.playerId); const v = rt ? (rt.isSV ? 'S.V.' : fmt(rt.fantaVote)) : '–';
        return `<a class="vr" href="#/giocatore/${x.playerId}" style="text-decoration:none">${roleChip(role)}<span class="nm"><b${x.player.isActive ? '' : ' style="text-decoration:line-through"'}>${esc(x.player.name)}</b><span>${esc(x.club.name)} · quot. ${x.player.quotation} · pagato ${x.pricePaid}${x.player.isActive ? '' : ' · <b style="color:var(--negative)">RIMOSSO · rimborso 50%</b>'}</span></span><span class="ev"></span><span class="fv${rt && !rt.isSV ? '' : ' sv'}">${v}</span></a>`;
      }).join('')}</div>`;
    }).join('');
    return `<main class="a-body">
      <div class="chips"><a class="chip on" href="#/rosa" style="text-decoration:none">Rosa 25</a><a class="chip" href="#/rosa/formazione" style="text-decoration:none">Formazione</a></div>
      <div class="a-card a-fase"><div class="r"><p><b>${esc(me.teamName)}</b> · ${esc(me.owner)}</p><span class="small muted">crediti <b class="num" style="color:var(--text)">${me.credits}</b></span></div><p class="small muted">Ultimo fantavoto: giornata ${n}. Tocca un giocatore per lo storico.</p></div>
      ${groups}
    </main>`;
  },
};
