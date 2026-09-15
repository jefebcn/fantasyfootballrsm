/**
 * Avatar a fumetto per i giocatori: testa grossa e maglia della squadra, come
 * le figurine delle "top 11".
 *
 * Non sono ritratti e non provano a somigliare a nessuno: gli atleti del
 * campionato sono persone vere, e una caricatura somigliante sarebbe un'altra
 * cosa rispetto a un pupazzetto. Ogni pezzo (incarnato, capelli, barba,
 * occhiali, taglio della maglia) esce dall'id del giocatore, quindi lo stesso
 * giocatore ha sempre lo stesso avatar su ogni schermata, e nessuno di questi
 * pezzi viene da una foto.
 */

/** FNV-1a: basta che sia stabile e ben mescolata, non che sia crittografica. */
function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
/** Estrae cifre indipendenti dallo stesso hash: ogni tratto ha il suo "dado". */
const dado = (h, giro, facce) => Math.floor((((h >>> (giro * 3)) ^ Math.imul(h, giro + 7)) >>> 0) % facce);

const PELLE = ['#F5D0B0', '#EEC091', '#DFA878', '#C98B5F', '#A06A45', '#79502F'];
const CAPELLI = ['#1E1A17', '#2E2119', '#4A3222', '#6B4A2A', '#A9703C', '#C89A4E', '#8C8C8C', '#E2E2E2'];

/** Chiaro o scuro? Serve per scegliere colletto e numeri che si vedano. */
function chiaro(hex) {
  const c = String(hex || '#334').replace('#', '');
  const v = c.length === 3 ? c.split('').map((x) => x + x).join('') : c;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) || 0);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62;
}

/**
 * Ogni capigliatura e' divisa in due: quello che sta DIETRO la testa (volume,
 * codino, ciocche lunghe) e quello che le sta SOPRA. Disegnarla tutta sopra
 * copriva gli occhi: un afro nero faceva sparire la faccia.
 */
const CAPIGLIATURE = [
  // 0 corti
  ['', '<path d="M13 26q0-17 17-17t17 17q-3-9-17-9t-17 9Z"/>'],
  // 1 ricci
  ['', '<g><circle cx="17" cy="19" r="6"/><circle cx="25" cy="14" r="7"/><circle cx="35" cy="14" r="7"/><circle cx="43" cy="19" r="6"/></g>'],
  // 2 rasati
  ['', '<path d="M14 25q1-14 16-14t16 14q-4-6-16-6t-16 6Z"/>'],
  // 3 lunghi
  ['<path d="M11 28q0-19 19-19t19 19v16q-4 3-5-2l-1-14H17l-1 14q-1 5-5 2Z"/>',
    '<path d="M13 26q0-17 17-17t17 17q-3-9-17-9t-17 9Z"/>'],
  // 4 calvo
  ['', ''],
  // 5 afro
  ['<g><circle cx="30" cy="20" r="19"/><circle cx="13" cy="28" r="9"/><circle cx="47" cy="28" r="9"/></g>',
    '<path d="M14 24q2-15 16-15t16 15q-4-8-16-8t-16 8Z"/>'],
  // 6 ciuffo
  ['', '<path d="M13 26q0-17 17-17 9 0 13 6-6-2-10 1 5 3 5 8-5-8-16-7-8 1-9 9Z"/>'],
  // 7 coda
  ['<circle cx="49" cy="27" r="6"/>', '<path d="M13 26q0-17 17-17t17 17q-3-9-17-9t-17 9Z"/>'],
];

const BARBE = [
  '', // 0 niente
  '<path d="M16 28q0 18 14 18t14-18q1 14-4 18-4 3-10 3t-10-3q-5-4-4-18Z" opacity=".92"/>', // 1 barba piena
  '<path d="M23 36h14q-1 4-7 4t-7-4Z"/>',                                                   // 2 baffi
  '<path d="M26 41h8q0 6-4 6t-4-6Z"/>',                                                     // 3 pizzetto
];

const BOCCHE = [
  '<path d="M25 40q5 5 10 0" fill="none" stroke="#7A3B2E" stroke-width="2" stroke-linecap="round"/>',
  '<path d="M26 40q4 3 8 0" fill="none" stroke="#7A3B2E" stroke-width="2" stroke-linecap="round"/>',
  '<ellipse cx="30" cy="40.5" rx="2.6" ry="2.2" fill="#7A3B2E"/>',
  '<path d="M25 41h10" fill="none" stroke="#7A3B2E" stroke-width="2" stroke-linecap="round"/>',
];

