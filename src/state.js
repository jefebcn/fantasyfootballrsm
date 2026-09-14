/**
 * Stato applicativo: dati generati + delta persistiti in localStorage.
 * Tutto ciò che il motore calcola è derivato: ricalcolabile da zero.
 */
import { buildSeason } from './data.js';
import { computeRating, computeLineupResult, computeStandings, defaultLineup, DEFAULT_RULES } from './engine.js';

const KEY = 'fcs:v1';
const EMPTY = {
  userManagerId: 'm_lillo', role: 'giudice', // 'fantallenatore' | 'admin' | 'giudice'
  lineups: {}, matchEvents: {}, matchOverrides: {}, appearanceOverrides: {},
  matchdayStatus: {}, contestazioni: [], changeLog: [], theme: 'system', installedDismissed: false,
};

export const base = buildSeason();
export const playersById = new Map(base.players.map((p) => [p.id, p]));
export const clubsById = new Map(base.clubs.map((c) => [c.id, c]));
export const managersById = new Map(base.managers.map((m) => [m.id, m]));

let delta = load();
function load() {
  try { const raw = localStorage.getItem(KEY); return raw ? { ...EMPTY, ...JSON.parse(raw) } : { ...EMPTY }; }
  catch { return { ...EMPTY }; }
}
export function save() { try { localStorage.setItem(KEY, JSON.stringify(delta)); } catch { /* quota o privato */ } }
export function resetAll() { delta = { ...EMPTY }; save(); }
export const store = { get: () => delta, set: (patch) => { delta = { ...delta, ...patch }; save(); notify(); } };

const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function notify() { cache.clear(); listeners.forEach((fn) => fn()); }
const cache = new Map();
const memo = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };

export const rules = () => base.league.rules;
export const now = () => new Date();

// ---------------------------------------------------------------- giornate
export function matchday(n) { return base.matchdays.find((m) => m.number === n); }
export function matchesOf(n) {
  return base.matches.filter((m) => m.matchday === n).map((m) => ({ ...m, ...(delta.matchOverrides[m.id] || {}) }));
}
export function match(id) { const m = base.matches.find((x) => x.id === id); return m ? { ...m, ...(delta.matchOverrides[id] || {}) } : null; }
export function eventsOf(matchId) { return delta.matchEvents[matchId] || base.events.filter((e) => e.matchId === matchId); }
export function appearancesOf(matchId) { return delta.appearanceOverrides[matchId] || base.appearances.filter((a) => a.matchId === matchId); }

/** Stato del dato: 'frozen' | 'provisional' | 'live' | 'open' | 'scheduled' */
export function matchdayStatus(n) {
  if (delta.matchdayStatus[n]) return delta.matchdayStatus[n];
  const md = matchday(n); const t = now();
  const played = base.season.playedMatchdays;
  if (n < played) return 'frozen';
  if (n === played) return 'provisional';
  if (t >= new Date(md.lockAt)) return 'live';
  return n === played + 1 ? 'open' : 'scheduled';
}
export function currentMatchday() { return base.season.playedMatchdays; }
export function nextMatchday() { return Math.min(30, base.season.playedMatchdays + 1); }
export function isFrozen(n) { return matchdayStatus(n) === 'frozen'; }

/** Fase del ciclo settimanale per la dashboard. */
export function weekPhase() {
  const n = currentMatchday(); const st = matchdayStatus(n);
  const nxt = matchday(nextMatchday());
  return { matchday: n, status: st, next: nextMatchday(), lockAt: nxt ? new Date(nxt.lockAt) : null };
}

// ---------------------------------------------------------------- voti
export function ratingsOf(n) {
  return memo(`ratings:${n}`, () => {
    const map = new Map();
    for (const m of matchesOf(n)) {
      const evs = eventsOf(m.id);
      for (const a of appearancesOf(m.id)) {
        const player = playersById.get(a.playerId); if (!player) continue;
        map.set(a.playerId, { ...computeRating({ player, appearance: a, events: evs, match: m, rules: rules() }), minutes: a.minutesPlayed, matchId: m.id });
      }
      // convocati non entrati / squadre con gara S.V.: restano assenti dalla mappa → S.V.
    }
    return map;
  });
}

