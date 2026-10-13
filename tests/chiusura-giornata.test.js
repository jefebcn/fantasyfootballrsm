// Una giornata si chiude dal martedi' alle 20:00, ora di San Marino, dopo la
// chiusura delle formazioni (035): la stessa regola del database, calcolata
// nell'app per dirla sul tasto. Ora legale compresa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chiusuraGiornata } from '../src/chiusura.js';

test('il martedi\' dopo, alle 20:00 di San Marino', () => {
  assert.equal(chiusuraGiornata('2026-10-09T21:15:00+02:00').toISOString(), '2026-10-13T18:00:00.000Z');
  // la 6ª: formazioni il 23/10 in ora legale, martedi' 27/10 gia' in ora solare
  assert.equal(chiusuraGiornata('2026-10-23T21:15:00+02:00').toISOString(), '2026-10-27T19:00:00.000Z');
  // turno di martedi' pomeriggio: la sera stessa; martedi' sera tardi: la settimana dopo
  assert.equal(chiusuraGiornata('2026-10-13T18:30:00+02:00').toISOString(), '2026-10-13T18:00:00.000Z');
  assert.equal(chiusuraGiornata('2026-10-13T20:45:00+02:00').toISOString(), '2026-10-20T18:00:00.000Z');
  assert.equal(chiusuraGiornata(null), null);
});
