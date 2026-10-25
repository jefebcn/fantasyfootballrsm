/**
 * I dati del futsal pronti per le schermate: listone con i ruoli di gioco,
 * voti di ogni giornata, giornata corrente e chiusura delle formazioni.
 * Legge src/futsal-dati.js (scripts/importa-futsal.py) e usa il motore.
 */
import { CALENDARIO, GIOCATORI, REFERTI, GIORNATE } from './futsal-dati.js';
import { RUOLO_GIOCO, REGOLE_FUTSAL, votoGiocatore, votoPorta } from './futsal-engine.js';

export { GIORNATE, REGOLE_FUTSAL };

/** Le 15 società del futsal, con i nomi come li scrive la FSGC senza «Futsal». */
export const SQUADRE = [
  ['cailungo', 'Cailungo'], ['cosmos', 'Cosmos'], ['domagnano', 'Domagnano'], ['faetano', 'Faetano'],
  ['fiorentino', 'Fiorentino'], ['folgore', 'Folgore'], ['juvenes', 'Juvenes Dogana'], ['lafiorita', 'La Fiorita'],
  ['libertas', 'Libertas'], ['murata', 'Murata'], ['pennarossa', 'Pennarossa'], ['sangiovanni', 'San Giovanni'],
  ['trefiori', 'Tre Fiori'], ['trepenne', 'Tre Penne'], ['virtus', 'Virtus'],
].map(([id, nome]) => ({ id, nome }));
export const squadra = new Map(SQUADRE.map((s) => [s.id, s]));

export const GIOCATORI_FUTSAL = GIOCATORI.map(([id, club, nome, cognome, ruoloFsgc, numero]) => ({
  id, club, nome, cognome, ruoloFsgc, numero, ruolo: RUOLO_GIOCO[ruoloFsgc] || 'A',
}));
const perId = new Map(GIOCATORI_FUTSAL.map((g) => [g.id, g]));
export const giocatore = (id) => perId.get(id);
const clubDi = (id) => perId.get(id)?.club;
const ruoloDi = (id) => perId.get(id)?.ruoloFsgc;

export const PARTITE = CALENDARIO.map(([g, casa, ospite, quando, impianto, gc, go]) => ({ g, casa, ospite, quando, impianto, gc, go }));
const referti = (n) => REFERTI.filter((r) => r.g === n);
/** Il referto di una partita, dalla giornata e dalla squadra di casa. */
export const referto = (n, casa) => REFERTI.find((r) => r.g === n && r.casa === casa);

/** Giornate con almeno un referto. */
export const giocate = () => [...new Set(REFERTI.map((r) => r.g))].sort((a, b) => a - b);

/** La prima giornata con partite ancora da giocare (o l'ultima). */
export function giornataCorrente(ora = Date.now()) {
  for (let n = 1; n <= GIORNATE; n++) if (PARTITE.some((p) => p.g === n && p.gc === null && new Date(p.quando).getTime() > ora - 3 * 3600e3)) return n;
  return GIORNATE;
}

/** Chiusura delle formazioni: 10 minuti prima della prima partita della giornata (§ 3). */
export function chiusura(n) {
  const t = PARTITE.filter((p) => p.g === n && p.quando).map((p) => new Date(p.quando).getTime());
  return t.length ? new Date(Math.min(...t) - 10 * 60e3) : null;
}

/** Chi riposa nella giornata: con 15 squadre, una ogni volta. */
export function riposa(n) {
  const giocano = new Set(PARTITE.filter((p) => p.g === n).flatMap((p) => [p.casa, p.ospite]));
  return SQUADRE.filter((s) => !giocano.has(s.id)).map((s) => s.id);
}

/** Voti di una giornata: { porta: Map club -> voto, giocatori: Map id -> voto }. */
export function votiGiornata(n) {
  const refs = referti(n);
  const porta = new Map(SQUADRE.map((s) => [s.id, votoPorta(s.id, refs, clubDi, ruoloDi)]));
  const giocatori = new Map(GIOCATORI_FUTSAL.filter((g) => g.ruolo !== 'P').map((g) => [g.id, votoGiocatore(g, refs, clubDi)]));
  return { porta, giocatori };
}

/** Presenze, gol e media voto di ogni giocatore di movimento sulle giornate giocate. */
export function statistiche() {
  const s = new Map();
  for (const n of giocate()) {
    const { giocatori } = votiGiornata(n);
    for (const [id, v] of giocatori) {
      if (v.sv) continue;
      const x = s.get(id) || { presenze: 0, gol: 0, punti: 0 };
      x.presenze++; x.punti += v.totale;
      x.gol += REFERTI.filter((r) => r.g === n).flatMap((r) => r.eventi).filter((e) => e[0] === id && e[2] === 'goal').length;
      s.set(id, x);
    }
  }
  for (const x of s.values()) x.media = Math.round((x.punti / x.presenze) * 100) / 100;
  return s;
}
