/**
 * Gli ultimi errori, per poterli raccontare.
 *
 * Prima finivano in console.error e in un avviso a scomparsa sul telefono di
 * chi li subiva. Se a qualcuno non si salvava la formazione la domenica
 * mattina, chi gestisce l'app non lo sapeva mai: lo scopriva se glielo
 * raccontavano, e il racconto e' "non andava".
 *
 * FINO AL 28 SETTEMBRE QUI NON SI SPEDIVA NIENTE, per scelta: mandare gli
 * errori a un server era un trattamento nuovo, con una base giuridica da
 * dichiarare e un fornitore in piu' da nominare. Poi sono arrivati dodici
 * tester tutti su Android, e chi gestisce l'app non ha un Android in mano:
 * un errore del Play Store si sarebbe scoperto solo a lamentela arrivata.
 * Alex ha scelto di cambiare, alle tre condizioni che erano i motivi del no:
 *  - nessun fornitore nuovo: va nello stesso Supabase gia' dichiarato
 *    (migrazione 022), non a un servizio di terzi;
 *  - base giuridica gia' scritta — legittimo interesse, log tecnici — e ora
 *    detta per esteso nell'informativa;
 *  - niente di chi: messaggio, versione, schermata, tipo di telefono. Niente
 *    account, niente identificativi, e le e-mail si cancellano prima di
 *    partire e di nuovo nel database.
 *
 * Il bottone per mandare la segnalazione a mano resta: dice quello che il
 * rapporto automatico non puo' sapere, cioe' cosa stavi facendo.
 *
 * In memoria e non su disco: se ne vanno chiudendo l'app, e nessuno deve
 * ricordarsi di pulirli.
 */
const QUANTI = 12;
const ultimi = [];

/** Aggiunge un errore alla lista, tenendo solo gli ultimi. */
export function segna(tipo, messaggio, dettaglio = '') {
  ultimi.push({
    quando: new Date().toISOString(),
    tipo,
    messaggio: String(messaggio || '').slice(0, 300),
    dettaglio: String(dettaglio || '').slice(0, 300),
  });
  while (ultimi.length > QUANTI) ultimi.shift();
  manda(tipo, messaggio, dettaglio);
}

/* ------------------------------------------------------------ il rapporto
 * Chi spedisce lo decide app.js, quando il collegamento col server e' pronto
 * (impostaInvio): questo file non importa niente dell'app, cosi' un errore
 * dentro l'app non puo' rompere anche il modo di raccontarlo. Quello che
 * succede prima si tiene da parte e parte appena si puo'.
 */
const POSTA = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const MAX_PER_SESSIONE = 10;
// Il rumore che non e' un difetto dell'app: la rete che manca, e i messaggi
// che l'app stessa da' a chi sbaglia un campo. Mandarli riempirebbe la lista
// di cose che nessuno puo' correggere.
const RUMORE = /failed to fetch|networkerror|load failed|nessuna connessione|network request failed|non raggiungibile/i;
let invia = null;
const inAttesa = [];
const giaMandati = new Set();
let mandati = 0;

/** "Android · Chrome · app": il tipo, non il telefono. */
export function dispositivo(ua = (typeof navigator !== 'undefined' ? navigator.userAgent : ''), installata = false) {
  const so = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iPhone' : /Macintosh|Windows|Linux/i.test(ua) ? 'computer' : 'altro';
  const br = /SamsungBrowser/i.test(ua) ? 'Samsung' : /EdgA?\//i.test(ua) ? 'Edge' : /FxiOS|Firefox/i.test(ua) ? 'Firefox'
    : /CriOS|Chrome/i.test(ua) ? 'Chrome' : /Safari/i.test(ua) ? 'Safari' : 'altro';
  return `${so} · ${br} · ${installata ? 'app' : 'browser'}`;
}

