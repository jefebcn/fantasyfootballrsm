/**
 * Adattatore Supabase. Caricato solo se configurato: la modalità locale non tocca la rete.
 * Ogni funzione ritorna dati già nel formato usato da state.js.
 */
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_JS, SUPABASE_TIMEOUT_MS } from './config.js';

let sb = null; let cfg = null;
export function config() {
  if (cfg) return cfg;
  try { const raw = localStorage.getItem('fcs:supabase'); if (raw) { const c = JSON.parse(raw); if (c.url && c.key) return (cfg = c); } } catch { /* ignora */ }
  if (SUPABASE_URL && SUPABASE_ANON_KEY) return (cfg = { url: SUPABASE_URL, key: SUPABASE_ANON_KEY });
  return null;
}
export function setConfig(url, key) { if (!url || !key) localStorage.removeItem('fcs:supabase'); else localStorage.setItem('fcs:supabase', JSON.stringify({ url, key })); cfg = null; }
export const isConfigured = () => !!config();

const withTimeout = (promise, ms, what) => Promise.race([
  promise,
  new Promise((_, rej) => setTimeout(() => rej(new Error(`${what}: nessuna risposta entro ${Math.round(ms / 1000)}s`)), ms)),
]);

export async function init() {
  const c = config(); if (!c) return null;
  const mod = await withTimeout(import(globalThis.__SUPABASE_JS__ || SUPABASE_JS), SUPABASE_TIMEOUT_MS, 'Libreria Supabase non raggiungibile');
  sb = mod.createClient(c.url, c.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  const { data } = await withTimeout(sb.auth.getSession(), SUPABASE_TIMEOUT_MS, 'Supabase non raggiungibile');
  return data.session?.user || null;
}
export const client = () => sb;
const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

// ---------------------------------------------------------------- auth
export async function signIn(email, redirectTo) { return must(await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo, shouldCreateUser: true } })); }
export async function verifyOtp(email, token) { return must(await sb.auth.verifyOtp({ email, token, type: 'email' })); }
export async function signOut() { await sb.auth.signOut(); }
export function onAuth(fn) { sb.auth.onAuthStateChange((_e, session) => fn(session?.user || null)); }
export async function profile(userId) { return must(await sb.from('profiles').select('*').eq('id', userId).maybeSingle()); }
export async function updateProfile(userId, patch) { return must(await sb.from('profiles').update(patch).eq('id', userId).select().single()); }

// ---------------------------------------------------------------- leghe
export async function myLeagues(userId) {
  const rows = must(await sb.from('league_members').select('role, league:leagues(id, name, short_name, invite_code, started, rules, created_at)').eq('user_id', userId));
  return rows.filter((r) => r.league).map((r) => ({ ...r.league, myRole: r.role }));
}
export async function createLeague(name, shortName, teamName, color, initials) { return must(await sb.rpc('create_league', { p_name: name, p_short: shortName, p_team: teamName, p_color: color, p_initials: initials })); }
export async function joinLeague(code, teamName, color, initials) { return must(await sb.rpc('join_league', { p_code: code, p_team: teamName, p_color: color, p_initials: initials })); }
export async function updateLeague(id, patch) { return must(await sb.from('leagues').update(patch).eq('id', id).select().single()); }

const toManager = (m) => ({ id: m.id, userId: m.user_id, teamName: m.team_name, owner: m.owner_name || m.profile?.display_name || '—', color: m.color, initials: m.initials || m.team_name.slice(0, 2).toUpperCase(), credits: m.credits, role: m.role });

