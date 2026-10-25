import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sqlFutsal } from '../scripts/futsal-sql.mjs';

test('futsal-02-dati.sql e\' allineato al listone e al calendario dell\'app', () => {
  const file = readFileSync(new URL('../supabase/migrations/futsal-02-dati.sql', import.meta.url), 'utf8');
  assert.equal(file, sqlFutsal(), 'rigenera con: node scripts/genera-futsal-sql.mjs');
});
