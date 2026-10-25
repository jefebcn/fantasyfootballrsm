/**
 * Listone e chiusure del futsal dentro il database (supabase/migrations/futsal-02-dati.sql).
 *
 * GENERATO dal calendario e dal listone dell'app (src/futsal-dati.js, che
 * a sua volta viene da scripts/importa-futsal.py): si rigenera dopo ogni
 * importazione. tests/futsal-sql.test.js diventa rossa se il file e' indietro.
 *
 *   node scripts/genera-futsal-sql.mjs
 */
import { writeFileSync } from 'node:fs';
import { sqlFutsal } from './futsal-sql.mjs';

const url = new URL('../supabase/migrations/futsal-02-dati.sql', import.meta.url);
writeFileSync(url, sqlFutsal());
console.log('scritto supabase/migrations/futsal-02-dati.sql');
