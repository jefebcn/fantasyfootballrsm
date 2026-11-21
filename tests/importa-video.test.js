// Gli highlights si legano alla loro partita (scripts/importa-video.py).
// Dalla 5ª (12/10) la FSGC scrive i titoli senza la giornata — «| HL Cosmos -
// Juvenes Dogana 1-0» — e i video finivano fra «Dal canale»: la pagina degli
// highlights restava ferma alla 4ª. Ora la giornata si prende dal calendario.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const py = (codice) => JSON.parse(execFileSync('python3', ['-c', `
import importlib.util, json
spec = importlib.util.spec_from_file_location('v', 'scripts/importa-video.py')
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
${codice}`], { encoding: 'utf8' }));

const CAL = [[5, 'cosmos', 'juvenes', '2026-10-11'], [20, 'cosmos', 'juvenes', '2027-03-14'], [5, 'virtus', 'academy', '2026-10-10']];

test('la forma di prima, con la giornata nel titolo', () => {
  assert.deepEqual(py(`print(json.dumps(m.smonta('Campionato Sammarinese 2026-27, 4. giornata | Murata - Cosmos 0-2', '2026-09-21', [])))`),
    [4, 'murata', 'cosmos']);
});

test('la forma della 5ª: senza giornata, la si trova nel calendario', () => {
  const r = py(`print(json.dumps([m.smonta(t, q, ${JSON.stringify(CAL)}) for t, q in [
    ('Campionato Sammarinese 2026-27 | HL Cosmos - Juvenes Dogana 1-0', '2026-10-12'),
    ('Campionato Sammarinese 2026-27 | HL Virtus - San Marino Academy 5-0', '2026-10-12'),
    ('Campionato Sammarinese 2026-27 | HL Cosmos - Juvenes Dogana 2-2', '2027-03-15')]]))`);
  assert.deepEqual(r, [[5, 'cosmos', 'juvenes'], [5, 'virtus', 'academy'], [20, 'cosmos', 'juvenes']]);
});

test('i sondaggi e le partite che il calendario non conosce restano video del canale', () => {
  const r = py(`print(json.dumps([m.smonta(t, '2026-10-12', ${JSON.stringify(CAL)}) for t in [
    'Campionato Sammarinese 2026-27, 5. giornata - VOTA IL GOL PIÙ BELLO!',
    'Campionato Sammarinese 2026-27 | HL Faetano - Fiorentino 0-6']]))`);
  assert.deepEqual(r, [null, null]);
});

// Dalla 6ª (26/10) la giornata torna nel titolo ma con «HL» davanti alla casa:
// la casa diventava «HL Tre Penne», non si riconosceva, e la pagina degli
// highlights e' rimasta ferma alla 6ª fino al 13/11.
test('la forma dalla 6ª: giornata nel titolo e «HL» davanti alla casa', () => {
  const r = py(`print(json.dumps([m.smonta(t, '2026-11-09', []) for t in [
    'Campionato Sammarinese 2026-27, 8. giornata | HL Tre Penne - Murata 3-0',
    'Campionato Sammarinese 2026-27, 8. giornata | HL San Marino Academy - San Giovanni 0-0',
    'Campionato Sammarinese 2026-27, 6. giornata | HL Libertas - Folgore 1-2']]))`);
  assert.deepEqual(r, [[8, 'trepenne', 'murata'], [8, 'academy', 'sangiovanni'], [6, 'libertas', 'folgore']]);
});
