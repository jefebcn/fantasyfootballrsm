/**
 * "1 crediti" non lo scrive nessuno.
 *
 * L'app conta bene quasi ovunque, ma nei punti dove il numero puo' valere UNO
 * restava il plurale fisso: nel mercato usciva "Servirebbero almeno 1 crediti
 * e il massimo che puoi offrire e' 0", e lo stesso nell'asta, nella lega e
 * nella fascia di home. Qui si prova l'aiutante che li aggiusta, e che le
 * viste lo usino davvero dove il numero puo' essere 1.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ui = readFileSync('src/ui.js', 'utf8');

test('plurale sceglie la parola giusta', async () => {
  const { plurale } = await import('../src/ui.js');
  assert.equal(plurale(1, 'credito', 'crediti'), '1 credito');
  assert.equal(plurale(0, 'credito', 'crediti'), '0 crediti');
  assert.equal(plurale(2, 'credito', 'crediti'), '2 crediti');
  assert.equal(plurale(1, 'giocatore', 'giocatori'), '1 giocatore');
});

test('ui.js esporta plurale una volta sola', () => {
  assert.equal((ui.match(/export const plurale/g) || []).length, 1);
});

// I punti dove il numero PUO' valere uno: il credito rimasto, il prezzo
// pagato, l'offerta minima, i giocatori che mancano. Dove non puo' — il
// budget di lega parte da 50 — il plurale fisso va bene e non si tocca.
const DOVE = [
  ['src/views/mercato.js', 3],
  ['src/views/asta.js', 4],
  ['src/views/lega.js', 1],
  ['src/views/dashboard.js', 1],
  ['src/views/negozio.js', 2],
];

for (const [file, quanti] of DOVE) {
  test(`${file} usa plurale dove il numero puo' essere 1`, () => {
    const src = readFileSync(file, 'utf8');
    const usi = (src.match(/plurale\(/g) || []).length;
    assert.ok(usi >= quanti, `${file}: ${usi} usi di plurale(), me ne aspetto almeno ${quanti}`);
    assert.match(src, /import \{[^}]*plurale[^}]*\} from '\.\.\/ui\.js'/, `${file}: plurale non e' importato`);
  });
}
