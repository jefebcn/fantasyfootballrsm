/**
 * Le lingue dell'app (Alex, 04/11: «mettendola anche per la lingua spagnola»).
 *
 * COME FUNZIONA. I testi restano scritti in italiano nel codice, dove sono
 * sempre stati: t('Classifica') restituisce «Classifica» in italiano e
 * «Clasificación» in spagnolo, cercandola nel dizionario (src/lingue/). La
 * chiave e' la frase italiana stessa: chi legge il codice vede la frase vera,
 * e una frase che manca nel dizionario esce in italiano invece di rompersi.
 *
 * Le parti che cambiano si scrivono fra graffe, con lo stesso nome nelle due
 * lingue: t('Giornata {n}', { n: 7 }) -> «Giornata 7» / «Fecha 7».
 *
 * QUALE LINGUA. Quella scelta in Impostazioni (fcs:prefs.lingua); se non e'
 * mai stata scelta, lo spagnolo per un telefono in spagnolo, l'italiano per
 * tutti gli altri. Cambiarla ricarica l'app: i testi si scrivono una volta e
 * ricaricare e' l'unico modo per essere sicuri che li riscriva tutti.
 *
 * LE FRASI CHE MANCANO. In una lingua diversa dall'italiano, ogni frase passata
 * a t() e assente dal dizionario finisce in window.__mancanti: la prova
 * prove/spagnolo.cjs gira le schermate e lo controlla.
 */
import { ES } from './lingue/es.js';

const DIZIONARI = { es: ES };
const CHIAVE = 'fcs:prefs';

function scelta() {
  try {
    const p = JSON.parse(localStorage.getItem(CHIAVE) || '{}');
    if (p.lingua === 'it' || DIZIONARI[p.lingua]) return p.lingua;
  } catch { /* niente memoria: si guarda il telefono */ }
  const nav = (typeof navigator !== 'undefined' && ((navigator.languages && navigator.languages[0]) || navigator.language)) || 'it';
  return /^es\b/i.test(nav) ? 'es' : 'it';
}

let attuale = scelta();
if (typeof document !== 'undefined') document.documentElement.lang = attuale;

/** 'it' o 'es'. */
export const lingua = () => attuale;
/** Il codice per Intl e toLocaleString. */
export const locale = () => (attuale === 'es' ? 'es-ES' : 'it-IT');
/** Solo per le prove: cambia lingua senza ricaricare. */
export function impostaLingua(l) {
  attuale = l === 'it' || DIZIONARI[l] ? l : 'it';
  if (typeof document !== 'undefined') document.documentElement.lang = attuale;
}

const mancanti = new Set();
/**
 * La frase nella lingua dell'app. `v` riempie le graffe: {n}, {squadra}...
 * Un valore assente lascia la graffa com'e', cosi' l'errore si vede.
 */
export function t(it, v) {
  let s = it;
  if (attuale !== 'it') {
    const d = DIZIONARI[attuale];
    if (d && Object.prototype.hasOwnProperty.call(d, it)) s = d[it];
    else if (it && !mancanti.has(it)) {
      mancanti.add(it);
      if (typeof window !== 'undefined') (window.__mancanti ||= []).push(it);
    }
  }
  return v ? s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? String(v[k]) : m)) : s;
}