// ---------------------------------------------------------------- formazioni
export function rosterIds(managerId) { return base.rosters[managerId].map((r) => r.playerId); }
export function rosterOf(managerId) {
  return base.rosters[managerId].map((r) => ({ ...r, player: playersById.get(r.playerId), club: clubsById.get(playersById.get(r.playerId).clubId) }));
}
export function savedLineup(n, managerId) { return delta.lineups[`${n}:${managerId}`] || null; }
export function lineupFor(n, managerId) {
  const saved = savedLineup(n, managerId);
  if (saved) return { ...saved, source: 'saved' };
  for (let k = n - 1; k >= 1; k--) { const prev = delta.lineups[`${k}:${managerId}`]; if (prev) return { ...prev, source: `giornata ${k}` }; }
  return { ...defaultLineup(rosterIds(managerId).filter((id) => playersById.get(id).isActive), playersById), source: 'ufficio' };
}
export function saveLineup(n, managerId, lineup) {
  delta.lineups[`${n}:${managerId}`] = { ...lineup, submittedAt: now().toISOString() };
  save(); notify();
}

export function lineupResult(n, managerId) {
  return memo(`lr:${n}:${managerId}`, () => {
    const lineup = lineupFor(n, managerId);
    return { lineup, ...computeLineupResult({ lineup, ratings: ratingsOf(n), players: playersById, managerCount: base.league.managerCount, rules: rules() }) };
  });
}
export function fixturesOf(n) { return base.fixtures.filter((f) => f.matchday === n); }
export function fixture(id) { return base.fixtures.find((f) => f.id === id); }
export function fixtureResult(f) {
  const st = matchdayStatus(f.matchday);
  if (st === 'open' || st === 'scheduled') return { ...f, played: false };
  const h = lineupResult(f.matchday, f.homeManagerId), a = lineupResult(f.matchday, f.awayManagerId);
  return { ...f, played: true, homeGoals: h.goals, awayGoals: a.goals, homeScore: h.total, awayScore: a.total, home: h, away: a, status: st };
}
export function resultsUntil(n) {
  const out = [];
  for (let k = 1; k <= n; k++) for (const f of fixturesOf(k)) { const r = fixtureResult(f); if (r.played) out.push(r); }
  return out;
}
export function standings() { return memo('standings', () => computeStandings(base.managers, resultsUntil(currentMatchday()), rules())); }
export function myFixture(n, managerId) { return fixturesOf(n).find((f) => f.homeManagerId === managerId || f.awayManagerId === managerId) || null; }

// ---------------------------------------------------------------- admin
function log(entry) { delta.changeLog.unshift({ at: now().toISOString(), by: delta.userManagerId, ...entry }); if (delta.changeLog.length > 500) delta.changeLog.pop(); }
export function setMatch(matchId, patch) {
  const m = match(matchId); if (isFrozen(m.matchday)) throw new Error(`Giornata ${m.matchday} congelata (art. 9.2)`);
  delta.matchOverrides[matchId] = { ...(delta.matchOverrides[matchId] || {}), ...patch };
  log({ matchId, what: 'match', patch }); save(); notify();
}
export function setAppearances(matchId, list) {
  const m = match(matchId); if (isFrozen(m.matchday)) throw new Error(`Giornata ${m.matchday} congelata (art. 9.2)`);
  delta.appearanceOverrides[matchId] = list; log({ matchId, what: 'appearances', count: list.length }); save(); notify();
}
export function addEvent(matchId, ev) {
  const m = match(matchId); if (isFrozen(m.matchday)) throw new Error(`Giornata ${m.matchday} congelata (art. 9.2)`);
  const list = [...eventsOf(matchId), { id: `u${Date.now()}`, matchId, ...ev }].sort((a, b) => a.minute - b.minute);
  delta.matchEvents[matchId] = list; log({ matchId, what: 'event+', ev }); save(); notify();
}
export function removeEvent(matchId, eventId) {
  const m = match(matchId); if (isFrozen(m.matchday)) throw new Error(`Giornata ${m.matchday} congelata (art. 9.2)`);
  const ev = eventsOf(matchId).find((e) => e.id === eventId);
  delta.matchEvents[matchId] = eventsOf(matchId).filter((e) => e.id !== eventId); log({ matchId, what: 'event-', ev }); save(); notify();
}
export function freezeMatchday(n) { delta.matchdayStatus[n] = 'frozen'; log({ what: 'freeze', matchday: n }); save(); notify(); }
export function reopenMatchday(n) { delete delta.matchdayStatus[n]; log({ what: 'reopen', matchday: n }); save(); notify(); }
export function addContestazione(c) { delta.contestazioni.unshift({ id: `c${Date.now()}`, at: now().toISOString(), by: delta.userManagerId, status: 'open', ...c }); save(); notify(); }
export function resolveContestazione(id, status, note) {
  delta.contestazioni = delta.contestazioni.map((c) => (c.id === id ? { ...c, status, note, resolvedAt: now().toISOString() } : c)); log({ what: 'contestazione', id, status }); save(); notify();
}
export function changeLog() { return delta.changeLog; }
export function contestazioni() { return delta.contestazioni; }
export const me = () => managersById.get(delta.userManagerId);
