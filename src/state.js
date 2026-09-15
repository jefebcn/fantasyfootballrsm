/**
 * Stato applicativo. Un solo backend: Supabase.
 * - Anagrafiche e calendario: generati dal client (src/data.js), uguali per tutte le leghe.
 * - Dato del campionato (risultati, presenze, eventi, congelamenti): globale, scritto dal Giudice Dati.
 * - Lega: membri, rose, formazioni, contestazioni.
 * Tutto ciò che il motore calcola è derivato e ricalcolabile da zero.
 */
import { buildSeason, draftRosters as buildDraft, mulberry32 } from './data.js';
import { computeRating, computeLineupResult, computeStandings, defaultLineup, validaAcquisto, offertaMassima, DEFAULT_RULES } from './engine.js';
import * as remote from './backend.js';
import * as clerk from './auth-clerk.js';
import * as AV from './notifiche.js';

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
let prefs = load(PREFS_KEY, { theme: 'system', installedDismissed: false, currentLeagueId: null, onboarded: false, sfondoFoto: true });
let onError = (e) => console.error(e);
export function setErrorHandler(fn) { onError = fn; }

function emptyGlobal() { return { matchEvents: {}, matchOverrides: {}, appearanceOverrides: {}, matchdayStatus: {}, lockServer: {}, changeLog: [] }; }
function emptyLeague() { return { lineups: {}, contestazioni: [], scambi: [] }; }
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

export const authKind = () => (clerk.isEnabled() ? 'clerk' : 'supabase');
export async function init() {
  connError = null; ready = false;
  if (!remote.isConfigured()) return;
  try {
    if (authKind() === 'clerk') {
      user = await clerk.init();
      await remote.init({ accessToken: clerk.token });
      clerk.onChange(async (u) => { const was = user?.id; user = u; if (u?.id !== was) { await loadAll(); notify(); } });
    } else {
      user = await remote.init();
      remote.onAuth(async (u) => { const was = user?.id; user = u; if (u?.id !== was) { await loadAll(); notify(); } });
    }
    ready = true;
    if (user && !prefs.onboarded) { prefs.onboarded = true; persistPrefs(); }
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
    L = { lineups: data.lineups, contestazioni: data.contestazioni, scambi: [] };
    // Gli scambi arrivano dalla 006: su un progetto che non l'ha ancora
    // applicata la tabella non c'e', e l'app deve funzionare comunque —
    // senza la scheda Scambi, non con una schermata di errore.
    try { L.scambi = await remote.loadScambi(prefs.currentLeagueId); L.scambiDisponibili = true; }
    catch { L.scambi = []; L.scambiDisponibili = false; }
  } else { base.managers = []; base.rosters = {}; base.league = NO_LEAGUE; L = emptyLeague(); }
  if (prof.is_judge) { try { L.contestazioni = await remote.allContestazioni(); } catch (e) { onError(e); } }
  refreshManagers();
  remote.subscribe(prefs.currentLeagueId, debounced);
  // Il Giudice Dati allinea il calendario dei lock senza doverselo ricordare:
  // e' un dato derivato dal calendario, identico a ogni giro, e l'RPC riscrive
  // solo le righe diverse. Una volta per sessione, e un errore qui non deve
  // impedire di usare l'app.
  if (prof?.is_judge && !lockGiaSincronizzati && !lockInCorso && lockDisallineati().length) {
    // Il segno di "fatto" va messo DOPO che e' riuscita, non prima: segnandolo
    // prima, un errore di rete lasciava il calendario disallineato per tutta la
    // sessione senza piu' riprovare. `lockInCorso` evita solo la sovrapposizione
    // di due giri, e l'RPC e' comunque ripetibile (riscrive zero righe).
    lockInCorso = true;
    try { await remote.syncMatchdayLocks(calendarioLock()); g = await remote.loadGlobal(prof.is_judge); lockGiaSincronizzati = true; }
    catch (e) { onError(e); }
    finally { lockInCorso = false; }
  }
}
let timer = null;
function debounced() { clearTimeout(timer); timer = setTimeout(() => refresh(), 400); }
export async function refresh() { if (!ready) return; try { await loadAll(); } catch (e) { onError(e); } notify(); }

