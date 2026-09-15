import * as S from '../state.js';
import { esc, fmt, icon, badge, crest, roleChip, initials, evTiles, pic, voteRow, dateIt, timeIt, logo } from '../ui.js';

let tab = 'campo';
const P = (id) => S.playersById.get(id);
const club = (id) => S.clubsById.get(P(id).clubId);

function fieldTeam(res, ratings, evs, mirrored) {
  const byRole = { P: [], D: [], C: [], A: [] };
  for (const row of res.rows) byRole[row.role].push(row);
  const order = mirrored ? ['A', 'C', 'D', 'P'] : ['P', 'D', 'C', 'A'];
  return order.map((r) => `<div class="line">${byRole[r].map((row) => {
    const shown = row.subFor ? row.playerId : row.playerId; const p = P(shown); const out = row.official ? row.playerId : null;
    const ind = [];
    if (row.subFor) ind.push(`<i class="sub">${pic('sostituzione-in')}</i>`); if (row.official) ind.push(`<i class="sub">${pic('sostituzione-out')}</i>`);
    ind.push(evTiles((evs[shown] || []).filter((e) => e.type !== 'assist' || true)).replace(/style="[^"]*"/g, ''));
    const pill = row.official ? `<span class="pill sv"><span>S.V.</span><span>${fmt(row.fantaVote)}</span></span>` : `<span class="pill"><span>${fmt(row.baseVote)}</span><span>${fmt(row.fantaVote)}</span></span>`;
    const cap = row.isCaptain ? '<span class="cap">C</span>' : (res.lineup.viceCaptainId === shown && !row.isCaptain ? '<span class="cap">V</span>' : '');
    return `<div class="ps" style="--tc:${club(shown).color}"><span class="av">${cap}${initials(p)}${roleChip(row.role)}</span><span class="ind">${ind.join('')}</span>${pill}<b>${esc(p.lastName)}${row.subFor ? ` <small>(x ${esc(P(row.subFor).lastName)})</small>` : ''}</b></div>`;
  }).join('')}</div>`).join('');
}
function benchCol(res, ratings) {
  const inUse = new Set(res.rows.map((r) => r.playerId));
  return res.lineup.bench.map((id) => { const r = ratings.get(id); const p = P(id);
    const v = inUse.has(id) ? `<span class="vpill"><span>${fmt(r.baseVote)}</span><span>${fmt(r.fantaVote)}</span></span>` : !r || r.isSV ? (r?.svReason?.includes('rinviata') ? '<span class="vpill sv"><span>S.V.</span><span>rinv.</span></span>' : '<span class="no">⊘</span>') : `<span class="vpill"><span>${fmt(r.baseVote)}</span><span>${fmt(r.fantaVote)}</span></span>`;
    return `<div class="b2">${roleChip(p.role)}<span class="nm"><b>${esc(p.lastName)}${inUse.has(id) ? ` <i class="sub sm">${pic('sostituzione-in')}</i>` : ''}</b><span>${esc(club(id).name)}</span></span>${v}</div>`; }).join('');
}

/**
 * Le probabili formazioni di uno scontro non ancora giocato: undici e panchina
 * dei due fantallenatori, con l'avviso su da dove arriva ciascuna.
 */
