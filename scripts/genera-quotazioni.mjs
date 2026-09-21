/**
 * Il listino, da mettere nel database.
 *
 * PERCHE'. Il negozio della lega aperta (migrazione 019) legge il prezzo
 * dalla tabella `quotazioni`, non da quello che gli manda il telefono: in una
 * lega con un montepremi, un prezzo che arriva dal client e' una cassa
 * lasciata aperta. Ma il listone vero sta in src/listone-dati.js, che e'
 * dell'app — quindi il database ne ha bisogno di una copia.
 *
 * COME. Si importa la stessa funzione che usa l'app (buildSeason) e si
 * scrive quello che produce. Non c'e' una seconda implementazione che
 * calcola gli identificativi: se i numeri di questo file e quelli dell'app
 * divergessero, il negozio venderebbe giocatori che non esistono.
 *
 *   node scripts/genera-quotazioni.mjs      scrive supabase/seed-quotazioni.sql
 */
import { writeFileSync } from 'node:fs';
import { buildSeason } from '../src/data.js';

const base = buildSeason();
const club = new Map(base.clubs.map((c) => [c.id, c.name]));
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

const righe = base.players.map((p) => `  (${q(p.id)}, ${q(p.role)}, ${p.quotation}, ${q(p.name)}, ${q(club.get(p.clubId) || p.clubId)})`);

const sql = `-- Il listino dentro il database: prezzi e ruoli per il negozio della lega
-- aperta (migrazione 019).
--
-- GENERATO da scripts/genera-quotazioni.mjs — non modificare a mano.
-- Rigenerarlo quando cambia il listone (scripts/importa-listone.py), se no il
-- negozio vende ai prezzi dell'anno scorso.
--
-- Si puo' rieseguire: quello che c'e' viene aggiornato, il resto inserito.
-- Chi e' sparito dal listone NON viene cancellato di proposito: e' gia' nella
-- rosa di qualcuno, e cancellarlo lascerebbe rose con giocatori senza prezzo.
--
-- ${base.players.length} giocatori.

insert into public.quotazioni (player_id, ruolo, quotazione, nome, club) values
${righe.join(',\n')}
on conflict (player_id) do update
  set ruolo = excluded.ruolo, quotazione = excluded.quotazione,
      nome = excluded.nome, club = excluded.club;
`;

writeFileSync('supabase/seed-quotazioni.sql', sql);
console.log(`supabase/seed-quotazioni.sql: ${base.players.length} giocatori, ${Math.round(sql.length / 1024)} kB`);
