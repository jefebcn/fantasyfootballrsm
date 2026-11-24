/**
 * Si sta giocando? Risponde "si" o "no".
 *
 * Serve a scripts/importa-in-giro.sh per decidere se restare acceso e
 * ricontrollare la FSGC ogni venti minuti, o fare un giro solo e spegnersi.
 *
 * DUE FINESTRE PER OGNI PARTITA, non piu' una per giornata (24/11).
 * Prima la finestra andava da un'ora prima del primo calcio d'inizio a 48 ore
 * dopo l'ultimo, e col futsal dal lunedi' al giovedi' copriva quasi tutta la
 * settimana: la guardia da 5 ore e 20 ripartiva giorno e notte (dal 20/11 sera
 * al 24/11 mattina senza pause), anche quando non c'era niente da prendere.
 * Adesso si resta accesi solo quando la FSGC pubblica davvero:
 *  - LA PARTITA: da un'ora prima del calcio d'inizio a 6 ore dopo (risultato,
 *    marcatori, primi tabellini);
 *  - I REFERTI: da 15 a 30 ore dopo il calcio d'inizio. Quelli della domenica
 *    sono usciti il lunedi' pomeriggio (misurato il 21 settembre).
 *    Per il futsal da 15 a 23 ore dopo (data/futsal-orologio.json, 7ª giornata),
 *    e la partita dura meno: 3 ore dopo il calcio d'inizio.
 *  - MAI DI NOTTE, dall'1 alle 7 ora di San Marino.
 * Fuori da queste ore l'import gira lo stesso ogni due ore (dati-fsgc.yml), un
 * giro solo da mezzo minuto: un referto pubblicato a un'ora strana arriva al
 * giro dopo, sempre prima che la giornata si chiuda martedi' alle 20:00.
 *
 * Il calendario e' quello vero, src/calendario-dati.js, cioe' lo stesso che
 * l'import aggiorna: se la FSGC sposta una partita, la finestra si sposta con
 * lei al giro dopo.
 *
 *   node scripts/finestra-partite.mjs              -> si | no
 *   ADESSO=2026-10-10T18:00:00Z node scripts/...   -> per le prove
 */
import { CALENDARIO } from '../src/calendario-dati.js';
import { CALENDARIO as CALENDARIO_FUTSAL } from '../src/futsal-dati.js';

const ORA = 3600 * 1000;
export const PRIMA = 1 * ORA;
/** Calcio: la partita (fino a 6 ore dopo) e i referti (da 15 a 30 ore dopo). */
export const CALCIO = { partita: 6 * ORA, referti: [15 * ORA, 30 * ORA] };
/** Futsal: partita piu' corta, referti da 15 a 23 ore dopo. */
export const FUTSAL = { partita: 3 * ORA, referti: [15 * ORA, 23 * ORA] };
/** La notte, in ora di San Marino: dall'1 alle 7 non si resta accesi. */
export const NOTTE = [1, 7];

/** Le finestre, due per partita: [inizio, fine] in millisecondi. */
export function finestre(calendario = CALENDARIO, tempi = CALCIO) {
  const inizi = new Set();
  for (const r of calendario) {
    const t = Date.parse(r[3]);
    if (!Number.isNaN(t)) inizi.add(t);
  }
  return [...inizi].sort((x, y) => x - y).flatMap((t) => [
    [t - PRIMA, t + tempi.partita],
    [t + tempi.referti[0], t + tempi.referti[1]],
  ]);
}

const oraSanMarino = (adesso) => +new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: 'numeric', hourCycle: 'h23' }).format(adesso);
export const diNotte = (adesso = Date.now()) => { const h = oraSanMarino(adesso); return h >= NOTTE[0] && h < NOTTE[1]; };

const dentro = (adesso, lista) => !diNotte(adesso) && lista.some(([da, a]) => adesso >= da && adesso <= a);

export const siGioca = (adesso = Date.now(), calendario = CALENDARIO) => dentro(adesso, finestre(calendario, CALCIO));

/** IL FUTSAL gioca dal lunedì al giovedì sera: stesso calendario, tempi suoi. */
export const finestreFutsal = (calendario = CALENDARIO_FUTSAL) => finestre(calendario, FUTSAL);
export const siGiocaFutsal = (adesso = Date.now(), calendario = CALENDARIO_FUTSAL) => dentro(adesso, finestreFutsal(calendario));

// eseguito da riga di comando (non quando lo importa una prova)
if (import.meta.url === `file://${process.argv[1]}`) {
  const adesso = process.env.ADESSO ? Date.parse(process.env.ADESSO) : Date.now();
  // --futsal: solo le giornate del futsal (la prova prima del lancio, futsal-prova.yml)
  const si = process.argv.includes('--futsal') ? siGiocaFutsal(adesso) : siGioca(adesso) || siGiocaFutsal(adesso);
  process.stdout.write(si ? 'si\n' : 'no\n');
}
