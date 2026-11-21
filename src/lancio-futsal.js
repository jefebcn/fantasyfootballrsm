/**
 * LE ICONE DEL LANCIO DEL FUTSAL (Alex, 21/11): dal 1° al 14 dicembre la
 * corona e' meta' viola (Fantatitano) e meta' nera (Futsal), su fondo arancio
 * del futsal; il 15 torna da sola la corona di sempre.
 *
 * Cambia solo cio' che si cambia senza un aggiornamento: l'icona della scheda
 * del browser e quella che iPhone usa quando si aggiunge il sito alla
 * schermata Home. L'icona dell'app sugli store e quella della PWA gia'
 * installata restano le stesse (cambiarle vuol dire due uscite su App Store).
 * La corona e' quella originale, non ridisegnata: solo i colori cambiano.
 */
export const LANCIO = {
  da: Date.parse('2026-12-01T00:00:00+01:00'),
  a: Date.parse('2026-12-15T00:00:00+01:00'),   // escluso: il 15 si torna alla corona viola
};

export const inLancio = (ora = Date.now()) => ora >= LANCIO.da && ora < LANCIO.a;

export function iconeLancio(ora = Date.now(), doc = globalThis.document) {
  if (!doc || !inLancio(ora)) return false;
  const metti = (sel, file) => { const l = doc.querySelector(sel); if (l) l.href = `icons/lancio-futsal/${file}`; };
  metti('link[rel="icon"]', 'icon-192.png');
  metti('link[rel="apple-touch-icon"]', 'apple-touch-icon.png');
  return true;
}
