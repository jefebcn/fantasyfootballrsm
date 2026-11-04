import * as S from '../state.js';
import { esc, fmt, icon, roleChip, logo, t } from '../ui.js';

export const scheda = {
  title: 'Scheda', appbar: 'back', sub: () => t('Scheda condivisibile'),
  serveSquadra: true,   // senza una squadra in questa lega: app.js mostra «Non fai parte di questa lega»
  render() {
    const me = S.me(); const n = S.currentMatchday(); const f = S.myFixture(n, me.id); const r = f ? S.fixtureResult(f) : null;
    if (!r || !r.played) return `<main class="a-body"><div class="empty">${logo()}<p>${t('Nessuna partita giocata da condividere.')}</p></div></main>`;
    const home = r.homeManagerId === me.id; const opp = S.managersById.get(home ? r.awayManagerId : r.homeManagerId);
    const mine = home ? r.home : r.away; const top = [...mine.rows].sort((a, b) => b.fantaVote - a.fantaVote).slice(0, 3);
    const gf = home ? r.homeGoals : r.awayGoals, gs = home ? r.awayGoals : r.homeGoals;
    return `<main class="a-body">
      <div class="share" id="share-card">${logo('tw')}<div><span class="eyebrow" style="color:rgba(255,255,255,.75)">${t('Giornata {n}', { n })} · ${esc(S.base.league.name)}</span><h2>${esc(me.teamName)}</h2><span class="small">${t('vs {squadra}', { squadra: esc(opp.teamName) })}</span></div>
        <div class="sc">${gf} – ${gs}<small>${t('{a} – {b} fantapunti', { a: fmt(home ? r.homeScore : r.awayScore), b: fmt(home ? r.awayScore : r.homeScore) })}</small></div>
        <div class="top3">${top.map((row) => `<div><span>${roleChip(row.role)} ${esc(S.playersById.get(row.playerId).name)}${row.isCaptain ? ' (C)' : ''}</span><b>${fmt(row.fantaVote)}</b></div>`).join('')}</div>
        <div class="foot"><span>${S.matchdayStatus(n) === 'frozen' ? t('🔒 Congelato') : t('⏱ Provvisorio')}</span><span>Voto Titano</span></div></div>
      <button class="a-btn" id="share">${icon('share', 'ic sm')}${t('Condividi su WhatsApp')}</button>
      <p class="small muted" style="text-align:center">${t('Condivide il testo del risultato; l\'immagine generata arriva con la Fase 2.')}</p>
    </main>`;
  },
  mount(root, ctx) {
    root.querySelector('#share')?.addEventListener('click', async () => {
      const me = S.me(); const n = S.currentMatchday(); const r = S.fixtureResult(S.myFixture(n, me.id)); const home = r.homeManagerId === me.id;
      const text = `${me.teamName} ${home ? r.homeGoals : r.awayGoals}–${home ? r.awayGoals : r.homeGoals} ${S.managersById.get(home ? r.awayManagerId : r.homeManagerId).teamName} · ${t('giornata {n} · {p} fantapunti (Voto Titano)', { n, p: fmt(home ? r.homeScore : r.awayScore) })} — ${S.linkInvito()}`;
      if (navigator.share) { try { await navigator.share({ title: 'Fantatitano', text }); } catch { /* annullato */ } }
      else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    });
  },
};