export async function loadLeague(id) {
  const [league, members, rosters, lineups, contest] = await Promise.all([
    must(await sb.from('leagues').select('*').eq('id', id).single()),
    must(await sb.from('league_members').select('*, profile:profiles(display_name)').eq('league_id', id).order('created_at')),
    must(await sb.from('rosters').select('member_id, player_id, price_paid').eq('league_id', id).is('released_at', null)),
    must(await sb.from('lineups').select('member_id, matchday, lineup, submitted_at').eq('league_id', id)),
    must(await sb.from('contestazioni').select('*').eq('league_id', id).order('created_at', { ascending: false })),
  ]);
  const managers = members.map(toManager);
  const rosterMap = Object.fromEntries(managers.map((m) => [m.id, []]));
  for (const r of rosters) (rosterMap[r.member_id] ||= []).push({ playerId: r.player_id, pricePaid: r.price_paid });
  const lineupMap = {}; for (const l of lineups) lineupMap[`${l.matchday}:${l.member_id}`] = { ...l.lineup, submittedAt: l.submitted_at };
  const contestazioni = contest.map((c) => ({ id: c.id, at: c.created_at, by: c.member_id, matchId: c.match_id, playerId: c.player_id, minute: c.minute, text: c.text, status: c.status, note: c.note, resolvedAt: c.resolved_at }));
  return { league: { id: league.id, name: league.name, shortName: league.short_name || league.name, inviteCode: league.invite_code, started: league.started, rulesOverride: league.rules || {} }, managers, rosters: rosterMap, lineups: lineupMap, contestazioni };
}
export async function upsertLineup(leagueId, memberId, matchday, lineup) {
  const { submittedAt, source, ...body } = lineup;
  return must(await sb.from('lineups').upsert({ league_id: leagueId, member_id: memberId, matchday, lineup: body, submitted_at: new Date().toISOString() }));
}
export async function updateMember(id, patch) { return must(await sb.from('league_members').update(patch).eq('id', id).select().single()); }
export async function removeMember(id) { return must(await sb.from('league_members').delete().eq('id', id)); }
export async function replaceRosters(leagueId, rows) {
  must(await sb.from('rosters').delete().eq('league_id', leagueId));
  if (rows.length) must(await sb.from('rosters').insert(rows.map((r) => ({ league_id: leagueId, member_id: r.memberId, player_id: r.playerId, price_paid: r.pricePaid }))));
  await updateLeague(leagueId, { started: true });
}
export async function addRosterPlayer(leagueId, memberId, playerId, price) { return must(await sb.from('rosters').insert({ league_id: leagueId, member_id: memberId, player_id: playerId, price_paid: price })); }
export async function removeRosterPlayer(leagueId, playerId) { return must(await sb.from('rosters').delete().eq('league_id', leagueId).eq('player_id', playerId)); }
export async function insertContestazione(leagueId, memberId, c) { return must(await sb.from('contestazioni').insert({ league_id: leagueId, member_id: memberId, match_id: c.matchId, player_id: c.playerId, minute: c.minute, text: c.text }).select().single()); }
export async function resolveContestazione(id, status, note) { return must(await sb.from('contestazioni').update({ status, note, resolved_at: new Date().toISOString() }).eq('id', id)); }
export async function allContestazioni() {
  const rows = must(await sb.from('contestazioni').select('*, member:league_members(team_name, owner_name), league:leagues(name)').order('created_at', { ascending: false }));
  return rows.map((c) => ({ id: c.id, at: c.created_at, by: c.member_id, byName: c.member?.owner_name || c.member?.team_name, leagueName: c.league?.name, matchId: c.match_id, playerId: c.player_id, minute: c.minute, text: c.text, status: c.status, note: c.note }));
}

