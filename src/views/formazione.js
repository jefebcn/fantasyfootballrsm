import * as S from '../state.js';
import { validateLineup, parseModule } from '../engine.js';
import { esc, roleChip, faccia, ROLE_NAME, badge, icon, avatar, dateIt, timeIt, fmt } from '../ui.js';

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

/** Riga di panchina. Prima erano tre tasti da 21px e il nome che andava a capo;
 *  ora la faccia e' la stessa del campo e l'ordine si sposta con due soli tasti
 *  (togli e sostituisci stanno nel foglio, come per gli slot in campo).
 *  Il segno "1º" marca chi entra per primo in quel ruolo: e' l'unica cosa che
 *  l'ordine della panchina decide davvero (art. 8.2). */
function benchRow(id, i, bench, locked, voto = '') {
  if (!id) return `<div class="br vuota" data-bench="${i}"><span class="n">${i + 1}</span>
    <span class="av-ph">+</span><span class="nm"><b>Aggiungi un panchinaro</b><span>tocca per scegliere</span></span></div>`;
  const p = P(id); const primo = bench.findIndex((x) => x && P(x).role === p.role) === i;
  const su = i > 0 && bench[i - 1]; const giu = i < 6 && bench[i + 1];
  return `<div class="br" data-bench="${i}"><span class="n">${i + 1}</span>
    ${faccia(p, clubOf(id))}
    <span class="nm"><b>${esc(p.name)}</b><span>${esc(clubOf(id).name)} · quot. ${p.quotation}</span></span>
    ${voto}
    <span class="primo${primo ? '' : ' no'}"${primo ? ` title="Primo ${ROLE_NAME[p.role].slice(0, -1).toLowerCase()} della panchina: entra lui se un ${ROLE_NAME[p.role].slice(0, -1).toLowerCase()} titolare non prende voto"` : ' aria-hidden="true"'}>${primo ? `1º ${p.role}` : ''}</span>
    ${locked ? '' : `<span class="acts"><button class="rm" data-up="${i}" aria-label="Sposta su ${esc(p.name)}" ${su ? '' : 'disabled'}>${icon('up', 'ic sm')}</button><button class="rm" data-down="${i}" aria-label="Sposta giù ${esc(p.name)}" ${giu ? '' : 'disabled'}>${icon('down', 'ic sm')}</button></span>`}</div>`;
}

function slotsByRole(d) {
  const need = parseModule(d.formation); const out = { P: [], D: [], C: [], A: [] };
  for (const id of d.starters) if (id && out[P(id).role].length < need[P(id).role]) out[P(id).role].push(id);
  for (const r of ['P', 'D', 'C', 'A']) while (out[r].length < need[r]) out[r].push(null);
  return out;
}
/** `recupera` va passato solo quando si cambia modulo: e' li' che un titolare
 *  resta fuori senza averlo deciso, e ripescarlo in panchina evita di perderlo.
 *  A render invariato il ripescaggio non faceva nulla comunque (`before` e i
 *  titolari ricalcolati coincidono), ma tenerlo esplicito evita che un domani
 *  un render qualsiasi si riempia la panchina da solo. */
