/**
 * Le caricature elencate in avatar.js devono esistere su disco, e viceversa.
 *
 * Nasce da come sono arrivate: tavole disegnate fuori, ritagliate da uno
 * script, numerate di seguito. Ogni volta che ne arriva un'altra infornata il
 * conto cambia, e le due cose che si scordano sono sempre le stesse — un
 * numero nell'elenco senza il file (sul campo esce il rettangolo
 * dell'immagine rotta) o un file rimasto in cartella e sparito dall'elenco
 * (peso morto che il telefono si scarica e non usa).
 *
 * Nessuna delle due si vede guardando l'app: la prima tocca a chi ha in rosa
 * proprio quel giocatore, la seconda non si vede affatto.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const radice = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const sorgente = readFileSync(`${radice}/src/avatar.js`, 'utf8');

const riga = sorgente.match(/const CARICATURE = ([^;]+);/);
const elenco = riga ? eval(riga[1]) : null;   // eslint-disable-line no-eval

const rigaP = sorgente.match(/const PORTIERI = (\[[^\]]+\]);/);
const portieri = rigaP ? eval(rigaP[1]) : null;   // eslint-disable-line no-eval

const inCartella = readdirSync(`${radice}/media/avatar`)
  .filter((f) => /^\d+\.webp$/.test(f))
  .map((f) => Number(f.replace('.webp', '')))
  .filter((n) => n >= 100);                   // sotto 100 sono le copertine

test('l\'elenco delle caricature si legge da avatar.js', () => {
  assert.ok(Array.isArray(elenco), 'CARICATURE non trovato o non e\' un elenco');
  assert.ok(elenco.length > 50, `solo ${elenco.length} caricature`);
  assert.equal(new Set(elenco).size, elenco.length, 'ci sono numeri ripetuti');
});

test('ogni caricatura elencata ha il suo file', () => {
  const mancanti = elenco.filter((n) => !inCartella.includes(n));
  assert.deepEqual(mancanti, [], `senza file: ${mancanti.join(', ')}`);
});

test('ogni file in cartella e\' nell\'elenco', () => {
  const orfani = inCartella.filter((n) => !elenco.includes(n));
  assert.deepEqual(orfani, [], `file mai usati: ${orfani.join(', ')}`);
});

test('i portieri sono un sottoinsieme delle caricature', () => {
  assert.ok(Array.isArray(portieri), 'PORTIERI non trovato');
  assert.ok(portieri.length >= 5, `solo ${portieri.length} portieri: in porta finirebbero sempre gli stessi`);
  const fuori = portieri.filter((n) => !elenco.includes(n));
  assert.deepEqual(fuori, [], `portieri fuori elenco: ${fuori.join(', ')}`);
  assert.ok(elenco.length - portieri.length > 50, 'restano troppe poche caricature di movimento');
});