/** La schermata senza gli identificativi: "giocatore/:id", non quale giocatore. */
export function schermata(hash = (typeof location !== 'undefined' ? location.hash : '')) {
  return String(hash || '').replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean).slice(0, 3)
    // tiene i nomi delle schermate (lettere e trattini) e toglie il resto:
    // lo stesso errore sul giocatore A e sul giocatore B e' UN difetto, e
    // deve fare una riga sola in console, non due
    .map((p) => (/^[a-z-]+$/.test(p) ? p : ':id')).join('/') || 'home';
}

function manda(tipo, messaggio, dettaglio) {
  const m = String(messaggio || '').trim();
  if (!m || RUMORE.test(m)) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  const chiave = `${tipo}|${m}`;
  if (giaMandati.has(chiave) || mandati >= MAX_PER_SESSIONE) return;
  giaMandati.add(chiave); mandati++;
  const installata = typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches;
  const r = {
    messaggio: m.replace(POSTA, '[e-mail]').slice(0, 300),
    dettaglio: String(dettaglio || '').replace(POSTA, '[e-mail]').slice(0, 1200),
    schermata: schermata(),
    dispositivo: dispositivo(undefined, installata),
  };
  if (invia) spedisci(r); else if (inAttesa.length < MAX_PER_SESSIONE) inAttesa.push(r);
}

async function spedisci(r) {
  try { await invia({ ...r, versione: await versioneInCache() }); } catch { /* il rapporto non deve mai diventare un errore a sua volta */ }
}

/** Da app.js, quando il server e' raggiungibile: da qui in poi gli errori partono. */
export function impostaInvio(fn) {
  invia = typeof fn === 'function' ? fn : null;
  if (invia) while (inAttesa.length) spedisci(inAttesa.shift());
}

export const quantiErrori = () => ultimi.length;

/** Si aggancia a quello che il browser sa e l'app non vedeva. */
export function ascolta(finestra = window) {
  finestra.addEventListener('error', (e) => {
    // Le immagini che non arrivano fanno un evento senza messaggio: sono
    // rumore, non guasti dell'app.
    if (e?.target && e.target !== finestra) return;
    segna('errore', e?.message, `${e?.filename || ''}:${e?.lineno || ''}`);
  });
  finestra.addEventListener('unhandledrejection', (e) => {
    segna('promessa', e?.reason?.message || e?.reason, e?.reason?.stack || '');
  });
}

/**
 * Che versione sta girando davvero.
 *
 * Non una costante scritta a mano, che resta indietro: il nome della cache
 * del service worker, che cambia a ogni pubblicazione. E' l'unica cosa che
 * dice quale codice ha in mano chi segnala — che e' la prima domanda.
 */
export async function versioneInCache() {
  try {
    const nomi = await caches.keys();
    return nomi.find((n) => n.startsWith('fcs-')) || 'sconosciuta';
  } catch { return 'sconosciuta'; }
}

/** Il testo da incollare in un messaggio: cosa e dove, senza dati di nessuno. */
export function rapporto(extra = {}) {
  const n = typeof navigator !== 'undefined' ? navigator : {};
  const s = typeof screen !== 'undefined' ? screen : {};
  const righe = [
    'Segnalazione Fantatitano',
    `quando: ${new Date().toISOString()}`,
    `versione: ${extra.versione || 'sconosciuta'}`,
    `come gira: ${typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches ? 'installata' : 'nel browser'}`,
    `schermo: ${s.width || '?'}x${s.height || '?'}  finestra: ${window.innerWidth}x${window.innerHeight}`,
    `browser: ${(n.userAgent || '').slice(0, 160)}`,
    `lingua: ${n.language || '?'}   in rete: ${n.onLine === false ? 'no' : 'sì'}`,
    '',
    ultimi.length ? `ultimi ${ultimi.length} errori:` : 'nessun errore registrato in questa sessione.',
    ...ultimi.map((e) => `  ${e.quando} [${e.tipo}] ${e.messaggio}${e.dettaglio ? ` — ${e.dettaglio}` : ''}`),
    '',
    'Cosa stavo facendo: ',
  ];
  return righe.join('\n');
}
