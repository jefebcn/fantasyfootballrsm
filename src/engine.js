/**
 * Motore di scoring — Voto Titano.
 * Funzioni pure: nessuno stato, nessuna chiamata esterna.
 * Riferimenti: regolamento artt. 4-8, 10-12; README §4-6.
 */

export const ENGINE_VERSION = '1.0.0';

export const DEFAULT_RULES = {
  engineVersion: ENGINE_VERSION,
  baseVote: 6.0,
  outcome: { win: 0.5, draw: 0, loss: -0.5 },
  partialWeight: 0.5,       // 20-59 minuti
  fullMinutes: 60,
  minMinutes: 20,
  goal: { P: 6.0, D: 4.0, C: 3.5, A: 3.0 },
  assist: 1.0,
  assistSetPiece: 0.5,      // assist da palla inattiva (art. 5.3)
  cleanSheet: { P: 3.0, D: 1.5, C: 0, A: 0 },
  cleanSheetMinutes: 60,
  goalConcededGK: -1.0,
  yellow: -0.5,
  secondYellow: -1.0,
  redDirect: -2.0,
  ownGoal: -2.0,
  penMissed: -3.0,
  penSaved: 3.0,
  level2Events: false,
  penWon: 1.0,
  penConceded: -1.0,
  decisiveGoal: 0,          // gol che vale il pari o il sorpasso (art. 5.4), 0 = spento
  captainMultiplier: 2,
  maxSubs: 3,
  subMode: 'role',          // 'role' = solo stesso ruolo · 'free' = qualsiasi ruolo (art. 8.5)
  homeBonus: 0,             // fattore campo sul fantapunteggio (art. 11.3), 0 = spento
  noSubVote: 5.5,
  conversion: [
    { min: 6, max: 8, threshold: 70.0, step: 6.0 },
    { min: 9, max: 10, threshold: 69.0, step: 6.0 },
    { min: 11, max: 12, threshold: 68.0, step: 6.0 },
  ],
  modules: ['3-4-3', '3-5-2', '4-3-3', '4-4-2', '4-5-1', '5-3-2', '5-4-1'],
  roster: { P: 3, D: 8, C: 8, A: 6 },
  budget: 500,
  points: { win: 3, draw: 1, loss: 0 },
  maxPerClub: 0, // 0 = nessun tetto (art. 2.6 opzionale)
};

export const SV_STATUSES = new Set(['postponed', 'suspended_before_45', 'awarded']);

const r1 = (n) => Math.round(n * 100) / 100;

/** Intervallo in campo di una presenza: [from, to] in minuti. */
export function onPitchInterval(appearance) {
  const minutes = appearance.minutesPlayed ?? 0;
  const from = appearance.started ? 0 : (appearance.enteredAt ?? Math.max(0, 90 - minutes));
  return [from, from + minutes];
}

/**
 * computeRating — (player, appearance, events, match, rules) → PlayerRating
 * events: tutti gli eventi della partita (di entrambe le squadre).
 */
