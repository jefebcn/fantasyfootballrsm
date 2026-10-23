import * as S from '../state.js';
import { validateLineup, votoUfficio } from '../engine.js';
import { esc, roleChip, faccia, ROLE_NAME, badge, icon, avatar, dateIt, timeIt, fmt, voteRow, sec } from '../ui.js';
import { schedeRosa } from './rosa.js';
import * as M from '../formazione-mosse.js';

let draft = null; let draftFor = null;
function ensureDraft() {
  const n = S.giornataDaSchierare(); const me = S.me();
  if (!draft || draftFor !== `${n}:${me.id}`) { const l = S.lineupFor(n, me.id); draft = { formation: l.formation, starters: [...l.starters], bench: [...l.bench], captainId: l.captainId, viceCaptainId: l.viceCaptainId }; draftFor = `${n}:${me.id}`; tolti = []; bozzaSalvata = comeBozza(draft); }
  return draft;
}
/**
 * LA BOZZA SUL SERVER (046). Prima la formazione in preparazione stava solo
 * nel telefono: chi la sistemava e si dimenticava «Conferma formazione»
 * perdeva 0-3 a tavolino con la squadra pronta sullo schermo. Ora a ogni
 * modifica (non all'apertura: quella e' la proposta dell'app, non una scelta)
 * la bozza parte da sola dopo un attimo, e chi amministra la vede e la puo'
 * confermare. Conta solo come promemoria: consegnata e' solo quella confermata.
 */
let bozzaSalvata = null; let attesaBozza = null;
const comeBozza = (d) => JSON.stringify({ formation: d.formation, starters: d.starters, bench: d.bench.filter(Boolean), captainId: d.captainId || null, viceCaptainId: d.viceCaptainId || null });
function programmaBozza(n, managerId, d) {
  const corpo = comeBozza(d);
  if (corpo === bozzaSalvata) return;
  clearTimeout(attesaBozza);
  attesaBozza = setTimeout(() => { bozzaSalvata = corpo; S.salvaBozza(n, managerId, JSON.parse(corpo)); }, 1500);
}
const P = (id) => S.playersById.get(id);
/** Chi non e' piu' in rosa esce dalla formazione da preparare: la bozza resta
 *  in memoria anche mentre si vende dal Negozio, e la proposta puo' venire da
 *  una giornata vecchia. Lo slot resta vuoto, cosi' si vede cosa rimettere. */
let tolti = [];
function togliCeduti(d, managerId) {
  const fuori = new Set(S.fuoriRosa(managerId, [...d.starters, ...d.bench]));
  if (!fuori.size) return;
  tolti = [...new Set([...tolti, ...fuori])];
  d.starters = d.starters.map((id) => (fuori.has(id) ? null : id));
  d.bench = d.bench.filter((id) => !fuori.has(id));
  if (fuori.has(d.captainId)) d.captainId = null; if (fuori.has(d.viceCaptainId)) d.viceCaptainId = null;
}

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
function benchRow(id, i, bench, locked, voto = '', lampo = new Set()) {
  if (!id) return `<div class="br vuota" data-bench="${i}"><span class="n">${i + 1}</span>
    <span class="av-ph">+</span><span class="nm"><b>Aggiungi un panchinaro</b><span>tocca per scegliere</span></span></div>`;
  const p = P(id); const primo = bench.findIndex((x) => x && P(x).role === p.role) === i;
  const su = i > 0 && bench[i - 1]; const giu = i < 6 && bench[i + 1];
  return `<div class="br${lampo.has(id) ? ' appena' : ''}" data-bench="${i}"><span class="n">${i + 1}</span>
    ${faccia(p, clubOf(id))}
    <span class="nm"><b>${esc(p.name)}${!locked && S.squalifica(id) ? ' <i class="squal">SQUALIFICATO</i>' : ''}</b><span>${locked ? '' : `${fmTesto(id)} · `}${esc(clubOf(id).name)} · quot. ${p.quotation}</span></span>
    ${voto}
    <span class="primo${primo ? '' : ' no'}"${primo ? ` title="Primo ${ROLE_NAME[p.role].slice(0, -1).toLowerCase()} della panchina: entra lui se un ${ROLE_NAME[p.role].slice(0, -1).toLowerCase()} titolare non prende voto"` : ' aria-hidden="true"'}>${primo ? `1º ${p.role}` : ''}</span>
    ${locked ? '' : `<span class="acts"><button class="rm" data-up="${i}" aria-label="Sposta su ${esc(p.name)}" ${su ? '' : 'disabled'}>${icon('up', 'ic sm')}</button><button class="rm" data-down="${i}" aria-label="Sposta giù ${esc(p.name)}" ${giu ? '' : 'disabled'}>${icon('down', 'ic sm')}</button></span>`}</div>`;
}

