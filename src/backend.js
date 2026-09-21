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
  if (m.includes('more than one relationship') || m.includes('pgrst201')) return 'Il database ha più di un collegamento fra queste tabelle e la richiesta è ambigua: va indicata la chiave da usare.';
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
/**
 * Riallinea la copia del nome nelle proprie iscrizioni (owner_name).
 *
 * L'app mostra il nome vivo del profilo, quindi questo non serve a far
 * vedere il nome nuovo: serve a non lasciare in giro copie vecchie. Le
 * legge chi guarda una contestazione, e le leggerebbe un client non
 * aggiornato.
 *
 * Nomi diversi da lega a lega non esistono piu' — ce n'e' uno, quello
 * dell'account — quindi si riallineano tutte, senza eccezioni.
 */
export async function rinominaNelleLeghe(userId, nuovo) {
  const righe = must(await sb.from('league_members').select('id').eq('user_id', userId));
  for (const r of righe) must(await sb.from('league_members').update({ owner_name: nuovo }).eq('id', r.id));
  return righe.length;
}
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
  const rows = must(await sb.from('league_members').select('role, league:leagues!league_members_league_id_fkey(id, name, short_name, invite_code, started, rules, created_at, created_by)').eq('user_id', userId));
  return rows.filter((r) => r.league).map((r) => ({ ...r.league, myRole: r.role }));
}
export async function createLeague(name, shortName, teamName, color, initials) { return must(await sb.rpc('create_league', { p_name: name, p_short: shortName, p_team: teamName, p_color: color, p_initials: initials })); }
export async function joinLeague(code, teamName, color, initials) { return must(await sb.rpc('join_league', { p_code: code, p_team: teamName, p_color: color, p_initials: initials })); }
// --- lega pubblica (013)
export async function creaLegaPubblica(name, shortName, teamName, color, initials, budget, max, premi) {
  return must(await sb.rpc('crea_lega_pubblica', {
    p_name: name, p_short: shortName, p_team: teamName, p_color: color, p_initials: initials,
    p_budget: budget, p_max: max, p_premi: premi,
  }));
}
export async function entraLegaPubblica(id, teamName, color, initials) {
  return must(await sb.rpc('entra_lega_pubblica', { p_league: id, p_team: teamName, p_color: color, p_initials: initials }));
}
export async function leghePubbliche() { return must(await sb.rpc('leghe_pubbliche')) || []; }
export async function impostaPremi(id, premi) { return must(await sb.rpc('imposta_premi', { p_league: id, p_premi: premi })); }

// --- console amministrativa (014)
export async function adminRiepilogo() { return must(await sb.rpc('admin_riepilogo')) || {}; }
// admin_persone e non admin_utenti: la 015 ha aggiunto la colonna "sospeso"
// all'elenco, e un tipo di ritorno non si cambia con create or replace —
// spiegato per esteso nella migrazione.
export async function adminPersone(cerca, limite = 50) { return must(await sb.rpc('admin_persone', { p_cerca: cerca || null, p_limite: limite })) || []; }
export async function adminSospendi(userId, on) { return must(await sb.rpc('admin_sospendi', { p_user: userId, p_on: on })); }
export async function adminSquadre(cerca, limite = 50) { return must(await sb.rpc('admin_squadre', { p_cerca: cerca || null, p_limite: limite })) || []; }
export async function adminRinomina(memberId, squadra, fantallenatore) { return must(await sb.rpc('admin_rinomina', { p_member: memberId, p_squadra: squadra, p_fantallenatore: fantallenatore || null })); }
export async function adminLeghe(limite = 50) { return must(await sb.rpc('admin_leghe', { p_limite: limite })) || []; }
export async function adminImpostaRuolo(userId, ruolo, on) { return must(await sb.rpc('admin_imposta_ruolo', { p_user: userId, p_ruolo: ruolo, p_on: on })); }

export async function updateLeague(id, patch) { return must(await sb.from('leagues').update(patch).eq('id', id).select().single()); }
export async function deleteLeague(id) { return must(await sb.from('leagues').delete().eq('id', id)); }
export async function abbandonaLega(id) { return must(await sb.rpc('abbandona_lega', { p_league: id })); }
export async function rigeneraCodiceVice(memberId) { return must(await sb.rpc('rigenera_codice_vice', { p_member: memberId })); }
export async function entraComeVice(code) { return must(await sb.rpc('entra_come_vice', { p_code: code })); }
export async function togliVice(memberId) { return must(await sb.rpc('togli_vice', { p_member: memberId })); }

