import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sqlFutsal, sqlQuotazioni } from '../scripts/futsal-sql.mjs';
import { REGOLE_FUTSAL } from '../src/futsal-engine.js';
import { VALORI } from '../src/futsal-valori.js';

test('futsal-02-dati.sql e\' allineato al listone e al calendario dell\'app', () => {
  const file = readFileSync(new URL('../supabase/migrations/futsal-02-dati.sql', import.meta.url), 'utf8');
  assert.equal(file, sqlFutsal(), 'rigenera con: node scripts/genera-futsal-sql.mjs');
});

test('futsal-05-quotazioni.sql ha i valori dell\'app, almeno fino alla prima giornata di mercato', () => {
  const file = readFileSync(new URL('../supabase/migrations/futsal-05-quotazioni.sql', import.meta.url), 'utf8');
  const fino = Number(/fino alla (\d+)ª giornata/.exec(file)[1]);
  // se nel frattempo e' arrivata un'altra giornata il file e' solo piu' corto:
  // basta che quello che dice sia giusto
  assert.ok(fino >= VALORI.base + 1);
  assert.equal(file, sqlQuotazioni(fino), 'rigenera con: node scripts/genera-futsal-sql.mjs');
});

test('il budget del database (futsal-04) e\' quello del regolamento', () => {
  const sql = readFileSync(new URL('../supabase/migrations/futsal-04-rosa.sql', import.meta.url), 'utf8');
  assert.match(sql, new RegExp(`p numeric := ${REGOLE_FUTSAL.budget};`));
  assert.match(sql, new RegExp(`club_max > ${REGOLE_FUTSAL.perClub}`));
});
