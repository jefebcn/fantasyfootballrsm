/**
 * Anagrafiche e calendario della stagione.
 * Tutto reale: il listone da Transfermarkt (src/listone-dati.js), integrato
 * con chi gioca ma lì non compare (src/listone-extra.js); calendario, stadi,
 * risultati, formazioni ed eventi dalla FSGC (src/calendario-dati.js e
 * src/eventi-dati.js). Vedi scripts/importa-fsgc.py.
 * Le giornate 1-2 hanno anche eventi di esempio, usati solo dal Giudice Dati
 * per popolare il database la prima volta.
 */
import { DEFAULT_RULES } from './engine.js';
import { LISTONE } from './listone-dati.js';
import { CALENDARIO, GIORNATE } from './calendario-dati.js';
import { LISTONE_EXTRA } from './listone-extra.js';
import { REFERTI } from './eventi-dati.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const CLUBS = [
  { id: 'trefiori', name: 'Tre Fiori', shortName: 'TFI', color: '#D4A017', strength: 5 },
  { id: 'lafiorita', name: 'La Fiorita', shortName: 'FIO', color: '#1E6FB5', strength: 5 },
  { id: 'virtus', name: 'Virtus', shortName: 'VIR', color: '#2E8B57', strength: 5 },
  { id: 'trepenne', name: 'Tre Penne', shortName: 'TPE', color: '#3B8ED0', strength: 4 },
  { id: 'folgore', name: 'Folgore', shortName: 'FOL', color: '#E0B400', strength: 4 },
  { id: 'cosmos', name: 'Cosmos', shortName: 'COS', color: '#1D4F8A', strength: 4 },
  { id: 'murata', name: 'Murata', shortName: 'MUR', color: '#222222', strength: 3 },
  { id: 'libertas', name: 'Libertas', shortName: 'LIB', color: '#7A1F3D', strength: 3 },
  { id: 'juvenes', name: 'Juvenes/Dogana', shortName: 'JUV', color: '#1D4F8A', strength: 3 },
  { id: 'fiorentino', name: 'Fiorentino', shortName: 'FRT', color: '#C0392B', strength: 3 },
  { id: 'faetano', name: 'Faetano', shortName: 'FAE', color: '#6B2D8F', strength: 2 },
  { id: 'domagnano', name: 'Domagnano', shortName: 'DOM', color: '#8A1D1D', strength: 3 },
  { id: 'pennarossa', name: 'Pennarossa', shortName: 'PEN', color: '#B03A2E', strength: 2 },
  { id: 'cailungo', name: 'Cailungo', shortName: 'CAI', color: '#2C7A7B', strength: 2 },
  { id: 'sangiovanni', name: 'San Giovanni', shortName: 'SGV', color: '#5B3FA6', strength: 2 },
  { id: 'academy', name: 'SM Academy U22', shortName: 'ACA', color: '#3AA6E0', strength: 2 },
];

export const VENUES = ['Acquaviva', 'Serravalle', 'Domagnano', 'Montecchio', 'Dogana', 'Faetano', 'Fiorentino'];

