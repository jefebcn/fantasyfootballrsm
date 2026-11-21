// Il giorno del lancio (01/12): la 12ª chiude il 30/11 e la FSGC non ha ancora
// fissato le date dalla 13ª. Senza una chiusura provvisoria nessuno poteva fare
// la squadra, e dopo il 3/12 l'app saltava alla 30ª.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../src/futsal.js';

const prima = [...Array(F.GIORNATE)].map((_, i) => i + 1).filter((n) => F.chiusura(n) && !F.chiusuraProvvisoria(n)).at(-1);
const dopo = prima + 1;

test('la prima giornata senza date ha una chiusura provvisoria: una settimana dopo, alla stessa ora', () => {
  assert.ok(F.chiusuraProvvisoria(dopo));
  assert.equal(F.chiusura(dopo).getTime() - F.chiusura(prima).getTime(), 7 * 86400e3);
});

test('solo la prima: quelle dopo restano senza data finché la FSGC non le fissa', () => {
  if (dopo + 1 <= F.GIORNATE) assert.equal(F.chiusura(dopo + 1), null);
  assert.equal(F.chiusuraProvvisoria(prima), false);
});

test('finita l\'ultima giornata con le date, la corrente è la successiva, non la 30ª', () => {
  const fine = F.ultimaPartita(prima).getTime() + 6 * 3600e3;
  assert.equal(F.giornataCorrente(fine), dopo);
  assert.equal(F.giornataCorrente(fine + 5 * 86400e3), dopo);
});
