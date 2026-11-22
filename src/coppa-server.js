/**
 * La Coppa Fantatitano sul server (supabase/migrations/066-coppa-fantatitano.sql).
 *
 * Un archivio piccolo e separato da state.js, come il futsal: le formazioni di
 * coppa non hanno niente in comune con quelle delle leghe. Le formazioni degli
 * altri arrivano solo dalla chiusura del turno (RLS): si ricarica un minuto
 * dopo ogni chiusura e quando l'app torna in primo piano.
 *
 * Se la 066 non è ancora sul database le tabelle non esistono: lo si dice
 * (attivo = false) e la pagina lo spiega, senza errori.
 */
import * as remote from './backend.js';
import * as S from './state.js';
import { COPPA_CALENDARIO } from './coppa-dati.js';
import { TURNI, chiusuraTurno, eApp, squadraApp } from './coppa-fanta.js';

const PAGINA = 1000;
async function aPagine(richiesta) {
  const data = [];
  for (let da = 0; ; da += PAGINA) {
    const r = await richiesta().range(da, da + PAGINA - 1);
    if (r.error) return r;
    data.push(...(r.data || []));
    if ((r.data || []).length < PAGINA) return { data, error: null };
  }
}
const vuoto = () => ({ caricato: false, inCorso: false, attivo: true, errore: null, turni: [], formazioni: new Map(), contati: 0, elenco: [] });
let st = vuoto(), per = null, caricataAlle = 0, timer = null;
const ascolta = new Set();
export const stato = () => st;
export function quandoCambia(fn) { ascolta.add(fn); return () => ascolta.delete(fn); }
const avvisa = () => ascolta.forEach((f) => f());

export const uid = () => S.currentUser()?.id || null;
const manca = (e) => e && (e.code === '42P01' || e.code === 'PGRST205' || /does not exist|schema cache|could not find/i.test(e.message || ''));

/** Carica turni e formazioni visibili. Una volta, poi su richiesta. */
export async function carica({ forza = false } = {}) {
  const sb = remote.client();
  if (!sb || !uid() || st.inCorso || (st.caricato && !forza && per === uid())) return;
  st.inCorso = true; per = uid();
  try {
    const [turni, form, conta, elenco] = await Promise.all([
      sb.from('coppa_turni').select('*').order('turno'),
      aPagine(() => sb.from('coppa_formazioni').select('user_id,turno,squadra,colore,iniziali,titolari,riserva,capitano,aggiornata').order('turno').order('user_id')),
      sb.rpc('coppa_iscritti'),
      // chi c'è e con che squadra, senza giocatori (067): i gironi provvisori prima della chiusura
      sb.rpc('coppa_iscritti_elenco')]);
    const errore = [turni, form].map((r) => r.error).find(Boolean);
    if (manca(errore)) st = { ...vuoto(), caricato: true, attivo: false };
    else if (errore) st = { ...st, caricato: true, errore: errore.message };
    else st = { ...vuoto(), caricato: true, turni: turni.data || [], contati: conta.data || 0, elenco: elenco.error ? [] : elenco.data || [], formazioni: new Map((form.data || []).map((r) => [`${r.turno}:${r.user_id}`, r])) };
  } catch (e) { st = { ...st, caricato: true, errore: e.message }; }
  st.inCorso = false;
  caricataAlle = Date.now();
  programma();
  avvisa();
}
function programma() {
  clearTimeout(timer);
  const ora = Date.now();
  for (const t of TURNI) {
    const c = chiusuraTurno(COPPA_CALENDARIO, t.n);
    if (c && c.getTime() > ora) {
      const ms = c.getTime() - ora + 60e3;
      if (ms < 2 ** 31 - 1) timer = setTimeout(() => carica({ forza: true }), ms);
      return;
    }
  }
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && st.caricato && Date.now() - caricataAlle > 120e3) carica({ forza: true });
  });
}

export const formazione = (n, id = uid()) => st.formazioni.get(`${n}:${id}`) || null;
/** Chi è in coppa: chi ha consegnato la formazione del primo turno. */
export const iscritti = () => [...st.formazioni.values()].filter((r) => r.turno === 1).map((r) => r.user_id);
/** Prima della chiusura: chi è iscritto finora (067), per i gironi provvisori. */
export const iscrittiFinora = () => (st.elenco.length ? st.elenco.map((r) => r.user_id) : iscritti());
/** Il nome della squadra in coppa: quello dato all'ultima consegna. */
export function squadra(id) {
  if (eApp(id)) return squadraApp(id);
  let r = null;
  for (const t of TURNI) r = st.formazioni.get(`${t.n}:${id}`) || r;
  r = r || st.elenco.find((x) => x.user_id === id);
  return r ? { squadra: r.squadra, colore: r.colore || '#4B06FC', iniziali: r.iniziali || r.squadra.slice(0, 2).toUpperCase() } : { squadra: 'Squadra', colore: '#888888', iniziali: '?' };
}

/** Salva la formazione di coppa del turno n. f: { titolari, riserva, capitano, squadra, colore, iniziali }. */
export async function salva(n, f) {
  const sb = remote.client();
  if (!sb || !uid()) throw new Error('Serve l\'accesso per giocare la coppa');
  // colore e iniziali vengono dalla squadra della lega: il database vuole #RRGGBB e al massimo 3 lettere
  const colore = /^#[0-9A-Fa-f]{6}$/.test(f.colore || '') ? f.colore : null;
  const riga = { user_id: uid(), turno: n, squadra: (f.squadra || 'Squadra').trim().slice(0, 40) || 'Squadra', colore, iniziali: f.iniziali ? String(f.iniziali).slice(0, 3) : null,
    titolari: f.titolari, riserva: f.riserva, capitano: f.capitano };
  const { data, error } = await sb.from('coppa_formazioni').upsert(riga, { onConflict: 'user_id,turno' }).select().single();
  if (error) throw new Error(error.message);
  st.formazioni.set(`${n}:${uid()}`, data);
  // chi si iscrive si vede subito nei gironi provvisori, senza aspettare di ricaricare
  if (n === 1) {
    const nuovo = !st.elenco.some((x) => x.user_id === uid());
    st.elenco = [...st.elenco.filter((x) => x.user_id !== uid()), { user_id: uid(), squadra: data.squadra, colore: data.colore, iniziali: data.iniziali }]
      .sort((x, y) => (x.user_id < y.user_id ? -1 : 1));
    if (nuovo) st.contati = (st.contati || 0) + 1;
  }
  avvisa();
  return data;
}

/** Solo per le prove e la simulazione: uno stato finto già pronto. */
export function simula(finto) { st = { ...vuoto(), caricato: true, ...finto }; per = 'simulazione'; avvisa(); }