function probabili(n, h, a, f) {
  const lato = (m) => {
    const l = S.lineupFor(n, m.id);
    const fonte = l.source === 'saved' ? 'formazione salvata'
      : l.source === 'ufficio' ? "undici d'ufficio: nessuna formazione ancora inviata"
        : `ultima schierata: ${l.source}`;
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
    ${f && S.me() && (f.homeManagerId === S.me().id || f.awayManagerId === S.me().id)
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
      <div class="l-head"><div class="tm"><b>${esc(h.teamName)}</b><span>${played ? r.home.lineup.formation : ''}</span></div><div class="sc">${played ? `${r.homeGoals} – ${r.awayGoals}` : 'VS'}<small>${played ? `${fmt(r.homeScore)} – ${fmt(r.awayScore)}` : dateIt(S.matchday(n).lockAt)}</small></div><div class="tm"><b>${esc(a.teamName)}</b><span>${played ? r.away.lineup.formation : ''}</span></div></div>
      <div class="l-sub"><span class="badge badge--prov" style="background:rgba(255,255,255,.18);color:#fff">${st === 'frozen' ? icon('lock') + 'Congelato' : st === 'live' ? icon('clock') + `Parziale <small>· ${inserted}/8 partite inserite</small>` : st === 'provisional' ? icon('clock') + 'Provvisorio' : icon('clock') + 'Da giocare'}</span>${played ? `<button class="a-btn" id="formula">${icon('calc', 'ic sm')}Conversione in gol</button>` : ''}</div></div>`;
    // Prima del fischio d'inizio la pagina mostrava solo un vuoto. Le probabili
    // ci sono gia': lineupFor() ripiega sulla formazione salvata, poi su quella
    // dell'ultima giornata, poi sull'undici d'ufficio, e dice quale sta usando.
    if (!played) return `<main class="a-body" style="padding:0;gap:0">${head}
      <div style="padding:12px 16px 16px;display:flex;flex-direction:column;gap:12px">
        ${probabili(n, h, a, f)}
        <div class="a-sec"><b>Partite del campionato</b><span>giornata ${n}</span></div>
        <div class="real">${S.matchesOf(n).map((m) => { const hc = S.clubsById.get(m.homeClubId), ac = S.clubsById.get(m.awayClubId);
          return `<div class="rr"><div><b>${esc(hc.name)} — ${esc(ac.name)}</b><span>${m.venue ? esc(m.venue) : ''}</span></div>
            <span class="sc${m.status === 'played' ? '' : ' stato'}">${m.status === 'played' ? `${m.homeGoals} – ${m.awayGoals}` : m.status === 'postponed' ? 'Rinviata' : timeIt(m.kickoffAt)}</span><span></span></div>`; }).join('')}</div>
      </div></main>`;
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
    else body = `<div class="real">${S.matchesOf(n).map((m) => { const hc = S.clubsById.get(m.homeClubId), ac = S.clubsById.get(m.awayClubId); return `<div class="rr"><div><b>${esc(hc.name)} — ${esc(ac.name)}</b><span>${m.venue ? esc(m.venue) : ''}</span></div>${m.status === 'played' ? `<span class="sc">${m.homeGoals} – ${m.awayGoals}</span>` : `<span class="sc st">${m.status === 'postponed' ? 'Rinviata' : timeIt(m.kickoffAt)}</span>`}${m.videoUrl ? `<a href="${m.videoUrl}" target="_blank" rel="noopener" class="play">${icon('play', 'ic sm')}</a>` : '<span></span>'}</div>`; }).join('')}</div>`;
    const tot = `<div class="tot"><span class="pillt">Totale parziali</span><div class="r"><b>${fmt(r.home.baseTotal)}</b><span>Voto Titano</span><b>${fmt(r.away.baseTotal)}</b></div><hr><div class="r fv"><b>${fmt(r.homeScore)}</b><span>con bonus/malus</span><b>${fmt(r.awayScore)}</b></div></div>`;
    const others = S.fixturesOf(n).filter((x) => x.id !== f.id);
    return `<main class="a-body" style="padding:0;gap:0">${head}<div style="padding:12px 16px 16px;display:flex;flex-direction:column;gap:12px">${formula}${body}${tot}
      <div class="a-sec"><b>Altri incontri</b><span>giornata ${n}</span></div><div class="real">${others.map((x) => { const rr = S.fixtureResult(x); const hh = S.managersById.get(x.homeManagerId), aa = S.managersById.get(x.awayManagerId); return `<a class="rr" href="#/live/${x.id}" style="text-decoration:none;color:inherit"><div><b>${esc(hh.teamName)} — ${esc(aa.teamName)}</b><span>${rr.played ? `${fmt(rr.homeScore)} – ${fmt(rr.awayScore)}` : ''}</span></div><span class="sc">${rr.played ? `${rr.homeGoals} – ${rr.awayGoals}` : 'VS'}</span>${icon('chev', 'ic sm')}</a>`; }).join('')}</div></div></main>
      <nav class="l-nav"><button class="${tab === 'campo' ? 'on' : ''}" data-tab="campo" aria-label="Campo">${icon('shirt')}</button><button class="${tab === 'lista' ? 'on' : ''}" data-tab="lista" aria-label="Lista">${icon('list')}</button><span class="sep"></span><a href="#/calendario/${n}" aria-label="Titani.TV" style="display:grid;place-items:center;color:var(--text-muted)">${icon('play')}</a><button class="${tab === 'campionato' ? 'on' : ''}" data-tab="campionato" aria-label="Campionato">${logo()}</button></nav>`;
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
