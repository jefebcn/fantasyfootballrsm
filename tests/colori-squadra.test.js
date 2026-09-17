/**
 * I colori assegnati a caso alle squadre devono restare leggibili.
 *
 * Il colore non lo sceglie piu' nessuno: l'app ne pesca uno dalla tavolozza
 * quando la squadra nasce. Quindi non esiste "il caso raro": prima o poi
 * ognuno di quei colori tocca a qualcuno, e sopra ci va scritta un'iniziale.
 *
 * L'ha trovato l'audit dei contrasti, ma una volta su dieci: con l'oro
 * (#d4a017) l'iniziale bianca fissa dell'avatar del profilo misurava 2,38
 * contro il minimo di 3, e negli altri nove giri la prova passava. Una prova
 * che dipende da Math.random non dice se il codice va bene: dice che oggi e'
 * andata bene. Qui i colori si guardano tutti, sempre, senza browser.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { COLORI_SQUADRA, tintaLeggibile, contrasto } from '../src/colore.js';

test('la tavolozza delle squadre non e\' vuota', () => {
  assert.ok(COLORI_SQUADRA.length >= 8, `solo ${COLORI_SQUADRA.length} colori`);
  for (const c of COLORI_SQUADRA) assert.match(c, /^#[0-9a-f]{6}$/i);
});

test('su ogni colore della tavolozza un\'iniziale si legge (AA 4,5)', () => {
  for (const c of COLORI_SQUADRA) {
    const { fondo, inchiostro } = tintaLeggibile(c);
    const r = contrasto(fondo, inchiostro);
    assert.ok(r >= 4.5, `${c}: ${r.toFixed(2)} con ${inchiostro} su ${fondo}`);
  }
});

// Il fondo puo' spostarsi per arrivare al contrasto, ma non deve diventare
// un altro colore: se l'oro esce viola, chi l'ha scelto non lo riconosce.
test('e il fondo corretto resta riconoscibile', () => {
  for (const c of COLORI_SQUADRA) {
    const { fondo } = tintaLeggibile(c);
    const r = contrasto(fondo, c);
    assert.ok(r <= 2.2, `${c} spostato troppo: ${fondo} (${r.toFixed(2)} di distanza)`);
  }
});
