/**
 * Gli sfondi, disegnati invece che fotografati.
 *
 * Prima erano due fotografie (media/sfondo-home.jpg, media/sfondo-accesso.jpg)
 * che non erano state fatte per questo progetto. Fra amici passava; aprendo le
 * iscrizioni a chiunque no.
 *
 * Disegnarli non e' stato solo il compromesso legale: 176 KB di JPEG in meno,
 * niente sfocature su schermi densi, e la notte del Titano viene meglio con un
 * gradiente che con una foto di uno stadio qualunque.
 *
 * Sono SVG in un unico elemento, quindi nessuna richiesta in piu' all'avvio.
 */

/** Le tre torri sul Titano: Guaita, Cesta, Montale, da sinistra. */
const TORRI = `
  <g fill="#0B1C33" opacity=".92">
    <path d="M120 300v-52h10v-14h8v14h10v52z"/>
    <path d="M124 234h22v-8h-22z"/>
    <path d="M196 300v-74h12v-18h10v18h12v74z"/>
    <path d="M200 208h30v-9h-30z"/>
    <path d="M286 300v-58h9v-13h8v13h9v58z"/>
    <path d="M290 229h21v-8h-21z"/>
  </g>
  <path d="M0 300c60-26 92-52 150-54 54-2 92 22 150 18 48-3 84-20 120-32v68z" fill="#0A1A2E"/>`;

/** Cresta del monte, in due piani per dare profondita'. */
const MONTE = `
  <path d="M0 232c70-40 118-78 176-80 56-2 96 34 154 44 46 8 84-4 110-16v120H0z" fill="#10263F" opacity=".85"/>
  <path d="M0 268c56-22 104-40 168-36 60 4 104 30 164 28 44-1 78-10 108-20v60H0z" fill="#0C1E33"/>`;

/**
 * Notte sul Titano. `stelle` le genera un seme fisso, cosi' il cielo e' sempre
 * lo stesso e non balla a ogni render.
 */
function cielo(seme = 7) {
  let x = seme; const dado = () => ((x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  let s = '';
  for (let i = 0; i < 46; i++) {
    const cx = Math.round(dado() * 440); const cy = Math.round(dado() * 150);
    const r = (dado() * 1.1 + 0.4).toFixed(2); const o = (dado() * 0.6 + 0.25).toFixed(2);
    s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" opacity="${o}"/>`;
  }
  return s;
}

const svg = (dentro) => `<svg class="sf" viewBox="0 0 440 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="sf-cielo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0D1733"/><stop offset=".52" stop-color="#162657"/><stop offset="1" stop-color="#21397F"/>
    </linearGradient>
    <radialGradient id="sf-luna" cx=".78" cy=".16" r=".34">
      <stop offset="0" stop-color="#FFE9B8" stop-opacity=".55"/><stop offset="1" stop-color="#FFE9B8" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="440" height="300" fill="url(#sf-cielo)"/>
  <rect width="440" height="300" fill="url(#sf-luna)"/>
  ${cielo()}${dentro}</svg>`;

/** Sfondo della copertina: monte, torri e il prato in basso. */
export const sfondoHome = () => svg(`${MONTE}${TORRI}
  <path d="M0 286c70-10 130-14 220-14s150 4 220 14v14H0z" fill="#1F7F4A"/>
  <path d="M0 292c70-8 130-11 220-11s150 3 220 11v8H0z" fill="#2A9159" opacity=".7"/>`);

/** Sfondo dell'accesso: piu' cielo, nessun prato, le torri piu' in basso. */
export const sfondoAccesso = () => svg(`<g transform="translate(0 26)">${MONTE}${TORRI}</g>`);
