/**
 * Quotazioni, plusvalenze, crediti e cambi del FantaFutsal (FUTSAL.md § 13),
 * sul modello di Dunkest: ogni giocatore e ogni Porta ha un valore in crediti
 * che sale o scende dopo ogni giornata, e la rosa si compra con quei crediti.
 *
 * Tutto si ricava dai referti FSGC che l'app porta con se', con funzioni
 * pure: lo stesso conto lo fanno i telefoni e, per il mercato, il database
 * (scripts/futsal-sql.mjs scrive le quotazioni in futsal-02-dati.sql e
 * futsal-04 le usa per rifiutare una rosa che costa troppo).
 *
 * Gli identificativi: un giocatore e' il suo id FSGC, una Porta e' 'P:club'.
 */
import * as F from './futsal.js';
import { REGOLE_FUTSAL as R } from './futsal-engine.js';

export const VALORI = {
  // le quotazioni di partenza escono dalle prime 6 giornate (tutte con il
  // referto il 29/10/2026); da li' in poi si muovono una giornata alla volta
  base: 6,
  min: 3,
  max: 18,
  // quanto si muove una quotazione: 0,1 crediti per ogni punto sopra o
  // sotto l'atteso, al massimo 0,6 a giornata
  k: 0.1,
  variazioneMax: 0.6,
};

const r1 = (x) => Math.round(x * 10) / 10;
const mezzo = (x) => Math.round(x * 2) / 2;
const stringi = (x, a, b) => Math.min(b, Math.max(a, x));
export const idPorta = (club) => `P:${club}`;
export const ePorta = (id) => String(id).startsWith('P:');

/** I punti che ci si aspetta a giornata da chi vale v crediti: l'inverso della quotazione di partenza. */
export const atteso = (v, porta = false) => (porta ? 3 : 4.5) + (v - VALORI.min) / 2;

/**
 * La quotazione di partenza, dalle prime VALORI.base giornate: la media punti
 * tirata verso il 6 (5 per le porte) come se avesse giocato due partite in
 * piu', e per i giocatori pesata sulle presenze — chi va in distinta una
 * volta su due vale meno di chi c'e' sempre.
 */
function partenza(id) {
  let punti = 0, presenze = 0, possibili = 0;
  for (let n = 1; n <= VALORI.base; n++) {
    if (!F.giocate().includes(n)) continue;
    const v = voto(id, n);
    if (!v || v.riposo || (v.sv && v.motivo === 'la squadra non gioca')) continue;
    possibili++;
    if (!v.sv) { presenze++; punti += v.totale; }
  }
  if (ePorta(id)) return stringi(mezzo(VALORI.min + 2 * ((punti + 10) / (presenze + 2) - 3)), VALORI.min, VALORI.max);
  const media = (punti + 12) / (presenze + 2);
  const atteso = media * ((presenze + 1) / (possibili + 1));
  return stringi(mezzo(VALORI.min + 2 * (atteso - 4.5)), VALORI.min, VALORI.max);
}

function voto(id, n) {
  const v = F.votiGiornata(n);
  return ePorta(id) ? v.porta.get(id.slice(2)) : v.giocatori.get(id);
}

/**
 * Di quanto si muove la quotazione dopo la giornata n: dai punti fatti e dal
 * valore di partenza, come in Dunkest (a parita' di punti guadagna di piu' chi
 * costa meno). Chi riposa non si muove; chi non e' convocato vale 0 punti.
 */
export function variazione(id, n, valore) {
  const v = voto(id, n);
  if (!v || v.riposo || (v.sv && v.motivo === 'la squadra non gioca')) return 0;
  const punti = v.sv ? 0 : v.totale;
  return r1(stringi((punti - atteso(valore, ePorta(id))) * VALORI.k, -VALORI.variazioneMax, VALORI.variazioneMax));
}

const storia = new Map();
/** Le quotazioni di un id all'inizio di ogni giornata: [g] -> crediti (indice 1..GIORNATE+1). */
function valori(id) {
  if (storia.has(id)) return storia.get(id);
  const v = [];
  let x = partenza(id);
  for (let n = 1; n <= F.GIORNATE + 1; n++) {
    v[n] = x;
    if (n > VALORI.base && F.conclusa(n)) x = stringi(r1(x + variazione(id, n, x)), VALORI.min, VALORI.max);
  }
  storia.set(id, v);
  return v;
}

