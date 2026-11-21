// Tesserati presi dalla FSGC con nome e cognome invertiti (Alex, 10/11): la
// pagina FSGC a volte e' «cognome-nome» e l'app scriveva «Nicola M.». Nome e
// cognome giusti stanno in data/extra.json e devono arrivare nell'app.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LISTONE_EXTRA } from '../src/listone-extra.js';
import { buildSeason } from '../src/data.js';

test('i nomi corretti in data/extra.json sono quelli del listone degli extra', () => {
  const extra = JSON.parse(readFileSync('data/extra.json', 'utf8'));
  assert.equal(extra.length, LISTONE_EXTRA.length, 'stesso numero e stesso ordine: gli id sono posizioni');
  extra.forEach((e, i) => {
    assert.equal(LISTONE_EXTRA[i][0], e.club, e.slug);
    if (e.nome) assert.deepEqual([LISTONE_EXTRA[i][1], LISTONE_EXTRA[i][2]], [e.nome, e.cognome], e.slug);
  });
});

test("nell'app il cognome viene prima: Molinari N., Sahud Scutella M., Van Nek T.", () => {
  const { players } = buildSeason();
  const nome = (id) => players.find((p) => p.id === id)?.name;
  assert.equal(nome('academy_26'), 'Molinari N.');
  assert.equal(nome('folgore_27'), 'Sahud Scutella M.');
  assert.equal(nome('trefiori_27'), 'Van Nek T.');
  assert.equal(nome('juvenes_24'), 'Bakalyar Y.');
});
