/**
 * I due dati delle storie dei gol che stanno nel database: chi ha aderito
 * (giocatori_aderenti, 044) e quante squadre hanno ciascun giocatore
 * (possesso_giocatori, 047). Li scrive nel JSON che scripts/storie-gol.mjs
 * legge con --dati.
 *
 *   SUPABASE_SERVICE_KEY=... node scripts/dati-storie.mjs uscita.json
 *
 * Senza chiave, o se il database non risponde, scrive un file vuoto: le
 * storie escono lo stesso, tutte di squadra e senza nomi. Meglio cosi' che
 * un nome di chi non ha detto si'.
 */
import { writeFileSync } from 'node:fs';
import { SUPABASE_URL } from '../src/config.js';

const uscita = process.argv[2] || 'dati-storie.json';
const chiave = process.env.SUPABASE_SERVICE_KEY;
const rpc = async (nome) => {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nome}`, {
    method: 'POST', headers: { apikey: chiave, authorization: `Bearer ${chiave}`, 'content-type': 'application/json' }, body: '{}',
  });
  if (!r.ok) throw new Error(`${nome}: ${r.status} ${await r.text()}`);
  return r.json();
};

let dati = { aderenti: [], possesso: {}, squadre: 0 };
if (chiave) {
  try {
    const aderenti = (await rpc('giocatori_aderenti')).map((x) => (typeof x === 'string' ? x : x.giocatori_aderenti));
    const { squadre, possesso } = await rpc('possesso_giocatori');
    dati = { aderenti, possesso, squadre };
  } catch (e) {
    console.error('dati-storie:', e.message);
  }
}
writeFileSync(uscita, JSON.stringify(dati));
console.log(`dati-storie: ${dati.aderenti.length} aderenti, ${dati.squadre} squadre`);
