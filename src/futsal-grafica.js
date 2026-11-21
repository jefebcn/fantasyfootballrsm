/**
 * I pezzi di grafica del futsal (FUTSAL.md § 13.12), nello stile scelto da
 * Alex il 29/10: colori del «Carta», struttura dell'«Arena».
 *
 *   magliaFs   la maglia disegnata: colore della squadra, fascia inclinata,
 *              numero grande in Teko e, dove c'e' spazio, il cognome
 *   logoFs     il marchio «Fantafutsal»: pallone, FANTA nero, FUTSAL rosso
 *   caricaFs   l'attesa: un pallone che rimbalza su una riga rossa
 *
 * Solo stringhe di HTML e SVG, niente immagini da scaricare: le maglie sono
 * una per giocatore e cambiano colore con la squadra.
 */
import { esc } from './ui-esc.js';

const ESADECIMALE = /^#[0-9a-f]{6}$/i;
const tinta = (c) => (ESADECIMALE.test(String(c)) ? c : '#2B4C7E');
/** Chiaro o scuro: decide se il numero va bianco o nero. */
function chiaro(c) {
  const n = parseInt(tinta(c).slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62;
}
/** La stessa tinta piu' scura, per la fascia e le maniche. */
function scuro(c, f = 0.72) {
  const n = parseInt(tinta(c).slice(1), 16);
  const s = (x) => Math.round(x * f).toString(16).padStart(2, '0');
  return `#${s(n >> 16)}${s((n >> 8) & 255)}${s(n & 255)}`;
}

let progressivo = 0;
/**
 * La maglia. colore: della squadra; numero: quello di distinta (o 'P' per la
 * Porta); nome: il cognome sulle spalle, solo nelle maglie grandi; porta:
 * maniche lunghe e fascia a scacchi, come i portieri.
 */
export function magliaFs({ colore, numero = '', nome = '', porta = false } = {}) {
  const c = tinta(colore), s = scuro(c), inchiostro = chiaro(c) ? '#111111' : '#FFFFFF', bordo = chiaro(c) ? '#FFFFFF' : '#111111';
  const id = `fsm${++progressivo}`;
  const maniche = porta
    ? 'M14 10 2 17v30l10 2 3-25z M50 10l12 7v30l-10 2-3-25z'
    : 'M14 10 2 18l6 13 8-5z M50 10l12 8-6 13-8-5z';
  const n = String(numero ?? '').slice(0, 2);
  const cognome = String(nome || '').toUpperCase().slice(0, 11);
  return `<svg class="fs-maglia" viewBox="0 0 64 70" aria-hidden="true">
    <defs><clipPath id="${id}"><path d="M14 10 22 5h20l8 5 4 56H10z"/></clipPath></defs>
    <path d="${maniche}" fill="${s}" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M14 10 22 5h20l8 5 4 56H10z" fill="${c}"/>
    <g clip-path="url(#${id})">${porta
    ? `<path d="M0 34h64v6H0z M0 46h64v6H0z" fill="${s}" opacity=".9"/>`
    : `<path d="M-6 60 60 4l10 6L4 66z" fill="${s}" opacity=".85"/><path d="M8 66 70 14v5L12 70z" fill="#FF4B2B"/>`}</g>
    <path d="M14 10 22 5h20l8 5 4 56H10z" fill="none" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M24 5l8 8 8-8" fill="none" stroke="#111" stroke-width="2.2" stroke-linejoin="round"/>
    ${cognome ? `<text x="32" y="23" text-anchor="middle" class="fs-maglia-nome" fill="${inchiostro}" stroke="${bordo}" stroke-width="1.6" paint-order="stroke">${esc(cognome)}</text>` : ''}
    ${n ? `<text x="32" y="${cognome ? 52 : 50}" text-anchor="middle" class="fs-maglia-num" fill="${inchiostro}" stroke="${bordo}" stroke-width="3" paint-order="stroke">${esc(n)}</text>` : ''}
  </svg>`;
}

/** Il marchio: il pallone, FANTA in nero e FUTSAL in rosso, su un parallelogramma. */
export const logoFs = (cls = '') => `<span class="fs-logo ${cls}" role="img" aria-label="Fantafutsal"><i class="mi" style="--m:url(/media/icone/futsal/pallone.svg)"></i><b>Fanta<em>futsal</em></b></span>`;

/** L'attesa del futsal: il pallone che rimbalza su una riga rossa, e cosa si sta caricando. */
export const caricaFs = (testo = 'Carico…') => `<div class="fs-carica" role="status"><span class="fs-carica-palla"><i class="mi" style="--m:url(/media/icone/futsal/pallone.svg)"></i></span><span class="fs-carica-riga"></span><b>${esc(testo)}</b></div>`;
