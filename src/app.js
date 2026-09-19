/** Shell applicativa: router hash, app bar, drawer, bottom nav, toast, sheet. */
import { SPRITE } from './sprite.js';
import { AVATAR_SPRITE } from './avatar.js';
import { esc, icon, logo, marchio, pic, mask, crest } from './ui.js';
import * as S from './state.js';
import * as diagnostica from './diagnostica.js';
import * as views from './views/index.js';

const root = document.getElementById('app');
let current = null; // { view, params }
let drawerOpen = false;

const ROUTES = [
  ['', views.dashboard], ['rosa', views.rosa], ['rosa/formazione', views.formazione],
  ['calendario', views.calendario], ['calendario/:n', views.calendario],
  ['classifica', views.classifica], ['voti', views.voti], ['voti/:n', views.voti],
  ['live/:id', views.live], ['listone', views.listone], ['giocatore/:id', views.giocatore],
  ['confronto/:a', views.confronto], ['confronto/:a/:b', views.confronto],
  ['video', views.video], ['regolamento', views.regolamento], ['regole', views.regole], ['scheda', views.scheda], ['impostazioni', views.impostazioni], ['impostazioni/avanzate', views.avanzate], ['scambi', views.scambi], ['privacy', views.privacy], ['termini', views.termini], ['archiviazione', views.archiviazione], ['licenze', views.licenze],
  ['admin', views.adminGiornata], ['admin/partita/:id', views.adminPartita], ['admin/contestazioni', views.adminContestazioni],
  ['admin/congela', views.adminCongela], ['admin/console', views.adminConsole], ['admin/registro', views.adminRegistro], ['mercato', views.mercato], ['asta', views.asta],
  ['login', views.login], ['leghe', views.leghe], ['lega', views.lega], ['gestione', views.gestione], ['squadra', views.squadra], ['vice/:code', views.vice], ['setup', views.setup], ['offline', views.offline], ['sospeso', views.sospeso], ['benvenuto', views.onboarding],
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
/**
 * "Nuova versione pronta": una barra sopra la navigazione, con un bottone.
 * Resta finche' non si tocca. Chi la ignora ha il codice nuovo comunque alla
 * prossima apertura.
 */
export function mostraAggiornamento() {
  if (document.getElementById('aggiorna')) return;
  const b = document.createElement('div');
  b.id = 'aggiorna'; b.className = 'aggiorna'; b.setAttribute('role', 'status');
  b.innerHTML = '<div><b>Nuova versione pronta</b><span>Tocca per usarla adesso; se no entra alla prossima apertura.</span></div><button type="button">Aggiorna</button>';
  b.querySelector('button').onclick = () => location.reload();
  document.body.appendChild(b);
}
export function sheet(html) {
  const sc = document.getElementById('sheet-scrim'), sh = document.getElementById('sheet');
  if (!html) { sc.classList.remove('on'); sh.classList.remove('on'); sh.innerHTML = ''; return; }
  sh.innerHTML = `<div class="handle"></div>${html}`; sc.classList.add('on'); sh.classList.add('on');
}
// Lo splash: il marchio intero e la barra, niente altro.
//
// Prima erano tre pezzi — la corona, il nome, il sottotitolo — messi in
// colonna dal CSS, con le distanze e i pesi decisi qui e non dal marchio:
// "quella corona e la scritta sembrano separate". Adesso e' il marchio vero,
// in un pezzo solo, col suo motto dentro.
const splash = () => `<div class="splash">${marchio()}<i class="splash-bar"><i></i></i></div>`;

/**
 * ATTENZIONE a chi cerca il tasto del tema con un selettore.
 *
 * Qui data-theme viene scritto sull'<html>, perche' e' l'aggancio che usano i
 * token CSS (:root[data-theme="dark"]). Di conseguenza
 * `e.target.closest('[data-theme]')` risale fino alla radice e trova SEMPRE
 * qualcosa, per qualunque clic nella pagina. Chi deve riconoscere il tasto usi
 * `button[data-theme]`: e' cosi' che in Impostazioni ogni riga era diventata
 * morta con il tema su Chiaro o Scuro, e funzionante su "Sistema" — dove
 * l'attributo non c'e'.
 */
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
  return `<header class="a-appbar"><button class="ib" data-open-drawer aria-label="Menu">${icon('menu')}</button><div class="t"><b>${esc(league.name)}</b><span>${esc(view.sub?.(ctx) || view.title)}</span></div><button class="ib" data-refresh aria-label="Aggiorna">${mask('aggiorna', 'ib-mi')}</button><a class="ib" href="#/regolamento" aria-label="Regolamento">${icon('book')}</a><a class="ib" href="#/admin/contestazioni" aria-label="Contestazioni">${icon('flag')}${S.contestazioni().some((c) => c.status === 'open') ? '<i class="dot"></i>' : ''}</a></header>`;
}
/**
 * La barra in basso.
 *
 * L'icona sta dentro una pastiglia e l'etichetta sotto: dove sei si vede
 * dalla pastiglia accesa, non solo dal colore del testo. Il colore da solo e'
 * un segno debole — su uno schermo al sole, o per chi non distingue bene i
 * blu, cinque voci grigie e una azzurra si somigliano tutte.
 *
 * La pallina dell'avviso sta DENTRO la pastiglia, non nel riquadro della
 * voce: cosi' resta attaccata all'icona qualunque sia la larghezza della
 * colonna, che cambia col telefono.
 */