// ---------------------------------------------------------------- sessione
const returnUrl = () => location.origin + location.pathname;
async function adopt() { user = authKind() === 'clerk' ? clerk.user() : await remote.currentSessionUser(); if (user && !prefs.onboarded) { prefs.onboarded = true; persistPrefs(); } await loadAll(); notify(); return user; }
export const currentUser = () => user;
export const profileInfo = () => prof;
export async function signInPassword(email, password) { await remote.signInPassword(email, password); return adopt(); }
export async function signUpPassword(email, password, displayName) { const r = await remote.signUpPassword(email, password, displayName, returnUrl()); if (!r.needsConfirmation) await adopt(); return r; }
export async function resendConfirmation(email) { await remote.resendConfirmation(email, returnUrl()); }
export async function signInLink(email) { await remote.signInLink(email, returnUrl()); }
export const oauthProviders = () => { const p = remote.enabledProviders(); return ['google', 'apple'].filter((k) => p[k]); };
export const clerkMount = (el, kind) => clerk.mount(el, kind);
export const clerkUnmount = (el) => clerk.unmount(el);
export const clerkProfile = () => clerk.openProfile();
export async function signInWithProvider(provider) { await remote.signInOAuth(provider, returnUrl()); }
export async function verifyCode(email, token) { await remote.verifyOtp(email, token); return adopt(); }
export async function resetPassword(email) { await remote.resetPassword(email, returnUrl()); }
export async function updatePassword(password) { await remote.updatePassword(password); }
/**
 * Il nome è stato ricavato dall'indirizzo invece che dichiarato?
 * Succede con Apple: chi sceglie «Nascondi la mia e-mail» arriva con un
 * indirizzo tipo pq7jh9h827@privaterelay.appleid.com, e il nome passa solo
 * alla primissima autorizzazione. Senza chiederlo, in lega comparirebbe la
 * sigla dell'indirizzo.
 */
export function nomeDaCompletare() {
  const n = profileInfo()?.display_name || ''; const mail = currentUser()?.email || '';
  if (!n) return true;
  const locale = mail.split('@')[0];
  return !!locale && n === locale;
}
export async function updateDisplayName(name) { await remote.updateProfile(user.id, { display_name: name }); await refresh(); }
export async function signOut() { authKind() === 'clerk' ? await clerk.signOut() : await remote.signOut(); user = null; await loadAll(); notify(); }
export function setSupabaseConfig(url, key) { remote.setConfig(url, key); location.reload(); }
export const checkSetup = () => remote.checkSetup();
export const serverUrl = () => remote.config()?.url || '';
export const serverKey = () => remote.config()?.key || '';
export const serverHost = () => { try { return new URL(serverUrl()).host; } catch { return ''; } };

// ---------------------------------------------------------------- leghe
export const myLeagues = () => leagues;
export const currentLeagueId = () => prefs.currentLeagueId;
export const hasLeague = () => !!prefs.currentLeagueId;
export const isJudge = () => !!prof?.is_judge;
// Il secondo allenatore non ha una squadra sua: la "sua" è quella di cui è vice.
export const me = () => base.managers.find((m) => m.userId === user?.id)
  || base.managers.find((m) => m.viceUserId && m.viceUserId === user?.id) || null;
export const isLeagueAdmin = () => me()?.role === 'admin' || isJudge();
export async function switchLeague(id) { prefs.currentLeagueId = id; persistPrefs(); await loadAll(); notify(); }
export async function createLeague(name, team, color, initials) { const id = await remote.createLeague(name, name.length > 14 ? name.split(' ').slice(0, 2).join(' ') : name, team, color, initials); await switchLeague(id); }
export async function joinLeague(code, team, color, initials) { const id = await remote.joinLeague(code, team, color, initials); await switchLeague(id); }
export async function setMemberRole(memberId, role) { await remote.updateMember(memberId, { role }); await refresh(); }