const ruoloDi = (id) => P(id)?.role;
const perQuot = (a, b) => P(b).quotation - P(a).quotation;
const perRuolo = (a, b) => (M.RUOLI.indexOf(ruoloDi(a)) - M.RUOLI.indexOf(ruoloDi(b))) || perQuot(a, b);
let appena = new Set();
/**
 * LA FANTAMEDIA (Alex, 23/10): «sotto i personaggi una fantamedia, cosi' chi
 * non conosce bene i calciatori puo' basarsi sulle statistiche». E' la media
 * dei fantavoti nelle partite giocate fin qui (S.rendimento), senza quelle
 * senza voto. Sotto il 6 in rosso, dal 7 in verde: si legge senza leggere.
 */
const fmDi = (id) => S.rendimento(id);
const fmClasse = (m) => (m == null ? 'fm-nd' : m >= 7 ? 'fm-su' : m < 6 ? 'fm-giu' : '');
const fmNum = (m) => (m == null ? '–' : fmt(m, 2));
const fmChip = (id) => { const r = fmDi(id); return `<i class="fm ${fmClasse(r.media)}" title="${r.media == null ? 'Nessun voto finora' : `Fantamedia in ${r.presenze} ${r.presenze === 1 ? 'partita' : 'partite'}`}">FM ${fmNum(r.media)}</i>`; };
const fmTesto = (id) => { const r = fmDi(id); return r.media == null ? '<span class="fm-t fm-nd">FM –</span>' : `<span class="fm-t ${fmClasse(r.media)}">FM ${fmNum(r.media)}</span> in ${r.presenze}`; };
/** Chi scegliere prima: chi ha la fantamedia piu' alta, poi la quotazione. */
const perFm = (a, b) => ((fmDi(b).media ?? -1) - (fmDi(a).media ?? -1)) || perQuot(a, b);
const slotsByRole = (d) => M.posti(d, ruoloDi);
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

/**
 * DA DOVE VENGONO I VOTI. Alex, 10/10: «un 18,5 in campo, e non si sa
 * perche'». Sotto la panchina, chi ha gia' il voto, dal piu' alto: voto base,
 * ogni bonus e malus con la sua regola, e il capitano col suo raddoppio — lo
 * stesso dettaglio della pagina Voti, senza doverci andare. Il primo e'
 * gia' aperto, gli altri si aprono col tocco. Chi e' senza voto (art. 8.6) non ha
 * niente da spiegare e resta fuori.
 */
function daDoveVengono(esito, voti) {
  const giocato = esito.rows.filter((r) => !r.official && !r.isSV);
  if (!giocato.length) return '';
  giocato.sort((a, b) => b.fantaVote - a.fantaVote);
  const righe = giocato.map((r, i) => {
    const pl = P(r.playerId); const vero = voti?.get(r.playerId);
    const voci = [...(r.breakdown || [])];
    const grezzo = r1(r.fantaVote - r.baseVote) - r1((vero?.fantaVote ?? r.fantaVote) - r.baseVote);
    if (r.isCaptain && grezzo) voci.push({ label: 'Capitano', note: 'bonus e malus raddoppiati · art. 6', value: grezzo });
    const sub = r.subFor ? `<div class="vnota-sub">Entrato dalla panchina al posto di <b>${esc(P(r.subFor).name)}</b>, senza voto (art. 8.2)</div>` : '';
    return voteRow(pl, S.clubsById.get(pl.clubId), { ...vero, fantaVote: r.fantaVote, breakdown: voci, isSV: false },
      { expanded: i === 0, captain: r.isCaptain, extra: sub });
  }).join('');
  return `${sec('Da dove vengono i voti', 'tocca un giocatore')}
      <div class="vlist voti-spiegati">${righe}</div>`;
}
const r1 = (x) => Math.round(x * 10) / 10;

/**
 * PANCHINA SCOPERTA. Dalla 6ª un titolare senza voto e senza sostituto e' un
 * buco e conta 0 (art. 8.6, Alex 13/10): se in panchina non c'e' nessuno di
 * un ruolo che hai in campo, quel ruolo non ha rete. Non blocca la consegna —
 * puo' essere una scelta — ma lo si dice prima, non a giornata finita.
 */