const TORSO = 'M19 46 30 52 41 46q7 2 7 10v12H12V56q0-8 7-10Z';

/** Fantasia della maglia, ritagliata sul torso. */
function fantasia(tipo, c2, clip) {
  const g = (dentro) => `<g clip-path="url(#${clip})">${dentro}</g>`;
  if (tipo === 1) return g([0, 1, 2, 3].map((i) => `<rect x="${14 + i * 9}" y="44" width="4.5" height="26" fill="${c2}"/>`).join(''));
  if (tipo === 2) return g([0, 1, 2].map((i) => `<rect x="10" y="${50 + i * 8}" width="42" height="4" fill="${c2}"/>`).join(''));
  if (tipo === 3) return g(`<path d="M12 46 52 66v6H44L10 54Z" fill="${c2}"/>`);
  if (tipo === 4) return g(`<rect x="30" y="44" width="22" height="28" fill="${c2}"/>`);
  return '';
}

/**
 * @param {object} p  giocatore ({ id, role })
 * @param {object} club  squadra ({ color }) — la maglia prende il suo colore
 * @param {string} cls   classi extra sull'elemento
 */
export function avatar(p, club, cls = '') {
  const h = hash(String(p?.id || 'x'));
  const uid = `a${(h % 1000000).toString(36)}`;
  const portiere = p?.role === 'P';
  // Il portiere veste diverso dai compagni: è la regola del gioco, non un vezzo.
  const c1 = portiere ? ['#2FA36B', '#E8B53A', '#8E44AD'][h % 3] : (club?.color || '#2B4C7E');
  const c2 = chiaro(c1) ? '#26324A' : '#FFFFFF';
  const pelle = PELLE[dado(h, 1, PELLE.length)];
  const cap = CAPELLI[dado(h, 2, CAPELLI.length)];
  const [dietro, davanti] = CAPIGLIATURE[dado(h, 3, CAPIGLIATURE.length)];
  const barba = BARBE[dado(h, 4, BARBE.length)];
  const bocca = BOCCHE[dado(h, 5, BOCCHE.length)];
  const occhiali = dado(h, 6, 7) === 0;
  const fascia = !occhiali && dado(h, 7, 9) === 0;
  const trama = dado(h, 8, 6);          // 0 tinta unita, 1 righe, 2 fasce, 3 banda, 4 metà

  return `<svg class="av-fig ${cls}" viewBox="0 0 60 74" role="img" aria-hidden="true" focusable="false">
    <defs><clipPath id="${uid}"><path d="${TORSO}"/></clipPath></defs>
    <path d="M13 50 6 60l7 5 5-9Z" fill="${c1}"/><path d="M47 50l7 10-7 5-5-9Z" fill="${c1}"/>
    <rect x="25" y="40" width="10" height="10" rx="3" fill="${pelle}"/>
    <path d="${TORSO}" fill="${c1}"/>${fantasia(trama, c2, uid)}
    <path d="M24 46 30 53 36 46" fill="none" stroke="${c2}" stroke-width="2.4" stroke-linejoin="round"/>
    ${dietro ? `<g fill="${cap}">${dietro}</g>` : ''}
    <ellipse cx="30" cy="28" rx="17" ry="18" fill="${pelle}"/>
    <ellipse cx="13" cy="30" rx="3" ry="4" fill="${pelle}"/><ellipse cx="47" cy="30" rx="3" ry="4" fill="${pelle}"/>
    ${barba ? `<g fill="${cap}">${barba}</g>` : ''}
    <ellipse cx="24" cy="30" rx="2.2" ry="2.8" fill="#2B2118"/><ellipse cx="36" cy="30" rx="2.2" ry="2.8" fill="#2B2118"/>
    <ellipse cx="24.8" cy="29" rx=".8" ry="1" fill="#fff"/><ellipse cx="36.8" cy="29" rx=".8" ry="1" fill="#fff"/>
    ${bocca}
    ${davanti ? `<g fill="${cap}">${davanti}</g>` : ''}
    ${fascia ? `<rect x="12" y="19" width="36" height="5" rx="2.5" fill="${c2 === '#FFFFFF' ? c1 : c2}" stroke="rgba(0,0,0,.15)" stroke-width=".6"/>` : ''}
    ${occhiali ? `<g fill="none" stroke="#2B2118" stroke-width="1.8"><circle cx="24" cy="30" r="5"/><circle cx="36" cy="30" r="5"/><path d="M29 30h2"/></g>` : ''}
  </svg>`;
}