// ---------------------------------------------------------------- scambi
export async function proponiScambio(leagueId, aMember, offre, chiede, crediti, nota) {
  return must(await sb.rpc('proponi_scambio', { p_league: leagueId, p_a_member: aMember, p_offre: offre, p_chiede: chiede, p_crediti: crediti, p_nota: nota || null }));
}
export async function accettaScambio(id) { return must(await sb.rpc('accetta_scambio', { p_id: id })); }
export async function rifiutaScambio(id) { return must(await sb.rpc('rifiuta_scambio', { p_id: id })); }
export async function annullaScambio(id) { return must(await sb.rpc('annulla_scambio', { p_id: id })); }
// ------------------------------------------------------- mercato svincolati
export async function offri(leagueId, playerId, crediti) {
  return must(await sb.rpc('offri', { p_league: leagueId, p_player: playerId, p_crediti: crediti }));
}
export async function ritiraOfferta(id) { return must(await sb.rpc('ritira_offerta', { p_id: id })); }
export async function risolviOfferte(leagueId) { return must(await sb.rpc('risolvi_offerte', { p_league: leagueId })); }
export async function loadOfferte(leagueId) {
  const righe = must(await sb.from('offerte').select('*').eq('league_id', leagueId).order('creata_at', { ascending: false }));
  return (righe || []).map((o) => ({
    id: o.id, member: o.member_id, playerId: o.player_id, crediti: o.crediti,
    stato: o.stato, creataAt: o.creata_at, scadeAt: o.scade_at, chiusaAt: o.chiusa_at,
  }));
}

export async function loadScambi(leagueId) {
  const righe = must(await sb.from('trades').select('*').eq('league_id', leagueId).order('creato_at', { ascending: false }));
  return (righe || []).map((t) => ({
    id: t.id, da: t.da_member, a: t.a_member, offre: t.offre || [], chiede: t.chiede || [],
    crediti: t.crediti, stato: t.stato, nota: t.nota, creatoAt: t.creato_at, decisoAt: t.deciso_at,
  }));
}

// Il nome di chi allena: quello del suo profilo, non la copia in
// owner_name. La copia si scrive quando uno entra nella lega e poi resta
// ferma: chi cambiava il nome dell'account continuava a vedersi chiamare col
// vecchio in tutta l'app — nel menu, sullo scontro, in classifica. I profili
// si possono leggere tutti (policy profiles_read), quindi il nome vivo c'e'
// per ognuno; la copia resta come ripiego per i profili cancellati.
const toManager = (m) => ({ id: m.id, userId: m.user_id, teamName: m.team_name, owner: m.profile?.display_name || m.owner_name || '—', color: m.color, initials: m.initials || m.team_name.slice(0, 2).toUpperCase(), credits: m.credits, role: m.role, crestUrl: m.crest_url || null, kit: m.kit || {}, viceUserId: m.vice_user_id || null, viceCode: m.vice_code || null, viceName: m.vice?.display_name || null });

