/**
 * L'anteprima della classifica in home (rifatta il 9/10): chi prende la
 * medaglia, il distacco dal primo, la barra, la propria riga.
 *
 * Il caso vero da cui nasce: la lega pubblica di Alex dopo la prima giornata,
 * un 69,5 in testa e quattro squadre a zero pari merito al secondo posto.
 * Quattro argenti a zero punti sarebbero una bugia.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anteprimaClassifica } from '../src/engine.js';

const riga = (managerId, position, punti) => ({ managerId, position, punti, played: 1 });
const val = (r) => r.punti;

test('podio solo per chi ha punti: i pari merito a zero non sono argenti', () => {
  const st = [riga('a', 1, 69.5), riga('b', 2, 0), riga('c', 2, 0), riga('d', 2, 0), riga('e', 2, 0)];
  const { partita, righe } = anteprimaClassifica(st, val, 'a');
  assert.equal(partita, true);
  assert.deepEqual(righe.map((r) => r.podio), [1, 0, 0, 0, 0]);
  assert.deepEqual(righe.map((r) => r.distacco), [0, 69.5, 69.5, 69.5, 69.5]);
  assert.deepEqual(righe.map((r) => r.quota), [1, 0, 0, 0, 0]);
  assert.equal(righe[0].io, true);
});

test('distacco e barra rispetto al primo; due a pari merito in testa', () => {
  const st = [riga('a', 1, 80), riga('b', 1, 80), riga('c', 3, 60), riga('d', 4, 20)];
  const { righe } = anteprimaClassifica(st, val, 'c');
  assert.deepEqual(righe.map((r) => r.podio), [1, 1, 3, 0]);
  assert.deepEqual(righe.map((r) => r.distacco), [0, 0, 20, 60]);
  assert.deepEqual(righe.map((r) => r.quota), [1, 1, 0.75, 0.25]);
  assert.deepEqual(righe.map((r) => r.io), [false, false, true, false]);
});

test('a classifica ferma niente medaglie, barre ne\' distacchi', () => {
  const st = [riga('a', 1, 0), riga('b', 1, 0), riga('c', 1, 0)];
  const { partita, righe } = anteprimaClassifica(st, val, 'b');
  assert.equal(partita, false);
  assert.ok(righe.every((r) => r.podio === 0 && r.distacco === 0 && r.quota === 0));
});

test('la propria riga si aggiunge se e\' fuori dalle prime cinque', () => {
  const st = Array.from({ length: 8 }, (_, i) => riga('m' + i, i + 1, 100 - i * 10));
  const { righe } = anteprimaClassifica(st, val, 'm7');
  assert.equal(righe.length, 6);
  assert.equal(righe[5].managerId, 'm7');
  assert.equal(righe[5].io, true);
  assert.equal(righe[5].distacco, 70);
});

test('punti negativi: la barra resta vuota, non va sotto zero', () => {
  const st = [riga('a', 1, 10), riga('b', 2, -3)];
  const { righe } = anteprimaClassifica(st, val, 'a');
  assert.equal(righe[1].quota, 0);
  assert.equal(righe[1].distacco, 13);
});