export function computeRating({ player, appearance, events, match, rules = DEFAULT_RULES }) {
  const lines = [];
  const sv = (reason) => ({
    playerId: player.id, matchId: match.id, isSV: true, svReason: reason,
    baseVote: null, bonus: 0, fantaVote: null, breakdown: [], engineVersion: rules.engineVersion,
  });

  if (SV_STATUSES.has(match.status)) return sv(statusReason(match.status));
  if (!appearance || !(appearance.minutesPlayed > 0)) return sv('non entrato');

  const mine = events.filter((e) => e.playerId === player.id);
  const minutes = appearance.minutesPlayed;
  if (minutes < rules.minMinutes && mine.length === 0) return sv(`meno di ${rules.minMinutes}' senza eventi`);

  const isHome = player.clubId === match.homeClubId;
  const ownGoals = isHome ? match.homeGoals : match.awayGoals;
  const oppGoals = isHome ? match.awayGoals : match.homeGoals;
  const suspendedLate = match.status === 'suspended_after_45';

  // 1. voto base + esito collettivo
  let base = rules.baseVote;
  lines.push({ label: 'Voto base', value: rules.baseVote });
  if (!suspendedLate) {
    const weight = minutes >= rules.fullMinutes ? 1 : rules.partialWeight;
    const res = ownGoals > oppGoals ? 'win' : ownGoals < oppGoals ? 'loss' : 'draw';
    const v = r1(rules.outcome[res] * weight);
    base = r1(base + v);
    lines.push({ label: 'Esito collettivo', value: v, note: `${{ win: 'vittoria', draw: 'pareggio', loss: 'sconfitta' }[res]} · ${minutes}'` });
  } else {
    lines.push({ label: 'Esito collettivo', value: 0, note: 'gara sospesa dopo il 45\'' });
  }

  // 2. bonus/malus
  let bonus = 0;
  const add = (label, value, note) => { if (value !== 0) { bonus = r1(bonus + value); lines.push({ label, value, note }); } };
  const count = (t) => mine.filter((e) => e.type === t).length;
  const role = player.role;

  const goals = count('goal');
  if (goals) add(`Gol × ${goals}`, rules.goal[role] * goals, roleName(role));
  const assists = count('assist');
  if (assists) add(`Assist × ${assists}`, rules.assist * assists);
  // Da palla inattiva vale meno: il merito e' minore e il referto lo distingue
  // senza doverlo giudicare. Il "quality assist" di Fantacalcio (soft/standard/
  // gold) invece e' un giudizio, e qui i giudizi non entrano (art. 1).
  const assistsFermo = count('assist_set');
  if (assistsFermo) add(`Assist da fermo × ${assistsFermo}`, rules.assistSetPiece * assistsFermo, 'palla inattiva');

  // porta inviolata: conta il risultato finale (art. 7.5), min 60' (art. 7.6)
  if (!suspendedLate && oppGoals === 0 && minutes >= rules.cleanSheetMinutes && rules.cleanSheet[role]) {
    add('Porta inviolata', rules.cleanSheet[role], `${roleName(role)} · ${minutes}'`);
  }

  // gol subiti dal portiere in campo al momento del gol (art. 7.6), autogol dei compagni inclusi
  if (role === 'P') {
    const [from, to] = onPitchInterval(appearance);
    const conceded = events.filter((e) =>
      ((e.type === 'goal' && e.clubId !== player.clubId) || (e.type === 'own_goal' && e.clubId === player.clubId)) &&
      e.minute >= from && e.minute <= to).length;
    if (conceded) add(`Gol subiti × ${conceded}`, rules.goalConcededGK * conceded);
  }

  if (rules.decisiveGoal && goals && !suspendedLate) {
    const dec = golDecisivo(events, player.clubId, oppGoals);
    if (dec && dec.playerId === player.id) add('Gol decisivo', rules.decisiveGoal, dec.nota);
  }

  const y = count('yellow'); if (y) add('Ammonizione', rules.yellow * y);
  const y2 = count('second_yellow'); if (y2) add('Espulsione per doppia ammonizione', rules.secondYellow * y2);
  const rd = count('red_direct'); if (rd) add('Espulsione per rosso diretto', rules.redDirect * rd);
  const og = count('own_goal'); if (og) add(`Autogol × ${og}`, rules.ownGoal * og);
  const pm = count('pen_missed'); if (pm) add(`Rigore sbagliato × ${pm}`, rules.penMissed * pm);
  const ps = count('pen_saved'); if (ps) add(`Rigore parato × ${ps}`, rules.penSaved * ps);
  if (rules.level2Events) {
    const pw = count('pen_won'); if (pw) add(`Rigore procurato × ${pw}`, rules.penWon * pw);
    const pc = count('pen_conceded'); if (pc) add(`Rigore causato × ${pc}`, rules.penConceded * pc);
  }

  return {
    playerId: player.id, matchId: match.id, isSV: false, svReason: null,
    baseVote: base, bonus, fantaVote: r1(base + bonus), breakdown: lines, engineVersion: rules.engineVersion,
  };
}

/**
 * Il gol che vale il pari o il sorpasso definitivo (art. 5.4).
 * Niente giudizio: contati in ordine di minuto i gol della squadra, quello che
 * porta il conto a pari degli avversari vale il pareggio, quello subito dopo
 * vale la vittoria. Su 2-1 e' decisivo il secondo gol e uno solo; su 1-1 il
 * primo; perdendo, nessuno. Gli autogol avversari fanno punteggio ma non danno
 * il bonus a nessuno: il gol non e' di un nostro giocatore.
 */
export function golDecisivo(events, clubId, oppGoals) {
  const nostri = events
    .filter((e) => (e.type === 'goal' && e.clubId === clubId) || (e.type === 'own_goal' && e.clubId !== clubId))
    .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));
  const iPari = oppGoals - 1;      // indice del gol che impatta
  const iSorpasso = oppGoals;      // indice del gol che porta avanti
  const scelto = nostri[iSorpasso] ? { e: nostri[iSorpasso], nota: oppGoals === 0 ? 'vantaggio' : 'sorpasso' }
    : nostri[iPari] ? { e: nostri[iPari], nota: 'pareggio' } : null;
  if (!scelto || scelto.e.type !== 'goal') return null;
  return { playerId: scelto.e.playerId, nota: scelto.nota };
}

