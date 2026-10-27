/**
 * «Chi è?», il giocatore del giorno (Alex, 27/10: «un minigame giornaliero
 * con classifica sempre basato sul calcio», per far aprire l'app anche nei
 * giorni senza partite).
 *
 * Ogni giorno un giocatore del Campionato Sammarinese da indovinare in sei
 * tentativi. A ogni tentativo l'app dice, per squadra, ruolo, eta',
 * quotazione, presenze e gol, se ci si e' presi, se si e' vicini e da che
 * parte sta il giocatore misterioso.
 *
 * Qui solo la logica, senza schermo: chi e' il giocatore del giorno, gli
 * indizi di un tentativo, il riquadro da condividere. La schermata e'
 * views/gioco.js.
 */
export const TENTATIVI = 6;
/** Il primo giorno del gioco: il «Chi è? #1». */
export const LANCIO = '2026-10-27';
/** Un giocatore non torna prima di tanti giorni. */
const PAUSA = 60;
/** Bastano tante presenze per essere un giocatore che si puo' indovinare. */
const PRESENZE_MIN = 3;

const giorniDa = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5);

/** Il giorno in Italia, «AAAA-MM-GG»: il gioco cambia a mezzanotte italiana. */
export function oggi(t = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(t);
}

/** Il numero del gioco di quel giorno: il #1 e' il giorno del lancio. */
export const numero = (giorno) => giorniDa(LANCIO, giorno) + 1;

function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

/**
 * Presenze, gol e giorno della terza presenza di ogni giocatore, dai referti.
 * La terza presenza conta per sapere da che giorno uno puo' essere il
 * giocatore misterioso.
 */
export function statistiche({ matches, appearances, events }) {
  const quando = new Map(matches.map((m) => [m.id, m.kickoffAt]));
  const s = new Map();
  const di = (id) => s.get(id) || s.set(id, { presenze: 0, gol: 0, date: [] }).get(id);
  for (const a of appearances) { const x = di(a.playerId); x.presenze++; x.date.push(quando.get(a.matchId) || ''); }
  for (const e of events) if (e.type === 'goal') di(e.playerId).gol++;
  for (const x of s.values()) { x.date.sort(); x.pronto = x.date[PRESENZE_MIN - 1] ? oggi(new Date(x.date[PRESENZE_MIN - 1])) : null; delete x.date; }
  return s;
}

/**
 * Il giocatore del giorno.
 *
 * Deve essere lo stesso per tutti e non cambiare durante il giorno, anche
 * se nel frattempo arriva un referto nuovo. Per questo i candidati di un
 * giorno sono solo quelli che avevano gia' la terza presenza il giorno
 * prima, e la scelta non e' un indice in una lista (che cambierebbe a ogni
 * giocatore aggiunto) ma il candidato col numero piu' basso fra quelli
 * ottenuti mescolando il suo id con la data. Un giocatore uscito non torna
 * per PAUSA giorni (se non c'e' nessun altro, meglio uno gia' visto che
 * niente gioco): per saperlo si rifanno le scelte dal lancio, poche
 * centinaia di giorni per poche centinaia di giocatori.
 */
export function misteroDel(giorno, players, stat) {
  const n = giorniDa(LANCIO, giorno);
  if (n < 0) return null;
  const tutti = players.filter((p) => p.isActive && !p.doppioneDi && stat.get(p.id)?.pronto)
    .map((p) => ({ p, pronto: stat.get(p.id).pronto }));
  const ultimo = new Map();
  let scelto = null;
  for (let i = 0; i <= n; i++) {
    const g = new Date(Date.parse(`${LANCIO}T12:00:00Z`) + i * 864e5).toISOString().slice(0, 10);
    const pronti = tutti.filter((c) => c.pronto < g);
    const freschi = pronti.filter((c) => !(i - (ultimo.get(c.p.id) ?? -Infinity) <= PAUSA));
    let basso = Infinity;
    scelto = null;
    for (const c of freschi.length ? freschi : pronti) {
      const h = hash(`${g}|${c.p.id}`);
      if (h < basso) { basso = h; scelto = c.p; }
    }
    if (scelto) ultimo.set(scelto.id, i);
  }
  return scelto;
}

/**
 * Gli indizi di un tentativo: per ogni voce «si» (giusto), «vicino» o «no»,
 * e per i numeri da che parte sta il giocatore misterioso («su» se e' piu'
 * alto, «giu» se e' piu' basso).
 */
export function confronta(tentativo, mistero, stat) {
  const st = (p) => stat.get(p.id) || { presenze: 0, gol: 0 };
  const num = (chiave, a, b, vicino) => ({
    chiave, valore: a, esito: a === b ? 'si' : Math.abs(a - b) <= vicino ? 'vicino' : 'no', verso: a === b ? '' : b > a ? 'su' : 'giu',
  });
  return [
    { chiave: 'squadra', valore: tentativo.clubId, esito: tentativo.clubId === mistero.clubId ? 'si' : 'no', verso: '' },
    { chiave: 'ruolo', valore: tentativo.role, esito: tentativo.role === mistero.role ? 'si' : 'no', verso: '' },
    num('eta', tentativo.age ?? 0, mistero.age ?? 0, 2),
    num('quotazione', tentativo.quotation, mistero.quotation, 3),
    num('presenze', st(tentativo).presenze, st(mistero).presenze, 1),
    num('gol', st(tentativo).gol, st(mistero).gol, 1),
  ];
}

const QUADRATO = { si: '🟩', vicino: '🟨', no: '⬛' };

/**
 * Il riquadro da condividere, alla Wordle: i colori dei tentativi e
 * nessun nome, cosi' chi lo riceve puo' ancora giocare.
 */
export function condivisione(giorno, righe, vinto) {
  const testa = `Chi è? #${numero(giorno)} · ${vinto ? `${righe.length}/${TENTATIVI}` : `X/${TENTATIVI}`}`;
  return [testa, ...righe.map((r) => r.map((x) => QUADRATO[x.esito]).join('')), 'fantatitano.site'].join('\n');
}

/**
 * La serie: quanti giorni di fila, fino a oggi (o a ieri, se oggi non si e'
 * ancora giocato), con la partita vinta.
 */
export function serie(storico, giorno) {
  if (storico[giorno] && !storico[giorno].vinto) return 0;
  let n = 0;
  let g = storico[giorno]?.vinto ? giorno : new Date(Date.parse(`${giorno}T12:00:00Z`) - 864e5).toISOString().slice(0, 10);
  while (storico[g]?.vinto) { n++; g = new Date(Date.parse(`${g}T12:00:00Z`) - 864e5).toISOString().slice(0, 10); }
  return n;
}

