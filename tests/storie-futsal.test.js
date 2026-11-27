/**
 * Le storie automatiche del futsal: quali farle (social/futsal/storie-futsal.mjs).
 * Una per ogni referto nuovo, una quando l'ultimo referto chiude la giornata,
 * niente se l'import non porta referti nuovi.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../src/futsal.js';
import { storieNuove, fattiRisultato, fattiGiornata, htmlRisultato } from '../social/futsal/storie-futsal.mjs';

const CAL = [
  [11, 'a', 'b', '2026-11-23T20:15:00+01:00', '', 1, 0],
  [11, 'c', 'd', '2026-11-26T22:00:00+01:00', '', null, null],
  [12, 'a', 'c', '2026-11-30T20:15:00+01:00', '', null, null],
];
const ref = (g, casa, ospite) => ({ g, casa, ospite, distinte: [[], []], eventi: [] });
const ORA = Date.parse('2026-11-27T15:00:00+01:00');

test('nessun referto nuovo: nessuna storia', () => {
  const d = { CALENDARIO: CAL, REFERTI: [ref(11, 'a', 'b')] };
  assert.deepEqual(storieNuove(d, d, ORA), []);
});

test('un referto nuovo che non chiude la giornata: solo il risultato', () => {
  const prima = { CALENDARIO: CAL, REFERTI: [] };
  const dopo = { CALENDARIO: CAL, REFERTI: [ref(11, 'a', 'b')] };
  assert.deepEqual(storieNuove(prima, dopo, ORA).map((s) => s.id), ['futsal-risultato-11-a-b']);
});

test("l'ultimo referto della giornata: risultato e poi la giornata", () => {
  const prima = { CALENDARIO: CAL, REFERTI: [ref(11, 'a', 'b')] };
  const dopo = { CALENDARIO: CAL, REFERTI: [ref(11, 'a', 'b'), ref(11, 'c', 'd')] };
  assert.deepEqual(storieNuove(prima, dopo, ORA).map((s) => s.id), ['futsal-risultato-11-c-d', 'futsal-giornata-11']);
});

test('i fatti di un referto vero: risultato, marcatori e migliore dai dati FSGC', () => {
  const p = F.PARTITE.find((x) => F.referto(x.g, x.casa));
  const f = fattiRisultato(F, { g: p.g, casa: p.casa, ospite: p.ospite });
  assert.equal(f.gc, p.gc); assert.equal(f.go, p.go);
  // i gol elencati tornano col risultato (autogol compresi)
  assert.equal(f.gol[0].length, p.gc); assert.equal(f.gol[1].length, p.go);
  const html = htmlRisultato(f, 'file:///x');
  assert.match(html, /Risultato finale/); assert.match(html, /Link in bio/); assert.doesNotMatch(html, /fantatitano\.site/);
});

test('giornata finita prima del lancio: si dice da quando si gioca, in ora di San Marino', () => {
  const lancio = Date.parse('2026-12-01T08:00:00+01:00');
  const f = fattiGiornata(F, { g: 10 }, { ora: Date.parse('2026-11-27T12:00:00Z'), lancio });
  assert.equal(f.top.length, 3);
  assert.match(f.dopo.titolo, /Si gioca dal 01\/12/);
  assert.match(f.dopo.sotto, /alle 8 /);
});