// ---------------------------------------------------------------- dato globale
export async function loadGlobal(withLog) {
  const [ov, ev, ap, st, log] = await Promise.all([
    must(await sb.from('match_overrides').select('*')),
    must(await sb.from('match_events').select('*').order('minute')),
    must(await sb.from('match_appearances').select('*')),
    must(await sb.from('matchday_status').select('*')),
    withLog ? must(await sb.from('change_log').select('*').order('at', { ascending: false }).limit(300)) : [],
  ]);
  const matchOverrides = {}; for (const o of ov) matchOverrides[o.match_id] = { status: o.status, homeGoals: o.home_goals, awayGoals: o.away_goals, ...(o.video_url ? { videoUrl: o.video_url } : {}) };
  const matchEvents = {}; for (const e of ev) (matchEvents[e.match_id] ||= []).push({ id: e.id, matchId: e.match_id, playerId: e.player_id, clubId: e.club_id, minute: e.minute, type: e.type });
  const appearanceOverrides = {}; for (const a of ap) (appearanceOverrides[a.match_id] ||= []).push({ matchId: a.match_id, playerId: a.player_id, clubId: a.club_id, started: a.started, minutesPlayed: a.minutes_played, enteredAt: a.entered_at });
  const matchdayStatus = {}; for (const s of st) matchdayStatus[s.matchday] = s.status;
  const changeLog = log.map((l) => ({ at: l.at, by: l.by_user, matchId: l.match_id, matchday: l.matchday, what: l.what, payload: l.payload }));
  return { matchOverrides, matchEvents, appearanceOverrides, matchdayStatus, changeLog };
}
export async function upsertMatch(matchId, patch, userId) {
  const row = { match_id: matchId, updated_by: userId, updated_at: new Date().toISOString() };
  if ('status' in patch) row.status = patch.status; if ('homeGoals' in patch) row.home_goals = patch.homeGoals; if ('awayGoals' in patch) row.away_goals = patch.awayGoals; if ('videoUrl' in patch) row.video_url = patch.videoUrl;
  return must(await sb.from('match_overrides').upsert(row));
}
export async function replaceAppearances(matchId, list) {
  must(await sb.from('match_appearances').delete().eq('match_id', matchId));
  if (list.length) must(await sb.from('match_appearances').insert(list.map((a) => ({ match_id: matchId, player_id: a.playerId, club_id: a.clubId, started: a.started, minutes_played: a.minutesPlayed, entered_at: a.enteredAt ?? 0 }))));
}
export async function insertEvent(matchId, ev, userId) { return must(await sb.from('match_events').insert({ match_id: matchId, player_id: ev.playerId, club_id: ev.clubId, minute: ev.minute, type: ev.type, created_by: userId }).select().single()); }
export async function deleteEvent(id) { return must(await sb.from('match_events').delete().eq('id', id)); }
export async function setMatchdayStatus(n, status, userId) { if (!status) return must(await sb.from('matchday_status').delete().eq('matchday', n)); return must(await sb.from('matchday_status').upsert({ matchday: n, status, changed_by: userId, changed_at: new Date().toISOString() })); }

/** Carica il dato demo generato (giornate già giocate) nel DB: solo Giudice Dati, solo su tabelle vuote. */
export async function seedDemo(base, userId) {
  const played = base.matches.filter((m) => m.status !== 'scheduled');
  must(await sb.from('match_overrides').upsert(played.map((m) => ({ match_id: m.id, status: m.status, home_goals: m.homeGoals, away_goals: m.awayGoals, video_url: m.videoUrl, updated_by: userId }))));
  const apps = base.appearances.map((a) => ({ match_id: a.matchId, player_id: a.playerId, club_id: a.clubId, started: a.started, minutes_played: a.minutesPlayed, entered_at: a.enteredAt ?? 0 }));
  for (let i = 0; i < apps.length; i += 200) must(await sb.from('match_appearances').upsert(apps.slice(i, i + 200)));
  const evs = base.events.map((e) => ({ match_id: e.matchId, player_id: e.playerId, club_id: e.clubId, minute: e.minute, type: e.type, created_by: userId }));
  for (let i = 0; i < evs.length; i += 200) must(await sb.from('match_events').insert(evs.slice(i, i + 200)));
  await setMatchdayStatus(1, 'frozen', userId);
}

// ---------------------------------------------------------------- realtime
let channel = null;
export function subscribe(leagueId, onChange) {
  if (channel) { sb.removeChannel(channel); channel = null; }
  channel = sb.channel('fcs');
  for (const t of ['match_overrides', 'match_events', 'match_appearances', 'matchday_status']) channel.on('postgres_changes', { event: '*', schema: 'public', table: t }, () => onChange('global'));
  if (leagueId) for (const t of ['lineups', 'rosters', 'league_members', 'contestazioni']) channel.on('postgres_changes', { event: '*', schema: 'public', table: t, filter: `league_id=eq.${leagueId}` }, () => onChange('league'));
  channel.subscribe();
}