function normalize(d, recupera = false) {
  const before = d.starters.filter(Boolean); const s = slotsByRole(d); d.starters = [...s.P, ...s.D, ...s.C, ...s.A];
  // chi esce dal modulo va in panchina se c'è posto (art. 8.1: 7 panchinari)
  if (recupera) for (const id of before) if (!d.starters.includes(id) && !d.bench.includes(id) && d.bench.filter(Boolean).length < 7) d.bench.push(id);
  if (d.bench.length > 7) d.bench.length = 7;
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
    // MENTRE SI GIOCA QUESTA SCHERMATA NON E' PIU' L'EDITOR: e' la squadra in
    // campo. Si guarda la formazione consegnata per la giornata in corso, coi
    // voti che arrivano mano a mano. Prima qui c'era solo un avviso, e la
    // squadra che stava giocando non si vedeva da nessuna parte — ed e' la
    // cosa che si apre l'app per guardare, la domenica pomeriggio.
    //
    // La prossima giornata non si schiera lo stesso: il divieto vero sta in
    // saveLineup, perche' una regola messa solo nella schermata vale solo per
    // quella schermata.
    const me = S.me();
    const b = S.schieramentoBloccato();
    const n = b ? b.inGioco : S.giornataDaSchierare(); const md = S.matchday(n); const st = S.matchdayStatus(n);
    const locked = st !== 'open' && st !== 'scheduled';
    const d = b ? S.lineupFor(n, me.id) : (() => { const x = ensureDraft(); normalize(x); return x; })();
    // I voti ci sono solo a giornata cominciata, e arrivano una partita per
    // volta: chi non ha ancora giocato semplicemente non ce l'ha.
    const voti = locked ? S.ratingsOf(n) : null;
    const voto = (id) => { const r = voti && voti.get(id); return r ? `<i class="fvc${r.isSV ? ' sv' : ''}">${r.isSV ? 'S.V.' : fmt(r.fantaVote)}</i>` : ''; };
    const s = slotsByRole(d); const errors = validateLineup({ ...d, starters: d.starters.filter(Boolean), bench: d.bench.filter(Boolean) }, S.playersById);
    const saved = S.savedLineup(n, me.id);
    const fx = S.myFixture(n, me.id); const opp = fx ? S.managersById.get(fx.homeManagerId === me.id ? fx.awayManagerId : fx.homeManagerId) : null;
    const slot = (id, role, i) => id
      ? `<div class="slot" data-slot="${role}:${i}"><span class="av faccia">${d.captainId === id ? '<span class="cap">C</span>' : d.viceCaptainId === id ? '<span class="cap">V</span>' : ''}${avatar(P(id), S.clubsById.get(P(id).clubId))}${roleChip(role)}${voto(id)}</span><b>${esc(P(id).lastName)}</b></div>`
      : `<div class="slot vuoto" data-slot="${role}:${i}"><span class="av">+</span><b>${ROLE_NAME[role].slice(0, -1).replace('Portier', 'Portiere')}</b></div>`;
    const line = (role) => `<div class="line" data-line="${role.toLowerCase()}">${s[role].map((id, i) => slot(id, role, i)).join('')}</div>`;
    const bench = Array.from({ length: 7 }, (_, i) => d.bench[i] || null);
    return `<main class="a-body">
      <div class="chips"><a class="chip" href="#/rosa" style="text-decoration:none">Rosa 25</a><a class="chip on" href="#/rosa/formazione" style="text-decoration:none">Formazione</a></div>
      <div class="a-card a-fase">
        <div class="r"><p><b>Giornata ${n}</b>${opp ? ` · ${esc(me.teamName)} – ${esc(opp.teamName)}` : ''}</p>
          ${locked ? badge('live') : badge('open')}</div>
        <div class="fase-lock">${icon('clock', 'ic sm')}<span>${locked ? 'bloccata da' : 'si chiude'} <b>${dateIt(md.lockAt)} ${timeIt(md.lockAt)}</b></span>
          <span class="sep"></span>${saved ? `<span>salvata ${dateIt(saved.submittedAt)} ${timeIt(saved.submittedAt)}</span>` : '<span class="da-fare">da consegnare</span>'}</div>
        ${!saved && !locked ? `<p class="small muted"><b>Se non consegni, la partita è persa 0-3 a tavolino</b> (art. 8.4). Quella qui sotto è solo una proposta — ${S.lineupFor(n, me.id).source === 'ufficio' ? 'il 4-4-2 con le quotazioni più alte' : `l'ultima che hai schierato (${S.lineupFor(n, me.id).source})`} — e non conta finché non la confermi.</p>` : ''}
        ${!saved && locked ? `<p class="small muted"><b>Formazione non consegnata</b>: la partita è persa 0-3 a tavolino (art. 8.4). Quella qui sotto non conta, è solo l'ultima proposta.</p>` : ''}
        ${b ? `<div class="fase-punti"><span>Punti in giornata</span><b>${fmt(S.puntiGiornata(n, me.id))}</b></div>
        <p class="small muted">${b.mancanti === 1 ? 'Manca una partita' : `Mancano ${b.mancanti} partite su ${b.partite}`}: i voti arrivano mano a mano, e la formazione della ${b.giornata}ª si apre a giornata finita.</p>` : ''}
      </div>
      <div class="a-sec"><b>${b ? 'In campo' : 'Modulo'}</b><span>${esc(d.formation)} · titolari ${d.starters.filter(Boolean).length}/11</span></div>
      ${b ? '' : `<div class="moduli" data-modules>${S.rules().modules.map((m) => `<button class="chip mod${m === d.formation ? ' on' : ''}" data-mod="${m}" ${locked ? 'disabled' : ''}>${m}</button>`).join('')}</div>`}
      <div class="pitch-wrap"><div class="pitch">${CAMPO}${line('P')}${line('D')}${line('C')}${line('A')}</div></div>
      <div class="a-sec"><b>Panchina</b><span>${bench.filter(Boolean).length}/7</span></div>
      <p class="small muted nota">L'ordine conta: al posto di un titolare senza voto entra il <b>primo panchinaro dello stesso ruolo</b> (art. 8.2).</p>
      <div class="bench">${bench.map((id, i) => benchRow(id, i, bench, locked, voto(id))).join('')}</div>
      ${errors.length ? `<div class="warn block">${icon('warn', 'ic sm')}<span>${errors.map(esc).join(' · ')}</span></div>` : ''}
      ${b
    ? `<a class="a-btn" href="#/voti/${n}" style="text-decoration:none">${icon('votes', 'ic sm')}Voti della ${n}ª</a>`
    : `<button class="a-btn" id="confirm" ${locked || errors.length ? 'disabled' : ''}>${icon('check', 'ic sm')}${locked ? 'Formazione bloccata' : `Conferma formazione · ${d.starters.filter(Boolean).length}/11`}</button>`}
      <p class="small muted" style="text-align:center">${b ? `La formazione della ${b.giornata}ª si apre quando la ${n}ª è finita.` : 'Capitano e vice: tocca un titolare. Il capitano raddoppia bonus e malus (art. 6).'}</p>
    </main>`;
  },
  mount(root, ctx) {
    if (S.schieramentoBloccato()) return;   // la schermata e' un avviso, non ha niente da agganciare
    const d = ensureDraft(); const n = S.giornataDaSchierare(); const me = S.me(); const st = S.matchdayStatus(n);
    if (st !== 'open' && st !== 'scheduled') return;
    const rosterIds = S.rosterIds(me.id).filter((id) => P(id).isActive);
    const used = () => new Set([...d.starters, ...d.bench].filter(Boolean));
    /** `libero` e' chi sta gia' nel posto che si sta sostituendo: va offerto,
     *  altrimenti nel foglio del cambio risulta "gia' schierato" e non si puo'
     *  nemmeno riconfermare. */
    const pickSheet = (role, onPick, title, libero = null) => {
      const list = rosterIds.filter((id) => (role ? P(id).role === role : true)).sort((a, b) => P(b).quotation - P(a).quotation);
      const preso = (id) => id !== libero && used().has(id);
      ctx.sheet(`<h3>${title}</h3><div class="plist">${list.map((id) => `<button data-pick="${id}" ${preso(id) ? 'disabled' : ''}>${roleChip(P(id).role)}<span><b>${esc(P(id).name)}</b><span>${esc(clubOf(id).name)}${preso(id) ? ' · già schierato' : ''}</span></span><span class="q">${P(id).quotation}</span></button>`).join('')}</div>`);
      document.getElementById('sheet').onclick = (e) => { const b = e.target.closest('[data-pick]'); if (!b) return; onPick(b.dataset.pick); ctx.sheet(null); ctx.render(); };
    };
    root.querySelector('main').addEventListener('click', (e) => {
      const mod = e.target.closest('[data-mod]'); if (mod) { d.formation = mod.dataset.mod; normalize(d, true); autofill(d, rosterIds); ctx.render(); return; }
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
      const br = e.target.closest('[data-bench]');
      if (br) {
        const i = +br.dataset.bench; const bid = d.bench[i];
        const metti = (pid) => { d.bench[i] = pid; d.bench = d.bench.filter(Boolean).slice(0, 7); };
        if (!bid) { pickSheet(null, metti, 'Scegli un panchinaro'); return; }
        // riga occupata: stesso foglio degli slot in campo, invece dei tasti minuscoli in riga
        ctx.sheet(`<h3>${esc(P(bid).name)}</h3><p class="sheet-sub">Panchina · posto ${i + 1} di 7</p><div class="plist">
          <button data-bact="swap">${icon('shirt', 'ic sm')}<span><b>Sostituisci</b><span>scegli un altro giocatore per questo posto</span></span><span></span></button>
          <button data-bact="rm">${icon('trash', 'ic sm')}<span><b>Togli dalla panchina</b><span>gli altri risalgono di un posto</span></span><span></span></button></div>`);
        document.getElementById('sheet').onclick = (ev) => {
          const t = ev.target.closest('[data-bact]'); if (!t) return;
          if (t.dataset.bact === 'rm') { d.bench.splice(i, 1); ctx.sheet(null); ctx.render(); return; }
          ctx.sheet(null); pickSheet(null, metti, 'Scegli un panchinaro', bid);
        };
        return;
      }
      if (e.target.closest('#confirm')) {
        const errors = validateLineup({ ...d, starters: d.starters.filter(Boolean), bench: d.bench.filter(Boolean) }, S.playersById);
        if (errors.length) { ctx.toast(errors[0]); return; }
        try { S.saveLineup(n, me.id, { ...d, bench: d.bench.filter(Boolean) }); ctx.toast(`Formazione salvata · giornata ${n}`); }
        catch (err) { ctx.toast(err.message); ctx.render(); }
      }
    });
  },
};
