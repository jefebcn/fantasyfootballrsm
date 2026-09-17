import * as S from '../state.js';
import { esc, fmt, badge, crest, empty, icon } from '../ui.js';
import { movimenti } from '../engine.js';

let vista = 'classifica';
let contro = null;

/** ▲2 / ▼1 / = rispetto a prima della giornata in corso. */
function freccia(d) {
  if (d === null) return '';
  if (d === 0) return '<i class="mv pari" aria-label="posizione invariata">=</i>';
  return `<i class="mv ${d > 0 ? 'su' : 'giu'}" aria-label="${d > 0 ? `sale di ${d}` : `scende di ${-d}`}">${d > 0 ? '▲' : '▼'}${Math.abs(d)}</i>`;
}

const nomeSq = (id) => S.managersById.get(id)?.teamName || '—';

/**
 * I record della lega. In una lega fra amici e' la parte di cui si discute
 * tutto l'anno — "il mio 82,5 della seconda" vale piu' di mezza classifica —
 * ed erano tutti dati che c'erano gia' e che nessuno metteva insieme.
 */
function record() {
  const r = S.record();
  if (r.vuoto) return `<div class="a-card"><p class="small muted">I record compaiono quando c'è almeno una giornata conclusa.</p></div>`;
  const scheda = (etichetta, chi, valore, sotto) => `<div class="rec">
    <span class="et">${etichetta}</span><b class="val">${valore}</b>
    <span class="chi">${esc(nomeSq(chi))}</span><span class="dove">${sotto}</span></div>`;
  const s5 = (esiti) => esiti.slice(-5).map((e) => `<i class="e ${e.toLowerCase()}">${e}</i>`).join('');
  const strisce = r.strisce.filter((x) => x.vittorie > 0).slice(0, 3);
  return `<div class="recs">
      ${scheda('Miglior punteggio', r.migliore.managerId, fmt(r.migliore.punti), `giornata ${r.migliore.matchday}`)}
      ${scheda('Peggior punteggio', r.peggiore.managerId, fmt(r.peggiore.punti), `giornata ${r.peggiore.matchday}`)}
      ${scheda('Più gol in una giornata', r.piuGol.managerId, r.piuGol.gol, `giornata ${r.piuGol.matchday}`)}
      ${scheda('Vittoria più larga', r.scarto.vincitore, `+${r.scarto.gol}`, `su ${esc(nomeSq(r.scarto.perdente))}, giornata ${r.scarto.matchday}`)}
    </div>
    ${strisce.length ? `<div class="a-sec"><b>Strisce</b><span>di fila</span></div>
      <div class="vlist">${strisce.map((x) => `<div class="vr">${crest(S.managersById.get(x.managerId), 'sm')}
        <span class="nm"><b>${esc(nomeSq(x.managerId))}</b><span>${x.vittorie} ${x.vittorie === 1 ? 'vittoria' : 'vittorie'} di fila · ${x.imbattuto} senza perdere</span></span>
        <span class="ultimi">${s5(x.esiti)}</span></div>`).join('')}</div>` : ''}
    <div class="a-card dett"><div class="dhead"><b>Medie per giornata</b><span>media · massimo · minimo</span></div>
      ${r.medie.map((m) => `<div class="drow${m.managerId === S.me()?.id ? ' io' : ''}"><span class="nm">${esc(nomeSq(m.managerId))}</span>
        <span class="v fp">${fmt(m.media)}</span><span class="v">${fmt(m.massimo)}</span><span class="v">${fmt(m.minimo)}</span></div>`).join('')}</div>`;
}

