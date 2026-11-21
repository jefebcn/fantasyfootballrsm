// La Content-Security-Policy (vercel.json) lascia girare solo gli script dell'app
// e i due scritti dentro le pagine, riconosciuti dalla loro impronta sha256.
// Se uno di quei due cambia e l'impronta no, il browser lo blocca: questa
// prova lo dice prima di pubblicare.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const csp = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
  .headers.flatMap((h) => h.headers).find((h) => h.key === 'Content-Security-Policy').value;

test('la CSP limita gli script e vieta object e base estranei', () => {
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
});

for (const pagina of ['index.html', 'link.html', 'privacy.html', 'termini.html', 'assistenza.html', 'cancella-account.html']) {
  test(`gli script dentro ${pagina} hanno l'impronta nella CSP`, () => {
    const html = readFileSync(new URL(`../${pagina}`, import.meta.url), 'utf8');
    for (const [, corpo] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
      const impronta = `'sha256-${createHash('sha256').update(corpo).digest('base64')}'`;
      assert.ok(csp.includes(impronta), `aggiungi ${impronta} a script-src in vercel.json`);
    }
    assert.doesNotMatch(html, /\son(click|load|error|submit)=/i, 'niente gestori scritti nell\'HTML: la CSP li blocca');
  });
}
