/**
 * Stato applicativo. Un solo backend: Supabase.
 * - Anagrafiche e calendario: generati dal client (src/data.js), uguali per tutte le leghe.
 * - Dato del campionato (risultati, presenze, eventi, congelamenti): globale, scritto dal Giudice Dati.
 * - Lega: membri, rose, formazioni, contestazioni.
 * Tutto ciò che il motore calcola è derivato e ricalcolabile da zero.
 */
import { buildSeason, draftRosters as buildDraft, mulberry32 } from './data.js';
import { computeRating, computeLineupResult, computeStandings, defaultLineup, DEFAULT_RULES } from './engine.js';
import * as remote from './backend.js';

const PREFS_KEY = 'fcs:prefs';
export const base = buildSeason();
export const playersById = new Map(base.players.map((p) => [p.id, p]));
export const clubsById = new Map(base.clubs.map((c) => [c.id, c]));
export const managersById = new Map();
const NO_LEAGUE = { id: null, name: 'Fantacampionato', shortName: 'Fantacampionato', rules: { ...DEFAULT_RULES }, managerCount: 0 };
base.league = NO_LEAGUE; base.managers = []; base.rosters = {};

let user = null, prof = null, leagues = [];
let g = emptyGlobal(); let L = emptyLeague();
let ready = false, connError = null;
let prefs = load(PREFS_KEY, { theme: 'system', installedDismissed: false, currentLeagueId: null });
let onError = (e) => console.error(e);
export function setErrorHandler(fn) { onError = fn; }

function emptyGlobal() { return { matchEvents: {}, matchOverrides: {}, appearanceOverrides: {}, matchdayStatus: {}, changeLog: [] }; }
function emptyLeague() { return { lineups: {}, contestazioni: [] }; }
function load(key, def) { try { const raw = localStorage.getItem(key); return raw ? { ...def, ...JSON.parse(raw) } : { ...def }; } catch { return { ...def }; } }
function persistPrefs() { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* quota */ } }
function refreshManagers() { managersById.clear(); for (const m of base.managers) managersById.set(m.id, m); }

const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
const cache = new Map();
function notify() { cache.clear(); listeners.forEach((fn) => fn()); }
const memo = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };

// ---------------------------------------------------------------- avvio
/** 'unconfigured' | 'offline' | 'anonymous' | 'no-league' | 'ready' */
export function appState() {
  if (!remote.isConfigured()) return 'unconfigured';
  if (!ready) return 'offline';
  if (!user) return 'anonymous';
  if (!prefs.currentLeagueId) return 'no-league';
  return 'ready';
}
export const connectionError = () => connError;
export const isReady = () => ready;
export const supabaseConfigured = () => remote.isConfigured();

export async function init() {
  connError = null; ready = false;
  if (!remote.isConfigured()) return;
  try {
    user = await remote.init();
    ready = true;
    remote.onAuth(async (u) => { const was = user?.id; user = u; if (u?.id !== was) { await loadAll(); notify(); } });
    await loadAll();
  } catch (e) { connError = e; onError(e); }
}
export async function retry() { await init(); notify(); return ready; }

async function loadAll() {
  if (!user) { prof = null; leagues = []; g = emptyGlobal(); L = emptyLeague(); base.managers = []; base.rosters = {}; base.league = NO_LEAGUE; refreshManagers(); return; }
  prof = (await remote.ensureProfile(user)) || { id: user.id, display_name: user.email, is_judge: false };
  leagues = await remote.myLeagues(user.id);
  if (!leagues.some((l) => l.id === prefs.currentLeagueId)) { prefs.currentLeagueId = leagues[0]?.id || null; persistPrefs(); }
  g = await remote.loadGlobal(prof.is_judge);
  if (prefs.currentLeagueId) {
    const data = await remote.loadLeague(prefs.currentLeagueId);
    base.managers = data.managers; base.rosters = data.rosters;
    base.league = { ...data.league, rules: { ...DEFAULT_RULES, ...data.league.rulesOverride }, managerCount: data.managers.length };
    L = { lineups: data.lineups, contestazioni: data.contestazioni };
  } else { base.managers = []; base.rosters = {}; base.league = NO_LEAGUE; L = emptyLeague(); }
  if (prof.is_judge) { try { L.contestazioni = await remote.allContestazioni(); } catch (e) { onError(e); } }
  refreshManagers();
  remote.subscribe(prefs.currentLeagueId, debounced);
}
let timer = null;
function debounced() { clearTimeout(timer); timer = setTimeout(() => refresh(), 400); }
export async function refresh() { if (!ready) return; try { await loadAll(); } catch (e) { onError(e); } notify(); }