function statusReason(s) {
  return { postponed: 'gara rinviata', suspended_before_45: 'gara sospesa prima del 45\'', awarded: 'gara a tavolino' }[s] || s;
}
export function roleName(r) {
  return { P: 'portiere', D: 'difensore', C: 'centrocampista', A: 'attaccante' }[r];
}

/** Conversione fantapunti → gol (art. 11). */
export function conversionParams(managerCount, rules = DEFAULT_RULES) {
  const row = rules.conversion.find((c) => managerCount >= c.min && managerCount <= c.max)
    || rules.conversion[rules.conversion.length - 1];
  return { threshold: row.threshold, step: row.step };
}
export function toGoals(score, managerCount, rules = DEFAULT_RULES) {
  const { threshold, step } = conversionParams(managerCount, rules);
  if (score < threshold) return 0;
  return Math.floor((score - threshold) / step) + 1;
}

export function parseModule(mod) {
  const [d, c, a] = mod.split('-').map(Number);
  return { P: 1, D: d, C: c, A: a };
}

/**
 * computeLineupResult — applica sostituzioni automatiche (art. 8.5-8.7) e capitano (art. 6).
 * lineup: { formation, starters: [playerId x11], bench: [playerId x7 ordinati], captainId, viceCaptainId }
 * ratings: Map playerId → PlayerRating (o undefined = S.V. non entrato)
 */
export function computeLineupResult({ lineup, ratings, players, managerCount, isHome = false, rules = DEFAULT_RULES }) {
  const get = (id) => ratings.get(id) || { isSV: true, svReason: 'non entrato', baseVote: null, bonus: 0, fantaVote: null, breakdown: [] };
  const roleOf = (id) => players.get(id).role;
  const used = new Set();
  let subs = 0;
  const rows = [];
  const subsApplied = [];

  // capitano effettivo (art. 6.3)
  let captainId = null; let captainNote = 'nessun capitano';
  if (lineup.captainId && !get(lineup.captainId).isSV) { captainId = lineup.captainId; captainNote = 'capitano'; }
  else if (lineup.viceCaptainId && !get(lineup.viceCaptainId).isSV) { captainId = lineup.viceCaptainId; captainNote = 'vice capitano (capitano S.V.)'; }
  else captainNote = 'nessun raddoppio: capitano e vice S.V.';

  for (const sid of lineup.starters) {
    const r = get(sid);
    if (!r.isSV) {
      rows.push(makeRow(sid, r, roleOf(sid), sid === captainId, rules));
      continue;
    }
    // sostituzione automatica: primo panchinaro dello stesso ruolo con voto
    let sub = null;
    if (subs < rules.maxSubs) {
      const libero = (bid) => !used.has(bid) && !get(bid).isSV;
      sub = lineup.bench.find((bid) => libero(bid) && roleOf(bid) === roleOf(sid)) || null;
      // a modulo libero, se nel ruolo non c'e' nessuno entra comunque il primo
      // panchinaro con voto: il modulo cambia, ma un titolare senza voto non
      // resta scoperto (art. 8.5, opzione di lega)
      if (!sub && rules.subMode === 'free') sub = lineup.bench.find(libero) || null;
    }
    if (sub) {
      used.add(sub); subs++;
      subsApplied.push({ out: sid, in: sub, benchIndex: lineup.bench.indexOf(sub) + 1 });
      rows.push({ ...makeRow(sub, get(sub), roleOf(sub), false, rules), subFor: sid });
    } else {
      rows.push({ playerId: sid, role: roleOf(sid), isSV: true, svReason: r.svReason, official: true,
        baseVote: rules.noSubVote, bonus: 0, fantaVote: rules.noSubVote, isCaptain: false, breakdown: [{ label: 'Voto d\'ufficio (art. 8.6)', value: rules.noSubVote }] });
    }
  }
  const somma = r1(rows.reduce((s, x) => s + x.fantaVote, 0));
  const baseTotal = r1(rows.reduce((s, x) => s + x.baseVote, 0));
  const casa = isHome ? rules.homeBonus : 0;
  const total = r1(somma + casa);
  return { total, sommaRose: somma, homeBonus: casa, baseTotal, goals: toGoals(total, managerCount, rules), rows, subsApplied, captainId, captainNote, conversion: conversionParams(managerCount, rules) };
}

