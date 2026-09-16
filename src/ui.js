/** Componenti UI condivisi: stringhe HTML, nessun framework. */
import { avatar } from './avatar.js';
import { tintaLeggibile } from './colore.js';
export { avatar } from './avatar.js';
import { esc } from './ui-esc.js';
export { esc };
export const fmt = (n, min = 1) => (n == null ? 'S.V.' : Number(n).toLocaleString('it-IT', { minimumFractionDigits: min, maximumFractionDigits: 2 }));
export const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n));
export const icon = (name, cls = 'ic') => `<svg class="${cls}"><use href="#i-${name}"/></svg>`;
/** Il logo originale: una maschera colorata con il colore corrente (styles/logo.css). */
export const logo = (cls = '') => `<i class="logo ${cls}" role="img" aria-label="Fantatitano"></i>`;
export const ROLE_NAME = { P: 'Portieri', D: 'Difensori', C: 'Centrocampisti', A: 'Attaccanti' };
export const ROLE_ORDER = ['P', 'D', 'C', 'A'];
const DAYS = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
export const dateIt = (iso) => { const d = new Date(iso); return `${DAYS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`; };
export const timeIt = (iso) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
export const dateTimeIt = (iso) => `${dateIt(iso)} ${timeIt(iso)}`;
export const initials = (p) => (p.lastName || p.name || '??').replace(/[^A-Za-zÀ-ÿ]/g, '').slice(0, 2).toUpperCase();

export function badge(status, extra = '') {
  const map = {
    frozen: ['badge--froz', 'lock', 'Congelato', extra || 'mar 20:00'],
    provisional: ['badge--prov', 'clock', 'Provvisorio', extra || 'contestazioni fino a mar 18:00'],
    live: ['badge--live', null, 'Live in corso', extra],
    open: ['badge--open', 'clock', 'Aperta', extra],
    scheduled: ['badge--open', 'clock', 'In programma', extra],
    partial: ['badge--prov', 'clock', 'Giocata', extra || 'voti non ancora inseriti'],
  };
  const [cls, ic, label, small] = map[status] || map.scheduled;
  return `<span class="badge ${cls}">${ic ? icon(ic) : '<i class="pulse"></i>'}${label}${small ? ` <small>· ${esc(small)}</small>` : ''}</span>`;
}
export const roleChip = (role) => `<span class="rl rl-${role.toLowerCase()}">${role}</span>`;

/** Avatar del giocatore con il ruolo appeso: sta in una colonna sola. */
export const faccia = (p, club, cls = '') =>
  `<span class="av-w ${cls}">${avatar(p, club)}${roleChip(p.role)}</span>`;
/** Avatar grande per la scheda del giocatore, su un tondo col colore del club. */
export const avatarGrande = (p, club) =>
  `<span class="av-big" style="--c:${club?.color || '#2B4C7E'}">${avatar(p, club)}</span>`;
/** Le iniziali erano bianche fisse su un colore scelto da chi gioca: su oro o
 *  su verde medio stavano sotto 3 di contrasto. tintaLeggibile() sceglie
 *  l'inchiostro e, se serve, sposta il fondo quanto basta per arrivare a 4,5. */
export const crest = (m, cls = '') => {
  const { fondo, inchiostro } = tintaLeggibile(m?.color);
  return m?.crestUrl
    ? `<span class="crest foto ${cls}" style="background:${fondo}"><img src="${esc(m.crestUrl)}" alt=""></span>`
    : `<span class="crest ${cls}" style="background:${fondo};color:${inchiostro}">${esc(m.initials)}</span>`;
};

/**
 * Icona-maschera: la sagoma arriva da un PNG, il colore dalla CSS. Serve dove
 * l'icona deve cambiare colore — la barra in basso, che colorando la voce
 * attiva dice dove sei. Un PNG già colorato non potrebbe farlo.
 */
export const mask = (name, cls = '', cartella = 'nav') => `<i class="mi ${cls}" style="--m:url(/media/icone/${cartella}/${name}.png)"></i>`;

/** Icone illustrate: media/icone/eventi e media/icone/menu. */
export const pic = (name, cartella = 'eventi', cls = '') => `<img class="pic ${cls}" src="media/icone/${cartella}/${name}.png" alt="" loading="lazy">`;

