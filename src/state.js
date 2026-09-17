/**
 * Stato applicativo. Un solo backend: Supabase.
 * - Anagrafiche e calendario: generati dal client (src/data.js), uguali per tutte le leghe.
 * - Dato del campionato (risultati, presenze, eventi, congelamenti): globale, scritto dal Giudice Dati.
 * - Lega: membri, rose, formazioni, contestazioni.
 * Tutto ciò che il motore calcola è derivato e ricalcolabile da zero.
 */
import { buildSeason, draftRosters as buildDraft, mulberry32 } from './data.js';
import { computeRating, computeLineupResult, computeStandings, defaultLineup, validaAcquisto, offertaMassima, DEFAULT_RULES , recordLega as computeRecord, testaATesta as computeH2H, esitoScontro, classificaPunti as computeClassificaPunti, premiAssegnati as computePremi } from './engine.js';
import * as remote from './backend.js';
import * as clerk from './auth-clerk.js';
import * as AV from './notifiche.js';

const PREFS_KEY = 'fcs:prefs';
export const base = buildSeason();
export const playersById = new Map(base.players.map((p) => [p.id, p]));
export const clubsById = new Map(base.clubs.map((c) => [c.id, c]));
export const managersById = new Map();
const NO_LEAGUE = { id: null, name: 'Fantatitano', shortName: 'Fantatitano', rules: { ...DEFAULT_RULES }, managerCount: 0 };
base.league = NO_LEAGUE; base.managers = []; base.rosters = {};

let user = null, prof = null, leagues = [];
let g = emptyGlobal(); let L = emptyLeague();
let ready = false, connError = null;
let prefs = load(PREFS_KEY, { theme: 'system', installedDismissed: false, currentLeagueId: null, onboarded: false, sfondoFoto: true });
let onError = (e) => console.error(e);
export function setErrorHandler(fn) { onError = fn; }

function emptyGlobal() { return { matchEvents: {}, matchOverrides: {}, appearanceOverrides: {}, matchdayStatus: {}, lockServer: {}, changeLog: [] }; }
function emptyLeague() { return { lineups: {}, contestazioni: [], scambi: [], offerte: [] }; }
function load(key, def) { try { const raw = localStorage.getItem(key); return raw ? { ...def, ...JSON.parse(raw) } : { ...def }; } catch { return { ...def }; } }
function persistPrefs() { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* quota */ } }
function refreshManagers() { managersById.clear(); for (const m of base.managers) managersById.set(m.id, m); }

const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
const cache = new Map();
function notify() { cache.clear(); listeners.forEach((fn) => fn()); }
const memo = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };

