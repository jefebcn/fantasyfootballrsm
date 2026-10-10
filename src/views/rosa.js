import * as S from '../state.js';
import { esc, fmt, faccia, ROLE_NAME, ROLE_ORDER, mask } from '../ui.js';

/**
 * Le schede in cima a Rosa e Formazione. Erano due chip piccole, uguali a
 * tutti gli altri filtri dell'app: Alex (10/10) non le vedeva come il modo
 * di passare da una all'altra. Adesso sono una barra a tutta larghezza con
 * le stesse icone della barra in basso, e quella attiva e' piena.
 */
export function schedeRosa(attiva) {
  const me = S.me(); const quanti = me ? S.rosterOf(me.id).length : 0;
  const voci = [
    ['rosa', '#/rosa', mask('maglia-10'), `Rosa <small>${quanti}</small>`],
    ['formazione', '#/rosa/formazione', mask('campo'), 'Formazione'],
  ];
  if (S.scambiInQuestaLega() && S.base.managers.length > 1) {
    const da = S.scambiDaDecidere().length;
    voci.push(['scambi', '#/scambi', '', `Scambi${da ? ` <b class="segn">${da}</b>` : ''}`]);
  }
  return `<nav class="segwrap"><div class="seg seg-cls seg-rosa">${voci.map(([k, h, ic, t]) =>
    `<a href="${h}"${k === attiva ? ' class="on" aria-current="page"' : ''}>${ic}<span>${t}</span></a>`).join('')}</div></nav>`;
}

export const rosa = {
  title: 'Rosa', sub: () => 'Rosa · 25 giocatori',
  render() {
    const me = S.me(); const r = S.rosterOf(me.id); const n = S.currentMatchday(); const ratings = S.ratingsOf(n);
    const groups = ROLE_ORDER.map((role) => {
      const list = r.filter((x) => x.player.role === role).sort((a, b) => b.player.quotation - a.player.quotation);
      return `<div class="vlist"><div class="vhead">${ROLE_NAME[role]} <span>${list.length}/${S.rules().roster[role]}</span></div>${list.map((x) => {
        const rt = ratings.get(x.playerId); const v = rt ? (rt.isSV ? 'S.V.' : fmt(rt.fantaVote)) : '–';
        return `<a class="vr" href="#/giocatore/${x.playerId}" style="text-decoration:none">${faccia(x.player, x.club)}<span class="nm"><b${x.player.isActive ? '' : ' style="text-decoration:line-through"'}>${esc(x.player.name)}</b><span>${esc(x.club.name)} · quot. ${x.player.quotation} · pagato ${x.pricePaid}${x.player.isActive ? '' : ' · <b style="color:var(--negative)">RIMOSSO · rimborso 50%</b>'}</span></span><span class="ev"></span><span class="fv${rt && !rt.isSV ? '' : ' sv'}">${v}</span></a>`;
      }).join('')}</div>`;
    }).join('');
    return `<main class="a-body">
      ${schedeRosa('rosa')}
      <div class="a-card a-fase"><div class="r"><p><b>${esc(me.teamName)}</b> · ${esc(me.owner)}</p><span class="small muted">crediti <b class="num" style="color:var(--text)">${me.credits}</b></span></div><p class="small muted">Ultimo fantavoto: giornata ${n}. Tocca un giocatore per lo storico.</p></div>
      ${groups}
    </main>`;
  },
};
