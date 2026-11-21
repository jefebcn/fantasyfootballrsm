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
  assert.equal(py('libertas_4')?.tipo, 'squadra'); // libertas_2 dal 17/11 ha la sua foto nel catalogo
  assert.equal(py('murata_2')?.tipo, 'squadra');
  assert.equal(py('nessuno_1'), null, 'squadra senza foto di gruppo: niente foto');
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

// 21/11: le frasi giuste per il gol (Alex, «sistema tutto prima di domani»).
// il referto FSGC elenca i gol dal piu' recente: qui si scrivono in ordine e si girano
const partita = (eventi) => ({ g: 9, casa: 'cosmos', ospite: 'faetano', eventi: [...eventi].reverse(), titolari: [[], []], cambi: [] });
const momento = (r, k) => fattiDelGol(r, k, { tutti: true }).fatti.find((f) => f.chiave === 'momento');

test('«riapre la partita» solo se resta un gol da recuperare', () => {
  const r = partita([['cosmos_21', 62, 'goal'], ['cosmos_21', 71, 'goal'], ['cosmos_19', 75, 'goal'], ['faetano_25', 85, 'goal']]);
  assert.deepEqual([momento(r, 3).valore, momento(r, 3).testo], ['-2', 'gol della bandiera']);
  const presto = partita([['cosmos_21', 10, 'goal'], ['cosmos_21', 20, 'goal'], ['cosmos_19', 25, 'goal'], ['faetano_25', 30, 'goal']]);
  assert.equal(momento(presto, 3).testo, 'accorcia le distanze');
  const uno = partita([['cosmos_21', 10, 'goal'], ['faetano_25', 30, 'goal']]);
  assert.equal(momento(uno, 1).valore, 'PAREGGIO');
  const due = partita([['cosmos_21', 10, 'goal'], ['cosmos_19', 20, 'goal'], ['faetano_25', 30, 'goal']]);
  assert.deepEqual([momento(due, 2).valore, momento(due, 2).testo], ['-1', 'riapre la partita']);
});

test('la media è della squadra e il capocannoniere ha una riga sola', () => {
  const r = partita([['cosmos_21', 62, 'goal'], ['cosmos_21', 71, 'goal']]);
  const f = fattiDelGol(r, 1, { tutti: true }).fatti;
  assert.ok(!f.some((x) => x.testo === 'gol a partita finora'));
  const media = fattiDelGol(r, 1, { tutti: true }).fatti.find((x) => x.chiave === 'media');
  if (media) assert.equal(media.testo, 'media gol della squadra');
  const numeri = f.filter((x) => x.chiave === 'stagione' || x.chiave === 'marcatori');
  assert.equal(numeri.length, 1);
});
