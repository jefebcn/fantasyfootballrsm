import { crest } from './ui.js';

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
 * rimessi lo stesso giorno, per scelta di Alex. Il 15/10, con l'app aperta a
 * tutti e l'incontro con la FSGC, tolti davvero (file compresi) e sostituiti
 * da 40-47, personaggi originali generati da Alex e scontornati con rembg:
 * stessa posizione nell'elenco, e chi aveva il vecchio si trova il nuovo
 * (SOSTITUITI qui sotto). Numeri nuovi e non i vecchi riusati: un telefono
 * con la vecchia immagine in memoria non la mostra piu'.
 *
 * 30 e' TITO, la mascotte di Fantatitano, disegnato da Alex per il progetto
 * (media/tito-sorgenti/braccia.webp, ritagliato alla stessa altezza degli
 * altri).
 */
// 31 e' TITO d'oro: lo stesso TITO in oro (media/avatar/31.webp, fatto dal
// 30), premio dei Reclutatori per chi porta 3 amici. Sta in elenco come gli
// altri; chi non l'ha sbloccato lo vede col lucchetto.
const NUMERI = [30, 31, 1, 6, 40, 41, 42, 43, 44, 45, 46, 47];
/** Chi aveva scelto uno dei personaggi tolti il 15/10 ha quello nuovo che ne
 *  ha preso il posto. Nessuna migrazione dei dati: la scelta salvata resta il
 *  vecchio numero finche' la squadra non ne sceglie un altro. */
const SOSTITUITI = { 7: 40, 8: 41, 10: 42, 11: 43, 14: 44, 16: 45, 20: 46, 21: 47 };
const NOMI = { 30: 'TITO', 31: 'TITO d\'oro' };
export const QUANTI = NUMERI.length;
export const elenco = () => [...NUMERI];
/** Il nome da leggere a voce (lettori di schermo): TITO ha un nome, gli altri no. */
export const nomePersonaggio = (n) => NOMI[n] || `Personaggio ${n}`;

/** Il personaggio scelto, o null se la squadra tiene la maglia. Un numero non
 *  piu' in elenco (personaggio ritirato) vale come "nessuno". */
export const scelto = (m) => {
  const salvato = Number(m?.kit?.personaggio);
  const n = SOSTITUITI[salvato] || salvato;
  return NUMERI.includes(n) ? n : null;
};

export const personaggio = (n, cls = '') =>
  `<img class="pers ${cls}" src="media/avatar/${n}.webp" alt="" decoding="async">`;

/**
 * Il personaggio di una squadra dove la squadra si mostra in grande (Alex,
 * 12/10: «dare leggermente piu' importanza a questi avatar in certi punti
 * per far vedere cosa hanno i nostri amici»): la sfida in home, la testata
 * dello scontro, la formazione di un altro. null se non l'ha scelto: li'
 * resta lo stemma.
 *
 * Lo stemma non sparisce: chi ha caricato il logo della sua squadra lo vuole
 * vedere (Alex, 12/10: «cosi' va a coprire il logo se un utente carica la
 * foto del logo»). Sta ai piedi del personaggio, piccolo, come un adesivo.
 */
export const figura = (m, cls = '') => {
  const n = scelto(m);
  return n ? `<span class="fig ${cls}">${personaggio(n)}<span class="fig-logo">${crest(m, 'sm')}</span></span>` : null;
};
