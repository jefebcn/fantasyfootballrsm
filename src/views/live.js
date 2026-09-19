import * as S from '../state.js';
import { esc, fmt, icon, crest, roleChip, avatar, evTiles, pic, voteRow, dateIt, timeIt, logo } from '../ui.js';
import { videoDi } from '../video.js';

let tab = 'campo';
const P = (id) => S.playersById.get(id);
const club = (id) => S.clubsById.get(P(id).clubId);

function fieldTeam(res, ratings, evs, mirrored) {
  const byRole = { P: [], D: [], C: [], A: [] };
  for (const row of res.rows) byRole[row.role].push(row);
  const order = mirrored ? ['A', 'C', 'D', 'P'] : ['P', 'D', 'C', 'A'];
  return order.map((r) => `<div class="line">${byRole[r].map((row) => {
    // playerId e' il subentrato quando subFor c'e', il titolare quando il voto
    // e' d'ufficio: in tutti i due i casi e' chi va mostrato sul campo.
    const shown = row.playerId; const p = P(shown);
    const ind = [];
    if (row.subFor) ind.push(`<i class="segno">${pic('sostituzione-in')}</i>`); if (row.official) ind.push(`<i class="segno">${pic('sostituzione-out')}</i>`);
    ind.push(evTiles(evs[shown] || []).replace(/style="[^"]*"/g, ''));
    const pill = row.official ? `<span class="pill sv"><span>S.V.</span><span>${fmt(row.fantaVote)}</span></span>` : `<span class="pill"><span>${fmt(row.baseVote)}</span><span>${fmt(row.fantaVote)}</span></span>`;
    const cap = row.isCaptain ? '<span class="cap">C</span>' : (res.lineup.viceCaptainId === shown && !row.isCaptain ? '<span class="cap">V</span>' : '');
    return `<div class="ps" style="--tc:${club(shown).color}"><span class="av faccia">${cap}${avatar(p, club(shown))}${roleChip(row.role)}</span><span class="ind">${ind.join('')}</span>${pill}<b>${esc(p.lastName)}${row.subFor ? ` <small>(x ${esc(P(row.subFor).lastName)})</small>` : ''}</b></div>`;
  }).join('')}</div>`).join('');
}
function benchCol(res, ratings) {
  const inUse = new Set(res.rows.map((r) => r.playerId));
  return res.lineup.bench.map((id) => { const r = ratings.get(id); const p = P(id);
    const v = inUse.has(id) ? `<span class="vpill"><span>${fmt(r.baseVote)}</span><span>${fmt(r.fantaVote)}</span></span>` : !r || r.isSV ? (r?.svReason?.includes('rinviata') ? '<span class="vpill sv"><span>S.V.</span><span>rinv.</span></span>' : '<span class="no">⊘</span>') : `<span class="vpill"><span>${fmt(r.baseVote)}</span><span>${fmt(r.fantaVote)}</span></span>`;
    return `<div class="b2">${roleChip(p.role)}<span class="nm"><b>${esc(p.lastName)}${inUse.has(id) ? ` <i class="segno sm">${pic('sostituzione-in')}</i>` : ''}</b><span>${esc(club(id).name)}</span></span>${v}</div>`; }).join('');
}

/**
 * Le due probabili sul campo, una di fronte all'altra: stessa struttura di
 * fieldTeam() a partita giocata, ma senza le pastiglie dei voti, che ancora
 * non esistono. Quella ospite e' capovolta (attaccanti verso il centro) come
 * su un campo vero.
 */
function campoProbabile(l, mirrored) {
  const byRole = { P: [], D: [], C: [], A: [] };
  for (const id of l.starters) byRole[P(id).role].push(id);
  const order = mirrored ? ['A', 'C', 'D', 'P'] : ['P', 'D', 'C', 'A'];
  return order.map((r) => `<div class="line">${byRole[r].map((id) => {
    const p = P(id); const cap = id === l.captainId ? 'C' : id === l.viceCaptainId ? 'V' : '';
    return `<div class="ps senza-voto" style="--tc:${club(id).color}"><span class="av faccia">${cap ? `<span class="cap">${cap}</span>` : ''}${avatar(p, club(id))}${roleChip(P(id).role)}</span><b>${esc(p.lastName)}</b></div>`;
  }).join('')}</div>`).join('');
}

