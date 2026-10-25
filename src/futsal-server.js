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
    const [isc, form, leghe, membri] = await Promise.all([
      sb.from('futsal_iscritti').select('*'), sb.from('futsal_formazioni').select('*'),
      sb.from('futsal_leghe').select('*'), sb.from('futsal_membri').select('*')]);
    const errore = [isc, form, leghe, membri].map((r) => r.error).find(Boolean);
    if (manca(errore)) st = { ...vuoto(), caricato: true, attivo: false };
    else if (errore) st = { ...st, caricato: true, errore: errore.message };
    else {
      st = { ...vuoto(), caricato: true, iscritti: isc.data || [], leghe: leghe.data || [], membri: membri.data || [],
        formazioni: new Map((form.data || []).map((r) => [`${r.giornata}:${r.user_id}`, r])) };
    }
  } catch (e) { st = { ...st, caricato: true, errore: e.message }; }
  st.inCorso = false;
  avvisa();
}

export const io = () => st.iscritti.find((x) => x.user_id === uid()) || null;
export const iscritto = (id) => st.iscritti.find((x) => x.user_id === id);
export const formazioneDi = (g, id = uid()) => st.formazioni.get(`${g}:${id}`)?.formazione || null;
export const consegnataAlle = (g, id = uid()) => st.formazioni.get(`${g}:${id}`)?.consegnata_at || null;

const deve = (r) => { if (r.error) throw new Error(r.error.message); return r.data; };

export async function iscriviti(squadra, colore = '#1B84C6') {
  const iniziali = squadra.split(/\s+/).map((w) => w[0]).join('').slice(0, 3).toUpperCase();
  deve(await remote.client().from('futsal_iscritti').insert({ user_id: uid(), squadra: squadra.trim(), colore, iniziali }));
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
export const membriDi = (lega) => st.membri.filter((m) => m.lega_id === lega).sort((a, b) => String(a.entrato_at).localeCompare(String(b.entrato_at))).map((m) => m.user_id);

// ---- punteggi: la formazione salvata passata al motore, una volta per giornata
const calcoli = new Map();
function votiDi(g) {
  if (!calcoli.has(`v${g}`)) calcoli.set(`v${g}`, F.votiGiornata(g));
  return calcoli.get(`v${g}`);
}
/** Dal formato del server a quello del motore. */
export function perMotore(f) {
  const con = (id) => { const x = id && F.giocatore(id); return x ? { id, club: x.club, ruolo: x.ruolo } : null; };
  return { modulo: f.modulo, porta: f.porta, capitano: f.capitano, vice: f.vice,
    titolari: (f.titolari || []).map(con), panchina: (f.panchina || []).map(con) };
}
/** Il risultato di una formazione nella giornata, o null se la giornata non ha ancora referti. */
export function risultato(g, id = uid()) {
  if (!F.giocate().includes(g)) return null;
  const k = `r${g}:${id}`;
  if (!calcoli.has(k)) {
    const f = formazioneDi(g, id);
    const v = votiDi(g);
    calcoli.set(k, f ? punteggioFormazione(perMotore(f), { porta: v.porta.get(f.porta), giocatori: v.giocatori }) : null);
  }
  return calcoli.get(k);
}
/** punti(g, id) per le competizioni (src/futsal-gare.js): 0 senza consegna, null senza referti. */
export const punti = (g, id) => (F.giocate().includes(g) ? risultato(g, id)?.totale ?? 0 : null);
