/** Shell applicativa: router hash, app bar, drawer, bottom nav, toast, sheet. */
import { SPRITE } from './sprite.js';
import { AVATAR_SPRITE } from './avatar.js';
import { esc, icon, badge, crest, logo, pic, mask } from './ui.js';
import * as S from './state.js';
import * as views from './views/index.js';

const root = document.getElementById('app');
let current = null; // { view, params }
let drawerOpen = false;

const ROUTES = [
  ['', views.dashboard], ['rosa', views.rosa], ['rosa/formazione', views.formazione],
  ['calendario', views.calendario], ['calendario/:n', views.calendario],
  ['classifica', views.classifica], ['voti', views.voti], ['voti/:n', views.voti],
  ['live/:id', views.live], ['listone', views.listone], ['giocatore/:id', views.giocatore],
  ['regolamento', views.regolamento], ['scheda', views.scheda], ['impostazioni', views.impostazioni], ['impostazioni/avanzate', views.avanzate], ['privacy', views.privacy], ['termini', views.termini],
  ['admin', views.adminGiornata], ['admin/partita/:id', views.adminPartita], ['admin/contestazioni', views.adminContestazioni],
  ['admin/congela', views.adminCongela], ['admin/registro', views.adminRegistro], ['mercato', views.mercato],
  ['login', views.login], ['leghe', views.leghe], ['lega', views.lega], ['gestione', views.gestione], ['squadra', views.squadra], ['vice/:code', views.vice], ['setup', views.setup], ['offline', views.offline], ['benvenuto', views.onboarding],
];

function resolve(hash) {
  const path = hash.replace(/^#\/?/, '').split('?')[0].replace(/\/$/, '');
  for (const [pattern, view] of ROUTES) {
    const pp = pattern.split('/'), hp = path.split('/');
    if (pp.length !== hp.length && !(pattern === '' && path === '')) continue;
    const params = {}; let ok = true;
    pp.forEach((seg, i) => { if (seg.startsWith(':')) params[seg.slice(1)] = decodeURIComponent(hp[i]); else if (seg !== hp[i]) ok = false; });
    if (ok) return { view, params, path };
  }
  return { view: views.dashboard, params: {}, path: '' };
}

export function go(hash) { location.hash = hash.startsWith('#') ? hash : `#/${hash.replace(/^\//, '')}`; }
export function toast(msg) {
  const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), 2400);
}
export function sheet(html) {
  const sc = document.getElementById('sheet-scrim'), sh = document.getElementById('sheet');
  if (!html) { sc.classList.remove('on'); sh.classList.remove('on'); sh.innerHTML = ''; return; }
  sh.innerHTML = `<div class="handle"></div>${html}`; sc.classList.add('on'); sh.classList.add('on');
}
const splash = () => `<div class="splash">${logo('splash-mark')}<b>Fantacampionato</b><span>Sammarinese</span><i class="splash-bar"><i></i></i></div>`;

