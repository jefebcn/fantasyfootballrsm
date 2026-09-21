/**
 * I testi della scheda di Google Play stanno nei limiti.
 *
 * Perche' e' una prova e non un conteggio fatto a occhio: i limiti di Play
 * (nome 30, descrizione breve 80, lunga 4000) si scoprono incollando, e si
 * scoprono male — il modulo taglia o rifiuta quando sei gia' li' col
 * pacchetto pronto. Qui il conto e' automatico, e un testo che cresce di
 * troppo lo dice prima, a ogni push.
 *
 * Si controlla anche che gli indirizzi promessi nella scheda esistano come
 * file: la pagina per cancellare l'account non e' un abbellimento, e' la
 * condizione che Play mette a ogni app che fa creare un account. Prometterla
 * nel modulo e non averla e' un rifiuto.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const SCHEDA = 'store/scheda-play.md';
const testo = readFileSync(SCHEDA, 'utf8');

/** Il contenuto del blocco di codice che segue un titolo. */
function blocco(titolo) {
  const i = testo.indexOf(`## ${titolo}`);
  assert.ok(i >= 0, `manca la sezione "${titolo}" in ${SCHEDA}`);
  const apre = testo.indexOf('```', i);
  const chiude = testo.indexOf('```', apre + 3);
  assert.ok(apre > 0 && chiude > apre, `la sezione "${titolo}" non ha un blocco di testo`);
  return testo.slice(apre + 3, chiude).trim();
}

const LIMITI = [['Nome dell\'app', 30], ['Descrizione breve', 80], ['Descrizione lunga', 4000]];

for (const [titolo, max] of LIMITI) {
  test(`${titolo}: sta nei ${max} caratteri di Play`, () => {
    const t = blocco(titolo);
    assert.ok(t.length > 0, `${titolo} e' vuoto`);
    assert.ok(t.length <= max, `${titolo} e' lungo ${t.length}, il limite e' ${max}`);
  });
}

test('la descrizione non promette il montepremi prima che sia risolto', () => {
  // Play ha una policy sui concorsi a premi: annunciarlo nella scheda prima
  // di aver chiuso legale/montepremi-bozza.md e' il modo piu' veloce per
  // prendersi un rifiuto, e un rifiuto costa settimane.
  const d = blocco('Descrizione lunga').toLowerCase();
  assert.ok(!/montepremi|premio in denaro|vinci .*euro/.test(d),
    'la descrizione lunga parla di premi: prima va chiuso legale/montepremi-bozza.md');
});

test('gli indirizzi promessi nella scheda esistono come pagine vere', () => {
  for (const f of ['privacy.html', 'termini.html', 'cancella-account.html']) {
    assert.ok(existsSync(f), `${f} non c'e': la scheda di Play lo promette`);
  }
  assert.ok(testo.includes('cancella-account.html'),
    'la scheda non indica la pagina per cancellare l\'account: Play la pretende');
});

test('la pagina per cancellare l\'account dice le cose che Play pretende', () => {
  const p = readFileSync('cancella-account.html', 'utf8');
  assert.match(p, /Fantatitano/, 'deve nominare l\'app come sta nella scheda');
  assert.match(p, /support@fantatitano\.site/, 'deve dare un recapito per chiederlo senza l\'app');
  assert.match(p, /Elimina account/, 'deve dire dov\'e\' il bottone dentro l\'app');
});

/**
 * Il manifesto promette file e misure: qui si aprono e si misurano.
 *
 * Non e' pignoleria. Bubblewrap e PWABuilder costruiscono le icone Android
 * leggendo QUESTO file, e il riquadro d'installazione di Chrome mostra gli
 * screenshot elencati qui: una riga che punta a un file che non c'e' piu', o
 * una misura scritta a mano che non corrisponde, si scopre a pacchetto fatto.
 */
const manifesto = JSON.parse(readFileSync('manifest.webmanifest', 'utf8'));

/** Larghezza e altezza di un PNG, dall'intestazione IHDR. */
function misuraPng(file) {
  const d = readFileSync(file);
  assert.equal(d.readUInt32BE(0), 0x89504e47, `${file} non e' un PNG`);
  return { w: d.readUInt32BE(16), h: d.readUInt32BE(20) };
}

/** Larghezza e altezza di un JPEG, cercando il segmento SOF. */
function misuraJpeg(file) {
  const d = readFileSync(file);
  assert.equal(d.readUInt16BE(0), 0xffd8, `${file} non e' un JPEG`);
  for (let i = 2; i < d.length - 9;) {
    if (d[i] !== 0xff) { i++; continue; }
    const m = d[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      return { h: d.readUInt16BE(i + 5), w: d.readUInt16BE(i + 7) };
    }
    i += 2 + d.readUInt16BE(i + 2);
  }
  throw new Error(`${file}: non trovo le misure`);
}

test('le icone del manifesto esistono e sono grandi quanto dice', () => {
  for (const ic of manifesto.icons) {
    assert.ok(existsSync(ic.src), `manifest: ${ic.src} non c'e'`);
    const { w, h } = misuraPng(ic.src);
    assert.equal(`${w}x${h}`, ic.sizes, `${ic.src} e' ${w}x${h}, il manifesto dice ${ic.sizes}`);
  }
  assert.ok(manifesto.icons.some((i) => i.purpose === 'maskable'),
    'manca l\'icona maskable: su Android finisce in un cerchio bianco');
});

test('gli screenshot del manifesto esistono, sono 9:16 e misurano quanto dice', () => {
  const s = manifesto.screenshots || [];
  assert.ok(s.length >= 2, 'servono almeno due screenshot');
  for (const sh of s) {
    assert.ok(existsSync(sh.src), `manifest: ${sh.src} non c'e' (rigenera con scripts/schermate-store.cjs)`);
    const { w, h } = misuraJpeg(sh.src);
    assert.equal(`${w}x${h}`, sh.sizes, `${sh.src} e' ${w}x${h}, il manifesto dice ${sh.sizes}`);
    // 9:16 e lato minimo 320: sono i limiti di Play, e le stesse immagini
    // servono per la scheda dello Store.
    assert.equal(w * 16, h * 9, `${sh.src} non e' 9:16 (${w}x${h})`);
    assert.ok(w >= 1080, `${sh.src} e' largo ${w}: sotto i 1080 Play non la consiglia`);
    assert.ok(sh.label, `${sh.src} non ha una didascalia`);
  }
});

test('la grafica d\'intestazione e\' esattamente 1024x500', () => {
  const f = 'store/grafica-1024x500.jpg';
  assert.ok(existsSync(f), `${f} non c'e'`);
  const { w, h } = misuraJpeg(f);
  assert.equal(`${w}x${h}`, '1024x500', `la grafica e' ${w}x${h}: Play la vuole 1024x500`);
});
