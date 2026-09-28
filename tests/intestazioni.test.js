/**
 * Le intestazioni di sicurezza che Vercel manda con ogni pagina.
 *
 * Stanno in vercel.json, che e' JSON e non ha commenti: il perche' sta qui.
 *
 * NIENTE CORNICI. Senza X-Frame-Options / frame-ancestors, una pagina
 * qualsiasi puo' caricare fantatitano.site dentro un riquadro invisibile e
 * mettere sopra un bottone finto: chi crede di premere quello preme la
 * console da amministratore sotto. L'app non si incornicia da nessuna parte
 * — la versione del Play Store e' un TWA, non un iframe — quindi il divieto
 * non toglie niente a nessuno. I due nomi dicono la stessa cosa: il primo
 * per i browser vecchi, il secondo e' quello di oggi.
 *
 * IL REFERRER NON SI SPEGNE DEL TUTTO. Il lettore di YouTube incorporato
 * vuole sapere da che sito viene chiamato, e senza risponde con un errore
 * di configurazione al posto del video: gli highlights sparirebbero senza
 * che niente dica perche'. strict-origin-when-cross-origin manda solo
 * l'origine (fantatitano.site, non la pagina), che e' quanto serve e niente
 * di piu'.
 *
 * NIENTE CSP COMPLETA, PER ORA. Una Content-Security-Policy vera va scritta
 * insieme a tutte le cose che l'app carica da fuori (Supabase, YouTube,
 * i font) e provata col browser: scritta a mano e mandata senza prova,
 * rompe qualcosa in silenzio il giorno che la si pubblica.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const conf = JSON.parse(readFileSync('vercel.json', 'utf8'));
const perTutte = conf.headers.find((h) => h.source === '/(.*)');
const valore = (nome) => perTutte?.headers.find((h) => h.key.toLowerCase() === nome.toLowerCase())?.value;

test('ogni pagina ha le sue intestazioni di sicurezza', () => {
  assert.ok(perTutte, 'manca la regola "/(.*)" in vercel.json');
});

test('nessuno puo\' incorniciare l\'app', () => {
  assert.equal(valore('X-Frame-Options'), 'DENY');
  assert.match(valore('Content-Security-Policy') || '', /frame-ancestors 'none'/);
});

test('i file si leggono per quello che dicono di essere', () => {
  assert.equal(valore('X-Content-Type-Options'), 'nosniff');
});

test('il referrer resta acceso quanto basta a YouTube', () => {
  const r = valore('Referrer-Policy');
  assert.ok(r, 'manca Referrer-Policy');
  assert.ok(!/^(no-referrer|same-origin)$/.test(r),
    `"${r}" toglie l'origine alle richieste verso YouTube: il lettore incorporato risponde con un errore al posto del video`);
});

test('il service worker continua a non restare in cache', () => {
  const sw = conf.headers.find((h) => h.source === '/sw.js');
  assert.equal(sw?.headers.find((h) => h.key === 'Cache-Control')?.value, 'no-cache');
});