export function applyTheme() {
  const t = S.store.get().theme;
  if (t === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.content = document.documentElement.getAttribute('data-theme') === 'dark' ? '#0A3E60' : '#1B84C6';
}

// Sagome da media/icone/nav, colorate dalla CSS: la barra deve dire dove sei,
// e lo dice col colore. Le icone già a colori non potevano.
const NAV = [['', 'campo', 'Dashboard'], ['rosa', 'maglia-10', 'Rosa'], ['calendario', 'calendario', 'Calendario'],
  ['classifica', 'coppa', 'Classifica'], ['voti', 'grafico', 'Voti']];

function appbar(view, ctx) {
  const league = S.base.league;
  const kind = (typeof view.appbar === 'function' ? view.appbar(ctx) : view.appbar) || 'main';
  if (kind === 'none') return '';
  if (kind === 'back') return `<header class="a-appbar"><button class="ib flip" data-back aria-label="Indietro">${icon('chev')}</button><div class="t"><b>${esc(league.name)}</b><span>${esc(view.sub?.(ctx) || view.title)}</span></div>${view.actions ? view.actions(ctx) : ''}</header>`;
  return `<header class="a-appbar"><button class="ib" data-open-drawer aria-label="Menu">${icon('menu')}</button><div class="t"><b>${esc(league.name)}</b><span>${esc(view.sub?.(ctx) || view.title)}</span></div><button class="ib" data-refresh aria-label="Aggiorna">${icon('undo')}</button><a class="ib" href="#/regolamento" aria-label="Regolamento">${icon('book')}</a><a class="ib" href="#/admin/contestazioni" aria-label="Contestazioni">${icon('flag')}${S.contestazioni().some((c) => c.status === 'open') ? '<i class="dot"></i>' : ''}</a></header>`;
}
function nav(path) {
  const active = path.split('/')[0];
  return `<nav class="a-nav">${NAV.map(([p, ic, l]) => `<a href="#/${p}" class="${active === p ? 'on' : ''}">${mask(ic)}${l}${p === 'voti' && S.matchdayStatus(S.currentMatchday()) === 'provisional' ? '<i class="dot"></i>' : ''}</a>`).join('')}</nav>`;
}
function drawer() {
  const me = S.me(); const ph = S.weekPhase(); const u = S.currentUser();
  // icone illustrate dove il soggetto coincide, contorno altrove: stesso riquadro per entrambe
  const item = (href, ic, label, small = '') => {
    const illus = typeof ic === 'object';
    const dentro = illus ? pic(ic.m || ic.l, ic.l ? 'lega' : 'menu') : icon(ic);
    return `<a class="d-item" href="${href}"><i class="${illus ? 'illus' : ''}">${dentro}</i>${label}${small ? `<small>${small}</small>` : ''}</a>`;
  };
  const leagues = S.myLeagues(); const cur = S.currentLeagueId();
  const head = `<div class="d-head"><div><b>${esc(me?.owner || S.profileInfo()?.display_name || u?.email || '')}</b><span>${esc(me?.teamName || u?.email || 'nessuna lega')}</span></div><button data-logout>LOGOUT</button></div>`;
  const leagueRow = `<a class="d-league" href="#/leghe" style="text-decoration:none">${esc(S.base.league.name)} <i>+</i></a>${leagues.length > 1 ? `<div class="d-sec"><span class="chip">Le mie leghe</span></div>${leagues.filter((l) => l.id !== cur).map((l) => `<button class="d-item" data-switch="${l.id}" style="border:0;background:transparent;width:100%;font:inherit;font-weight:600;cursor:pointer"><i>${icon('cup')}</i>${esc(l.name)}<small>${l.myRole}</small></button>`).join('')}` : ''}`;
  return `<div class="a-drawer${drawerOpen ? ' on' : ''}"><div class="scrim" data-close-drawer></div><div class="panel">
    ${head}${leagueRow}
    ${S.hasLeague() ? `<div class="d-cta"><a class="a-btn" href="#/rosa/formazione" style="text-decoration:none">${icon('shirt', 'ic sm')}Schiera la formazione</a></div>` : ''}
    ${item('#/gestione', { l: 'impostazioni' }, 'Gestione lega', 'tutte le sezioni')}${item('#/squadra', { l: 'la-mia-squadra' }, 'La mia squadra', 'stemma, maglia e nomi')}
    <div class="d-sec"><span class="chip">Setup</span></div>
    ${item('#/lega', { m: 'leghe' }, 'Profilo lega', S.base.league.inviteCode ? `codice ${esc(S.base.league.inviteCode)}` : '')}${item('#/lega', { m: 'squadre' }, 'Partecipanti', String(S.base.managers.length))}${item('#/regolamento', { m: 'guide' }, 'Regolamento ed opzioni')}${item('#/classifica', { m: 'statistiche' }, 'Competizioni')}
    <div class="d-sec"><span class="chip">Gioca</span></div>
    ${item('#/listone', { m: 'quotazioni' }, 'Listone', String(S.base.players.length))}${item('#/mercato', { m: 'trasferimenti' }, 'Mercato libero', 'rilancio 24h')}${item('#/mercato', 'out', 'Fuori dal campionato', String(S.base.players.filter((p) => !p.isActive).length))}${item('#/scheda', { m: 'fantascore' }, 'Scheda condivisibile')}
    ${S.isLeagueAdmin() ? `<div class="d-sec"><span class="chip">Gestione</span></div>${item('#/lega', { m: 'squadre' }, 'Gestione rose')}${item('#/lega', { m: 'vice-allenatore' }, 'Partecipanti e ruoli')}` : ''}
    ${S.isJudge() ? `<div class="d-sec admin"><span class="chip">Giudice Dati</span></div>
    ${item('#/admin', { m: 'voti' }, 'Inserisci eventi', `G${ph.matchday}`)}${item('#/admin/contestazioni', 'flag', 'Contestazioni', `${S.contestazioni().filter((c) => c.status === 'open').length} aperte`)}${item('#/admin/congela', 'lock', 'Congela giornata', 'mar 20:00')}${item('#/admin/registro', 'archive', 'Registro modifiche')}` : ''}
    <a class="d-plain" href="#/impostazioni" style="display:block;text-decoration:none;color:inherit">Utente, impostazioni e privacy</a>
    <div class="d-foot">Versione 0.5<br>Fantacampionato Sammarinese</div>
  </div></div>`;
}

let scrollMemo = {};
const STATE_ROUTE = { unconfigured: 'setup', offline: 'offline', anonymous: 'login', 'no-league': 'leghe' };
const ALLOWED = { 'no-league': ['leghe', 'impostazioni'], anonymous: ['login', 'benvenuto'] };
function gate(path) {
  const st = S.appState();
  let target = STATE_ROUTE[st];
  // Chi apre l'app per la prima volta vede la presentazione; chi si è già registrato no.
  if (st === 'anonymous' && !S.store.get().onboarded && path !== 'login') target = 'benvenuto';
  if (!target) return ['setup', 'offline', 'login', 'benvenuto'].includes(path) ? '' : null;   // pronta
  if (path === target || (ALLOWED[st] || []).includes(path)) return null;
  return target;
}
export function render() {
  const g = gate(resolve(location.hash).path); if (g !== null && g !== resolve(location.hash).path) { location.hash = `#/${g}`; return; }
  const { view, params, path } = resolve(location.hash);
  const ctx = { params, path, go, toast, sheet, render };
  const prevPath = current?.path;
  if (path === 'login' && prevPath !== 'login') views.resetLogin();
  if (prevPath !== undefined) { const m = root.querySelector('.a-body'); if (m) scrollMemo[prevPath] = m.scrollTop; }
  current = { view, params, path };
  document.title = `${view.title} · Fantacampionato Sammarinese`;
  root.innerHTML = `<div class="app">${appbar(view, ctx)}${view.render(ctx)}${view.nav === false ? '' : nav(path)}${drawer()}</div>`;
  if (view.mount) view.mount(root, ctx);
  const body = root.querySelector('.a-body');
  if (body && scrollMemo[path] && prevPath === path) body.scrollTop = scrollMemo[path];
}

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-open-drawer]')) { drawerOpen = true; root.querySelector('.a-drawer').classList.add('on'); return; }
  if (e.target.closest('[data-close-drawer]')) { drawerOpen = false; root.querySelector('.a-drawer').classList.remove('on'); return; }
  if (e.target.closest('.a-drawer a')) { drawerOpen = false; }
  if (e.target.closest('[data-refresh]')) { toast('Aggiorno…'); S.refresh(); return; }
  if (e.target.closest('[data-logout]')) { S.signOut().then(() => go('login')); return; }
  const sw = e.target.closest('[data-switch]'); if (sw) { drawerOpen = false; S.switchLeague(sw.dataset.switch).then(() => go('')); return; }
  if (e.target.closest('[data-back]')) { e.preventDefault(); if (history.length > 1) history.back(); else go(''); return; }
  const t = e.target.closest('.vr[data-toggle]'); if (t) { const vb = t.nextElementSibling; if (vb?.classList.contains('vb')) vb.classList.toggle('on'); return; }
  if (e.target.id === 'sheet-scrim') sheet(null);
});
window.addEventListener('hashchange', () => { drawerOpen = false; sheet(null); render(); });
S.subscribe(() => render());

