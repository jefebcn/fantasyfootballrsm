/**
 * I nomi corti dei giocatori futsal (Alex, 27/11): «Cognome N.», ma due
 * giocatori non devono mai avere lo stesso (Conti G. e Conti G. nel Tre Fiori).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../src/futsal.js';

test('nessun nome corto uguale a un altro', () => {
  const visti = new Map();
  for (const g of F.GIOCATORI_FUTSAL) {
    const n = F.nomeBreve(g);
    assert.ok(!visti.has(n), `${n}: ${visti.get(n)} e ${g.id}`);
    visti.set(n, g.id);
  }
});

test('di solito «Cognome N.», col nome intero solo se serve', () => {
  const per = (nome, cognome) => F.GIOCATORI_FUTSAL.find((g) => g.nome === nome && g.cognome === cognome);
  assert.equal(F.nomeBreve(per('Danilo', 'Busignani')), 'Busignani D.');
  assert.equal(F.nomeBreve(per('Enzo Gabriel', 'Molinas')), 'Molinas E.');
  assert.equal(F.nomeBreve(per('Giacomo', 'Conti')), 'Conti Giacomo');
  assert.equal(F.nomeBreve(per('Giovanni', 'Conti')), 'Conti Giovanni');
  assert.match(F.nomeBreve(F.GIOCATORI_FUTSAL.find((g) => g.cognome === 'Muccioli' && g.club === 'folgore')), /\(Folgore\)$/);
});
