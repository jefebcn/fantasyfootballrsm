/**
 * Adattatore Supabase. Caricato solo se configurato: la modalità locale non tocca la rete.
 * Ogni funzione ritorna dati già nel formato usato da state.js.
 */
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_JS, SUPABASE_TIMEOUT_MS } from './config.js';

let sb = null; let cfg = null; let providers = {}; let external = false; let settings = null;
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

/**
 * accessToken: se presente, l'identità arriva da un fornitore esterno (Clerk) e
 * l'autenticazione di Supabase non viene usata. Altrimenti si usa Supabase Auth.
 */
export async function init({ accessToken } = {}) {
  const c = config(); if (!c) return null;
  const mod = await withTimeout(import(globalThis.__SUPABASE_JS__ || SUPABASE_JS), SUPABASE_TIMEOUT_MS, 'Libreria Supabase non raggiungibile');
  external = !!accessToken;
  sb = external
    ? mod.createClient(c.url, c.key, { accessToken })
    : mod.createClient(c.url, c.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  if (external) { providers = {}; return null; }
  const { data } = await withTimeout(sb.auth.getSession(), SUPABASE_TIMEOUT_MS, 'Supabase non raggiungibile');
  providers = await loadProviders(c);
  return data.session?.user || null;
}

/** Quali accessi social sono davvero attivi sul progetto: i pulsanti spenti non si mostrano. */
async function loadProviders(c) {
  try {
    const r = await fetch(`${c.url}/auth/v1/settings`, { headers: { apikey: c.key } });
    if (!r.ok) return {};
    settings = await r.json();
    return settings.external || {};
  } catch { return {}; }
}
export const authSettings = () => settings;

/**
 * Legge la configurazione vera del progetto e dice cosa manca ancora.
 * Serve perché gli interruttori stanno nel pannello Supabase, non nel codice:
 * senza questo l'unico modo di sapere come sono messi è provare a registrarsi.
 */
export async function checkSetup() {
  const c = config(); if (!c) return [{ id: 'server', livello: 'errore', voce: 'Server', esito: 'Nessun progetto collegato.' }];
  const out = [];
  let s = settings;
  try {
    const r = await withTimeout(fetch(`${c.url}/auth/v1/settings`, { headers: { apikey: c.key } }), SUPABASE_TIMEOUT_MS, 'timeout');
    if (r.ok) { s = await r.json(); settings = s; }
  } catch { /* sotto lo segnaliamo come irraggiungibile */ }
  if (!s) return [{ id: 'raggiungibile', livello: 'errore', voce: 'Raggiungibilità', esito: 'Il progetto non risponde.' }];

  out.push({ id: 'email', livello: s.external?.email ? 'ok' : 'errore', voce: 'Accesso con e-mail',
    esito: s.external?.email ? 'Attivo.' : 'Spento: nessuno può registrarsi.',
    dove: 'Authentication → Sign In / Providers → Email' });
  out.push({ id: 'signup', livello: s.disable_signup ? 'errore' : 'ok', voce: 'Nuove registrazioni',
    esito: s.disable_signup ? 'Bloccate: nessun account nuovo.' : 'Aperte.',
    dove: 'Authentication → Sign In / Providers → Allow new users to sign up' });
  out.push({ id: 'conferma', livello: s.mailer_autoconfirm ? 'ok' : 'attenzione', voce: 'Conferma e-mail',
    esito: s.mailer_autoconfirm
      ? 'Spenta: chi si registra entra subito.'
      : 'Accesa: dopo la registrazione bisogna aprire il link ricevuto per e-mail.',
    dove: 'Authentication → Sign In / Providers → Email → Confirm email' });
  for (const [k, nome] of [['google', 'Google'], ['apple', 'Apple']]) {
    out.push({ id: k, livello: s.external?.[k] ? 'ok' : 'attenzione', voce: `Accesso con ${nome}`,
      esito: s.external?.[k] ? 'Attivo: il pulsante compare da solo.' : 'Non configurato: il pulsante resta nascosto.',
      dove: `Authentication → Sign In / Providers → ${nome}` });
  }
  // Il ritorno dal link e dagli accessi social passa da qui: se l'indirizzo non è in elenco,
  // l'e-mail riporta alla home di Supabase invece che dentro l'app, senza nessun errore visibile.
  out.push({ id: 'redirect', livello: 'info', voce: 'Indirizzi di ritorno',
    esito: `Da avere in elenco: ${location.origin}/**`,
    dove: 'Authentication → URL Configuration → Redirect URLs' });

  try {
    const { error } = await sb.from('leagues').select('id').limit(1);
    out.push({ id: 'db', livello: error ? 'errore' : 'ok', voce: 'Database',
      esito: error ? `Non raggiungibile: ${error.message}` : 'Schema applicato e leggibile.' });
  } catch (e) { out.push({ id: 'db', livello: 'errore', voce: 'Database', esito: String(e?.message || e) }); }
  return out;
}
export const enabledProviders = () => providers;
export const usesExternalIdentity = () => external;
export async function signInOAuth(provider, redirectTo) {
  return authCall(sb.auth.signInWithOAuth({ provider, options: { redirectTo, queryParams: provider === 'google' ? { prompt: 'select_account' } : undefined } }));
}
export const client = () => sb;
export async function currentSessionUser() { const { data } = await sb.auth.getUser(); return data?.user || null; }
/** Traduce gli errori di Supabase in messaggi che dicono cosa fare. */
export function translate(error) {
  const m = (error?.message || String(error || '')).toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail o password non corretti.';
  if (m.includes('email not confirmed')) return 'Account non ancora attivo: apri il link nell\'e-mail di conferma. Se non l\'hai più, usa «Rimanda l\'e-mail».';
  if (m.includes('user already registered') || m.includes('already been registered')) return 'Esiste già un account con questa e-mail: accedi con la password.';
  if (m.includes('password should be at least')) return 'La password deve avere almeno 6 caratteri.';
  if (m.includes('token has expired') || m.includes('invalid token') || m.includes('otp')) return 'Codice scaduto o non valido: chiedine uno nuovo.';
  if (m.includes('email rate limit') || m.includes('over_email_send_rate_limit')) return 'Limite di e-mail raggiunto su questo progetto: il servizio incluso ne manda poche all\'ora. Aspetta un\'ora, oppure fai disattivare la conferma via e-mail.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Troppi tentativi: riprova fra qualche minuto.';
  if (m.includes('redirect') || m.includes('not allowed')) return 'Indirizzo di ritorno non autorizzato: va aggiunto ai Redirect URLs su Supabase.';
  if (m.includes('signups not allowed')) return 'Le registrazioni sono chiuse su questo progetto.';
  if (m.includes('failed to fetch') || m.includes('networkerror')) return 'Nessuna connessione al server.';
  if (m.includes('invalid input syntax for type uuid')) return 'Il database non è pronto per Clerk: esegui la migrazione 001-identita-esterna.sql nell\'SQL Editor.';
  if (m.includes('jwt') || m.includes('jwks') || m.includes('invalid claim')) return 'Token non accettato da Supabase: controlla l\'integrazione Clerk in Authentication → Third-Party Auth e che il claim "role" valga "authenticated".';
  return error?.message || 'Errore imprevisto.';
}
const must = ({ data, error }) => { if (error) throw new Error(translate(error)); return data; };

// ---------------------------------------------------------------- auth
const authCall = async (promise) => { const { data, error } = await promise; if (error) throw new Error(translate(error)); return data; };

export async function signInPassword(email, password) { return authCall(sb.auth.signInWithPassword({ email, password })); }
export async function signUpPassword(email, password, displayName, redirectTo) {
  const data = await authCall(sb.auth.signUp({ email, password, options: { data: { display_name: displayName }, emailRedirectTo: redirectTo } }));
  // Con la conferma e-mail attiva la sessione non c'è: serve aprire il link ricevuto.
  return { user: data.user, needsConfirmation: !data.session };
}
export async function signInLink(email, redirectTo) { return authCall(sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo, shouldCreateUser: true } })); }
export async function verifyOtp(email, token) { return authCall(sb.auth.verifyOtp({ email, token: token.trim(), type: 'email' })); }
export async function resendConfirmation(email, redirectTo) { return authCall(sb.auth.resend({ type: 'signup', email, options: { emailRedirectTo: redirectTo } })); }
export async function resetPassword(email, redirectTo) { return authCall(sb.auth.resetPasswordForEmail(email, { redirectTo })); }
export async function updatePassword(password) { return authCall(sb.auth.updateUser({ password })); }
export async function signOut() { await sb.auth.signOut(); }
export function onAuth(fn) { sb.auth.onAuthStateChange((_e, session) => fn(session?.user || null)); }
export async function profile(userId) { return must(await sb.from('profiles').select('*').eq('id', userId).maybeSingle()); }
export async function updateProfile(userId, patch) { return must(await sb.from('profiles').update(patch).eq('id', userId).select().single()); }
/** Il profilo nasce da un trigger su auth.users: se manca (trigger assente) lo crea il client. */
export async function ensureProfile(user) {
  const p = await profile(user.id);
  if (p) return p;
  const m = user.user_metadata || {};
  const name = m.display_name || m.full_name || m.name
    || [m.given_name, m.family_name].filter(Boolean).join(' ')
    || (user.email || '').split('@')[0];
  return must(await sb.from('profiles').upsert({ id: user.id, display_name: name }).select().single());
}

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
  // Si congelano solo le giornate concluse per intero: se una partita non è
  // ancora stata giocata la giornata resta aperta, come vuole l'art. 9.2.
  const perGiornata = {};
  for (const m of base.matches) (perGiornata[m.matchday] ||= []).push(m);
  for (const [n, ms] of Object.entries(perGiornata)) {
    if (ms.every((m) => m.realStatus === 'played')) await setMatchdayStatus(+n, 'frozen', userId);
  }
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
