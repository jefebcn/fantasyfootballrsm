/**
 * Il video della presentazione: c'e', ed e' un video che un iPhone sa leggere.
 *
 * Questo controllo esiste perche' il video l'ho tolto io il 15 settembre —
 * pesa piu' di tutta l'app per una schermata che si vede una volta — e Alex
 * l'ha rivoluto: e' la prima cosa che si vede. Una decisione ribaltata una
 * volta si ribalta anche per sbaglio, e nessuno se ne accorge finche' non
 * apre l'app da un telefono nuovo.
 *
 * Il formato si controlla nel file, non col browser: il Chromium delle prove
 * non ha i decodificatori proprietari (canPlayType per H.264 risponde ""),
 * quindi da li' un video buono e uno rotto si somigliano. Qui si guardano le
 * scatole dentro l'MP4: avc1 vuol dire H.264 e mp4a vuol dire AAC, che sono
 * esattamente i due che Safari su iOS riproduce.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const FILE = 'media/intro.mp4';
const TETTO = 2 * 1024 * 1024;   // oggi 1,5 MB: non sta nella cache del service worker, si scarica una volta

test('il video della presentazione c\'e\' e non e\' smisurato', () => {
  const s = statSync(FILE);
  assert.ok(s.size > 100 * 1024, `${FILE} e' troppo piccolo per essere un video (${s.size} byte)`);
  assert.ok(s.size <= TETTO, `${FILE} pesa ${(s.size / 1048576).toFixed(2)} MB, oltre il tetto di 2 MB`);
});

test('ed e\' un MP4 con H.264 e AAC, cioe' + ' quello che riproduce un iPhone', () => {
  const d = readFileSync(FILE).subarray(0, 400000);
  assert.equal(d.subarray(4, 8).toString(), 'ftyp', 'non comincia con la scatola ftyp: non e\' un MP4');
  assert.ok(d.includes(Buffer.from('avc1')), 'traccia video non H.264 (manca la scatola avc1)');
  assert.ok(d.includes(Buffer.from('mp4a')), 'traccia audio non AAC (manca la scatola mp4a)');
});

test('e la presentazione punta a quel file', () => {
  const src = readFileSync('src/views/onboarding.js', 'utf8');
  assert.match(src, /<video[^>]*id="intro-video"/, 'la presentazione non ha piu\' il video');
  assert.match(src, /source src="media\/intro\.mp4"/, 'il video della presentazione punta a un altro file');
  // muted + autoplay + playsinline: senza questi tre iOS non lo fa partire da solo
  for (const attr of ['muted', 'autoplay', 'playsinline', 'loop']) {
    assert.match(src, new RegExp(`<video[^>]*\\b${attr}\\b`), `al video manca ${attr}: su iPhone non partirebbe da solo`);
  }
});
