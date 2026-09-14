/**
 * Stato applicativo. Due modalità con la stessa API per le viste:
 *  - locale: dati generati + delta in localStorage (demo, nessuna rete)
 *  - remota: account e leghe su Supabase; il dato del campionato è globale, le leghe sono per membri
 * Tutto ciò che il motore calcola è derivato e ricalcolabile da zero.
 */
import { buildSeason, draftRosters, mulberry32 } from './data.js';
import { computeRating, computeLineupResult, computeStandings, defaultLineup, DEFAULT_RULES } from './engine.js';
import * as remote from './backend.js';

const LOCAL_KEY = 'fcs:v1'; const PREFS_KEY = 'fcs:prefs';
export const base = buildSeason();
const LOCAL = { managers: base.managers, rosters: base.rosters, league: base.league, playedMatchdays: base.season.playedMatchdays };
export const playersById = new Map(base.players.map((p) => [p.id, p]));
export const clubsById = new Map(base.clubs.map((c) => [c.id, c]));
export const managersById = new Map();

let mode = 'local';
let user = null, prof = null, leagues = [];
let g = emptyGlobal(); let L = emptyLeague();
let prefs = load(PREFS_KEY, { theme: 'system', installedDismissed: false, currentLeagueId: null, localDemo: false, userManagerId: 'm_lillo', role: 'giudice' });
let onError = (e) => console.error(e);
export function setErrorHandler(fn) { onError = fn; }

function emptyGlobal() { return { matchEvents: {}, matchOverrides: {}, appearanceOverrides: {}, matchdayStatus: {}, changeLog: [] }; }
function emptyLeague() { return { lineups: {}, contestazioni: [] }; }
function load(key, def) { try { const raw = localStorage.getItem(key); return raw ? { ...def, ...JSON.parse(raw) } : { ...def }; } catch { return { ...def }; } }
function persistPrefs() { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* quota */ } }
function persistLocal() { if (mode !== 'local') return; try { localStorage.setItem(LOCAL_KEY, JSON.stringify({ ...g, ...L })); } catch { /* quota */ } }
function refreshManagers() { managersById.clear(); for (const m of base.managers) managersById.set(m.id, m); }

const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
const cache = new Map();
function notify() { cache.clear(); listeners.forEach((fn) => fn()); }
const memo = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };

// ---------------------------------------------------------------- avvio
export async function init() {
  if (remote.isConfigured() && !prefs.localDemo) {
    try {
      user = await remote.init();
      mode = 'remote';
      remote.onAuth(async (u) => { const was = user?.id; user = u; if (u?.id !== was) { await loadRemote(); notify(); } });
      await loadRemote();
      return;
    } catch (e) { onError(e); mode = 'local'; }
  }
  loadLocal();
}
function loadLocal() {
  mode = 'local';
  const d = load(LOCAL_KEY, { ...emptyGlobal(), ...emptyLeague() });
  g = { matchEvents: d.matchEvents, matchOverrides: d.matchOverrides, appearanceOverrides: d.appearanceOverrides, matchdayStatus: d.matchdayStatus, changeLog: d.changeLog };
  L = { lineups: d.lineups, contestazioni: d.contestazioni };
  base.managers = LOCAL.managers; base.rosters = LOCAL.rosters; base.league = { ...LOCAL.league, managerCount: LOCAL.managers.length };
  refreshManagers();
}
async function loadRemote() {
  if (!user) { prof = null; leagues = []; g = emptyGlobal(); L = emptyLeague(); base.managers = []; base.rosters = {}; base.league = { id: null, name: 'Fantacampionato', shortName: 'Fantacampionato', rules: { ...DEFAULT_RULES }, managerCount: 0 }; refreshManagers(); return; }
  prof = (await remote.profile(user.id)) || { id: user.id, display_name: user.email, is_judge: false };
  leagues = await remote.myLeagues(user.id);
  if (!leagues.some((l) => l.id === prefs.currentLeagueId)) { prefs.currentLeagueId = leagues[0]?.id || null; persistPrefs(); }
  g = await remote.loadGlobal(prof.is_judge);
  if (prefs.currentLeagueId) {
    const data = await remote.loadLeague(prefs.currentLeagueId);
    base.managers = data.managers; base.rosters = data.rosters;
    base.league = { ...data.league, rules: { ...DEFAULT_RULES, ...data.league.rulesOverride }, managerCount: data.managers.length };
    L = { lineups: data.lineups, contestazioni: data.contestazioni };
  } else { base.managers = []; base.rosters = {}; base.league = { id: null, name: 'Fantacampionato', shortName: 'Fantacampionato', rules: { ...DEFAULT_RULES }, managerCount: 0 }; L = emptyLeague(); }
  if (prof.is_judge) { try { L.contestazioni = await remote.allContestazioni(); } catch (e) { onError(e); } }
  refreshManagers();
  remote.subscribe(prefs.currentLeagueId, debounceRefresh);
}
let refreshTimer = null;
function debounceRefresh() { clearTimeout(refreshTimer); refreshTimer = setTimeout(() => refresh(), 400); }
export async function refresh() { if (mode !== 'remote') return; try { await loadRemote(); } catch (e) { onError(e); } notify(); }

