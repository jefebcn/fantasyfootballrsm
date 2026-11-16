/**
 * Gli stemmi di fantasia delle 16 squadre del campionato, disegnati da
 * Fantatitano (Alex, 16/11: «creiamo dei loghi nostri per le squadre»).
 *
 * Disegnati da zero e poi confrontati con quelli ufficiali, solo per essere
 * sicuri che nessuno ci somigli: nessuna sagoma, disposizione o elemento
 * degli stemmi delle societa' o dei castelli. Ogni squadra ha la sua sagoma,
 * un secondo colore inventato e un simbolo preso dal nome; in comune solo il
 * contorno scuro e il filo lime, la firma Fantatitano.
 *
 * Le scritte sono Anton trasformato in forme (glifi-anton.json), cosi' gli SVG
 * non dipendono da un carattere caricato.
 *
 * stemma(club, { mini, size }) -> SVG (viewBox 200x220). mini = senza scritte,
 * simbolo piu' grande: e' quello delle liste.
 */
import { readFileSync } from 'node:fs';
const GLIFI = JSON.parse(readFileSync(new URL('./glifi-anton.json', import.meta.url)));
const INK = '#0B0B12';
const LIME = '#D9F51F';
const FONT = "Anton, Impact, 'Arial Narrow Bold', sans-serif";

