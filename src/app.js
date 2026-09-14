/** Shell applicativa: router hash, app bar, drawer, bottom nav, toast, sheet. */
import { SPRITE } from './sprite.js';
import { esc, icon, badge, crest } from './ui.js';
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
  ['regolamento', views.regolamento], ['scheda', views.scheda], ['impostazioni', views.impostazioni],
  ['admin', views.adminGiornata], ['admin/partita/:id', views.adminPartita], ['admin/contestazioni', views.adminContestazioni],
  ['admin/congela', views.adminCongela], ['admin/registro', views.adminRegistro], ['mercato', views.mercato],
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
export function applyTheme() {
  const t = S.store.get().theme;
  if (t === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.content = document.documentElement.getAttribute('data-theme') === 'dark' ? '#0A3E60' : '#1B84C6';
}

const NAV = [['', 'home', 'Dashboard'], ['rosa', 'shirt', 'Rosa'], ['calendario', 'cal', 'Calendario'], ['classifica', 'medal', 'Classifica'], ['voti', 'votes', 'Voti']];

function appbar(view, ctx) {
  const league = S.base.league;
  const kind = view.appbar || 'main';
  if (kind === 'none') return '';
  if (kind === 'back') return `<header class="a-appbar"><button class="ib flip" data-back aria-label="Indietro">${icon('chev')}</button><div class="t"><b>${esc(league.name)}</b><span>${esc(view.sub?.(ctx) || view.title)}</span></div>${view.actions ? view.actions(ctx) : ''}</header>`;
  return `<header class="a-appbar"><button class="ib" data-open-drawer aria-label="Menu">${icon('menu')}</button><div class="t"><b>${esc(league.name)}</b><span>${esc(view.sub?.(ctx) || view.title)}</span></div><a class="ib" href="#/regolamento" aria-label="Regolamento">${icon('book')}</a><a class="ib" href="#/admin/contestazioni" aria-label="Contestazioni">${icon('flag')}${S.contestazioni().some((c) => c.status === 'open') ? '<i class="dot"></i>' : ''}</a></header>`;
}
function nav(path) {
  const active = path.split('/')[0];
  return `<nav class="a-nav">${NAV.map(([p, ic, l]) => `<a href="#/${p}" class="${active === p ? 'on' : ''}">${icon(ic)}${l}${p === 'voti' && S.matchdayStatus(S.currentMatchday()) === 'provisional' ? '<i class="dot"></i>' : ''}</a>`).join('')}</nav>`;
}
function drawer() {
  const me = S.me(); const d = S.store.get(); const ph = S.weekPhase();
  const item = (href, ic, label, small = '') => `<a class="d-item" href="${href}"><i>${icon(ic)}</i>${label}${small ? `<small>${small}</small>` : ''}</a>`;
  const admin = d.role !== 'fantallenatore';
  return `<div class="a-drawer${drawerOpen ? ' on' : ''}"><div class="scrim" data-close-drawer></div><div class="panel">
    <div class="d-head"><div><b>${esc(me.owner)}</b><span>${esc(me.teamName)}</span></div><a href="#/impostazioni" style="text-decoration:none"><button>PROFILO</button></a></div>
    <div class="d-league">${esc(S.base.league.name)} <i>+</i></div>
    <div class="d-cta"><a class="a-btn" href="#/rosa/formazione" style="text-decoration:none">${icon('shirt', 'ic sm')}Schiera la formazione</a></div>
    <div class="d-sec"><span class="chip">Setup</span></div>
    ${item('#/regolamento', 'book', 'Regolamento ed opzioni')}${item('#/classifica', 'cup', 'Competizioni')}${item('#/impostazioni', 'users', 'Partecipanti', String(S.base.managers.length))}
    <div class="d-sec"><span class="chip">Gioca</span></div>
    ${item('#/listone', 'list', 'Listone', String(S.base.players.length))}${item('#/mercato', 'cart', 'Mercato libero', 'rilancio 24h')}${item('#/mercato', 'out', 'Fuori dal campionato', String(S.base.players.filter((p) => !p.isActive).length))}${item('#/scheda', 'img', 'Scheda condivisibile')}
    ${admin ? `<div class="d-sec admin"><span class="chip">Giudice Dati</span></div>
    ${item('#/admin', 'edit', 'Inserisci eventi', `G${ph.matchday}`)}${item('#/admin/contestazioni', 'flag', 'Contestazioni', `${S.contestazioni().filter((c) => c.status === 'open').length} aperte`)}${item('#/admin/congela', 'lock', 'Congela giornata', 'mar 20:00')}${item('#/admin/registro', 'archive', 'Registro modifiche')}` : ''}
    <a class="d-plain" href="#/impostazioni" style="display:block;text-decoration:none;color:inherit">Utente, impostazioni e privacy</a>
    <div class="d-foot">Versione 0.1 · pilota<br>Fantacampionato Sammarinese</div>
  </div></div>`;
}

let scrollMemo = {};
export function render() {
  const { view, params, path } = resolve(location.hash);
  const ctx = { params, path, go, toast, sheet, render };
  const prevPath = current?.path;
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
  if (e.target.closest('[data-back]')) { e.preventDefault(); if (history.length > 1) history.back(); else go(''); return; }
  const t = e.target.closest('.vr[data-toggle]'); if (t) { const vb = t.nextElementSibling; if (vb?.classList.contains('vb')) vb.classList.toggle('on'); return; }
  if (e.target.id === 'sheet-scrim') sheet(null);
});
window.addEventListener('hashchange', () => { drawerOpen = false; sheet(null); render(); });
S.subscribe(() => render());

function boot() {
  document.body.insertAdjacentHTML('afterbegin', SPRITE);
  applyTheme();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  render();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__installPrompt = e; document.dispatchEvent(new Event('installable')); });
}
boot();
