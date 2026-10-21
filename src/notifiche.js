/**
 * Avvisi: la formazione da consegnare.
 *
 * Due tempi, e il foglio delle impostazioni dice a che punto siamo invece di
 * promettere in blocco.
 *
 * 1. AD APP APERTA — funziona da subito, senza niente di acceso da nessuna
 *    parte. Apri l'app, manca poco al lock, non hai schierato: arriva
 *    l'avviso. E' la promessa che il foglio faceva da sempre e che nessuno
 *    manteneva: non c'era una sola chiamata a showNotification in tutto il
 *    progetto.
 * 2. A TELEFONO CHIUSO — vuole le notifiche push, cioe' una chiave VAPID e
 *    qualcuno che le spedisca. Il codice c'e' (iscrizione qui, consegna nel
 *    service worker, invio in supabase/functions/promemoria), ma finche' la
 *    chiave non e' configurata questa parte resta spenta e l'app lo dice.
 */
import { VAPID_PUBBLICA } from './config.js';

/**
 * DENTRO L'APP IPHONE (App Store, cartella ios/). L'app e' questo stesso sito
 * aperto da un guscio nativo (Capacitor), e li' le notifiche web non ci sono:
 * passano da Apple. Le funzioni qui sotto restano le stesse per chi le chiama,
 * cambia solo cosa fanno dentro. Il dispositivo si salva in push_subscriptions
 * come le iscrizioni web, con l'indirizzo "apns:<codice>": la funzione che
 * spedisce (supabase/functions/promemoria) lo riconosce dal prefisso.
 *
 * vendor/capacitor-core.js e' @capacitor/core 8.5.2 copiato com'e' da
 * node_modules/@capacitor/core/dist/index.js. Si carica SOLO dentro l'app:
 * sul sito non parte nessuna richiesta in piu'.
 */
const capacitor = () => (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() ? window.Capacitor : null);
export const nativa = () => !!capacitor();
let pluginPush = null;
let permessoNativo = 'default';
let tokenNativo = null;
let aspettaToken = null;
let avvio = Promise.resolve();
const STATI = { granted: 'granted', denied: 'denied' };
// Il plugin viaggia dentro un oggetto, mai da solo in una promessa: il proxy di
// Capacitor risponde a qualunque nome, anche a "then", e una promessa che si
// risolve con lui chiamerebbe un metodo nativo "then" che non esiste.
const push = () => (pluginPush ||= import('../vendor/capacitor-core.js').then((m) => ({ P: m.registerPlugin('PushNotifications') })));

// addListener restituisce una promessa: se il plugin manca non deve finire in un errore non gestito
const ascolta = (plugin, evento, fn) => Promise.resolve().then(() => plugin.addListener(evento, fn)).catch(() => {});

async function avviaNativo() {
  const [{ P }, core] = await Promise.all([push(), import('../vendor/capacitor-core.js')]);
  try { permessoNativo = STATI[(await P.checkPermissions()).receive] || 'default'; } catch { /* resta default */ }
  ascolta(P, 'registration', (t) => { tokenNativo = t.value; aspettaToken?.(t.value); });
  ascolta(P, 'registrationError', () => aspettaToken?.(null));
  // tocco sulla notifica: si apre la schermata giusta (es. la formazione)
  ascolta(P, 'pushNotificationActionPerformed', (a) => {
    const h = String(a.notification?.data?.url || '').split('#')[1];
    if (h) location.hash = h;
  });
  // il codice del dispositivo puo' cambiare: lo si chiede a ogni avvio
  if (permessoNativo === 'granted') P.register().catch(() => {});
  // i link di fantatitano.site (conferma e-mail, «Entra senza password»,
  // inviti) aprono l'app invece di Safari: qui si va alla pagina giusta
  const vaiA = (url) => { try { if (url && new URL(url).host === location.host && url !== location.href) location.href = url; } catch { /* link estraneo */ } };
  const App = core.registerPlugin('App');
  ascolta(App, 'appUrlOpen', ({ url }) => vaiA(url));
  // app chiusa e aperta proprio da un link: quel link arriva qui
  // (una volta sola: ai ricaricamenti successivi il link di lancio e' sempre quello)
  let primo = true;
  try { primo = !sessionStorage.getItem('fcs:lancio'); sessionStorage.setItem('fcs:lancio', '1'); } catch { /* niente memoria */ }
  if (primo) App.getLaunchUrl().then((r) => vaiA(r?.url)).catch(() => {});
  // condividere: il foglio nativo di iOS al posto di quello del browser
  const Share = core.registerPlugin('Share');
  navigator.share = (d) => Share.share({ title: d?.title, text: d?.text, url: d?.url, dialogTitle: d?.title });
}
if (nativa()) avvio = avviaNativo().catch(() => {});
/** Si risolve quando l'app iPhone sa gia' se le notifiche sono permesse. */
export const nativoPronto = () => avvio;

