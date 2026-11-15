// Il turno delle storie dei gol (scripts/turno-gol.mjs): segue le partite,
// non la finestra di 48 ore dell'import, e si passa il testimone da solo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blocchi, turno, catena, MASSIMO } from '../scripts/turno-gol.mjs';

const a = (iso) => Date.parse(iso);
// sabato e domenica della 8a (7-8/11): quattro partite alle 15:00 ogni giorno
const CAL = [
  [8, 'folgore', 'virtus', '2026-11-07T15:00:00+01:00'],
  [8, 'juvenes', 'pennarossa', '2026-11-07T15:00:00+01:00'],
  [8, 'fiorentino', 'libertas', '2026-11-08T15:00:00+01:00'],
  [8, 'cailungo', 'trefiori', '2026-11-08T15:00:00+01:00'],
  [9, 'cosmos', 'murata', '2026-11-20T20:45:00+01:00'],
  [9, 'virtus', 'academy', '2026-11-20T21:30:00+01:00'],   // a 45': stesso blocco
  [9, 'faetano', 'trepenne', 'da definire'],
];

test('un blocco per pomeriggio di partite; vicine si uniscono, senza data si saltano', () => {
  const b = blocchi(CAL);
  assert.equal(b.length, 3);
  assert.deepEqual(b[0], [a('2026-11-07T14:30:00+01:00'), a('2026-11-07T18:30:00+01:00')]);
  assert.deepEqual(b[2], [a('2026-11-20T20:15:00+01:00'), a('2026-11-21T01:00:00+01:00')]);
});

test("domenica 8/11: un turno partito alle 13:10 aspetta e guarda fino a fine partite", () => {
  const t = turno(a('2026-11-08T13:10:00+01:00'), CAL);
  assert.equal(t.si, true);
  assert.equal(t.fine, a('2026-11-08T18:30:00+01:00'));
  assert.equal(t.per, (a('2026-11-08T18:30:00+01:00') - a('2026-11-08T13:10:00+01:00')) / 1000);
});

test('troppo presto, il lunedì dopo, nella sosta: non si accende', () => {
  assert.equal(turno(a('2026-11-08T12:00:00+01:00'), CAL).si, false);
  assert.equal(turno(a('2026-11-09T17:00:00+01:00'), CAL).si, false, 'il lunedì non si gioca');
  assert.equal(turno(a('2026-11-15T15:00:00+01:00'), CAL).si, false);
});

test('mai oltre il tempo del lavoro di GitHub', () => {
  const lungo = [[1, 'a', 'b', '2026-12-01T12:00:00Z'], [1, 'c', 'd', '2026-12-01T14:30:00Z'], [1, 'e', 'f', '2026-12-01T17:00:00Z']];
  const t = turno(a('2026-12-01T11:30:00Z'), lungo);
  assert.equal(t.per, MASSIMO / 1000);
});

test('catena: blocco ancora in corso a tempo esaurito -> parte subito il turno dopo', () => {
  const lungo = [[1, 'a', 'b', '2026-12-01T12:00:00Z'], [1, 'c', 'd', '2026-12-01T14:30:00Z'], [1, 'e', 'f', '2026-12-01T17:00:00Z']];
  const t = turno(a('2026-12-01T11:30:00Z'), lungo);
  const finito = t.inizio + t.per * 1000;
  assert.equal(catena(finito, t.inizio, t.per, t.fine, lungo), true);
  // e quello dopo trova davvero partite da guardare
  assert.equal(turno(finito, lungo).si, true);
});

test('catena: uscito prima perché le partite sono finite -> niente turno dopo', () => {
  const t = turno(a('2026-11-08T14:00:00+01:00'), CAL);
  assert.equal(catena(a('2026-11-08T17:10:00+01:00'), t.inizio, t.per, t.fine, CAL), false);
});

test('catena: a fine blocco, niente se il prossimo è lontano (lo prende il turno orario)', () => {
  const t = turno(a('2026-11-07T14:40:00+01:00'), CAL);
  assert.equal(catena(t.inizio + t.per * 1000, t.inizio, t.per, t.fine, CAL), false);
});
