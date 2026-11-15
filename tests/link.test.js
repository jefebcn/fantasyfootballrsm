/**
 * La pagina del link in bio (link.html): la prima voce segue il calendario,
 * ogni link porta l'etichetta di provenienza, e la pagina va davvero online.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync('link.html', 'utf8');

/** Esegue lo script della pagina con un documento finto e restituisce window. */
function pagina({ ua = 'iPhone', widget = null } = {}) {
  const el = {};
  const nodo = (id) => (el[id] ||= {
    id, hidden: false, textContent: '', href: '', attrs: {}, parentNode: { appendChild() {}, parentNode: { appendChild() {} } },
    getAttribute(k) { return this.attrs[k]; }, setAttribute(k, v) { this.attrs[k] = v; },
  });
  const voci = [...html.matchAll(/<a class="voce[^"]*"(?: id="([^"]+)")? data-voce="([^"]+)" href="([^"]+)"/g)]
    .map(([, id, voce, href], i) => Object.assign(nodo(id || `v${i}`), { attrs: { 'data-voce': voce, href } }));
  const window = {};
  const ctx = {
    window, navigator: { userAgent: ua }, setInterval() {}, Date, Math,
    document: { getElementById: nodo, querySelectorAll: () => voci },
    fetch: () => Promise.resolve(widget ? { ok: true, json: () => widget } : { ok: false }),
  };
  vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], ctx);
  return { window, voci, el };
}

const G = (n, chiusura, partite) => ({ giornata: n, chiusura, partite: partite.map((quando) => ({ casa: 'A', ospite: 'B', quando })) });
const CAL = [
  G(8, '2026-11-07T13:50:00.000Z', ['2026-11-07T14:00:00.000Z', '2026-11-08T14:00:00.000Z']),
  G(9, '2026-11-20T20:05:00.000Z', ['2026-11-20T20:15:00.000Z', '2026-11-21T14:00:00.000Z']),
];

test('link: prima della chiusura invita a schierare la formazione, con giorno, ora di Roma e conto alla rovescia', () => {
  const { window } = pagina();
  const o = window.__adesso(CAL, Date.parse('2026-11-15T10:00:00Z'));
  assert.equal(o.voce, 'formazione');
  assert.match(o.t, /9ª giornata/);
  assert.match(o.s, /venerdì 20 novembre alle 21:05/);
  assert.equal(o.c, 'mancano 5 giorni');
});

test('link: a giornata in corso porta ai voti, a stagione finita alla classifica', () => {
  const { window } = pagina();
  assert.equal(window.__adesso(CAL, Date.parse('2026-11-21T15:00:00Z')).voce, 'voti');
  assert.equal(window.__adesso(CAL, Date.parse('2026-11-22T10:00:00Z')).voce, 'classifica');
  // fra le due giornate (finita l'8ª) torna la formazione della 9ª
  assert.equal(window.__adesso(CAL, Date.parse('2026-11-10T10:00:00Z')).voce, 'formazione');
  assert.equal(window.__adesso(CAL, Date.parse('2026-11-20T19:30:00Z')).c, 'mancano 35 minuti');
});

test('link: ogni link del sito porta utm_source=instagram e il nome della voce, prima del #', () => {
  const { voci } = pagina();
  const sito = voci.filter((a) => !/^https?:/.test(a.attrs.href));
  assert.ok(sito.length >= 4);
  for (const a of sito) {
    assert.match(a.href, /^\.\/\?utm_source=instagram&utm_medium=bio&utm_content=[a-z-]+#\//, a.href);
  }
  const ios = voci.find((a) => a.id === 'ios');
  assert.match(ios.attrs.href, /^https:\/\/apps\.apple\.com\/it\/app\/fantatitano\/id6834601552$/);
});

test('link: i link portano a schermate che l\'app ha davvero', () => {
  const rotte = readFileSync('src/app.js', 'utf8');
  for (const [, r] of html.matchAll(/href="\.\/#\/([a-z/]*)"/g)) {
    if (r) assert.ok(rotte.includes(`['${r}'`), `l'app non ha la rotta #/${r}`);
  }
});

test('link: va online come /link e resta nel browser anche con l\'app installata', () => {
  const elenco = readFileSync('scripts/costruisci.mjs', 'utf8').match(/export const ELENCO = \[([\s\S]*?)\];/)[1];
  assert.match(elenco, /'link\.html'/, 'link.html manca nell\'elenco di costruisci.mjs');
  const v = JSON.parse(readFileSync('vercel.json', 'utf8'));
  assert.ok(v.rewrites?.some((r) => r.source === '/link' && r.destination === '/link.html'));
  const aasa = JSON.parse(readFileSync('.well-known/apple-app-site-association', 'utf8'));
  const c = aasa.applinks.details[0].components;
  const i = c.findIndex((x) => x['/'] === '/link' && x.exclude);
  assert.ok(i >= 0 && i < c.findIndex((x) => x['/'] === '/*'), 'le esclusioni vanno prima di /*');
});

test('link: niente strumenti di terzi nella pagina', () => {
  const esterni = [...html.matchAll(/<(?:script|link)[^>]+(?:src|href)="(https?:[^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(esterni, []);
});
