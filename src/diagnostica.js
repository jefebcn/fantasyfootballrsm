/**
 * Gli ultimi errori, per poterli raccontare.
 *
 * Prima finivano in console.error e in un avviso a scomparsa sul telefono di
 * chi li subiva. Se a qualcuno non si salvava la formazione la domenica
 * mattina, chi gestisce l'app non lo sapeva mai: lo scopriva se glielo
 * raccontavano, e il racconto e' "non andava".
 *
 * QUI NON SI SPEDISCE NIENTE DA SOLI, ed e' una scelta, non una mancanza.
 * Mandare gli errori a un server sarebbe un trattamento nuovo: andrebbe
 * scritto nell'informativa, avrebbe una base giuridica da dichiarare e un
 * fornitore in piu' da nominare. Per un'app che promette "nessuno strumento
 * di terzi ti segue" sarebbe un prezzo alto per un problema che si risolve
 * altrimenti: gli ultimi errori restano in memoria, e un bottone li mette in
 * un messaggio che parte solo se sei TU a premerlo.
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
