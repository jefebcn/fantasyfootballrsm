/** Componenti UI condivisi: stringhe HTML, nessun framework. */
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmt = (n, min = 1) => (n == null ? 'S.V.' : Number(n).toLocaleString('it-IT', { minimumFractionDigits: min, maximumFractionDigits: 2 }));
export const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n));
export const icon = (name, cls = 'ic') => `<svg class="${cls}"><use href="#i-${name}"/></svg>`;
/** Il logo originale: una maschera colorata con il colore corrente (styles/logo.css). */
export const logo = (cls = '') => `<i class="logo ${cls}" role="img" aria-label="Fantacampionato Sammarinese"></i>`;
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
    partial: ['badge--prov', 'clock', 'Parziale', extra],
  };
  const [cls, ic, label, small] = map[status] || map.scheduled;
  return `<span class="badge ${cls}">${ic ? icon(ic) : '<i class="pulse"></i>'}${label}${small ? ` <small>· ${esc(small)}</small>` : ''}</span>`;
}
export const roleChip = (role) => `<span class="rl rl-${role.toLowerCase()}">${role}</span>`;
export const crest = (m, cls = '') => `<span class="crest ${cls}" style="background:${m.color}">${esc(m.initials)}</span>`;

const EV = { goal: ['ev-g', 'G'], assist: ['ev-a', 'As'], yellow: ['ev-y', 'A'], second_yellow: ['ev-r', 'E'], red_direct: ['ev-r', 'E'], own_goal: ['ev-r', 'AG'], pen_missed: ['ev-r', 'RS'], pen_saved: ['ev-k', 'RP'], pen_won: ['ev-k', 'R+'], pen_conceded: ['ev-r', 'R−'] };
export const EV_LABEL = { goal: 'Gol', assist: 'Assist', yellow: 'Ammonizione', second_yellow: '2ª ammonizione', red_direct: 'Rosso diretto', own_goal: 'Autogol', pen_missed: 'Rigore sbagliato', pen_saved: 'Rigore parato', pen_won: 'Rigore procurato', pen_conceded: 'Rigore causato' };
export const evTile = (type) => { const [c, l] = EV[type] || ['ev-a', '?']; return `<i class="${c}" style="display:inline-grid;place-items:center;width:18px;height:18px;border-radius:4px;font-style:normal;font-size:10px;font-weight:700">${l}</i>`; };
export function evTiles(events) { return events.filter((e) => EV[e.type]).map((e) => evTile(e.type)).join(''); }

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

export function matchCard(r, managers, { link = true } = {}) {
  const h = managers.get(r.homeManagerId), a = managers.get(r.awayManagerId);
  const mid = r.played ? `<span class="vs score">${r.homeGoals} – ${r.awayGoals}</span>` : `<span class="vs">VS</span>`;
  const fp = r.played ? `<div class="fp"><span><b>${fmt(r.homeScore)}</b></span><em>fantapunti</em><span><b>${fmt(r.awayScore)}</b></span></div>` : '';
  const btn = r.played && link ? `<a class="a-btn live full" href="#/live/${r.id}" style="text-decoration:none"><i class="pulse" style="background:#fff"></i>${r.status === 'frozen' ? 'Vedi la partita' : 'Vai al Live'}</a>` : '';
  return `<div class="a-card a-match"><div class="tm">${crest(h)}<b>${esc(h.teamName)}</b><span>${esc(h.owner)}</span></div>${mid}<div class="tm">${crest(a)}<b>${esc(a.teamName)}</b><span>${esc(a.owner)}</span></div>${fp}${btn}</div>`;
}

export const empty = (text, cta = '') => `<div class="empty">${logo()}<p>${text}</p>${cta}</div>`;
export const sec = (title, right = '') => `<div class="a-sec"><b>${title}</b><span>${right}</span></div>`;
