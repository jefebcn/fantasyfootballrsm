/**
 * Gli stemmi di fantasia delle squadre (media/stemmi): ce n'e' uno per ogni
 * squadra, sono quelli che esce dal disegno di adesso, non dipendono da
 * caratteri o file esterni, e l'app li usa al posto del cerchio con la sigla.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { CLUBS } from '../src/data.js';
import { stemma } from '../strumenti/stemmi/disegno.mjs';
import { stemmaClub } from '../src/ui.js';

test('stemmi: ogni squadra ha lo stemma grande e quello piccolo, aggiornati al disegno', () => {
  for (const c of CLUBS) {
    for (const [file, mini, size] of [[`${c.id}.svg`, false, 200], [`${c.id}-mini.svg`, true, 64]]) {
      const p = `media/stemmi/${file}`;
      assert.ok(existsSync(p), `manca ${p}`);
      assert.equal(readFileSync(p, 'utf8'), stemma(c, { mini, size }) + '\n', `${p} non e' aggiornato: node strumenti/stemmi/genera.mjs`);
    }
  }
});

test('stemmi: niente scritte da font, niente file esterni', () => {
  for (const c of CLUBS) {
    const svg = readFileSync(`media/stemmi/${c.id}.svg`, 'utf8');
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 200 220"/);
    assert.doesNotMatch(svg, /<text|<image|https?:\/\/(?!www\.w3\.org)/, c.id);
  }
});

test('stemmi: l\'app li mostra e il service worker tiene in cache quelli piccoli', () => {
  const html = stemmaClub(CLUBS[0], 'md');
  assert.match(html, /<img class="stemma md" src="\.\/media\/stemmi\/trefiori-mini\.svg"/);
  assert.match(stemmaClub({ color: '#123456', shortName: 'XX' }), /class="crest/, 'senza id resta la sigla');
  const sw = readFileSync('sw.js', 'utf8');
  for (const c of CLUBS) assert.ok(sw.includes(`'./media/stemmi/${c.id}-mini.svg'`), `${c.id} non e' nel precache`);
  for (const v of ['dashboard', 'classifica', 'calendario']) {
    assert.match(readFileSync(`src/views/${v}.js`, 'utf8'), /stemmaClub\(/, `${v} usa ancora la sigla`);
  }
});

test('stemmi: la nota «non ufficiali» sta nella privacy, non in vista', () => {
  assert.match(readFileSync('privacy.html', 'utf8'), /disegni di fantasia fatti da Fantatitano/);
});