// ---------------------------------------------------------------- sessione
const returnUrl = () => location.origin + location.pathname;
async function adopt() { user = await remote.currentSessionUser(); await loadAll(); notify(); return user; }
export const currentUser = () => user;
export const profileInfo = () => prof;
export async function signInPassword(email, password) { await remote.signInPassword(email, password); return adopt(); }
export async function signUpPassword(email, password, displayName) { const r = await remote.signUpPassword(email, password, displayName, returnUrl()); if (!r.needsConfirmation) await adopt(); return r; }
export async function resendConfirmation(email) { await remote.resendConfirmation(email, returnUrl()); }
export async function signInLink(email) { await remote.signInLink(email, returnUrl()); }
export async function verifyCode(email, token) { await remote.verifyOtp(email, token); return adopt(); }
export async function resetPassword(email) { await remote.resetPassword(email, returnUrl()); }
export async function updatePassword(password) { await remote.updatePassword(password); }
export async function updateDisplayName(name) { await remote.updateProfile(user.id, { display_name: name }); await refresh(); }
export async function signOut() { await remote.signOut(); user = null; await loadAll(); notify(); }
export function setSupabaseConfig(url, key) { remote.setConfig(url, key); location.reload(); }
export const serverUrl = () => remote.config()?.url || '';
export const serverKey = () => remote.config()?.key || '';
export const serverHost = () => { try { return new URL(serverUrl()).host; } catch { return ''; } };

