/**
 * Il turno delle storie dei gol (.github/workflows/storie-gol.yml): quando
 * restare accesi, per quanto, e se far partire subito il turno dopo.
 *
 * PERCHE' (15/11). Prima il turno usava la finestra dell'import
 * (finestra-partite.mjs: da un'ora prima della prima partita a 48 ore dopo
 * l'ultima) e restava acceso 5h20 ogni volta che GitHub lo faceva partire.
 * Due difetti, visti nei turni dell'8/11:
 *  - restava acceso il lunedi' e il martedi', quando non si gioca;
 *  - GitHub fa partire i lavori pianificati con ore di ritardo (3-9 ore fra
 *    un turno e l'altro): domenica 8/11 dalle 12:01 alle 15:33 non guardava
 *    nessuno, a partite in corso.
 * Ora il turno segue le PARTITE (da mezz'ora prima del calcio d'inizio a 3h30
 * dopo, come scripts/gol-in-diretta.py) e, se le partite continuano oltre il
 * suo tempo massimo, fa partire SUBITO il turno dopo invece di aspettare
 * l'orario di GitHub (workflow_dispatch col GITHUB_TOKEN e' ammesso).
 *
 *   node scripts/turno-gol.mjs inizio
 *       -> si=si|no  per=<secondi>  inizio=<ms>  fine=<ms fine del blocco>
 *   node scripts/turno-gol.mjs catena <inizio ms> <per s> <fine ms>
 *       -> si | no     (va fatto partire subito il turno dopo?)
 *   ADESSO=2026-11-08T13:00:00Z ...   per le prove
 */
import { CALENDARIO } from '../src/calendario-dati.js';

const MIN = 60 * 1000;
export const PRIMA = 30 * MIN;        // si guarda da mezz'ora prima del calcio d'inizio
export const DOPO = 210 * MIN;        // fino a 3h30 dopo (lo stesso DOPO di gol-in-diretta.py)
export const ANTICIPO = 90 * MIN;     // un turno puo' partire fino a 90' prima e aspettare
export const MASSIMO = 320 * MIN;     // il lavoro ha 340' di tempo: si esce un po' prima
const UNIONE = 60 * MIN;              // due partite a meno di un'ora: un blocco solo

/** I blocchi di partite: [inizio, fine] in ms, ordinati, uniti se vicini. */
export function blocchi(calendario = CALENDARIO) {
  const iv = calendario
    .map((r) => Date.parse(r[3]))
    .filter((t) => !Number.isNaN(t))
    .map((t) => [t - PRIMA, t + DOPO])
    .sort((x, y) => x[0] - y[0]);
  const out = [];
  for (const [da, a] of iv) {
    const u = out[out.length - 1];
    if (u && da - u[1] <= UNIONE) u[1] = Math.max(u[1], a); else out.push([da, a]);
  }
  return out;
}

/** All'avvio: si guarda? Per quanti secondi? Fino a quando dura il blocco? */
export function turno(adesso = Date.now(), calendario = CALENDARIO) {
  const b = blocchi(calendario).find(([da, a]) => adesso >= da - ANTICIPO && adesso < a);
  if (!b) return { si: false, per: 0, inizio: adesso, fine: 0 };
  const per = Math.max(60, Math.round(Math.min(MASSIMO, b[1] - adesso) / 1000));
  return { si: true, per, inizio: adesso, fine: b[1] };
}

/**
 * Alla fine: va fatto partire subito il turno dopo?
 *  - si', se il blocco va avanti e questo turno ha esaurito il suo tempo
 *    (se e' uscito prima, le partite sono finite: niente catena);
 *  - si', se il blocco successivo comincia entro il tempo di anticipo.
 * Mai a vuoto: un turno fatto partire cosi' trova sempre partite da guardare,
 * quindi la catena non puo' girare su se stessa.
 */
export function catena(adesso, inizio, per, fine, calendario = CALENDARIO) {
  const pieno = adesso - inizio >= per * 1000 - 5 * MIN;
  if (pieno && adesso < fine - 10 * MIN) return true;
  return blocchi(calendario).some(([da, a]) => da > fine && da - ANTICIPO <= adesso && a > adesso);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const adesso = process.env.ADESSO ? Date.parse(process.env.ADESSO) : Date.now();
  const [cosa, ...resto] = process.argv.slice(2);
  if (cosa === 'catena') {
    const [inizio, per, fine] = resto.map(Number);
    process.stdout.write(catena(adesso, inizio, per, fine) ? 'si\n' : 'no\n');
  } else {
    const t = turno(adesso);
    process.stdout.write(`si=${t.si ? 'si' : 'no'}\nper=${t.per}\ninizio=${t.inizio}\nfine=${t.fine}\n`);
  }
}
