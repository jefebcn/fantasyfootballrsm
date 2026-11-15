// La richiesta di recensione (src/nativo.js): solo dopo tre formazioni confermate, poi una ogni 120 giorni.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daChiedere, vibra, GIORNI_FRA_RICHIESTE } from '../src/nativo.js';

const G = 86400000;
test('prima della terza formazione confermata non si chiede', () => {
  assert.equal(daChiedere({ conferme: 1 }), false);
  assert.equal(daChiedere({ conferme: 2 }), false);
  assert.equal(daChiedere({ conferme: 3 }), true);
});
test('poi non prima di 120 giorni dall\'ultima volta', () => {
  const ora = Date.parse('2026-12-01');
  assert.equal(daChiedere({ conferme: 9, ultima: ora - 30 * G }, ora), false);
  assert.equal(daChiedere({ conferme: 9, ultima: ora - GIORNI_FRA_RICHIESTE * G }, ora), true);
});
test('vibra fuori dall\'app e senza vibrazione non lancia', () => {
  assert.doesNotThrow(() => vibra('successo'));
});
