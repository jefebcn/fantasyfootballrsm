/**
 * «Chi è?», il giocatore del giorno: la scelta, gli indizi, la condivisione.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { misteroDel, statistiche, confronta, condivisione, serie, numero, oggi, TENTATIVI } from '../src/gioco.js';
import { buildSeason } from '../src/data.js';

const giorno = (i) => new Date(Date.parse('2026-10-27T12:00:00Z') + i * 864e5).toISOString().slice(0, 10);

const g = (id, clubId, role, age, quotation) => ({ id, clubId, role, age, quotation, isActive: true, name: id });
const PARTITE = [1, 2, 3, 4].map((n) => ({ id: `m${n}`, kickoffAt: `2026-09-0${n}T15:00:00+02:00` }));
const presenze = (id, n) => PARTITE.slice(0, n).map((m) => ({ matchId: m.id, playerId: id }));

test('il giocatore del giorno e\' lo stesso per tutti e cambia ogni giorno', () => {
  const b = buildSeason(); const st = statistiche(b);
  const a = misteroDel(giorno(0), b.players, st);
  assert.ok(a);
  assert.equal(misteroDel(giorno(0), b.players, statistiche(b)).id, a.id);
  const visti = new Set(Array.from({ length: 30 }, (_, i) => misteroDel(giorno(i), b.players, st).id));
  assert.equal(visti.size, 30, 'nessuno torna entro un mese');
});

test('solo chi ha gia\' tre presenze il giorno prima, ed e\' attivo', () => {
  const players = [g('tre', 'a', 'C', 25, 10), g('due', 'a', 'C', 25, 10), { ...g('via', 'a', 'C', 25, 10), isActive: false }];
  const st = statistiche({ matches: PARTITE, appearances: [...presenze('tre', 3), ...presenze('due', 2), ...presenze('via', 4)], events: [] });
  for (const i of [0, 1, 61, 200]) assert.equal(misteroDel(giorno(i), players, st)?.id, 'tre', `giorno ${i}`);
});

test('un referto nuovo durante il giorno non cambia il giocatore di oggi', () => {
  const players = [g('x', 'a', 'C', 25, 10), g('y', 'b', 'A', 22, 14)];
  const prima = statistiche({ matches: PARTITE, appearances: presenze('x', 3), events: [] });
  const oggiMistero = misteroDel(giorno(0), players, prima).id;
  // la terza presenza di y arriva oggi stesso: conta da domani
  const dopo = statistiche({ matches: [...PARTITE, { id: 'oggi', kickoffAt: `${giorno(0)}T15:00:00+01:00` }],
    appearances: [...presenze('x', 3), ...presenze('y', 2), { matchId: 'oggi', playerId: 'y' }], events: [] });
  assert.equal(misteroDel(giorno(0), players, dopo).id, oggiMistero);
});

test('gli indizi: giusto, vicino, sbagliato e da che parte', () => {
  const st = new Map([['m', { presenze: 6, gol: 3 }], ['t', { presenze: 5, gol: 0 }]]);
  const r = confronta(g('t', 'folgore', 'C', 24, 10), g('m', 'folgore', 'A', 30, 12), st);
  const per = Object.fromEntries(r.map((x) => [x.chiave, x]));
  assert.equal(per.squadra.esito, 'si');
  assert.equal(per.ruolo.esito, 'no');
  assert.deepEqual([per.eta.esito, per.eta.verso], ['no', 'su']);
  assert.deepEqual([per.quotazione.esito, per.quotazione.verso], ['vicino', 'su']);
  assert.deepEqual([per.presenze.esito, per.presenze.verso], ['vicino', 'su']);
  assert.deepEqual([per.gol.esito, per.gol.verso], ['no', 'su']);
  const giusto = confronta(g('m', 'folgore', 'A', 30, 12), g('m', 'folgore', 'A', 30, 12), st);
  assert.ok(giusto.every((x) => x.esito === 'si' && !x.verso));
});

test('la condivisione non dice il nome', () => {
  const st = new Map();
  const righe = [confronta(g('a', 'x', 'C', 20, 5), g('b', 'y', 'D', 30, 20), st), confronta(g('b', 'y', 'D', 30, 20), g('b', 'y', 'D', 30, 20), st)];
  const t = condivisione('2026-10-29', righe, true);
  assert.match(t, /^Chi è\? #3 · 2\/6\n/);
  assert.match(t, /🟩🟩🟩🟩🟩🟩/);
  assert.doesNotMatch(t, /\b[ab]\b/);
  assert.match(condivisione('2026-10-29', righe, false), /X\/6/);
});

test('la serie conta i giorni vinti di fila', () => {
  const s = { '2026-10-27': { vinto: true }, '2026-10-28': { vinto: true }, '2026-10-29': { vinto: false }, '2026-10-30': { vinto: true }, '2026-10-31': { vinto: true } };
  assert.equal(serie(s, '2026-10-31'), 2);
  assert.equal(serie(s, '2026-11-01'), 2, 'oggi non ancora giocato: vale la serie fino a ieri');
  assert.equal(serie(s, '2026-10-29'), 0);
});

test('giorno italiano e numero del gioco', () => {
  assert.equal(oggi(new Date('2026-10-27T23:30:00Z')), '2026-10-28');
  assert.equal(numero('2026-10-27'), 1);
  assert.equal(TENTATIVI, 6);
});