// ---------------------------------------------------------------- leghe
export const myLeagues = () => leagues;
export const currentLeagueId = () => prefs.currentLeagueId;
export const hasLeague = () => !!prefs.currentLeagueId;
export const isJudge = () => !!prof?.is_judge;
export const me = () => base.managers.find((m) => m.userId === user?.id) || null;
export const isLeagueAdmin = () => me()?.role === 'admin' || isJudge();
export async function switchLeague(id) { prefs.currentLeagueId = id; persistPrefs(); await loadAll(); notify(); }
export async function createLeague(name, team, color, initials) { const id = await remote.createLeague(name, name.length > 14 ? name.split(' ').slice(0, 2).join(' ') : name, team, color, initials); await switchLeague(id); }
export async function joinLeague(code, team, color, initials) { const id = await remote.joinLeague(code, team, color, initials); await switchLeague(id); }
export async function setMemberRole(memberId, role) { await remote.updateMember(memberId, { role }); await refresh(); }
export async function removeMember(memberId) { await remote.removeMember(memberId); await refresh(); }
export async function draftRosters() {
  const ids = base.managers.map((m) => m.id);
  const rosters = buildDraft(ids, base.players, mulberry32(hashStr(base.league.id)));
  const rows = []; for (const mid of ids) for (const r of rosters[mid]) rows.push({ memberId: mid, ...r });
  await remote.replaceRosters(base.league.id, rows);
  for (const m of base.managers) await remote.updateMember(m.id, { credits: DEFAULT_RULES.budget - rosters[m.id].reduce((s, r) => s + r.pricePaid, 0) });
  await refresh();
}
export async function addRosterPlayer(memberId, playerId, price) { await remote.addRosterPlayer(base.league.id, memberId, playerId, price); await remote.updateMember(memberId, { credits: managersById.get(memberId).credits - price }); await refresh(); }
export async function removeRosterPlayer(memberId, playerId) { const r = (base.rosters[memberId] || []).find((x) => x.playerId === playerId); await remote.removeRosterPlayer(base.league.id, playerId); if (r) await remote.updateMember(memberId, { credits: managersById.get(memberId).credits + r.pricePaid }); await refresh(); }
/** Popola il database con gli eventi di esempio delle prime giornate: solo Giudice Dati, una volta. */
export async function seedSampleData() { await remote.seedDemo(base, user.id); await refresh(); }
function hashStr(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

export const store = {
  get: () => ({ theme: prefs.theme, installedDismissed: prefs.installedDismissed }),
  set: (patch) => { Object.assign(prefs, patch); persistPrefs(); notify(); },
};
export function resetAll() { localStorage.removeItem(PREFS_KEY); }
export const rules = () => base.league.rules;
export const now = () => new Date();

// ---------------------------------------------------------------- giornate
export function matchday(n) { return base.matchdays.find((m) => m.number === n); }
const blank = { status: 'scheduled', homeGoals: null, awayGoals: null, videoUrl: null };
export function matchesOf(n) { return base.matches.filter((m) => m.matchday === n).map((m) => ({ ...m, ...blank, ...(g.matchOverrides[m.id] || {}) })); }
export function match(id) { const m = base.matches.find((x) => x.id === id); return m ? { ...m, ...blank, ...(g.matchOverrides[id] || {}) } : null; }
export function eventsOf(matchId) { return g.matchEvents[matchId] || []; }
export function appearancesOf(matchId) { return g.appearanceOverrides[matchId] || []; }

/** Ultima giornata che ha dati inseriti. */
export function currentMatchday() {
  return memo('current', () => {
    let n = 0;
    for (const id in g.matchOverrides) { const k = +((id.match(/^md(\d+)/) || [])[1]); if (k > n) n = k; }
    for (const k in g.matchdayStatus) if (+k > n) n = +k;
    return Math.max(1, n);
  });
}
export const hasData = (n) => !!g.matchdayStatus[n] || matchesOf(n).some((m) => m.status !== 'scheduled');
export function nextMatchday() { const cur = currentMatchday(); return Math.min(30, hasData(cur) ? cur + 1 : cur); }
/** 'frozen' | 'provisional' | 'live' | 'open' | 'scheduled' */
export function matchdayStatus(n) {
  if (g.matchdayStatus[n]) return g.matchdayStatus[n];
  if (hasData(n)) return 'provisional';
  if (now() >= new Date(matchday(n).lockAt)) return 'live';
  return n === nextMatchday() ? 'open' : 'scheduled';
}
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
  const rec = { ...lineup, submittedAt: now().toISOString() }; L.lineups[`${n}:${managerId}`] = rec; notify();
  return remote.upsertLineup(base.league.id, managerId, n, rec).catch((e) => { onError(e); refresh(); });
}
export function lineupResult(n, managerId) { return memo(`lr:${n}:${managerId}`, () => { const lineup = lineupFor(n, managerId); return { lineup, ...computeLineupResult({ lineup, ratings: ratingsOf(n), players: playersById, managerCount: Math.max(6, base.league.managerCount), rules: rules() }) }; }); }
export function fixturesOf(n) {
  return memo(`fx:${n}`, () => {
    const ids = base.managers.map((m) => m.id); if (ids.length < 2) return [];
    const list = ids.length % 2 ? [...ids, null] : [...ids]; const rounds = [];
    for (let r = 0; r < list.length - 1; r++) { const pairs = []; for (let i = 0; i < list.length / 2; i++) { const a = list[i], b = list[list.length - 1 - i]; if (a && b) pairs.push(r % 2 === 0 ? [a, b] : [b, a]); } rounds.push(pairs); list.splice(1, 0, list.pop()); }
    const cycle = Math.floor((n - 1) / rounds.length);
    return rounds[(n - 1) % rounds.length].map(([a, b], i) => { const [h, w] = cycle % 2 === 1 ? [b, a] : [a, b]; return { id: `f${n}_${i + 1}`, matchday: n, homeManagerId: h, awayManagerId: w }; });
  });
}
export function fixture(id) { const n = +((id.match(/^f(\d+)_/) || [])[1]); return fixturesOf(n).find((f) => f.id === id); }
export function fixtureResult(f) {
  const st = matchdayStatus(f.matchday);
  // Senza nessun dato inserito la giornata non produce risultati: niente 0-0 d'ufficio.
  if (st === 'open' || st === 'scheduled' || !hasData(f.matchday)) return { ...f, played: false };
  const h = lineupResult(f.matchday, f.homeManagerId), a = lineupResult(f.matchday, f.awayManagerId);
  return { ...f, played: true, homeGoals: h.goals, awayGoals: a.goals, homeScore: h.total, awayScore: a.total, home: h, away: a, status: st };
}
export function resultsUntil(n) { const out = []; for (let k = 1; k <= n; k++) for (const f of fixturesOf(k)) { const r = fixtureResult(f); if (r.played) out.push(r); } return out; }
export function standings() { return memo('standings', () => computeStandings(base.managers, resultsUntil(currentMatchday()), rules())); }
export function myFixture(n, managerId) { return fixturesOf(n).find((f) => f.homeManagerId === managerId || f.awayManagerId === managerId) || null; }