export async function loadLeague(id) {
  const [league, members, rosters, lineups, contest] = await Promise.all([
    must(await sb.from('leagues').select('*').eq('id', id).single()),
    must(await sb.from('league_members').select('*, profile:profiles!league_members_user_id_fkey(display_name), vice:profiles!league_members_vice_user_id_fkey(display_name)').eq('league_id', id).order('created_at')),
    must(await sb.from('rosters').select('member_id, player_id, price_paid').eq('league_id', id).is('released_at', null)),
    must(await sb.from('lineups').select('member_id, matchday, lineup, submitted_at').eq('league_id', id)),
    must(await sb.from('contestazioni').select('*').eq('league_id', id).order('created_at', { ascending: false })),
  ]);
  const managers = members.map(toManager);
  const rosterMap = Object.fromEntries(managers.map((m) => [m.id, []]));
  for (const r of rosters) (rosterMap[r.member_id] ||= []).push({ playerId: r.player_id, pricePaid: r.price_paid });
  const lineupMap = {}; for (const l of lineups) lineupMap[`${l.matchday}:${l.member_id}`] = { ...l.lineup, submittedAt: l.submitted_at };
  const contestazioni = contest.map((c) => ({ id: c.id, at: c.created_at, by: c.member_id, matchId: c.match_id, playerId: c.player_id, minute: c.minute, text: c.text, status: c.status, note: c.note, resolvedAt: c.resolved_at }));
  return { league: { id: league.id, name: league.name, shortName: league.short_name || league.name, inviteCode: league.invite_code, started: league.started, createdBy: league.created_by, createdAt: league.created_at, rulesOverride: league.rules || {}, pubblica: !!league.pubblica, classifica: league.classifica || 'scontri', premi: league.premi || [], maxMembri: league.max_membri || 12 }, managers, rosters: rosterMap, lineups: lineupMap, contestazioni };
}
export async function upsertLineup(leagueId, memberId, matchday, lineup) {
  // submittedAt e source non vanno nel JSON della formazione: il primo lo
  // riscrive il server qui sotto, il secondo e' roba del client.
  const { submittedAt: _sa, source: _src, ...body } = lineup;
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
/** Iscrizione push di QUESTO dispositivo. La policy lascia scrivere solo le proprie. */
export async function salvaPush(userId, sub) {
  return must(await sb.from('push_subscriptions').upsert({
    endpoint: sub.endpoint, user_id: userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, failed_at: null,
  }, { onConflict: 'endpoint' }));
}
export async function togliPush(endpoint) { return must(await sb.from('push_subscriptions').delete().eq('endpoint', endpoint)); }

export async function removeRosterPlayer(leagueId, playerId) { return must(await sb.from('rosters').delete().eq('league_id', leagueId).eq('player_id', playerId)); }
export async function insertContestazione(leagueId, memberId, c) { return must(await sb.from('contestazioni').insert({ league_id: leagueId, member_id: memberId, match_id: c.matchId, player_id: c.playerId, minute: c.minute, text: c.text }).select().single()); }
export async function resolveContestazione(id, status, note) { return must(await sb.from('contestazioni').update({ status, note, resolved_at: new Date().toISOString() }).eq('id', id)); }
export async function allContestazioni() {
  const rows = must(await sb.from('contestazioni').select('*, member:league_members(team_name, owner_name), league:leagues(name)').order('created_at', { ascending: false }));
  return rows.map((c) => ({ id: c.id, at: c.created_at, by: c.member_id, byName: c.member?.owner_name || c.member?.team_name, leagueName: c.league?.name, matchId: c.match_id, playerId: c.player_id, minute: c.minute, text: c.text, status: c.status, note: c.note }));
}

// ---------------------------------------------------------------- sponsor
const daRiga = (r) => ({ id: r.id, nome: r.nome, claim: r.claim || '', logo: r.logo_url || '', link: r.link || '', dal: r.dal, al: r.al, attivo: r.attivo !== false });
/**
 * Gli sponsor che il database lascia vedere.
 *
 * La finestra (attivo, dal, al) la applica la policy, non questa funzione: a
 * chi amministra tornano anche quelli programmati e quelli scaduti, a tutti
 * gli altri solo quello in corso. Cosi' la schermata non deve sapere le
 * regole, e una regola sola vale per tutti i modi di chiedere il dato.
 */
export async function caricaSponsor() { return must(await sb.from('sponsor').select('*').order('dal', { ascending: false })).map(daRiga); }
export async function salvaSponsor(s, userId) {
  const riga = { nome: s.nome, claim: s.claim || null, logo_url: s.logo || null, link: s.link || null,
    dal: s.dal, al: s.al || null, attivo: s.attivo !== false, creato_da: userId };
  if (s.id) return daRiga(must(await sb.from('sponsor').update(riga).eq('id', s.id).select().single()));
  return daRiga(must(await sb.from('sponsor').insert(riga).select().single()));
}
export async function eliminaSponsor(id) { return must(await sb.from('sponsor').delete().eq('id', id)); }

// ---------------------------------------------------------------- dato globale
export async function loadGlobal(withLog) {
  const [ov, ev, ap, st, lk, log] = await Promise.all([
    must(await sb.from('match_overrides').select('*')),
    must(await sb.from('match_events').select('*').order('minute')),
    must(await sb.from('match_appearances').select('*')),
    must(await sb.from('matchday_status').select('*')),
    must(await sb.from('matchday_locks').select('*')),
    withLog ? must(await sb.from('change_log').select('*').order('at', { ascending: false }).limit(300)) : [],
  ]);
  const matchOverrides = {}; for (const o of ov) matchOverrides[o.match_id] = { status: o.status, homeGoals: o.home_goals, awayGoals: o.away_goals, ...(o.video_url ? { videoUrl: o.video_url } : {}) };
  const matchEvents = {}; for (const e of ev) (matchEvents[e.match_id] ||= []).push({ id: e.id, matchId: e.match_id, playerId: e.player_id, clubId: e.club_id, minute: e.minute, type: e.type });
  const appearanceOverrides = {}; for (const a of ap) (appearanceOverrides[a.match_id] ||= []).push({ matchId: a.match_id, playerId: a.player_id, clubId: a.club_id, started: a.started, minutesPlayed: a.minutes_played, enteredAt: a.entered_at });
  const matchdayStatus = {}; for (const s of st) matchdayStatus[s.matchday] = s.status;
  const changeLog = log.map((l) => ({ at: l.at, by: l.by_user, matchId: l.match_id, matchday: l.matchday, what: l.what, payload: l.payload }));
  // Il lock che il SERVER applica alle policy: serve per accorgersi se si e'
  // scostato dal calendario dell'app, non per usarlo al posto suo.
  const lockServer = {}; for (const r of lk) lockServer[r.matchday] = r.lock_at;
  return { matchOverrides, matchEvents, appearanceOverrides, matchdayStatus, lockServer, changeLog };
}

/** Riscrive sul server il calendario dei lock. Solo il Giudice Dati. */
export async function syncMatchdayLocks(righe) {
  return must(await sb.rpc('sync_matchday_locks', { p: righe }));
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
/** Chiude la giornata senza essere il Giudice Dati: il controllo sta nella
 *  funzione (008), non nei permessi della tabella, che restano come sono. */
export async function chiudiGiornata(n) { return must(await sb.rpc('chiudi_giornata', { p_matchday: n })); }
/** Cancella il proprio profilo. Si rifiuta se lasceresti una lega senza amministratore. */
export async function eliminaProfilo() { return must(await sb.rpc('elimina_profilo')); }
export async function setMatchdayStatus(n, status, userId) { if (!status) return must(await sb.from('matchday_status').delete().eq('matchday', n)); return must(await sb.from('matchday_status').upsert({ matchday: n, status, changed_by: userId, changed_at: new Date().toISOString() })); }

/**
 * Porta in lega i tabellini di alcune giornate: presenze ed eventi veri, come
 * li ha pubblicati la FSGC e come li ha scritti l'import in src/eventi-dati.js.
 *
 * I gol delle partite di campionato NON si scrivono qui: il risultato e' un
 * fatto della federazione e l'app lo legge dal calendario (conFSGC). Qui
 * servono le presenze e gli eventi, perche' e' da quelli che nascono i voti.
 *
 * Le giornate le sceglie chi chiama, e ne passa solo di vuote: gli eventi si
 * INSERISCONO, non si aggiornano, e la tabella non ha una chiave che li
 * distingua. Caricare due volte la stessa giornata vorrebbe dire contare i
 * gol due volte.
 */
export async function caricaReferti(base, userId, gare) {
  let presenze = 0, eventi = 0; const fatte = [];
  // Una PARTITA per volta, e se una si rompe a meta' si ripulisce: chi chiama
  // riconosce le partite da fare perche' in lega sono VUOTE, quindi mezza
  // partita dentro non verrebbe mai piu' completata — e i voti di quella gara
  // resterebbero sbagliati per sempre.
  for (const id of [...new Set(gare)]) {
    const apps = base.appearances.filter((a) => a.matchId === id)
      .map((a) => ({ match_id: a.matchId, player_id: a.playerId, club_id: a.clubId, started: a.started, minutes_played: a.minutesPlayed, entered_at: a.enteredAt ?? 0 }));
    const evs = base.events.filter((e) => e.matchId === id)
      .map((e) => ({ match_id: e.matchId, player_id: e.playerId, club_id: e.clubId, minute: e.minute, type: e.type, created_by: userId }));
    try {
      for (let i = 0; i < apps.length; i += 200) must(await sb.from('match_appearances').upsert(apps.slice(i, i + 200)));
      for (let i = 0; i < evs.length; i += 200) must(await sb.from('match_events').insert(evs.slice(i, i + 200)));
    } catch (e) {
      try { await sb.from('match_events').delete().eq('match_id', id); await sb.from('match_appearances').delete().eq('match_id', id); } catch { /* la pulizia e' un di piu' */ }
      throw e;
    }
    presenze += apps.length; eventi += evs.length; fatte.push(id);
  }
  const giornate = [...new Set(fatte.map((id) => +((id.match(/^md(\d+)/) || [])[1])))].filter(Boolean).sort((a, b) => a - b);
  return { gare: fatte, giornate, presenze, eventi };
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
