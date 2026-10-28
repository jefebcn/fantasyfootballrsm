/**
 * I dati del futsal pronti per le schermate: listone con i ruoli di gioco,
 * voti di ogni giornata, giornata corrente e chiusura delle formazioni.
 * Legge src/futsal-dati.js (scripts/importa-futsal.py) e usa il motore.
 */
import { CALENDARIO, GIOCATORI, REFERTI, GIORNATE } from './futsal-dati.js';
import { RUOLO_GIOCO, REGOLE_FUTSAL, votoGiocatore, votoPorta } from './futsal-engine.js';

export { GIORNATE, REGOLE_FUTSAL };

/** Le 15 società del futsal, con i nomi come li scrive la FSGC senza «Futsal». */
export const SQUADRE = [
  ['cailungo', 'Cailungo'], ['cosmos', 'Cosmos'], ['domagnano', 'Domagnano'], ['faetano', 'Faetano'],
  ['fiorentino', 'Fiorentino'], ['folgore', 'Folgore'], ['juvenes', 'Juvenes Dogana'], ['lafiorita', 'La Fiorita'],
  ['libertas', 'Libertas'], ['murata', 'Murata'], ['pennarossa', 'Pennarossa'], ['sangiovanni', 'San Giovanni'],
  ['trefiori', 'Tre Fiori'], ['trepenne', 'Tre Penne'], ['virtus', 'Virtus'],
].map(([id, nome]) => ({ id, nome }));
export const squadra = new Map(SQUADRE.map((s) => [s.id, s]));

export const GIOCATORI_FUTSAL = GIOCATORI.map(([id, club, nome, cognome, ruoloFsgc, numero]) => ({
  id, club, nome, cognome, ruoloFsgc, numero, ruolo: RUOLO_GIOCO[ruoloFsgc] || 'A',
}));
const perId = new Map(GIOCATORI_FUTSAL.map((g) => [g.id, g]));
export const giocatore = (id) => perId.get(id);
const clubDi = (id) => perId.get(id)?.club;
const ruoloDi = (id) => perId.get(id)?.ruoloFsgc;

export const PARTITE = CALENDARIO.map(([g, casa, ospite, quando, impianto, gc, go]) => ({ g, casa, ospite, quando, impianto, gc, go }));
const referti = (n) => REFERTI.filter((r) => r.g === n);
/** Il referto di una partita, dalla giornata e dalla squadra di casa. */
export const referto = (n, casa) => REFERTI.find((r) => r.g === n && r.casa === casa);

/** Giornate con almeno un referto. */
export const giocate = () => [...new Set(REFERTI.map((r) => r.g))].sort((a, b) => a - b);

/** La prima giornata con partite ancora da giocare (o l'ultima). */
export function giornataCorrente(ora = Date.now()) {
  for (let n = 1; n <= GIORNATE; n++) if (PARTITE.some((p) => p.g === n && p.gc === null && new Date(p.quando).getTime() > ora - 3 * 3600e3)) return n;
  return GIORNATE;
}

/** Chiusura delle formazioni: 10 minuti prima della prima partita della giornata (§ 3). */
export function chiusura(n) {
  const t = PARTITE.filter((p) => p.g === n && p.quando).map((p) => new Date(p.quando).getTime());
  return t.length ? new Date(Math.min(...t) - 10 * 60e3) : null;
}

/** Chi riposa nella giornata: con 15 squadre, una ogni volta. */
export function riposa(n) {
  const giocano = new Set(PARTITE.filter((p) => p.g === n).flatMap((p) => [p.casa, p.ospite]));
  return SQUADRE.filter((s) => !giocano.has(s.id)).map((s) => s.id);
}

/**
 * Una giornata e' finita quando ogni partita ha il referto completo, oppure e'
 * passata da piu' di tre giorni senza (rinviata, o la FSGC non l'ha mai
 * compilata): da li' chi non ha giocato prende la media, come chi riposa.
 */
export function conclusa(n, ora = Date.now()) {
  const ps = PARTITE.filter((p) => p.g === n);
  return ps.length > 0 && ps.every((p) => referto(n, p.casa) || (p.quando && new Date(p.quando).getTime() + 3 * 86400e3 < ora));
}

const cache = new Map();
const r2 = (x) => Math.round(x * 100) / 100;
/** La media dei voti veri (non quelli da riposo) prima della giornata n. */
function mediaPrima(n, chiave) {
  let somma = 0, quante = 0;
  for (let k = 1; k < n; k++) {
    const v = chiave(votiGiornata(k));
    if (v && !v.sv && !v.riposo) { somma += v.totale; quante++; }
  }
  return quante ? r2(somma / quante) : 0;
}
const daRiposo = (media) => ({ sv: false, riposo: true, base: media, bonus: 0, totale: media, voci: [{ etichetta: 'Riposa · media', valore: media }] });

/**
 * Voti di una giornata: { porta: Map club -> voto, giocatori: Map id -> voto }.
 * A giornata conclusa, chi riposa (o ha la partita rinviata) prende la media
 * delle giornate prima, con { riposo: true }: niente fascia e niente
 * variazione di quotazione (FUTSAL.md § 13.5, come Dunkest).
 */