function makeRow(id, r, role, isCaptain, rules) {
  const mult = isCaptain ? rules.captainMultiplier : 1;
  const bonus = r1(r.bonus * mult);
  return { playerId: id, role, isSV: false, baseVote: r.baseVote, bonus, fantaVote: r1(r.baseVote + bonus), isCaptain, breakdown: r.breakdown, subFor: null, official: false };
}

/** Classifica (art. 12). results: [{homeManagerId, awayManagerId, homeGoals, awayGoals, homeScore, awayScore}] */
/**
 * Di quante posizioni si e' mossa ogni squadra fra due classifiche.
 *
 * @param {Array} prima  classifica prima della giornata
 * @param {Array} dopo   classifica adesso
 * @returns {Map<string, number|null>} positivo = e' salita, negativo = scesa,
 *   0 = ferma, null = non c'e' un "prima" con cui confrontarla (prima
 *   giornata, o squadra entrata dopo).
 */
export function movimenti(prima, dopo) {
  const p = new Map(prima.map((r) => [r.managerId, r]));
  const out = new Map();
  for (const r of dopo) {
    const v = p.get(r.managerId);
    // Senza partite giocate prima, tutte le posizioni valgono uguale: la
    // classifica "prima" e' un ordine arbitrario e confrontarsi con quella
    // darebbe frecce senza significato.
    out.set(r.managerId, !v || !v.played ? null : v.position - r.position);
  }
  return out;
}

export function computeStandings(managers, results, rules = DEFAULT_RULES) {
  const t = new Map(managers.map((m) => [m.id, { managerId: m.id, points: 0, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, gs: 0, fantapunti: 0 }]));
  for (const f of results) {
    const h = t.get(f.homeManagerId), a = t.get(f.awayManagerId);
    if (!h || !a) continue;
    h.played++; a.played++;
    h.gf += f.homeGoals; h.gs += f.awayGoals; a.gf += f.awayGoals; a.gs += f.homeGoals;
    h.fantapunti = r1(h.fantapunti + f.homeScore); a.fantapunti = r1(a.fantapunti + f.awayScore);
    if (f.homeGoals > f.awayGoals) { h.won++; a.lost++; h.points += rules.points.win; }
    else if (f.homeGoals < f.awayGoals) { a.won++; h.lost++; a.points += rules.points.win; }
    else { h.drawn++; a.drawn++; h.points += rules.points.draw; a.points += rules.points.draw; }
  }
  const rows = [...t.values()].map((x) => ({ ...x, dr: x.gf - x.gs }));
  const h2h = (x, y) => {
    let px = 0, py = 0;
    for (const f of results) {
      const pair = (f.homeManagerId === x.managerId && f.awayManagerId === y.managerId) || (f.homeManagerId === y.managerId && f.awayManagerId === x.managerId);
      if (!pair) continue;
      const xg = f.homeManagerId === x.managerId ? f.homeGoals : f.awayGoals;
      const yg = f.homeManagerId === x.managerId ? f.awayGoals : f.homeGoals;
      if (xg > yg) px += 3; else if (xg < yg) py += 3; else { px++; py++; }
    }
    return py - px;
  };
  rows.sort((x, y) => y.points - x.points || y.fantapunti - x.fantapunti || y.dr - x.dr || h2h(x, y));
  return rows.map((x, i) => ({ ...x, position: i + 1 }));
}

/** Validazione formazione (art. 8). */
export function validateLineup(lineup, players, rules = DEFAULT_RULES) {
  const errors = [];
  if (!rules.modules.includes(lineup.formation)) errors.push('Modulo non ammesso');
  const need = parseModule(lineup.formation);
  const starters = lineup.starters.filter(Boolean);
  if (starters.length !== 11) errors.push(`Titolari: ${starters.length}/11`);
  const have = { P: 0, D: 0, C: 0, A: 0 };
  for (const id of starters) have[players.get(id).role]++;
  for (const r of ['P', 'D', 'C', 'A']) if (have[r] !== need[r]) errors.push(`${roleName(r)}: ${have[r]}/${need[r]}`);
  if (new Set([...starters, ...lineup.bench.filter(Boolean)]).size !== starters.length + lineup.bench.filter(Boolean).length) errors.push('Giocatore duplicato');
  if (lineup.captainId && !starters.includes(lineup.captainId)) errors.push('Il capitano deve essere titolare');
  if (lineup.viceCaptainId && !starters.includes(lineup.viceCaptainId)) errors.push('Il vice deve essere titolare');
  if (lineup.captainId && lineup.captainId === lineup.viceCaptainId) errors.push('Capitano e vice devono essere diversi');
  return errors;
}

