/**
 * Personaggi scontornati per la copertina (media/avatar/N.webp).
 *
 * I primi li ritaglia scripts/make-avatar.py dai file in media/avatarN.jpg.
 * Chi non ne sceglie uno tiene la maglia. Lo stesso personaggio lo possono
 * avere piu' squadre: nessuno controlla che sia unico.
 */
/**
 * I numeri sono quelli dei file sorgente e non scalano mai: togliendo un
 * personaggio il suo numero resta vuoto invece di far scivolare gli altri, se
 * no chi l'aveva scelto si ritroverebbe in copertina qualcun altro. Per questo
 * nell'elenco ci sono dei buchi, ed e' voluto.
 *
 * RITIRATI IL 7 OTTOBRE 2026, prima della produzione su Google Play: 7, 8,
 * 14 e 16 erano calciatori veri riconoscibili (con maglie e sponsor veri), 10,
 * 11 e 20 personaggi di cartoni animati di altri, 21 una figura simile a un
 * attore con un logo sportivo sul cappello. Uso commerciale di immagini e
 * marchi altrui: e' una delle cause di rifiuto piu' comuni di Play, e un
 * rischio anche fuori. Chi li aveva scelti torna alla sua maglia (scelto()
 * qui sotto vale "nessuno" per un numero non piu' in elenco); i file restano
 * in media/avatar per non rompere niente, ma nessuno li mostra.
 *
 * 30 e' TITO, la mascotte di Fantatitano, disegnato da Alex per il progetto
 * (media/tito-sorgenti/braccia.webp, ritagliato alla stessa altezza degli
 * altri).
 */
const NUMERI = [30, 1, 6];
const NOMI = { 30: 'TITO' };
export const QUANTI = NUMERI.length;
export const elenco = () => [...NUMERI];
/** Il nome da leggere a voce (lettori di schermo): TITO ha un nome, gli altri no. */
export const nomePersonaggio = (n) => NOMI[n] || `Personaggio ${n}`;

/** Il personaggio scelto, o null se la squadra tiene la maglia. Un numero non
 *  piu' in elenco (personaggio ritirato) vale come "nessuno". */
export const scelto = (m) => {
  const n = Number(m?.kit?.personaggio);
  return NUMERI.includes(n) ? n : null;
};

export const personaggio = (n, cls = '') =>
  `<img class="pers ${cls}" src="media/avatar/${n}.webp" alt="" decoding="async">`;
