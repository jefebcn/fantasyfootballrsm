/**
 * LA COPPA FANTATITANO (Alex, 21/11): una coppa fantasy che si gioca solo
 * sulle partite della Coppa Titano vera. I fantapunti di ogni turno vengono
 * dai voti delle partite di coppa (src/coppa-dati.js), mai dal campionato.
 *
 * Un turno fantasy per ogni turno vero, dai quarti in poi:
 *   1-2  quarti di andata e ritorno → fase a gironi: due gironi grandi (A e B),
 *        due scontri diretti a testa contro avversari diversi del girone;
 *   3-4  semifinali di andata e ritorno → semifinali A1–B2 e B1–A2, conta la somma;
 *   5    finale → finale secca.
 * Struttura e regole sono quelle della Coppa Titano del futsal
 * (src/futsal-gare.js, FUTSAL.md § 10.2): 3 punti a chi fa di più, 1 a testa in
 * parità; a pari punti differenza fra fantapunti fatti e subiti, poi fatti;
 * sorteggio ripetibile, uguale su tutti i telefoni.
 *
 * LA FORMAZIONE DI COPPA è a parte e gratis: 5 titolari (un portiere, un
 * difensore, un centrocampista, un attaccante e un quinto di qualunque ruolo)
 * più una riserva, scelti fra i giocatori delle squadre ancora in coppa, con
 * un tetto per squadra vera (1 ai quarti, 2 in semifinale, 3 in finale). Il
 * capitano vale doppio. Così chi ha in rosa giocatori di squadre eliminate non
 * parte svantaggiato. La riserva prende il posto del primo titolare senza voto.
 *
 * Funzioni pure: tutto quello che serve entra dagli argomenti.
 */
import { girone, classificaScontri, mescola } from './futsal-gare.js';
import { computeRating, DEFAULT_RULES } from './engine.js';
import { presenzeDalReferto } from './data.js';

export const NOME = 'Coppa Fantatitano';
export const SEME = 'coppa-fantatitano-2026';

/** I turni della coppa fantasy e il turno della Coppa Titano su cui si giocano. */
export const TURNI = [
  { n: 1, fsgc: 3, nome: 'Quarti di andata', fase: 'gironi', tetto: 1 },
  { n: 2, fsgc: 4, nome: 'Quarti di ritorno', fase: 'gironi', tetto: 1 },
  { n: 3, fsgc: 5, nome: 'Semifinali di andata', fase: 'semifinali', tetto: 2 },
  { n: 4, fsgc: 6, nome: 'Semifinali di ritorno', fase: 'semifinali', tetto: 2 },
  { n: 5, fsgc: 7, nome: 'Finale', fase: 'finale', tetto: 3 },
];
export const turno = (n) => TURNI.find((t) => t.n === n) || null;
export const TITOLARI = 5;
export const RUOLI_OBBLIGATI = ['P', 'D', 'C', 'A'];

// ---------------------------------------------------------------- calendario vero

/** Le partite vere di un turno: righe di COPPA_CALENDARIO. */
export function partiteDelTurno(calendario, n) {
  const t = turno(n);
  return t ? calendario.filter((r) => r[0] === t.fsgc) : [];
}
/** Le squadre vere in campo nel turno (vuoto se la FSGC non l'ha ancora messo in calendario). */
export function squadreInGara(calendario, n) {
  return [...new Set(partiteDelTurno(calendario, n).flatMap((r) => [r[1], r[2]]))];
}
/** Il calcio d'inizio della prima partita del turno: lì si chiude la formazione. */
export function chiusuraTurno(calendario, n) {
  const ore = partiteDelTurno(calendario, n).map((r) => r[3]).filter(Boolean).sort();
  return ore[0] ? new Date(ore[0]) : null;
}
/** Il turno su cui si schiera adesso: il primo che non è ancora chiuso e ha il calendario. */
export function turnoAperto(calendario, ora = Date.now()) {
  return TURNI.find((t) => { const c = chiusuraTurno(calendario, t.n); return c && c.getTime() > ora; }) || null;
}

// ---------------------------------------------------------------- formazione

/**
 * Controlla una formazione di coppa. f: { titolari: [5 id], riserva: id, capitano: id }.
 * giocatore(id) → { role, clubId } o undefined. Torna il motivo del rifiuto, o null se va bene.
 */
