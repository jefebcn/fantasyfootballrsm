/**
 * I dieci personaggi della copertina.
 *
 * Prima erano ritagli di immagini altrui: raffiguravano calciatori veri e
 * personaggi di cartoni, scontornati da media/avatarN.jpg con
 * scripts/make-avatar.py. Fra amici in una lega privata e' una cosa; aprire le
 * iscrizioni a chiunque e' un'altra, e servirebbe materiale originale.
 *
 * Ora sono disegnati, con lo stesso vocabolario di forme degli avatar dei
 * giocatori (src/avatar.js), che e' originale per costruzione: nessun pezzo
 * viene da una foto e nessuno prova a somigliare a qualcuno. I tratti pero'
 * non sono tirati a sorte come per i giocatori — qui sono scelti, perche' dieci
 * pupazzetti casuali si assomigliano tutti, mentre questi devono distinguersi
 * a colpo d'occhio anche in piccolo.
 *
 * Niente file da scaricare: sono SVG, quindi restano nitidi a ogni dimensione
 * e aggiungerne uno e' una riga qui.
 */
import { figura, TRATTI } from './avatar.js';

const P = TRATTI.PELLE; const C = TRATTI.CAPELLI;

/**
 * I numeri non scalano mai: togliendo un personaggio il suo numero resta vuoto
 * invece di far scivolare gli altri, se no chi l'aveva scelto si ritroverebbe
 * in copertina qualcun altro. I buchi nell'elenco sono voluti, e sono gli
 * stessi di prima perche' chi aveva scelto il 14 continui ad avere il 14.
 */
const PERSONAGGI = {
  1:  { nome: 'Il capitano',      c1: '#2B4C7E', c2: '#FFFFFF', pelle: P[1], capelli: C[0], taglio: 0, bocca: 0, trama: 1 },
  6:  { nome: 'Il riccio',        c1: '#1E9E6A', c2: '#FFFFFF', pelle: P[3], capelli: C[1], taglio: 1, bocca: 2, trama: 2 },
  7:  { nome: 'La coda',          c1: '#E5A11B', c2: '#26324A', pelle: P[0], capelli: C[5], taglio: 7, bocca: 1, trama: 0 },
  8:  { nome: 'Il barbuto',       c1: '#A32B2B', c2: '#FFFFFF', pelle: P[2], capelli: C[2], taglio: 2, barba: 1, bocca: 3, trama: 3 },
  10: { nome: 'L\'afro',          c1: '#8E44AD', c2: '#FFFFFF', pelle: P[5], capelli: C[0], taglio: 5, bocca: 0, trama: 0 },
  11: { nome: 'Gli occhiali',     c1: '#0F6FB8', c2: '#FFFFFF', pelle: P[1], capelli: C[3], taglio: 6, bocca: 1, occhiali: true, trama: 4 },
  14: { nome: 'La fascia',        c1: '#157A51', c2: '#FFE08A', pelle: P[4], capelli: C[0], taglio: 2, bocca: 2, fascia: true, trama: 1 },
  16: { nome: 'Il chiomato',      c1: '#21397F', c2: '#FFC94D', pelle: P[0], capelli: C[7], taglio: 3, bocca: 0, trama: 2 },
  20: { nome: 'Il pizzetto',      c1: '#D98A15', c2: '#26324A', pelle: P[2], capelli: C[6], taglio: 0, barba: 3, bocca: 3, trama: 0 },
  21: { nome: 'Il pelato',        c1: '#2E4057', c2: '#FFFFFF', pelle: P[3], capelli: C[0], taglio: 4, barba: 2, bocca: 1, trama: 3 },
};

const NUMERI = Object.keys(PERSONAGGI).map(Number);
export const QUANTI = NUMERI.length;
export const elenco = () => [...NUMERI];
export const nomeDi = (n) => PERSONAGGI[n]?.nome || '';

/** Il personaggio scelto, o null se la squadra tiene la maglia. Un numero non
 *  piu' in elenco (personaggio ritirato) vale come "nessuno". */
export const scelto = (m) => {
  const n = Number(m?.kit?.personaggio);
  return NUMERI.includes(n) ? n : null;
};

export const personaggio = (n, cls = '') => {
  const t = PERSONAGGI[n];
  return t ? figura(t, `pers ${cls}`) : '';
};
