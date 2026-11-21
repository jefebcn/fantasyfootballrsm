/**
 * «Giornata N finita»: quando parte l'avviso del lunedì (052, Alex 04/11).
 *
 * Lo chiama ogni ora l'azione del promemoria (.github/workflows/promemoria.yml).
 * Guarda calendario e referti dell'app (src/calendario-dati.js,
 * src/eventi-dati.js), cioe' gli stessi dati con cui l'app calcola i punti:
 * se qui la giornata risulta finita, nell'app i punti ci sono gia'.
 *
 * FINITA vuol dire: tutte le partite gia' giocate hanno il referto, e quelle
 * che mancano sono rinviate di qualche giorno (una gara spostata di una
 * settimana non deve tenere ferma la notifica di tutti gli altri). Si avvisa
 * solo di giorno (9-22, ora italiana) e solo entro tre giorni dall'ultima
 * partita: una giornata vecchia non e' una notizia.
 *
 * A non avvisare due volte ci pensa il database (avvisi_inviati): chiamare la
 * funzione ogni ora e' sicuro.
 *
 *   node scripts/avvisi.mjs                  -> stampa la giornata da avvisare, o niente
 *   node scripts/avvisi.mjs --spedisci       -> e chiama la funzione (URL e token dall'ambiente)
 *   ADESSO=2026-11-02T10:00:00+01:00 node scripts/avvisi.mjs   -> per le prove
 */
import { CALENDARIO } from '../src/calendario-dati.js';
import { REFERTI } from '../src/eventi-dati.js';

const ORA = 3600 * 1000;
export const DOPO_ULTIMA = 3 * ORA;          // la partita e' finita e il referto ha avuto tempo
export const ENTRO = 72 * ORA;               // poi la giornata e' vecchia
export const RINVIATA = 72 * ORA;            // una gara piu' in la' di cosi' e' un rinvio

const oraItalia = (t) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', hourCycle: 'h23' }).format(new Date(t)));

/** La giornata da annunciare adesso, o null. */
export function giornataFinita(adesso = Date.now(), calendario = CALENDARIO, referti = REFERTI) {
  const h = oraItalia(adesso);
  if (h < 9 || h >= 22) return null;
  const conReferto = new Set(referti.map((r) => `${r.g}:${r.casa}:${r.ospite}`));
  const per = new Map();
  for (const [g, casa, ospite, calcio] of calendario) {
    const t = Date.parse(calcio); if (Number.isNaN(t)) continue;
    (per.get(g) || per.set(g, []).get(g)).push({ t, ok: conReferto.has(`${g}:${casa}:${ospite}`) });
  }
  let scelta = null;
  for (const [g, partite] of per) {
    const giocate = partite.filter((p) => p.t <= adesso);
    const dopo = partite.filter((p) => p.t > adesso);
    if (!giocate.length || giocate.length < partite.length * 0.75) continue;      // ancora in corso
    if (dopo.some((p) => p.t - adesso < RINVIATA)) continue;                      // si gioca ancora a breve
    if (!giocate.every((p) => p.ok)) continue;                                    // manca qualche referto
    const ultima = Math.max(...giocate.map((p) => p.t));
    if (adesso < ultima + DOPO_ULTIMA || adesso > ultima + ENTRO) continue;
    if (!scelta || g > scelta) scelta = g;
  }
  return scelta;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const adesso = process.env.ADESSO ? Date.parse(process.env.ADESSO) : Date.now();
  const g = giornataFinita(adesso);
  if (!g) { console.log('nessuna giornata da annunciare'); process.exit(0); }
  console.log(`giornata ${g} finita`);
  if (!process.argv.includes('--spedisci')) process.exit(0);
  const url = String(process.env.SUPABASE_FUNCTIONS_URL || '').replace(/\s+/g, '').replace(/\/$/, '');
  const token = String(process.env.PROMEMORIA_TOKEN || '').replace(/\s+/g, '');
  const nome = String(process.env.PROMEMORIA_FUNZIONE || '').replace(/\s+/g, '') || 'promemoria';
  if (!url || !token) { console.log('SUPABASE_FUNCTIONS_URL o PROMEMORIA_TOKEN non impostati: non spedisco'); process.exit(0); }
  const r = await fetch(`${url}/${nome}`, {
    method: 'POST', headers: { 'x-promemoria-token': token, 'content-type': 'application/json' },
    body: JSON.stringify({ tipo: 'fine-giornata', giornata: g }),
  });
  console.log(`HTTP ${r.status}`, await r.text());
  process.exit(r.ok ? 0 : 1);
}