/** Messaggio d'errore restituito da Supabase nel ritorno dal link e-mail. */
function authCallbackError() {
  const from = (s) => new URLSearchParams(s.replace(/^[#?]/, ''));
  for (const p of [from(location.hash), from(location.search)]) {
    const e = p.get('error_description') || p.get('error');
    if (e) return decodeURIComponent(e.replace(/\+/g, ' '));
  }
  return null;
}
/** Il ritorno dal link e-mail porta i token nel frammento: ripulisce l'URL senza toccare il router. */
function cleanAuthUrl() {
  const dirtyHash = location.hash && !location.hash.startsWith('#/');
  const dirtyQuery = /[?&](code|error|error_description)=/.test(location.search);
  if (dirtyHash || dirtyQuery) history.replaceState(null, '', location.pathname + (dirtyHash ? '' : location.hash));
}

async function boot() {
  registraServiceWorker();
  document.body.insertAdjacentHTML('afterbegin', SPRITE + AVATAR_SPRITE);
  applyTheme();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  S.setErrorHandler((e) => { console.error(e); if (S.appState() !== 'offline') toast(e?.message || 'Errore di rete'); });
  const callbackError = authCallbackError();
  root.innerHTML = `<div class="app">${splash()}</div>`;
  await S.init();
  cleanAuthUrl();
  render();
  if (callbackError) toast(callbackError);
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__installPrompt = e; document.dispatchEvent(new Event('installable')); });
}

/**
 * Registrazione e aggiornamento del service worker.
 *
 * Si chiama PRIMA di ogni await: stava in fondo a boot(), dopo `await
 * S.init()`, e con il server lento o irraggiungibile l'aggiornamento non
 * veniva mai nemmeno chiesto — l'app restava per sempre su una versione
 * vecchia senza che nulla lo segnalasse.
 */
function registraServiceWorker() {
  // NIENTE ricarica automatica quando arriva un service worker nuovo.
  //
  // C'era, e poteva bloccare l'app. La guardia che doveva impedire il ciclo
  // infinito era una variabile della pagina: dopo location.reload() la pagina e'
  // nuova e la guardia riparte da zero, quindi non guardava niente. Basta che il
  // controllo cambi a ogni apertura — per esempio perche' due nodi della rete di
  // distribuzione servono due versioni diverse di sw.js — e la pagina si ricarica
  // all'infinito: a schermo sembra tutto normale ma non si riesce a toccare
  // nulla, perche' ogni tocco arriva su una pagina che sta gia' morendo.
  //
  // Il codice nuovo entra comunque alla prossima apertura dell'app: e' come si
  // comporta di suo una PWA, e non puo' incastrarsi.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      // Il controllo automatico del browser non e' garantito quando serve:
      // lo si chiede all'apertura e ogni volta che l'app torna in primo piano,
      // che per una PWA sullo schermo Home e' il momento giusto. Con un limite,
      // per non tempestare il server a ogni cambio di scheda.
      let ultimo = 0;
      const controlla = () => { ultimo = Date.now(); reg.update().catch(() => {}); };
      controlla();                       // all'apertura sempre
      document.addEventListener('visibilitychange', () => {
        // al ritorno in primo piano, ma non piu' di una volta ogni cinque
        // minuti: se no basta cambiare scheda per tempestare il server.
        if (document.hidden || Date.now() - ultimo < 5 * 60 * 1000) return;
        controlla();
      });
    }).catch(() => {});
  }
}
boot();