function nav(path) {
  const active = path.split('/')[0];
  const avviso = (p) => (p === 'voti' && S.matchdayStatus(S.currentMatchday()) === 'provisional' ? '<i class="dot"></i>' : '');
  return `<nav class="a-nav">${NAV.map(([p, ic, l]) => `<a href="#/${p}" class="${active === p ? 'on' : ''}"><i class="np">${mask(ic)}${avviso(p)}</i><span>${l}</span></a>`).join('')}</nav>`;
}
function drawer() {
  const me = S.me(); const ph = S.weekPhase(); const u = S.currentUser();
  // icone illustrate dove il soggetto coincide, contorno altrove: stesso riquadro per entrambe
  // L'etichetta va in uno <span> suo: come nodo di testo nudo finiva in una
  // scatola anonima che si allineava per RIGA e non per inchiostro, e la
  // parola cadeva 1,6px sotto il centro del riquadro. Misurato, non a occhio.
  const item = (href, ic, label, small = '') => {
    const illus = typeof ic === 'object';
    const dentro = illus ? pic(ic.m || ic.l, ic.l ? 'lega' : 'menu') : icon(ic);
    return `<a class="d-item" href="${href}"><i class="${illus ? 'illus' : ''}">${dentro}</i><span class="et">${label}</span>${small ? `<small>${small}</small>` : ''}</a>`;
  };
  const leagues = S.myLeagues(); const cur = S.currentLeagueId();
  const nome = me?.owner || S.profileInfo()?.display_name || u?.email || '';

  // LA TESTA, rifatta. Prima erano tre fondi diversi impilati nei primi 220px
  // — sfumatura, banda incassata, superficie — e tre gerarchie che si
  // facevano concorrenza: il nome in oro grande, LOGOUT come pastiglia piena
  // (un'azione che si usa una volta al mese, col peso visivo di un'azione
  // principale) e il nome della lega con un "+" che non diceva cosa fa.
  //
  // Adesso un blocco solo, e dentro tre righe che rispondono a tre domande in
  // ordine: chi sono, in quale lega, cosa faccio. La lega diventa una scheda
  // che si tocca e dice dove porta ("cambia lega") e quanta gente c'e';
  // l'uscita e' un bottone tondo col simbolo, discreto ma nello stesso posto
  // di prima. Il giallo resta solo alla formazione, che e' l'azione vera.
  const stemma = me ? crest(me, 'md')
    : `<span class="crest md" style="background:var(--c-titano-700);color:#fff">${esc((nome[0] || '?').toUpperCase())}</span>`;
  const head = `<div class="d-head">
    <div class="d-io">${stemma}
      <span class="d-chi"><b>${esc(nome)}</b><span>${esc(me?.teamName || u?.email || 'nessuna lega')}</span></span>
      <button class="d-esci" data-logout aria-label="Esci dall'account" title="Esci">${icon('exit')}</button>
    </div>
    ${S.hasLeague() ? `<a class="d-lega" href="#/leghe">
      <i>${icon(S.base.league.pubblica ? 'globe' : 'cup')}</i>
      <span class="d-nl"><b>${esc(S.base.league.name)}</b><small>${S.base.managers.length} ${S.base.managers.length === 1 ? 'partecipante' : 'partecipanti'} · cambia lega</small></span>
      ${icon('chev', 'ic sm')}
    </a>` : `<a class="d-lega" href="#/leghe"><i>${icon('cup')}</i>
      <span class="d-nl"><b>Nessuna lega</b><small>creane una o entra con un codice</small></span>${icon('chev', 'ic sm')}</a>`}
  </div>`;
  const leagueRow = leagues.length > 1 ? `<div class="d-sec"><span class="chip">Le mie leghe</span></div>${leagues.filter((l) => l.id !== cur).map((l) => `<button class="d-item" data-switch="${l.id}"><i>${icon('cup')}</i><span class="et">${esc(l.name)}</span><small>${esc(l.myRole)}</small></button>`).join('')}` : '';
  return `<div class="a-drawer${drawerOpen ? ' on' : ''}"><div class="scrim" data-close-drawer></div><div class="panel">
    ${head}${leagueRow}
    ${S.hasLeague() ? `<div class="d-cta"><a class="a-btn" href="#/rosa/formazione" style="text-decoration:none">${icon('shirt', 'ic sm')}Schiera la formazione</a></div>` : ''}
    ${item('#/gestione', { l: 'impostazioni' }, 'Gestione lega', 'tutte le sezioni')}${item('#/squadra', { l: 'la-mia-squadra' }, 'La mia squadra', 'stemma, maglia e nomi')}
    <div class="d-sec"><span class="chip">Setup</span></div>
    ${item('#/lega', { m: 'leghe' }, 'Profilo lega', S.base.league.inviteCode ? `codice ${esc(S.base.league.inviteCode)}` : '')}${item('#/lega', { m: 'squadre' }, 'Partecipanti', String(S.base.managers.length))}${item('#/regolamento', { m: 'guide' }, 'Regolamento ed opzioni')}${item('#/classifica', { m: 'statistiche' }, 'Competizioni')}
    <div class="d-sec"><span class="chip">Gioca</span></div>
    ${S.legaPubblica() ? item('#/asta', { l: 'rose' }, 'La tua rosa', `${S.rosterIds(S.me()?.id).length}/25`) : ''}${item('#/listone', { m: 'quotazioni' }, 'Listone', String(S.base.players.length))}${item('#/mercato', { m: 'trasferimenti' }, 'Mercato libero', 'rilancio 24h')}${item('#/mercato', 'out', 'Fuori dal campionato', String(S.base.players.filter((p) => !p.isActive).length))}${item('#/scheda', { m: 'fantascore' }, 'Scheda condivisibile')}
    ${S.isLeagueAdmin() ? `<div class="d-sec"><span class="chip">Gestione</span></div>${S.legaPubblica() ? item('#/classifica', { l: 'premi' }, 'Premi in palio', `${S.premi().length || 'nessuno'}`) : ''}${item('#/lega', { m: 'squadre' }, 'Gestione rose')}${item('#/lega', { m: 'vice-allenatore' }, 'Partecipanti e ruoli')}` : ''}
    ${S.isAdmin() ? `<div class="d-sec admin"><span class="chip">Amministrazione</span></div>
    ${item('#/admin/console', { l: 'strumenti' }, 'Console', 'persone, leghe e numeri')}` : ''}
    ${S.isJudge() ? `<div class="d-sec admin"><span class="chip">Giudice Dati</span></div>
    ${item('#/admin', { m: 'voti' }, 'Inserisci eventi', `G${ph.matchday}`)}${item('#/admin/contestazioni', 'flag', 'Contestazioni', `${S.contestazioni().filter((c) => c.status === 'open').length} aperte`)}${item('#/admin/congela', 'calc', 'Calcola giornata', 'la chiude per sempre')}${item('#/admin/registro', 'archive', 'Registro modifiche')}` : ''}
    <a class="d-plain" href="#/impostazioni" style="display:block;text-decoration:none;color:inherit">Utente, impostazioni e privacy</a>
    <div class="d-foot">Versione 0.5<br>Fantatitano</div>
  </div></div>`;
}

