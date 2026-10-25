/**
 * Il testo di supabase/migrations/futsal-02-dati.sql, dal listone e dal
 * calendario dell'app. Sta qui e non nello script perche' la prova possa
 * confrontarlo col file senza scriverlo.
 */
import { GIOCATORI_FUTSAL, GIORNATE, chiusura } from '../src/futsal.js';

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

export function sqlFutsal() {
  const giocatori = GIOCATORI_FUTSAL.map((g) => `  (${q(g.id)}, ${q(g.club)}, ${q(g.ruolo)})`);
  const lock = [];
  for (let n = 1; n <= GIORNATE; n++) { const t = chiusura(n); if (t) lock.push(`  (${n}, ${q(t.toISOString())})`); }
  return `-- Listone e chiusure del futsal (FUTSAL.md §§ 3-4).
--
-- GENERATO da scripts/genera-futsal-sql.mjs dal calendario e dal listone
-- dell'app: non si modifica a mano, si rigenera dopo ogni importazione.
-- Ripetibile: aggiunge i giocatori nuovi, aggiorna squadra e ruolo di chi
-- cambia, e sposta le chiusure delle giornate che la FSGC ha spostato.

insert into public.futsal_giocatori (id, club, ruolo) values
${giocatori.join(',\n')}
on conflict (id) do update set club = excluded.club, ruolo = excluded.ruolo
  where (futsal_giocatori.club, futsal_giocatori.ruolo) is distinct from (excluded.club, excluded.ruolo);

insert into public.futsal_lock (giornata, lock_at) values
${lock.join(',\n')}
on conflict (giornata) do update set lock_at = excluded.lock_at, updated_at = now()
  where futsal_lock.lock_at is distinct from excluded.lock_at;
`;
}