// ---------------------------------------------------------------- Giudice Dati
const assertOpen = (matchId) => { const m = match(matchId); if (isFrozen(m.matchday)) throw new Error(`Giornata ${m.matchday} congelata (art. 9.2)`); return m; };
const write = (fn) => fn().catch((e) => { onError(e); refresh(); });
export function setMatch(matchId, patch) {
  assertOpen(matchId); const next = { ...(g.matchOverrides[matchId] || {}), ...patch }; g.matchOverrides[matchId] = next; notify();
  return write(() => remote.upsertMatch(matchId, next, user.id));
}
export function setAppearances(matchId, list) { assertOpen(matchId); g.appearanceOverrides[matchId] = list; notify(); return write(() => remote.replaceAppearances(matchId, list)); }
export function addEvent(matchId, ev) {
  assertOpen(matchId); const tmp = { id: `tmp${Date.now()}`, matchId, ...ev };
  g.matchEvents[matchId] = [...eventsOf(matchId), tmp].sort((a, b) => a.minute - b.minute); notify();
  return write(async () => { const row = await remote.insertEvent(matchId, ev, user.id); g.matchEvents[matchId] = g.matchEvents[matchId].map((e) => (e.id === tmp.id ? { ...e, id: row.id } : e)); });
}
export function removeEvent(matchId, eventId) { assertOpen(matchId); g.matchEvents[matchId] = eventsOf(matchId).filter((e) => e.id !== eventId); notify(); return write(() => remote.deleteEvent(eventId)); }
export function freezeMatchday(n) { g.matchdayStatus[n] = 'frozen'; notify(); return write(() => remote.setMatchdayStatus(n, 'frozen', user.id)); }
export function reopenMatchday(n) { delete g.matchdayStatus[n]; notify(); return write(() => remote.setMatchdayStatus(n, null, user.id)); }
export function addContestazione(c) {
  const rec = { id: `tmp${Date.now()}`, at: now().toISOString(), by: me()?.id, status: 'open', ...c }; L.contestazioni.unshift(rec); notify();
  return write(async () => { const row = await remote.insertContestazione(base.league.id, me().id, c); rec.id = row.id; });
}
export function resolveContestazione(id, status, note) { L.contestazioni = L.contestazioni.map((c) => (c.id === id ? { ...c, status, note, resolvedAt: now().toISOString() } : c)); notify(); return write(() => remote.resolveContestazione(id, status, note)); }
export function changeLog() { return g.changeLog; }
export function contestazioni() { return L.contestazioni; }
