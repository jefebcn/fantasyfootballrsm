// Le mosse dell'editor della formazione (src/formazione-mosse.js): ogni cambio
// e' uno scambio in un passo, e nessuno sparisce o si sdoppia per strada.
import test from 'node:test';
import assert from 'node:assert/strict';
import { posti, dove, mettiInCampo, togliDalCampo, mettiInPanchina, togliDallaPanchina, spostaInPanchina, completaPanchina, tribuna } from '../src/formazione-mosse.js';

// rosa finta: p1..p3, d1..d8, c1..c8, a1..a6; la quotazione e' il numero
const ruolo = (id) => id[0].toUpperCase();
const valore = (id) => Number(id.slice(1));
const rosa = [...['p1', 'p2', 'p3'], ...Array.from({ length: 8 }, (_, i) => `d${i + 1}`), ...Array.from({ length: 8 }, (_, i) => `c${i + 1}`), ...Array.from({ length: 6 }, (_, i) => `a${i + 1}`)];
const nuova = () => ({
  formation: '4-4-2',
  starters: ['p1', 'd1', 'd2', 'd3', 'd4', 'c1', 'c2', 'c3', 'c4', 'a1', 'a2'],
  bench: ['p2', 'd5', 'c5', 'a3'], captainId: 'a1', viceCaptainId: 'c1',
});
const tutti = (d) => [...d.starters, ...d.bench].filter(Boolean);
const senzaDoppioni = (d) => assert.equal(new Set(tutti(d)).size, tutti(d).length, 'nessuno due volte');

test('dalla panchina al campo in un passo: il titolare si siede al posto suo', () => {
  const d = nuova();
  const r = mettiInCampo(d, 'A', 1, 'a3', ruolo);
  assert.deepEqual(posti(d, ruolo).A, ['a1', 'a3']);
  assert.deepEqual(d.bench, ['p2', 'd5', 'c5', 'a2']);
  assert.equal(r.fuori, 'a2'); assert.equal(r.va, 'panchina');
  senzaDoppioni(d);
});

test('dalla tribuna al campo: il titolare va in tribuna, la panchina non cambia', () => {
  const d = nuova();
  const r = mettiInCampo(d, 'D', 0, 'd8', ruolo);
  assert.deepEqual(posti(d, ruolo).D, ['d8', 'd2', 'd3', 'd4']);
  assert.deepEqual(d.bench, ['p2', 'd5', 'c5', 'a3']);
  assert.equal(r.va, 'tribuna');
  assert.ok(tribuna(d, rosa).includes('d1'));
  senzaDoppioni(d);
});

test('il capitano che esce perde la fascia, e lo si dice', () => {
  const d = nuova();
  const r = mettiInCampo(d, 'A', 0, 'a3', ruolo);
  assert.equal(d.captainId, null);
  assert.deepEqual(r.fasce, ['capitano']);
  assert.equal(d.viceCaptainId, 'c1', 'il vice resta');
});

test('un posto vuoto si riempie dalla panchina e la panchina si ricompatta', () => {
  const d = nuova();
  togliDalCampo(d, 'C', 2, ruolo);
  // il posto vuoto va in fondo alla linea: e' quello che il campo mostra
  assert.deepEqual(posti(d, ruolo).C, ['c1', 'c2', 'c4', null]);
  const r = mettiInCampo(d, 'C', 3, 'c5', ruolo);
  assert.equal(r.fuori, null);
  assert.deepEqual(posti(d, ruolo).C, ['c1', 'c2', 'c4', 'c5']);
  assert.deepEqual(d.bench, ['p2', 'd5', 'a3']);
  senzaDoppioni(d);
});

test('in panchina: dalla tribuna sostituisce chi c\'era, fra due posti si scambiano', () => {
  const d = nuova();
  assert.equal(mettiInPanchina(d, 1, 'd7').fuori, 'd5');
  assert.deepEqual(d.bench, ['p2', 'd7', 'c5', 'a3']);
  mettiInPanchina(d, 0, 'a3');
  assert.deepEqual(d.bench, ['a3', 'd7', 'c5', 'p2']);
  mettiInPanchina(d, d.bench.length, 'c8');
  assert.deepEqual(d.bench, ['a3', 'd7', 'c5', 'p2', 'c8']);
  senzaDoppioni(d);
});

test('la panchina non va oltre i 7', () => {
  const d = nuova();
  for (const id of ['d6', 'd7', 'c6']) mettiInPanchina(d, d.bench.length, id);
  assert.equal(d.bench.length, 7);
  assert.equal(mettiInPanchina(d, 7, 'c7').piena, true);
  assert.equal(d.bench.length, 7);
});

test('togli e sposta in panchina', () => {
  const d = nuova();
  assert.equal(spostaInPanchina(d, 0, -1), false);
  assert.equal(spostaInPanchina(d, 0, +1), true);
  assert.deepEqual(d.bench, ['d5', 'p2', 'c5', 'a3']);
  assert.equal(togliDallaPanchina(d, 1).fuori, 'p2');
  assert.deepEqual(d.bench, ['d5', 'c5', 'a3']);
});

test('completa la panchina: prima un portiere, poi un riserva per ruolo, i migliori', () => {
  const d = { ...nuova(), bench: [] };
  const presi = completaPanchina(d, rosa, ruolo, valore);
  assert.equal(d.bench.length, 7);
  assert.deepEqual(d.bench.map(ruolo), ['P', 'D', 'C', 'A', 'D', 'C', 'A']);
  assert.deepEqual(d.bench.slice(0, 4), ['p3', 'd8', 'c8', 'a6'], 'a parita\' di ruolo la quotazione piu\' alta');
  assert.equal(presi.length, 7);
  senzaDoppioni(d);
});

test('completa la panchina: tiene chi c\'e\' gia\' e salta gli squalificati se c\'e\' altro', () => {
  const d = nuova();
  completaPanchina(d, rosa, ruolo, valore, (id) => id === 'd8');
  assert.deepEqual(d.bench.slice(0, 4), ['p2', 'd5', 'c5', 'a3']);
  assert.equal(d.bench.length, 7);
  assert.ok(!d.bench.includes('d8'));
  senzaDoppioni(d);
});

test('dove: campo, panchina o tribuna', () => {
  const d = nuova();
  assert.deepEqual(dove(d, 'c3', ruolo), { campo: true, ruolo: 'C', i: 2 });
  assert.deepEqual(dove(d, 'a3', ruolo), { panca: true, i: 3 });
  assert.equal(dove(d, 'd8', ruolo), null);
});
