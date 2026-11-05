/**
 * Le lingue (src/lingua.js): l'italiano resta com'e', lo spagnolo arriva dal
 * dizionario, le graffe si riempiono, e il dizionario non ha traduzioni
 * storte (graffe diverse dall'italiano, frasi vuote).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { t, lingua, impostaLingua, locale } from '../src/lingua.js';
import { ES } from '../src/lingue/es.js';
import { ROLE_NAME, fmt, dateIt } from '../src/ui.js';

test('senza scelta e con un telefono non spagnolo si parla italiano', () => {
  assert.equal(lingua(), 'it');
  assert.equal(t('Portieri'), 'Portieri');
  assert.equal(t('Una frase che non c\'è da nessuna parte'), 'Una frase che non c\'è da nessuna parte');
});

test('in spagnolo la frase arriva dal dizionario, e le graffe si riempiono', () => {
  impostaLingua('es');
  try {
    assert.equal(t('Portieri'), 'Arqueros');
    assert.equal(ROLE_NAME.D, 'Defensores');
    assert.equal(locale(), 'es-ES');
    assert.equal(t('{a} e {b}', { a: 1, b: 2 }), '1 e 2');
    assert.match(dateIt('2026-11-04T12:00:00'), /^mié 4\/11$/);
    assert.equal(fmt(6.5), '6,5');
  } finally { impostaLingua('it'); }
});

test('una frase che manca esce in italiano, non vuota', () => {
  impostaLingua('es');
  try { assert.equal(t('Frase senza traduzione {x}', { x: 1 }), 'Frase senza traduzione 1'); } finally { impostaLingua('it'); }
});

test('una lingua sconosciuta torna all\'italiano', () => {
  impostaLingua('xx');
  assert.equal(lingua(), 'it');
});

const graffe = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
test('il dizionario spagnolo: niente vuoti, stesse graffe dell\'italiano', () => {
  const storte = [];
  for (const [it, es] of Object.entries(ES)) {
    if (typeof es !== 'string' || !es.trim()) storte.push(`vuota: ${it}`);
    else if (graffe(it) !== graffe(es)) storte.push(`graffe diverse: «${it}» -> «${es}»`);
  }
  assert.deepEqual(storte, []);
});

test('l\'HTML delle traduzioni e\' lo stesso dell\'italiano', () => {
  const tag = (s) => [...String(s).matchAll(/<\/?([a-z]+)/g)].map((m) => m[1]).sort().join(',');
  const storte = Object.entries(ES).filter(([it, es]) => tag(it) !== tag(es)).map(([it]) => it);
  assert.deepEqual(storte, []);
});
