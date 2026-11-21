/**
 * «Giornata N finita» (052): quando scripts/avvisi.mjs fa partire l'avviso.
 * Finita = tutte le partite giocate hanno il referto, le rinviate non tengono
 * ferma la giornata, solo di giorno e solo entro tre giorni.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { giornataFinita } from '../scripts/avvisi.mjs';

const cal = [
  [8, 'a', 'b', '2026-11-07T15:00:00+01:00'],
  [8, 'c', 'd', '2026-11-07T15:00:00+01:00'],
  [8, 'e', 'f', '2026-11-08T15:00:00+01:00'],
  [8, 'g', 'h', '2026-11-08T15:00:00+01:00'],
  [9, 'a', 'c', '2026-11-14T15:00:00+01:00'],
];
const ref = (...q) => q.map(([casa, ospite]) => ({ g: 8, casa, ospite }));
const tutti = ref(['a', 'b'], ['c', 'd'], ['e', 'f'], ['g', 'h']);
const t = (s) => Date.parse(s);

test('con tutti i referti, domenica sera alle 19 la giornata e\' finita', () => {
  assert.equal(giornataFinita(t('2026-11-08T19:00:00+01:00'), cal, tutti), 8);
});
test('manca un referto: si aspetta', () => {
  assert.equal(giornataFinita(t('2026-11-09T10:00:00+01:00'), cal, tutti.slice(0, 3)), null);
});
test('mentre si gioca ancora (domenica alle 16) no', () => {
  assert.equal(giornataFinita(t('2026-11-08T16:00:00+01:00'), cal, tutti), null);
});
test('di notte no, la mattina dopo si\'', () => {
  assert.equal(giornataFinita(t('2026-11-08T23:30:00+01:00'), cal, tutti), null);
  assert.equal(giornataFinita(t('2026-11-09T09:05:00+01:00'), cal, tutti), 8);
});
test('dopo tre giorni la giornata e\' vecchia', () => {
  assert.equal(giornataFinita(t('2026-11-12T10:00:00+01:00'), cal, tutti), null);
});
test('una partita rinviata di una settimana non blocca le altre', () => {
  const rinvio = cal.map((r) => (r[1] === 'g' ? [8, 'g', 'h', '2026-11-18T20:00:00+01:00'] : r));
  assert.equal(giornataFinita(t('2026-11-09T10:00:00+01:00'), rinvio, tutti.slice(0, 3)), 8);
});
test('con i dati veri: la 7ª e\' finita lunedi\' 2 novembre alle 10', () => {
  assert.equal(giornataFinita(t('2026-11-02T10:00:00+01:00')), 7);
});