// ------------------------------------------------- la mia squadra e la lega
/** Salva stemma, maglia e nomi della propria squadra. */
export async function updateMyTeam(patch) {
  const m = me(); if (!m) throw new Error('Non fai parte di questa lega');
  const body = {};
  if (patch.teamName !== undefined) { body.team_name = patch.teamName; body.initials = iniziali(patch.teamName); }
  if (patch.owner !== undefined) body.owner_name = patch.owner;
  if (patch.color !== undefined) body.color = patch.color;
  if (patch.crestUrl !== undefined) body.crest_url = patch.crestUrl;
  if (patch.kit !== undefined) body.kit = patch.kit;
  await remote.updateMember(m.id, body); await refresh();
}
const iniziali = (t) => String(t || '').replace(/[^A-Za-zÀ-ÿ0-9 ]/g, '').split(/\s+/).filter(Boolean)
  .map((w) => w[0]).join('').slice(0, 3).toUpperCase() || 'FC';

/** Opzioni di regolamento della lega. Si salva solo lo scostamento dal
 *  regolamento base: cosi' una regola non toccata segue gli aggiornamenti del
 *  motore invece di restare congelata alla creazione della lega. */
export async function salvaRegole(patch) {
  if (!base.league.id) throw new Error('Nessuna lega');
  const scostamento = { ...(base.league.rulesOverride || {}) };
  for (const [k, v] of Object.entries(patch)) {
    if (JSON.stringify(v) === JSON.stringify(DEFAULT_RULES[k])) delete scostamento[k]; else scostamento[k] = v;
  }
  await remote.updateLeague(base.league.id, { rules: scostamento });
  await loadAll(); notify();
}

/** Solo chi ha creato la lega può eliminarla (regola sul server, non qui). */
export const soPossoEliminareLega = () => !!base.league.createdBy && base.league.createdBy === currentUser()?.id;
/** Vale anche per una lega diversa da quella aperta: serve all'elenco. */
export const laHoCreataIo = (l) => !!l?.created_by && l.created_by === currentUser()?.id;

export async function deleteLeague(id = base.league.id) {
  if (!id) throw new Error('Nessuna lega');
  await remote.deleteLeague(id);
  if (id === prefs.currentLeagueId) prefs.currentLeagueId = null;
  persistPrefs(); await loadAll(); notify();
}
/** Uscire da una lega altrui: la riga del partecipante se ne va, la lega resta. */
export async function abbandonaLega(id) {
  await remote.abbandonaLega(id);
  if (id === prefs.currentLeagueId) prefs.currentLeagueId = null;
  persistPrefs(); await loadAll(); notify();
}

/** Allenatore in seconda: invito con link, ingresso, revoca. */
export async function invitaVice() {
  const m = me(); if (!m) throw new Error('Non fai parte di questa lega');
  const code = await remote.rigeneraCodiceVice(m.id); await refresh(); return code;
}
export async function entraComeVice(code) { const id = await remote.entraComeVice(code); await switchLeague(id); }
export async function togliVice(memberId) { await remote.togliVice(memberId); await refresh(); }
/** Sono il secondo allenatore di questa squadra, non il titolare? */
export const sonoVice = () => { const u = currentUser(); const m = me(); return !!(u && m && m.viceUserId === u.id && m.userId !== u.id); };
export async function removeMember(memberId) { await remote.removeMember(memberId); await refresh(); }
export async function draftRosters() {
  const ids = base.managers.map((m) => m.id);
  const rosters = buildDraft(ids, base.players, mulberry32(hashStr(base.league.id)));
  const rows = []; for (const mid of ids) for (const r of rosters[mid]) rows.push({ memberId: mid, ...r });
  await remote.replaceRosters(base.league.id, rows);
  for (const m of base.managers) await remote.updateMember(m.id, { credits: DEFAULT_RULES.budget - rosters[m.id].reduce((s, r) => s + r.pricePaid, 0) });
  await refresh();
}
/** Chi ha gia' un giocatore, in tutta la lega: l'asta lo deve sapere prima di
 *  offrirlo, anche se poi l'indice unico sul database lo impedisce comunque. */
