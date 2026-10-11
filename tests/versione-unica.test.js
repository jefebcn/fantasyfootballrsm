// Una versione nuova a ogni app nuova (scripts/versione-unica.py e
// scripts/versione-dopo-merge.sh). L'11/10 la home nuova e l'import
// automatico erano usciti entrambi alla 4.2.154: chi aveva gia' la 4.2.154
// dell'import la home nuova non l'avrebbe scaricata. Qui si rifa' quel giorno
// su un repository finto, con un "origin" locale al posto di GitHub.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const RADICE = new URL('..', import.meta.url).pathname;

const py = (codice) => JSON.parse(execFileSync('python3', ['-c', `
import importlib.util, json
spec = importlib.util.spec_from_file_location('v', 'scripts/versione-unica.py')
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
${codice}`], { encoding: 'utf8', cwd: RADICE }));

test('serve una versione nuova solo se l\'app e\' cambiata e la versione no', () => {
  const casi = [
    [[4, 2, 154], [4, 2, 154], ['styles/app.css'], true],          // l'11/10
    [[4, 2, 153], [4, 2, 154], ['styles/app.css'], false],         // alzata: a posto
    [[4, 2, 154], [4, 2, 154], ['scripts/importa-fsgc.py'], false], // solo strumenti
    [[4, 2, 154], [4, 2, 154], ['supabase/migrations/029.sql', 'README.md', 'prove/x.cjs'], false],
    [[4, 2, 154], [4, 2, 154], ['design/tokens/tokens.css'], true], // i token li scarica il telefono
    [[4, 2, 155], [4, 2, 154], ['src/app.js'], true],              // scesa: va rialzata
  ];
  const esiti = py(`print(json.dumps([m.serve(tuple(a), tuple(b), f) for a, b, f in ${JSON.stringify(casi.map((c) => c.slice(0, 3)))}]))`);
  assert.deepEqual(esiti, casi.map((c) => c[3]));
});

const sw = (v) => `const VERSION = 'fcs-v${v}';\nconst SHELL = ['./src/versione.js'];\n`;
const ver = (v) => `export const VERSIONE = '${v}';\n`;

function repoFinto() {
  const dir = mkdtempSync(join(tmpdir(), 'versione-'));
  const g = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8' }).trim();
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', join(dir, 'origin.git')]);
  const lav = join(dir, 'lavoro');
  execFileSync('git', ['clone', '-q', join(dir, 'origin.git'), lav]);
  g(lav, 'config', 'user.email', 'prova@example.com'); g(lav, 'config', 'user.name', 'prova');
  mkdirSync(join(lav, 'scripts')); mkdirSync(join(lav, 'src')); mkdirSync(join(lav, 'styles'));
  for (const f of ['bump-sw.py', 'versione-unica.py', 'versione-dopo-merge.sh']) cpSync(join(RADICE, 'scripts', f), join(lav, 'scripts', f));
  const scrivi = (v, css) => { writeFileSync(join(lav, 'sw.js'), sw(v)); writeFileSync(join(lav, 'src/versione.js'), ver(v)); if (css) writeFileSync(join(lav, 'styles/app.css'), css); };
  const commit = (m) => { g(lav, 'add', '-A'); g(lav, 'commit', '-q', '-m', m); return g(lav, 'rev-parse', 'HEAD'); };
  return { dir, lav, g, scrivi, commit, pubblica: () => g(lav, 'push', '-q', 'origin', 'HEAD:main') };
}

test('il giorno della 4.2.154 doppia: la versione sale da sola e va su origin', () => {
  const r = repoFinto();
  try {
    r.scrivi('4.2.153', 'a{}'); r.commit('main alla 4.2.153'); r.pubblica();
    // l'import parte dalla 4.2.153 ed esce alla 4.2.154: main e' li' prima del merge
    r.scrivi('4.2.154'); writeFileSync(join(r.lav, 'src/calendario-dati.js'), '[]'); const prima = r.commit('dati: import automatico'); r.pubblica();
    // la home nuova era partita anche lei dalla 4.2.153: il merge resta alla 4.2.154
    r.scrivi('4.2.154', 'a{color:lime}'); r.commit('Merge: home nuova'); r.pubblica();
    const out = execFileSync('bash', ['scripts/versione-dopo-merge.sh', prima], { cwd: r.lav, encoding: 'utf8' });
    assert.match(out, /pubblicata fcs-v4\.2\.155/);
    const suOrigin = r.g(r.lav, 'show', 'origin/main:sw.js');
    assert.match(suOrigin, /fcs-v4\.2\.155/);
    assert.match(r.g(r.lav, 'show', 'origin/main:src/versione.js'), /4\.2\.155/);
  } finally { rmSync(r.dir, { recursive: true, force: true }); }
});

test('se la versione e\' gia\' salita, non si tocca niente', () => {
  const r = repoFinto();
  try {
    r.scrivi('4.2.153', 'a{}'); const prima = r.commit('main alla 4.2.153'); r.pubblica();
    r.scrivi('4.2.154', 'a{color:lime}'); const dopo = r.commit('home nuova, versione alzata'); r.pubblica();
    const out = execFileSync('bash', ['scripts/versione-dopo-merge.sh', prima], { cwd: r.lav, encoding: 'utf8' });
    assert.match(out, /versione a posto/);
    assert.equal(r.g(r.lav, 'rev-parse', 'origin/main'), dopo);
  } finally { rmSync(r.dir, { recursive: true, force: true }); }
});
