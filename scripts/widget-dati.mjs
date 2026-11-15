/**
 * widget.json: le giornate per il widget dell'iPhone (ios/App/FantaWidget).
 *
 * Il widget non ha un account (gira fuori dall'app) e il database non da' le
 * giornate a chi non ha fatto l'accesso: legge questo file pubblico, fatto a
 * ogni pubblicazione del sito da scripts/costruisci.mjs con lo stesso
 * calendario e la stessa chiusura delle formazioni dell'app (buildSeason).
 * Ogni import dei dati ripubblica il sito, quindi il file resta aggiornato.
 *
 *   node scripts/widget-dati.mjs     -> stampa il JSON (per le prove)
 */
import { buildSeason } from '../src/data.js';

export function datiWidget() {
  const s = buildSeason();
  const nome = new Map(s.clubs.map((c) => [c.id, c.name]));
  const giornate = s.matchdays.map((m) => {
    const partite = s.matches
      .filter((x) => x.matchday === m.number && x.kickoffAt && !Number.isNaN(Date.parse(x.kickoffAt)))
      .sort((a, b) => Date.parse(a.kickoffAt) - Date.parse(b.kickoffAt))
      .map((x) => ({ casa: nome.get(x.homeClubId) || x.homeClubId, ospite: nome.get(x.awayClubId) || x.awayClubId, quando: new Date(x.kickoffAt).toISOString() }));
    return { giornata: m.number, chiusura: m.lockAt, partite };
  });
  return { versione: 1, fatto: new Date().toISOString(), giornate };
}

if (import.meta.url === `file://${process.argv[1]}`) process.stdout.write(`${JSON.stringify(datiWidget(), null, 1)}\n`);
