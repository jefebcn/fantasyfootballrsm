/**
 * Le storie automatiche del futsal: quali farle (social/futsal/storie-futsal.mjs).
 * Una per ogni referto nuovo, una quando l'ultimo referto chiude la giornata,
 * niente se l'import non porta referti nuovi.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../src/futsal.js';
import { readFileSync, existsSync } from 'node:fs';
import { storieNuove, fattiRisultato, fattiGiornata, htmlRisultato, fotoPer } from '../social/futsal/storie-futsal.mjs';

const CAL = [
  [11, 'a', 'b', '2026-11-23T20:15:00+01:00', '', 1, 0],
  [11, 'c', 'd', '2026-11-26T22:00:00+01:00', '', null, null],
  [12, 'a', 'c', '2026-11-30T20:15:00+01:00', '', null, null],
];
const ref = (g, casa, ospite) => ({ g, casa, ospite, distinte: [[], []], eventi: [] });
const ORA = Date.parse('2026-11-27T15:00:00+01:00');

test('nessun referto nuovo: nessuna storia', () => {
  const d = { CALENDARIO: CAL, REFERTI: [ref(11, 'a', 'b')] };
  assert.deepEqual(storieNuove(d, d, ORA), []);
});

test('un referto nuovo che non chiude la giornata: solo il risultato', () => {
  const prima = { CALENDARIO: CAL, REFERTI: [] };
  const dopo = { CALENDARIO: CAL, REFERTI: [ref(11, 'a', 'b')] };
  assert.deepEqual(storieNuove(prima, dopo, ORA).map((s) => s.id), ['futsal-risultato-11-a-b']);
});

test("l'ultimo referto della giornata: risultato e poi la giornata", () => {
  const prima = { CALENDARIO: CAL, REFERTI: [ref(11, 'a', 'b')] };
  const dopo = { CALENDARIO: CAL, REFERTI: [ref(11, 'a', 'b'), ref(11, 'c', 'd')] };
  assert.deepEqual(storieNuove(prima, dopo, ORA).map((s) => s.id), ['futsal-risultato-11-c-d', 'futsal-giornata-11']);
});

test('i fatti di un referto vero: risultato, marcatori e migliore dai dati FSGC', () => {
  const p = F.PARTITE.find((x) => F.referto(x.g, x.casa));
  const f = fattiRisultato(F, { g: p.g, casa: p.casa, ospite: p.ospite });
  assert.equal(f.gc, p.gc); assert.equal(f.go, p.go);
  // i gol elencati tornano col risultato (autogol compresi)
  assert.equal(f.gol[0].length, p.gc); assert.equal(f.gol[1].length, p.go);
  const html = htmlRisultato(f, 'file:///x');
  assert.match(html, /Risultato finale/); assert.match(html, /Link in bio/); assert.doesNotMatch(html, /fantatitano\.site/);
});

test('giornata finita prima del lancio: si dice da quando si gioca, in ora di San Marino', () => {
  const lancio = Date.parse('2026-12-01T08:00:00+01:00');
  const f = fattiGiornata(F, { g: 10 }, { ora: Date.parse('2026-11-27T12:00:00Z'), lancio });
  assert.equal(f.top.length, 3);
  assert.match(f.dopo.titolo, /Si gioca dal 01\/12/);
  assert.match(f.dopo.sotto, /alle 8 /);
});

test('foto di sfondo: prima la stessa partita, poi una delle due squadre; ogni foto dell\'elenco esiste', () => {
  const pool = [
    { id: '1', casa: 'a', ospite: 'b', credito: '© FSGC / X' },
    { id: '2', casa: 'c', ospite: 'a', credito: '© FSGC / Y' },
    { id: '3', casa: 'd', ospite: 'e', credito: '© FSGC / Z' },
  ];
  assert.equal(fotoPer(pool, 'b', 'a', 7).id, '1');          // stessa partita, campi invertiti
  assert.deepEqual([0, 1].map((g) => fotoPer(pool, 'a', 'x', g).id), ['1', '2']); // gira con la giornata
  assert.equal(fotoPer(pool, 'x', 'y', 2).id, '3');          // nessuna delle due: una qualunque
  assert.equal(fotoPer([], 'a', 'b', 0), null);
  const vere = JSON.parse(readFileSync(new URL('../social/futsal/foto-partite.json', import.meta.url), 'utf8')).foto;
  const club = new Set(F.SQUADRE.map((s) => s.id));
  for (const f of vere) {
    assert.ok(existsSync(new URL(`../social/futsal/foto/${f.id}.jpg`, import.meta.url)), `manca la foto ${f.id}`);
    assert.ok(club.has(f.casa) && club.has(f.ospite), `squadra sconosciuta in ${f.id}`);
    assert.match(f.credito, /^© FSGC \/ \S/);
  }
  for (const c of club) assert.ok(vere.some((f) => f.casa === c || f.ospite === c), `nessuna foto per ${c}`);
  const p = F.PARTITE.find((x) => F.referto(x.g, x.casa));
  const html = htmlRisultato({ ...fattiRisultato(F, { g: p.g, casa: p.casa, ospite: p.ospite }), foto: vere[0] }, 'file:///x');
  assert.match(html, new RegExp(`social/futsal/foto/${vere[0].id}\\.jpg`)); assert.match(html, /© FSGC \//);
});
