// La versione scritta in fondo all'app e' quella del service worker.
// Prima c'era «Versione 0.5» scritto a mano e non cambiava mai: Alex, 10/10.
// Le scrive insieme scripts/bump-sw.py; qui si guarda che non si separino.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VERSIONE } from '../src/versione.js';

const radice = new URL('..', import.meta.url);
const leggi = (f) => readFileSync(new URL(f, radice), 'utf8');

test('la versione dell\'app e\' quella del service worker', () => {
  const sw = /const VERSION = 'fcs-v([0-9.]+)'/.exec(leggi('sw.js'))[1];
  assert.equal(VERSIONE, sw);
});

test('nel menu e nelle impostazioni la versione non e\' scritta a mano', () => {
  for (const f of ['src/app.js', 'src/views/impostazioni.js']) {
    assert.doesNotMatch(leggi(f), /Versione [0-9]/, `${f} ha ancora una versione scritta a mano`);
  }
});

test('src/versione.js sta nel guscio del service worker', () => {
  assert.match(leggi('sw.js'), /'\.\/src\/versione\.js'/);
});
