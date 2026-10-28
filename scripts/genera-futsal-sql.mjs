/**
 * Listone, chiusure e quotazioni del futsal dentro il database
 * (supabase/migrations/futsal-02-dati.sql e futsal-05-quotazioni.sql).
 *
 * GENERATO dal calendario e dal listone dell'app (src/futsal-dati.js, che
 * a sua volta viene da scripts/importa-futsal.py): si rigenera dopo ogni
 * importazione. tests/futsal-sql.test.js diventa rossa se il file e' indietro.
 *
 *   node scripts/genera-futsal-sql.mjs
 */
import { writeFileSync } from 'node:fs';
import { sqlFutsal, sqlQuotazioni } from './futsal-sql.mjs';

const url = new URL('../supabase/migrations/futsal-02-dati.sql', import.meta.url);
writeFileSync(url, sqlFutsal());
writeFileSync(new URL('../supabase/migrations/futsal-05-quotazioni.sql', import.meta.url), sqlQuotazioni());
console.log('scritti supabase/migrations/futsal-02-dati.sql e futsal-05-quotazioni.sql');
