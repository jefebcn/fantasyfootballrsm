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

/**
 * La maglia e' disegnata. Prima era la foto media/magliahome.jfif ridotta a
 * forma e luce da scripts/make-maglia.py: la sagoma e le ombre venivano da una
 * maglia vera fotografata da qualcun altro, e per una lega aperta a chiunque
 * non va. Ora la sagoma e' un path e le ombre sono due gradienti, quindi resta
 * nitida a ogni misura e non pesa niente.
 */
const SAGOMA = 'M50 6c-6 0-9 3-15 3-7 0-13-2-18-4L4 18c-1 1-1 2 0 3l9 9c1 1 3 1 4 0l4-4v81c0 2 1 3 3 3h52c2 0 3-1 3-3V26l4 4c1 1 3 1 4 0l9-9c1-1 1-2 0-3L83 5c-5 2-11 4-18 4-6 0-9-3-15-3z';
/** Colletto a V: due tratti, non una foto. */
const COLLETTO = 'M35 9q15 14 30 0';
const RAPPORTO = '100 / 123';

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
    <svg class="mg-tela" viewBox="0 0 100 123" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="mg-omb" x1="0" y1="0" x2="1" y2=".2">
          <stop offset="0" stop-color="#000" stop-opacity=".22"/>
          <stop offset=".34" stop-color="#fff" stop-opacity=".14"/>
          <stop offset=".72" stop-color="#000" stop-opacity=".06"/>
          <stop offset="1" stop-color="#000" stop-opacity=".26"/>
        </linearGradient>
        <linearGradient id="mg-piega" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stop-color="#000" stop-opacity=".18"/>
          <stop offset=".3" stop-color="#000" stop-opacity="0"/>
        </linearGradient>
        <clipPath id="mg-clip"><path d="${SAGOMA}"/></clipPath>
      </defs>
      <path d="${SAGOMA}" fill="${k.c1}"/>
      <g clip-path="url(#mg-clip)">
        <rect width="100" height="123" fill="url(#mg-omb)"/>
        <rect width="100" height="123" fill="url(#mg-piega)"/>
      </g>
      <path d="${COLLETTO}" fill="none" stroke="${bordo}" stroke-width="3" stroke-linecap="round" opacity=".85"/>
      <path d="${SAGOMA}" fill="none" stroke="#000" stroke-opacity=".18" stroke-width="1.2"/>
    </svg>${scritte}
  </div>`;
}