export const supportate = () => nativa() || (typeof Notification !== 'undefined' && 'serviceWorker' in navigator);
export const permesso = () => (nativa() ? permessoNativo : supportate() ? Notification.permission : 'unsupported');
export const pushConfigurato = () => !!VAPID_PUBBLICA;

/** iPhone e iPad, compreso l'iPad che si presenta come un Mac con lo schermo tattile. */
export const suiOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/**
 * Quale browser su iPhone. Da iOS 16.4 «Aggiungi alla schermata Home» c'e'
 * anche in Chrome, Edge e Firefox, non solo in Safari (Alex l'ha fatto da
 * Chrome il 10/10): cambia solo DOVE sta il tasto Condividi. Dentro le app
 * (Instagram, Facebook, l'app Google) invece la voce non c'e'.
 */
export function browserIOS() {
  const ua = navigator.userAgent;
  if (/Instagram|FBAN|FBAV|GSA\//.test(ua)) return 'app';
  if (/CriOS/.test(ua)) return 'chrome';
  if (/FxiOS|EdgiOS/.test(ua)) return 'altro';
  return 'safari';
}

/** Dove si tocca Condividi, con le parole del browser che si ha in mano. */
export function doveCondividi() {
  const b = browserIOS();
  if (b === 'chrome') return 'Il quadrato con la freccia in su, a destra nella barra dell\'indirizzo.';
  if (b === 'altro') return 'Il quadrato con la freccia in su: se non lo vedi nella barra, è nel menu del browser.';
  return 'Il quadrato con la freccia in su, nella barra di Safari.';
}

/** Aperta dalla schermata Home, non dentro un browser. */
export const installata = () => nativa() || navigator.standalone === true
  || (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches);

/**
 * Perche' le notifiche non sono disponibili, quando non lo sono.
 *
 * Su iPhone `Notification` esiste solo se l'app e' stata aggiunta alla
 * schermata Home e aperta da li': dentro Safari non c'e' proprio, e il foglio
 * delle impostazioni mostrava l'interruttore senza il bottone del permesso e
 * senza una parola di spiegazione. Chi cercava "dove si attivano" non trovava
 * niente da premere. E' successo il 17 settembre, al primo tentativo vero.
 *
 * Restituisce null quando sono supportate; altrimenti il motivo, che e' anche
 * il rimedio.
 */
export function motivoNonSupportate() {
  if (supportate()) return null;
  if (suiOS() && !installata()) return 'ios-nel-browser';
  return 'browser-senza';
}

/**
 * LA RICHIESTA GENTILE (Alex, 11/10: «che arrivi la richiesta, senza essere
 * invasivo»). Fino a qui le push si attivavano solo dalle impostazioni, e su
 * 26 iscritti c'era UN telefono iscritto: il promemoria della formazione non
 * arrivava a nessuno.
 *
 * Quando la dashboard puo' chiederlo:
 *  - mai alla prima apertura: solo dopo la prima formazione salvata, che e' il
 *    momento in cui un promemoria serve davvero;
 *  - solo dove funziona: notifiche supportate, push configurate, permesso
 *    ancora da chiedere (chi ha detto no al telefono non si riassilla);
 *  - non a chi il promemoria l'ha spento lui dalle impostazioni;
 *  - «Non ora» lo fa sparire per due settimane, e dopo il secondo no non
 *    torna piu'. L'interruttore nelle impostazioni resta sempre.
 * La finestra di sistema si apre solo se si tocca «Sì»: e' il riquadro
 * dell'app a chiedere, non il telefono a sorpresa.
 */
export const PAUSA_RICHIESTA_MS = 14 * 24 * 3600 * 1000;
/**
 * E SU IPHONE DAL BROWSER (13/10: 2 telefoni iscritti al promemoria). Li'
 * le notifiche non esistono finche' l'app non sta sulla schermata Home, e la
 * richiesta qui sopra non compariva mai: c'era solo il banner «Installa»,
 * una riga che si chiude per sempre con la ✕. Ora anche loro, alle stesse
 * condizioni (dopo la prima formazione, «Non ora» per due settimane, al
 * secondo no basta), vedono come si fa: prima la Home, poi il «Sì».
 *
 * Restituisce cosa chiedere, o null:
 *   'permesso'     le notifiche ci sono: il «Sì» apre la finestra del telefono
 *   'installa'     iPhone nel browser: i passi per la schermata Home
 *   'apri-browser' iPhone dentro Instagram o Facebook: la Home li' non c'e',
 *                  prima si apre il sito in Safari
 */
export function comeChiedere({ avvisi, chiesto, consegnato, permesso: perm, supportate: sup, configurato,
  ios = false, installata: inst = false, browser = 'safari', ora = Date.now() }) {
  if (!consegnato || !configurato || avvisi === false) return null;
  const volte = chiesto?.volte || 0;
  if (volte >= 2 || (volte > 0 && ora - (chiesto?.ultima || 0) < PAUSA_RICHIESTA_MS)) return null;
  if (sup) return perm === 'default' ? 'permesso' : null;
  if (ios && !inst) return browser === 'app' ? 'apri-browser' : 'installa';
  return null;
}
export const daChiedere = (o) => comeChiedere(o) === 'permesso';

export async function chiediPermesso() {
  if (nativa()) {
    try { permessoNativo = STATI[(await (await push()).P.requestPermissions()).receive] || 'default'; } catch { /* resta com'era */ }
    return permessoNativo;
  }
  if (!supportate()) return 'unsupported';
  try { return await Notification.requestPermission(); } catch { return permesso(); }
}

/** Il service worker e' l'unico che puo' mostrare notifiche su iOS. */
async function registrazione() {
  if (!('serviceWorker' in navigator)) return null;
  try { return await navigator.serviceWorker.ready; } catch { return null; }
}

/**
 * Mostra l'avviso, una volta sola per giornata.
 * `giaAvvisato` e `segna` li passa chi chiama, cosi' questo file non sa niente
 * di dove si tengono le preferenze.
 */
export async function avvisaFormazione(p, { giaAvvisato, segna }) {
  // nell'app iPhone l'avviso arriva da Apple (promemoria sul server)
  if (!p || nativa() || permesso() !== 'granted') return false;
  if (giaAvvisato === p.giornata) return false;
  const reg = await registrazione(); if (!reg) return false;
  const ore = Math.floor(p.ore);
  const quando = ore >= 24 ? `${Math.floor(ore / 24)} giorni` : ore >= 1 ? `${ore} ore` : 'meno di un\'ora';
  try {
    await reg.showNotification(`Giornata ${p.giornata}: manca la formazione`, {
      body: `Si chiude fra ${quando}. Senza consegna la partita è persa 0-3 a tavolino.`,
      tag: `formazione-${p.giornata}`,       // una sola, e si sostituisce
      renotify: false,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      data: { url: './#/rosa/formazione' },
    });
    segna(p.giornata);
    return true;
  } catch { return false; }
}

/** Iscrizione alle push. Senza chiave VAPID non si fa: non c'e' chi le manda. */
export async function iscriviPush() {
  if (nativa()) {
    if (permessoNativo !== 'granted') return null;
    const token = tokenNativo || await new Promise((ok) => {
      aspettaToken = ok; setTimeout(() => ok(null), 15000);
      push().then(({ P }) => P.register()).catch(() => ok(null));
    });
    return token ? { endpoint: `apns:${token}`, keys: { p256dh: 'apns', auth: 'apns' } } : null;
  }
  if (!pushConfigurato() || permesso() !== 'granted') return null;
  const reg = await registrazione(); if (!reg || !reg.pushManager) return null;
  const esistente = await reg.pushManager.getSubscription();
  if (esistente) return esistente.toJSON();
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64Url(VAPID_PUBBLICA),
  });
  return sub.toJSON();
}
/**
 * Questo dispositivo e' iscritto davvero?
 *
 * `pushConfigurato()` dice solo che la chiave c'e'. Finche' era vuota le due
 * cose coincidevano, perche' senza chiave non ci si poteva iscrivere; da
 * quando la chiave e' montata no: il permesso puo' mancare, l'utente puo'
 * aver disiscritto, il browser puo' non avere pushManager. Il foglio delle
 * impostazioni deve dire quello che e' vero su QUESTO telefono.
 */
export async function iscrittoPush() {
  if (nativa()) return permessoNativo === 'granted' && !!tokenNativo;
  if (!pushConfigurato() || permesso() !== 'granted') return false;
  const reg = await registrazione(); if (!reg || !reg.pushManager) return false;
  try { return !!(await reg.pushManager.getSubscription()); } catch { return false; }
}

/** L'indirizzo con cui questo dispositivo e' iscritto, o null. */
export async function indirizzoPush() {
  if (nativa()) return tokenNativo ? `apns:${tokenNativo}` : null;
  const reg = await registrazione(); if (!reg || !reg.pushManager) return null;
  try { return (await reg.pushManager.getSubscription())?.endpoint || null; } catch { return null; }
}

export async function disiscriviPush() {
  if (nativa()) {
    try { await (await push()).P.unregister(); } catch { /* gia' fuori */ }
    tokenNativo = null; return true;
  }
  const reg = await registrazione(); if (!reg || !reg.pushManager) return false;
  const sub = await reg.pushManager.getSubscription();
  return sub ? sub.unsubscribe() : false;
}

/** La chiave VAPID viaggia in base64url, ma subscribe() vuole i byte. */
function base64Url(s) {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
