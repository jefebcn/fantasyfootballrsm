// Le storie dei gol con la foto FSGC (Alex, 7/11): dietro il marcatore o la
// sua squadra, sotto il risultato, «Marcatore: D. Babboni» e i numeri del gol.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fattiDelGol, htmlFoto, sigla } from '../social/gol/storia-gol.mjs';

const referto = {
  g: 8, casa: 'faetano', ospite: 'domagnano',
  eventi: [['domagnano_23', 52, 'goal']], titolari: [[], []], cambi: [],
};

test('la sigla è iniziale e cognome intero', () => {
  assert.equal(sigla('domagnano_23'), 'D. Babboni');
  assert.equal(sigla('virtus_5'), 'U. De Lucia');
  assert.equal(sigla('folgore_23'), 'A. Garcia Rufer');
});

test('con la foto il marcatore e i suoi numeri ci sono anche senza consenso', () => {
  const senza = fattiDelGol(referto, 0, {});
  const con = fattiDelGol(referto, 0, { tutti: true });
  assert.ok(!senza.fatti.some((f) => f.chiave === 'stagione'));
  assert.ok(con.fatti.some((f) => f.chiave === 'stagione'));
  assert.equal(con.sigla, 'D. Babboni');
  const html = htmlFoto({ ...con, n: 0 }, { file: '/tmp/foto.jpg', credito: '©FSGC/Palmieri', centro: 0.46 });
  assert.match(html, /Marcatore: D\. Babboni/);
  assert.match(html, /GOL DEL<\/h1><h2>DOMAGNANO/);
  assert.match(html, /Foto ©FSGC\/Palmieri/);
  assert.match(html, /object-position:46%/);
});

test('le foto scelte a mano: giocatore, poi squadra di gruppo, poi niente', () => {
  const py = (pid) => JSON.parse(execFileSync('python3', ['-c', `
import importlib.util, json
s = importlib.util.spec_from_file_location('f', 'scripts/foto_gol.py'); f = importlib.util.module_from_spec(s); s.loader.exec_module(f)
x = f.foto_per(${JSON.stringify(pid)}, None, f.giocatori())
print(json.dumps(x and {'tipo': x['tipo'], 'credito': x['credito']}))`], { encoding: 'utf8' }));
  assert.deepEqual(py('domagnano_23'), { tipo: 'giocatore', credito: '©FSGC/Palmieri' });
  assert.equal(py('libertas_2')?.tipo, 'squadra');
  assert.equal(py('domagnano_18'), null, 'il Domagnano non ha una foto di gruppo: niente foto');
});

test('ogni foto degli elenchi ha credito FSGC, indirizzo e taglio', () => {
  for (const f of ['social/gol/foto-giocatori.json', 'social/gol/foto-squadre.json']) {
    for (const [k, v] of Object.entries(JSON.parse(readFileSync(f, 'utf8')))) {
      if (k.startsWith('_')) continue;
      for (const x of v) {
        assert.match(x.credito, /^©(FSGC\/)?\S/, `${k}: credito`);
        assert.match(x.foto, /^https:\/\//, `${k}: indirizzo`);
        assert.ok(x.centro >= 0 && x.centro <= 1, `${k}: centro`);
        // solo calcio della prima squadra: il Murata del futsal ha lo stesso nome e altri giocatori
        const slug = x.foto.match(/\/cdn\/news\/([^/]+)\//)?.[1];
        if (slug) assert.match(slug, /^(campionato|coppa-titano|supercoppa)/, `${k}: articolo ${slug}`);
      }
    }
  }
});
