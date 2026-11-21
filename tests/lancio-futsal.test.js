// Le icone del lancio del Futsal (Alex, 21/11): solo dal 1° al 14 dicembre.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { inLancio, iconeLancio } from '../src/lancio-futsal.js';

const ora = (s) => Date.parse(s);

test('vale dal 1° dicembre a mezzanotte al 14 compreso, ora italiana', () => {
  assert.equal(inLancio(ora('2026-11-30T23:59:00+01:00')), false);
  assert.equal(inLancio(ora('2026-12-01T00:00:00+01:00')), true);
  assert.equal(inLancio(ora('2026-12-14T23:59:00+01:00')), true);
  assert.equal(inLancio(ora('2026-12-15T00:00:00+01:00')), false);
});

test('fuori dal lancio le icone restano quelle di sempre', () => {
  const link = { href: 'icons/icon-192.png' };
  const doc = { querySelector: () => link };
  assert.equal(iconeLancio(ora('2026-11-21T12:00:00+01:00'), doc), false);
  assert.equal(link.href, 'icons/icon-192.png');
});

test('nel lancio cambia scheda del browser e icona della Home, e i file ci sono', () => {
  const links = { 'link[rel="icon"]': { href: '' }, 'link[rel="apple-touch-icon"]': { href: '' } };
  const classi = new Set();
  const doc = { querySelector: (s) => links[s], documentElement: { classList: { add: (c) => classi.add(c) } } };
  assert.equal(iconeLancio(ora('2026-12-07T12:00:00+01:00'), doc), true);
  assert.ok(classi.has('lancio-futsal'), 'la corona dentro l\'app cambia colore');
  for (const l of Object.values(links)) {
    assert.match(l.href, /^icons\/lancio-futsal\//);
    assert.ok(existsSync(new URL(`../${l.href}`, import.meta.url)), l.href);
  }
});
