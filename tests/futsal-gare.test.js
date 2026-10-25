import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classificaSomma, girone, classificaScontri, calendarioTesta, coppa, formatoCoppa, mescola, posizioniTabellone } from '../src/futsal-gare.js';

const ids = (n) => Array.from({ length: n }, (_, i) => `u${String(i).padStart(3, '0')}`);
// punteggi finti ma deterministici: chi ha l'indice piu' basso fa di piu'
const forza = (id) => 100 - Number(id.slice(1));
const tutti = (ultima) => (g, id) => (g <= ultima ? forza(id) + (g % 3) : null);

test('girone: ognuno incontra tutti una volta, anche dispari', () => {
  for (const n of [4, 5, 8, 25]) {
    const t = girone(ids(n));
    const visti = new Map(ids(n).map((x) => [x, new Set()]));
    for (const turno of t) for (const [a, b] of turno) if (a && b) { visti.get(a).add(b); visti.get(b).add(a); }
    for (const [x, s] of visti) assert.equal(s.size, n - 1, `${n} squadre, ${x}`);
  }
});
test('classifica a somma: totale, poi media sulle consegnate, poi miglior giornata', () => {
  const p = { a: [10, 10], b: [20, 0], c: [5, 15] };
  const r = classificaSomma(['a', 'b', 'c'], [1, 2], (g, id) => p[id][g - 1]);
  assert.deepEqual(r.map((x) => x.id), ['b', 'c', 'a']);
  assert.equal(r[0].media, 20);
});
test('testa a testa: 3 alla vittoria, 1 al pari, calendario dall\'avvio alla 30ª', () => {
  const cal = calendarioTesta(['a', 'b', 'c', 'd'], 7);
  assert.equal(cal[0].giornata, 7); assert.equal(cal.at(-1).giornata, 30);
  const p = { a: 50, b: 40, c: 40, d: 30 };
  const { classifica } = classificaScontri(['a', 'b', 'c', 'd'], cal.slice(0, 3), (g, id) => (g <= 9 ? p[id] : null));
  assert.equal(classifica[0].id, 'a'); assert.equal(classifica[0].punti, 9);
  assert.equal(classifica.at(-1).punti, 0);
});
test('riposo contro la media del girone nei preliminari', () => {
  const { partite } = classificaScontri(['a', 'b', 'c'], [{ giornata: 1, coppie: [['a', null], ['b', 'c']] }], (g, id) => ({ a: 30, b: 60, c: 0 })[id], { mediaAlRiposo: true });
  assert.equal(partite[0].sfide[0].pb, 30);
});
test('formato della coppa secondo gli iscritti', () => {
  assert.equal(formatoCoppa(7), null);
  assert.equal(formatoCoppa(8).nome, 'ridotto');
  assert.equal(formatoCoppa(24).nome, 'medio');
  assert.equal(formatoCoppa(60).nome, 'completo');
});
test('il sorteggio e\' lo stesso per tutti e cambia col seme', () => {
  assert.deepEqual(mescola(ids(10), 's'), mescola(ids(10), 's'));
  assert.notDeepEqual(mescola(ids(10), 's'), mescola(ids(10), 't'));
});
test('tabellone: 1 e 2 solo in finale', () => {
  assert.deepEqual(posizioniTabellone(4), [1, 4, 2, 3]);
  assert.deepEqual(posizioniTabellone(8), [1, 8, 4, 5, 2, 7, 3, 6]);
});
test('coppa completa con 60 iscritti: 32 ai gironi, 16 al tabellone, ottavi alla 21ª, un campione', () => {
  const c = coppa(ids(60), tutti(30));
  assert.equal(c.preliminari.length, 2);
  assert.equal(c.gironi.length, 8);
  assert.ok(c.gironi.every((g) => g.classifica.length === 4));
  assert.equal(c.tabellone[0].nome, 'Ottavi');
  assert.deepEqual(c.tabellone[0].giornate, [21, 22]);
  assert.deepEqual(c.tabellone.at(-1).giornate, [27]);
  assert.equal(c.campione, 'u000');
});
test('coppa ridotta con 10 iscritti: due gironi da cinque, semifinali', () => {
  const c = coppa(ids(10), tutti(30));
  assert.equal(c.preliminari, null);
  assert.deepEqual(c.gironi.map((g) => g.classifica.length), [5, 5]);
  assert.equal(c.tabellone[0].nome, 'Semifinali');
  assert.ok(c.campione);
});
test('la coppa si ferma dove si fermano i punteggi', () => {
  const c = coppa(ids(30), tutti(12));
  assert.ok(c.preliminari);
  assert.equal(c.gironi, null);
  assert.equal(c.tabellone.length, 0);
});
