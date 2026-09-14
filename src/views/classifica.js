import * as S from '../state.js';
import { esc, fmt, badge, icon, crest, empty, sec } from '../ui.js';

export const classifica = {
  title: 'Classifica',
  render() {
    const me = S.me(); const n = S.currentMatchday(); const st = S.standings();
    const giocate = st.reduce((s, r) => s + r.played, 0);
    if (!giocate) return `<main class="a-body">${empty(
      S.base.managers.length < 2
        ? 'La classifica parte quando ci sono almeno due squadre: condividi il codice invito della lega.'
        : 'Nessuna giornata conclusa: la classifica compare quando il Giudice Dati pubblica i primi voti.',
      S.base.managers.length < 2 ? '<a class="a-btn" href="#/lega" style="text-decoration:none">Invita i partecipanti</a>' : '')}</main>`;
    return `<main class="a-body">
      <div class="topbar">${badge(S.matchdayStatus(n), `giornata ${n}`)}<span style="font:700 13px var(--font-display);color:var(--primary);white-space:nowrap">Campionato</span></div>
      <div class="cls">${st.map((r) => { const m = S.managersById.get(r.managerId);
        const io = r.managerId === me.id;
        return `<div class="crow${io ? ' io' : ''}">
          <i class="pos">${r.position}</i>${crest(m, 'sm')}
          <span class="nm"><b>${esc(m.teamName)}</b><span>${esc(m.owner)} · ${r.won}V ${r.drawn}N ${r.lost}P</span></span>
          <span class="pt"><b>${r.points}</b><span>punti</span></span></div>`; }).join('')}</div>
      <div class="a-card dett"><div class="dhead"><b>Dettaglio</b><span>giocate · differenza reti · fantapunti</span></div>
        ${st.map((r) => { const m = S.managersById.get(r.managerId);
          return `<div class="drow${r.managerId === me.id ? ' io' : ''}"><span class="nm">${r.position}. ${esc(m.teamName)}</span>
            <span class="v">${r.played}</span><span class="v">${r.dr > 0 ? '+' : ''}${r.dr}</span><span class="v fp">${fmt(r.fantapunti)}</span></div>`; }).join('')}</div>
      <p class="tie"><b>Spareggi</b> (art. 12.2): punti › fantapunti totali (FP) › differenza reti › scontri diretti.</p>
      <div class="a-card a-rule"><span class="art">Art. 11</span><p><b>Conversione in gol:</b> con ${S.base.league.managerCount} ${S.base.league.managerCount === 1 ? 'fantallenatore' : 'fantallenatori'} il primo gol scatta a ${fmt(S.lineupResult(n, me.id).conversion.threshold)} e se ne aggiunge uno ogni ${fmt(S.lineupResult(n, me.id).conversion.step)} punti. Parità di fantapunteggio = pareggio.</p></div>
    </main>`;
  },
};