export function proprietari() {
  const m = new Map();
  for (const mg of base.managers) for (const r of base.rosters[mg.id] || []) m.set(r.playerId, { managerId: mg.id, pricePaid: r.pricePaid });
  return m;
}
/** Stato d'asta di una squadra: crediti, caselle per ruolo, offerta massima. */
export function statoAsta(managerId) {
  const rosa = rosterOf(managerId); const r = rules();
  const per = { P: 0, D: 0, C: 0, A: 0 }; for (const x of rosa) if (x.player) per[x.player.role]++;
  const crediti = managersById.get(managerId)?.credits ?? 0;
  const vuote = ['P', 'D', 'C', 'A'].reduce((n, k) => n + Math.max(0, r.roster[k] - per[k]), 0);
  return { rosa, crediti, per, serve: r.roster, vuote, presi: rosa.length, totale: 25,
    max: (role) => offertaMassima({ rosa, crediti, role, rules: r }) };
}
/** Le ragioni per cui questo acquisto non si puo' fare. Vuoto = si puo'. */
export function perchePuoiNo(managerId, playerId, prezzo) {
  const st = statoAsta(managerId); const p = playersById.get(playerId);
  const pr = proprietari().get(playerId);
  return validaAcquisto({ rosa: st.rosa, crediti: st.crediti, player: p, prezzo,
    giaPreso: !!pr && pr.managerId !== managerId, rules: rules() });
}
export async function addRosterPlayer(memberId, playerId, price) {
  // Le regole si applicano qui, non solo nella schermata: cosi' valgono anche
  // per chi chiama da altrove, e l'errore arriva prima di toccare il database.
  const err = perchePuoiNo(memberId, playerId, price);
  if (err.length) throw new Error(err.join(' · '));
  await remote.addRosterPlayer(base.league.id, memberId, playerId, price);
  await remote.updateMember(memberId, { credits: managersById.get(memberId).credits - price });
  await refresh();
}
export async function removeRosterPlayer(memberId, playerId) { const r = (base.rosters[memberId] || []).find((x) => x.playerId === playerId); await remote.removeRosterPlayer(base.league.id, playerId); if (r) await remote.updateMember(memberId, { credits: managersById.get(memberId).credits + r.pricePaid }); await refresh(); }
/** Popola il database con gli eventi di esempio delle prime giornate: solo Giudice Dati, una volta. */
export async function seedSampleData() { await remote.seedDemo(base, user.id); await refresh(); }
function hashStr(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

export const store = {
  get: () => ({ theme: prefs.theme, installedDismissed: prefs.installedDismissed, onboarded: prefs.onboarded,
    avvisi: prefs.avvisi, sfondoFoto: prefs.sfondoFoto !== false, avvisatoPer: prefs.avvisatoPer || 0 }),
  set: (patch) => { Object.assign(prefs, patch); persistPrefs(); notify(); },
};
export function resetAll() { localStorage.removeItem(PREFS_KEY); }
export const rules = () => base.league.rules;
export const now = () => new Date();

// ---------------------------------------------------------------- giornate
export function matchday(n) { return base.matchdays.find((m) => m.number === n); }
export function matchesOf(n) { return base.matches.filter((m) => m.matchday === n).map((m) => ({ ...m, ...(g.matchOverrides[m.id] || {}) })); }
export function match(id) { const m = base.matches.find((x) => x.id === id); return m ? { ...m, ...(g.matchOverrides[id] || {}) } : null; }
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
export const hasData = (n) => !!g.matchdayStatus[n]
  || matchesOf(n).some((m) => g.matchOverrides[m.id] || (g.matchEvents[m.id] || []).length);
export function nextMatchday() { const cur = currentMatchday(); return Math.min(30, hasData(cur) ? cur + 1 : cur); }
/**
 * La prima giornata per cui si fa ancora in tempo a consegnare.
 *
 * Non basta nextMatchday(): se il Giudice non ha ancora inserito i risultati,
 * quella resta indietro e il suo lock e' gia' passato — la schermata della
 * formazione risultava chiusa e i tasti dei moduli erano spenti, senza modo di
 * prepararsi per la giornata dopo. Qui si va avanti fino a trovarne una che si
 * chiude nel futuro; se non ce n'e' piu' nessuna (campionato finito) si torna a
 * quella normale, e la schermata dira' onestamente che e' chiusa.
 */
export function giornataDaSchierare() {
  const n0 = nextMatchday();
  for (let n = n0; n <= 30; n++) {
    const md = matchday(n);
    if (md && now() < new Date(md.lockAt)) return n;
  }
  return n0;
}
/** 'frozen' | 'provisional' | 'live' | 'open' | 'scheduled' */
/** Il calendario dei lock come lo vede l'app: e' quello che vale. */
export const calendarioLock = () => base.matchdays.map((md) => ({ matchday: md.number, lock_at: new Date(md.lockAt).toISOString() }));
/** Le giornate su cui il server applica una data diversa dalla nostra. */
export function lockDisallineati() {
  const srv = g.lockServer || {};
  return calendarioLock().filter((r) => {
    const v = srv[r.matchday];
    return !v || Math.abs(+new Date(v) - +new Date(r.lock_at)) > 60000;
  });
}
/** Quante giornate il server non ha ancora, o ha sbagliate. */
export const lockDaSistemare = () => lockDisallineati().length;

/**
 * Allinea il server al calendario dell'app. Il lock decide due cose che
 * contano — se puoi ancora schierare e se puoi vedere le formazioni altrui — e
 * finche' le due date differivano il server ne applicava una sbagliata di otto
 * giorni. Qui la fonte e' una sola: questa.
 */
let lockGiaSincronizzati = false; let lockInCorso = false;
export async function sincronizzaLock({ forza = false } = {}) {
  if (!isJudge()) throw new Error('Solo il Giudice Dati può aggiornare il calendario dei lock');
  const da = forza ? calendarioLock() : lockDisallineati();
  if (!da.length) return 0;
  const n = await remote.syncMatchdayLocks(forza ? calendarioLock() : da);
  lockGiaSincronizzati = true;
  await refresh();
  return n ?? da.length;
}

/**
 * C'e' una formazione da consegnare? → { giornata, lockAt, ore } oppure null.
 *
 * Il foglio delle notifiche promette da sempre "un avviso quando manca poco al
 * lock e non hai ancora schierato". Non c'era niente che lo facesse: ne' la
 * notifica ne' un avviso dentro l'app. Questa e' la parte che risponde alla
 * domanda, tenuta separata da chi la mostra.
 */
/** Iscrive o disiscrive questo dispositivo dalle push. */
export async function iscriviAvvisi() {
  const sub = await AV.iscriviPush();
  if (!sub || !user) return false;
  await remote.salvaPush(user.id, sub);
  return true;
}
export async function disiscriviAvvisi() {
  const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.ready.catch(() => null) : null;
  const sub = reg && reg.pushManager ? await reg.pushManager.getSubscription() : null;
  if (sub) { try { await remote.togliPush(sub.endpoint); } catch { /* gia' via */ } }
  return AV.disiscriviPush();
}

export function promemoriaFormazione() {
  const io = me(); if (!io) return null;
  const n = giornataDaSchierare(); const md = matchday(n); if (!md) return null;
  const st = matchdayStatus(n);
  if (st !== 'open' && st !== 'scheduled') return null;   // giornata gia' chiusa
  if (savedLineup(n, io.id)) return null;                  // consegnata
  if (!rosterIds(io.id).length) return null;               // rosa non assegnata: non e' colpa sua
  const ms = new Date(md.lockAt) - now();
  if (ms <= 0) return null;
  return { giornata: n, lockAt: md.lockAt, ore: ms / 3600000 };
}

export function matchdayStatus(n) {
  if (g.matchdayStatus[n]) return g.matchdayStatus[n];
  if (hasData(n)) return 'provisional';
  if (now() >= new Date(matchday(n).lockAt)) {
    // "Live in corso" solo finche' si gioca davvero. Prima bastava che il lock
    // fosse passato, quindi la 1a giornata restava "live" per sempre se in lega
    // non erano ancora stati caricati i voti: sullo schermo una giornata finita
    // tre settimane prima si annunciava in corso.
    const reali = matchesOf(n);
    const inCorso = !reali.length || reali.some((m) => m.status !== 'played');
    return inCorso ? 'live' : 'partial';
  }
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
export function lineupResult(n, managerId, isHome = false) { return memo(`lr:${n}:${managerId}:${isHome ? 'c' : 't'}`, () => { const lineup = lineupFor(n, managerId); return { lineup, ...computeLineupResult({ lineup, ratings: ratingsOf(n), players: playersById, managerCount: Math.max(6, base.league.managerCount), isHome, rules: rules() }) }; }); }
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
  const h = lineupResult(f.matchday, f.homeManagerId, true), a = lineupResult(f.matchday, f.awayManagerId);
  return { ...f, played: true, homeGoals: h.goals, awayGoals: a.goals, homeScore: h.total, awayScore: a.total, home: h, away: a, status: st };
}
export function resultsUntil(n) { const out = []; for (let k = 1; k <= n; k++) for (const f of fixturesOf(k)) { const r = fixtureResult(f); if (r.played) out.push(r); } return out; }
export function standings() { return memo('standings', () => computeStandings(base.managers, resultsUntil(currentMatchday()), rules())); }
/**
 * La classifica com'era PRIMA della giornata n, per dire di quanto ci si e'
 * mossi. Con n = 1 non c'e' niente prima: torna tutti a zero, e le frecce
 * infatti non compaiono.
 */
export function standingsPrima(n) { return memo(`stPrima:${n}`, () => computeStandings(base.managers, resultsUntil(n - 1), rules())); }
/**
 * Quanto manca alla giornata: quante partite del campionato hanno gia' un
 * risultato. Serve a dire se la classifica che si sta guardando e' ancora
 * una proiezione o e' quella buona.
 */
export function avanzamento(n) {
  const partite = matchesOf(n);
  const fatte = partite.filter((m) => m.status === 'played' || m.status === 'postponed').length;
  return { fatte, totali: partite.length, completa: partite.length > 0 && fatte === partite.length };
}
export function myFixture(n, managerId) { return fixturesOf(n).find((f) => f.homeManagerId === managerId || f.awayManagerId === managerId) || null; }

// ---------------------------------------------------------------- scambi
export const scambi = () => L.scambi || [];
export const scambiDisponibili = () => L.scambiDisponibili !== false;
/** Le proposte che aspettano una risposta da me. */
export function scambiDaDecidere() {
  const io = me()?.id; if (!io) return [];
  return scambi().filter((t) => t.stato === 'proposta' && t.a === io);
}
/** Le proposte che ho fatto io e che nessuno ha ancora deciso. */
export function scambiInAttesa() {
  const io = me()?.id; if (!io) return [];
  return scambi().filter((t) => t.stato === 'proposta' && t.da === io);
}
export async function proponiScambio(aMember, offre, chiede, crediti, nota) {
  const id = await remote.proponiScambio(base.league.id, aMember, offre, chiede, crediti, nota);
  await refresh(); return id;
}
export async function accettaScambio(id) { await remote.accettaScambio(id); await refresh(); }
export async function rifiutaScambio(id) { await remote.rifiutaScambio(id); await refresh(); }
export async function annullaScambio(id) { await remote.annullaScambio(id); await refresh(); }

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
