import * as S from '../state.js';
import { validateLineup, parseModule } from '../engine.js';
import { esc, fmt, roleChip, ROLE_NAME, badge, icon, avatar, dateIt, timeIt } from '../ui.js';

let draft = null; let draftFor = null;
function ensureDraft() {
  const n = S.giornataDaSchierare(); const me = S.me();
  if (!draft || draftFor !== `${n}:${me.id}`) { const l = S.lineupFor(n, me.id); draft = { formation: l.formation, starters: [...l.starters], bench: [...l.bench], captainId: l.captainId, viceCaptainId: l.viceCaptainId }; draftFor = `${n}:${me.id}`; }
  return draft;
}
const P = (id) => S.playersById.get(id);

/** Segnature del campo. viewBox 100x136: il disegno si stira col riquadro,
 *  ma vector-effect tiene le linee dello stesso spessore. */
const CAMPO = `<svg class="campo" viewBox="0 0 100 136" preserveAspectRatio="none" aria-hidden="true">
  <rect x="2" y="2" width="96" height="132" rx="2"/>
  <path d="M2 68h96"/><circle cx="50" cy="68" r="15"/><circle cx="50" cy="68" r="1.4" fill="rgba(255,255,255,.55)"/>
  <rect x="26" y="2" width="48" height="20"/><rect x="38" y="2" width="24" height="8"/>
  <rect x="26" y="114" width="48" height="20"/><rect x="38" y="126" width="24" height="8"/>
  <path d="M38 22a12 9 0 0 0 24 0"/><path d="M38 114a12 9 0 0 1 24 0"/>
  <path d="M2 7a5 5 0 0 0 5-5"/><path d="M98 7a5 5 0 0 1-5-5"/>
  <path d="M2 129a5 5 0 0 1 5 5"/><path d="M98 129a5 5 0 0 0-5 5"/>
</svg>`;
const clubOf = (id) => S.clubsById.get(P(id).clubId);

function slotsByRole(d) {
  const need = parseModule(d.formation); const out = { P: [], D: [], C: [], A: [] };
  for (const id of d.starters) if (id && out[P(id).role].length < need[P(id).role]) out[P(id).role].push(id);
  for (const r of ['P', 'D', 'C', 'A']) while (out[r].length < need[r]) out[r].push(null);
  return out;
}
function normalize(d) {
  const before = d.starters.filter(Boolean); const s = slotsByRole(d); d.starters = [...s.P, ...s.D, ...s.C, ...s.A];
  // chi esce dal modulo va in panchina se c'è posto (art. 8.1: 7 panchinari)
  for (const id of before) if (!d.starters.includes(id) && !d.bench.includes(id) && d.bench.filter(Boolean).length < 7) d.bench.push(id);
  if (d.captainId && !d.starters.includes(d.captainId)) d.captainId = null; if (d.viceCaptainId && !d.starters.includes(d.viceCaptainId)) d.viceCaptainId = null;
}
/** Riempie gli slot vuoti con i migliori del ruolo non ancora schierati (quotazione). */
function autofill(d, rosterIds) {
  const s = slotsByRole(d); const used = new Set([...d.starters, ...d.bench].filter(Boolean));
  for (const r of ['P', 'D', 'C', 'A']) s[r] = s[r].map((id) => { if (id) return id; const pick = rosterIds.filter((x) => P(x).role === r && !used.has(x)).sort((a, b) => P(b).quotation - P(a).quotation)[0] || null; if (pick) used.add(pick); return pick; });
  d.starters = [...s.P, ...s.D, ...s.C, ...s.A];
}