// ---------------------------------------------------------------- avvio
/** 'unconfigured' | 'offline' | 'anonymous' | 'sospeso' | 'no-league' | 'ready' */
export function appState() {
  if (!remote.isConfigured()) return 'unconfigured';
  if (!ready) return 'offline';
  if (!user) return 'anonymous';
  // Sospeso: prima di qualunque lega. Nel database non puo' schierare ne'
  // contestare (015) e vedrebbe l'app funzionare a meta', con errori che non
  // spiegano niente; qui glielo si dice in faccia una volta.
  if (prof?.sospeso) return 'sospeso';
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
    L = { lineups: data.lineups, contestazioni: data.contestazioni, scambi: [], offerte: [] };
    // Gli scambi arrivano dalla 006: su un progetto che non l'ha ancora
    // applicata la tabella non c'e', e l'app deve funzionare comunque —
    // senza la scheda Scambi, non con una schermata di errore.
    try { L.scambi = await remote.loadScambi(prefs.currentLeagueId); L.scambiDisponibili = true; }
    catch { L.scambi = []; L.scambiDisponibili = false; }
    // Le finestre del mercato le chiude chi apre l'app: nessuno ha un server
    // che gira di notte. La funzione e' ripetibile e a finestre non scadute
    // non fa niente, quindi chiamarla a ogni caricamento non costa.
    try {
      L.offerte = await remote.loadOfferte(prefs.currentLeagueId);
      L.mercatoDisponibile = true;
      if (L.offerte.some((o) => o.stato === 'aperta' && new Date(o.scadeAt) <= now())) {
        const quanti = await remote.risolviOfferte(prefs.currentLeagueId);
        if (quanti) {
          const d = await remote.loadLeague(prefs.currentLeagueId);
          base.managers = d.managers; base.rosters = d.rosters;
          base.league = { ...base.league, managerCount: d.managers.length };
          L.offerte = await remote.loadOfferte(prefs.currentLeagueId);
        }
      }
    } catch { L.offerte = []; L.mercatoDisponibile = false; }
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
/**
 * Cambiare il nome dell'account, che e' il nome e basta.
 *
 * L'app mostra il nome del profilo in ogni schermata, quindi cambiarlo qui
 * si vede subito. La seconda riga riallinea la copia dentro league_members,
 * che non serve a mostrarlo ma resta scritta nel database: una copia vecchia
 * salterebbe fuori dove si legge quella (le contestazioni) o da un client
 * non aggiornato.
 */
export async function updateDisplayName(name) {
  await remote.updateProfile(user.id, { display_name: name });
  // se le righe non si aggiornano il nome si vede lo stesso: non e' un motivo
  // per far fallire la modifica
  await remote.rinominaNelleLeghe(user.id, name).catch(() => {});
  await refresh();
}
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
/**
 * Chi amministra l'APP, che e' un terzo ruolo e non va confuso con gli altri
 * due: is_judge riguarda il dato del campionato, role='admin' riguarda UNA
 * lega, questo riguarda il servizio — chi apre le leghe pubbliche, chi nomina
 * gli altri, chi guarda i numeri. Il primo si nomina a mano in SQL: se si
 * potesse dall'app, il primo che passa si darebbe i poteri da solo.
 */
export const isAdmin = () => !!prof?.is_admin;
/** Lega aperta a tutti: rose non esclusive, classifica a punti (013). */
export const legaPubblica = () => !!base.league.pubblica;
/** La classifica si fa sommando i fantapunti invece che con gli scontri. */
export const aPunti = () => base.league.classifica === 'punti';
export const premi = () => base.league.premi || [];
export const maxMembri = () => base.league.maxMembri || 12;
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
// --- lega pubblica (013)
export async function creaLegaPubblica(name, teamName, color, initials, { budget = 500, max = 200, premi: pr = [] } = {}) {
  const id = await remote.creaLegaPubblica(name, name, teamName, color, initials, budget, max, pr);
  await switchLeague(id);
  return id;
}
export async function entraLegaPubblica(id, teamName, color, initials) {
  await remote.entraLegaPubblica(id, teamName, color, initials);
  await switchLeague(id);
  return id;
}
export const leghePubbliche = () => remote.leghePubbliche();

// --- console amministrativa (014)
export const adminRiepilogo = () => remote.adminRiepilogo();
export const adminPersone = (cerca, limite) => remote.adminPersone(cerca, limite);
export const adminLeghe = (limite) => remote.adminLeghe(limite);
// --- moderazione (015)
export const adminSquadre = (cerca, limite) => remote.adminSquadre(cerca, limite);
export const adminRinomina = (memberId, squadra, fantallenatore) => remote.adminRinomina(memberId, squadra, fantallenatore);
export async function adminSospendi(userId, on) {
  await remote.adminSospendi(userId, on);
  if (userId === user?.id) { prof = await remote.profile(user.id) || prof; notify(); }
}
/** Sospeso: l'app glielo dice e non lo lascia giocare (la 015 lo impedisce anche nel database). */
export const sospeso = () => !!prof?.sospeso;
export async function adminImpostaRuolo(userId, ruolo, on) {
  await remote.adminImpostaRuolo(userId, ruolo, on);
  // Se ho cambiato qualcosa a ME, il mio profilo in memoria e' vecchio.
  if (userId === user?.id) { prof = await remote.profile(user.id) || prof; notify(); }
}
/**
 * Il link per reimpostare la password, mandato all'indirizzo di chi ha
 * chiesto aiuto.
 *
 * E' tutto quello che si puo' fare, e va detto: leggere o scrivere la
 * password di un altro richiede la chiave di servizio di Supabase, che nel
 * frontend non deve stare — sarebbe come consegnare le chiavi del database a
 * ogni telefono. Il link arriva alla persona e se la reimposta lei, che e'
 * anche l'unico modo in cui resta sua.
 */
export const mandaResetPassword = (email) => remote.resetPassword(email, returnUrl());

/**
 * L'elenco delle pubbliche tenuto in memoria, per chi lo deve leggere senza
 * aspettare: la dashboard si disegna tutta insieme e non puo' fermarsi su una
 * richiesta di rete.
 *
 * Si chiede UNA volta per apertura dell'app. Chi chiama passa cosa fare
 * quando arriva, e nel frattempo legge null, che vuol dire "non lo so
 * ancora" e non "non ce n'e'": sono due cose diverse e un banner che lampeggia
 * a ogni ridisegno nasce dal confonderle.
 */
let cachePubbliche = null; let inVolo = false;
export const pubblicheInCache = () => cachePubbliche;
export function caricaPubbliche(poi) {
  if (cachePubbliche || inVolo || !user) return;
  inVolo = true;
  remote.leghePubbliche()
    .then((l) => { cachePubbliche = l || []; if (poi) poi(); })
    .catch(() => { cachePubbliche = []; })
    .finally(() => { inVolo = false; });
}
/**
 * La lega pubblica da mettere in vetrina a chi sta in una lega fra amici.
 *
 * Non solo quelle in cui non e' ancora dentro: se c'e' gia' iscritto, il
 * banner serve lo stesso — porta nella lega pubblica invece di invitarlo a
 * entrarci, e il campo `dentro` dice quale delle due cose. Prima le righe
 * `dentro` erano scartate, e chi come Alex era iscritto alla pubblica non
 * vedeva niente dalle sue leghe private.
 *
 * Null quando non c'e' niente da mostrare — compresa l'attesa della
 * risposta dal server.
 */
export function pubblicaInVetrina() {
  if (legaPubblica() || !cachePubbliche) return null;
  // al completo si puo' solo guardarla, e non ha senso proporla; se ci sei
  // dentro il numero di posti non conta
  const buone = cachePubbliche.filter((l) => l.dentro || l.membri < l.max_membri);
  if (!buone.length) return null;
  const premio = (l) => (l.premi || []).slice().sort((a, b) => a.posto - b.posto)[0] || null;
  // Col premio davanti: e' quello che fa venire voglia di entrare. Poi la
  // propria, che e' quella che si vuole aprire; e fra due leghe senza premio
  // la piu' popolata, che e' quella che sta partendo.
  return buone.slice().sort((a, b) => (premio(b) ? 1 : 0) - (premio(a) ? 1 : 0)
    || (b.dentro ? 1 : 0) - (a.dentro ? 1 : 0) || b.membri - a.membri)[0];
}
export async function salvaPremi(pr) {
  const v = await remote.impostaPremi(base.league.id, pr);
  base.league.premi = v; notify();
  return v;
}

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
    // Nella lega pubblica un giocatore non e' di nessuno: sta nella rosa di
    // chi lo vuole. Senza questo, dal ventesimo iscritto non resterebbero
    // piu' portieri, e il vincolo nel database l'abbiamo tolto proprio per
    // questo (013). Le altre regole — caselle per ruolo, crediti, doppioni
    // nella PROPRIA rosa — valgono identiche.
    giaPreso: !legaPubblica() && !!pr && pr.managerId !== managerId,
    rules: rules() });
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
/**
 * Il risultato di una partita di campionato e' della FSGC, non nostro.
 *
 * Le sovrascritture (match_overrides) servono per lo STATO — rinviata,
 * sospesa, a tavolino (art. 10) — che il sito della federazione non dice e
 * che cambia come si calcolano i voti. I gol no: quelli arrivano dall'import
 * e l'import li rilegge a ogni giro, quindi una correzione a mano durerebbe
 * fino al giro dopo e poi tornerebbe indietro da sola.
 *
 * Qui i gol della sovrascrittura si BUTTANO. Non e' solo pulizia: sul
 * database di Alex ce n'era una con i gol ospiti nulli, e la giornata
 * mostrava "3 - null". Ignorandoli, righe come quella smettono di fare danno
 * senza che nessuno debba andare a cancellarle.
 */
