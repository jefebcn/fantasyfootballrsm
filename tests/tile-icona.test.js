/**
 * Il riquadro dell'icona dentro .tile deve dichiarare il proprio padding.
 *
 * Sembra pignoleria e non lo è. Quel riquadro prende una seconda classe che
 * dice il tono — warn, gold, live — e in questa app "warn" è ANCHE il banner
 * d'avviso, che ha `padding:10px 12px`. Finché `.tile > .lead` non dichiarava
 * il padding non c'era niente da vincere: quello del banner scendeva dentro il
 * riquadro e spostava il simbolo. Stessa storia con `.lead`, che era anche la
 * card dell'anteprima classifica.
 *
 * Sommati, i due spostavano ogni icona di 5px a destra e 1px in basso, su ogni
 * tile dell'app. Si vede a occhio appena due tile stanno una sopra l'altra, ed
 * è quello che ha notato Alex.
 *
 * La difesa non è "non chiamare due cose con lo stesso nome" — prima o poi
 * ricapita — ma dichiarare qui le proprietà che decidono dove sta il simbolo,
 * così nessuna classe generica può metterci bocca.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const radice = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const css = readFileSync(`${radice}/styles/app.css`, 'utf8');

const corpo = (selettore) => {
  const q = selettore.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = css.match(new RegExp(`(?:^|[,}])\\s*${q}\\s*(?:,[^{}]*)?\\{([^}]*)\\}`, 'm'));
  return m ? m[1] : null;
};

test('.tile > .lead dichiara il proprio padding', () => {
  const c = corpo('.tile > .lead');
  assert.ok(c, 'la regola .tile > .lead non si trova');
  assert.match(c, /(^|;)\s*padding\s*:/,
    'senza padding dichiarato lo decide .warn (il banner), e il simbolo esce dal centro');
});

test('la card dell\'anteprima classifica non si prende tutti i .lead', () => {
  assert.equal(corpo('.lead'), null,
    'una regola .lead nuda tocca anche il riquadro dell\'icona dentro .tile: va ristretta a .a-card.lead');
});
