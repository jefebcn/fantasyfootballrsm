/**
 * LE MOSSE DELL'EDITOR DELLA FORMAZIONE, senza schermata.
 *
 * Alex, 23/10: «è controintuitivo che i giocatori che vuoi mettere in squadra,
 * se sono in panchina, non li puoi mettere» e «i giocatori che vuoi cavare
 * prima li devi selezionare, poi rimettere». Prima ogni cambio era due passi —
 * togli, poi scegli — e chi stava gia' in panchina compariva spento con
 * «gia' schierato». Qui ogni mossa e' uno scambio in un passo solo:
 *  - dalla panchina al campo: il titolare va a sedersi al posto suo;
 *  - dalla tribuna al campo: il titolare va in tribuna;
 *  - dalla tribuna alla panchina: chi c'era va in tribuna;
 *  - fra due posti di panchina: si scambiano.
 *
 * `d` e' la bozza { formation, starters, bench, captainId, viceCaptainId }:
 * i titolari in ordine P, D, C, A con null dove manca qualcuno, la panchina
 * compatta (al massimo 7, senza buchi). `ruolo(id)` dice P/D/C/A.
 */
import { parseModule } from './engine.js';

export const RUOLI = ['P', 'D', 'C', 'A'];
export const MAX_PANCHINA = 7;

/** I titolari divisi per ruolo, coi posti vuoti a null, nell'ordine del modulo. */
export function posti(d, ruolo) {
  const need = parseModule(d.formation); const out = { P: [], D: [], C: [], A: [] };
  for (const id of d.starters) if (id && out[ruolo(id)] && out[ruolo(id)].length < need[ruolo(id)]) out[ruolo(id)].push(id);
  for (const r of RUOLI) while (out[r].length < need[r]) out[r].push(null);
  return out;
}
const scrivi = (d, s) => { d.starters = [...s.P, ...s.D, ...s.C, ...s.A]; };

/** Dov'e' un giocatore: in campo (ruolo e posto), in panchina (posto) o da nessuna parte. */
export function dove(d, id, ruolo) {
  if (!id) return null;
  const s = posti(d, ruolo);
  for (const r of RUOLI) { const i = s[r].indexOf(id); if (i >= 0) return { campo: true, ruolo: r, i }; }
  const b = d.bench.indexOf(id);
  return b >= 0 ? { panca: true, i: b } : null;
}

/** Chi esce dal campo perde la fascia: il capitano deve essere titolare (art. 6). */
function fasce(d) {
  const tit = new Set(d.starters.filter(Boolean));
  const perse = [];
  if (d.captainId && !tit.has(d.captainId)) { perse.push('capitano'); d.captainId = null; }
  if (d.viceCaptainId && !tit.has(d.viceCaptainId)) { perse.push('vice'); d.viceCaptainId = null; }
  return perse;
}

/**
 * `pid` nel posto `i` dei titolari di ruolo `r`. Torna chi e' uscito e dove e'
 * andato: 'panchina' (scambio con chi entrava dalla panchina), 'tribuna', o
 * 'campo' (due titolari dello stesso ruolo che si scambiano il posto).
 */
export function mettiInCampo(d, r, i, pid, ruolo) {
  const s = posti(d, ruolo); const fuori = s[r][i] ?? null;
  if (fuori === pid) return { fuori: null, va: null, fasce: [] };
  const j = s[r].indexOf(pid);
  let va = fuori ? 'tribuna' : null;
  if (j >= 0) { s[r][j] = fuori; va = fuori ? 'campo' : null; }
  else {
    const b = d.bench.indexOf(pid);
    if (b >= 0) { if (fuori) { d.bench[b] = fuori; va = 'panchina'; } else d.bench.splice(b, 1); }
  }
  s[r][i] = pid; scrivi(d, s);
  return { fuori, va, fasce: fasce(d) };
}

/** Il posto `i` dei titolari di ruolo `r` resta vuoto; chi c'era va in tribuna. */
export function togliDalCampo(d, r, i, ruolo) {
  const s = posti(d, ruolo); const fuori = s[r][i]; s[r][i] = null; scrivi(d, s);
  return { fuori, fasce: fasce(d) };
}

/**
 * `pid` nel posto `pos` della panchina (pos = lunghezza: in coda). Se viene
 * da un altro posto di panchina i due si scambiano; se viene dalla tribuna chi
 * c'era va in tribuna. Dal campo non si passa di qui: e' mettiInCampo, dal
 * punto di vista del panchinaro.
 */
export function mettiInPanchina(d, pos, pid) {
  const da = d.bench.indexOf(pid);
  if (da === pos) return { fuori: null };
  if (da >= 0) {
    if (pos >= d.bench.length) { d.bench.splice(da, 1); d.bench.push(pid); return { fuori: null }; }
    [d.bench[da], d.bench[pos]] = [d.bench[pos], d.bench[da]];
    return { fuori: null, scambio: true };
  }
  if (pos < d.bench.length) { const fuori = d.bench[pos]; d.bench[pos] = pid; return { fuori }; }
  if (d.bench.length >= MAX_PANCHINA) return { fuori: null, piena: true };
  d.bench.push(pid);
  return { fuori: null };
}

export function togliDallaPanchina(d, pos) {
  const [fuori] = d.bench.splice(pos, 1);
  return { fuori };
}

/** Sposta il panchinaro `pos` di un posto su (-1) o giu' (+1). */
export function spostaInPanchina(d, pos, verso) {
  const q = pos + verso;
  if (q < 0 || q >= d.bench.length) return false;
  [d.bench[q], d.bench[pos]] = [d.bench[pos], d.bench[q]];
  return true;
}

/**
 * Riempie i posti liberi della panchina: prima un portiere, poi un
 * difensore, un centrocampista e un attaccante, poi il secondo di ciascuno
 * di movimento — cosi' ogni ruolo in campo ha una riserva (art. 8.2) — e se
 * di un ruolo non c'e' piu' nessuno, il migliore rimasto. A parita' di ruolo,
 * la quotazione piu' alta. Chi e' squalificato va in fondo alla fila.
 */
export function completaPanchina(d, rosa, ruolo, valore, escluso = () => false) {
  const usati = new Set([...d.starters, ...d.bench].filter(Boolean));
  const fila = (r) => rosa.filter((id) => !usati.has(id) && (!r || ruolo(id) === r))
    .sort((a, b) => (escluso(a) - escluso(b)) || (valore(b) - valore(a)));
  const aggiunti = [];
  const prendi = (id) => { if (!id || d.bench.length >= MAX_PANCHINA) return; d.bench.push(id); usati.add(id); aggiunti.push(id); };
  const quanti = (r) => d.bench.filter((id) => ruolo(id) === r).length;
  const voluti = ['P', 'D', 'C', 'A', 'D', 'C', 'A'];
  const visti = { P: 0, D: 0, C: 0, A: 0 };
  for (const r of voluti) {
    if (d.bench.length >= MAX_PANCHINA) break;
    visti[r]++;
    if (quanti(r) < visti[r]) prendi(fila(r)[0]);
  }
  while (d.bench.length < MAX_PANCHINA) { const id = fila(null)[0]; if (!id) break; prendi(id); }
  return aggiunti;
}

/** Chi della rosa non e' ne' in campo ne' in panchina. */
export const tribuna = (d, rosa) => {
  const usati = new Set([...d.starters, ...d.bench].filter(Boolean));
  return rosa.filter((id) => !usati.has(id));
};
