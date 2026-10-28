import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as V from '../src/futsal-valori.js';
import { GIOCATORI_FUTSAL, SQUADRE, giocate, conclusa } from '../src/futsal.js';
import { REGOLE_FUTSAL as R } from '../src/futsal-engine.js';

test('ogni giocatore e ogni Porta hanno una quotazione nei limiti, a mezzo credito', () => {
  for (const id of V.QUOTATI()) {
    const q = V.quotazione(id, 1);
    assert.ok(q >= V.VALORI.min && q <= V.VALORI.max, `${id} ${q}`);
    assert.equal(q * 2, Math.round(q * 2), `${id} ${q}`);
  }
  assert.equal(V.QUOTATI().length, GIOCATORI_FUTSAL.filter((g) => g.ruolo !== 'P').length + SQUADRE.length);
});
test('la quotazione di partenza premia media e presenze', () => {
  const top = GIOCATORI_FUTSAL.filter((g) => g.ruolo === 'A').map((g) => V.quotazione(g.id, 1)).sort((a, b) => b - a);
  assert.ok(top[0] >= 10, 'il migliore attaccante costa almeno 10');
  assert.ok(top.at(-1) === V.VALORI.min, 'chi non gioca mai costa il minimo');
});
test('la variazione segue i punti rispetto all\'atteso, al massimo 0,6', () => {
  assert.equal(V.atteso(V.VALORI.min), 4.5);
  for (const id of V.QUOTATI().slice(0, 40)) {
    for (let n = V.VALORI.base + 1; n <= 30; n++) {
      const p = V.plus(id, n);
      assert.ok(Math.abs(p) <= V.VALORI.variazioneMax + 1e-9, `${id} g${n} ${p}`);
    }
  }
  // prima della base le quotazioni non si muovono
  for (let n = 1; n <= V.VALORI.base; n++) assert.equal(V.plus(V.QUOTATI()[0], n), 0);
});
test('il mercato della giornata dopo la base e\' pronto, le altre aspettano la giornata prima', () => {
  assert.equal(V.quotazioniPronte(V.VALORI.base + 1), true);
  const n = Math.max(...giocate()) + 2;
  assert.equal(V.quotazioniPronte(n), conclusa(n - 1));
});

// un iscritto finto: rosa comprata alla 7ª e tenuta
const ids = V.QUOTATI();
const rosa = { porta: 'murata', D: ids.slice(0, 4), A: ids.slice(4, 8) };
test('il bilancio: 70 crediti, la prima rosa e\' gratis, i cambi dopo si contano', () => {
  const b = V.bilancio((k) => (k >= 7 ? rosa : null), 7);
  assert.equal(b.patrimonio, R.budget);
  assert.equal(b.cambi, 0);
  assert.equal(b.residui, Math.round((R.budget - V.costo(rosa, 7)) * 10) / 10);
  const nuova = { ...rosa, A: [...rosa.A.slice(0, 2), ids[8], ids[9]] };
  const c = V.bilancio((k) => (k === 7 ? rosa : k >= 8 ? nuova : null), 8);
  assert.equal(c.cambi, 2);
  assert.equal(c.malus, (2 - R.cambiGratis) * R.malusCambio);
  assert.deepEqual(c.entrati.sort(), [ids[8], ids[9]].sort());
});
test('le plusvalenze di chi si ha in rosa vanno nel patrimonio', () => {
  const b = V.bilancio((k) => (k >= 7 ? rosa : null), 9);
  const atteso = R.budget + [7, 8].reduce((s, k) => s + V.elementi(rosa).reduce((t, id) => t + V.plus(id, k), 0), 0);
  assert.equal(b.patrimonio, Math.round(atteso * 10) / 10);
  // chi tiene la rosa non perde crediti residui quando i prezzi cambiano
  assert.equal(b.residui, V.bilancio((k) => (k >= 7 ? rosa : null), 7).residui);
});
