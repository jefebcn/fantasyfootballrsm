/**
 * La scheda che compare quando si condivide fantatitano.site.
 *
 * Ogni invito a una lega passa da un messaggio su WhatsApp o Telegram, e
 * senza i tag Open Graph il link arrivava nudo. Qui si controlla che i tag
 * ci siano e che l'immagine regga: esiste, e' della misura giusta, e sta
 * sotto i 300 kB — oltre, WhatsApp a volte lascia il link senza anteprima.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const og = (p) => (html.match(new RegExp(`<meta property="og:${p}" content="([^"]*)"`)) || [])[1];

test('la pagina ha la scheda per le anteprime', () => {
  for (const p of ['title', 'description', 'image', 'url', 'type']) assert.ok(og(p), `manca og:${p}`);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
});

test("l'immagine ha l'indirizzo intero: i lettori delle anteprime non risolvono i relativi", () => {
  assert.match(og('image'), /^https:\/\/fantatitano\.site\//);
});

test("l'immagine c'e', e' 1200x630 e sta sotto i 300 kB", () => {
  const file = og('image').replace('https://fantatitano.site/', '');
  const buf = readFileSync(file);
  // misura dal JPEG stesso: il primo marcatore SOF porta altezza e larghezza
  let i = 2, w = 0, h = 0;
  while (i < buf.length) {
    const m = buf[i + 1]; const len = buf.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xc3) { h = buf.readUInt16BE(i + 5); w = buf.readUInt16BE(i + 7); break; }
    i += 2 + len;
  }
  assert.deepEqual([w, h], [1200, 630], `misura ${w}x${h}`);
  assert.equal(og('image:width'), '1200'); assert.equal(og('image:height'), '630');
  assert.ok(statSync(file).size < 300 * 1024, `${Math.round(statSync(file).size / 1024)} kB`);
});
