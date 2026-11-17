import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { SQUADRE } from '../src/futsal.js';

// Il futsal usa gli stessi stemmi di fantasia del calcio (media/stemmi):
// ogni squadra del campionato di futsal deve averne uno, anche offline.
test('ogni squadra del futsal ha il suo stemma, grande e piccolo', () => {
  for (const s of SQUADRE) {
    assert.ok(existsSync(`media/stemmi/${s.id}.webp`), `${s.id}.webp`);
    assert.ok(existsSync(`media/stemmi/${s.id}-mini.webp`), `${s.id}-mini.webp`);
  }
});

test('gli stemmi piccoli del futsal sono nel precache del service worker', () => {
  const sw = readFileSync('sw.js', 'utf8');
  for (const s of SQUADRE) assert.ok(sw.includes(`./media/stemmi/${s.id}-mini.webp`), s.id);
});

test('le viste del futsal mostrano lo stemma, non il tondo, per le squadre', () => {
  const v = readFileSync('src/views/futsal.js', 'utf8');
  assert.match(v, /media\/stemmi\/\$\{encodeURIComponent\(id\)\}-mini\.webp/);
});
