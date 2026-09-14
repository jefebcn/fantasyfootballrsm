/**
 * Notizie del calcio sammarinese (San Marino RTV, via /api/notizie).
 *
 * Non si mostra mai il testo integrale: titolo, una riga di sommario e il
 * rimando all'articolo sul loro sito, con la fonte in chiaro. L'ultimo
 * risultato buono resta in localStorage, così se il feed non risponde si
 * vede comunque qualcosa invece del vuoto.
 */
const CHIAVE = 'fcs:notizie';
const FRESCO_MS = 15 * 60 * 1000;

let memoria = null;
let inCorso = null;

const leggiCache = () => {
  try { const c = JSON.parse(localStorage.getItem(CHIAVE) || 'null'); return c?.notizie?.length ? c : null; } catch { return null; }
};
const scriviCache = (dati) => { try { localStorage.setItem(CHIAVE, JSON.stringify(dati)); } catch { /* quota o modalità privata */ } };

/** Quello che si può disegnare subito, senza aspettare la rete. */
export function disponibili() { return (memoria || leggiCache())?.notizie || []; }
export function fonte() { return (memoria || leggiCache())?.fonte || 'San Marino RTV'; }

/**
 * Carica se serve. `poi` viene chiamata solo quando c'è davvero qualcosa di
 * nuovo da mostrare, per non far ridisegnare la pagina a vuoto.
 */
export function carica(poi) {
  const c = memoria || leggiCache();
  if (c && Date.now() - (c.preso || 0) < FRESCO_MS) { memoria = c; return; }
  if (inCorso) return;
  inCorso = fetch('/api/notizie', { headers: { accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((d) => {
      if (!d?.notizie?.length) return;
      const primo = c?.notizie?.[0]?.link;
      memoria = { ...d, preso: Date.now() };
      scriviCache(memoria);
      if (!c || d.notizie[0]?.link !== primo) poi?.();
    })
    .catch(() => { /* niente rete o feed giù: si tiene la cache, la sezione non compare */ })
    .finally(() => { inCorso = null; });
}
