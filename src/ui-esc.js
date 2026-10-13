/** esc() da solo: maglia.js e ui.js si userebbero a vicenda, e l'anello di
 *  import lascerebbe una delle due a metà caricamento. */
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Il testo del premio con la cifra in grande e il resto più piccolo.
 *
 * Alex, 13/10: il montepremi è un coupon da 300 €, e vuole «300€» in
 * evidenza e la parola «coupon» più piccola. Più piccola ma sempre accanto
 * alla cifra e leggibile: «300 €» da solo farebbe pensare a un premio in
 * denaro (legale/montepremi-bozza.md, sezione 6).
 * Senza una cifra in euro il testo esce com'è.
 */
export function premioHtml(testo) {
  const t = String(testo ?? '');
  const m = t.match(/€\s?\d[\d.,]*|\d[\d.,]*\s?(?:€|euro\b)/i);
  if (!m) return esc(t);
  const cifra = m[0].replace(/\s?euro$/i, ' €');
  const piccolo = (x) => (x.trim() ? `<small class="premio-t">${esc(x.trim())}</small>` : '');
  return [piccolo(t.slice(0, m.index)), `<span class="premio-c">${esc(cifra)}</span>`, piccolo(t.slice(m.index + m[0].length))]
    .filter(Boolean).join(' ');
}