/** Lo storico contro una squadra: si scelgono dai chip. */
function scontri(con) {
  const me = S.me(); if (!me) return '';
  const altri = S.base.managers.filter((m) => m.id !== me.id);
  if (!altri.length) return '';
  const scelto = altri.some((m) => m.id === con) ? con : altri[0].id;
  const h = S.h2h(me.id, scelto);
  const chip = `<div class="scelte">${altri.map((m) => `<button class="chip${m.id === scelto ? ' on' : ''}" data-h2h="${m.id}">${esc(m.teamName)}</button>`).join('')}</div>`;
  if (!h.partite.length) {
    return `${chip}<div class="a-card"><p class="small muted">Non vi siete ancora incontrati: il calendario vi mette insieme più avanti.</p></div>`;
  }
  return `${chip}
    <div class="a-card h2h"><div class="hbar">
      <span class="q v"><b>${h.v}</b><span>vinte</span></span>
      <span class="q n"><b>${h.n}</b><span>pari</span></span>
      <span class="q p"><b>${h.p}</b><span>perse</span></span></div>
      <div class="hnum"><span>gol <b>${h.golA}–${h.golB}</b></span><span>fantapunti <b>${fmt(h.puntiA)}–${fmt(h.puntiB)}</b></span></div></div>
    <div class="vlist"><div class="vhead">Gli incontri <span>${h.partite.length}</span></div>
      ${h.partite.map((f) => { const casa = f.homeManagerId === me.id;
    const ga = casa ? f.homeGoals : f.awayGoals, gb = casa ? f.awayGoals : f.homeGoals;
    const pa = casa ? f.homeScore : f.awayScore, pb = casa ? f.awayScore : f.homeScore;
    return `<a class="vr" href="#/live/${f.id}" style="text-decoration:none">
        <span class="rl ${ga > gb ? 'rl-d' : ga < gb ? 'rl-a' : 'rl-c'}">${ga > gb ? 'V' : ga < gb ? 'P' : 'N'}</span>
        <span class="nm"><b>Giornata ${f.matchday}</b><span>${casa ? 'in casa' : 'fuori'} · ${fmt(pa)} – ${fmt(pb)}</span></span>
        <span class="fv">${ga}–${gb}</span></a>`; }).join('')}</div>`;
}

/** Gli incontri della giornata, con il punteggio che c'e' adesso. */
function incontri(n) {
  const me = S.me();
  const righe = S.fixturesOf(n).map((f) => {
    const r = S.fixtureResult(f);
    const h = S.managersById.get(f.homeManagerId), a = S.managersById.get(f.awayManagerId);
    const mio = me && (f.homeManagerId === me.id || f.awayManagerId === me.id);
    return `<a class="gr${mio ? ' io' : ''}" href="#/live/${f.id}">
      <span class="gsq">${crest(h, 'sm')}<b>${esc(h.teamName)}</b></span>
      <span class="pt">${r.played ? `${r.homeGoals}<i>–</i>${r.awayGoals}` : '<i>vs</i>'}
        <small>${r.played ? (r.forfait ? 'a tavolino' : `${fmt(r.homeScore)} – ${fmt(r.awayScore)}`) : ''}</small></span>
      <span class="gsq osp"><b>${esc(a.teamName)}</b>${crest(a, 'sm')}</span></a>`;
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
      <button class="${vista === 'giornata' ? 'on' : ''}" data-vista="giornata">Giornata ${n}</button>
      <button class="${vista === 'record' ? 'on' : ''}" data-vista="record">Record</button></div>`;

    if (vista === 'record') {
      return `<main class="a-body">
        <div class="topbar">${badge(stato, `giornata ${n}`)}<span style="font:700 13px var(--font-display);color:var(--primary-ink);white-space:nowrap">Record</span></div>
        ${seg}
        <div class="a-sec"><b>Record di lega</b><span>fin qui</span></div>
        ${record()}
        <div class="a-sec"><b>Testa a testa</b><span>i tuoi scontri</span></div>
        ${scontri(contro)}
      </main>`;
    }

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
      const h = e.target.closest('[data-h2h]');
      if (h) { contro = h.dataset.h2h; ctx.render(); return; }
      const b = e.target.closest('[data-vista]'); if (!b) return;
      vista = b.dataset.vista; ctx.render();
    });
  },
};