/** Formazione d'ufficio (art. 8.4): 4-4-2 con i giocatori di quotazione più alta per ruolo. */
/**
 * Puo' comprare? (art. 2-3). Restituisce l'elenco dei perche' no, vuoto se si'.
 *
 * La regola che fa la differenza fra un'asta giocabile e una rotta e' l'ultima:
 * non basta avere i crediti per QUESTO giocatore, bisogna restarne con almeno
 * uno per ogni casella ancora vuota. Senza, si arriva a fine asta con la rosa
 * incompleta e non c'e' modo di rimediare.
 */
export function validaAcquisto({ rosa, crediti, player, prezzo, giaPreso = false, rules = DEFAULT_RULES }) {
  const err = [];
  if (!player) return ['Giocatore sconosciuto'];
  if (!Number.isInteger(prezzo) || prezzo < 1) err.push('Il prezzo è almeno 1 credito, intero');
  if (giaPreso) err.push('Già in un\'altra rosa');
  if (player.isActive === false) err.push('Fuori dal campionato');

  const perRuolo = { P: 0, D: 0, C: 0, A: 0 };
  for (const r of rosa) if (r.player) perRuolo[r.player.role]++;
  const serve = rules.roster;
  if (perRuolo[player.role] >= serve[player.role]) {
    err.push(`${roleName(player.role)}: già ${perRuolo[player.role]}/${serve[player.role]}`);
  }
  if (rosa.some((r) => r.playerId === player.id)) err.push('Già in questa rosa');

  if (rules.maxPerClub) {
    const dallaSocieta = rosa.filter((r) => r.player && r.player.clubId === player.clubId).length;
    if (dallaSocieta >= rules.maxPerClub) err.push(`Già ${dallaSocieta} da ${player.clubId}: il tetto è ${rules.maxPerClub}`);
  }

  if (Number.isInteger(prezzo) && prezzo >= 1) {
    if (prezzo > crediti) err.push(`Crediti: ne servono ${prezzo}, ce ne sono ${crediti}`);
    else {
      // caselle ancora vuote DOPO questo acquisto
      const vuote = ['P', 'D', 'C', 'A'].reduce((n, r) => n + Math.max(0, serve[r] - perRuolo[r]), 0) - 1;
      const restano = crediti - prezzo;
      if (vuote > 0 && restano < vuote) {
        err.push(`Restano ${restano} crediti per ${vuote} caselle: servono almeno ${vuote}`);
      }
    }
  }
  return err;
}

/** Quanto puoi offrire al massimo tenendoti un credito per ogni casella vuota. */
export function offertaMassima({ rosa, crediti, role, rules = DEFAULT_RULES }) {
  const perRuolo = { P: 0, D: 0, C: 0, A: 0 };
  for (const r of rosa) if (r.player) perRuolo[r.player.role]++;
  if (role && perRuolo[role] >= rules.roster[role]) return 0;
  const vuoteDopo = ['P', 'D', 'C', 'A'].reduce((n, r) => n + Math.max(0, rules.roster[r] - perRuolo[r]), 0) - 1;
  return Math.max(0, crediti - Math.max(0, vuoteDopo));
}

export function defaultLineup(rosterIds, players, formation = '4-4-2') {
  const need = parseModule(formation);
  const byRole = { P: [], D: [], C: [], A: [] };
  for (const id of rosterIds) byRole[players.get(id).role].push(id);
  for (const r in byRole) byRole[r].sort((a, b) => players.get(b).quotation - players.get(a).quotation);
  const starters = [], bench = [];
  for (const r of ['P', 'D', 'C', 'A']) { starters.push(...byRole[r].slice(0, need[r])); bench.push(...byRole[r].slice(need[r])); }
  const benchOrdered = [bench.find((id) => players.get(id).role === 'P'), ...bench.filter((id) => players.get(id).role !== 'P')].filter(Boolean).slice(0, 7);
  return { formation, starters, bench: benchOrdered, captainId: starters[0] ? bestBy(starters, players) : null, viceCaptainId: null };
}
function bestBy(ids, players) { return [...ids].sort((a, b) => players.get(b).quotation - players.get(a).quotation)[0]; }
