/**
 * Il FantaFutsal sul server (supabase/migrations/futsal-01, futsal-02).
 *
 * Un archivio piccolo e separato da state.js: il futsal non ha leghe di
 * calcio, rose ne' giornate in comune col calcio, e tenerlo fuori vuol dire
 * che finche' la sezione e' spenta non parte nemmeno una richiesta in piu'.
 *
 * Se le migrazioni futsal non sono ancora sul database, le tabelle non
 * esistono: lo si dice (attivo = false) e la formazione resta sul telefono,
 * come nella prima versione.
 */
import * as remote from './backend.js';
import * as S from './state.js';
import * as F from './futsal.js';
import { punteggioFormazione } from './futsal-engine.js';
import { bilancio } from './futsal-valori.js';

const PAGINA = 1000;
/** Tutte le righe, una pagina alla volta; la prima risposta con errore si restituisce così com'è. */
async function aPagine(richiesta) {
  const data = [];
  for (let da = 0; ; da += PAGINA) {
    const r = await richiesta().range(da, da + PAGINA - 1);
    if (r.error) return r;
    data.push(...(r.data || []));
    if ((r.data || []).length < PAGINA) return { data, error: null };
  }
}
const vuoto = () => ({ caricato: false, inCorso: false, attivo: true, errore: null, iscritti: [], formazioni: new Map(), leghe: [], membri: [] });
let st = vuoto(), per = null;
const ascolta = new Set();
export const stato = () => st;
export function quandoCambia(fn) { ascolta.add(fn); return () => ascolta.delete(fn); }
const avvisa = () => { calcoli.clear(); ascolta.forEach((f) => f()); };

const uid = () => S.currentUser()?.id || null;
const manca = (e) => e && (e.code === '42P01' || e.code === 'PGRST205' || /does not exist|schema cache|could not find/i.test(e.message || ''));

/** Carica tutto quello che serve alle schermate del futsal. Una volta, poi su richiesta. */
export async function carica({ forza = false } = {}) {
  const sb = remote.client();
  if (!sb || !uid() || st.inCorso || (st.caricato && !forza && per === uid())) return;
  st.inCorso = true; per = uid();
  try {
    // a pagine da 1000 righe: oltre, Supabase taglia SENZA errore (backend.js, tutte()), e con
    // 150 iscritti le formazioni di 7 giornate sono già di più: classifiche diverse da telefono a telefono
    const [isc, form, leghe, membri] = await Promise.all([
      aPagine(() => sb.from('futsal_iscritti').select('*').order('user_id')),
      aPagine(() => sb.from('futsal_formazioni').select('*').order('giornata').order('user_id')),
      aPagine(() => sb.from('futsal_leghe').select('*').order('id')),
      aPagine(() => sb.from('futsal_membri').select('*').order('lega_id').order('user_id'))]);
    const errore = [isc, form, leghe, membri].map((r) => r.error).find(Boolean);
    if (manca(errore)) st = { ...vuoto(), caricato: true, attivo: false };
    else if (errore) st = { ...st, caricato: true, errore: errore.message };
    else {
      st = { ...vuoto(), caricato: true, iscritti: isc.data || [], leghe: leghe.data || [], membri: membri.data || [],
        formazioni: new Map((form.data || []).map((r) => [`${r.giornata}:${r.user_id}`, r])) };
    }
  } catch (e) { st = { ...st, caricato: true, errore: e.message }; }
  st.inCorso = false;
  caricataAlle = Date.now();
  programmaAllaChiusura();
  avvisa();
  if (forza) ricaricati.forEach((f) => f());
}

// ---------------------------------------------------------------- dati freschi senza riaprire l'app
// Le formazioni degli altri si vedono solo a giornata chiusa (RLS): si ricarica
// un minuto dopo ogni chiusura, e quando l'app torna in primo piano dopo più
// di due minuti (una PWA sospesa riparte com'era).
let caricataAlle = 0, timerChiusura = null;
const ricaricati = new Set();
/** fn() dopo ogni ricarica automatica (chiusura, ritorno in primo piano). */
export function quandoRicarica(fn) { ricaricati.add(fn); return () => ricaricati.delete(fn); }
function programmaAllaChiusura() {
  clearTimeout(timerChiusura);
  const ora = Date.now();
  for (let n = 1; n <= F.GIORNATE; n++) {
    const c = F.chiusura(n);
    if (c && c.getTime() > ora) {
      const ms = c.getTime() - ora + 60e3;
      if (ms < 2 ** 31 - 1) timerChiusura = setTimeout(() => carica({ forza: true }), ms);
      return;
    }
  }
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && st.caricato && Date.now() - caricataAlle > 120e3) carica({ forza: true });
  });
}

