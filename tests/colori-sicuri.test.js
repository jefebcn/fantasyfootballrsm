// Colore, maglia e foto della squadra li scrive chi gioca, e finiscono dentro
// style="…" e src="…" nelle schermate di tutta la lega. Il controllo del
// 13/10 ha trovato che un testo qualsiasi passava com'era. Qui: tutto quello
// che non e' un colore vero diventa il colore di ripiego, e la foto dello
// stemma si carica solo se e' un'immagine dentro l'app. Il database (033)
// rifiuta gli stessi valori: supabase/prove/funzioni.sql.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crest, fotoStemma } from '../src/ui.js';
import { maglia, kitOf } from '../src/maglia.js';
import { coloreSicuro, tintaLeggibile } from '../src/colore.js';

const cattivi = ['red"><img src=x onerror=alert(1)>', 'blue;background:url(//x)', 'javascript:1', '#12345g', ''];

test('un colore che non e\' un colore diventa quello di ripiego', () => {
  for (const c of cattivi) {
    assert.equal(coloreSicuro(c, '#1B84C6'), '#1B84C6', c);
    assert.equal(tintaLeggibile(c).fondo, 'var(--primary)', c);
  }
  assert.equal(coloreSicuro('abc'), '#abc');
  assert.equal(coloreSicuro('#27AE60'), '#27AE60');
  assert.equal(tintaLeggibile('var(--c-oro-400)').fondo, 'var(--c-oro-400)');
});

test('stemma e maglia non portano testo dentro le schermate', () => {
  for (const c of cattivi) {
    const html = crest({ color: c, initials: 'AB' }) + maglia(kitOf({ color: c, kit: { c1: c } }));
    assert.ok(!/onerror|src=x|url\(|javascript/i.test(html), html);
  }
});

test('la foto dello stemma si carica solo se e\' un\'immagine dentro l\'app', () => {
  assert.ok(fotoStemma('data:image/jpeg;base64,/9j/AAAA'));
  for (const u of ['https://esempio.org/x.png', 'data:text/html;base64,PHNjcmlwdD4=', 'javascript:alert(1)', '']) {
    assert.ok(!fotoStemma(u), u);
    assert.ok(!/<img/.test(crest({ color: '#abc', crestUrl: u, initials: 'AB' })), u);
  }
});
