/**
 * Le storie automatiche del futsal (social/futsal/storie-futsal.mjs): le
 * sceglie confrontando src/futsal-dati.js prima e dopo l'import, le fotografa
 * in JPG 1080x1920 e le pubblica subito su @fantatitano.futsal con la
 * funzione Supabase pubblica-futsal (Buffer, «condividi ora»: non occupano i
 * 10 posti della coda).
 *
 *   node scripts/storie-futsal.mjs                    prima = il commit di prima (HEAD^)
 *   node scripts/storie-futsal.mjs --prima vecchio.js --uscita /tmp/s --prova
 *   node scripts/storie-futsal.mjs --anteprima 11     tutte le storie della 11ª, senza pubblicare
 *
 * La lancia scripts/importa-in-giro.sh subito dopo un push riuscito, cosi'
 * la storia esce solo quando i dati sono gia' nell'app.
 *
 * STORIE_FUTSAL (variabile del repository): 'off' spegne tutto, 'prova' le
 * fotografa senza pubblicarle; vuota o 'on' pubblica. Il doppione lo ferma la
 * funzione (storie_pubblicate), quindi rilanciarla non ripubblica niente.
 *
 * Righe che scrive: STORIA, PUBBLICATA, PROVA, GIA' FATTA, TETTO, ERRORE.
 * Esce con 0 anche se una storia non esce: non deve mai fermare l'import.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { storieNuove, fattiRisultato, fattiGiornata, htmlRisultato, htmlGiornata, fotoPer } from '../social/futsal/storie-futsal.mjs';

const RADICE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d = null) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const MODO = process.argv.includes('--prova') || arg('anteprima') ? 'prova' : (process.env.STORIE_FUTSAL || 'on');
if (MODO === 'off') { console.log('storie futsal spente (STORIE_FUTSAL=off)'); process.exit(0); }

const F = await import(pathToFileURL(join(RADICE, 'src/futsal.js')).href);
const dopo = await import(pathToFileURL(join(RADICE, 'src/futsal-dati.js')).href);
const { LANCIO } = await import(pathToFileURL(join(RADICE, 'src/lancio-futsal.js')).href);

let storie;
if (arg('anteprima')) {
  const g = Number(arg('anteprima'));
  storie = storieNuove({ CALENDARIO: dopo.CALENDARIO, REFERTI: dopo.REFERTI.filter((r) => r.g !== g) }, dopo);
  // la storia della giornata anche se la giornata è vecchia (per l'anteprima conta vederla)
  if (!storie.some((s) => s.tipo === 'giornata') && F.conclusa(g)) storie.push({ tipo: 'giornata', id: `futsal-giornata-${g}`, g });
} else {
  let file = arg('prima');
  if (!file) {
    file = join(mkdtempSync(join(tmpdir(), 'futsal-prima-')), 'futsal-dati.mjs');
    try {
      writeFileSync(file, execFileSync('git', ['show', 'HEAD^:src/futsal-dati.js'], { cwd: RADICE, maxBuffer: 64 << 20 }));
    } catch {
      console.log('storie futsal: niente commit di prima da confrontare'); process.exit(0);
    }
  }
  storie = storieNuove(await import(pathToFileURL(resolve(file)).href), dopo);
}
if (!storie.length) { console.log('storie futsal: nessun referto nuovo'); process.exit(0); }

const uscita = resolve(arg('uscita', mkdtempSync(join(tmpdir(), 'storie-futsal-'))));
mkdirSync(uscita, { recursive: true });
const base = pathToFileURL(RADICE).href.replace(/\/$/, '');

const { chromium } = await import('playwright');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
// le foto FSGC di sfondo (social/futsal/foto-partite.json): senza l'elenco, la storia esce senza foto
let POOL = [];
try { POOL = JSON.parse(readFileSync(join(RADICE, 'social/futsal/foto-partite.json'), 'utf8')).foto || []; } catch { /* niente foto */ }
const fatte = [];
for (const s of storie) {
  try {
    let f;
    if (s.tipo === 'risultato') { f = fattiRisultato(F, s); f.foto = fotoPer(POOL, s.casa, s.ospite, s.g); }
    else { f = fattiGiornata(F, s, { lancio: LANCIO.da }); const c = f.top[0]?.club; f.foto = fotoPer(POOL, c, c, s.g); }
    const html = s.tipo === 'risultato' ? htmlRisultato(f, base) : htmlGiornata(f, base);
    const fileHtml = join(uscita, `${s.id}.html`);
    writeFileSync(fileHtml, html);
    await p.goto(pathToFileURL(fileHtml).href, { waitUntil: 'load' });
    await p.waitForSelector('body[data-pronto]', { timeout: 30000 });
    // ogni immagine (foto, stemmi) deve essersi caricata: se no la storia non esce
    const rotte = await p.evaluate(() => [...document.images].filter((i) => !i.complete || !i.naturalWidth).map((i) => i.getAttribute('src')));
    if (rotte.length) { console.log(`ERRORE ${s.id} immagini non caricate: ${rotte.join(' ')}`); continue; }
    const jpg = join(uscita, `${s.id}.jpg`);
    await p.screenshot({ path: jpg, type: 'jpeg', quality: 90 });
    console.log(`STORIA ${jpg}${f.foto ? `  · foto ${f.foto.id} ${f.foto.credito}` : "  · senza foto"}`);
    fatte.push({ ...s, jpg });
  } catch (e) {
    console.log(`ERRORE ${s.id} ${e.message}`);
  }
}
await b.close();

if (MODO === 'prova') { for (const s of fatte) console.log(`PROVA ${s.id} (non pubblicata)`); process.exit(0); }

// --- pubblicazione: il lavoro si presenta col suo token OIDC di GitHub, la
// funzione lo verifica (repository, file del lavoro, ramo main). Nessun segreto qui.
const { SUPABASE_URL } = await import(pathToFileURL(join(RADICE, 'src/config.js')).href);
const { ACTIONS_ID_TOKEN_REQUEST_URL: chiedi, ACTIONS_ID_TOKEN_REQUEST_TOKEN: perm } = process.env;
if (!chiedi || !perm) { console.log('ERRORE manca il token OIDC di GitHub (permissions: id-token: write)'); process.exit(0); }
for (const s of fatte) {
  try {
    const oidc = await (await fetch(`${chiedi}&audience=fantatitano-storie-futsal`, { headers: { authorization: `Bearer ${perm}` } })).json();
    if (!oidc.value) throw new Error('GitHub non ha dato il token OIDC');
    const r = await fetch(`${SUPABASE_URL}/functions/v1/pubblica-futsal?id=${encodeURIComponent(s.id)}`, {
      method: 'POST', headers: { authorization: `Bearer ${oidc.value}`, 'content-type': 'image/jpeg' }, body: readFileSync(s.jpg),
    });
    const j = await r.json().catch(() => ({ esito: 'ERRORE', motivo: `risposta ${r.status} non leggibile` }));
    console.log(j.esito === 'PUBBLICATA' ? `PUBBLICATA ${s.id} ${j.buffer}` : `${j.esito || 'ERRORE'} ${s.id}${j.motivo ? ` ${j.motivo}` : ''}`);
  } catch (e) {
    console.log(`ERRORE ${s.id} ${e.message}`);
  }
}