const EV = {
  goal: ['gol', 'Gol'], assist: ['assist', 'Assist'], own_goal: ['autogol', 'Autogol'],
  yellow: ['ammonizione', 'Ammonizione'], second_yellow: ['espulsione-x2', '2ª ammonizione'],
  red_direct: ['espulsione', 'Rosso diretto'], pen_missed: ['rigore-sbagliato', 'Rigore sbagliato'],
  pen_saved: ['rigore-parato', 'Rigore parato'],
};
const EV_TESTO = { pen_won: ['R+', 'ev-k'], pen_conceded: ['R−', 'ev-r'], assist_set: ['A↑', 'ev-a'] };
export const EV_LABEL = { goal: 'Gol', assist: 'Assist', yellow: 'Ammonizione', second_yellow: '2ª ammonizione', red_direct: 'Rosso diretto', own_goal: 'Autogol', pen_missed: 'Rigore sbagliato', pen_saved: 'Rigore parato', pen_won: 'Rigore procurato', pen_conceded: 'Rigore causato', assist_set: 'Assist da fermo' };
export function evTile(type) {
  const e = EV[type];
  if (e) return `<i class="evi" title="${e[1]}">${pic(e[0])}</i>`;
  const t = EV_TESTO[type];
  return t ? `<i class="${t[1]}" style="display:inline-grid;place-items:center;width:20px;height:20px;border-radius:5px;font-style:normal;font-size:10px;font-weight:700">${t[0]}</i>` : '';
}
export function evTiles(events) { return events.map((e) => evTile(e.type)).join(''); }

/** Riga voto con breakdown (tap per espandere). */
export function voteRow(player, club, rating, { expanded = false, captain = false, minutes = null, extra = '' } = {}) {
  const sv = !rating || rating.isSV;
  const min = minutes ?? rating?.minutes;
  const fv = sv ? `<span class="fv sv">S.V.</span>` : `<span class="fv${captain ? ' cap' : ''}">${fmt(rating.fantaVote)}</span>`;
  const lines = sv
    ? `<div><span>${esc(rating?.svReason || 'non entrato')}<em>art. 4 / 10</em></span><span>S.V.</span></div>`
    : rating.breakdown.map((l) => `<div><span>${esc(l.label)}${l.note ? `<em>${esc(l.note)}</em>` : ''}</span><span class="${l.value > 0 && l.label !== 'Voto base' ? 'pos' : l.value < 0 ? 'neg' : ''}">${l.label === 'Voto base' ? fmt(l.value) : signed(l.value)}</span></div>`).join('')
      + `<div class="tot"><span>Fantavoto</span><span>${fmt(rating.fantaVote)}</span></div>`;
  return `<button class="vr" data-toggle>${roleChip(player.role)}<span class="nm"><b>${esc(player.name)}</b><span>${esc(club?.name || '')}${min ? ` · ${min}'` : ''}</span></span><span class="ev">${rating?.events ? evTiles(rating.events) : ''}</span>${fv}</button>
  <div class="vb${expanded ? ' on' : ''}">${lines}${extra}</div>`;
}

/** Riquadro azionabile: stessa struttura per ogni banner cliccabile dell'app. */
export function tile({ href, action, lead, leadKind = '', title, sub = '', badgeHtml = '', cls = '' }) {
  const inner = `<span class="lead ${leadKind}">${lead}</span><span class="txt">${badgeHtml}<b>${title}</b>${sub ? `<span>${sub}</span>` : ''}</span>${icon('chev', 'ic sm chev')}`;
  return href ? `<a class="tile ${cls}" href="${href}">${inner}</a>`
              : `<button class="tile ${cls}" ${action ? `data-act="${action}"` : ''}>${inner}</button>`;
}

/** Card di uno scontro di lega: tutta la card è il bersaglio del tocco. */
export function matchCard(r, managers, { meta = '', badgeHtml = '' } = {}) {
  const h = managers.get(r.homeManagerId), a = managers.get(r.awayManagerId);
  const side = (m) => `<div class="side">${crest(m)}<b>${esc(m.teamName)}</b><span class="own">${esc(m.owner)}</span></div>`;
  const head = (badgeHtml || meta) ? `<div class="mhead">${badgeHtml}<span class="when">${esc(meta)}</span></div>` : '';
  const foot = r.played
    ? `<div class="mfoot"><span>${fmt(r.homeScore)}</span><em>fantapunti</em><span>${fmt(r.awayScore)}</span></div>
       <div class="mcta">${r.status === 'frozen' ? '' : pic('live', 'menu', 'mini')}${r.status === 'frozen' ? 'Vedi la partita' : 'Segui il Live'}${icon('chev', 'ic sm')}</div>`
    : '';
  const body = `<div class="mrow">${side(h)}<span class="score${r.played ? '' : ' vs'}">${r.played ? `${r.homeGoals} – ${r.awayGoals}` : 'VS'}</span>${side(a)}</div>`;
  return r.played
    ? `<a class="mcard" href="#/live/${r.id}">${head}${body}${foot}</a>`
    : `<div class="mcard">${head}${body}</div>`;
}

export const empty = (text, cta = '') => `<div class="empty">${logo()}<p>${text}</p>${cta}</div>`;
export const sec = (title, right = '') => `<div class="a-sec"><b>${title}</b>${right ? `<span>${right}</span>` : ''}</div>`;
