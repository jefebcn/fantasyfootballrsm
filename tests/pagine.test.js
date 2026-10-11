/**
 * Tutte le righe, non le prime mille.
 *
 * Supabase ne restituisce al massimo 1000 per richiesta e il resto sparisce
 * senza errore. L'11 ottobre i tabellini erano gia' 1023 presenze: quelle in
 * piu' non arrivavano, e i giocatori risultavano senza voto. tutte() le
 * chiede a pagine finche' una non torna incompleta.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tutte, PAGINA } from '../src/backend.js';

/** Un finto server che, come Supabase, non da' mai piu' di 1000 righe. */
function server(quante) {
  const righe = Array.from({ length: quante }, (_, i) => ({ i }));
  const chieste = [];
  const richiesta = () => ({
    range(da, a) {
      chieste.push([da, a]);
      return Promise.resolve({ data: righe.slice(da, Math.min(a + 1, da + 1000)), error: null });
    },
  });
  return { richiesta, chieste };
}

test('1023 righe arrivano tutte, non 1000', async () => {
  const s = server(1023);
  const r = await tutte(s.richiesta);
  assert.equal(r.length, 1023);
  assert.deepEqual(r.map((x) => x.i), [...Array(1023).keys()]);
  assert.deepEqual(s.chieste, [[0, PAGINA - 1], [PAGINA, 2 * PAGINA - 1]]);
});

test('sotto le mille basta una richiesta', async () => {
  const s = server(780);
  assert.equal((await tutte(s.richiesta)).length, 780);
  assert.equal(s.chieste.length, 1);
});

test('esattamente mille: una pagina in piu\', vuota, e si ferma', async () => {
  const s = server(1000);
  assert.equal((await tutte(s.richiesta)).length, 1000);
  assert.equal(s.chieste.length, 2);
});

test('nessuna riga: lista vuota', async () => {
  assert.deepEqual(await tutte(server(0).richiesta), []);
});

test('un errore del server non diventa una lista mozza', async () => {
  const richiesta = () => ({ range: () => Promise.resolve({ data: null, error: { message: 'permesso negato' } }) });
  await assert.rejects(() => tutte(richiesta));
});
