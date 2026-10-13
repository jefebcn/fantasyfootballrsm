// Il premio: la cifra in grande, il resto («coupon») piu' piccolo ma sempre
// accanto e leggibile. Alex, 13/10. Vedi premioHtml in src/ui-esc.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { premioHtml } from '../src/ui-esc.js';

test('la cifra in evidenza, «coupon» piccolo accanto', () => {
  assert.equal(premioHtml('300€ coupon'), '<span class="premio-c">300€</span> <small class="premio-t">coupon</small>');
  assert.equal(premioHtml('Coupon da 300 €'), '<small class="premio-t">Coupon da</small> <span class="premio-c">300 €</span>');
  assert.equal(premioHtml('300 euro di coupon'), '<span class="premio-c">300 €</span> <small class="premio-t">di coupon</small>');
});

test('senza cifra il testo resta com\'e\', e non si inietta niente', () => {
  assert.equal(premioHtml('una cena offerta'), 'una cena offerta');
  assert.equal(premioHtml('<b>300€</b>'), '<small class="premio-t">&lt;b&gt;</small> <span class="premio-c">300€</span> <small class="premio-t">&lt;/b&gt;</small>');
  assert.equal(premioHtml(null), '');
});
