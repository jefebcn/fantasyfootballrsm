/**
 * Prepara la cartella che Vercel pubblica (pubblico/).
 *
 * Alex, 13/10: il repository resta pubblico, ma dal sito non si deve quasi
 * poter risalire al progetto. Prima Vercel pubblicava la radice del
 * repository cosi' com'era: chiunque leggeva il codice dell'app trovava nei
 * commenti i percorsi dei file, le migrazioni, i lavori di GitHub, i nomi di
 * chi ci lavora — tutte strade che portano dritte al repository.
 *
 * Qui si copia SOLO quello che serve all'app (un elenco, non "tutto tranne"):
 * un file nuovo resta fuori finche' qualcuno non decide che va online. JS e
 * CSS escono senza commenti e compressi; le pagine HTML senza commenti.
 *
 * Il codice di supabase-js in vendor/ si copia com'e': e' gia' compresso e la
 * sua riga di licenza deve restare.
 *
 *   node scripts/costruisci.mjs            -> pubblico/
 *   node scripts/costruisci.mjs <cartella> -> li' (lo usano le prove)
 */
import { transform } from 'esbuild';
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..');
const USCITA = process.argv[2] ? resolve(process.argv[2]) : join(RADICE, 'pubblico');

// Quello che va online. Le cartelle si copiano intere tranne cio' che SALTA.
export const ELENCO = [
  'index.html', 'privacy.html', 'termini.html', 'cancella-account.html',
  'manifest.webmanifest', 'sw.js',
  '.well-known', 'src', 'styles', 'media', 'icons', 'vendor', 'design/tokens',
];
// i sorgenti delle immagini (decine di MB) e le note di lavoro non servono all'app
const DATI = /^src\/((calendario|eventi|listone|video)-dati|listone-extra)\.js$/;
const SALTA = (rel) => /(^|\/)[^/]*-sorgenti(\/|$)/.test(rel) || /\.md$/i.test(rel);

async function* file(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* file(p); else yield p;
  }
}

const senzaCommentiHtml = (html) => html.replace(/<!--(?!\[if)[\s\S]*?-->/g, '');

async function copia(rel) {
  const da = join(RADICE, rel), a = join(USCITA, rel);
  if (SALTA(rel)) return 0;
  await mkdir(dirname(a), { recursive: true });
  if (rel.startsWith('vendor/')) { await cp(da, a); return 1; }
  // I file di dati generati dagli import si tolgono solo dell'intestazione
  // (che nomina gli script): compressi non pesano meno di tanto, e le prove
  // col browser li riscrivono al volo cercando il loro testo.
  if (DATI.test(rel)) {
    await writeFile(a, (await readFile(da, 'utf8')).replace(/^\s*\/\*[\s\S]*?\*\/\s*/, ''));
    return 1;
  }
  if (rel.endsWith('.js') || rel.endsWith('.css')) {
    const codice = await readFile(da, 'utf8');
    const { code } = await transform(codice, {
      loader: rel.endsWith('.css') ? 'css' : 'js',
      minify: true, legalComments: 'none', charset: 'utf8',
    });
    await writeFile(a, code);
    return 1;
  }
  if (rel.endsWith('.html')) { await writeFile(a, senzaCommentiHtml(await readFile(da, 'utf8'))); return 1; }
  await cp(da, a);
  return 1;
}

await rm(USCITA, { recursive: true, force: true });
let n = 0;
for (const voce of ELENCO) {
  const da = join(RADICE, voce);
  if ((await stat(da)).isDirectory()) {
    for await (const f of file(da)) n += await copia(relative(RADICE, f));
  } else n += await copia(voce);
}
console.log(`pubblicati ${n} file in ${relative(process.cwd(), USCITA) || '.'}`);