export const formazione = {
  title: 'Formazione', sub: () => 'Rosa · Formazione',
  render() {
    const d = ensureDraft(); normalize(d); const me = S.me(); const n = S.giornataDaSchierare(); const md = S.matchday(n); const st = S.matchdayStatus(n);
    const locked = st !== 'open' && st !== 'scheduled';
    const s = slotsByRole(d); const errors = validateLineup({ ...d, starters: d.starters.filter(Boolean), bench: d.bench.filter(Boolean) }, S.playersById);
    const saved = S.savedLineup(n, me.id);
    const fx = S.myFixture(n, me.id); const opp = fx ? S.managersById.get(fx.homeManagerId === me.id ? fx.awayManagerId : fx.homeManagerId) : null;
    const slot = (id, role, i) => id
      ? `<div class="slot" data-slot="${role}:${i}"><span class="av faccia">${d.captainId === id ? '<span class="cap">C</span>' : d.viceCaptainId === id ? '<span class="cap">V</span>' : ''}${avatar(P(id), S.clubsById.get(P(id).clubId))}${roleChip(role)}</span><b>${esc(P(id).lastName)}</b></div>`
      : `<div class="slot empty" data-slot="${role}:${i}"><span class="av">+</span><b>${ROLE_NAME[role].slice(0, -1).replace('Portier', 'Portiere')}</b></div>`;
    const line = (role) => `<div class="line" data-line="${role.toLowerCase()}">${s[role].map((id, i) => slot(id, role, i)).join('')}</div>`;
    const bench = Array.from({ length: 7 }, (_, i) => d.bench[i] || null);
    return `<main class="a-body">
      <div class="chips"><a class="chip" href="#/rosa" style="text-decoration:none">Rosa 25</a><a class="chip on" href="#/rosa/formazione" style="text-decoration:none">Formazione</a></div>
      <div class="a-card a-fase">${locked ? badge('live', `formazioni bloccate · lock ${dateIt(md.lockAt)} ${timeIt(md.lockAt)}`) : badge('open', `lock ${dateIt(md.lockAt)} ${timeIt(md.lockAt)}`)}
        <div class="r"><p><b>Giornata ${n}</b>${opp ? ` · ${esc(me.teamName)} – ${esc(opp.teamName)}` : ''}</p><span class="small muted">${saved ? `salvata ${dateIt(saved.submittedAt)} ${timeIt(saved.submittedAt)}` : 'non salvata'}</span></div>
        ${!saved ? `<p class="small muted">Se non consegni, vale ${S.lineupFor(n, me.id).source === 'ufficio' ? 'il 4-4-2 con le quotazioni più alte (art. 8.4)' : `l'ultima formazione valida (${S.lineupFor(n, me.id).source})`}.</p>` : ''}
      </div>
      <div class="chips" data-modules>${S.rules().modules.map((m) => `<button class="chip mod${m === d.formation ? ' on' : ''}" data-mod="${m}" ${locked ? 'disabled' : ''}>${m}</button>`).join('')}</div>
      <div class="pitch-wrap"><div class="pitch">${CAMPO}${line('P')}${line('D')}${line('C')}${line('A')}</div></div>
      <div class="a-sec"><b>Panchina</b><span>l'ordine conta: entra il primo del ruolo con voto</span></div>
      <div class="bench">${bench.map((id, i) => `<div class="br" data-bench="${i}"><span class="n">${i + 1}</span>${id ? roleChip(P(id).role) : '<span class="rl" style="background:var(--border-strong)">?</span>'}<b>${id ? `${esc(P(id).name)}<small>${esc(clubOf(id).name)}</small>` : '<span class="muted">Scegli un giocatore</span>'}</b><span style="display:flex;gap:2px">${id && !locked ? `<button class="rm" data-up="${i}" aria-label="Su">↑</button><button class="rm" data-down="${i}" aria-label="Giù">↓</button><button class="rm" data-rmb="${i}" aria-label="Togli">✕</button>` : ''}</span></div>`).join('')}</div>
      ${errors.length ? `<div class="warn block">${icon('warn', 'ic sm')}<span>${errors.map(esc).join(' · ')}</span></div>` : ''}
      <button class="a-btn" id="confirm" ${locked || errors.length ? 'disabled' : ''}>${icon('check', 'ic sm')}${locked ? 'Formazione bloccata' : `Conferma formazione · ${d.starters.filter(Boolean).length}/11`}</button>
      <p class="small muted" style="text-align:center">Capitano e vice: tocca un titolare. Il capitano raddoppia bonus e malus (art. 6).</p>
    </main>`;
  },
  mount(root, ctx) {
    const d = ensureDraft(); const n = S.giornataDaSchierare(); const me = S.me(); const st = S.matchdayStatus(n);
    if (st !== 'open' && st !== 'scheduled') return;
    const rosterIds = S.rosterIds(me.id).filter((id) => P(id).isActive);
    const used = () => new Set([...d.starters, ...d.bench].filter(Boolean));
    const pickSheet = (role, onPick, title) => {
      const list = rosterIds.filter((id) => (role ? P(id).role === role : true)).sort((a, b) => P(b).quotation - P(a).quotation);
      ctx.sheet(`<h3>${title}</h3><div class="plist">${list.map((id) => `<button data-pick="${id}" ${used().has(id) ? 'disabled' : ''}>${roleChip(P(id).role)}<span><b>${esc(P(id).name)}</b><span>${esc(clubOf(id).name)}${used().has(id) ? ' · già schierato' : ''}</span></span><span class="q">${P(id).quotation}</span></button>`).join('')}</div>`);
      document.getElementById('sheet').onclick = (e) => { const b = e.target.closest('[data-pick]'); if (!b) return; onPick(b.dataset.pick); ctx.sheet(null); ctx.render(); };
    };
    root.querySelector('main').addEventListener('click', (e) => {
      const mod = e.target.closest('[data-mod]'); if (mod) { d.formation = mod.dataset.mod; normalize(d); autofill(d, rosterIds); ctx.render(); return; }
      const sl = e.target.closest('[data-slot]');
      if (sl) {
        const [role, i] = sl.dataset.slot.split(':'); const s = slotsByRole(d); const id = s[role][+i];
        if (!id) { pickSheet(role, (pid) => { s[role][+i] = pid; d.starters = [...s.P, ...s.D, ...s.C, ...s.A]; }, `Scegli ${ROLE_NAME[role].toLowerCase()}`); return; }
        ctx.sheet(`<h3>${esc(P(id).name)}</h3><div class="plist">
          <button data-act="cap">${icon('star', 'ic sm')}<span><b>Capitano</b><span>raddoppia bonus e malus</span></span><span></span></button>
          <button data-act="vice">${icon('star', 'ic sm')}<span><b>Vice capitano</b><span>subentra se il capitano è S.V.</span></span><span></span></button>
          <button data-act="swap">${icon('shirt', 'ic sm')}<span><b>Sostituisci</b><span>scegli un altro ${ROLE_NAME[role].slice(0, -1).toLowerCase()}</span></span><span></span></button>
          <button data-act="rm">${icon('out', 'ic sm')}<span><b>Togli dalla formazione</b></span><span></span></button></div>`);
        document.getElementById('sheet').onclick = (ev) => {
          const b = ev.target.closest('[data-act]'); if (!b) return; const s2 = slotsByRole(d);
          if (b.dataset.act === 'cap') { if (d.viceCaptainId === id) d.viceCaptainId = null; d.captainId = id; }
          if (b.dataset.act === 'vice') { if (d.captainId === id) d.captainId = null; d.viceCaptainId = id; }
          if (b.dataset.act === 'rm') { s2[role][+i] = null; d.starters = [...s2.P, ...s2.D, ...s2.C, ...s2.A]; }
          if (b.dataset.act === 'swap') { s2[role][+i] = null; d.starters = [...s2.P, ...s2.D, ...s2.C, ...s2.A]; ctx.sheet(null); pickSheet(role, (pid) => { const s3 = slotsByRole(d); s3[role][+i] = pid; d.starters = [...s3.P, ...s3.D, ...s3.C, ...s3.A]; }, `Scegli ${ROLE_NAME[role].toLowerCase()}`); return; }
          ctx.sheet(null); ctx.render();
        };
        return;
      }
      const up = e.target.closest('[data-up]'); if (up) { const i = +up.dataset.up; if (i > 0) [d.bench[i - 1], d.bench[i]] = [d.bench[i], d.bench[i - 1]]; ctx.render(); return; }
      const dn = e.target.closest('[data-down]'); if (dn) { const i = +dn.dataset.down; if (i < 6) [d.bench[i + 1], d.bench[i]] = [d.bench[i], d.bench[i + 1]]; ctx.render(); return; }
      const rmb = e.target.closest('[data-rmb]'); if (rmb) { d.bench.splice(+rmb.dataset.rmb, 1); ctx.render(); return; }
      const br = e.target.closest('[data-bench]'); if (br && !d.bench[+br.dataset.bench]) { pickSheet(null, (pid) => { d.bench[+br.dataset.bench] = pid; d.bench = d.bench.filter(Boolean).slice(0, 7); }, 'Scegli un panchinaro'); return; }
      if (e.target.closest('#confirm')) {
        const errors = validateLineup({ ...d, starters: d.starters.filter(Boolean), bench: d.bench.filter(Boolean) }, S.playersById);
        if (errors.length) { ctx.toast(errors[0]); return; }
        S.saveLineup(n, me.id, { ...d, bench: d.bench.filter(Boolean) }); ctx.toast(`Formazione salvata · giornata ${n}`);
      }
    });
  },
};
