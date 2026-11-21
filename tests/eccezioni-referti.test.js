// Le correzioni a mano ai tabellini (data/eccezioni-referti.json, Alex 5/11).
// Il referto FSGC scrive solo «Espulsione»: un rosso diretto dopo un giallo
// l'import lo conta come doppia ammonizione, e lo si corregge qui. L'import
// riscarica i referti a ogni giro, quindi la correzione deve stare in un file
// che rilegge ogni volta, e non deve mai sparire in silenzio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { REFERTI } from '../src/eventi-dati.js';

const py = (codice) => JSON.parse(execFileSync('python3', ['-c', `
import importlib.util, json
spec = importlib.util.spec_from_file_location('m', 'scripts/importa-fsgc.py')
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
${codice}`], { encoding: 'utf8' }));
const applica = (chiave, eventi, eccezioni) =>
  py(`print(json.dumps(m.applica_eccezioni(${JSON.stringify(chiave)}, ${JSON.stringify(eventi)}, ${JSON.stringify(eccezioni)})))`);

const EVENTI = [['virtus_5', 88, 'second_yellow'], ['virtus_5', 68, 'yellow'], ['virtus_14', 19, 'goal']];
const voce = (x) => ({ giornata: 7, casa: 'domagnano', ospite: 'virtus', giocatore: 'virtus_5', minuto: 88, nota: 'prova', ...x });

test('«cambia»: la doppia ammonizione diventa rosso diretto', () => {
  const [eventi, mancate] = applica('7:domagnano:virtus', EVENTI, [voce({ azione: 'cambia', evento: 'red_direct' })]);
  assert.deepEqual(eventi, [['virtus_5', 88, 'red_direct'], ['virtus_5', 68, 'yellow'], ['virtus_14', 19, 'goal']]);
  assert.deepEqual(mancate, []);
});

test('«aggiungi» e «togli»', () => {
  const [eventi, mancate] = applica('7:domagnano:virtus', EVENTI, [
    voce({ azione: 'aggiungi', giocatore: 'virtus_7', minuto: 19, evento: 'assist' }),
    voce({ azione: 'togli', giocatore: 'virtus_5', minuto: 68, evento: 'yellow' }),
  ]);
  assert.deepEqual(eventi, [['virtus_7', 19, 'assist'], ['virtus_5', 88, 'second_yellow'], ['virtus_14', 19, 'goal']]);
  assert.deepEqual(mancate, []);
});

test("le eccezioni di un'altra partita non toccano questa", () => {
  const [eventi, mancate] = applica('7:cosmos:fiorentino', EVENTI, [voce({ azione: 'cambia', evento: 'red_direct' })]);
  assert.deepEqual(eventi, EVENTI);
  assert.deepEqual(mancate, []);
});

test('una voce che non trova il suo evento viene restituita, non persa', () => {
  const sbagliate = [voce({ azione: 'cambia', minuto: 87, evento: 'red_direct' }), voce({ azione: 'togli', evento: 'goal' }),
    voce({ azione: 'cambia', evento: 'rosso' }), voce({ azione: 'boh', evento: 'goal' })];
  const [eventi, mancate] = applica('7:domagnano:virtus', EVENTI, sbagliate);
  assert.deepEqual(eventi, EVENTI);
  assert.equal(mancate.length, 4);
});

test('ogni eccezione del file è già nei tabellini pubblicati', () => {
  const { eccezioni } = JSON.parse(readFileSync('data/eccezioni-referti.json', 'utf8'));
  assert.ok(Array.isArray(eccezioni));
  const tipi = new Set(['goal', 'assist', 'yellow', 'second_yellow', 'red_direct', 'own_goal', 'pen_missed', 'pen_saved']);
  for (const x of eccezioni) {
    const dove = `${x.giornata}ª ${x.casa}-${x.ospite}, ${x.giocatore} ${x.minuto}'`;
    assert.ok(['cambia', 'aggiungi', 'togli'].includes(x.azione), `${dove}: azione «${x.azione}»`);
    assert.ok(tipi.has(x.evento), `${dove}: evento «${x.evento}»`);
    assert.ok(x.nota, `${dove}: manca la nota (perché la correzione)`);
    const r = REFERTI.find((t) => t.g === x.giornata && t.casa === x.casa && t.ospite === x.ospite);
    assert.ok(r, `${dove}: partita senza tabellino`);
    const presente = r.eventi.some((e) => e[0] === x.giocatore && e[1] === x.minuto && e[2] === x.evento);
    assert.equal(presente, x.azione !== 'togli', `${dove}: la correzione non è in src/eventi-dati.js`);
  }
});