const hex = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const mix = (a, b, t) => { const x = hex(a), y = hex(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
const light = (c, t) => mix(c, '#FFFFFF', t);
const dark = (c, t) => mix(c, '#000000', t);
const r1 = (v) => Math.round(v * 10) / 10;
const pol = (cx, cy, r, deg) => [r1(cx + r * Math.cos(deg * Math.PI / 180)), r1(cy + r * Math.sin(deg * Math.PI / 180))];

/* --- scritte disegnate (Anton trasformato in forme: niente font da caricare) --- */
const largh = (str, k, ls) => [...str].reduce((t, ch) => t + (GLIFI.g[ch]?.w || 0) * k + ls, -ls);
/** Testo dritto, centrato in cx con la linea di base in y; altezza delle maiuscole h. */
function dritto(str, cx, y, h, ls, fill) {
  const k = h / GLIFI.asc;
  let x = cx - largh(str, k, ls) / 2;
  return [...str].map((ch) => { const g = GLIFI.g[ch]; const o = g.d ? `<path d="${g.d}" transform="translate(${r1(x)} ${r1(y)}) scale(${k.toFixed(5)} ${(-k).toFixed(5)})"/>` : ''; x += g.w * k + ls; return o; }).join('').replace(/^/, `<g fill="${fill}">`) + '</g>';
}
/** Testo lungo un cerchio: in alto si legge in senso orario, in basso antiorario. */
function arco(str, cx, cy, r, h, ls, fill, alto = true) {
  const k = h / GLIFI.asc;
  const L = largh(str, k, ls);
  let s = 0;
  return `<g fill="${fill}">` + [...str].map((ch) => {
    const g = GLIFI.g[ch]; const w = g.w * k; const mid = s + w / 2; s += w + ls;
    if (!g.d) return '';
    const th = alto ? -Math.PI / 2 + (mid - L / 2) / r : Math.PI / 2 - (mid - L / 2) / r;
    const x = cx + r * Math.cos(th), y = cy + r * Math.sin(th);
    const rot = th * 180 / Math.PI + (alto ? 90 : -90);
    return `<path d="${g.d}" transform="translate(${r1(x)} ${r1(y)}) rotate(${r1(rot)}) translate(${r1(-w / 2)} 0) scale(${k.toFixed(5)} ${(-k).toFixed(5)})"/>`;
  }).join('') + '</g>';
}

/* --- sagome (200x220) ---------------------------------------------------- */
const SAGOME = {
  scudo: 'M26 16H174V98C174 150 142 186 100 206C58 186 26 150 26 98Z',
  sannitico: 'M24 14Q100 32 176 14V106C176 156 142 188 100 208C58 188 24 156 24 106Z',
  tondo: 'M100 18A92 92 0 1 1 99.99 18Z',
  college: 'M26 16H174V138Q174 206 100 206Q26 206 26 138Z',
  esagono: 'M100 8L186 56V164L100 212L14 164V56Z',
  casa: 'M24 16H176V140L100 210L24 140Z',
  portale: 'M24 96A76 76 0 0 1 176 96V178L100 210L24 178Z',
  merli: 'M22 14H54V30H80V14H120V30H146V14H178V110C178 158 144 190 100 208C56 190 22 158 22 110Z',
  cima: 'M100 6L180 56V118C180 162 146 192 100 210C54 192 20 162 20 118V56Z',
  largo: 'M10 30Q100 6 190 30V118C190 168 150 196 100 210C50 196 10 168 10 118Z',
};

/* --- motivi del campo ---------------------------------------------------- */
const MOTIVI = {
  pieno: () => '',
  pali: (c) => [40, 88, 136].map((x) => `<rect x="${x}" y="0" width="24" height="220" fill="${c}"/>`).join(''),
  banda: (c) => `<path d="M-20 60L60 -20H110L-20 110Z" fill="${c}"/><path d="M90 230L230 90V140L140 230Z" fill="${c}"/>`,
  sbarra: (c) => `<path d="M-10 150L210 30V90L-10 210Z" fill="${c}"/>`,
  meta: (c) => `<rect x="100" y="0" width="110" height="220" fill="${c}"/>`,
  diagonale: (c) => `<path d="M210 -10V230H-10Z" fill="${c}"/>`,
  quarti: (c) => `<rect x="100" y="0" width="110" height="112" fill="${c}"/><rect x="-10" y="112" width="110" height="120" fill="${c}"/>`,
  orizzonte: (c) => `<rect x="0" y="128" width="200" height="100" fill="${c}"/>`,
  raggi: (c) => Array.from({ length: 16 }, (_, i) => { const a = i * 22.5; const [x1, y1] = pol(100, 112, 200, a - 5.6); const [x2, y2] = pol(100, 112, 200, a + 5.6); return `<path d="M100 112L${x1} ${y1}L${x2} ${y2}Z" fill="${c}"/>`; }).join(''),
  chevron: (c) => `<path d="M-10 120L100 40L210 120V170L100 90L-10 170Z" fill="${c}"/>`,
  stelle: (c) => [[48, 60, 3], [150, 52, 2.4], [62, 150, 2], [142, 140, 3], [36, 104, 1.6], [168, 100, 1.8], [100, 40, 1.6], [120, 176, 1.6]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`).join(''),
};

/* --- simboli, in un riquadro 0..100 ------------------------------------- */
const petalo = (len, w) => `M0 0C${-w} ${-len * 0.3} ${-w * 0.8} ${-len * 0.85} 0 ${-len}C${w * 0.8} ${-len * 0.85} ${w} ${-len * 0.3} 0 0Z`;
const fiore = (x, y, n, len, w, fill, cuore, bordo) => Array.from({ length: n }, (_, i) =>
  `<path d="${petalo(len, w)}" fill="${fill}" stroke="${bordo}" stroke-width="2.4" stroke-linejoin="round" transform="translate(${x} ${y}) rotate(${i * 360 / n})"/>`).join('')
  + `<circle cx="${x}" cy="${y}" r="${len * 0.3}" fill="${cuore}" stroke="${bordo}" stroke-width="2.4"/>`;
const stella5 = (x, y, R, r = R * 0.45) => Array.from({ length: 10 }, (_, i) => { const [a, b] = pol(x, y, i % 2 ? r : R, -90 + i * 36); return `${i ? 'L' : 'M'}${a} ${b}`; }).join('') + 'Z';
const foglia = (len, w) => `M0 0Q${w} ${-len * 0.5} 0 ${-len}Q${-w} ${-len * 0.5} 0 0Z`;

const SIMBOLI = {
  trefiori: ({ F, A, K }) => {
    const bocciolo = (x, y, r, rot) => Array.from({ length: 5 }, (_, i) =>
      `<path d="M0 0C${-r * 0.55} ${-r * 0.3} ${-r * 0.62} ${-r * 0.95} ${-r * 0.2} ${-r}Q0 ${-r * 0.82} ${r * 0.2} ${-r}C${r * 0.62} ${-r * 0.95} ${r * 0.55} ${-r * 0.3} 0 0Z" fill="${F}" stroke="${K}" stroke-width="2.4" stroke-linejoin="round" transform="translate(${x} ${y}) rotate(${rot + i * 72})"/>`).join('')
      + `<circle cx="${x}" cy="${y}" r="${r * 0.3}" fill="${A}" stroke="${K}" stroke-width="2.2"/><circle cx="${x - r * 0.08}" cy="${y - r * 0.09}" r="${r * 0.09}" fill="#fff" opacity=".8"/>`;
    const fogliolina = (x, y, rot) => `<path d="${foglia(16, 7)}" fill="#7BD389" stroke="${K}" stroke-width="2" stroke-linejoin="round" transform="translate(${x} ${y}) rotate(${rot})"/>`;
    return fogliolina(50, 62, 180) + fogliolina(38, 50, -60) + fogliolina(62, 50, 60)
      + bocciolo(50, 28, 25, 0) + bocciolo(25, 70, 25, 36) + bocciolo(75, 70, 25, -36);
  },
  lafiorita: ({ F, A, K, B }) => `<circle cx="50" cy="50" r="47" fill="${B}" stroke="${K}" stroke-width="3"/>`
    + fiore(50, 50, 8, 42, 13, F, A, K)
    + Array.from({ length: 8 }, (_, i) => `<path d="${petalo(26, 5)}" fill="${A}" opacity=".55" transform="translate(50 50) rotate(${i * 45})"/>`).join('')
    + `<circle cx="50" cy="50" r="12" fill="${A}" stroke="${K}" stroke-width="2.4"/><circle cx="50" cy="50" r="5" fill="${K}"/>`,
  virtus: ({ F, A, K }) => {
    const ramo = (lato) => `<path d="M${50 - lato * 4} 98A48 48 0 0 ${lato > 0 ? 0 : 1} ${50 + lato * 46} 34" fill="none" stroke="${A}" stroke-width="3" stroke-linecap="round"/>`
      + Array.from({ length: 6 }, (_, i) => {
        const deg = lato > 0 ? 80 - i * 18 : 100 + i * 18;
        const [x, y] = pol(50, 50, 48, deg);
        const rot = (lato > 0 ? deg : deg + 180) + (i % 2 ? -1 : 1) * 36 * lato;
        return `<path d="${foglia(21, 8)}" fill="${A}" stroke="${K}" stroke-width="2" stroke-linejoin="round" transform="translate(${x} ${y}) rotate(${rot})"/>`;
      }).join('');
    return ramo(1) + ramo(-1)
      + `<path d="M24 20H43L50 46L57 20H76L59 80H41Z" fill="${F}" stroke="${K}" stroke-width="3" stroke-linejoin="round"/>`
      + `<path d="M50 46L57 20H76L59 80H50Z" fill="${K}" opacity=".16"/>`;
  },
  trepenne: ({ F, A, K, B }) => [-30, 0, 30].map((a, i) => `<g transform="translate(50 98) rotate(${a})">`
    + `<path d="M0 0C-14 -22 -15 -60 0 -88C15 -60 14 -22 0 0Z" fill="${i === 1 ? A : F}" stroke="${K}" stroke-width="2.6" stroke-linejoin="round"/>`
    + `<path d="M0 -4V-80" stroke="${K}" stroke-width="2" stroke-linecap="round"/>`
    + `<path d="M-11 -40L-4 -44L-12 -48ZM11 -56L4 -60L12 -64Z" fill="${B}"/></g>`).join(''),
  folgore: ({ F, K }) => `<path d="M62 0L14 56H44L32 100L88 38H56L72 0Z" fill="${F}" stroke="${K}" stroke-width="3.4" stroke-linejoin="round"/>`
    + `<path d="M56 38H88L32 100L44 56Z" fill="${K}" opacity=".14"/>`,
  cosmos: ({ F, A, K }) => `<path d="M8 62Q50 30 94 46" fill="none" stroke="${A}" stroke-width="6" stroke-linecap="round"/>`
    + `<circle cx="50" cy="54" r="28" fill="${F}" stroke="${K}" stroke-width="3"/>`
    + `<path d="M50 26A28 28 0 0 1 50 82A20 28 0 0 0 50 26Z" fill="${K}" opacity=".14"/>`
    + `<path d="M6 66Q50 92 96 44" fill="none" stroke="${K}" stroke-width="10" stroke-linecap="round"/><path d="M6 66Q50 92 96 44" fill="none" stroke="${A}" stroke-width="5" stroke-linecap="round"/>`
    + `<path d="${stella5(86, 14, 9)}" fill="${F}" stroke="${K}" stroke-width="2" stroke-linejoin="round"/><path d="${stella5(14, 22, 6)}" fill="${F}"/>`,
  murata: ({ F, A, K, B }) => `<path d="M14 98V40A36 36 0 0 1 86 40V98Z" fill="${F}" stroke="${K}" stroke-width="3" stroke-linejoin="round"/>`
    + `<path d="M28 98V44A22 22 0 0 1 72 44V98Z" fill="${B}" stroke="${K}" stroke-width="2.6"/>`
    + `<path d="M28 58H72M28 72H72M28 86H72M39 30V98M50 22V98M61 30V98" stroke="${A}" stroke-width="2.6"/>`
    + `<path d="M28 44A22 22 0 0 1 72 44" fill="none" stroke="${K}" stroke-width="2.6"/>`
    + `<path d="M14 54H24M14 74H24M76 54H86M76 74H86M18 64H22M78 64H82" stroke="${K}" stroke-width="2" opacity=".35"/>`,
  libertas: ({ F, A, K }) => `<path d="M50 2C70 20 78 36 70 50C66 58 58 62 50 62C42 62 34 58 30 50C24 38 30 26 38 18C38 28 42 32 46 32C48 22 46 12 50 2Z" fill="${A}" stroke="${K}" stroke-width="2.8" stroke-linejoin="round"/>`
    + `<path d="M50 22C60 34 62 44 58 52C56 56 53 58 50 58C45 58 41 54 41 48C41 42 44 38 47 36C48 42 50 42 52 40C53 34 52 28 50 22Z" fill="${F}"/>`
    + `<path d="M28 62H72L66 74H34Z" fill="${F}" stroke="${K}" stroke-width="2.8" stroke-linejoin="round"/>`
    + `<path d="M40 74H60L55 100H45Z" fill="${F}" stroke="${K}" stroke-width="2.8" stroke-linejoin="round"/><path d="M42 82H58M43 90H57" stroke="${K}" stroke-width="2"/>`,
  juvenes: ({ F, A, K, B }) => `<g transform="rotate(-14 22 52)"><rect x="22" y="44" width="76" height="14" rx="3" fill="${F}" stroke="${K}" stroke-width="2.6"/>`
    + [34, 54, 74].map((x) => `<path d="M${x} 44H${x + 10}L${x + 4} 58H${x - 6}Z" fill="${A}"/>`).join('')
    + `<rect x="22" y="44" width="76" height="14" rx="3" fill="none" stroke="${K}" stroke-width="2.6"/></g>`
    + `<rect x="12" y="38" width="16" height="56" rx="3" fill="${F}" stroke="${K}" stroke-width="2.6"/><rect x="6" y="90" width="28" height="8" rx="2" fill="${F}" stroke="${K}" stroke-width="2.6"/>`
    + `<circle cx="20" cy="52" r="5" fill="${B}" stroke="${K}" stroke-width="2"/>`
    + `<path d="${stella5(74, 22, 10)}" fill="${A}" stroke="${K}" stroke-width="2" stroke-linejoin="round"/>`,
  fiorentino: ({ F, A, K }) => Array.from({ length: 7 }, (_, i) => {
    const deg = 180 + 15 + i * 25;
    const [x1, y1] = pol(50, 70, 38, deg - 7), [x2, y2] = pol(50, 70, 60, deg), [x3, y3] = pol(50, 70, 38, deg + 7);
    return `<path d="M${x1} ${y1}L${x2} ${y2}L${x3} ${y3}Z" fill="${i === 3 ? A : F}" stroke="${K}" stroke-width="2.4" stroke-linejoin="round"/>`;
  }).join('')
    + `<path d="M16 70A34 34 0 0 1 84 70Z" fill="${F}" stroke="${K}" stroke-width="3" stroke-linejoin="round"/>`
    + `<path d="M50 36A34 34 0 0 1 84 70H50Z" fill="${K}" opacity=".12"/>`
    + `<rect x="2" y="76" width="96" height="10" rx="5" fill="${F}" stroke="${K}" stroke-width="2.8"/>`,
  faetano: ({ F, K, B }) => {
    const denti = Array.from({ length: 7 }, (_, i) => { const y = 14 + i * 11; const w = 30 - Math.abs(i - 3) * 3 - (i > 4 ? (i - 4) * 5 : 0); return [y, w]; });
    const dx = denti.map(([y, w]) => `L${50 + w} ${y}L${50 + w - 5} ${y + 6}`).join('');
    const sx = [...denti].reverse().map(([y, w]) => `L${50 - w + 5} ${y + 6}L${50 - w} ${y}`).join('');
    return `<path d="M50 2${dx}L50 94${sx}Z" fill="${F}" stroke="${K}" stroke-width="2.8" stroke-linejoin="round"/>`
      + `<path d="M50 2${dx}L50 94Z" fill="${K}" opacity=".13"/>`
      + `<path d="M50 10V98" stroke="${B}" stroke-width="3" stroke-linecap="round"/>`
      + [22, 38, 54, 70].map((y) => `<path d="M50 ${y + 8}L${70 - (y > 60 ? 6 : 0)} ${y}M50 ${y + 8}L${30 + (y > 60 ? 6 : 0)} ${y}" stroke="${B}" stroke-width="2.2" stroke-linecap="round"/>`).join('');
  },
  domagnano: ({ F, A, K }) => {
    const conci = Array.from({ length: 7 }, (_, i) => {
      const a0 = 180 + i * (180 / 7), a1 = a0 + 180 / 7;
      const [x1, y1] = pol(50, 64, 44, a0), [x2, y2] = pol(50, 64, 44, a1), [x3, y3] = pol(50, 64, 26, a1), [x4, y4] = pol(50, 64, 26, a0);
      return `<path d="M${x1} ${y1}A44 44 0 0 1 ${x2} ${y2}L${x3} ${y3}A26 26 0 0 0 ${x4} ${y4}Z" fill="${i === 3 ? A : F}" stroke="${K}" stroke-width="2.4" stroke-linejoin="round"/>`;
    }).join('');
    return conci + `<path d="M6 64H24V98H6ZM76 64H94V98H76Z" fill="${F}" stroke="${K}" stroke-width="2.4" stroke-linejoin="round"/>`
      + `<path d="M6 78H24M76 78H94" stroke="${K}" stroke-width="2" opacity=".4"/>`;
  },
  pennarossa: ({ F, A, K }) => `<path d="M50 6L96 92H4Z" fill="${F}" stroke="${K}" stroke-width="3" stroke-linejoin="round"/>`
    + `<path d="M50 6L96 92H58Z" fill="${K}" opacity=".16"/>`
    + `<path d="M50 6L66 36L58 32L50 42L42 32L34 36Z" fill="${A}" stroke="${K}" stroke-width="2.4" stroke-linejoin="round"/>`
    + `<path d="M22 92L38 66L46 78L56 62L76 92" fill="none" stroke="${K}" stroke-width="2.4" stroke-linejoin="round" opacity=".45"/>`,
  cailungo: ({ F, A, K, B }) => `<path d="M74 22V10H84V30" fill="${F}" stroke="${K}" stroke-width="2.4" stroke-linejoin="round"/>`
    + `<path d="M0 46L14 22H86L100 46Z" fill="${A}" stroke="${K}" stroke-width="2.8" stroke-linejoin="round"/>`
    + `<path d="M10 30H90M5 38H95M26 22L20 46M44 22L42 46M62 22L64 46M80 22L86 46" stroke="${K}" stroke-width="1.6" opacity=".3"/>`
    + `<path d="M4 46H96V92H4Z" fill="${F}" stroke="${K}" stroke-width="2.8" stroke-linejoin="round"/>`
    + [12, 40, 68].map((x) => `<path d="M${x} 92V70A10 10 0 0 1 ${x + 20} 70V92Z" fill="${B}" stroke="${K}" stroke-width="2.2"/>`).join('')
    + [[14, 52], [42, 52], [70, 52]].map(([x, y]) => `<rect x="${x}" y="${y}" width="16" height="9" rx="1.5" fill="${B}" opacity=".85" stroke="${K}" stroke-width="1.8"/>`).join('')
    + `<rect x="0" y="92" width="100" height="6" rx="3" fill="${A}" stroke="${K}" stroke-width="2.2"/>`,
  sangiovanni: ({ F, A, K }) => {
    const n = 7, top = Array.from({ length: n }, (_, i) => { const [x, y] = pol(50, 88, 76, 205 + (i + 1) * (130 / (n + 1))); return [x, y]; });
    const bordo = top.reduce((s, [x, y], i) => { const [px, py] = i ? top[i - 1] : pol(50, 88, 64, 205); return s + `Q${r1((px + x) / 2 + (x - 50) * 0.08)} ${r1((py + y) / 2 - 8)} ${x} ${y}`; }, `M50 88L${pol(50, 88, 64, 205).join(' ')}`);
    const [ex, ey] = pol(50, 88, 64, 335);
    return `<path d="${bordo}Q${r1((top[n - 1][0] + ex) / 2 + 4)} ${r1((top[n - 1][1] + ey) / 2 - 8)} ${ex} ${ey}Z" fill="${F}" stroke="${K}" stroke-width="2.8" stroke-linejoin="round"/>`
      + top.map(([x, y]) => `<path d="M50 84L${r1(50 + (x - 50) * 0.92)} ${r1(88 + (y - 88) * 0.92)}" stroke="${K}" stroke-width="2" opacity=".32"/>`).join('')
      + `<path d="M34 86H66L62 98H38Z" fill="${A}" stroke="${K}" stroke-width="2.4" stroke-linejoin="round"/>`;
  },
  academy: ({ F, A, K, B }) => `<path d="M50 4L92 96H68L50 52L32 96H8Z" fill="${F}" stroke="${K}" stroke-width="3" stroke-linejoin="round"/>`
    + `<path d="M50 4L92 96H68L50 52Z" fill="${K}" opacity=".14"/>`
    + `<path d="M50 56L64 74H56V90H44V74H36Z" fill="${A}" stroke="${K}" stroke-width="2.4" stroke-linejoin="round"/>`,
};

/* --- le 16 squadre ------------------------------------------------------- */
// c2 = secondo colore (inventato), anello = colore della cornice, nome = dove va la scritta
const DISEGNO = {
  trefiori:   { scala: 100, sagoma: 'tondo', c2: '#13284B', motivo: 'raggi', anello: '#13284B', F: '#FFFFFF', A: '#F2B634', stelle: 3 },
  lafiorita:  { sagoma: 'sannitico', c2: '#F4F7FB', motivo: 'pali', anello: '#0F3E6E', F: '#FFFFFF', A: '#9FD0FF', B: '#0F3E6E', nome: 'alto' },
  virtus:     { sagoma: 'scudo', c2: '#1F6B41', motivo: 'banda', anello: '#0E2E1C', F: '#FFFFFF', A: '#A9E6B8', nome: 'basso' },
  trepenne:   { sagoma: 'esagono', c2: '#13284B', motivo: 'diagonale', anello: '#13284B', F: '#FFFFFF', A: '#BFE3FF', B: '#13284B', nome: 'basso' },
  folgore:    { sagoma: 'college', c2: '#14141A', motivo: 'pali', anello: '#14141A', F: '#FFFFFF', nome: 'alto' },
  cosmos:     { sagoma: 'tondo', c2: '#FFFFFF', motivo: 'stelle', anello: '#0D2B4F', F: '#FFFFFF', A: '#FF9F1C', stelle: 3, stellaCol: '#FFFFFF' },
  murata:     { sagoma: 'merli', c2: '#3A3A44', motivo: 'meta', anello: '#0B0B12', F: '#E9E6DE', A: '#9C978A', B: '#2A2A33', nome: 'basso' },
  libertas:   { sagoma: 'sannitico', c2: '#D9A441', motivo: 'chevron', anello: '#4A0F24', F: '#FFFFFF', A: '#F2B634', nome: 'alto' },
  juvenes:    { sagoma: 'tondo', c2: '#0D2B4F', motivo: 'sbarra', anello: '#F2B634', testo: '#0D2B4F', F: '#FFFFFF', A: '#E8463A', B: '#0D2B4F', nome2: 'DOGANA' },
  fiorentino: { sagoma: 'casa', c2: '#FFFFFF', motivo: 'orizzonte', anello: '#7A1F16', F: '#FFD23F', A: '#FFFFFF', nome: 'alto' },
  faetano:    { sagoma: 'scudo', c2: '#4E1D6B', motivo: 'quarti', anello: '#2D0F40', F: '#FFFFFF', B: '#6B2D8F', nome: 'alto' },
  domagnano:  { sagoma: 'portale', c2: '#6A1414', motivo: 'pieno', anello: '#3D0A0A', F: '#F3E3C3', A: '#F2B634', nome: 'basso' },
  pennarossa: { sagoma: 'cima', c2: '#FFFFFF', motivo: 'pali', anello: '#5A1A13', F: '#FFFFFF', A: '#FF6B5B', nome: 'basso', stretti: true },
  cailungo:   { scala: 104, sagoma: 'largo', c2: '#1E5A5B', motivo: 'orizzonte', anello: '#123B3C', F: '#FFF1D6', A: '#E2553E', B: '#123B3C', nome: 'alto' },
  sangiovanni:{ sagoma: 'tondo', c2: '#F2B634', motivo: 'raggi', anello: '#2E1F5E', F: '#FFE2B8', A: '#F2B634', stelle: 1, stellaCol: '#F2B634' },
  academy:    { sagoma: 'esagono', c2: '#13284B', motivo: 'quarti', anello: '#13284B', F: '#FFFFFF', A: '#D9F51F', nome: 'basso', nome2: 'U22' },
};
const NOME = { juvenes: 'JUVENES', academy: 'ACADEMY', sangiovanni: 'SAN GIOVANNI' };

export function stemma(club, { mini = false, size = 160 } = {}) {
  const id = `st-${club.id}${mini ? '-m' : ''}`;
  const D = DISEGNO[club.id];
  const P = SAGOME[D.sagoma];
  const col = club.color;
  const tondo = D.sagoma === 'tondo';
  const nome = NOME[club.id] || club.name.toUpperCase();
  const motivoCol = D.motivo === 'raggi' || D.motivo === 'stelle' ? light(col, 0.18) : D.c2;
  const motivo = D.motivo === 'pali' && D.stretti
    ? [52, 92, 132].map((x) => `<rect x="${x}" y="0" width="16" height="220" fill="${D.c2}" opacity=".9"/>`).join('')
    : (D.motivo === 'stelle' ? MOTIVI.stelle('#FFFFFF') : MOTIVI[D.motivo](motivoCol));
  const bordo = tondo ? (mini ? 15 : 30) : 9;
  const K = INK;
  const colori = { F: D.F, A: D.A || D.F, B: D.B || dark(col, 0.35), K };

  // scritte
  let scritte = '';
  const T = D.testo || '#FFFFFF';
  if (!mini) {
    if (tondo) {
      const mid = 92 - bordo / 2, h = 17;
      const stelline = Array.from({ length: D.stelle || 0 }, (_, i) => { const a = { length: D.stelle };
        const th = Math.PI / 2 + (i - (a.length - 1) / 2) * 0.24; const [x, y] = [100 + mid * Math.cos(th), 110 + mid * Math.sin(th)];
        return `<path d="${stella5(x, y, 6)}" fill="${D.stellaCol || LIME}"/>`;
      }).join('');
      scritte = arco(nome, 100, 110, mid - h / 2, h, 1.6, T, true)
        + (D.nome2 ? arco(D.nome2, 100, 110, mid + 14 / 2, 14, 1.6, T, false) : stelline);
    } else {
      const y = D.nome === 'alto' ? (D.sagoma === 'sannitico' ? 40 : D.sagoma === 'largo' ? 38 : D.sagoma === 'portale' ? 60 : 26) : 150;
      const testo = D.nome2 ? `${nome} · ${D.nome2}` : nome;
      const h = Math.min(17, 15 * 190 / Math.max(190, largh(testo, 15 / GLIFI.asc, 1.4)));
      scritte = `<g clip-path="url(#${id}k)"><rect x="0" y="${y}" width="200" height="30" fill="${D.anello}"/><rect x="0" y="${y + 1.5}" width="200" height="1.5" fill="${LIME}"/><rect x="0" y="${y + 27}" width="200" height="1.5" fill="${LIME}"/></g>`
        + dritto(testo, 100, y + 15 + h / 2, h, 1.4, T);
    }
  }
  // dove sta il simbolo
  let s, cx, cy;
  if (tondo) { s = mini ? 120 : 88; cx = 100; cy = 112; }
  else if (mini) { s = 104; cx = 100; cy = D.sagoma === 'portale' ? 128 : D.sagoma === 'cima' ? 118 : 106; }
  else if (D.nome === 'alto') { s = 86; cx = 100; cy = D.sagoma === 'portale' ? 140 : D.sagoma === 'casa' ? 122 : 128; }
  else { s = 90; cx = 100; cy = D.sagoma === 'portale' ? 104 : D.sagoma === 'cima' ? 96 : 92; }
  if (D.sagoma === 'esagono' && !mini && D.nome === 'basso') cy = 96;
  if (D.scala && !mini) s = D.scala;
  if (club.id === 'cailungo' && !mini) cy = 132;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 220" width="${size}" height="${Math.round(size * 1.1)}" role="img" aria-label="${club.name}">`
    + `<defs><clipPath id="${id}k"><path d="${P}"/></clipPath>`
    + `<filter id="${id}o" x="-10%" y="-10%" width="130%" height="130%"><feOffset in="SourceAlpha" dx="3" dy="3.5"/><feComponentTransfer><feFuncA type="linear" slope=".35"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`
    + `<path d="${P}" fill="${col}" stroke="${K}" stroke-width="9" stroke-linejoin="round"/>`
    + `<g clip-path="url(#${id}k)">${motivo}`
    + `<path d="${P}" fill="none" stroke="${LIME}" stroke-width="${(bordo + 2.5) * 2}"/>`
    + `<path d="${P}" fill="none" stroke="${D.anello}" stroke-width="${bordo * 2}"/>`
    + `<path d="M0 0H200V90Q100 60 0 100Z" fill="#FFFFFF" opacity=".07"/></g>`
    + `<path d="${P}" fill="none" stroke="${K}" stroke-width="4" stroke-linejoin="round"/>`
    + scritte
    + `<g filter="url(#${id}o)" transform="translate(${cx - s / 2} ${cy - s / 2}) scale(${s / 100})">${SIMBOLI[club.id](colori)}</g>`
    + `</svg>`;
}

export const SIGNIFICATO = {
  trefiori: 'tre fiori con le foglie, nel tondo',
  lafiorita: 'un rosone di otto petali',
  virtus: 'la V fra due rami d’alloro',
  trepenne: 'tre penne a ventaglio',
  folgore: 'il fulmine, su righe gialle e nere',
  cosmos: 'un pianeta con l’anello, fra le stelle',
  murata: 'la porta delle mura, scudo coi merli',
  libertas: 'la fiaccola, con lo scaglione d’oro',
  juvenes: 'la sbarra della dogana',
  fiorentino: 'il sole che sorge',
  faetano: 'la foglia di faggio, a quarti',
  domagnano: 'l’arco di pietra con la chiave di volta',
  pennarossa: 'la cima del monte, scudo a punta',
  cailungo: 'il casale col portico, scudo largo',
  sangiovanni: 'la conchiglia, nel tondo',
  academy: 'la A con la freccia che sale',
};
