/**
 * Quando l'import resta acceso: la finestra delle partite.
 * Le date vere del calendario, non inventate: la 4a giornata si e' giocata
 * dal 18 al 20 settembre, e dopo c'e' stata la pausa fino al 9 ottobre.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { siGioca, finestre } from '../scripts/finestra-partite.mjs';
import { CALENDARIO } from '../src/calendario-dati.js';

const a = (iso) => Date.parse(iso);

test('una finestra per ogni giornata che ha gia una data', () => {
  // la FSGC pubblica le date a blocchi: le giornate senza data non hanno
  // finestra, e la avranno al primo import che porta la data
  const conData = new Set(CALENDARIO.filter((r) => !Number.isNaN(Date.parse(r[3]))).map((r) => r[0]));
  assert.equal(finestre().length, conData.size);
  assert.ok(conData.size >= 1);
});

test("venerdi' sera della 4a si gioca: primo calcio d'inizio 21:15, alle 21:00 si guarda gia'", () => {
  assert.equal(siGioca(a('2026-09-18T21:00:00+02:00')), true);
  assert.equal(siGioca(a('2026-09-18T19:00:00+02:00')), false);
});

test("il lunedi' pomeriggio dopo la 4a si resta accesi: e' quando la FSGC ha pubblicato i referti", () => {
  assert.equal(siGioca(a('2026-09-21T17:00:00+02:00')), true);
});

test('nella pausa fra la 4a e la 5a un giro solo', () => {
  assert.equal(siGioca(a('2026-09-30T12:00:00+02:00')), false);
});

test("un'ora prima del primo calcio d'inizio si comincia a guardare", () => {
  // la 5a comincia venerdi' 9 ottobre: alle 20:30 si', a mezzogiorno no
  const primo = Math.min(...finestre().map(([da]) => da).filter((da) => da > a('2026-10-01T00:00:00Z')));
  assert.equal(siGioca(primo + 60 * 1000), true);
  assert.equal(siGioca(primo - 60 * 60 * 1000), false);
});

test('un calendario con una data rotta non fa saltare tutto', () => {
  assert.doesNotThrow(() => siGioca(Date.now(), [[1, 'a', 'b', 'non-una-data', '', null, null]]));
});