export function validaFormazione(f, n, giocatore, squadre) {
  const t = turno(n);
  if (!t) return 'Turno sconosciuto';
  const tit = (f?.titolari || []).filter(Boolean);
  if (tit.length !== TITOLARI) return `Servono ${TITOLARI} titolari`;
  if (!f.riserva) return 'Manca la riserva';
  const tutti = [...tit, f.riserva];
  if (new Set(tutti).size !== tutti.length) return 'Un giocatore è scelto due volte';
  const gs = tutti.map(giocatore);
  if (gs.some((g) => !g)) return 'Giocatore sconosciuto';
  const fuori = gs.find((g) => !squadre.includes(g.clubId));
  if (fuori) return 'C\'è un giocatore di una squadra che non gioca questo turno';
  const per = {};
  for (const g of gs) per[g.clubId] = (per[g.clubId] || 0) + 1;
  if (Object.values(per).some((x) => x > t.tetto)) return `Al massimo ${t.tetto} ${t.tetto === 1 ? 'giocatore' : 'giocatori'} per squadra`;
  const ruoli = tit.map((id) => giocatore(id).role);
  for (const r of RUOLI_OBBLIGATI) if (!ruoli.includes(r)) return `Manca ${{ P: 'il portiere', D: 'il difensore', C: 'il centrocampista', A: 'l\'attaccante' }[r]}`;
  if (ruoli.filter((r) => r === 'P').length > 1) return 'Un portiere solo fra i titolari';
  if (!tit.includes(f.capitano)) return 'Il capitano è uno dei titolari';
  return null;
}

// ---------------------------------------------------------------- voti e punteggio

/**
 * I voti di un turno, dai tabellini della Coppa Titano: Map id → computeRating.
 * Null se nessuna partita del turno ha ancora il tabellino.
 */
export function votiDelTurno({ calendario, referti, giocatore, n, rules = DEFAULT_RULES }) {
  const t = turno(n); if (!t) return null;
  const voti = new Map();
  let partite = 0;
  for (const [g, casa, ospite, , , gc, go] of partiteDelTurno(calendario, n)) {
    const r = referti.find((x) => x.g === g && x.casa === casa && x.ospite === ospite);
    if (!r || gc == null) continue;
    partite++;
    const m = { id: `coppa-${g}-${casa}-${ospite}`, homeClubId: casa, awayClubId: ospite, homeGoals: gc, awayGoals: go, status: 'played' };
    const { appearances, events } = presenzeDalReferto(r, m);
    for (const a of appearances) {
      const player = giocatore(a.playerId); if (!player) continue;
      voti.set(a.playerId, computeRating({ player: { ...player, id: a.playerId }, appearance: a, events, match: m, rules }));
    }
  }
  return partite ? voti : null;
}

/** Un turno è concluso quando tutte le sue partite vere hanno risultato e tabellino. */
export function turnoConcluso(calendario, referti, n) {
  const p = partiteDelTurno(calendario, n);
  return p.length > 0 && p.every(([g, casa, ospite, , , gc]) => gc != null && referti.some((x) => x.g === g && x.casa === casa && x.ospite === ospite));
}

/** Le squadre vere che hanno gia' giocato il turno (hanno il tabellino). */
export function squadreGiocate(calendario, referti, n) {
  return partiteDelTurno(calendario, n)
    .filter(([g, casa, ospite, , , gc]) => gc != null && referti.some((x) => x.g === g && x.casa === casa && x.ospite === ospite))
    .flatMap((r) => [r[1], r[2]]);
}

/**
 * Il punteggio di una formazione di coppa: somma dei fantavoti dei titolari,
 * il capitano doppio; la riserva entra al posto del primo titolare senza voto
 * (chi non gioca non ha voto: vale 0, come in campionato).
 * Torna { totale, righe: [{ id, voto, capitano, riserva, fuori }] }.
 */
export function punteggio(f, voti, rules = DEFAULT_RULES) {
  const v = (id) => { const x = voti?.get(id); return x && !x.isSV ? x.fantaVote : null; };
  const tit = (f?.titolari || []).filter(Boolean);
  const senza = tit.find((id) => v(id) == null);
  const entra = senza && v(f.riserva) != null ? f.riserva : null;
  const righe = tit.map((id) => ({ id, voto: v(id), capitano: id === f.capitano, fuori: id === senza && !!entra }));
  if (entra) righe.push({ id: entra, voto: v(entra), riserva: true });
  const totale = righe.filter((r) => !r.fuori).reduce((s, r) => s + (r.voto || 0) * (r.capitano ? rules.captainMultiplier : 1), 0);
  return { totale: Math.round(totale * 100) / 100, righe };
}

// ---------------------------------------------------------------- la coppa

/** Il formato secondo gli iscritti: due gironi da 8 in su, uno solo da 4 a 7, niente coppa sotto i 4. */
export function formato(n) {
  if (n >= 8) return { nome: 'due gironi', gironi: 2, passano: 2 };
  if (n >= 4) return { nome: 'un girone', gironi: 1, passano: 4 };
  return null;
}