const senzaGol = (o) => { if (!o) return null; const { homeGoals: _h, awayGoals: _a, ...resto } = o; return resto; };
const conFSGC = (m) => ({ ...m, ...(senzaGol(g.matchOverrides[m.id]) || {}), homeGoals: m.realHomeGoals, awayGoals: m.realAwayGoals });
export function matchesOf(n) { return base.matches.filter((m) => m.matchday === n).map(conFSGC); }
export function match(id) { const m = base.matches.find((x) => x.id === id); return m ? conFSGC(m) : null; }
export function eventsOf(matchId) { return g.matchEvents[matchId] || []; }
export function appearancesOf(matchId) { return g.appearanceOverrides[matchId] || []; }

/**
 * La prima giornata che si chiude nel futuro: quella su cui si puo' ancora
 * agire. Viene dal CALENDARIO e da nient'altro, e per questo non si pianta.
 *
 * Campionato finito, nessun lock nel futuro: si resta sulla trentesima, e le
 * schermate diranno onestamente che e' chiusa.
 */
export function giornataAperta() {
  return memo('aperta', () => {
    for (const md of base.matchdays) if (now() < new Date(md.lockAt)) return md.number;
    return 30;
  });
}
/**
 * LA PRIMA GIORNATA DI QUESTA LEGA.
 *
 * Una lega nata il 16 settembre non ha una prima, una seconda e una terza
 * giornata: quelle sono successe prima che esistesse. La dashboard di Alex
 * chiedeva di calcolare la terza — "mancano gli eventi di 8 partite su 8" —
 * per una giornata che la sua lega non ha mai giocato.
 *
 * E' la prima giornata che era ancora APERTA quando la lega e' stata creata:
 * se il lock era gia' passato, quella giornata non si poteva piu' schierare,
 * quindi non e' sua. Si ricava dalla data di creazione e non da una colonna
 * in piu': cosi' vale anche per le leghe che esistono gia', senza chiedere a
 * nessuno di caricare niente.
 *
 * Senza data di creazione (lega non caricata, prove) si parte dalla prima.
 */
