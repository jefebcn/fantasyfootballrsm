/**
 * Personaggi scontornati per la copertina (media/avatar/N.webp).
 *
 * Li ritaglia scripts/make-avatar.py dai file in media/avatarN.jpg. Sono nove:
 * in una lega da otto ognuno puo' avere il suo e non se ne ripete nessuno.
 * Chi non ne sceglie uno tiene la maglia.
 */
/**
 * I numeri sono quelli dei file sorgente e non scalano mai: togliendo un
 * personaggio il suo numero resta vuoto invece di far scivolare gli altri, se
 * no chi l'aveva scelto si ritroverebbe in copertina qualcun altro. Per questo
 * nell'elenco ci sono dei buchi, ed e' voluto.
 */
const NUMERI = [1, 6, 7, 8, 10, 11, 14, 16, 20, 21];
export const QUANTI = NUMERI.length;
export const elenco = () => [...NUMERI];

/** Il personaggio scelto, o null se la squadra tiene la maglia. Un numero non
 *  piu' in elenco (personaggio ritirato) vale come "nessuno". */
export const scelto = (m) => {
  const n = Number(m?.kit?.personaggio);
  return NUMERI.includes(n) ? n : null;
};

export const personaggio = (n, cls = '') =>
  `<img class="pers ${cls}" src="media/avatar/${n}.webp" alt="" decoding="async">`;
