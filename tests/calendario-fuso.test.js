/**
 * Gli orari del calendario col fuso giusto (Alex, 29/10).
 *
 * L'import scriveva «+02:00» fisso: giusto d'estate, sbagliato dal 25/10 con
 * l'ora solare. Le partite risultavano un'ora prima, e la formazione della 7ª
 * si chiudeva alle 20:05 per una partita delle 21:15. Ogni orario deve avere
 * lo scarto che Roma ha davvero quel giorno.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CALENDARIO } from '../src/calendario-dati.js';

const scartoRoma = (iso) => {
  const giorno = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  const nome = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Rome', timeZoneName: 'longOffset' })
    .formatToParts(giorno).find((p) => p.type === 'timeZoneName').value; // «GMT+01:00»
  return nome.replace('GMT', '');
};

test('ogni calcio d\'inizio ha lo scarto di Roma di quel giorno', () => {
  const sbagliati = CALENDARIO.filter((r) => r[3]).filter((r) => !r[3].endsWith(scartoRoma(r[3])))
    .map((r) => `${r[0]}ª ${r[1]}-${r[2]} ${r[3]} (Roma ${scartoRoma(r[3])})`);
  assert.deepEqual(sbagliati, []);
});

test('il caso vero: Cailungo-Juvenes del 30/10 alle 21:15 e\' alle 20:15 UTC', () => {
  const r = CALENDARIO.find((x) => x[0] === 7 && x[1] === 'cailungo');
  assert.equal(new Date(r[3]).toISOString(), '2026-10-30T20:15:00.000Z');
});
