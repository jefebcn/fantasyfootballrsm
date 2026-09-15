/**
 * Maglia della squadra fanta, personalizzabile.
 *
 * Solo il davanti: è quello che si vede in copertina. Non è una foto ma un
 * disegno, così cambia sotto gli occhi mentre la si modifica, non serve
 * caricare niente e nessuna maglia di società vera finisce dentro l'app.
 */
import { esc } from './ui-esc.js';

export const FANTASIE = [
  ['tinta', 'Tinta unita'], ['righe', 'Righe verticali'], ['fasce', 'Fasce orizzontali'],
  ['banda', 'Banda diagonale'], ['meta', 'Metà e metà'], ['maniche', 'Maniche a contrasto'],
];
export const COLORI = [
  '#1B84C6', '#0B3D91', '#C0392B', '#8E1B2E', '#27AE60', '#0E6B3D', '#E8B53A', '#E67E22',
  '#8E44AD', '#16A085', '#2C3E50', '#111418', '#FFFFFF', '#B9C2CC',
];

export const KIT_DEFAULT = { c1: '#1B84C6', c2: '#FFFFFF', fantasia: 'tinta', numero: 10, nome: '' };
/** Riempie i buchi: una maglia salvata a metà non deve rompere il disegno. */
export const kitOf = (m) => ({ ...KIT_DEFAULT, c1: m?.color || KIT_DEFAULT.c1, ...(m?.kit || {}) });

// Taglio moderno: spalle larghe, manica corta, vita appena rientrata, orlo
// che riallarga. Il collo è a V con la banda, come le maglie da gara di oggi.
const SAGOMA = 'M40 8q10 13 20 0l14 3q14 5 20 21l-10 16q-4 3-7-1l-5-7v64q-24 6-48 0V40l-5 7q-3 4-7 1L6 32q6-16 20-21Z';
const COLLO = 'M40 8q10 13 20 0';
const POLSO_SX = 'M12 39 22 33l5 7-10 6Z';
const POLSO_DX = 'M88 39 78 33l-5 7 10 6Z';

/** Chiaro o scuro: serve per scegliere l'inchiostro che stacca dal fondo. */
export function chiaro(hex) {
  const c = String(hex || '#334').replace('#', '');
  const v = c.length === 3 ? c.split('').map((x) => x + x).join('') : c;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) || 0);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62;
}

function fantasia(tipo, c2, clip) {
  const g = (d) => `<g clip-path="url(#${clip})">${d}</g>`;
  if (tipo === 'righe') return g([0, 1, 2, 3, 4].map((i) => `<rect x="${20 + i * 14}" y="0" width="7" height="116" fill="${c2}"/>`).join(''));
  if (tipo === 'fasce') return g([0, 1, 2, 3].map((i) => `<rect x="0" y="${28 + i * 20}" width="100" height="9" fill="${c2}"/>`).join(''));
  if (tipo === 'banda') return g(`<path d="M4 44 72 110h20L14 28Z" fill="${c2}"/>`);
  if (tipo === 'meta') return g(`<rect x="50" y="0" width="50" height="116" fill="${c2}"/>`);
  if (tipo === 'maniche') return g(`<path d="M26 11 6 32l10 16q4 4 7-1l5-7Z" fill="${c2}"/><path d="M74 11l20 21-10 16q-4 4-7-1l-5-7Z" fill="${c2}"/>`);
  return '';
}

/**
 * Numero e nome devono leggersi su qualunque fantasia: su una maglia a righe
 * o a metà campo il fondo cambia a metà della cifra, quindi un colore solo non
 * basta mai. Si scrive con un contorno del colore opposto (paint-order:stroke
 * mette il bordo SOTTO al pieno, se no il tratto mangia la lettera).
 */
function scritta(testo, x, y, dim, peso, inchiostro, bordo, spazio = '0') {
  return `<text x="${x}" y="${y}" text-anchor="middle" fill="${inchiostro}" stroke="${bordo}"
    stroke-width="${dim / 5.5}" paint-order="stroke" stroke-linejoin="round"
    style="font:${peso} ${dim}px var(--font-display,system-ui,sans-serif);letter-spacing:${spazio}">${esc(testo)}</text>`;
}

/**
 * @param {object} kit  { c1, c2, fantasia, numero, nome }
 * @param {string} cls  classi extra
 */
export function maglia(kit, cls = '') {
  const k = { ...KIT_DEFAULT, ...kit };
  const uid = `mg${Math.random().toString(36).slice(2, 8)}`;
  // L'inchiostro segue il colore base, il contorno è il suo opposto: insieme
  // reggono anche dove sotto passa la seconda tinta.
  const scuro = !chiaro(k.c1);
  const inchiostro = scuro ? '#FFFFFF' : '#16202E';
  // Il contorno è pieno, non velato: su una maglia a metà campo o a righe la
  // cifra passa sopra tutte e due le tinte, e lì si legge solo per il bordo.
  const bordo = scuro ? '#0B1220' : '#FFFFFF';
  const numero = String(k.numero ?? '').replace(/\D/g, '').slice(0, 2);
  const nome = String(k.nome || '').toUpperCase().slice(0, 12);
  return `<svg class="maglia ${cls}" viewBox="0 0 100 116" role="img"
      aria-label="Maglia${nome ? ` di ${esc(nome)}` : ''}${numero ? `, numero ${numero}` : ''}">
    <defs>
      <clipPath id="${uid}"><path d="${SAGOMA}"/></clipPath>
      <linearGradient id="${uid}o" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset=".22" stop-color="#000" stop-opacity="0"/>
        <stop offset=".72" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/>
      </linearGradient>
    </defs>
    <path d="${SAGOMA}" fill="${k.c1}"/>
    ${fantasia(k.fantasia, k.c2, uid)}
    <path d="${POLSO_SX}" fill="${k.c2}" clip-path="url(#${uid})"/><path d="${POLSO_DX}" fill="${k.c2}" clip-path="url(#${uid})"/>
    <rect x="0" y="0" width="100" height="116" fill="url(#${uid}o)" clip-path="url(#${uid})"/>
    <path d="${COLLO}" fill="none" stroke="${k.c2}" stroke-width="5" stroke-linejoin="round"/>
    <path d="${COLLO}" fill="none" stroke="rgba(0,0,0,.22)" stroke-width="1.2"/>
    <path d="${SAGOMA}" fill="none" stroke="rgba(0,0,0,.3)" stroke-width="1.6" stroke-linejoin="round"/>
    ${numero ? scritta(numero, 50, 82, 34, 800, inchiostro, bordo) : ''}
    ${nome ? scritta(nome, 50, 100, 9, 700, inchiostro, bordo, '.16em') : ''}
  </svg>`;
}
