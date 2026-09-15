import * as S from '../state.js';
import { esc, fmt, badge, crest, empty, icon } from '../ui.js';
import { movimenti } from '../engine.js';

let vista = 'classifica';

/** ▲2 / ▼1 / = rispetto a prima della giornata in corso. */
function freccia(d) {
  if (d === null) return '';
  if (d === 0) return '<i class="mv pari" aria-label="posizione invariata">=</i>';
  return `<i class="mv ${d > 0 ? 'su' : 'giu'}" aria-label="${d > 0 ? `sale di ${d}` : `scende di ${-d}`}">${d > 0 ? '▲' : '▼'}${Math.abs(d)}</i>`;
}

/** Gli incontri della giornata, con il punteggio che c'e' adesso. */
function incontri(n) {
  const me = S.me();
  const righe = S.fixturesOf(n).map((f) => {
    const r = S.fixtureResult(f);
    const h = S.managersById.get(f.homeManagerId), a = S.managersById.get(f.awayManagerId);
    const mio = me && (f.homeManagerId === me.id || f.awayManagerId === me.id);
    return `<a class="gr${mio ? ' io' : ''}" href="#/live/${f.id}">
      <span class="sq">${crest(h, 'sm')}<b>${esc(h.teamName)}</b></span>
      <span class="pt">${r.played ? `${r.homeGoals}<i>–</i>${r.awayGoals}` : '<i>vs</i>'}
        <small>${r.played ? `${fmt(r.homeScore)} – ${fmt(r.awayScore)}` : ''}</small></span>
      <span class="sq osp"><b>${esc(a.teamName)}</b>${crest(a, 'sm')}</span></a>`;
  }).join('');
  return `<div class="giornata">${righe}</div>`;
}

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

    const stato = S.matchdayStatus(n);
    // "In corso" vuol dire: la giornata sta gia' dando punti ma non e' chiusa,
    // quindi quello che si legge e' una proiezione e va detto.
    const inCorso = stato === 'provisional' || stato === 'live';
    const av = S.avanzamento(n);
    const mosse = movimenti(S.standingsPrima(n), st);

    const avviso = inCorso ? `<div class="warn info">${icon('clock', 'ic sm')}<span><b>Proiezione.</b> La giornata ${n} non è ancora congelata: ${av.totali ? `${av.fatte} partite su ${av.totali} hanno un risultato` : 'nessuna partita ha ancora un risultato'}. Le frecce dicono come ci si sta muovendo rispetto a prima della giornata.</span></div>` : '';

    const seg = `<div class="seg seg-cls">
      <button class="${vista === 'classifica' ? 'on' : ''}" data-vista="classifica">Classifica</button>
      <button class="${vista === 'giornata' ? 'on' : ''}" data-vista="giornata">Giornata ${n}</button></div>`;

    if (vista === 'giornata') {
      return `<main class="a-body">
        <div class="topbar">${badge(stato, `giornata ${n}`)}<span style="font:700 13px var(--font-display);color:var(--primary-ink);white-space:nowrap">Incontri</span></div>
        ${seg}${avviso}${incontri(n)}
        <p class="tie">Tocca un incontro per vedere i due campi, i voti e la panchina.</p>
      </main>`;
    }

    return `<main class="a-body">
      <div class="topbar">${badge(stato, `giornata ${n}`)}<span style="font:700 13px var(--font-display);color:var(--primary-ink);white-space:nowrap">Campionato</span></div>
      ${seg}${avviso}
      <div class="cls">${st.map((r) => { const m = S.managersById.get(r.managerId);
        const io = r.managerId === me.id;
        return `<div class="crow${io ? ' io' : ''}">
          <i class="pos">${r.position}</i>${inCorso ? freccia(mosse.get(r.managerId)) : ''}${crest(m, 'sm')}
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
  mount(root, ctx) {
    root.querySelector('main').addEventListener('click', (e) => {
      const b = e.target.closest('[data-vista]'); if (!b) return;
      vista = b.dataset.vista; ctx.render();
    });
  },
};