export function votiGiornata(n) {
  if (cache.has(n)) return cache.get(n);
  const refs = referti(n);
  const porta = new Map(SQUADRE.map((s) => [s.id, votoPorta(s.id, refs, clubDi, ruoloDi)]));
  const giocatori = new Map(GIOCATORI_FUTSAL.filter((g) => g.ruolo !== 'P').map((g) => [g.id, votoGiocatore(g, refs, clubDi)]));
  const v = { porta, giocatori };
  cache.set(n, v);
  if (conclusa(n)) {
    for (const [club, x] of porta) if (x.sv) porta.set(club, daRiposo(mediaPrima(n, (w) => w.porta.get(club))));
    for (const [id, x] of giocatori) if (x.sv && x.motivo === 'la squadra non gioca') giocatori.set(id, daRiposo(mediaPrima(n, (w) => w.giocatori.get(id))));
  }
  return v;
}

/**
 * Le statistiche di ogni giocatore di movimento sulle giornate giocate:
 * presenze (in distinta), gol, autogol, ammonizioni, espulsioni, rigori
 * sbagliati, punti, media e l'andamento giornata per giornata.
 */
export function statistiche() {
  if (cache.has('st')) return cache.get('st');
  const s = new Map();
  for (const n of giocate()) {
    const { giocatori } = votiGiornata(n);
    const ev = referti(n).flatMap((r) => r.eventi);
    for (const [id, v] of giocatori) {
      const x = s.get(id) || { presenze: 0, gol: 0, autogol: 0, amm: 0, esp: 0, rs: 0, punti: 0, trend: [] };
      x.trend.push({ g: n, punti: v.sv ? null : v.totale, riposo: !!v.riposo });
      if (!v.sv && !v.riposo) {
        x.presenze++; x.punti = r2(x.punti + v.totale);
        for (const e of ev) if (e[0] === id) x[{ goal: 'gol', own_goal: 'autogol', yellow: 'amm', red: 'esp', pen_missed: 'rs' }[e[2]]] += 1;
      }
      s.set(id, x);
    }
  }
  for (const x of s.values()) { x.media = x.presenze ? r2(x.punti / x.presenze) : 0; delete x.undefined; }
  cache.set('st', s);
  return s;
}

/** Lo stesso per le porte: partite, punti, gol subiti, porte inviolate, vinte/pari/perse. */
export function statistichePorte() {
  if (cache.has('sp')) return cache.get('sp');
  const s = new Map(SQUADRE.map((q) => [q.id, { partite: 0, punti: 0, subiti: 0, inviolate: 0, v: 0, n: 0, p: 0, trend: [] }]));
  for (const n of giocate()) {
    for (const [club, v] of votiGiornata(n).porta) {
      const x = s.get(club);
      x.trend.push({ g: n, punti: v.sv ? null : v.totale, riposo: !!v.riposo });
      if (v.sv || v.riposo) continue;
      x.partite++; x.punti = r2(x.punti + v.totale);
      const gs = v.voci.find((y) => /Gol subiti/.test(y.etichetta));
      x.subiti += gs ? Number(gs.etichetta.split('× ')[1]) : 0;
      if (!gs) x.inviolate++;
      const esito = v.voci[1]?.etichetta || '';
      if (/vittoria/.test(esito)) x.v++; else if (/sconfitta/.test(esito)) x.p++; else x.n++;
    }
  }
  for (const x of s.values()) x.media = x.partite ? r2(x.punti / x.partite) : 0;
  cache.set('sp', s);
  return s;
}

/**
 * La classifica vera del campionato, dai risultati del calendario FSGC, e
 * quanti fantapunti a partita lasciano agli avversari per ruolo (la «difesa
 * contro ruolo» delle statistiche di Dunkest).
 */
export function classificaReale() {
  const t = new Map(SQUADRE.map((q) => [q.id, { id: q.id, g: 0, v: 0, n: 0, p: 0, gf: 0, gs: 0, punti: 0, concessi: { D: [], A: [] } }]));
  for (const p of PARTITE) {
    if (p.gc == null || p.go == null) continue;
    const c = t.get(p.casa), o = t.get(p.ospite);
    if (!c || !o) continue;
    c.g++; o.g++; c.gf += p.gc; c.gs += p.go; o.gf += p.go; o.gs += p.gc;
    if (p.gc > p.go) { c.v++; o.p++; c.punti += 3; } else if (p.gc < p.go) { o.v++; c.p++; o.punti += 3; } else { c.n++; o.n++; c.punti++; o.punti++; }
    const ref = referto(p.g, p.casa);
    if (!ref) continue;
    const v = votiGiornata(p.g).giocatori;
    ref.distinte.forEach((ids, lato) => {
      const contro = lato === 0 ? o : c;
      for (const id of ids) { const g = perId.get(id), x = v.get(id); if (g && g.ruolo !== 'P' && x && !x.sv) contro.concessi[g.ruolo].push(x.totale); }
    });
  }
  const media = (a) => (a.length ? r2(a.reduce((x, y) => x + y, 0) / a.length) : 0);
  return [...t.values()].map((x) => ({ ...x, dr: x.gf - x.gs, controD: media(x.concessi.D), controA: media(x.concessi.A) }))
    .sort((a, b) => b.punti - a.punti || b.dr - a.dr || b.gf - a.gf);
}

/** Le prossime partite di un club dopo la giornata n (compresa). */
export const prossime = (club, n, quante = 5) => PARTITE.filter((p) => p.g >= n && (p.casa === club || p.ospite === club)).slice(0, quante);
