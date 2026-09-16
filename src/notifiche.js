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

export const supportate = () => typeof Notification !== 'undefined' && 'serviceWorker' in navigator;
export const permesso = () => (supportate() ? Notification.permission : 'unsupported');
export const pushConfigurato = () => !!VAPID_PUBBLICA;

export async function chiediPermesso() {
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
  if (!p || permesso() !== 'granted') return false;
  if (giaAvvisato === p.giornata) return false;
  const reg = await registrazione(); if (!reg) return false;
  const ore = Math.floor(p.ore);
  const quando = ore >= 24 ? `${Math.floor(ore / 24)} giorni` : ore >= 1 ? `${ore} ore` : 'meno di un\'ora';
  try {
    await reg.showNotification(`Giornata ${p.giornata}: manca la formazione`, {
      body: `Si chiude fra ${quando}. Senza consegna vale l'ultima valida, o il 4-4-2 d'ufficio.`,
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
  if (!pushConfigurato() || permesso() !== 'granted') return false;
  const reg = await registrazione(); if (!reg || !reg.pushManager) return false;
  try { return !!(await reg.pushManager.getSubscription()); } catch { return false; }
}

export async function disiscriviPush() {
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