/**
 * La coppa intera, fin dove i punteggi la fanno arrivare.
 * ids: gli iscritti (chi ha consegnato la formazione del primo turno).
 * punti(n, id): fantapunti di quell'iscritto nel turno n, 0 se non ha
 * consegnato, null se il turno non ha ancora punteggi.
 */
export function coppaFantatitano(ids, punti, seme = SEME) {
  const fmt = formato(ids.length);
  if (!fmt) return { formato: null, iscritti: ids.length };
  const ordine = mescola([...ids].sort(), seme);
  const membri = fmt.gironi === 2 ? [ordine.filter((_, i) => i % 2 === 0), ordine.filter((_, i) => i % 2 === 1)] : [ordine];
  const nomi = fmt.gironi === 2 ? ['A', 'B'] : ['Unico'];
  const out = { formato: fmt, iscritti: ids.length, gironi: [], tabellone: [], campione: null, finale: null };

  // fase a gironi sui quarti veri (turni 1 e 2)
  out.gironi = membri.map((m, k) => {
    const turni = girone(m).slice(0, 2).map((coppie, i) => ({ giornata: i + 1, coppie }));
    return { nome: nomi[k], membri: m, ...classificaScontri(m, turni, punti, { mediaAlRiposo: true }) };
  });
  const gironiFiniti = [1, 2].every((n) => ids.some((id) => punti(n, id) != null));
  if (!gironiFiniti) return out;

  // semifinali A1–B2, B1–A2 (con un girone solo: 1–4, 2–3)
  const cl = out.gironi.map((g) => g.classifica.map((r) => r.id));
  const semi = fmt.gironi === 2 ? [[cl[0][0], cl[1][1]], [cl[1][0], cl[0][1]]] : [[cl[0][0], cl[0][3]], [cl[0][1], cl[0][2]]];
  const posto = new Map(out.gironi.flatMap((g) => g.classifica.map((r) => [r.id, r])));
  const meglio = (a, b) => {
    const x = posto.get(a), y = posto.get(b);
    return x.posto !== y.posto ? (x.posto < y.posto ? a : b) : x.punti !== y.punti ? (x.punti > y.punti ? a : b)
      : (x.fatti - x.subiti) !== (y.fatti - y.subiti) ? ((x.fatti - x.subiti) > (y.fatti - y.subiti) ? a : b) : (x.fatti >= y.fatti ? a : b);
  };
  const gioca = (coppie, turni) => coppie.map(([a, b]) => {
    const gare = turni.map((n) => [punti(n, a), punti(n, b)]);
    let vincente = null;
    if (gare.every(([x, y]) => x != null && y != null)) {
      const ta = gare.reduce((s, x) => s + x[0], 0), tb = gare.reduce((s, x) => s + x[1], 0);
      const [ra, rb] = gare.at(-1);
      vincente = ta !== tb ? (ta > tb ? a : b) : ra !== rb ? (ra > rb ? a : b) : meglio(a, b);
    }
    return { a, b, gare, vincente };
  });
  const s = gioca(semi, [3, 4]);
  out.tabellone.push({ nome: 'Semifinali', turni: [3, 4], sfide: s });
  if (s.some((x) => !x.vincente)) return out;
  const f = gioca([[s[0].vincente, s[1].vincente]], [5]);
  out.tabellone.push({ nome: 'Finale', turni: [5], sfide: f });
  out.finale = f[0];
  out.campione = f[0].vincente;
  return out;
}

/**
 * Dove sta un iscritto nella coppa: per «La tua coppa» in cima alla pagina.
 * Torna { stato: 'gironi'|'semifinale'|'finale'|'campione'|'fuori'|'non iscritto', ... }.
 */
export function dovesei(c, id) {
  if (!c?.formato) return { stato: 'nessuna coppa' };
  const g = c.gironi.find((x) => x.membri.includes(id));
  if (!g) return { stato: 'non iscritto' };
  const riga = g.classifica.find((r) => r.id === id);
  if (c.campione === id) return { stato: 'campione', girone: g, riga };
  for (let i = c.tabellone.length - 1; i >= 0; i--) {
    const t = c.tabellone[i];
    const sfida = t.sfide.find((x) => x.a === id || x.b === id);
    if (!sfida) continue;
    const avversario = sfida.a === id ? sfida.b : sfida.a;
    if (sfida.vincente && sfida.vincente !== id) return { stato: 'fuori', dove: t.nome, avversario, sfida, girone: g, riga };
    return { stato: t.nome === 'Finale' ? 'finale' : 'semifinale', sfida, avversario, girone: g, riga };
  }
  const finiti = c.tabellone.length > 0;
  if (finiti) return { stato: 'fuori', dove: `Girone ${g.nome}`, girone: g, riga };
  return { stato: 'gironi', girone: g, riga };
}