export function primaGiornata() {
  return memo('prima', () => {
    const nata = base.league.createdAt ? new Date(base.league.createdAt) : null;
    if (!nata || Number.isNaN(+nata)) return 1;
    for (const md of base.matchdays) if (nata < new Date(md.lockAt)) return md.number;
    return 30;
  });
}

/**
 * La giornata in cui siamo: l'ultima cominciata.
 *
 * Prima era "l'ultima che ha dati inseriti", e si piantava. Il 17 settembre,
 * con tre giornate di campionato giocate e nessun voto ancora caricato in
 * lega, l'app era ferma alla prima: la dashboard annunciava "Giornata 1" e il
 * pre-match diceva "si chiude ven 28/8", una data di tre settimane prima.
 *
 * Il guasto era la definizione, non il calcolo: quale giornata si sta giocando
 * lo dice il calendario, non chi ha avuto tempo di inserire i referti. Adesso
 * e' la piu' avanti fra le due — l'ultima col lock passato e l'ultima con dei
 * dati — cosi' un inserimento in ritardo non la fa mai tornare indietro.
 *
 * Non produce risultati dal nulla: fixtureResult() guarda hasData() giornata
 * per giornata, quindi una giornata cominciata e senza referto resta "da
 * giocare" e fuori dalla classifica.
 */
