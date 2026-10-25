/**
 * Quali errori arrivano in Console: solo quelli nati dai file dell'app.
 *
 * Gli altri (Alex, 11/10) erano «Script error.» di Safari senza file, e un
 * errore di Chrome per iPhone che come file dava la pagina stessa: codice
 * aggiunto dal browser, che nessuno puo' correggere.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dalNostroCodice, promessaEsterna } from '../src/diagnostica.js';

const SITO = 'https://fantatitano.site';

test('un file .js dell\'app conta', () => {
  assert.equal(dalNostroCodice(`${SITO}/src/views/leghe.js`, SITO), true);
  assert.equal(dalNostroCodice(`${SITO}/vendor/supabase-js.js`, SITO), true);
  assert.equal(dalNostroCodice(`${SITO}/src/app.js?v=4.2.143`, SITO), true);
});

test('«Script error.» senza file non conta', () => {
  assert.equal(dalNostroCodice('', SITO), false);
  assert.equal(dalNostroCodice(undefined, SITO), false);
});

test('la pagina stessa non conta: non ha codice dentro', () => {
  // il caso vero: Chrome per iPhone, «https://fantatitano.site/#/leghe:196»
  assert.equal(dalNostroCodice(`${SITO}/#/leghe`, SITO), false);
  assert.equal(dalNostroCodice(`${SITO}/`, SITO), false);
});

test('uno script di un altro sito non conta', () => {
  assert.equal(dalNostroCodice('https://estensione.example/inject.js', SITO), false);
  assert.equal(dalNostroCodice('https://fantatitano.site.altro.example/x.js', SITO), false);
  assert.equal(dalNostroCodice('__playwright_evaluation_script__', SITO), false);
});

test("le promesse rifiutate dalle estensioni di Safari non partono", () => {
  // il caso vero: Safari da computer, 25/10, su home e benvenuto
  assert.equal(promessaEsterna(new Error('No Listener: tabs:outgoing.message.ready'), SITO), true);
  assert.equal(promessaEsterna('No Listener: tabs:outgoing.message.ready', SITO), true);
  const est = new Error('x'); est.stack = 'Error: x\n    at safari-web-extension://ABC/content.js:1:2';
  assert.equal(promessaEsterna(est, SITO), true);
});

test("le promesse rifiutate dell'app partono", () => {
  const nostra = new Error('rete'); nostra.stack = `Error: rete\n    at ${SITO}/src/backend.js:10:3`;
  assert.equal(promessaEsterna(nostra, SITO), false);
  assert.equal(promessaEsterna({ message: 'JWT expired' }, SITO), false);
  assert.equal(promessaEsterna(undefined, SITO), false);
});