const FIRST = ['Alessandro', 'Marco', 'Luca', 'Matteo', 'Andrea', 'Davide', 'Simone', 'Nicola', 'Filippo', 'Lorenzo', 'Tommaso', 'Giacomo', 'Federico', 'Mattia', 'Michele', 'Riccardo', 'Elia', 'Samuele', 'Enrico', 'Giovanni', 'Fabio', 'Manuel', 'Cristian', 'Alex', 'Nicolò', 'Gabriele', 'Diego', 'Kevin', 'Thomas', 'Pietro'];
const LAST = ['Gasperoni', 'Benedettini', 'Zafferani', 'Marchetti', 'Battistini', 'Righi', 'Ceccoli', 'Simoncini', 'Grandoni', 'Tomassini', 'Dolcini', 'Muccioli', 'Casadei', 'Berardi', 'Mularoni', 'Pasolini', 'Valentini', 'Bonifazi', 'Lazzari', 'Ugolini', 'Moretti', 'Bonini', 'Fabbri', 'Cecchetti', 'Giardi', 'Semprini', 'Guidi', 'Nanni', 'Zonzini', 'Zavoli', 'Rossi', 'Conti', 'Mancini', 'Pini', 'Stefanelli', 'Ferraro', 'Bollini', 'Toccaceli', 'Vitaioli', 'Palazzi', 'Selva', 'Michelotti', 'Della Valle', 'Giulianelli', 'Bugli', 'Cervellini', 'Belloni', 'Amati', 'Capicchioni', 'Forcellini', 'Francini', 'Gatti', 'Lonfernini', 'Maiani', 'Nicolini', 'Pelliccioni', 'Raschi', 'Renzi', 'Santi', 'Tamagnini', 'Ugolini', 'Venturini', 'Zonzini', 'Ercolani', 'Frisoni', 'Giardi', 'Innocenti', 'Manzaroli', 'Mazza', 'Morri', 'Paolini', 'Podeschi', 'Ricci', 'Sartini', 'Tosi', 'Valli'];

export const SEASON_START = new Date('2026-09-05T15:00:00+02:00'); // sabato della 1ª giornata

/** Scarto di Roma dall'UTC, in ore, nell'istante dato: 2 d'estate, 1 d'inverno. */
function scartoRoma(t) {
  const s = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Rome', timeZoneName: 'longOffset' }).format(t);
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(s);
  return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) + Number(m[3]) / 60) : 1;
}
/**
 * L'istante in cui a Roma sono le `ora` del giorno in cui cade `t`.
 *
 * Serve perche' il lock e' un dato che finisce sul server e regola i permessi:
 * deve essere lo stesso per tutti. Con setHours() sarebbero state le 15:00 del
 * fuso di chi apriva l'app — le 15:00 a Londra sono le 16:00 a Roma — e il
 * calendario dipendeva da dove ti trovavi. Le partite si giocano in Italia,
 * quindi l'orario e' quello italiano e basta.
 */
export function oraItaliana(t, ora = 15) {
  const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(t).split('-').map(Number);
  // Roma e' a +1 o a +2: si prova, e si tiene quella coerente con se stessa.
  for (const off of [2, 1]) {
    const cand = new Date(Date.UTC(d[0], d[1] - 1, d[2], ora - off));
    if (Math.abs(scartoRoma(cand) - off) < 0.01) return cand;
  }
  return new Date(Date.UTC(d[0], d[1] - 1, d[2], ora - 1));
}

/** Round robin (algoritmo del cerchio). Ritorna round[] di coppie [a,b]. */
export function roundRobin(ids) {
  const n = ids.length; const list = [...ids]; const rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) {
      const a = list[i], b = list[n - 1 - i];
      pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    list.splice(1, 0, list.pop());
  }
  return rounds;
}

/**
 * Draft a serpentina per quotazione con rumore (placeholder dell'asta, art. 3.1).
 * Ritorna { managerId: [{ playerId, pricePaid }] } con rose 3P/8D/8C/6A entro il budget.
 */
export function draftRosters(managerIds, players, rnd = mulberry32(7)) {
  const between = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const remaining = players.filter((p) => p.isActive).map((p) => ({ p, v: p.quotation * (0.85 + rnd() * 0.3) })).sort((a, b) => b.v - a.v);
  const rosters = Object.fromEntries(managerIds.map((id) => [id, []]));
  const need = Object.fromEntries(managerIds.map((id) => [id, { ...DEFAULT_RULES.roster }]));
  let dir = 1;
  for (let round = 0; round < 25; round++) {
    const seq = dir === 1 ? managerIds : [...managerIds].reverse();
    for (const mid of seq) {
      const i = remaining.findIndex(({ p }) => need[mid][p.role] > 0);
      if (i < 0) continue;
      const { p } = remaining.splice(i, 1)[0];
      rosters[mid].push({ playerId: p.id, pricePaid: Math.max(1, Math.round(p.quotation * (0.45 + rnd() * 0.6))) });
      need[mid][p.role]--;
    }
    dir *= -1;
  }
  for (const mid of managerIds) {
    const spent = rosters[mid].reduce((s, r) => s + r.pricePaid, 0);
    const target = DEFAULT_RULES.budget - between(4, 30);
    if (spent > target) { const k = target / spent; for (const r of rosters[mid]) r.pricePaid = Math.max(1, Math.floor(r.pricePaid * k)); }
  }
  return rosters;
}

