// Due errori segnalati il 5/11 su Umberto De Lucia (Virtus, 7ª giornata).
// 1. La FSGC scrive ogni espulsione allo stesso modo: l'importatore la
//    prendeva sempre per rosso diretto (-2). Se l'espulso era già ammonito
//    nella stessa partita è una doppia ammonizione: -0,5 e -1, -1,5 in tutto.
// 2. Il cognome perdeva la particella: l'app scriveva «Lucia U.».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { REFERTI } from '../src/eventi-dati.js';
import { LISTONE } from '../src/listone-dati.js';
import { buildSeason } from '../src/data.js';

const py = (file, codice) => JSON.parse(execFileSync('python3', ['-c', `
import importlib.util, json
spec = importlib.util.spec_from_file_location('m', '${file}')
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
${codice}`], { encoding: 'utf8' }));

test("un'espulsione dopo un giallo è una doppia ammonizione", () => {
  const ev = [['virtus_5', 88, 'red_direct'], ['domagnano_22', 68, 'yellow'], ['virtus_5', 68, 'yellow'], ['virtus_14', 19, 'goal']];
  assert.deepEqual(py('scripts/importa-fsgc.py', `print(json.dumps(m.doppie_ammonizioni(${JSON.stringify(ev)})))`), [
    ['virtus_5', 88, 'second_yellow'], ['domagnano_22', 68, 'yellow'], ['virtus_5', 68, 'yellow'], ['virtus_14', 19, 'goal']]);
});

test('senza giallo prima resta un rosso diretto; il giallo dopo il rosso non conta', () => {
  const ev = [['a_1', 30, 'red_direct'], ['b_2', 50, 'yellow'], ['b_2', 40, 'red_direct']];
  assert.deepEqual(py('scripts/importa-fsgc.py', `print(json.dumps(m.doppie_ammonizioni(${JSON.stringify(ev)})))`), ev);
});

test('se il referto avesse due gialli prima del rosso, ne resta uno', () => {
  const ev = [['a_1', 10, 'yellow'], ['a_1', 70, 'yellow'], ['a_1', 70, 'red_direct']];
  assert.deepEqual(py('scripts/importa-fsgc.py', `print(json.dumps(m.doppie_ammonizioni(${JSON.stringify(ev)})))`), [
    ['a_1', 10, 'yellow'], ['a_1', 70, 'second_yellow']]);
});

test('nei tabellini pubblicati nessun rosso diretto segue un giallo dello stesso giocatore', () => {
  for (const r of REFERTI) {
    for (const e of r.eventi.filter((x) => x[2] === 'red_direct')) {
      const giallo = r.eventi.find((x) => x[0] === e[0] && x[2] === 'yellow' && x[1] <= e[1]);
      assert.ok(!giallo, `${r.g}ª ${r.casa}-${r.ospite}: ${e[0]} ha giallo e rosso diretto`);
    }
  }
  const dom = REFERTI.find((r) => r.g === 7 && r.casa === 'domagnano' && r.ospite === 'virtus');
  assert.ok(dom.eventi.some((e) => e[0] === 'virtus_5' && e[2] === 'second_yellow'), 'De Lucia: doppia ammonizione');
});

test('le particelle restano nel cognome', () => {
  const casi = ['Umberto De Lucia', 'Joaquin Del Frari', 'Nicola Della Valle', 'Tjakko Van Nek', 'Mattia Luciano Cenni', 'Leon Cremonini', 'Pelé'];
  assert.deepEqual(py('scripts/importa-listone.py', `print(json.dumps([m.dividi_nome(x) for x in ${JSON.stringify(casi)}]))`), [
    ['Umberto', 'De Lucia'], ['Joaquin', 'Del Frari'], ['Nicola', 'Della Valle'], ['Tjakko', 'Van Nek'],
    ['Mattia Luciano', 'Cenni'], ['Leon', 'Cremonini'], ['Pelé', 'Pelé']]);
  const particella = /\s(De|Del|Della|Dei|Di|Da|Dal|La|Lo|Van|Von)$/i;
  for (const [club, nome] of LISTONE) assert.ok(!particella.test(nome), `${club}: «${nome}» ha la particella nel nome`);
  const p = buildSeason().players.find((x) => x.id === 'virtus_5');
  assert.equal(p.name, 'De Lucia U.');
});