/** Il campo delle probabili, con i due undici e le due panchine sotto. */
function probabiliCampo(n, h, a) {
  const lh = S.lineupFor(n, h.id), la = S.lineupFor(n, a.id);
  // Le probabili di chi non ha consegnato sono una proposta, e va detto: dal
  // 17 settembre senza consegna la partita e' persa 0-3 a tavolino (art. 8.4).
  const fonte = (l) => (l.source === 'saved' ? 'formazione consegnata'
    : l.source === 'ufficio' ? "non consegnata: proposta d'ufficio, senza consegna è 0-3 a tavolino" : `non consegnata: proposta dall'ultima schierata (${l.source}), senza consegna è 0-3 a tavolino`);
  // Panchine appaiate per posto: il primo panchinaro di un ruolo e' quello che
  // entra se un titolare di quel ruolo non prende voto (art. 8.2), quindi il
  // confronto che conta e' posto per posto, non squadra dopo squadra.
  const panche = () => {
    const riga = (id, i) => (id
      ? `<div class="b2 pre"><span class="posto">${i + 1}</span>${roleChip(P(id).role)}<span class="nm"><b>${esc(P(id).lastName)}</b><span>${esc(club(id).name)}</span></span></div>`
      : `<div class="b2 pre vuota"><span class="posto">${i + 1}</span><span class="rl vuoto">–</span><span class="nm"><b>—</b><span>posto libero</span></span></div>`);
    const n = Math.max(lh.bench.length, la.bench.length);
    if (!n) return '<p class="small muted" style="margin:0 2px">Nessuna panchina: non ci sono ancora panchinari da confrontare.</p>';
    const righe = [];
    for (let i = 0; i < n; i++) righe.push(riga(lh.bench[i], i), riga(la.bench[i], i));
    return `<div class="bench2"><div class="b2 testa">${esc(h.teamName)}</div><div class="b2 testa">${esc(a.teamName)}</div>${righe.join('')}</div>`;
  };
  return `<div class="field"><span class="box top"></span>${campoProbabile(lh, false)}<div class="half"></div>${campoProbabile(la, true)}<span class="box bot"></span></div>
    <div class="cfr"><span><b>${esc(h.teamName)}</b>${esc(lh.formation)}</span><span><b>${esc(a.teamName)}</b>${esc(la.formation)}</span></div>
    ${[[lh, h], [la, a]].map(([l, m]) => `<p class="small muted" style="margin:0 2px"><b>${esc(m.teamName)}:</b> ${esc(fonte(l))}.</p>`).join('')}
    <div class="a-sec"><b>Panchine a confronto</b><span>posto per posto</span></div>
    ${panche()}`;
}

/**
 * Le probabili formazioni di uno scontro non ancora giocato: undici e panchina
 * dei due fantallenatori, con l'avviso su da dove arriva ciascuna.
 */
function probabili(n, h, a, f) {
  const lato = (m) => {
    const l = S.lineupFor(n, m.id);
    const fonte = l.source === 'saved' ? 'formazione consegnata'
      : l.source === 'ufficio' ? "non consegnata: proposta d'ufficio, senza consegna è 0-3 a tavolino"
        : `non consegnata: proposta dall'ultima schierata (${l.source}), senza consegna è 0-3 a tavolino`;
    const riga = (id, cap) => { const p = P(id); return `<div class="pr"><span class="rl">${roleChip(p.role)}</span>
      <b>${esc(p.name)}${cap ? ` <span class="cap">${cap}</span>` : ''}</b><span>${esc(club(id).name)}</span></div>`; };
    return `<div class="pcol"><div class="ph2"><b>${esc(m.teamName)}</b><span>${esc(l.formation)}</span></div>
      ${l.starters.map((id) => riga(id, id === l.captainId ? 'C' : id === l.viceCaptainId ? 'V' : '')).join('')}
      <div class="ph2 panca"><b>Panchina</b></div>
      ${l.bench.map((id) => riga(id, '')).join('')}
      <p class="fonte">${esc(fonte)}</p></div>`;
  };
  const lock = S.matchday(n).lockAt;
  return `<div class="a-card" style="padding:0;overflow:hidden">
    <p class="prehead">Probabili formazioni · si chiude ${dateIt(lock)} alle ${timeIt(lock)}</p>
    <div class="prob">${lato(h)}${lato(a)}</div>
    ${f && S.me() && !S.schieramentoBloccato() && (f.homeManagerId === S.me().id || f.awayManagerId === S.me().id)
    ? `<a class="mcta" href="#/rosa/formazione">Schiera la tua formazione${icon('chev', 'ic sm')}</a>` : ''}
  </div>`;
}

