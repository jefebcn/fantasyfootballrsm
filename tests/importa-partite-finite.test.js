// L'importatore FSGC prende un risultato solo a partita conclusa.
// L'11 ottobre il giro delle 15:00 aveva salvato le partite della domenica
// 0-0 al calcio d'inizio, come risultati finali: la 5ª risultava giocata
// mentre si giocava. Qui si provano le due funzioni che lo impediscono, senza
// rete e senza BeautifulSoup (scripts/importa-fsgc.py li carica solo dentro).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const py = (codice) => JSON.parse(execFileSync('python3', ['-c', `
import importlib.util, json
spec = importlib.util.spec_from_file_location('imp', 'scripts/importa-fsgc.py')
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
${codice}`], { encoding: 'utf8' }));

// com'e' scritto davvero sopra il risultato, nelle pagine delle partite
const pagina = (classe, testo) => `<div class="col-6 px-2"><div class="d-flex"><small class="${classe} mb-0 text-uppercase">${testo}</small></div></div>`;

test('lo stato si legge dalla pagina della partita', () => {
  const stati = py(`print(json.dumps([m.stato_partita(h) for h in ${JSON.stringify([
    pagina('text-live', 'Live'), pagina('text-finished', 'Concluso'), pagina('text-scheduled', 'In programma'), '<p>niente</p>',
  ])}]))`);
  assert.deepEqual(stati, ['live', 'finished', 'scheduled', null]);
});

test('il risultato vale solo a partita conclusa', () => {
  const k = '2026-10-11T15:00:00+02:00';
  const t0 = Date.parse(k) / 1000;
  const casi = [
    [k, 'live', t0 + 20 * 60, false],          // il giro delle 15:20: 1-0, in corso
    [k, 'live', t0 + 2 * 3600, false],         // recupero lungo: ancora in corso
    [k, 'finished', t0 + 100 * 60, true],      // «Concluso»: si prende subito
    [k, null, t0 + 100 * 60, false],           // stato illeggibile: si aspetta
    [k, null, t0 + 4 * 3600, true],            // ...finche' e' finita di sicuro
    [k, 'live', t0 + 25 * 3600, true],         // la FSGC non l'ha chiusa: dopo un giorno si prende
    [null, 'live', t0, false],
    [null, null, t0, true],                    // senza orario si fa come prima
  ];
  const esiti = py(`print(json.dumps([m.finita(q, s, o) for q, s, o in ${JSON.stringify(casi.map(([q, s, o]) => [q, s, o]))
    .replace(/null/g, 'None')}]))`);
  assert.deepEqual(esiti, casi.map((c) => c[3]));
});

// Il referto la FSGC lo completa dopo il fischio: l'11/10 i cambi delle tre
// partite della domenica sono arrivati dopo il «Concluso», e l'archivio non
// li riscaricava piu'. Per due giorni dal calcio d'inizio si riscarica.
test('un tabellino finito si riscarica per due giorni, poi resta quello', () => {
  const k = '2026-10-11T15:00:00+02:00';
  const t0 = Date.parse(k) / 1000;
  const casi = [
    [null, k, t0 + 3600, true],                         // mai scaricato
    [{ finita: false }, k, t0 + 3600, true],            // preso a partita in corso
    [{ finita: true }, k, t0 + 2 * 3600, true],         // appena finito: i cambi arrivano dopo
    [{ finita: true }, k, t0 + 47 * 3600, true],        // lunedi': ancora
    [{ finita: true }, k, t0 + 49 * 3600, false],       // martedi' pomeriggio: basta
    [{ finita: true }, null, t0, false],                // senza orario: come prima
  ];
  const esiti = py(`print(json.dumps([m.da_riscaricare(f, q, o) for f, q, o in ${JSON.stringify(casi.map(([f, q, o]) => [f, q, o]))
    .replace(/null/g, 'None').replace(/false/g, 'False').replace(/true/g, 'True')}]))`);
  assert.deepEqual(esiti, casi.map((c) => c[3]));
});

// Il 13/10 la Folgore della 5ª giocava in dieci: due titolari non erano nel
// listone quando il referto e' stato letto. L'extra era nato subito, ma il
// tabellino in archivio restava senza di loro dopo le 48 ore.
test('un tabellino con giocatori mancanti si riscarica fino alla chiusura', () => {
  const k = '2026-10-10T15:00:00+02:00';            // sabato
  const t0 = Date.parse(k) / 1000;
  const chiude = Date.parse('2026-10-13T20:00:00+02:00') / 1000;
  const manca = { finita: true, mancanti: { 'Rossi M.': { club: 'folgore' } } };
  const casi = [
    [manca, k, t0 + 60 * 3600, true],                 // lunedi' sera: oltre le 48 ore, ma manca qualcuno
    [manca, k, chiude - 60, true],                    // martedi' 19:59
    [manca, k, chiude + 60, false],                   // congelata: non si tocca piu'
    [{ finita: true, mancanti: {} }, k, t0 + 60 * 3600, false],
  ];
  const esiti = py(`print(json.dumps([m.da_riscaricare(f, q, o) for f, q, o in ${JSON.stringify(casi.map(([f, q, o]) => [f, q, o]))
    .replace(/null/g, 'None').replace(/false/g, 'False').replace(/true/g, 'True')}]))`);
  assert.deepEqual(esiti, casi.map((c) => c[3]));
  const giorni = py(`print(json.dumps([m.chiusura(q) for q in ${JSON.stringify([
    '2026-10-11T15:00:00+02:00', '2026-10-13T20:45:00+02:00', '2026-10-13T18:00:00+02:00'])}]))`);
  assert.deepEqual(giorni, [chiude, Date.parse('2026-10-20T20:00:00+02:00') / 1000, chiude]);
});

// Modalita' prudente (032): con l'interruttore acceso l'import non scarica niente.
test("l'interruttore della modalità prudente si legge dalla risposta del database", () => {
  const casi = [
    ['[{"chiave":"prudente","acceso":true}]', true],
    ['[{"chiave":"prudente","acceso":false}]', false],
    ['[]', false],                                       // la 032 c'e' ma la riga no
    ['{"message":"relation does not exist"}', false],   // la 032 non c'e' ancora
    ['non json', false],
  ];
  const esiti = py(`print(json.dumps([m.prudente_da(t) for t in ${JSON.stringify(casi.map((c) => c[0]))}]))`);
  assert.deepEqual(esiti, casi.map((c) => c[1]));
});

// Tordella, 13/10: «Manuel Filippo Tordella» per la FSGC, «Manuel Tordella»
// nel listone. L'import ne aveva fatto un giocatore nuovo, e chi aveva in
// rosa quello del listone non ha mai preso il voto. Come lui altri dieci.
test('un nome del referto col secondo nome porta al giocatore del listone', () => {
  const r = py(`