export const io = () => st.iscritti.find((x) => x.user_id === uid()) || null;
export const iscritto = (id) => st.iscritti.find((x) => x.user_id === id);
export const formazioneDi = (g, id = uid()) => st.formazioni.get(`${g}:${id}`)?.formazione || null;
/**
 * La squadra in vigore alla giornata g: l'ultima consegnata fino a g (la rosa
 * resta da una giornata all'altra, FUTSAL.md § 13). Solo il formato nuovo:
 * una formazione della prima versione (senza rosa) non vale piu'.
 */
export function inVigore(g, id = uid()) {
  for (let k = g; k >= 1; k--) { const f = formazioneDi(k, id); if (f?.D) return f; }
  return null;
}
/** Crediti, cambi e malus di un iscritto alla giornata g (src/futsal-valori.js). bozza: la rosa che si sta per consegnare. */
export const bilancioDi = (g, id = uid(), bozza = undefined) => bilancio((k) => inVigore(k, id), g, bozza);
export const consegnataAlle = (g, id = uid()) => st.formazioni.get(`${g}:${id}`)?.consegnata_at || null;

/**
 * L'errore del database detto in italiano. I messaggi scritti nelle funzioni
 * futsal (raise exception '...') sono già in italiano e passano così come
 * sono; quelli di Postgres e delle policy arrivavano grezzi, in inglese.
 */
export function inItaliano(e) {
  const m = String(e?.message || e || '');
  if (/row-level security|violates row level|permission denied/i.test(m)) return 'Non si può più: la giornata è chiusa, o non hai il permesso.';
  if (/duplicate key|already exists|unique constraint/i.test(m)) return 'C\'è già: forse l\'hai salvato un attimo fa.';
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(m)) return 'Connessione assente: riprova quando sei in linea.';
  if (/JWT|token|not authenticated|auth/i.test(m) && !/[àèéìòù]/.test(m)) return 'La sessione è scaduta: esci e rientra.';
  if (/^[\x00-\x7F]*$/.test(m) && /\b(the|is|of|for|not|violates|invalid)\b/i.test(m)) return 'Qualcosa è andato storto sul server. Riprova tra poco.';
  return m;
}
const deve = (r) => { if (r.error) throw new Error(inItaliano(r.error)); return r.data; };

export async function iscriviti(squadra, colore = '#1B84C6', clubCuore = null) {
  const iniziali = squadra.split(/\s+/).map((w) => w[0]).join('').slice(0, 3).toUpperCase();
  deve(await remote.client().from('futsal_iscritti').insert({ user_id: uid(), squadra: squadra.trim(), colore, iniziali, ...(clubCuore ? { club_cuore: clubCuore } : {}) }));
  await carica({ forza: true });
}

export async function consegna(g, formazione) {
  // l'ora la riscrive il database (futsal_formazione_valida): qui serve solo a chi non ha il trigger
  deve(await remote.client().from('futsal_formazioni').upsert({ user_id: uid(), giornata: g, formazione, consegnata_at: new Date().toISOString() }));
  await carica({ forza: true });
}

export async function creaLega(nome, tipo) { const l = deve(await remote.client().rpc('futsal_crea_lega', { p_nome: nome, p_tipo: tipo })); await carica({ forza: true }); return l; }
export async function entraLega(codice) { const id = deve(await remote.client().rpc('futsal_entra_lega', { p_codice: codice })); await carica({ forza: true }); return id; }
export async function esciLega(id) { deve(await remote.client().rpc('futsal_esci_lega', { p_lega: id })); await carica({ forza: true }); }
export async function avviaLega(id) { const g = deve(await remote.client().rpc('futsal_avvia_lega', { p_lega: id })); await carica({ forza: true }); return g; }
// ---- leghe pubbliche (futsal-06): le apre l'amministratore, si entra dall'elenco senza codice
export async function leghePubbliche() { return deve(await remote.client().rpc('futsal_leghe_pubbliche')) || []; }
export async function creaLegaPubblica(nome, max, premio) {
  const premi = premio?.trim() ? [{ posto: 1, premio: premio.trim() }] : [];
  const l = deve(await remote.client().rpc('futsal_crea_lega_pubblica', { p_nome: nome, p_max: max, p_premi: premi }));
  await carica({ forza: true }); return l;
}
export async function entraLegaPubblica(id) { const r = deve(await remote.client().rpc('futsal_entra_lega_pubblica', { p_lega: id })); await carica({ forza: true }); return r; }

