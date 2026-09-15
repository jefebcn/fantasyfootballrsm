/**
 * Maglia della squadra fanta, personalizzabile.
 *
 * Solo il davanti: è quello che si vede in copertina. Non è una foto ma un
 * disegno, così cambia sotto gli occhi mentre la si modifica, non serve
 * caricare niente e nessuna maglia di società vera finisce dentro l'app.
 */
import { esc } from './ui-esc.js';
export { chiaro } from './colore.js';
import { chiaro } from './colore.js';

// Le fantasie disegnate sono sparite con la sagoma: il motivo ora è quello
// della foto, uguale per tutti, e a cambiare è la tinta.
export const COLORI = [
  '#1B84C6', '#0B3D91', '#C0392B', '#8E1B2E', '#27AE60', '#0E6B3D', '#E8B53A', '#E67E22',
  '#8E44AD', '#16A085', '#2C3E50', '#111418', '#FFFFFF', '#B9C2CC',
];

export const KIT_DEFAULT = { c1: '#1B84C6', nome: '' };
/** Riempie i buchi: una maglia salvata a metà non deve rompere il disegno. */
export const kitOf = (m) => ({ ...KIT_DEFAULT, c1: m?.color || KIT_DEFAULT.c1, ...(m?.kit || {}) });

// La maglia è la foto in media/magliahome.jfif ridotta da scripts/make-maglia.py
// a forma + luce: il colore non è nel file, lo mette il browser fondendo la
// tinta della squadra sotto i grigi. Vedi .maglia in styles/app.css.
export const BASE = 'media/maglia-base.webp';
const RAPPORTO = '560 / 688';

function scritta(testo, x, y, dim, peso, inchiostro, bordo, spazio = '0') {
  return `<text x="${x}" y="${y}" text-anchor="middle" fill="${inchiostro}" stroke="${bordo}"
    stroke-width="${dim / 5.5}" paint-order="stroke" stroke-linejoin="round"
    style="font:${peso} ${dim}px var(--font-display,system-ui,sans-serif);letter-spacing:${spazio}">${esc(testo)}</text>`;
}

/**
 * @param {object} kit  { c1, nome }
 * @param {string} cls  classi extra
 */
export function maglia(kit, cls = '') {
  const k = { ...KIT_DEFAULT, ...kit };
  const scuro = !chiaro(k.c1);
  const inchiostro = scuro ? '#FFFFFF' : '#16202E';
  const bordo = scuro ? '#0B1220' : '#FFFFFF';
  const nome = String(k.nome || '').toUpperCase().slice(0, 12);
  // Niente numero in petto: sulla maglia del riferimento non c'e', e alla
  // misura della copertina copriva mezzo torace.
  const scritte = nome
    ? `<svg class="mg-scritte" viewBox="0 0 100 123" aria-hidden="true">
        ${scritta(nome, 50, 86, 9, 700, inchiostro, bordo, '.16em')}
      </svg>` : '';
  return `<div class="maglia ${cls}" style="--c1:${k.c1};--rap:${RAPPORTO}" role="img"
      aria-label="Maglia${nome ? ` di ${esc(nome)}` : ''}">
    <span class="mg-tinta"></span><img class="mg-luce" src="${BASE}" alt="" decoding="async">${scritte}
  </div>`;
}
