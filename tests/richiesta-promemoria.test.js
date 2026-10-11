/**
 * Quando la dashboard chiede di attivare il promemoria (Alex, 11/10: «senza
 * essere invasivo»): dopo la prima formazione, solo dove funziona, e con
 * «Non ora» sparisce per due settimane; al secondo no, per sempre.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daChiedere, PAUSA_RICHIESTA_MS } from '../src/notifiche.js';

const ORA = Date.UTC(2026, 9, 11, 10);
const base = { avvisi: undefined, chiesto: null, consegnato: true, permesso: 'default', supportate: true, configurato: true, ora: ORA };

test('dopo la prima formazione, dove funziona, si chiede', () => {
  assert.equal(daChiedere(base), true);
});

test('mai prima della prima formazione', () => {
  assert.equal(daChiedere({ ...base, consegnato: false }), false);
});

test('solo se il permesso e\' ancora da chiedere', () => {
  assert.equal(daChiedere({ ...base, permesso: 'granted' }), false);
  assert.equal(daChiedere({ ...base, permesso: 'denied' }), false);
});

test('non dove le notifiche non ci sono (iPhone nel browser) o le push non sono configurate', () => {
  assert.equal(daChiedere({ ...base, supportate: false, permesso: 'unsupported' }), false);
  assert.equal(daChiedere({ ...base, configurato: false }), false);
});

test('non a chi il promemoria l\'ha spento dalle impostazioni', () => {
  assert.equal(daChiedere({ ...base, avvisi: false }), false);
  assert.equal(daChiedere({ ...base, avvisi: true }), true);
});

test('«Non ora» lo fa sparire per due settimane', () => {
  const chiesto = { volte: 1, ultima: ORA - 3 * 24 * 3600 * 1000 };
  assert.equal(daChiedere({ ...base, chiesto }), false);
  assert.equal(daChiedere({ ...base, chiesto: { volte: 1, ultima: ORA - PAUSA_RICHIESTA_MS } }), true);
});

test('dopo il secondo no non torna piu\'', () => {
  assert.equal(daChiedere({ ...base, chiesto: { volte: 2, ultima: ORA - 365 * 24 * 3600 * 1000 } }), false);
});
