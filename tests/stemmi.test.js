/**
 * Gli stemmi di fantasia delle squadre (media/stemmi): ce n'e' uno per ogni
 * squadra, grande e piccolo, sono immagini WebP vere, e l'app li usa al posto
 * del cerchio con la sigla.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { CLUBS } from '../src/data.js';
import { stemmaClub } from '../src/ui.js';

test('stemmi: ogni squadra ha lo stemma grande e quello piccolo, in WebP e leggeri', () => {
  for (const c of CLUBS) {
    for (const [file, max] of [[`${c.id}.webp`, 120_000], [`${c.id}-mini.webp`, 20_000]]) {
      const p = `media/stemmi/${file}`;
      assert.ok(existsSync(p), `manca ${p}`);
      const b = readFileSync(p);
      assert.equal(b.subarray(0, 4).toString(), 'RIFF', `${p} non e' un WebP`);
      assert.equal(b.subarray(8, 12).toString(), 'WEBP', `${p} non e' un WebP`);
      assert.ok(statSync(p).size < max, `${p} pesa troppo`);
    }
  }
});

test('stemmi: l\'app li mostra e il service worker tiene in cache quelli piccoli', () => {
  const html = stemmaClub(CLUBS[0], 'md');
  assert.match(html, /<img class="stemma md" src="\.\/media\/stemmi\/trefiori-mini\.webp"/);
  assert.match(stemmaClub({ color: '#123456', shortName: 'XX' }), /class="crest/, 'senza id resta la sigla');
  const sw = readFileSync('sw.js', 'utf8');
  for (const c of CLUBS) assert.ok(sw.includes(`'./media/stemmi/${c.id}-mini.webp'`), `${c.id} non e' nel precache`);
  for (const v of ['dashboard', 'classifica', 'calendario']) {
    assert.match(readFileSync(`src/views/${v}.js`, 'utf8'), /stemmaClub\(/, `${v} usa ancora la sigla`);
  }
});

test('stemmi: la nota «non ufficiali» sta nella privacy, non in vista', () => {
  assert.match(readFileSync('privacy.html', 'utf8'), /disegni di fantasia fatti da Fantatitano/);
});
