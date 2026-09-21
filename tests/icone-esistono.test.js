/**
 * Ogni icona chiesta col nome esiste davvero nello sprite.
 *
 * icon('close') non fallisce: restituisce <svg><use href="#i-close"/></svg>, e
 * il browser disegna il nulla. Nessun errore in console, nessuna prova rossa,
 * solo un bottone vuoto che si scopre guardando la schermata — e le schermate
 * sono trenta. E' successo mentre scrivevo il negozio: 'close' non c'e', c'e'
 * 'trash'.
 *
 * Qui si leggono tutte le chiamate a icon('...') del codice e si controlla che
 * il nome stia fra gli id di src/sprite.js.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const sprite = readFileSync('src/sprite.js', 'utf8');
const esistenti = new Set([...sprite.matchAll(/id="i-([a-z0-9-]+)"/g)].map((m) => m[1]));

function file(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? file(p) : (e.name.endsWith('.js') ? [p] : []);
  });
}

test('lo sprite ha le icone che il codice chiede per nome', () => {
  assert.ok(esistenti.size > 20, `lo sprite sembra vuoto (${esistenti.size} icone)`);
  const mancanti = [];
  for (const f of file('src')) {
    const src = readFileSync(f, 'utf8');
    // Solo i nomi scritti a mano: icon(variabile) qui non si puo' controllare,
    // e fingere il contrario darebbe una prova che rassicura senza guardare.
    for (const m of src.matchAll(/\bicon\(\s*'([a-z0-9-]+)'/g)) {
      if (!esistenti.has(m[1])) mancanti.push(`${f}: icon('${m[1]}')`);
    }
  }
  assert.deepEqual(mancanti, [], `icone chieste e non disegnate:\n  ${mancanti.join('\n  ')}`);
});
