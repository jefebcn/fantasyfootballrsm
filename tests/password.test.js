// Le regole della password dell'app sono quelle del server (src/password.js):
// 6 caratteri, una lettera e un numero. Il server risponde in inglese, l'app
// deve fermare prima e dire cosa manca in italiano.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mancano, erroreRegole } from '../src/password.js';

test('vanno bene lettere e numeri, da 6 caratteri in su', () => {
  for (const p of ['calcio1', 'Titano2026', 'àèìòù9', 'a1b2c3']) assert.equal(erroreRegole(p), '', p);
});

test('dice cosa manca, in italiano', () => {
  assert.deepEqual(mancano('calcio'), ['un numero']);
  assert.deepEqual(mancano('123456'), ['una lettera']);
  assert.deepEqual(mancano('ab1'), ['almeno 6 caratteri']);
  assert.equal(erroreRegole(''), 'La password deve avere almeno 6 caratteri, una lettera e un numero.');
  assert.equal(erroreRegole('calcio'), 'La password deve avere un numero.');
});
