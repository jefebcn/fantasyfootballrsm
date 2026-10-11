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
