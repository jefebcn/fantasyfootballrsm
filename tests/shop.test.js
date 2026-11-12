/**
 * Lo shop (Alex, 12/11): i conti dell'app sono quelli del database. Il
 * prezzo vero lo decide la migrazione 056 (shop_prezzo, shop_spedizione):
 * se qualcuno cambia il prezzo in un posto solo, qui si vede.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { ARTICOLI, SPEDIZIONE_CENT, TAGLIE, euro, totaleCent, articolo } from '../src/shop.js';

const sql = readFileSync('supabase/migrations/056-shop.sql', 'utf8');

test('il top costa 18 €, la spedizione 2 €, il ritiro allo stadio niente', () => {
  const m = articolo('top-fantatitano');
  assert.equal(m.prezzoCent, 1800);
  assert.equal(SPEDIZIONE_CENT, 200);
  assert.equal(totaleCent(m, 1, 'ritiro'), 1800);
  assert.equal(totaleCent(m, 1, 'spedizione'), 2000);
  assert.equal(totaleCent(m, 2, 'spedizione'), 3800);   // la spedizione si paga una volta
  assert.equal(euro(2000), '20,00 €');
});

test('prezzi e taglie dell\'app sono gli stessi del database', () => {
  for (const a of ARTICOLI) {
    assert.match(sql, new RegExp(`when '${a.id}' then ${a.prezzoCent}\\b`), `prezzo di ${a.id}`);
  }
  assert.match(sql, new RegExp(`shop_spedizione\\(\\) returns int\\s+language sql immutable as \\$\\$ select ${SPEDIZIONE_CENT} \\$\\$`));
  assert.match(sql, new RegExp(`taglia in \\(${TAGLIE.map((t) => `'${t}'`).join(', ')}\\)`));
});

test('quattro foto per articolo, e ci sono tutte', () => {
  for (const a of ARTICOLI) {
    assert.equal(a.foto.length, 4);
    for (const f of a.foto) assert.ok(existsSync(f.src), f.src);
  }
});
