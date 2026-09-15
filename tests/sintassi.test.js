/**
 * Ogni file JS del progetto si deve poter leggere.
 *
 * Nasce da un errore vero: in sw.js era finito un `await` dentro una funzione
 * non `async`. E' un errore di sintassi, quindi il service worker NON veniva
 * installato affatto — e il telefono continuava a servire la versione vecchia
 * dalla cache, facendo sembrare senza effetto ogni correzione successiva.
 * Nessuna prova col browser lo prendeva, perche' giravano tutte con
 * serviceWorkers:'block'.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const radice = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const salta = new Set(['node_modules', '.git', 'media', 'design']);

function fileJs(dir) {
  const out = [];
  for (const v of readdirSync(dir)) {
    if (salta.has(v) || v.startsWith('.')) continue;
    const p = join(dir, v);
    if (statSync(p).isDirectory()) out.push(...fileJs(p));
    else if (v.endsWith('.js')) out.push(p);
  }
  return out;
}

const tutti = fileJs(radice);

test('si trovano i file da controllare', () => {
  assert.ok(tutti.length > 20, `trovati solo ${tutti.length} file JS`);
  assert.ok(tutti.some((f) => f.endsWith('/sw.js')), 'sw.js non e\' nell\'elenco');
});

for (const f of tutti) {
  const nome = f.slice(radice.length + 1);
  test(`${nome} si legge senza errori di sintassi`, () => {
    // --check da' il modulo o lo script giusto in base a package.json e
    // all'estensione: sw.js e' uno script classico, il resto sono moduli.
    try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
    catch (e) { assert.fail(`${nome}:\n${e.stderr?.toString() || e.message}`); }
  });
}