export function currentMatchday() {
  return memo('current', () => {
    let n = 0;
    for (const id in g.matchOverrides) { const k = +((id.match(/^md(\d+)/) || [])[1]); if (k > n) n = k; }
    for (const k in g.matchdayStatus) if (+k > n) n = +k;
    return Math.max(1, n, giornataAperta() - 1);
  });
}
export const hasData = (n) => !!g.matchdayStatus[n]
  || matchesOf(n).some((m) => g.matchOverrides[m.id] || (g.matchEvents[m.id] || []).length);
/**
 * La prossima da giocare. E' la prima ancora aperta: passato il lock non c'e'
 * piu' niente da fare su quella giornata, che i suoi voti siano arrivati o no.
 */
export function nextMatchday() { return giornataAperta(); }
/** La giornata per cui si fa ancora in tempo a consegnare. */
export function giornataDaSchierare() { return giornataAperta(); }
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
  for (let k = n - 1; k >= primaGiornata(); k--) { const prev = L.lineups[`${k}:${managerId}`]; if (prev) return { ...prev, source: `giornata ${k}` }; }
  return { ...defaultLineup(rosterIds(managerId).filter((id) => playersById.get(id).isActive), playersById), source: 'ufficio' };
}
export function saveLineup(n, managerId, lineup) {
  const rec = { ...lineup, submittedAt: now().toISOString() }; L.lineups[`${n}:${managerId}`] = rec; notify();
  return remote.upsertLineup(base.league.id, managerId, n, rec).catch((e) => { onError(e); refresh(); });
}
/**
 * Il punteggio di una squadra in una giornata, dalla formazione CONSEGNATA.
 * Senza consegna torna null: la partita e' persa a tavolino (art. 8.4) e a
 * dirlo e' esitoScontro(). lineupFor(), che ripiega sull'ultima schierata o
 * sull'undici d'ufficio, serve solo all'editor e alle probabili: qui non
 * entra piu', perche' una formazione mai consegnata non fa punti.
 */