// ---------------------------------------------------------------- sessione / leghe
export const isRemote = () => mode === 'remote';
export const currentUser = () => user;
export const profileInfo = () => prof;
export const myLeagues = () => leagues;
export const currentLeagueId = () => (mode === 'remote' ? prefs.currentLeagueId : 'local');
export const hasLeague = () => mode === 'local' || !!prefs.currentLeagueId;
export const isJudge = () => (mode === 'remote' ? !!prof?.is_judge : prefs.role === 'giudice');
export const isLeagueAdmin = () => (mode === 'remote' ? me()?.role === 'admin' || isJudge() : prefs.role !== 'fantallenatore');
export const canJudge = () => isJudge();
export async function signIn(email) { await remote.signIn(email, location.origin + location.pathname); }
export async function verifyCode(email, token) { await remote.verifyOtp(email, token); user = (await remote.client().auth.getUser()).data.user; await loadRemote(); notify(); }
export async function signOut() { await remote.signOut(); user = null; await loadRemote(); notify(); }
export function useLocalDemo() { prefs.localDemo = true; persistPrefs(); loadLocal(); notify(); }
export function useRemote() { prefs.localDemo = false; persistPrefs(); location.reload(); }
export function setSupabaseConfig(url, key) { remote.setConfig(url, key); prefs.localDemo = false; persistPrefs(); location.reload(); }
export const supabaseConfigured = () => remote.isConfigured();
export async function switchLeague(id) { prefs.currentLeagueId = id; persistPrefs(); await loadRemote(); notify(); }
export async function createLeague(name, team, color, initials) { const id = await remote.createLeague(name, name.length > 14 ? name.split(' ').slice(0, 2).join(' ') : name, team, color, initials); await switchLeague(id); }
export async function joinLeague(code, team, color, initials) { const id = await remote.joinLeague(code, team, color, initials); await switchLeague(id); }
export async function setMemberRole(memberId, role) { await remote.updateMember(memberId, { role }); await refresh(); }
export async function removeMember(memberId) { await remote.removeMember(memberId); await refresh(); }
export async function draftRostersRemote() {
  const ids = base.managers.map((m) => m.id);
  const rosters = draftRosters(ids, base.players, mulberry32(hashStr(base.league.id)));
  const rows = []; for (const mid of ids) for (const r of rosters[mid]) rows.push({ memberId: mid, ...r });
  await remote.replaceRosters(base.league.id, rows);
  for (const m of base.managers) await remote.updateMember(m.id, { credits: DEFAULT_RULES.budget - rosters[m.id].reduce((s, r) => s + r.pricePaid, 0) });
  await refresh();
}
export { draftRostersRemote as draftRosters };
export async function addRosterPlayer(memberId, playerId, price) { await remote.addRosterPlayer(base.league.id, memberId, playerId, price); const m = managersById.get(memberId); await remote.updateMember(memberId, { credits: m.credits - price }); await refresh(); }
export async function removeRosterPlayer(memberId, playerId) { const r = (base.rosters[memberId] || []).find((x) => x.playerId === playerId); await remote.removeRosterPlayer(base.league.id, playerId); if (r) await remote.updateMember(memberId, { credits: managersById.get(memberId).credits + r.pricePaid }); await refresh(); }
export async function seedDemo() { await remote.seedDemo(base, user.id); await refresh(); }
function hashStr(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

/** Preferenze e identità locale (vista impostazioni). */
export const store = {
  get: () => ({ theme: prefs.theme, installedDismissed: prefs.installedDismissed, role: mode === 'remote' ? (isJudge() ? 'giudice' : me()?.role === 'admin' ? 'admin' : 'fantallenatore') : prefs.role, userManagerId: me()?.id }),
  set: (patch) => { if ('theme' in patch) prefs.theme = patch.theme; if ('installedDismissed' in patch) prefs.installedDismissed = patch.installedDismissed; if (mode === 'local') { if ('userManagerId' in patch) prefs.userManagerId = patch.userManagerId; if ('role' in patch) prefs.role = patch.role; } persistPrefs(); notify(); },
};
export function resetAll() { localStorage.removeItem(LOCAL_KEY); localStorage.removeItem(PREFS_KEY); }
export const me = () => (mode === 'remote' ? base.managers.find((m) => m.userId === user?.id) || null : managersById.get(prefs.userManagerId) || base.managers[0]);
export const rules = () => base.league.rules;
export const now = () => new Date();

// ---------------------------------------------------------------- giornate
export function matchday(n) { return base.matchdays.find((m) => m.number === n); }
export function matchesOf(n) { return base.matches.filter((m) => m.matchday === n).map((m) => ({ ...m, ...(mode === 'remote' ? { status: 'scheduled', homeGoals: null, awayGoals: null, videoUrl: null } : {}), ...(g.matchOverrides[m.id] || {}) })); }
export function match(id) { const m = base.matches.find((x) => x.id === id); return m ? { ...m, ...(mode === 'remote' ? { status: 'scheduled', homeGoals: null, awayGoals: null, videoUrl: null } : {}), ...(g.matchOverrides[id] || {}) } : null; }
export function eventsOf(matchId) { return g.matchEvents[matchId] || (mode === 'local' ? base.events.filter((e) => e.matchId === matchId) : []); }
export function appearancesOf(matchId) { return g.appearanceOverrides[matchId] || (mode === 'local' ? base.appearances.filter((a) => a.matchId === matchId) : []); }

/** Ultima giornata con dati (locale: dal generatore; remota: dal dato inserito). */
export function currentMatchday() {
  return memo('current', () => {
    if (mode === 'local') return Math.max(LOCAL.playedMatchdays, ...Object.keys(g.matchdayStatus).map(Number));
    let n = 0;
    for (const id in g.matchOverrides) { const k = +((id.match(/^md(\d+)/) || [])[1]); if (k > n) n = k; }
    for (const k in g.matchdayStatus) if (+k > n) n = +k;
    return Math.max(1, n);
  });
}
export function nextMatchday() { const st = matchdayStatus(currentMatchday()); return Math.min(30, currentMatchday() + (st === 'open' || st === 'scheduled' ? 0 : 1)); }
/** 'frozen' | 'provisional' | 'live' | 'open' | 'scheduled' */
export function matchdayStatus(n) {
  if (g.matchdayStatus[n]) return g.matchdayStatus[n];
  const md = matchday(n); const t = now(); const cur = currentMatchday();
  const hasData = mode === 'local' ? n <= LOCAL.playedMatchdays : matchesOf(n).some((m) => m.status !== 'scheduled');
  if (hasData) return n < cur ? 'provisional' : 'provisional';
  if (t >= new Date(md.lockAt)) return 'live';
  return n === cur + (hasAnyData(cur) ? 1 : 0) ? 'open' : 'scheduled';
}
function hasAnyData(n) { return mode === 'local' ? n <= LOCAL.playedMatchdays : !!g.matchdayStatus[n] || matchesOf(n).some((m) => m.status !== 'scheduled'); }
export function isFrozen(n) { return matchdayStatus(n) === 'frozen'; }
export function weekPhase() { const n = currentMatchday(); const nxt = matchday(nextMatchday()); return { matchday: n, status: matchdayStatus(n), next: nextMatchday(), lockAt: nxt ? new Date(nxt.lockAt) : null }; }

// ---------------------------------------------------------------- voti
export function ratingsOf(n) {
  return memo(`ratings:${n}`, () => {
    const map = new Map();
    for (const m of matchesOf(n)) { const evs = eventsOf(m.id); for (const a of appearancesOf(m.id)) { const player = playersById.get(a.playerId); if (!player) continue; map.set(a.playerId, { ...computeRating({ player, appearance: a, events: evs, match: m, rules: rules() }), minutes: a.minutesPlayed, matchId: m.id }); } }
    return map;
  });
}

// ---------------------------------------------------------------- formazioni
export function rosterIds(managerId) { return (base.rosters[managerId] || []).map((r) => r.playerId); }
export function rosterOf(managerId) { return (base.rosters[managerId] || []).map((r) => ({ ...r, player: playersById.get(r.playerId), club: clubsById.get(playersById.get(r.playerId).clubId) })); }
export function savedLineup(n, managerId) { return L.lineups[`${n}:${managerId}`] || null; }
export function lineupFor(n, managerId) {
  const saved = savedLineup(n, managerId); if (saved) return { ...saved, source: 'saved' };
  for (let k = n - 1; k >= 1; k--) { const prev = L.lineups[`${k}:${managerId}`]; if (prev) return { ...prev, source: `giornata ${k}` }; }
  return { ...defaultLineup(rosterIds(managerId).filter((id) => playersById.get(id).isActive), playersById), source: 'ufficio' };
}
export function saveLineup(n, managerId, lineup) {
  const rec = { ...lineup, submittedAt: now().toISOString() }; L.lineups[`${n}:${managerId}`] = rec; persistLocal(); notify();
  if (mode === 'remote') return remote.upsertLineup(base.league.id, managerId, n, rec).catch((e) => { onError(e); refresh(); });
}
export function lineupResult(n, managerId) { return memo(`lr:${n}:${managerId}`, () => { const lineup = lineupFor(n, managerId); return { lineup, ...computeLineupResult({ lineup, ratings: ratingsOf(n), players: playersById, managerCount: Math.max(6, base.league.managerCount), rules: rules() }) }; }); }
export function fixturesOf(n) { return memo(`fx:${n}`, () => fantaFixtures(n)); }
function fantaFixtures(n) {
  if (mode === 'local') return base.fixtures.filter((f) => f.matchday === n);
  const ids = base.managers.map((m) => m.id); if (ids.length < 2) return [];
  const list = ids.length % 2 ? [...ids, null] : [...ids]; const rounds = [];
  for (let r = 0; r < list.length - 1; r++) { const pairs = []; for (let i = 0; i < list.length / 2; i++) { const a = list[i], b = list[list.length - 1 - i]; if (a && b) pairs.push(r % 2 === 0 ? [a, b] : [b, a]); } rounds.push(pairs); list.splice(1, 0, list.pop()); }
  const cycle = Math.floor((n - 1) / rounds.length);
  return rounds[(n - 1) % rounds.length].map(([a, b], i) => { const [h, w] = cycle % 2 === 1 ? [b, a] : [a, b]; return { id: `f${n}_${i + 1}`, matchday: n, homeManagerId: h, awayManagerId: w }; });
}
export function fixture(id) { const n = +((id.match(/^f(\d+)_/) || [])[1]); return fixturesOf(n).find((f) => f.id === id); }
export function fixtureResult(f) {
  const st = matchdayStatus(f.matchday); if (st === 'open' || st === 'scheduled') return { ...f, played: false };
  const h = lineupResult(f.matchday, f.homeManagerId), a = lineupResult(f.matchday, f.awayManagerId);
  return { ...f, played: true, homeGoals: h.goals, awayGoals: a.goals, homeScore: h.total, awayScore: a.total, home: h, away: a, status: st };
}
export function resultsUntil(n) { const out = []; for (let k = 1; k <= n; k++) for (const f of fixturesOf(k)) { const r = fixtureResult(f); if (r.played) out.push(r); } return out; }
export function standings() { return memo('standings', () => computeStandings(base.managers, resultsUntil(currentMatchday()), rules())); }
export function myFixture(n, managerId) { return fixturesOf(n).find((f) => f.homeManagerId === managerId || f.awayManagerId === managerId) || null; }

// ---------------------------------------------------------------- Giudice Dati
function log(entry) { if (mode !== 'local') return; g.changeLog.unshift({ at: now().toISOString(), by: me()?.id, ...entry }); if (g.changeLog.length > 500) g.changeLog.pop(); }
const assertOpen = (matchId) => { const m = match(matchId); if (isFrozen(m.matchday)) throw new Error(`Giornata ${m.matchday} congelata (art. 9.2)`); return m; };
const remoteWrite = (fn) => (mode === 'remote' ? fn().catch((e) => { onError(e); refresh(); }) : undefined);
export function setMatch(matchId, patch) {
  assertOpen(matchId); g.matchOverrides[matchId] = { ...(g.matchOverrides[matchId] || {}), ...patch }; log({ matchId, what: 'match', patch }); persistLocal(); notify();
  return remoteWrite(() => remote.upsertMatch(matchId, { ...(g.matchOverrides[matchId]), ...patch }, user.id));
}
export function setAppearances(matchId, list) { assertOpen(matchId); g.appearanceOverrides[matchId] = list; log({ matchId, what: 'appearances', count: list.length }); persistLocal(); notify(); return remoteWrite(() => remote.replaceAppearances(matchId, list)); }
export function addEvent(matchId, ev) {
  assertOpen(matchId); const tmp = { id: `u${Date.now()}`, matchId, ...ev }; g.matchEvents[matchId] = [...eventsOf(matchId), tmp].sort((a, b) => a.minute - b.minute); log({ matchId, what: 'event+', ev }); persistLocal(); notify();
  return remoteWrite(async () => { const row = await remote.insertEvent(matchId, ev, user.id); g.matchEvents[matchId] = g.matchEvents[matchId].map((e) => (e.id === tmp.id ? { ...e, id: row.id } : e)); });
}
export function removeEvent(matchId, eventId) { assertOpen(matchId); const ev = eventsOf(matchId).find((e) => e.id === eventId); g.matchEvents[matchId] = eventsOf(matchId).filter((e) => e.id !== eventId); log({ matchId, what: 'event-', ev }); persistLocal(); notify(); return remoteWrite(() => remote.deleteEvent(eventId)); }
export function freezeMatchday(n) { g.matchdayStatus[n] = 'frozen'; log({ what: 'freeze', matchday: n }); persistLocal(); notify(); return remoteWrite(() => remote.setMatchdayStatus(n, 'frozen', user.id)); }
export function reopenMatchday(n) { delete g.matchdayStatus[n]; log({ what: 'reopen', matchday: n }); persistLocal(); notify(); return remoteWrite(() => remote.setMatchdayStatus(n, null, user.id)); }
export function addContestazione(c) {
  const rec = { id: `c${Date.now()}`, at: now().toISOString(), by: me()?.id, status: 'open', ...c }; L.contestazioni.unshift(rec); persistLocal(); notify();
  return remoteWrite(async () => { const row = await remote.insertContestazione(base.league.id, me().id, c); rec.id = row.id; });
}
export function resolveContestazione(id, status, note) { L.contestazioni = L.contestazioni.map((c) => (c.id === id ? { ...c, status, note, resolvedAt: now().toISOString() } : c)); log({ what: 'contestazione', id, status }); persistLocal(); notify(); return remoteWrite(() => remote.resolveContestazione(id, status, note)); }
export function changeLog() { return g.changeLog; }
export function contestazioni() { return L.contestazioni; }
