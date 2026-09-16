/**
 * Personaggi scontornati per la copertina (media/avatar/N.webp).
 *
 * Li ritaglia scripts/ritaglia-calciatori.py dalle tavole
 * media/avatar/calciatoriN.png. Sono quattordici: in una lega da otto ognuno
 * puo' avere il suo e ne restano. Chi non ne sceglie uno tiene la maglia.
 */
/**
 * I numeri sono quelli dei file sorgente e non scalano mai: togliendo un
 * personaggio il suo numero resta vuoto invece di far scivolare gli altri, se
 * no chi l'aveva scelto si ritroverebbe in copertina qualcun altro.
 *
 * Per la stessa ragione i nuovi partono da 101 invece di riusare i numeri dei
 * dieci disegnati prima (1-21, che restano in cartella): chi aveva scelto il 7
 * non si ritrova in copertina una faccia diversa. Si ritrova la maglia, che e'
 * quello che gia' succede a chi non sceglie, ed e' scritto qui sotto.
 */
const NUMERI = [101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114];
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
