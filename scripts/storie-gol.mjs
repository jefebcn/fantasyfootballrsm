/**
 * Le storie dei gol di una giornata, fotografate in JPG 1080x1920.
 *
 *   node scripts/storie-gol.mjs --giornata 6 --dati db.json --uscita /tmp/storie
 *
 * --dati: JSON con { aderenti: [...], possesso: {id: n}, squadre: n } letti
 *   dal database (giocatori_aderenti() e le rose). Senza, nessun nome: ogni
 *   storia e' della squadra.
 * --solo id1,id2: solo quei gol (l'id e' giornata-casa-ospite-minuto-giocatore).
 *
 * Per ora fa le anteprime; la pubblicazione su Instagram arriva dopo la
 * prova di venerdi' (social/gol/storia-gol.mjs spiega i dati).
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { storieDellaGiornata, htmlStoria, modelloPer } from '../social/gol/storia-gol.mjs';

const RADICE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d = null) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };

const g = Number(arg('giornata'));
if (!g) { console.error('serve --giornata N'); process.exit(1); }
const uscita = resolve(arg('uscita', join(RADICE, 'social', 'gol', 'anteprime')));
const d = arg('dati') ? JSON.parse(readFileSync(arg('dati'), 'utf8')) : {};
const dati = { aderenti: new Set(d.aderenti || []), possesso: d.possesso || {}, squadre: d.squadre || 0 };
const solo = arg('solo')?.split(',');
const modello = arg('modello');

let storie = storieDellaGiornata(g, dati);
if (solo) storie = storie.filter((s) => solo.includes(s.id));
mkdirSync(uscita, { recursive: true });

// Come le prove: il Chromium della macchina se c'e', se no quello di Playwright.
// La pagina ridipinge le maglie leggendo i pixel di un file locale: senza
// questo permesso Chromium lo considererebbe un'altra origine e lo negherebbe.
const ARGS = ['--allow-file-access-from-files'];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ARGS }).catch(() => chromium.launch({ args: ARGS }));
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
for (const s of storie) {
  const m = modello || modelloPer(s);
  // L'HTML sta accanto al JPG e prende font e sfondo dal progetto con un
  // indirizzo file:// assoluto: cosi' si apre anche a mano per ritoccarlo.
  const html = join(uscita, `${s.id}.html`);
  writeFileSync(html, htmlStoria(s, m, pathToFileURL(RADICE).href));
  await p.goto(pathToFileURL(html).href, { waitUntil: 'load' });
  await p.waitForSelector('body[data-pronto]', { timeout: 30000 });
  await p.screenshot({ path: join(uscita, `${s.id}.jpg`), type: 'jpeg', quality: 90 });
  console.log(`${s.id}.jpg  [${m}]  ${s.nominabile ? s.marcatore : '(squadra)'}`);
}
await b.close();
