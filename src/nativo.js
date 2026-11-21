/**
 * Vibrazione e richiesta di recensione (Alex, 15/11).
 *
 * Nell'app iPhone (dalla 1.1) passano dal plugin FantaNativo
 * (ios/App/App/AccediConApple.swift). Fuori dall'app: la vibrazione dove il
 * browser la sa fare (Android), la recensione no. Nell'app 1.0 il plugin non
 * c'e' e non succede niente: nessun errore.
 */
const PLUGIN = 'FantaNativo';
const capacitor = () => (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() ? window.Capacitor : null);
const conPlugin = () => !!capacitor()?.isPluginAvailable?.(PLUGIN);
let plugin = null;
// dentro un oggetto, mai da solo in una promessa (il proxy di Capacitor risponde anche a "then")
const prendi = () => (plugin ||= import('../vendor/capacitor-core.js').then((m) => ({ P: m.registerPlugin(PLUGIN) })));

const RITMO = { leggera: 12, media: 20, successo: [18, 60, 28], errore: [40, 50, 40] };

/** tipo: 'leggera' | 'media' | 'successo' | 'errore'. Non lancia mai. */
export function vibra(tipo = 'leggera') {
  try {
    if (conPlugin()) { prendi().then(({ P }) => P.vibra({ tipo })).catch(() => {}); return; }
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(RITMO[tipo] || RITMO.leggera);
  } catch { /* niente vibrazione: pazienza */ }
}

/**
 * La richiesta di recensione dell'App Store, al momento giusto: dopo che la
 * persona ha confermato la formazione per la terza volta (ha visto l'app
 * funzionare), poi al massimo una volta ogni 120 giorni. Apple comunque la
 * mostra al massimo tre volte l'anno e decide lui se farla vedere.
 */
const CHIAVE = 'fcs:recensione';
export const GIORNI_FRA_RICHIESTE = 120;
export function daChiedere(stato, adesso = Date.now()) {
  const conferme = Number(stato?.conferme) || 0;
  if (conferme < 3) return false;
  const ultima = Number(stato?.ultima) || 0;
  return !ultima || adesso - ultima >= GIORNI_FRA_RICHIESTE * 86400000;
}
export function formazioneConfermata() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(CHIAVE) || '{}') || {}; } catch { s = {}; }
  s.conferme = (Number(s.conferme) || 0) + 1;
  const chiedi = conPlugin() && daChiedere(s);
  if (chiedi) s.ultima = Date.now();
  try { localStorage.setItem(CHIAVE, JSON.stringify(s)); } catch { /* niente memoria */ }
  // un attimo dopo il messaggio «Formazione salvata», non sopra
  if (chiedi) setTimeout(() => prendi().then(({ P }) => P.recensione()).catch(() => {}), 1800);
  return chiedi;
}
