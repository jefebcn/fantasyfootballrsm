/**
 * Quando l'import resta acceso: la finestra delle partite.
 * Le date vere del calendario, non inventate: la 4a giornata si e' giocata
 * dal 18 al 20 settembre, e dopo c'e' stata la pausa fino al 9 ottobre.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { siGioca, finestre, siGiocaFutsal, diNotte } from '../scripts/finestra-partite.mjs';
import { CALENDARIO } from '../src/calendario-dati.js';

const a = (iso) => Date.parse(iso);

test('due finestre per ogni calcio d\'inizio che ha gia una data (partita e referti)', () => {
  // la FSGC pubblica le date a blocchi: le partite senza data non hanno
  // finestra, e la avranno al primo import che porta la data
  const inizi = new Set(CALENDARIO.map((r) => Date.parse(r[3])).filter((t) => !Number.isNaN(t)));
  assert.equal(finestre().length, 2 * inizi.size);
  assert.ok(inizi.size >= 1);
});

test("venerdi' sera della 4a si gioca: primo calcio d'inizio 21:15, alle 21:00 si guarda gia'", () => {
  assert.equal(siGioca(a('2026-09-18T21:00:00+02:00')), true);
  assert.equal(siGioca(a('2026-09-18T19:00:00+02:00')), false);
});

test("il lunedi' pomeriggio dopo la 4a si resta accesi: e' quando la FSGC ha pubblicato i referti", () => {
  assert.equal(siGioca(a('2026-09-21T17:00:00+02:00')), true);
});

test('nella pausa fra la 4a e la 5a un giro solo', () => {
  assert.equal(siGioca(a('2026-09-30T12:00:00+02:00')), false);
});

test("un'ora prima del primo calcio d'inizio si comincia a guardare", () => {
  // la 5a comincia venerdi' 9 ottobre: alle 20:30 si', a mezzogiorno no
  const primo = Math.min(...finestre().map(([da]) => da).filter((da) => da > a('2026-10-01T00:00:00Z')));
  assert.equal(siGioca(primo + 60 * 1000), true);
  assert.equal(siGioca(primo - 60 * 60 * 1000), false);
});

test('un calendario con una data rotta non fa saltare tutto', () => {
  assert.doesNotThrow(() => siGioca(Date.now(), [[1, 'a', 'b', 'non-una-data', '', null, null]]));
});

// Il futsal: lunedì-giovedì sera, referti da 11 a 22 ore dopo (data/futsal-orologio.json,
// Juvenes–Folgore del 24/11: 18 ore). Finestra dei referti da 12 a 24 ore.
// L'11ª: primo calcio d'inizio lunedì 23/11 alle 20:15, ultimo giovedì 26/11 alle 22:00.
test("futsal: dal lunedi' sera dell'11a si guarda, un'ora prima del primo calcio d'inizio", () => {
  assert.equal(siGiocaFutsal(a('2026-11-23T19:30:00+01:00')), true);
  assert.equal(siGiocaFutsal(a('2026-11-23T12:00:00+01:00')), false);
});
test("futsal: il venerdi' dopo l'11a si resta accesi (i referti di giovedi' arrivano fino a sera)", () => {
  assert.equal(siGiocaFutsal(a('2026-11-27T20:00:00+01:00')), true);
});
test("futsal: 30 ore dopo l'ultima partita la finestra si chiude", () => {
  assert.equal(siGiocaFutsal(a('2026-11-28T05:00:00+01:00')), false);
});

// 24/11: la guardia restava accesa giorno e notte. Adesso solo quando la FSGC
// pubblica: la partita, poi i referti dal giorno dopo; mai dall'1 alle 7.
test("domenica sera dopo la partita delle 15 ci si spegne fino al mattino dei referti", () => {
  // 4a: domenica 20/9 alle 15:00. Partita fino alle 21, referti dalle 6 di lunedi'
  assert.equal(siGioca(a('2026-09-20T20:30:00+02:00')), true);
  assert.equal(siGioca(a('2026-09-20T23:30:00+02:00')), false);
  assert.equal(siGioca(a('2026-09-21T09:00:00+02:00')), true);
});
test("di notte non si resta mai accesi, nemmeno a ridosso di una partita", () => {
  assert.equal(diNotte(a('2026-09-19T03:00:00+02:00')), true);
  assert.equal(diNotte(a('2026-09-19T08:00:00+02:00')), false);
  assert.equal(siGioca(a('2026-09-19T03:00:00+02:00')), false);
});
test("martedi' dopo i referti della 4a la guardia e' spenta (prima restava accesa fino a 48 ore)", () => {
  assert.equal(siGioca(a('2026-09-22T12:00:00+02:00')), false);
});
test("futsal: fra la fine della partita e la mattina dei referti ci si spegne", () => {
  // 11a: lunedi' 23/11 alle 21:45 l'ultima del giorno, finita alle 00:45
  assert.equal(siGiocaFutsal(a('2026-11-23T23:30:00+01:00')), true);
  assert.equal(siGiocaFutsal(a('2026-11-24T08:00:00+01:00')), false);
  assert.equal(siGiocaFutsal(a('2026-11-24T14:00:00+01:00')), true);
});
test("futsal: la finestra dei referti parte 12 ore dopo (tarata il 25/11)", () => {
  // 11a: l'ultima di lunedi' alle 21:45, la prima alle 20:15: martedi' alle 10:30 si guarda gia'
  assert.equal(siGiocaFutsal(a('2026-11-24T10:30:00+01:00')), true);
  // Juvenes-Folgore, martedi' 24/11 alle 22: il referto e' uscito mercoledi' fra le 15:45 e le 16:05
  assert.equal(siGiocaFutsal(a('2026-11-25T15:50:00+01:00')), true);
});