export const live = {
  title: 'Live', appbar: 'none', nav: false,
  render({ params }) {
    const f = S.fixture(params.id); if (!f) return `<main class="a-body"><div class="empty"><p>Partita non trovata.</p></div></main>`;
    const r = S.fixtureResult(f); const h = S.managersById.get(f.homeManagerId), a = S.managersById.get(f.awayManagerId);
    const n = f.matchday; const st = S.matchdayStatus(n); const ratings = S.ratingsOf(n);
    const evs = {}; for (const m of S.matchesOf(n)) for (const e of S.eventsOf(m.id)) (evs[e.playerId] ||= []).push(e);
    const played = r.played;
    const inserted = S.matchesOf(n).filter((m) => m.status !== 'scheduled').length;
    const head = `<div class="l-bar"><div class="row"><button class="ib flip" data-back aria-label="Indietro">${icon('chev')}</button><div class="lg">${crest({ color: 'var(--c-titano-800)', initials: 'SR' })}<div style="min-width:0"><b>${esc(S.base.league.name)}</b><span>Giornata ${n}</span></div></div><a class="ib" href="#/calendario/${n}" aria-label="Calendario">${icon('cal')}</a><a class="ib" href="#/scheda" aria-label="Scheda">${icon('share')}</a></div>
      <div class="l-head"><div class="tm"><b>${esc(h.teamName)}</b><span>${played ? (r.home.lineup?.formation || 'non consegnata') : ''}</span></div><div class="sc">${played ? `${r.homeGoals} – ${r.awayGoals}` : 'VS'}<small>${played ? `${fmt(r.homeScore)} – ${fmt(r.awayScore)}` : dateIt(S.matchday(n).lockAt)}</small></div><div class="tm"><b>${esc(a.teamName)}</b><span>${played ? (r.away.lineup?.formation || 'non consegnata') : ''}</span></div></div>
      <div class="l-sub"><span class="badge badge--prov" style="background:rgba(255,255,255,.18);color:#fff">${st === 'frozen' ? icon('lock') + 'Congelato' : st === 'live' ? icon('clock') + `Parziale <small>· ${inserted}/8 partite inserite</small>` : st === 'provisional' ? icon('clock') + 'Provvisorio' : icon('clock') + 'Da giocare'}</span>${played ? `<button class="a-btn" id="formula">${icon('calc', 'ic sm')}Conversione in gol</button>` : ''}</div></div>`;
    // Prima del fischio d'inizio la pagina mostrava solo un vuoto. Le probabili
    // ci sono gia': lineupFor() ripiega sulla formazione salvata, poi su quella
    // dell'ultima giornata, poi sull'undici d'ufficio, e dice quale sta usando —
    // e che senza consegna non conta: e' 0-3 a tavolino.
    const campionato = `<div class="real">${S.matchesOf(n).map((m) => { const hc = S.clubsById.get(m.homeClubId), ac = S.clubsById.get(m.awayClubId);
      return `<div class="rr"><div><b>${esc(hc.name)} — ${esc(ac.name)}</b><span>${m.venue ? esc(m.venue) : ''}</span></div>
        <span class="sc${m.status === 'played' ? '' : ' stato'}">${m.status === 'played' ? `${m.homeGoals} – ${m.awayGoals}` : m.status === 'postponed' ? 'Rinviata' : timeIt(m.kickoffAt)}</span>
        ${m.videoUrl ? `<a href="${m.videoUrl}" target="_blank" rel="noopener" class="play">${icon('play', 'ic sm')}</a>` : videoDi(m) ? `<a href="#/video" class="play" aria-label="Highlights">${icon('play', 'ic sm')}</a>` : '<span></span>'}</div>`; }).join('')}</div>`;
    const barra = `<nav class="l-nav"><button class="${tab === 'campo' ? 'on' : ''}" data-tab="campo" aria-label="Campo">${icon('shirt')}</button><button class="${tab === 'lista' ? 'on' : ''}" data-tab="lista" aria-label="Lista">${icon('list')}</button><span class="sep"></span><a href="#/video" aria-label="Video" style="display:grid;place-items:center;color:var(--text-muted)">${icon('play')}</a><button class="${tab === 'campionato' ? 'on' : ''}" data-tab="campionato" aria-label="Campionato">${logo()}</button></nav>`;
    // Prima del fischio le due squadre si guardano sul campo, come a partita
    // giocata: stessa barra, stesse tre viste. Prima c'era solo l'elenco.
    if (!played) {
      const lock = S.matchday(n).lockAt;
      const mio = f && S.me() && (f.homeManagerId === S.me().id || f.awayManagerId === S.me().id);
      const pre = tab === 'campo'
        ? `<p class="prehead libero">Probabili formazioni · si chiude ${dateIt(lock)} alle ${timeIt(lock)}</p>${probabiliCampo(n, h, a)}
           ${mio && !S.schieramentoBloccato() ? `<a class="a-btn sec" href="#/rosa/formazione" style="text-decoration:none">Schiera la tua formazione</a>` : ''}`
        : tab === 'lista' ? probabili(n, h, a, f)
          : `<div class="a-sec"><b>Partite del campionato</b><span>giornata ${n}</span></div>${campionato}`;
      return `<main class="a-body" style="padding:0;gap:0">${head}
        <div style="padding:12px 16px 16px;display:flex;flex-direction:column;gap:12px">${pre}</div></main>${barra}`;
    }
    // A tavolino non c'e' un campo da disegnare: chi non ha consegnato non ha
    // undici, voti, panchina. Si dice cosa e' successo e chi ha vinto, e si
    // lascia la scheda del campionato.
    if (r.forfait) {
      const chi = r.forfait === 'entrambi' ? `${esc(h.teamName)} e ${esc(a.teamName)} non hanno consegnato`
        : `${esc(r.forfait === 'home' ? h.teamName : a.teamName)} non ha consegnato`;
      const esito = r.forfait === 'entrambi' ? 'persa 0-3 da tutte e due'
        : `vince ${esc(r.forfait === 'home' ? a.teamName : h.teamName)} 3-0`;
      const spiega = `<div class="a-card tavolino"><p><b>Partita a tavolino</b> · art. 8.4</p><p>${chi} la formazione entro il lock: ${esito}. ${r.forfait === 'entrambi' ? 'Zero fantapunti per entrambe.' : 'Chi ha consegnato tiene i suoi fantapunti; chi no ne ha zero.'}</p></div>`;
      const body = tab === 'altro' ? campionato : spiega;
      return `<main class="a-body" style="padding:0;gap:0">${head}
        <div style="padding:12px 16px 16px;display:flex;flex-direction:column;gap:12px">${body}</div></main>${barra}`;
    }
    const c = r.home.conversion;
    const formula = `<div class="a-card" id="formula-card" hidden><p class="formula"><b>Art. 11</b> · ${S.base.league.managerCount} fantallenatori · soglia <b>${fmt(c.threshold)}</b> · passo <b>${fmt(c.step)}</b><br>${fmt(r.homeScore)} → <b>${r.homeGoals} gol</b> · ${fmt(r.awayScore)} → <b>${r.awayGoals} gol</b><br>Parità di fantapunteggio = pareggio (11.1)</p></div>`;
    const notes = [r.home, r.away].map((x, i) => { const m = i ? a : h; const parts = [];
      if (x.captainNote.startsWith('nessun raddoppio')) parts.push('capitano e vice S.V. → nessun raddoppio (art. 6.3)');
      else if (x.captainNote.startsWith('vice')) parts.push(`capitano S.V. → raddoppia il vice ${esc(P(x.captainId).lastName)} (art. 6.3)`);
      for (const s of x.subsApplied) parts.push(`${esc(P(s.out).lastName)} S.V. → entra ${esc(P(s.in).lastName)} (panchina ${s.benchIndex})`);
      const off = x.rows.filter((row) => row.official); if (off.length) parts.push(`${off.map((row) => esc(P(row.playerId).lastName)).join(', ')} senza sostituto: 5,5 d'ufficio (art. 8.6)`);
      return parts.length ? `<div class="warn info">${icon('warn', 'ic sm')}<span><b>${esc(m.teamName)}:</b> ${parts.join(' · ')}</span></div>` : ''; }).join('');
    let body = '';
    if (tab === 'campo') body = `<div class="field"><span class="box top"></span>${fieldTeam(r.home, ratings, evs, false)}<div class="half"></div>${fieldTeam(r.away, ratings, evs, true)}<span class="box bot"></span></div>${notes}
      <div class="a-sec"><b>Panchina</b><span>ordine di ingresso</span></div><div class="bench2" style="grid-template-columns:1fr 1fr;display:grid">${interleave(benchCol(r.home, ratings), benchCol(r.away, ratings))}</div>
      <a class="legend" href="#/regolamento" style="text-decoration:none">${icon('book')}Legenda Voto Titano${icon('chev', 'ic sm chev')}</a>`;
    else if (tab === 'lista') body = [r.home, r.away].map((x, i) => `<div class="vlist"><div class="vhead">${esc((i ? a : h).teamName)} · ${x.lineup.formation} <span>${fmt(x.total)}</span></div>${x.rows.map((row) => row.official ? `<div class="sub"><span class="arr">↓ ${row.role}</span><span><s>${esc(P(row.playerId).name)}</s> S.V. → <b>nessun sostituto</b></span><span class="fv">${fmt(row.fantaVote)}</span></div>` : (row.subFor ? `<div class="sub"><span class="arr">↓ ${row.role}</span><span><s>${esc(P(row.subFor).name)}</s> S.V. → <b>${esc(P(row.playerId).name)}</b></span><span class="fv">${fmt(row.fantaVote)}</span></div>` : '') + voteRow(P(row.playerId), club(row.playerId), { ...ratings.get(row.playerId), events: evs[row.playerId] || [], breakdown: row.isCaptain ? ratings.get(row.playerId).breakdown.map((l) => l.label === 'Voto base' || l.label === 'Esito collettivo' ? l : { ...l, value: l.value * 2, note: `${l.note ? l.note + ' · ' : ''}×2 capitano` }) : ratings.get(row.playerId).breakdown, fantaVote: row.fantaVote }, { captain: row.isCaptain })).join('')}</div>`).join('');
    else body = campionato;
    const tot = `<div class="tot"><span class="pillt">Totale parziali</span><div class="r"><b>${fmt(r.home.baseTotal)}</b><span>Voto Titano</span><b>${fmt(r.away.baseTotal)}</b></div><hr><div class="r fv"><b>${fmt(r.homeScore)}</b><span>con bonus/malus</span><b>${fmt(r.awayScore)}</b></div></div>`;
    const others = S.fixturesOf(n).filter((x) => x.id !== f.id);
    return `<main class="a-body" style="padding:0;gap:0">${head}<div style="padding:12px 16px 16px;display:flex;flex-direction:column;gap:12px">${formula}${body}${tot}
      <div class="a-sec"><b>Altri incontri</b><span>giornata ${n}</span></div><div class="real">${others.map((x) => { const rr = S.fixtureResult(x); const hh = S.managersById.get(x.homeManagerId), aa = S.managersById.get(x.awayManagerId); return `<a class="rr" href="#/live/${x.id}" style="text-decoration:none;color:inherit"><div><b>${esc(hh.teamName)} — ${esc(aa.teamName)}</b><span>${rr.played ? `${fmt(rr.homeScore)} – ${fmt(rr.awayScore)}` : ''}</span></div><span class="sc">${rr.played ? `${rr.homeGoals} – ${rr.awayGoals}` : 'VS'}</span>${icon('chev', 'ic sm')}</a>`; }).join('')}</div></div></main>
      ${barra}`;
  },
  mount(root, ctx) {
    root.querySelector('.app').addEventListener('click', (e) => {
      const t = e.target.closest('[data-tab]'); if (t) { tab = t.dataset.tab; ctx.render(); return; }
      if (e.target.closest('#formula')) { const c = root.querySelector('#formula-card'); c.hidden = !c.hidden; }
    });
  },
};
function interleave(aHtml, bHtml) {
  const A = aHtml.split('</div><div class="b2">'), B = bHtml.split('</div><div class="b2">');
  const fix = (arr) => arr.map((x, i) => (i === 0 ? x : '<div class="b2">' + x) + (i === arr.length - 1 ? '' : '</div>'));
  const a = fix(A), b = fix(B); const out = []; for (let i = 0; i < Math.max(a.length, b.length); i++) out.push(a[i] || '<div class="b2"></div>', b[i] || '<div class="b2"></div>'); return out.join('');
}
