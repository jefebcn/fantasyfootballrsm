// L'app installata non deve mai partire con file di due versioni diverse.
//
// Con lo stale-while-revalidate la cache si aggiornava un file alla volta, e
// dopo un'uscita grossa l'app partiva con dashboard.js nuovo e ui.js vecchio:
// "does not provide an export named", schermo bianco, da disinstallare.
// Ora il guscio esce solo dalla cache della sua versione, quindi deve esserci
// TUTTO: un modulo lasciato fuori arriverebbe dalla rete, magari gia' nuovo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const radice = new URL('..', import.meta.url).pathname;
const sw = readFileSync(join(radice, 'sw.js'), 'utf8');

const moduli = (dir) => readdirSync(join(radice, dir)).flatMap((f) => {
  const p = `${dir}/${f}`;
  if (statSync(join(radice, p)).isDirectory()) return moduli(p);
  return p.endsWith('.js') ? [p] : [];
});

test('ogni modulo di src/ e\' nel guscio del service worker', () => {
  const fuori = moduli('src').filter((f) => !sw.includes(`'./${f}'`));
  assert.deepEqual(fuori, [], `fuori dal guscio: ${fuori.join(', ')}`);
});

test('il guscio non si riscarica a pezzi dentro la cache della versione', () => {
  const guscio = sw.slice(sw.lastIndexOf('// Guscio:'));
  assert.match(guscio, /if \(cached\) return cached;/);
  // nessun fetch lanciato quando la copia in cache c'e' gia'
  assert.doesNotMatch(guscio, /const net = fetch/);
});

test('se l\'app non parte c\'e\' la riparazione', () => {
  const html = readFileSync(join(radice, 'index.html'), 'utf8');
  assert.match(html, /__fcsPartita/);
  assert.match(readFileSync(join(radice, 'src/app.js'), 'utf8'), /window\.__fcsPartita = true/);
});
