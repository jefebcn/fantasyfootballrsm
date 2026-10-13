// Quello che Vercel pubblica lo prepara scripts/costruisci.mjs (pubblico/).
// Alex, 13/10: il repository resta pubblico, ma dal sito non si deve quasi
// poter risalire al progetto. Qui si costruisce davvero e si guarda il
// risultato: c'e' tutto quello che serve all'app, e niente che porti a GitHub.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dir = mkdtempSync(join(tmpdir(), 'pubblico-'));
execFileSync('node', ['scripts/costruisci.mjs', dir], { encoding: 'utf8' });

const tutti = (d, base = '') => readdirSync(d).flatMap((n) => {
  const p = join(d, n), rel = base ? `${base}/${n}` : n;
  return statSync(p).isDirectory() ? tutti(p, rel) : [rel];
});
const pubblicati = tutti(dir);

test("c'e' tutto quello che il service worker mette in cache", () => {
  const sw = readFileSync('sw.js', 'utf8');
  const shell = [...sw.matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]).filter((p) => p && !p.endsWith('/') && !p.startsWith('#'));
  assert.ok(shell.length > 20, 'elenco del service worker non trovato');
  for (const f of shell) assert.ok(existsSync(join(dir, f)), `manca ${f}`);
  for (const f of ['index.html', 'privacy.html', 'termini.html', '.well-known/assetlinks.json', 'vendor/supabase-js.js']) {
    assert.ok(existsSync(join(dir, f)), `manca ${f}`);
  }
});

test('niente cartelle di lavoro', () => {
  for (const d of ['supabase', 'scripts', 'tests', 'prove', 'data', 'legale', 'regia', 'videos', 'api']) {
    assert.ok(!existsSync(join(dir, d)), `${d}/ finisce online`);
  }
  assert.ok(!pubblicati.some((f) => /\.md$/i.test(f) || /-sorgenti\//.test(f)), 'note .md o sorgenti delle immagini online');
});

test('niente che porti al repository', () => {
  const spia = /github|jefebcn|fantasyfootballrsm|supabase\/migrations|\.github\/|scripts\/[a-z-]+\.(py|mjs|sh)/i;
  for (const f of pubblicati.filter((x) => /\.(js|css|html|json|webmanifest)$/.test(x) && !x.startsWith('vendor/'))) {
    const t = readFileSync(join(dir, f), 'utf8');
    const m = t.match(spia);
    assert.ok(!m, `${f} contiene «${m && m[0]}»`);
  }
});

test('il codice esce senza commenti, e il premio del coupon c\'e\'', () => {
  const app = readFileSync(join(dir, 'src/state.js'), 'utf8');
  assert.ok(!/\/\*\*|\n\s*\/\/ /.test(app), 'src/state.js ha ancora commenti');
  assert.match(readFileSync(join(dir, 'src/ui-esc.js'), 'utf8'), /premio-c/);
});