let scrollMemo = {};
const STATE_ROUTE = { unconfigured: 'setup', offline: 'offline', anonymous: 'login', sospeso: 'sospeso', 'no-league': 'leghe' };
// La console amministrativa si apre anche senza essere in una lega: chi
// gestisce l'app non e' detto che giochi, e restare chiusi fuori dai propri
// strumenti per non avere una squadra non ha senso.
// A chi e' sospeso restano le impostazioni e le pagine che ci stanno dentro:
// da li' si scaricano i propri dati e si cancella l'account, che sono diritti
// e non si sospendono insieme al resto.
const ALLOWED = { 'no-league': ['leghe', 'impostazioni', 'admin/console'], anonymous: ['login', 'benvenuto'],
  sospeso: ['impostazioni', 'impostazioni/avanzate', 'privacy', 'termini', 'archiviazione', 'licenze'] };
// Le pagine legali si leggono SEMPRE: senza account, senza collegamento,
// anche prima di configurare il server. Un'informativa raggiungibile solo a
// cose funzionanti non e' un'informativa, ed e' anche quello che chiede chi
// controlla un'app prima di pubblicarla (le stesse pagine escono statiche in
// privacy.html e termini.html, vedi scripts/genera-legali.cjs).
const SEMPRE = ['privacy', 'termini', 'archiviazione', 'licenze'];
function gate(path) {
  if (SEMPRE.includes(path)) return null;
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
  document.title = `${view.title} · Fantatitano`;
  // senza barra in basso e' il corpo a dover stare sopra la tacca del telefono:
  // con la barra ci pensa lei, e sommarli lascerebbe un vuoto in fondo
  root.innerHTML = `<div class="app${view.nav === false ? ' senza-nav' : ''}">${appbar(view, ctx)}${view.render(ctx)}${view.nav === false ? '' : nav(path)}${drawer()}</div>`;
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

/**
 * L'altezza del riquadro, misurata invece che dedotta.
 *
 * Su iPhone le unita' CSS del viewport sono il pezzo che non torna: con
 * "position:fixed; inset:0" il riquadro si fermava 59pt sopra il bordo dello
 * schermo — esattamente l'altezza della tacca in alto — e sotto la barra
 * restava una fascia scoperta. 100dvh non risolve: puo' solo venire piu' corto.
 *
 * window.innerHeight invece dice quanto e' alta la finestra per davvero, e su
 * iOS non cambia quando si apre la tastiera (li' cambia visualViewport), quindi
 * non fa saltare la barra sopra i tasti mentre si scrive.
 *
 * Il valore finisce in --h-app, che il CSS usa con 100dvh come ripiego se per
 * qualunque motivo questo codice non gira.
 */
/**
 * La tacca in alto in pixel veri. Si legge da un padding e non dalla variabile,
 * perche' getComputedStyle su una custom property torna la stringa
 * "env(...)" non risolta. Passa da --sa-top, che vale env(safe-area-inset-top):
 * cosi' le prove possono sostituirla, cosa che con env() non si puo' fare.
 */
function taccaSopra() {
  const dove = document.body || document.documentElement;
  if (!dove) return 0;
  const s = document.createElement('div');
  s.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;'
    + 'visibility:hidden;pointer-events:none;padding-top:var(--sa-top,0px)';
  dove.appendChild(s);
  const v = parseFloat(getComputedStyle(s).paddingTop) || 0;
  s.remove();
  return v;
}

function misuraAltezza() {
  const vv = window.visualViewport;
  // Il piu' grande fra i tre: la tastiera aperta rimpicciolisce visualViewport,
  // e prendere il massimo evita che la barra salti sopra i tasti.
  let h = Math.max(window.innerHeight || 0, document.documentElement.clientHeight || 0, vv ? vv.height : 0);

  if (h > 0) document.documentElement.style.setProperty('--h-app', `${h}px`);

  // iOS ad app installata: la finestra viene dichiarata alta quanto lo schermo
  // MENO la tacca in alto, pur partendo dal bordo superiore. Quando il conto
  // torna esatto, vuol dire che il pezzo in fondo iOS non lo da' proprio alla
  // pagina: li' non disegna niente, e riempie da se' con il colore di fondo.
  //
  // Due conseguenze. La prima: NON si puo' allungare il riquadro fino allo
  // schermo. L'ho provato, e le scritte della barra finivano sotto i 793pt che
  // iOS disegna davvero — sparite. La seconda, che invece serve: la barretta
  // di casa sta gia' fuori dalla finestra, quindi tenerle da parte 34pt dentro
  // la barra e' contarla due volte, e sono 34pt di vuoto in piu' in fondo.
  const t = taccaSopra();
  const schermo = (window.screen && window.screen.height) || 0;
  const doppioConto = t > 0 && schermo && Math.abs(h + t - schermo) <= 1;
  const r = document.documentElement.style;
  if (doppioConto) r.setProperty('--sa-bottom', '0px'); else r.removeProperty('--sa-bottom');
  return h;
}

function seguiAltezza() {
  misuraAltezza();
  // Si rimisura dopo il caricamento e poco dopo ancora: al primo giro il
  // foglio di stile puo' non essere ancora applicato, e senza il valore della
  // tacca il controllo qui sopra non puo' accorgersi di niente. Misurare una
  // volta sola voleva dire restare per sempre col numero sbagliato.
  window.addEventListener('load', misuraAltezza);
  setTimeout(misuraAltezza, 0);
  setTimeout(misuraAltezza, 300);
  // tornando all'app dopo averla lasciata in secondo piano
  window.addEventListener('pageshow', misuraAltezza);
  window.addEventListener('resize', misuraAltezza);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', misuraAltezza);
  // Dopo una rotazione iOS risponde ancora con i numeri di prima per qualche
  // frame: si rimisura poco dopo, altrimenti resta l'altezza dell'orientamento
  // precedente.
  window.addEventListener('orientationchange', () => {
    misuraAltezza();
    setTimeout(misuraAltezza, 120);
    setTimeout(misuraAltezza, 400);
  });
}

/**
 * Quando i referti entrano in lega da soli (solo per il Giudice Dati), lo si
 * dice: e' una scrittura sul database, e una scrittura silenziosa e' peggio
 * di una rumorosa.
 */
function avvisaReferti() {
  const a = S.prendiAvvisoReferti(); if (!a) return;
  const g = a.giornate.length === 1 ? `la giornata ${a.giornate[0]}` : `le giornate ${a.giornate.join(', ')}`;
  toast(`Referti FSGC caricati in lega: ${g} · ${a.eventi} eventi`);
}

async function boot() {
  seguiAltezza();
  registraServiceWorker();
  document.body.insertAdjacentHTML('afterbegin', SPRITE + AVATAR_SPRITE);
  applyTheme();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  diagnostica.ascolta();
  S.setErrorHandler((e) => {
    console.error(e);
    // Anche quelli che l'app gia' prendeva finiscono nella lista: sono i piu'
    // utili, perche' sono quelli che l'utente ha visto.
    diagnostica.segna('app', e?.message || e, e?.stack || '');
    if (S.appState() !== 'offline') toast(e?.message || 'Errore di rete');
  });
  const callbackError = authCallbackError();
  root.innerHTML = `<div class="app">${splash()}</div>`;
  await S.init();
  cleanAuthUrl();
  render();
  if (callbackError) toast(callbackError);
  avvisaReferti();
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
  //
  // Ma "la prossima apertura" su un iPhone puo' essere fra giorni: un'app sulla
  // schermata Home resta sospesa in memoria e torna su com'era, senza
  // ricaricare. Alex ha cercato per un quarto d'ora un bottone che c'era da
  // un'ora, perche' la sua app era ancora quella del giorno prima. Quindi
  // quando il service worker nuovo prende il controllo si AVVISA — un
  // bottone, non una ricarica: e' la persona a decidere quando, e un bottone
  // non puo' andare in ciclo.
  if ('serviceWorker' in navigator) {
    // Al primo accesso il controllo passa da "nessuno" al primo service
    // worker: non e' un aggiornamento e non si dice niente.
    let avevaControllo = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!avevaControllo) { avevaControllo = true; return; }
      mostraAggiornamento();
    });
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
