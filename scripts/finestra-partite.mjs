/**
 * Si sta giocando? Risponde "si" o "no".
 *
 * Serve a scripts/importa-in-giro.sh per decidere se restare acceso e
 * ricontrollare la FSGC ogni venti minuti, o fare un giro solo e spegnersi.
 *
 * LA FINESTRA di una giornata va da un'ora prima del primo calcio d'inizio a
 * 48 ore dopo l'ultimo. Le 48 ore non sono a caso: i referti della domenica
 * la FSGC li ha pubblicati il lunedi' pomeriggio (misurato il 21 settembre),
 * e la giornata si chiude martedi' alle 20:00 — dopo, un dato nuovo non si
 * puo' piu' usare.
 *
 * Fuori da ogni finestra — le settimane senza partite, come la pausa fra la
 * 4a e la 5a — il giro e' uno, come prima: niente macchine accese per niente.
 *
 * Il calendario e' quello vero, src/calendario-dati.js, cioe' lo stesso che
 * l'import aggiorna: se la FSGC sposta una partita, la finestra si sposta con
 * lei al giro dopo.
 *
 *   node scripts/finestra-partite.mjs              -> si | no
 *   ADESSO=2026-10-10T18:00:00Z node scripts/...   -> per le prove
 */
import { CALENDARIO } from '../src/calendario-dati.js';

const ORA = 3600 * 1000;
export const PRIMA = 1 * ORA;
export const DOPO = 48 * ORA;

/** Le finestre, una per giornata: [inizio, fine] in millisecondi. */
export function finestre(calendario = CALENDARIO) {
  const perGiornata = new Map();
  for (const [g, , , calcio] of calendario) {
    const t = Date.parse(calcio);
    if (Number.isNaN(t)) continue;
    const f = perGiornata.get(g) || [Infinity, -Infinity];
    perGiornata.set(g, [Math.min(f[0], t), Math.max(f[1], t)]);
  }
  return [...perGiornata.values()].map(([primo, ultimo]) => [primo - PRIMA, ultimo + DOPO]);
}

export const siGioca = (adesso = Date.now(), calendario = CALENDARIO) =>
  finestre(calendario).some(([da, a]) => adesso >= da && adesso <= a);

// eseguito da riga di comando (non quando lo importa una prova)
if (import.meta.url === `file://${process.argv[1]}`) {
  const adesso = process.env.ADESSO ? Date.parse(process.env.ADESSO) : Date.now();
  process.stdout.write(siGioca(adesso) ? 'si\n' : 'no\n');
}
