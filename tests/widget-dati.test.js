// widget.json (scripts/widget-dati.mjs): le giornate per il widget dell'iPhone, con la chiusura dell'app.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { datiWidget } from '../scripts/widget-dati.mjs';
import { buildSeason } from '../src/data.js';

test('una voce per giornata, con la stessa chiusura delle formazioni dell\'app', () => {
  const d = datiWidget(); const s = buildSeason();
  assert.equal(d.giornate.length, s.matchdays.length);
  for (const m of s.matchdays) assert.equal(d.giornate.find((g) => g.giornata === m.number).chiusura, m.lockAt);
});

test('le partite hanno nomi veri e orari validi, in ordine', () => {
  for (const g of datiWidget().giornate) {
    const t = g.partite.map((p) => Date.parse(p.quando));
    assert.ok(t.every(Number.isFinite));
    assert.deepEqual(t, [...t].sort((a, b) => a - b));
    for (const p of g.partite) assert.match(p.casa + p.ospite, /[A-Z][a-z]/);
  }
});
