/**
 * Quali errori arrivano in Console: solo quelli nati dai file dell'app.
 *
 * Gli altri (Alex, 11/10) erano «Script error.» di Safari senza file, e un
 * errore di Chrome per iPhone che come file dava la pagina stessa: codice
 * aggiunto dal browser, che nessuno puo' correggere.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dalNostroCodice } from '../src/diagnostica.js';

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
