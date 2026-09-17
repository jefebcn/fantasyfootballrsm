#!/usr/bin/env node
/**
 * Il calendario dei lock come migrazione, generato dal calendario dell'app.
 *
 * Prima il server lo riceveva solo quando un Giudice Dati apriva l'app: su un
 * progetto senza giudice restava vuoto, le formazioni degli avversari non si
 * vedevano mai e un foglio chiedeva a chi amministra la lega di incollare SQL.
 * Non si puo' dare agli utenti una cosa del genere da fare: il calendario e'
 * un dato derivato, identico per tutte le leghe, e deve stare nel database
 * dal primo giorno come le tabelle.
 *
 *   node scripts/genera-lock.mjs          riscrive supabase/migrations/012-calendario-lock.sql
 *
 * Il file e' ripetibile: riscrive solo le righe diverse. Quando il calendario
 * cambia (una gara spostata dalla FSGC) l'import lo rigenera e la prova
 * tests/calendario-lock.test.js pretende che il file sia aggiornato.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildSeason } from '../src/data.js';

export const DESTINAZIONE = new URL('../supabase/migrations/012-calendario-lock.sql', import.meta.url);

/** Le trenta righe: numero di giornata e istante del lock, in UTC. */
export const righeLock = () => buildSeason().matchdays
  .map((md) => ({ matchday: md.number, lock_at: new Date(md.lockAt).toISOString() }))
  .sort((a, b) => a.matchday - b.matchday);

export function sqlCalendarioLock(righe = righeLock()) {
  const valori = righe.map((r) => `  (${r.matchday}, '${r.lock_at}')`).join(',\n');
  return `-- Il calendario dei lock, dentro il database dal primo giorno.
--
-- GENERATO da scripts/genera-lock.mjs a partire dal calendario dell'app
-- (src/data.js): non si modifica a mano, si rigenera. La prova
-- tests/calendario-lock.test.js diventa rossa se il file e' indietro.
--
-- Prima queste righe arrivavano al server solo quando un Giudice Dati apriva
-- l'app (migrazione 004). Su un progetto senza giudice la tabella restava
-- vuota: le policy, prudenti, non facevano vedere le formazioni degli
-- avversari nemmeno a partita finita, e l'app chiedeva a chi amministra la
-- lega di incollare SQL. Un dato derivato, uguale per tutte le leghe, deve
-- stare nel database come una tabella, non arrivare per mano di qualcuno.
--
-- Ripetibile: riscrive solo le righe con una data diversa. updated_by resta
-- nullo, e' giusto: non l'ha scritto una persona.

insert into public.matchday_locks (matchday, lock_at) values
${valori}
on conflict (matchday) do update
  set lock_at = excluded.lock_at, updated_at = now(), updated_by = null
  where public.matchday_locks.lock_at is distinct from excluded.lock_at;
`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const righe = righeLock();
  writeFileSync(DESTINAZIONE, sqlCalendarioLock(righe));
  console.log(`scritte ${righe.length} giornate in ${fileURLToPath(DESTINAZIONE)}`);
}