const UNO = { P: 'portiere', D: 'difensore', C: 'centrocampista', A: 'attaccante' };
function scoperta(d, n) {
  const ruolo = (id) => S.playersById.get(id)?.role;
  const inCampo = new Set(d.starters.filter(Boolean).map(ruolo));
  const inPanchina = new Set(d.bench.filter(Boolean).map(ruolo));
  const senza = ['P', 'D', 'C', 'A'].filter((r) => inCampo.has(r) && !inPanchina.has(r));
  if (!senza.length) return '';
  const v = votoUfficio(S.rules(), n);
  const conta = v ? `vale ${fmt(v)} d'ufficio` : 'è un buco e conta 0';
  const chi = senza.map((r) => UNO[r]).join(senza.length > 2 ? ', ' : ' né ').replace(/, ([^,]*)$/, ' né $1');
  return `<div class="warn info panchina-scoperta">${icon('warn', 'ic sm')}<span><b>In panchina non hai nessun ${chi}.</b> Se un titolare di ${senza.length > 1 ? 'quei ruoli' : 'quel ruolo'} non gioca, nessuno lo sostituisce: ${conta} (art. 8.6).</span></div>`;
}

export const formazione = {
  title: 'Formazione', sub: () => 'Rosa · Formazione',
  serveSquadra: true,   // senza una squadra in questa lega: app.js mostra «Non fai parte di questa lega»
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
    const d = b ? S.lineupFor(n, me.id) : (() => { const x = ensureDraft(); if (!locked) togliCeduti(x, me.id); normalize(x); return x; })();
    if (locked || b) tolti = [];
    // I voti ci sono solo a giornata cominciata, e arrivano una partita per
    // volta: chi non ha ancora giocato semplicemente non ce l'ha.
    //
    // In campo si mostra il numero CHE CONTA, non il voto grezzo: il capitano
    // raddoppia bonus e malus (art. 6), quindi un portiere da 1,5 sulla
    // fascia di capitano nel totale pesa -2,5. Mostrare 1,5 e sommare -2,5
    // faceva un conto che non tornava — ed e' la prima cosa che si guarda.
    const voti = locked ? S.ratingsOf(n) : null;
    const esito = locked ? S.lineupResult(n, me.id) : null;
    const perTitolare = new Map();
    if (esito) esito.rows.forEach((r, i) => perTitolare.set(esito.lineup.starters[i], r));
    const grezzo = (id) => { const r = voti && voti.get(id); return r ? `<i class="fvc${r.isSV ? ' sv' : ''}">${r.isSV ? 'S.V.' : fmt(r.fantaVote)}</i>` : ''; };
    const voto = (id) => {
      const r = perTitolare.get(id);
      if (!r) return grezzo(id);
      if (r.official) return '';                       // non ha ancora giocato
      if (r.subFor === id) return '<i class="fvc sv" title="Senza voto: al suo posto entra un panchinaro (art. 8.2)">&#8646;</i>';
      return `<i class="fvc${r.isCaptain ? ' cap' : ''}"${r.isCaptain ? ' title="Capitano: bonus e malus raddoppiati (art. 6)"' : ''}>${fmt(r.fantaVote)}</i>`;
    };
    const s = slotsByRole(d); const errors = validateLineup({ ...d, starters: d.starters.filter(Boolean), bench: d.bench.filter(Boolean) }, S.playersById);
    const saved = S.savedLineup(n, me.id);
    const rosa = S.rosaIncompletaPerSchierare(me.id);
    const fx = S.myFixture(n, me.id); const opp = fx ? S.managersById.get(fx.homeManagerId === me.id ? fx.awayManagerId : fx.homeManagerId) : null;
    // chi si e' appena mosso lampeggia un attimo: si vede dove e' finito
    const lampo = appena; appena = new Set();
    const slot = (id, role, i) => id
      ? `<div class="slot${lampo.has(id) ? ' appena' : ''}" data-slot="${role}:${i}"><span class="av faccia">${d.captainId === id ? '<span class="cap">C</span>' : d.viceCaptainId === id ? '<span class="cap">V</span>' : ''}${avatar(P(id), S.clubsById.get(P(id).clubId))}${roleChip(role)}${voto(id)}${!locked && S.squalifica(id, n) ? '<span class="squal-x" title="Squalificato">SQ</span>' : ''}</span><b>${esc(P(id).lastName)}</b>${!locked ? fmChip(id) : ''}</div>`
      : `<div class="slot vuoto" data-slot="${role}:${i}"><span class="av">+</span><b>${ROLE_NAME[role].slice(0, -1).replace('Portier', 'Portiere')}</b></div>`;
    const line = (role) => `<div class="line" data-line="${role.toLowerCase()}">${s[role].map((id, i) => slot(id, role, i)).join('')}</div>`;
    const bench = Array.from({ length: 7 }, (_, i) => d.bench[i] || null);
    const editabile = !b && !locked;
    const inTribuna = editabile ? M.tribuna(d, S.rosterIds(me.id).filter((id) => P(id)?.isActive)).sort(perRuolo) : [];
    const ruoliPanca = new Set(bench.filter(Boolean).map(ruoloDi));
    return `<main class="a-body">
      ${schedeRosa('formazione')}
      <div class="a-card a-fase">
        <div class="r"><p><b>Giornata ${n}</b>${opp ? ` · ${esc(me.teamName)} – ${esc(opp.teamName)}` : ''}</p>
          ${locked ? badge('live') : badge('open')}</div>
        <div class="fase-lock">${icon('clock', 'ic sm')}<span>${locked ? 'bloccata da' : 'si chiude'} <b>${dateIt(md.lockAt)} ${timeIt(md.lockAt)}</b></span>
          <span class="sep"></span>${saved ? `<span>salvata ${dateIt(saved.submittedAt)} ${timeIt(saved.submittedAt)}</span>` : '<span class="da-fare">da consegnare</span>'}</div>
        ${!saved && !locked ? `<p class="small muted"><b>Se non consegni, la partita è persa 0-3 a tavolino</b> (art. 8.4). Quella qui sotto è solo una proposta — ${S.lineupFor(n, me.id).source === 'ufficio' ? 'il 4-4-2 con le quotazioni più alte' : `l'ultima che hai schierato (${S.lineupFor(n, me.id).source})`} — e non conta finché non la confermi.</p>` : ''}
        ${tolti.length && !locked ? `<p class="small muted ceduti"><b>${tolti.map((id) => esc(P(id) ? P(id).name : id)).join(', ')}</b> non ${tolti.length === 1 ? 'è' : 'sono'} più nella tua rosa: ${tolti.length === 1 ? "l'abbiamo tolto" : "li abbiamo tolti"} dalla formazione. Scegli chi mettere al ${tolti.length === 1 ? 'suo posto' : 'loro posto'} e conferma.</p>` : ''}
        ${(() => {
    // CONSEGNATA COL LISTONE DI PRIMA (23/10, Faustina): il 17/10 Piscitella
    // e' passato da centrocampista ad attaccante, e una formazione 3-4-3
    // consegnata il 12/10 e' diventata un 3-3-4 senza che nessuno lo dicesse.
    // Il server l'aveva controllata quando e' arrivata; qui si ricontrolla coi
    // ruoli di adesso, e chi e' ancora in tempo lo sa.
    if (!saved || locked || b) return '';
    const err = validateLineup({ ...saved, starters: (saved.starters || []).filter(Boolean), bench: (saved.bench || []).filter(Boolean) }, S.playersById, S.rules());
    return err.length ? `<div class="warn block consegnata-vecchia">${icon('warn', 'ic sm')}<span><b>La formazione che hai consegnato non torna più</b> (${err.map(esc).join(' · ')}): dopo la consegna è cambiato qualcosa nel listone, per esempio il ruolo di un giocatore. Sistemala qui sotto e riconferma.</span></div>` : '';
  })()}
        ${!saved && locked ? `<p class="small muted"><b>Formazione non consegnata</b>: la partita è persa 0-3 a tavolino (art. 8.4). Quella qui sotto non conta, è solo l'ultima proposta.</p>` : ''}
        ${b ? (() => {
    // DA DOVE VIENE IL NUMERO. Con due voti sul campo il totale e' "quanto
    // farei se la giornata finisse adesso": chi non ha ancora giocato conta
    // come un titolare senza sostituto (art. 8.6: 0 dalla 6ª, 5,5 fino alla
    // 5ª). Senza dirlo, quel numero sembra sbagliato.
    const res = esito;
    if (!res) return `<p class="small muted">${b.mancanti === 1 ? 'Manca una partita' : `Mancano ${b.mancanti} partite su ${b.partite}`}: la formazione della ${b.giornata}ª si apre a giornata finita.</p>`;
    const ufficio = res.rows.filter((r) => r.official).length;
    // fino alla 5ª 5,5 d'ufficio, dalla 6ª 0 (art. 8.6): lo dice la riga stessa
    const valeUfficio = res.rows.find((r) => r.official)?.fantaVote || 0;
    const conVoto = res.rows.length - ufficio;
    const cambi = res.subsApplied.length;
    return `<div class="fase-punti"><span>Punti se finisse adesso</span><b>${fmt(res.total)}</b></div>
        <p class="small muted"><b>${conVoto} su ${res.rows.length}</b> ${conVoto === 1 ? 'ha' : 'hanno'} il voto${cambi ? ` · ${cambi} ${cambi === 1 ? 'entrato dalla panchina' : 'entrati dalla panchina'}` : ''}${ufficio ? ` · ${ufficio === 1 ? 'uno' : ufficio} ${valeUfficio ? `${ufficio === 1 ? 'vale' : 'valgono'} ${fmt(valeUfficio)} d'ufficio` : `${ufficio === 1 ? 'conta' : 'contano'} 0`} finché non gioca${ufficio === 1 ? '' : 'no'} (art. 8.6)` : ''}.</p>
        <p class="small muted">${b.mancanti === 1 ? 'Manca una partita' : `Mancano ${b.mancanti} partite su ${b.partite}`}: i voti arrivano mano a mano, e la formazione della ${b.giornata}ª si apre a giornata finita.</p>`;
  })() : ''}
      </div>
      <div class="a-sec"><b>${b ? 'In campo' : 'Modulo'}</b><span>${esc(d.formation)} · titolari ${d.starters.filter(Boolean).length}/11</span></div>
      ${/* IL MODULO SI CAMBIA A OGNI GIORNATA (Alex, 10/10). Mentre si gioca i
          tasti sparivano, e sembrava che il modulo non si potesse scegliere:
          ora restano in vista, spenti, e una riga dice quando si riaprono. */
    b ? `<p class="small muted nota">Il modulo si cambia a ogni giornata: scegli quello della ${b.giornata}ª quando si apre la sua formazione, a ${b.inGioco}ª finita.</p>
      <div class="moduli spenti" aria-hidden="true">${S.rules().modules.map((m) => `<span class="chip mod${m === d.formation ? ' on' : ''}">${m}</span>`).join('')}</div>`
    : `<p class="small muted nota">Si cambia a ogni giornata: ${S.rules().modules.length} moduli, la rosa li copre tutti.</p>
      <div class="moduli" data-modules>${S.rules().modules.map((m) => `<button class="chip mod${m === d.formation ? ' on' : ''}" data-mod="${m}" ${locked ? 'disabled' : ''}>${m}</button>`).join('')}</div>`}
      <div class="pitch-wrap"><div class="pitch">${CAMPO}${line('P')}${line('D')}${line('C')}${line('A')}</div></div>
      ${!locked && !b ? '<p class="small muted nota fm-nota"><b>FM</b> è la fantamedia: la media dei fantavoti nelle partite giocate fin qui. <span class="fm-su">Verde</span> da 7 in su, <span class="fm-giu">rossa</span> sotto il 6.</p>' : ''}
      <div class="a-sec"><b>Panchina</b><span class="copertura">${editabile ? M.RUOLI.map((r) => `<i class="${ruoliPanca.has(r) ? '' : 'manca'}" title="${ruoliPanca.has(r) ? `${UNO[r]} in panchina` : `nessun ${UNO[r]} in panchina`}">${r}</i>`).join('') : ''}${bench.filter(Boolean).length}/7</span></div>
      <p class="small muted nota">L'ordine conta: al posto di un titolare senza voto entra il <b>primo panchinaro dello stesso ruolo</b> (art. 8.2).${editabile ? ' Tocca un panchinaro per mandarlo in campo.' : ''}</p>
      <div class="bench">${bench.map((id, i) => benchRow(id, i, bench, locked, grezzo(id), lampo)).join('')}</div>
      ${editabile && d.bench.length < 7 && inTribuna.length ? `<button class="a-btn ghost completa" id="completa-panchina">${icon('userplus', 'ic sm')}Completa la panchina · ${7 - d.bench.length === 1 ? '1 posto libero' : `${7 - d.bench.length} posti liberi`}</button>` : ''}
      ${editabile && inTribuna.length ? `<div class="a-sec"><b>Tribuna</b><span>${inTribuna.length === 1 ? '1 non convocato' : `${inTribuna.length} non convocati`}</span></div>
      <p class="small muted nota">Non giocano questa giornata. Tocca per mandarli in campo o in panchina.</p>
      <div class="tribuna">${inTribuna.map((id) => `<button data-trib="${id}"${lampo.has(id) ? ' class="appena"' : ''}>${faccia(P(id), clubOf(id))}<b>${esc(P(id).lastName)}</b>${S.squalifica(id, n) ? '<span class="q"><i class="squal">SQ</i></span>' : fmChip(id)}</button>`).join('')}</div>` : ''}
      ${esito ? daDoveVengono(esito, voti) : ''}
      ${errors.length ? `<div class="warn block">${icon('warn', 'ic sm')}<span>${errors.map(esc).join(' · ')}</span></div>` : ''}
      ${!b && !locked ? scoperta(d, n) : ''}
      ${!b && !locked && rosa ? `<div class="warn block rosa-incompleta">${icon('warn', 'ic sm')}<span><b>Rosa incompleta: ${rosa.ha} su ${rosa.serve}.</b> Nella lega pubblica la formazione si consegna con tutti i ${rosa.serve} giocatori: ${rosa.mancano === 1 ? 'te ne manca 1' : `te ne mancano ${rosa.mancano}`}. Puoi ancora comprarli.</span></div>` : ''}
      ${b
    ? `<a class="a-btn" href="#/voti/${n}" style="text-decoration:none">${icon('votes', 'ic sm')}Voti della ${n}ª</a>
      <a class="a-btn sec" href="#/formazioni/${n}" style="text-decoration:none">${icon('users', 'ic sm')}Le formazioni degli altri</a>`
    : !locked && rosa
    ? `<a class="a-btn" id="completa-rosa" href="#/negozio" style="text-decoration:none">${icon('cart', 'ic sm')}Completa la rosa · ${rosa.ha}/${rosa.serve}</a>`
    : `<button class="a-btn" id="confirm" ${locked || errors.length ? 'disabled' : ''}>${icon('check', 'ic sm')}${locked ? 'Formazione bloccata' : `Conferma formazione · ${d.starters.filter(Boolean).length}/11`}</button>`}
      <p class="small muted" style="text-align:center">${b ? `La formazione della ${b.giornata}ª si apre quando la ${n}ª è finita.` : 'Tocca un titolare per cambiarlo o dargli la fascia: il capitano raddoppia bonus e malus (art. 6).'}</p>
    </main>`;
  },
  mount(root, ctx) {
    if (S.schieramentoBloccato()) return;   // la schermata e' un avviso, non ha niente da agganciare
    const d = ensureDraft(); const n = S.giornataDaSchierare(); const me = S.me(); const st = S.matchdayStatus(n);
    if (st !== 'open' && st !== 'scheduled') return;
    programmaBozza(n, me.id, d);
    const rosterIds = S.rosterIds(me.id).filter((id) => P(id)?.isActive);
    const sq = (id) => !!S.squalifica(id, n);
    const nome = (id) => esc(P(id).name);
    const cognome = (id) => P(id)?.lastName || '';

    // ---- I FOGLI. Ogni riga e' una mossa intera: un tocco e il cambio e'
    // fatto, chi esce va dove deve andare (panchina o tribuna) e lo si dice.
    // Prima chi stava in panchina compariva spento («gia' schierato») e per
    // cambiare un titolare bisognava toglierlo e poi scegliere: due passi, e se
    // ci si fermava a meta' il posto restava vuoto.
    const riga = (id, mossa, tag = '', cls = '') => `<button ${mossa}>${faccia(P(id), clubOf(id))}<span><b>${nome(id)}</b><span>${fmTesto(id)} · ${esc(clubOf(id).name)} · quot. ${P(id).quotation}${sq(id) ? ' · <b class="squal-t">squalificato</b>' : ''}</span></span>${tag ? `<span class="tag ${cls}">${tag}</span>` : '<span></span>'}</button>`;
    const libero = (mossa, r) => `<button ${mossa}><span class="av-ph">+</span><span><b>Posto libero</b><span>manca un ${UNO[r]}</span></span><span class="tag vuoto">libero</span></button>`;
    const gruppo = (titolo, righe) => (righe.length ? `<p class="pl-gruppo">${titolo}</p><div class="plist cambio">${righe.join('')}</div>` : '');
    const testa = (id, sotto) => `<div class="cambio-testa">${faccia(P(id), clubOf(id))}<span><b>${nome(id)}</b><span>${sotto}</span></span></div>`;
    const inCampo = (r, i, pid) => `data-m="campo" data-r="${r}" data-i="${i}" data-pid="${pid}"`;
    const inPanca = (pos, pid) => `data-m="panca" data-pos="${pos}" data-pid="${pid}"`;
    const panchinari = (r) => d.bench.map((x, k) => [x, k]).filter(([x]) => !r || ruoloDi(x) === r);
    const fuori = (r) => M.tribuna(d, rosterIds).filter((x) => !r || ruoloDi(x) === r).sort(r ? perFm : perRuolo);

    const apri = (html) => {
      ctx.sheet(html);
      document.getElementById('sheet').onclick = (ev) => { const t = ev.target.closest('[data-m]'); if (t && !t.disabled) esegui(t.dataset); };
    };
    /** Il titolare nel posto `i` del ruolo `r`: fascia, e chi entra al posto suo. */
    const foglioTitolare = (r, i, id) => apri(`${testa(id, `Titolare · ${UNO[r]}`)}
      <div class="fascia"><button class="chip${d.captainId === id ? ' on' : ''}" data-m="cap" data-pid="${id}">${icon('star', 'ic sm')}${d.captainId === id ? 'Capitano ✓' : 'Capitano'}</button><button class="chip${d.viceCaptainId === id ? ' on' : ''}" data-m="vice" data-pid="${id}">${icon('star', 'ic sm')}${d.viceCaptainId === id ? 'Vice ✓' : 'Vice'}</button></div>
      <p class="sheet-sub cambio-domanda">Chi entra al posto suo? Un tocco e il cambio è fatto.</p>
      ${gruppo(`Dalla panchina · ${cognome(id)} va a sedersi al suo posto`, panchinari(r).map(([x, k]) => riga(x, inCampo(r, i, x), `${k + 1}º in panchina`, 'panca')))}
      ${gruppo(`Dalla tribuna · ${cognome(id)} va in tribuna`, fuori(r).map((x) => riga(x, inCampo(r, i, x), 'tribuna', 'trib')))}
      ${!panchinari(r).length && !fuori(r).length ? `<p class="small muted">In rosa non hai altri ${ROLE_NAME[r].toLowerCase()}.</p>` : ''}
      <div class="foglio-azioni">
        ${d.bench.length < 7 ? `<button class="a-btn sec" data-m="in-panca" data-r="${r}" data-i="${i}">Mandalo in panchina</button>` : ''}
        <button class="a-btn ghost" data-m="via-campo" data-r="${r}" data-i="${i}">${icon('out', 'ic sm')}Togli dalla formazione</button>
      </div>`);
    /** Un posto vuoto in campo. */
    const foglioVuoto = (r, i) => apri(`<h3>Scegli il ${UNO[r]}</h3>
      ${gruppo('Dalla panchina', panchinari(r).map(([x, k]) => riga(x, inCampo(r, i, x), `${k + 1}º in panchina`, 'panca')))}
      ${gruppo('Dalla tribuna', fuori(r).map((x) => riga(x, inCampo(r, i, x), 'tribuna', 'trib')))}
      ${!panchinari(r).length && !fuori(r).length ? `<p class="small muted">In rosa non hai altri ${ROLE_NAME[r].toLowerCase()}: comprane uno dal Negozio.</p>` : ''}`);
    /** Il panchinaro al posto `pos`: in campo al posto di qualcuno, o scambiato con la tribuna. */
    const foglioPanchinaro = (pos, id) => {
      const r = ruoloDi(id); const s = slotsByRole(d);
      apri(`${testa(id, `Panchina · ${pos + 1}º posto · ${UNO[r]}`)}
        ${gruppo(`In campo al posto di… · chi esce va in panchina`, s[r].map((x, i) => (x ? riga(x, inCampo(r, i, id), 'titolare', 'campo') : libero(inCampo(r, i, id), r))))}
        ${gruppo('Scambialo con uno della tribuna', fuori(null).map((x) => riga(x, inPanca(pos, x), 'tribuna', 'trib')))}
        <div class="foglio-azioni"><button class="a-btn ghost" data-m="via-panca" data-pos="${pos}">${icon('trash', 'ic sm')}Togli dalla panchina</button></div>`);
    };
    /** Un posto libero in panchina. */
    const foglioPostoPanca = (pos) => apri(`<h3>Aggiungi in panchina</h3><p class="sheet-sub">${pos + 1}º posto di 7</p>
      ${M.RUOLI.map((r) => gruppo(`${ROLE_NAME[r]}${d.bench.some((x) => ruoloDi(x) === r) ? '' : ' · nessuno in panchina'}`, fuori(r).map((x) => riga(x, inPanca(pos, x))))).join('')}
      ${fuori(null).length ? `<div class="foglio-azioni"><button class="a-btn sec" data-m="completa">${icon('userplus', 'ic sm')}Completa in automatico</button></div>` : '<p class="small muted">In tribuna non c\'è nessuno: tutta la rosa è già convocata.</p>'}`);
    /** Uno della tribuna: in campo al posto di qualcuno, o in panchina. */
    const foglioTribuna = (id) => {
      const r = ruoloDi(id); const s = slotsByRole(d);
      apri(`${testa(id, `In tribuna · ${UNO[r]}`)}
        ${d.bench.length < 7 ? `<div class="foglio-azioni in-cima"><button class="a-btn sec" ${inPanca(d.bench.length, id)}>Mettilo in panchina · ${d.bench.length + 1}º posto</button></div>` : ''}
        ${gruppo('In campo al posto di… · chi esce va in tribuna', s[r].map((x, i) => (x ? riga(x, inCampo(r, i, id), 'titolare', 'campo') : libero(inCampo(r, i, id), r))))}
        ${gruppo('In panchina al posto di… · chi esce va in tribuna', panchinari(null).map(([x, k]) => riga(x, inPanca(k, id), `${k + 1}º in panchina`, 'panca')))}`);
    };

    const dove = (va) => (va === 'panchina' ? 'in panchina' : va === 'campo' ? 'cambia posto' : 'in tribuna');
    const esegui = (x) => {
      let msg = '';
      if (x.m === 'cap' || x.m === 'vice') {
        const k = x.m === 'cap' ? 'captainId' : 'viceCaptainId'; const altra = x.m === 'cap' ? 'viceCaptainId' : 'captainId';
        if (d[k] === x.pid) { d[k] = null; msg = `${cognome(x.pid)} non è più ${x.m === 'cap' ? 'capitano' : 'vice'}`; }
        else { d[k] = x.pid; if (d[altra] === x.pid) d[altra] = null; msg = `${cognome(x.pid)} ${x.m === 'cap' ? 'capitano' : 'vice capitano'}`; }
        appena = new Set([x.pid]);
      }
      if (x.m === 'campo') {
        const r = M.mettiInCampo(d, x.r, +x.i, x.pid, ruoloDi);
        appena = new Set([x.pid, r.fuori].filter(Boolean));
        msg = r.fuori ? `${cognome(x.pid)} in campo · ${cognome(r.fuori)} ${dove(r.va)}` : `${cognome(x.pid)} in campo`;
        if (r.fasce.length) msg += ` · era ${r.fasce.join(' e ')}: dai la fascia a un titolare`;
      }
      if (x.m === 'panca') {
        const r = M.mettiInPanchina(d, +x.pos, x.pid);
        appena = new Set([x.pid, r.fuori].filter(Boolean));
        msg = r.piena ? 'La panchina è piena: 7 su 7' : r.fuori ? `${cognome(x.pid)} in panchina · ${cognome(r.fuori)} in tribuna` : `${cognome(x.pid)} in panchina`;
      }
      if (x.m === 'via-campo') { const r = M.togliDalCampo(d, x.r, +x.i, ruoloDi); appena = new Set([r.fuori]); msg = `${cognome(r.fuori)} in tribuna · il posto resta libero`; }
      if (x.m === 'in-panca') { const r = M.togliDalCampo(d, x.r, +x.i, ruoloDi); M.mettiInPanchina(d, d.bench.length, r.fuori); appena = new Set([r.fuori]); msg = `${cognome(r.fuori)} in panchina · il posto in campo resta libero`; }
      if (x.m === 'via-panca') { const r = M.togliDallaPanchina(d, +x.pos); appena = new Set([r.fuori]); msg = `${cognome(r.fuori)} in tribuna`; }
      if (x.m === 'completa') msg = completa();
      ctx.sheet(null); ctx.render(); if (msg) ctx.toast(msg);
    };
    const completa = () => {
      const presi = M.completaPanchina(d, rosterIds, ruoloDi, (id) => P(id).quotation, sq);
      appena = new Set(presi);
      return presi.length ? `In panchina: ${presi.map(cognome).join(', ')}` : 'Non c\'è nessuno da aggiungere';
    };

    root.querySelector('main').addEventListener('click', (e) => {
      const mod = e.target.closest('[data-mod]'); if (mod) { d.formation = mod.dataset.mod; normalize(d, true); autofill(d, rosterIds); ctx.render(); return; }
      const sl = e.target.closest('[data-slot]');
      if (sl) {
        const [r, i] = sl.dataset.slot.split(':'); const id = slotsByRole(d)[r][+i];
        if (id) foglioTitolare(r, +i, id); else foglioVuoto(r, +i);
        return;
      }
      const up = e.target.closest('[data-up]'); if (up) { M.spostaInPanchina(d, +up.dataset.up, -1); appena = new Set([d.bench[+up.dataset.up - 1]]); ctx.render(); return; }
      const dn = e.target.closest('[data-down]'); if (dn) { M.spostaInPanchina(d, +dn.dataset.down, +1); appena = new Set([d.bench[+dn.dataset.down + 1]]); ctx.render(); return; }
      const br = e.target.closest('[data-bench]');
      if (br) { const i = +br.dataset.bench; if (d.bench[i]) foglioPanchinaro(i, d.bench[i]); else foglioPostoPanca(Math.min(i, d.bench.length)); return; }
      const tr = e.target.closest('[data-trib]'); if (tr) { foglioTribuna(tr.dataset.trib); return; }
      if (e.target.closest('#completa-panchina')) { const msg = completa(); ctx.render(); ctx.toast(msg); return; }
      if (e.target.closest('#confirm')) {
        const errors = validateLineup({ ...d, starters: d.starters.filter(Boolean), bench: d.bench.filter(Boolean) }, S.playersById);
        if (errors.length) { ctx.toast(errors[0]); return; }
        try { S.saveLineup(n, me.id, { ...d, bench: d.bench.filter(Boolean) }); tolti = []; clearTimeout(attesaBozza); bozzaSalvata = comeBozza(d); ctx.toast(`Formazione salvata · giornata ${n}`); }
        catch (err) { ctx.toast(err.message); ctx.render(); }
      }
    });
  },
};