export function buildSeason(seed = 20262027) {
  const rnd = mulberry32(seed);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const between = (a, b) => a + Math.floor(rnd() * (b - a + 1));

  // --- Listone (reale, da src/listone-dati.js) ----------------------------
  // Omonimi veri esistono (fratelli, cugini): l'id tiene il progressivo per
  // società, così due "Gasperoni M." restano due tesserati distinti.
  const perClub = {};
  const players = LISTONE.map(([clubId, firstName, lastName, role, quotation, age]) => {
    const idx = (perClub[clubId] = (perClub[clubId] || 0) + 1);
    return { id: `${clubId}_${idx}`, firstName, lastName, name: `${lastName} ${firstName[0]}.`,
      clubId, role, quotation, age, isActive: true };
  });
  // Chi gioca davvero ma su Transfermarkt non c'è: quotazione minima di ruolo,
  // non avendo un valore di mercato su cui basarla.
  const QUOT_MIN = { P: 6, D: 5, C: 5, A: 6 };
  for (const [clubId, firstName, lastName, role] of LISTONE_EXTRA) {
    const idx = (perClub[clubId] = (perClub[clubId] || 0) + 1);
    players.push({ id: `${clubId}_${idx}`, firstName, lastName, name: `${lastName} ${firstName[0]}.`,
      clubId, role, quotation: QUOT_MIN[role] ?? 5, age: null, isActive: true, daFsgc: true });
  }

  // Omonimi veri: la Folgore ha due Garcia Rufer, Azael e Augusto, che
  // abbreviati sarebbero entrambi «Rufer A.». Dove il cognome con la sola
  // iniziale non basta, l'iniziale si allunga finché i due si distinguono.
  {
    const perNome = {};
    for (const p of players) (perNome[`${p.clubId}|${p.name}`] ||= []).push(p);
    for (const gruppo of Object.values(perNome)) {
      if (gruppo.length < 2) continue;
      for (let n = 2; n <= 12; n++) {
        const prova = gruppo.map((p) => `${p.lastName} ${p.firstName.slice(0, n)}.`);
        if (new Set(prova).size === gruppo.length) { gruppo.forEach((p, i) => { p.name = prova[i]; }); break; }
        if (n === 12) gruppo.forEach((p) => { p.name = `${p.lastName} ${p.firstName}`; });
      }
    }
  }

  // --- Calendario vero della FSGC -----------------------------------------
  // Il lock resta il sabato della giornata: è la regola della lega (art. 8.3),
  // non dipende dall'orario vero della prima partita.
  const matchdays = []; const matches = [];
  let ultimoNoto = null; let ultimoN = 0;   // ultima giornata con un orario vero
  const perGiornata = {};
  for (const riga of CALENDARIO) (perGiornata[riga[0]] ||= []).push(riga);
  for (let n = 1; n <= GIORNATE; n++) {
    const righe = perGiornata[n] || [];
    // La FSGC pubblica gli orari solo per le giornate imminenti: 208 partite su
    // 240 hanno la data a null. Prima si faceva il minimo anche sui nulli, che
    // vale ZERO, cioe' il 1° gennaio 1970: da li' in poi ogni giornata aveva il
    // lock nel passato, risultava "in corso" e la formazione restava bloccata
    // per sempre. Quando gli orari non ci sono si torna al sabato della
    // settimana, che e' il ritmo del campionato.
    const orari = righe.map((r) => +new Date(r[3])).filter((t) => Number.isFinite(t) && t > 0);
    // Dove l'orario manca si prosegue dall'ultima giornata che ce l'aveva, una
    // settimana per giornata: e' il ritmo del campionato, e resta piu' vicino
    // al vero che ripartire dall'inizio stagione.
    const primo = orari.length ? new Date(Math.min(...orari))
      : new Date((ultimoNoto ?? SEASON_START.getTime()) + (n - ultimoN) * 7 * 86400000);
    const sat = oraItaliana(primo, 15);
    if (orari.length) { ultimoNoto = +sat; ultimoN = n; }
    const md = { id: `md${n}`, number: n, lockAt: sat.toISOString(), saturday: sat.toISOString() };
    matchdays.push(md);
    righe.forEach(([, home, away, iso, venue, gc, go], i) => {
      matches.push({ id: `${md.id}_m${i + 1}`, matchdayId: md.id, matchday: n, homeClubId: home, awayClubId: away,
        kickoffAt: iso, venue, videoUrl: null,
        // Risultato vero del campionato: è un fatto, indipendente dal nostro database.
        // Il Giudice Dati può comunque sovrascriverlo (match_overrides).
        realStatus: gc === null ? 'scheduled' : 'played', realHomeGoals: gc, realAwayGoals: go,
        status: gc === null ? 'scheduled' : 'played', homeGoals: gc, awayGoals: go });
    });
  }

  // --- Lega fanta --------------------------------------------------------
  const clubOf = Object.fromEntries(CLUBS.map((c) => [c.id, c]));

  // --- Eventi delle giornate giocate ------------------------------------
  // Presenze ed eventi VERI, dai referti (src/eventi-dati.js): marcatori,
  // assist, cartellini, sostituzioni e undici iniziali. Le partite senza
  // referto restano da giocare.
  const appearances = []; const events = [];
  const refPerPartita = new Map(REFERTI.map((r) => [`${r.g}:${r.casa}:${r.ospite}`, r]));
  let idEvento = 0;
  for (const m of matches) {
    const r = refPerPartita.get(`${m.matchday}:${m.homeClubId}:${m.awayClubId}`);
    if (!r) continue;
    if (r.campo) m.venue = r.campo;
    m.referee = r.arbitro || null;

    // Chi è uscito, e quando: serve sia per i minuti dei titolari sia per
    // capire da quando è in campo chi è entrato.
    const uscitoAl = new Map(); const entratoAl = new Map();
    for (const [dentro, fuori, min] of r.cambi) {
      const q = Math.min(90, Math.max(1, min));
      uscitoAl.set(fuori, q); entratoAl.set(dentro, q);
    }
    const squadraDi = (pid) => (pid.startsWith(`${m.homeClubId}_`) ? m.homeClubId : m.awayClubId);
    const visti = new Set();
    (r.titolari || []).flat().forEach((pid) => {
      if (visti.has(pid)) return; visti.add(pid);
      appearances.push({ matchId: m.id, playerId: pid, clubId: squadraDi(pid), started: true,
        minutesPlayed: uscitoAl.get(pid) ?? 90, enteredAt: 0 });
    });
    for (const [dentro] of r.cambi.map((c) => [c[0]])) {
      if (visti.has(dentro)) continue; visti.add(dentro);
      const da = entratoAl.get(dentro) ?? 90;
      appearances.push({ matchId: m.id, playerId: dentro, clubId: squadraDi(dentro), started: false,
        minutesPlayed: Math.max(0, 90 - da), enteredAt: da });
    }
    for (const [pid, min, tipo] of r.eventi) {
      events.push({ id: `e${++idEvento}`, matchId: m.id, playerId: pid, clubId: squadraDi(pid),
        minute: min, type: tipo });
    }
  }
  events.sort((a, b) => a.minute - b.minute);

  return { season: { id: 's2026', name: '2026/27', sampleMatchdays: 0 }, clubs: CLUBS, players, matchdays, matches, appearances, events };
}