i = m.indice_giocatori()
print(json.dumps({'alias': i['alias'], 'tordella': i['per_club']['cailungo'].get(m.chiavi('filippo-tordella-manuel')[0]),
  'vannek': 'trefiori_27' in i['alias']}))`);
  assert.equal(r.alias.cailungo_29, 'cailungo_1');
  assert.equal(r.alias.trefiori_28, 'trefiori_23');   // Bernardi
  assert.equal(r.alias.lafiorita_25, 'lafiorita_10'); // Cicarelli
  assert.equal(r.tordella, 'cailungo_1');
  assert.equal(r.vannek, false, 'Tjakko e Joas van Nek sono due persone diverse');
  const t = py(`print(json.dumps(m.rimappa({'titolari': [['cailungo_29', 'x_1'], []], 'eventi': [['cailungo_29', 10, 'yellow']], 'cambi': [['a_1', 'cailungo_29', 70]]}, {'cailungo_29': 'cailungo_1'})))`);
  assert.deepEqual(t, { titolari: [['cailungo_1', 'x_1'], []], eventi: [['cailungo_1', 10, 'yellow']], cambi: [['a_1', 'cailungo_1', 70]] });
});

// Il fuso lo mette l'importatore: la FSGC scrive solo l'ora locale. Fino al
// 25/10 era sempre +02:00, e dal ritorno all'ora solare le partite del calcio
// risultavano un'ora prima, con loro la chiusura delle formazioni.
test('il fuso segue l\'ora legale di San Marino', () => {
  const f = py(`print(json.dumps([m.fuso_san_marino(*d) for d in [(2026, 10, 24), (2026, 10, 25), (2026, 11, 1), (2027, 3, 27), (2027, 3, 28)]]))`);
  assert.deepEqual(f, ['+02:00', '+01:00', '+01:00', '+01:00', '+02:00']);
});
test('nel calendario le partite d\'inverno hanno il fuso d\'inverno', async () => {
  const { CALENDARIO } = await import('../src/calendario-dati.js');
  for (const [g, casa, , iso] of CALENDARIO) {
    if (!iso) continue;
    const giorno = iso.slice(0, 10);
    const atteso = giorno >= '2026-10-25' && giorno < '2027-03-28' ? '+01:00' : '+02:00';
    assert.ok(iso.endsWith(atteso), `${g}ª ${casa}: ${iso}`);
  }
});
