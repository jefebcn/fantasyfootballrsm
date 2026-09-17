/**
 * Contrasto dei colori scelti dall'utente.
 *
 * Il colore della squadra lo sceglie chi gioca, e su una tinta chiara (oro,
 * bianco, grigio) le iniziali bianche sparivano. Qui si calcola che inchiostro
 * regge davvero, e se non basta si scurisce o si schiarisce il fondo quanto
 * serve: meglio una tinta appena diversa che un nome illeggibile.
 */

/**
 * I colori che l'app assegna a caso alla creazione di una squadra.
 *
 * Stanno qui e non nella schermata delle leghe perche' il vincolo che devono
 * rispettare e' di questo file: sopra ognuno ci va scritta un'iniziale, e
 * deve restare leggibile. Chi ne aggiunge uno lo scopre dalla prova
 * (tests/colori-squadra.test.js), non dall'occhio.
 */
export const COLORI_SQUADRA = ['#1B84C6', '#2b7a3d', '#8a1d1d', '#5b3fa6', '#c46a00', '#1a1a1a', '#2c7a7b', '#b8321f', '#d4a017', '#0e5e93'];

const CANALI = (hex) => {
  const c = String(hex || '#334455').replace('#', '');
  const v = c.length === 3 ? c.split('').map((x) => x + x).join('') : c.padEnd(6, '0');
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) || 0);
};
const ESA = (rgb) => `#${rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;

/** Luminanza relativa secondo WCAG. */
export function luminanza(hex) {
  return CANALI(hex).map((v) => v / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
}
/** Rapporto di contrasto fra due colori: 1 = uguali, 21 = nero su bianco. */
export function contrasto(a, b) {
  const [x, y] = [luminanza(a), luminanza(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
/** Vero se sopra ci va scritto scuro. */
export const chiaro = (hex) => luminanza(hex) > 0.38;

const SCURO = '#16202E';
const CHIARO = '#FFFFFF';
const misura = (v, k) => ESA(CANALI(v).map((c) => c * k));

/**
 * Fondo e inchiostro che si leggono di sicuro (AA, 4.5).
 * @returns {{fondo: string, inchiostro: string}}
 */
/** Solo i colori in esadecimale si possono misurare. */
const esadecimale = (v) => /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(v || '').trim());

export function tintaLeggibile(hex, soglia = 4.5) {
  // Un colore scritto come var(--qualcosa) lo risolve il browser, non noi: qui
  // non si puo' misurare, e provandoci usciva nero. Si lascia com'e'.
  if (!esadecimale(hex)) return { fondo: hex || 'var(--primary)', inchiostro: '#fff' };
  const base = ESA(CANALI(hex));
  const scuroMeglio = contrasto(base, SCURO) >= contrasto(base, CHIARO);
  const inchiostro = scuroMeglio ? SCURO : CHIARO;
  if (contrasto(base, inchiostro) >= soglia) return { fondo: base, inchiostro };
  // Non basta: si sposta il fondo lontano dall'inchiostro, a piccoli passi.
  let fondo = base;
  for (let i = 0; i < 24; i++) {
    fondo = scuroMeglio
      ? ESA(CANALI(fondo).map((c) => c + (255 - c) * 0.08))   // schiarisce
      : misura(fondo, 0.92);                                   // scurisce
    if (contrasto(fondo, inchiostro) >= soglia) break;
  }
  return { fondo, inchiostro };
}