/** Quanto costa un giocatore (o una Porta) per la giornata n. */
export const quotazione = (id, n) => valori(id)[Math.min(Math.max(1, n), F.GIORNATE + 1)];
/** La plusvalenza (o minusvalenza) prodotta dalla giornata n. */
export const plus = (id, n) => r1(quotazione(id, n + 1) - quotazione(id, n));
/** Plusvalenza totale dall'inizio delle quotazioni fino alla giornata n esclusa. */
export const plusTotale = (id, n) => r1(quotazione(id, n) - quotazione(id, 1));

/**
 * Le quotazioni della giornata n sono definitive — e il mercato si puo' aprire —
 * quando la giornata prima e' conclusa (referti arrivati, o tre giorni passati).
 * Prima, comprare a un prezzo che sta per cambiare vorrebbe dire comprare al
 * buio: il mercato resta chiuso finche' i referti non arrivano.
 */
export const quotazioniPronte = (n) => n - 1 <= VALORI.base || F.conclusa(n - 1);

/** L'ultima giornata con quotazioni definitive: fin qui il database le conosce. */
export function ultimaPronta() {
  let n = 1;
  while (n < F.GIORNATE + 1 && quotazioniPronte(n + 1)) n++;
  return n;
}

/** Tutti gli id quotati: i giocatori di movimento e le 15 porte. */
export const QUOTATI = () => [...F.GIOCATORI_FUTSAL.filter((g) => g.ruolo !== 'P').map((g) => g.id), ...F.SQUADRE.map((s) => idPorta(s.id))];

/** Gli elementi comprati in una formazione: la Porta e gli otto della rosa. */
export const elementi = (f) => (f ? [idPorta(f.porta), ...(f.D || []), ...(f.A || [])].map((x) => (typeof x === 'string' ? x : x?.id)).filter((x) => x && x !== 'P:undefined' && x !== 'P:null') : []);
export const costo = (f, n) => r1(elementi(f).reduce((s, id) => s + quotazione(id, n), 0));

/**
 * Il bilancio di un iscritto alla giornata n (§ 13.7).
 * effettiva(k): la formazione in vigore alla giornata k (l'ultima consegnata
 * fino a k compresa), o null. La squadra resta da una giornata all'altra:
 * chi non tocca niente gioca con quella di prima, come in Dunkest.
 *
 * patrimonio = budget + le plusvalenze dei giocatori avuti in rosa;
 * residui = patrimonio − quanto costa oggi la rosa;
 * cambi = chi e' entrato in rosa rispetto alla giornata prima (la prima
 * rosa e' gratis), e oltre i cambi gratis ognuno toglie punti.
 */
export function bilancio(effettiva, n, bozza = undefined) {
  let primo = null;
  for (let k = 1; k <= n; k++) if (effettiva(k)) { primo = k; break; }
  const f = bozza !== undefined ? bozza : effettiva(n);
  if (primo === null && !f) return { patrimonio: R.budget, costo: 0, residui: R.budget, cambi: 0, malus: 0, primo: null, entrati: [], usciti: [] };
  if (primo === null) primo = n;
  let patrimonio = R.budget;
  for (let k = primo; k < n; k++) for (const id of elementi(effettiva(k))) patrimonio += plus(id, k);
  patrimonio = r1(patrimonio);
  const c = costo(f, n);
  const prima = n > primo ? new Set(elementi(effettiva(n - 1))) : null;
  const ora = new Set(elementi(f));
  const entrati = prima ? [...ora].filter((x) => !prima.has(x)) : [];
  const usciti = prima ? [...prima].filter((x) => !ora.has(x)) : [];
  const cambi = entrati.length;
  return { patrimonio, costo: c, residui: r1(patrimonio - c), cambi, malus: Math.max(0, cambi - R.cambiGratis) * R.malusCambio, primo, entrati, usciti };
}

/** I migliori per plusvalenza nella giornata n (i «Fantasy Plus leaders» di Dunkest). */
export function migliorPlus(n, quanti = 3) {
  return QUOTATI().map((id) => ({ id, plus: plus(id, n) })).filter((x) => x.plus > 0).sort((a, b) => b.plus - a.plus).slice(0, quanti);
}
