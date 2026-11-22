/**
 * LA COPPA FANTATITANO (Alex, 21/11): una coppa fantasy che si gioca solo
 * sulle partite della Coppa Titano vera. I fantapunti di ogni turno vengono
 * dai voti delle partite di coppa (src/coppa-dati.js), mai dal campionato.
 *
 * Un turno fantasy per ogni turno vero, dai quarti in poi (Alex, 22/11: «8
 * passano, 4 gironi»):
 *   1-2  quarti di andata e ritorno veri → fase a gironi: 4 gironi (A-D), due
 *        scontri diretti a testa contro avversari diversi del girone; passano
 *        le prime 2 di ogni girone, 8 squadre;
 *   3    semifinale di andata vera → quarti fantasy, gara secca;
 *   4    semifinale di ritorno vera → semifinali fantasy, gara secca;
 *   5    finale vera → finale fantasy, gara secca.
 * Con pochi iscritti: 2 gironi da cui passano 4 (sempre 8 ai quarti), o un
 * girone solo da cui passano 4 (semifinali e finale).
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
import { presenzeDalReferto, mulberry32 } from './data.js';

export const NOME = 'Coppa Fantatitano';
export const SEME = 'coppa-fantatitano-2026';

/** I turni della coppa fantasy e il turno della Coppa Titano su cui si giocano. */
export const TURNI = [
  // nome: il turno della Coppa Titano vera; fanta: cosa si gioca da noi
  { n: 1, fsgc: 3, nome: 'Quarti di andata', fanta: 'Gironi, 1ª sfida', fase: 'gironi', tetto: 1 },
  { n: 2, fsgc: 4, nome: 'Quarti di ritorno', fanta: 'Gironi, 2ª sfida', fase: 'gironi', tetto: 1 },
  { n: 3, fsgc: 5, nome: 'Semifinali di andata', fanta: 'Quarti', fase: 'quarti', tetto: 2 },
  { n: 4, fsgc: 6, nome: 'Semifinali di ritorno', fanta: 'Semifinali', fase: 'semifinali', tetto: 2 },
  { n: 5, fsgc: 7, nome: 'Finale', fanta: 'Finale', fase: 'finale', tetto: 3 },
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

// ---------------------------------------------------------------- le squadre dell'app
/**
 * Alex, 22/11: la coppa parte con 32 squadre. Finché gli iscritti veri sono
 * meno, la completano squadre dell'app con nomi da fantacalcio inventati (mai
 * presi dalle leghe): entrano nel sorteggio, schierano a ogni turno una
 * formazione automatica valida e vanno avanti se vincono. Calano di una a ogni
 * iscrizione vera e spariscono da 32 iscritti in su. Lo dicono le regole
 * della pagina. Solo in questa coppa: leghe e classifiche non le vedono.
 */
export const SQUADRE_COPPA = 32;
const NOMI_APP = ['Real Borgo', 'Atletico Titano', 'Dynamo Montale', 'Sporting Cesta', 'Tre Torri FC', 'Inter Mezzo',
  'Olimpia Guaita', 'Deportivo Rocca', 'Racing Titanio', 'AC Piadina', 'Borussia Cassone', 'Lokomotiv Funivia',
  'Real Sangiovese', 'FC Nebbia', 'Spartak Stradone', 'Ajax Ventoso', 'Vecchie Glorie', 'Sporting Tramontana',
  'Athletic Strozzapreti', 'FC Ferragosto', 'Panchina Lunga', 'Rapid Monte', 'Calcio Sbilenco', 'Real Brodetto',
  'FC Contropiede', 'Atletico Fuorigioco', 'Dinamo Tagliatella', 'FC Zona Cesarini', 'Polisportiva Corner',
  'I Pendolari', 'FC Terzo Tempo', 'FC Catenaccio'];
const COLORI_APP = ['#4B06FC', '#C0392B', '#1E6FB5', '#2E8B57', '#D4A017', '#111111', '#E67E22', '#8E44AD', '#16A085', '#7F8C8D'];
const PREFISSO_APP = 'cf-app-';
export const eApp = (id) => typeof id === 'string' && id.startsWith(PREFISSO_APP);
/** Le squadre dell'app che servono con `reali` iscritti veri (nessuna se non c'è nessuno). */
export function squadreApp(reali) {
  const k = reali > 0 ? Math.max(0, Math.min(NOMI_APP.length, SQUADRE_COPPA - reali)) : 0;
  return Array.from({ length: k }, (_, i) => `${PREFISSO_APP}${String(i + 1).padStart(2, '0')}`);
}
/** Nome, colore e iniziali di una squadra dell'app. */
export function squadraApp(id) {
  const i = Number(id.slice(PREFISSO_APP.length)) - 1;
  const nome = NOMI_APP[i] || 'Squadra';
  return { squadra: nome, colore: COLORI_APP[i % COLORI_APP.length], iniziali: nome.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() };
}
const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
/**
 * La formazione di una squadra dell'app nel turno n, sempre la stessa su tutti
 * i telefoni: dipende solo da squadra, turno e listone (le quotazioni, che non
 * cambiano coi voti: dopo la partita non «sceglie» chi ha segnato).
 * giocatori: [{ id, role, clubId, quotation }] delle squadre in gara.
 */
export function formazioneApp(id, n, giocatori) {
  const t = turno(n); if (!t) return null;
  const rnd = mulberry32(hash(`${SEME}:${id}:${n}`));
  const tutti = [...giocatori].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const per = {}, scelti = [];
  const prendi = (ok) => {
    const lista = tutti.filter((p) => ok(p) && !scelti.includes(p) && (per[p.clubId] || 0) < t.tetto);
    if (!lista.length) return null;
    // più facile pescare i più quotati, ma non sempre gli stessi
    const pesi = lista.map((p) => Math.max(1, p.quotation || 1) ** 1.5);
    let x = rnd() * pesi.reduce((s, v) => s + v, 0), i = 0;
    while (i < lista.length - 1 && (x -= pesi[i]) > 0) i++;
    const p = lista[i]; scelti.push(p); per[p.clubId] = (per[p.clubId] || 0) + 1;
    return p;
  };
  for (const r of RUOLI_OBBLIGATI) if (!prendi((p) => p.role === r)) return null;
  if (!prendi((p) => p.role !== 'P') || !prendi((p) => p.role !== 'P')) return null;
  const titolari = scelti.slice(0, TITOLARI);
  const capitano = titolari.filter((p) => p.role !== 'P').sort((a, b) => (b.quotation || 0) - (a.quotation || 0) || (a.id < b.id ? -1 : 1))[0];
  return { titolari: titolari.map((p) => p.id), riserva: scelti[TITOLARI].id, capitano: capitano.id };
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

/**
 * Il formato secondo gli iscritti: 4 gironi da 16 in su (passano 2 a girone),
 * 2 gironi da 8 a 15 (passano 4 a girone): in tutti e due 8 squadre ai quarti.
 * Da 4 a 7 un girone solo, passano 4 alle semifinali. Sotto i 4 niente coppa.
 */
export function formato(n) {
  if (n >= 16) return { nome: 'quattro gironi', gironi: 4, passano: 2, tabellone: 8 };
  if (n >= 8) return { nome: 'due gironi', gironi: 2, passano: 4, tabellone: 8 };
  if (n >= 4) return { nome: 'un girone', gironi: 1, passano: 4, tabellone: 4 };
  return null;
}
const LETTERE = ['A', 'B', 'C', 'D'];

/**
 * Gli accoppiamenti del tabellone dai piazzamenti nei gironi (cl[k] = classifica
 * del girone k). Le prime incontrano le seconde (o le quarte) di un altro girone,
 * e due squadre dello stesso girone si possono ritrovare solo in finale.
 */
export function accoppiamenti(fmt, cl) {
  if (fmt.gironi === 4) {
    const [A, B, C, D] = cl;
    return [[A[0], B[1]], [C[0], D[1]], [B[0], A[1]], [D[0], C[1]]];
  }
  if (fmt.gironi === 2) {
    const [A, B] = cl;
    return [[A[0], B[3]], [B[1], A[2]], [B[0], A[3]], [A[1], B[2]]];
  }
  const [U] = cl;
  return [[U[0], U[3]], [U[1], U[2]]];
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
  const membri = Array.from({ length: fmt.gironi }, (_, k) => ordine.filter((_, i) => i % fmt.gironi === k));
  const nomi = fmt.gironi === 1 ? ['Unico'] : LETTERE.slice(0, fmt.gironi);
  const out = { formato: fmt, iscritti: ids.length, gironi: [], tabellone: [], campione: null, finale: null };

  // fase a gironi sui quarti veri (turni 1 e 2)
  out.gironi = membri.map((m, k) => {
    const turni = girone(m).slice(0, 2).map((coppie, i) => ({ giornata: i + 1, coppie }));
    return { nome: nomi[k], membri: m, ...classificaScontri(m, turni, punti, { mediaAlRiposo: true }) };
  });
  const gironiFiniti = [1, 2].every((n) => ids.some((id) => punti(n, id) != null));
  if (!gironiFiniti) return out;

  // tabellone a gare secche: quarti sulla semifinale vera di andata (3),
  // semifinali sul ritorno (4), finale sulla finale vera (5). Con 4 qualificate
  // (girone unico) si parte dalle semifinali.
  const cl = out.gironi.map((g) => g.classifica.map((r) => r.id));
  const posto = new Map(out.gironi.flatMap((g) => g.classifica.map((r) => [r.id, r])));
  const meglio = (a, b) => {
    const x = posto.get(a), y = posto.get(b);
    return x.posto !== y.posto ? (x.posto < y.posto ? a : b) : x.punti !== y.punti ? (x.punti > y.punti ? a : b)
      : (x.fatti - x.subiti) !== (y.fatti - y.subiti) ? ((x.fatti - x.subiti) > (y.fatti - y.subiti) ? a : b) : (x.fatti >= y.fatti ? a : b);
  };
  // gara secca; a pari fantapunti passa chi era meglio piazzato nel girone
  const gioca = (coppie, n) => coppie.map(([a, b]) => {
    const gare = [[punti(n, a), punti(n, b)]];
    const [x, y] = gare[0];
    const vincente = x != null && y != null ? (x !== y ? (x > y ? a : b) : meglio(a, b)) : null;
    return { a, b, gare, vincente };
  });
  const turni = fmt.tabellone === 8 ? [['Quarti', 3], ['Semifinali', 4], ['Finale', 5]] : [['Semifinali', 4], ['Finale', 5]];
  let coppie = accoppiamenti(fmt, cl);
  let f = null;
  for (const [nome, n] of turni) {
    const sfide = gioca(coppie, n);
    out.tabellone.push({ nome, turni: [n], sfide });
    if (sfide.some((x) => !x.vincente)) return out;
    f = sfide;
    coppie = [];
    for (let i = 0; i < sfide.length; i += 2) coppie.push([sfide[i].vincente, sfide[i + 1]?.vincente]);
  }
  out.finale = f[0];
  out.campione = f[0].vincente;
  return out;
}

/**
 * Dove sta un iscritto nella coppa: per «La tua coppa» in cima alla pagina.
 * Torna { stato: 'gironi'|'quarti'|'semifinale'|'finale'|'campione'|'fuori'|'non iscritto', ... }.
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
    const stato = { Quarti: 'quarti', Semifinali: 'semifinale', Finale: 'finale' }[t.nome];
    // vinta, e il turno dopo non c'è ancora (aspetta le altre sfide): sei già al prossimo
    if (sfida.vincente === id && stato !== 'finale') return { stato: stato === 'quarti' ? 'semifinale' : 'finale', attesa: true, girone: g, riga };
    return { stato, sfida, avversario, girone: g, riga };
  }
  const finiti = c.tabellone.length > 0;
  if (finiti) return { stato: 'fuori', dove: `Girone ${g.nome}`, girone: g, riga };
  return { stato: 'gironi', girone: g, riga };
}
