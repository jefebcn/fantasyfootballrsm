/**
 * La copertina della home cambia sfondo al tramonto: alba e tramonto sul
 * Titano devono cadere dove li dà il calendario (tolleranza 5 minuti).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sole, eNotte } from '../src/sole.js';

const ora = (s) => Date.parse(s);
const vicino = (a, b) => Math.abs(a - b) < 5 * 60000;

test('12 novembre: alba verso le 7:00, tramonto verso le 16:48 (ora di Roma)', () => {
  const { alba, tramonto } = sole(ora('2026-11-12T12:00:00+01:00'));
  assert.ok(vicino(alba, ora('2026-11-12T07:00:00+01:00')), new Date(alba).toISOString());
  assert.ok(vicino(tramonto, ora('2026-11-12T16:48:00+01:00')), new Date(tramonto).toISOString());
});

test('21 giugno: tramonto verso le 20:56 (ora legale)', () => {
  const { tramonto } = sole(ora('2026-06-21T12:00:00+02:00'));
  assert.ok(vicino(tramonto, ora('2026-06-21T20:56:00+02:00')), new Date(tramonto).toISOString());
});

test('di notte e di giorno', () => {
  assert.equal(eNotte(ora('2026-11-12T12:00:00+01:00')), false);
  assert.equal(eNotte(ora('2026-11-12T21:00:00+01:00')), true);
  assert.equal(eNotte(ora('2026-11-12T05:30:00+01:00')), true);
  assert.equal(eNotte(ora('2026-11-12T00:30:00+01:00')), true);
});
