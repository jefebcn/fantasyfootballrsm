/**
 * Anagrafiche e calendario della stagione.
 * 16 società e 30 giornate generate in modo deterministico: stesso seed → stessi dati.
 * Il listone è invece quello VERO, importato da Transfermarkt in src/listone-dati.js
 * (vedi scripts/importa-listone.py).
 * Le giornate 1-2 hanno anche eventi di esempio, usati solo dal Giudice Dati
 * per popolare il database la prima volta.
 */
import { DEFAULT_RULES } from './engine.js';
import { LISTONE } from './listone-dati.js';

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

  // --- Calendario reale: 30 giornate ------------------------------------
  const rr = roundRobin(CLUBS.map((c) => c.id));
  const matchdays = []; const matches = [];
  for (let n = 1; n <= 30; n++) {
    const round = rr[(n - 1) % 15].map(([a, b]) => (n > 15 ? [b, a] : [a, b]));
    const sat = new Date(SEASON_START.getTime() + (n - 1) * 7 * 86400000);
    const md = { id: `md${n}`, number: n, lockAt: sat.toISOString(), saturday: sat.toISOString() };
    matchdays.push(md);
    round.forEach(([home, away], i) => {
      const day = i < 4 ? 0 : 1; const hour = i % 2 === 0 ? 15 : 17.5;
      const kick = new Date(sat.getTime() + day * 86400000 + (hour - 15) * 3600000);
      matches.push({ id: `${md.id}_m${i + 1}`, matchdayId: md.id, matchday: n, homeClubId: home, awayClubId: away, kickoffAt: kick.toISOString(), venue: VENUES[(n + i) % VENUES.length], status: 'scheduled', homeGoals: null, awayGoals: null, videoUrl: null });
    });
  }

  // --- Lega fanta --------------------------------------------------------
  const clubOf = Object.fromEntries(CLUBS.map((c) => [c.id, c]));

  // --- Eventi delle giornate giocate ------------------------------------
  const appearances = []; const events = [];
  const playedMatchdays = 2;
  const clubPlayers = (cid) => players.filter((p) => p.clubId === cid && p.isActive);
  for (const m of matches.filter((x) => x.matchday <= playedMatchdays)) {
    if (m.id === 'md2_m5') { m.status = 'postponed'; continue; } // Folgore–Cosmos rinviata
    m.status = 'played';
    m.videoUrl = `https://titani.tv/${m.id}`;
    const sides = [[m.homeClubId, 'home'], [m.awayClubId, 'away']];
    const onPitch = {}; const goalsFor = { home: 0, away: 0 };
    for (const [cid, side] of sides) {
      const list = clubPlayers(cid);
      const byRole = (r) => list.filter((p) => p.role === r).sort((a, b) => b.quotation - a.quotation + (rnd() - 0.5) * 6);
      const starters = [...byRole('P').slice(0, 1), ...byRole('D').slice(0, 4), ...byRole('C').slice(0, 4), ...byRole('A').slice(0, 2)];
      const benchPool = list.filter((p) => !starters.includes(p) && p.role !== 'P');
      const app = new Map(starters.map((p) => [p.id, { matchId: m.id, playerId: p.id, clubId: cid, started: true, minutesPlayed: 90, enteredAt: 0 }]));
      const nSubs = between(2, 3);
      for (let s = 0; s < nSubs && benchPool.length; s++) {
        const out = pick(starters.filter((p) => p.role !== 'P' && app.get(p.id).minutesPlayed === 90));
        if (!out) break;
        const inn = benchPool.splice(Math.floor(rnd() * benchPool.length), 1)[0];
        const minute = between(55, 84);
        app.get(out.id).minutesPlayed = minute;
        app.set(inn.id, { matchId: m.id, playerId: inn.id, clubId: cid, started: false, minutesPlayed: 90 - minute, enteredAt: minute });
      }
      onPitch[side] = app;
      appearances.push(...app.values());
    }
    const strength = (cid) => clubOf[cid].strength;
    const xg = { home: 0.45 + strength(m.homeClubId) * 0.24, away: 0.45 + strength(m.awayClubId) * 0.24 };
    const atMinute = (side, minute) => [...onPitch[side].values()].filter((a) => minute >= a.enteredAt && minute <= a.enteredAt + a.minutesPlayed);
    const weightedPick = (list) => {
      const w = { A: 5, C: 3, D: 1.2, P: 0.1 };
      const tot = list.reduce((s, a) => s + w[players.find((p) => p.id === a.playerId).role], 0);
      let r = rnd() * tot;
      for (const a of list) { r -= w[players.find((p) => p.id === a.playerId).role]; if (r <= 0) return a; }
      return list[list.length - 1];
    };
    for (const side of ['home', 'away']) {
      const cid = side === 'home' ? m.homeClubId : m.awayClubId;
      const opp = side === 'home' ? 'away' : 'home';
      // gol: poisson approssimata
      let g = 0; let L = Math.exp(-xg[side]), k = 0, p = 1;
      do { k++; p *= rnd(); } while (p > L); g = Math.min(k - 1, 5);
      for (let i = 0; i < g; i++) {
        const minute = between(3, 90);
        const list = atMinute(side, minute);
        if (rnd() < 0.05) { // autogol avversario
          const og = pick(atMinute(opp, minute).filter((a) => players.find((p) => p.id === a.playerId).role !== 'P'));
          if (og) { events.push({ id: `e${events.length + 1}`, matchId: m.id, playerId: og.playerId, clubId: opp === 'home' ? m.homeClubId : m.awayClubId, minute, type: 'own_goal' }); goalsFor[side]++; continue; }
        }
        const scorer = weightedPick(list);
        events.push({ id: `e${events.length + 1}`, matchId: m.id, playerId: scorer.playerId, clubId: cid, minute, type: 'goal' });
        goalsFor[side]++;
        if (rnd() < 0.7) {
          const ass = pick(list.filter((a) => a.playerId !== scorer.playerId));
          if (ass) events.push({ id: `e${events.length + 1}`, matchId: m.id, playerId: ass.playerId, clubId: cid, minute, type: 'assist' });
        }
      }
      // cartellini
      for (const a of onPitch[side].values()) {
        if (rnd() < 0.09) {
          const minute = between(a.enteredAt + 1, a.enteredAt + a.minutesPlayed);
          events.push({ id: `e${events.length + 1}`, matchId: m.id, playerId: a.playerId, clubId: cid, minute, type: 'yellow' });
          if (rnd() < 0.08 && a.minutesPlayed === 90) {
            const m2 = between(minute + 1, 90);
            events.push({ id: `e${events.length + 1}`, matchId: m.id, playerId: a.playerId, clubId: cid, minute: m2, type: 'second_yellow' });
            a.minutesPlayed = m2;
          }
        } else if (rnd() < 0.012 && a.minutesPlayed === 90) {
          const minute = between(20, 88);
          events.push({ id: `e${events.length + 1}`, matchId: m.id, playerId: a.playerId, clubId: cid, minute, type: 'red_direct' });
          a.minutesPlayed = minute;
        }
      }
      // rigore fallito
      if (rnd() < 0.12) {
        const minute = between(10, 88);
        const taker = weightedPick(atMinute(side, minute));
        events.push({ id: `e${events.length + 1}`, matchId: m.id, playerId: taker.playerId, clubId: cid, minute, type: 'pen_missed' });
        if (rnd() < 0.5) {
          const gk = atMinute(opp, minute).find((a) => players.find((p) => p.id === a.playerId).role === 'P');
          if (gk) events.push({ id: `e${events.length + 1}`, matchId: m.id, playerId: gk.playerId, clubId: opp === 'home' ? m.homeClubId : m.awayClubId, minute, type: 'pen_saved' });
        }
      }
    }
    m.homeGoals = goalsFor.home; m.awayGoals = goalsFor.away;
  }
  events.sort((a, b) => a.minute - b.minute);

  return { season: { id: 's2026', name: '2026/27', sampleMatchdays: playedMatchdays }, clubs: CLUBS, players, matchdays, matches, appearances, events };
}