export function lineupResult(n, managerId, isHome = false) { return memo(`lr:${n}:${managerId}:${isHome ? 'c' : 't'}`, () => { const lineup = savedLineup(n, managerId); if (!lineup) return null; return { lineup, ...computeLineupResult({ lineup, ratings: ratingsOf(n), players: playersById, managerCount: Math.max(6, base.league.managerCount), isHome, rules: rules() }) }; }); }
export function fixturesOf(n) {
  return memo(`fx:${n}`, () => {
    // In una lega a punti non ci sono scontri diretti: si gioca contro tutti
    // insieme. Tornare un elenco vuoto e' quello che spegne calendario,
    // pre-match e scheda, che hanno tutti la loro via per "nessuna partita".
    if (aPunti()) return [];
    // Prima che la lega nascesse non ci sono suoi incontri: il calendario si
    // fa dalla sua prima giornata in avanti.
    if (n < primaGiornata()) return [];
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
  return { ...f, played: true, ...esitoScontro(h, a, rules()), status: st };
}
export function resultsUntil(n) { const out = []; for (let k = primaGiornata(); k <= n; k++) for (const f of fixturesOf(k)) { const r = fixtureResult(f); if (r.played) out.push(r); } return out; }
/**
 * I fantapunti di una squadra in una giornata, per la classifica a punti.
 * Senza formazione consegnata sono zero e la giornata conta come giocata: e'
 * la stessa regola del tavolino (art. 8.4) vista da una lega senza avversari.
 */
export function puntiGiornata(n, managerId) {
  const r = lineupResult(n, managerId);
  return r ? r.total : 0;
}
/** Le righe (squadra, giornata, punti) di tutte le giornate con i dati. */
function righePunti(fino) {
  const out = [];
  for (let k = primaGiornata(); k <= fino; k++) {
    if (!hasData(k)) continue;
    const st = matchdayStatus(k); if (st === 'open' || st === 'scheduled') continue;
    for (const m of base.managers) out.push({ managerId: m.id, matchday: k, punti: puntiGiornata(k, m.id) });
  }
  return out;
}
export function classificaAPunti(fino = currentMatchday()) {
  return memo(`cp:${fino}`, () => computeClassificaPunti(base.managers, righePunti(fino)));
}
/** La classifica della lega, nel modo che quella lega usa. */
export function standings() {
  return memo('standings', () => (aPunti()
    ? classificaAPunti(currentMatchday())
    : computeStandings(base.managers, resultsUntil(currentMatchday()), rules())));
}
/** I premi in palio con chi li sta vincendo adesso. */
export function premiOra() { return memo('premi', () => computePremi(premi(), standings())); }
/**
 * La classifica com'era PRIMA della giornata n, per dire di quanto ci si e'
 * mossi. Con n = 1 non c'e' niente prima: torna tutti a zero, e le frecce
 * infatti non compaiono.
 */
export function standingsPrima(n) {
  return memo(`stPrima:${n}`, () => (aPunti()
    ? classificaAPunti(n - 1)
    : computeStandings(base.managers, resultsUntil(n - 1), rules())));
}
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
/** I record della lega, su tutto quello che e' stato giocato finora. */
export function record() { return memo('record', () => computeRecord(resultsUntil(currentMatchday()))); }
/** Lo storico fra due squadre. */
export function h2h(a, b) { return memo(`h2h:${a}:${b}`, () => computeH2H(resultsUntil(currentMatchday()), a, b)); }
export function myFixture(n, managerId) { return fixturesOf(n).find((f) => f.homeManagerId === managerId || f.awayManagerId === managerId) || null; }

/**
 * Il rendimento di un giocatore fin qui: medie, bonus e le ultime giornate.
 *
 * Serve a decidere chi schierare, che e' la domanda che si fa ogni settimana e
 * a cui l'app non rispondeva: la scheda del giocatore elencava le giornate una
 * per una e la media, ma per confrontare due nomi bisognava aprire due
 * schermate e tenere i numeri a mente.
 *
 * @param {string} playerId
 * @param {number} [fino] ultima giornata da contare (default: quella corrente)
 */
export function rendimento(playerId, fino = currentMatchday()) {
  return memo(`rend:${playerId}:${fino}`, () => {
    const p = playersById.get(playerId);
    const giornate = [];
    let somma = 0, sommaBase = 0, presenze = 0, minuti = 0;
    const ev = { goal: 0, assist: 0, assist_set: 0, own_goal: 0, yellow: 0, second_yellow: 0, red_direct: 0, pen_saved: 0, pen_missed: 0, pen_won: 0, pen_conceded: 0 };
    for (let n = 1; n <= fino; n++) {
      const r = ratingsOf(n).get(playerId);
      const m = matchesOf(n).find((x) => p && (x.homeClubId === p.clubId || x.awayClubId === p.clubId));
      // Una giornata senza partita della sua squadra (riposo, rinvio) non e'
      // un'assenza: non entra nel conto e non finisce nel grafico.
      if (!m || m.status === 'scheduled') continue;
      const suoi = r ? eventsOf(m.id).filter((e) => e.playerId === playerId) : [];
      for (const e of suoi) if (e.type in ev) ev[e.type]++;
      if (r && !r.isSV) {
        presenze++; somma = Math.round((somma + r.fantaVote) * 10) / 10;
        sommaBase = Math.round((sommaBase + r.baseVote) * 10) / 10;
        minuti += r.minutes || 0;
        giornate.push({ n, fv: r.fantaVote, base: r.baseVote, sv: false, minuti: r.minutes || 0 });
      } else if (m.status === 'played') {
        giornate.push({ n, fv: null, base: null, sv: true, minuti: 0 });
      }
    }
    const media = presenze ? Math.round((somma / presenze) * 100) / 100 : null;
    const mediaBase = presenze ? Math.round((sommaBase / presenze) * 100) / 100 : null;
    // La tendenza guarda le ultime cinque giornate in cui la sua squadra ha
    // giocato, non le ultime cinque presenze: se e' stato fuori tre volte
    // conta, e nasconderlo darebbe una media falsamente buona.
    const ultime = giornate.slice(-5);
    const conVoto = ultime.filter((x) => !x.sv);
    const mediaUltime = conVoto.length ? Math.round((conVoto.reduce((s, x) => s + x.fv, 0) / conVoto.length) * 100) / 100 : null;
    return {
      player: p, presenze, giocabili: giornate.length, minuti, media, mediaBase, somma,
      eventi: ev, giornate, ultime, mediaUltime,
      // quanto scarta la forma recente dalla media stagionale
      scarto: media !== null && mediaUltime !== null ? Math.round((mediaUltime - media) * 100) / 100 : null,
    };
  });
}

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

// ------------------------------------------------------- mercato svincolati
export const offerte = () => L.offerte || [];
export const mercatoDisponibile = () => L.mercatoDisponibile !== false;
/** Chi non e' in nessuna rosa della lega. */
export function svincolati() {
  return memo('svincolati', () => {
    const presi = new Set();
    for (const m of base.managers) for (const r of (base.rosters[m.id] || [])) presi.add(r.playerId);
    return base.players.filter((p) => p.isActive && !presi.has(p.id));
  });
}
/** Le offerte aperte su un giocatore, dalla piu' alta. */
export function offertePer(playerId) {
  return offerte().filter((o) => o.playerId === playerId && o.stato === 'aperta')
    .sort((a, b) => b.crediti - a.crediti || new Date(a.creataAt) - new Date(b.creataAt));
}
/** I giocatori con una finestra aperta, quella che scade prima davanti. */
export function finestreAperte() {
  const per = new Map();
  for (const o of offerte()) {
    if (o.stato !== 'aperta') continue;
    const x = per.get(o.playerId);
    if (!x || o.crediti > x.migliore.crediti) per.set(o.playerId, { playerId: o.playerId, migliore: o, scadeAt: o.scadeAt });
  }
  return [...per.values()].map((x) => ({ ...x, offerte: offertePer(x.playerId) }))
    .sort((a, b) => new Date(a.scadeAt) - new Date(b.scadeAt));
}
export const mieOfferte = () => { const io = me()?.id; return io ? offerte().filter((o) => o.member === io && o.stato === 'aperta') : []; };
/** Quanti crediti sono gia' impegnati in offerte aperte. */
export const impegnati = () => mieOfferte().reduce((s, o) => s + o.crediti, 0);
export async function offri(playerId, crediti) { await remote.offri(base.league.id, playerId, crediti); await refresh(); }
export async function ritiraOfferta(id) { await remote.ritiraOfferta(id); await refresh(); }

// ---------------------------------------------------------------- Giudice Dati
const assertOpen = (matchId) => { const m = match(matchId); if (isFrozen(m.matchday)) throw new Error(`Giornata ${m.matchday} congelata (art. 9.2)`); return m; };
const write = (fn) => fn().catch((e) => { onError(e); refresh(); });
export function setMatch(matchId, patch) {
  assertOpen(matchId);
  // I gol non passano, da nessun chiamante. La schermata non li offre piu',
  // ma la regola sta qui perche' e' qui che vale: e' il punto dove si scrive,
  // e le regole messe solo nella schermata valgono solo per quella schermata.
  const { homeGoals: _h, awayGoals: _a, ...pulito } = patch;
  const next = { ...(g.matchOverrides[matchId] || {}), ...pulito }; g.matchOverrides[matchId] = next; notify();
  return write(() => remote.upsertMatch(matchId, next, user.id));
}
export function setAppearances(matchId, list) { assertOpen(matchId); g.appearanceOverrides[matchId] = list; notify(); return write(() => remote.replaceAppearances(matchId, list)); }
export function addEvent(matchId, ev) {
  assertOpen(matchId); const tmp = { id: `tmp${Date.now()}`, matchId, ...ev };
  g.matchEvents[matchId] = [...eventsOf(matchId), tmp].sort((a, b) => a.minute - b.minute); notify();
  return write(async () => { const row = await remote.insertEvent(matchId, ev, user.id); g.matchEvents[matchId] = g.matchEvents[matchId].map((e) => (e.id === tmp.id ? { ...e, id: row.id } : e)); });
}
export function removeEvent(matchId, eventId) { assertOpen(matchId); g.matchEvents[matchId] = eventsOf(matchId).filter((e) => e.id !== eventId); notify(); return write(() => remote.deleteEvent(eventId)); }
/**
 * La giornata e' pronta per essere chiusa?
 *
 * Serve che le partite siano finite e che di OGNUNA ci siano gli eventi: senza
 * questo controllo si chiuderebbe una giornata a meta', e l'art. 9.2 dice che
 * dopo non si rettifica piu'. Il database rifiuta comunque una giornata senza
 * nessun evento, ma quante partite abbia una giornata lo sa solo qui, che ha
 * il calendario.
 */
export function giornataDaChiudere(n = currentMatchday()) {
  // Una giornata prima della nascita della lega non e' roba sua: chiederne i
  // voti vorrebbe dire chiedere di calcolare una partita che non ha giocato.
  // Il dato del campionato e' globale e quella giornata puo' restare da
  // congelare per il Giudice: e' un altro mestiere, e ha la sua pagina.
  if (n < primaGiornata()) return null;
  const st = matchdayStatus(n);
  if (st === 'frozen' || st === 'open' || st === 'scheduled') return null;
  const partite = matchesOf(n);
  if (!partite.length) return null;
  const senza = partite.filter((m) => !(g.matchEvents[m.id] || []).length && !g.matchOverrides[m.id]);
  return { giornata: n, pronta: senza.length === 0, mancanti: senza.length, partite: partite.length };
}

/** Chiude la giornata. Lo stato locale si aggiorna solo se il server dice di si'. */
/**
 * Cancella il profilo di chi e' entrato.
 *
 * Non tocca niente in memoria: chi chiama fa uscire l'utente subito dopo, e
 * al prossimo accesso non c'e' piu' niente da caricare. Aggiornare lo stato
 * locale di un account che non esiste piu' sarebbe lavoro per nessuno.
 */
export async function eliminaProfilo() {
  return remote.eliminaProfilo();
}

export async function chiudiGiornata(n = currentMatchday()) {
  await remote.chiudiGiornata(n);
  g.matchdayStatus[n] = 'frozen';
  notify();
}

export function freezeMatchday(n) { g.matchdayStatus[n] = 'frozen'; notify(); return write(() => remote.setMatchdayStatus(n, 'frozen', user.id)); }
export function reopenMatchday(n) { delete g.matchdayStatus[n]; notify(); return write(() => remote.setMatchdayStatus(n, null, user.id)); }
export function addContestazione(c) {
  const rec = { id: `tmp${Date.now()}`, at: now().toISOString(), by: me()?.id, status: 'open', ...c }; L.contestazioni.unshift(rec); notify();
  return write(async () => { const row = await remote.insertContestazione(base.league.id, me().id, c); rec.id = row.id; });
}
export function resolveContestazione(id, status, note) { L.contestazioni = L.contestazioni.map((c) => (c.id === id ? { ...c, status, note, resolvedAt: now().toISOString() } : c)); notify(); return write(() => remote.resolveContestazione(id, status, note)); }
export function changeLog() { return g.changeLog; }
export function contestazioni() { return L.contestazioni; }
