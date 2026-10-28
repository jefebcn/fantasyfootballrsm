/**
 * Il testo di supabase/migrations/futsal-02-dati.sql, dal listone e dal
 * calendario dell'app. Sta qui e non nello script perche' la prova possa
 * confrontarlo col file senza scriverlo.
 */
import { GIOCATORI_FUTSAL, GIORNATE, chiusura } from '../src/futsal.js';
import { QUOTATI, quotazione, ultimaPronta } from '../src/futsal-valori.js';

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

/**
 * Il testo di supabase/migrations/futsal-05-quotazioni.sql: le quotazioni di
 * ogni giornata fino all'ultima definitiva (src/futsal-valori.js). Il
 * mercato del database (futsal-04) le usa per i crediti, e senza le righe
 * di una giornata la tiene chiusa.
 */
export function sqlQuotazioni(fino = ultimaPronta()) {
  const righe = [];
  for (let n = 1; n <= fino; n++) for (const id of QUOTATI()) righe.push(`  (${n}, ${q(id)}, ${quotazione(id, n).toFixed(1)})`);
  return `-- Le quotazioni del FantaFutsal, giornata per giornata (FUTSAL.md § 13).
--
-- GENERATO da scripts/genera-futsal-sql.mjs da src/futsal-valori.js: non si
-- modifica a mano, si rigenera dopo ogni importazione dei referti. Arriva
-- fino alla ${fino}ª giornata, l'ultima con le quotazioni definitive.
-- Ripetibile: aggiorna i valori che cambiano (un referto corretto dalla FSGC).

insert into public.futsal_quotazioni (giornata, id, valore) values
${righe.join(',\n')}
on conflict (giornata, id) do update set valore = excluded.valore
  where futsal_quotazioni.valore is distinct from excluded.valore;
`;
}
