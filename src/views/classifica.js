import * as S from '../state.js';
import { esc, fmt, badge, icon, empty } from '../ui.js';

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
      <table class="tbl"><thead><tr><th>#</th><th>Squadra</th><th>Pt</th><th>G</th><th>V</th><th>N</th><th>P</th><th>DR</th><th>FP</th></tr></thead><tbody>
      ${st.map((r) => { const m = S.managersById.get(r.managerId); return `<tr class="${r.managerId === me.id ? 'me' : ''}"><td>${r.position}</td><td>${esc(m.teamName)}</td><td class="pt">${r.points}</td><td>${r.played}</td><td>${r.won}</td><td>${r.drawn}</td><td>${r.lost}</td><td>${r.dr > 0 ? '+' : ''}${r.dr}</td><td>${fmt(r.fantapunti)}</td></tr>`; }).join('')}
      </tbody></table>
      <p class="tie"><b>Spareggi</b> (art. 12.2): punti › fantapunti totali (FP) › differenza reti › scontri diretti.</p>
      <div class="a-card a-rule"><span class="art">Art. 11</span><p><b>Conversione in gol:</b> con ${S.base.league.managerCount} ${S.base.league.managerCount === 1 ? 'fantallenatore' : 'fantallenatori'} il primo gol scatta a ${fmt(S.lineupResult(n, me.id).conversion.threshold)} e se ne aggiunge uno ogni ${fmt(S.lineupResult(n, me.id).conversion.step)} punti. Parità di fantapunteggio = pareggio.</p></div>
    </main>`;
  },
};