// ---- inviti: ?futsal-codice=F12AB3 (lega fra amici) o ?futsal-pubblica=<id>, letti all'avvio
const INVITO = 'fcs:futsal-invito';
export function ricordaInvito(qs) {
  const codice = qs.get('futsal-codice'), pubblica = qs.get('futsal-pubblica');
  const v = codice && /^[A-Za-z0-9]{4,8}$/.test(codice) ? { codice: codice.toUpperCase() } : pubblica && /^[A-Za-z0-9-]{6,64}$/.test(pubblica) ? { pubblica } : null;
  if (!v) return;
  try { localStorage.setItem(INVITO, JSON.stringify(v)); } catch { /* senza storage niente invito */ }
}
export function invitoInSospeso() { try { return JSON.parse(localStorage.getItem(INVITO) || 'null'); } catch { return null; } }
export function dimenticaInvito() { try { localStorage.removeItem(INVITO); } catch { /* niente */ } }
/** Il link da condividere per una lega: porta dritto alle leghe del futsal. */
export function linkInvito(lega) {
  const u = new URL(S.linkInvito());
  if (lega.pubblica) u.searchParams.set('futsal-pubblica', lega.id); else u.searchParams.set('futsal-codice', lega.codice);
  u.hash = '#/futsal/leghe';
  return u.toString();
}

export const membriDi = (lega) => st.membri.filter((m) => m.lega_id === lega).sort((a, b) => String(a.entrato_at).localeCompare(String(b.entrato_at))).map((m) => m.user_id);

// ---- punteggi: la formazione salvata passata al motore, una volta per giornata
const calcoli = new Map();
function votiDi(g) {
  if (!calcoli.has(`v${g}`)) calcoli.set(`v${g}`, F.votiGiornata(g));
  return calcoli.get(`v${g}`);
}
/** Dal formato del server a quello del motore: i giocatori con squadra e ruolo dal listone. */
export function perMotore(f) {
  const con = (id) => { const x = id && F.giocatore(id); return x ? { id, club: x.club, ruolo: x.ruolo } : null; };
  return { schema: f.schema, porta: f.porta, D: (f.D || []).map(con), A: (f.A || []).map(con),
    titolari: f.titolari || [], sesto: f.sesto, capitano: f.capitano, vice: f.vice };
}
/** Il risultato della squadra nella giornata, o null se la giornata non ha ancora referti o la squadra non c'era. */
export function risultato(g, id = uid()) {
  if (!F.giocate().includes(g)) return null;
  const k = `r${g}:${id}`;
  if (!calcoli.has(k)) {
    const f = inVigore(g, id);
    const v = votiDi(g);
    calcoli.set(k, f ? punteggioFormazione(perMotore(f), { porta: v.porta.get(f.porta), giocatori: v.giocatori }, { malus: bilancioDi(g, id).malus }) : null);
  }
  return calcoli.get(k);
}
/** punti(g, id) per le competizioni (src/futsal-gare.js): 0 senza squadra, null senza referti. */
export const punti = (g, id) => (F.giocate().includes(g) ? risultato(g, id)?.totale ?? 0 : null);

/** Quanti iscritti hanno in rosa ogni giocatore nella giornata g, su chi ha una squadra. */
export function popolarita(g) {
  const k = `pop${g}`;
  if (!calcoli.has(k)) {
    const conta = new Map(); let squadre = 0;
    for (const x of st.iscritti) {
      const f = inVigore(g, x.user_id);
      if (!f) continue;
      squadre++;
      for (const id of [`P:${f.porta}`, ...f.D, ...f.A]) conta.set(id, (conta.get(id) || 0) + 1);
    }
    calcoli.set(k, { squadre, di: (id) => (squadre ? (conta.get(id) || 0) / squadre : 0) });
  }
  return calcoli.get(k);
}
