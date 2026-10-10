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
 * Il 7 ottobre 2026 7, 8, 14 e 16 (calciatori veri), 10, 11 e 20 (personaggi
 * di cartoni animati) e 21 sono stati tolti per il rischio commerciale e
 * rimessi lo stesso giorno, per scelta di Alex: si rivede se l'app si allarga
 * oltre San Marino.
 *
 * 30 e' TITO, la mascotte di Fantatitano, disegnato da Alex per il progetto
 * (media/tito-sorgenti/braccia.webp, ritagliato alla stessa altezza degli
 * altri).
 */
// 31 e' TITO d'oro: lo stesso TITO in oro (media/avatar/31.webp, fatto dal
// 30), premio dei Reclutatori per chi porta 3 amici. Sta in elenco come gli
// altri; chi non l'ha sbloccato lo vede col lucchetto.
const NUMERI = [30, 31, 1, 6, 7, 8, 10, 11, 14, 16, 20, 21];
const NOMI = { 30: 'TITO', 31: 'TITO d\'oro' };
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
