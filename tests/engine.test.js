import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeRating, computeLineupResult, computeStandings, toGoals, validateLineup, defaultLineup, DEFAULT_RULES, movimenti, recordLega, testaATesta, esitoScontro, classificaPunti, premiAssegnati } from '../src/engine.js';

const P = (id, role, clubId = 'home') => ({ id, role, clubId, quotation: 10 });
const match = (o = {}) => ({ id: 'm1', homeClubId: 'home', awayClubId: 'away', homeGoals: 1, awayGoals: 0, status: 'played', ...o });
const app = (o = {}) => ({ started: true, minutesPlayed: 90, ...o });
const ev = (playerId, type, minute = 30, clubId = 'home') => ({ playerId, type, minute, clubId });
const rate = (player, appearance, events = [], m = match()) => computeRating({ player, appearance, events, match: m });

test('voto base 6,0 + esito vittoria +0,5 con 90 minuti', () => {
  const r = rate(P('a', 'C'), app());
  assert.equal(r.isSV, false); assert.equal(r.baseVote, 6.5); assert.equal(r.fantaVote, 6.5);
});
test('esito collettivo pesato 0,5 tra 20 e 59 minuti', () => {
  assert.equal(rate(P('a', 'C'), app({ minutesPlayed: 45 })).baseVote, 6.25);
  assert.equal(rate(P('a', 'C', 'away'), app({ minutesPlayed: 45 })).baseVote, 5.75);
});
test('S.V.: non entrato, <20 minuti senza eventi; <20 minuti con evento vale', () => {
  assert.equal(rate(P('a', 'C'), null).isSV, true);
  assert.equal(rate(P('a', 'C'), app({ started: false, minutesPlayed: 10 })).isSV, true);
  const r = rate(P('a', 'A'), app({ started: false, minutesPlayed: 10 }), [ev('a', 'goal', 85)]);
  assert.equal(r.isSV, false); assert.equal(r.fantaVote, 9.25); // 6 + 0,25 (vittoria, <60') + 3
});
test('gol pesato per ruolo', () => {
  const m = match({ homeGoals: 2, awayGoals: 1 }); // gol subito: niente porta inviolata
  assert.equal(rate(P('a', 'P'), app(), [ev('a', 'goal'), ev('x', 'goal', 50, 'away')], m).bonus, 5); // +6 gol −1 subito
  assert.equal(rate(P('a', 'D'), app(), [ev('a', 'goal')], m).bonus, 4);
  assert.equal(rate(P('a', 'C'), app(), [ev('a', 'goal')], m).bonus, 3.5);
  assert.equal(rate(P('a', 'A'), app(), [ev('a', 'goal')], m).bonus, 3);
});
test('porta inviolata: risultato finale, minimo 60 minuti (art. 7.5)', () => {
  assert.equal(rate(P('a', 'D'), app({ minutesPlayed: 60 })).bonus, 1.5);
  assert.equal(rate(P('a', 'D'), app({ minutesPlayed: 59 })).bonus, 0);
  assert.equal(rate(P('a', 'D'), app(), [], match({ awayGoals: 1, homeGoals: 2 })).bonus, 0);
  assert.equal(rate(P('a', 'P'), app()).bonus, 3);
  assert.equal(rate(P('a', 'C'), app()).bonus, 0);
});
test('cambio portiere: gol subito solo a chi è in campo al momento del gol (art. 7.6)', () => {
  const m = match({ homeGoals: 0, awayGoals: 2 });
  const events = [ev('x', 'goal', 30, 'away'), ev('y', 'goal', 80, 'away')];
  const gk1 = rate(P('g1', 'P'), app({ minutesPlayed: 60 }), events, m);
  const gk2 = rate(P('g2', 'P'), app({ started: false, minutesPlayed: 30, enteredAt: 60 }), events, m);
  assert.equal(gk1.bonus, -1); assert.equal(gk2.bonus, -1);
});
test('autogol del compagno conta come gol subito per il portiere (art. 7.3)', () => {
  const m = match({ homeGoals: 0, awayGoals: 1 });
  const r = rate(P('g', 'P'), app(), [ev('d', 'own_goal', 50, 'home')], m);
  assert.equal(r.bonus, -1);
  assert.equal(rate(P('d', 'D'), app(), [ev('d', 'own_goal', 50, 'home')], m).bonus, -2);
});
test('espulsione per doppia ammonizione cumulabile col giallo: −1,5', () => {
  const r = rate(P('a', 'C'), app({ minutesPlayed: 70 }), [ev('a', 'yellow', 40), ev('a', 'second_yellow', 70)]);
  assert.equal(r.bonus, -1.5);
});
test('rigori: parato +3 / sbagliato −3; eventi livello 2 spenti di default', () => {
  assert.equal(rate(P('g', 'P'), app(), [ev('g', 'pen_saved')]).bonus, 6); // +3 parato +3 porta inviolata
  assert.equal(rate(P('a', 'A'), app(), [ev('a', 'pen_missed')]).bonus, -3);
  assert.equal(rate(P('a', 'A'), app(), [ev('a', 'pen_won')]).bonus, 0);
  const r2 = computeRating({ player: P('a', 'A'), appearance: app(), events: [ev('a', 'pen_won')], match: match(), rules: { ...DEFAULT_RULES, level2Events: true } });
  assert.equal(r2.bonus, 1);
});
test('gare anomale (art. 10): rinviata/sospesa<45/a tavolino → S.V.; sospesa>45 → eventi validi, niente esito né porta inviolata', () => {
  for (const s of ['postponed', 'suspended_before_45', 'awarded']) assert.equal(rate(P('a', 'D'), app(), [ev('a', 'goal')], match({ status: s })).isSV, true);
  const r = rate(P('a', 'D'), app(), [ev('a', 'goal')], match({ status: 'suspended_after_45' }));
  assert.equal(r.baseVote, 6); assert.equal(r.bonus, 4);
});
test('conversione in gol (art. 11) con soglia mobile', () => {
  assert.equal(toGoals(68.9, 10), 0); assert.equal(toGoals(69, 10), 1); assert.equal(toGoals(74.9, 10), 1); assert.equal(toGoals(75, 10), 2);
  assert.equal(toGoals(69.5, 8), 0); assert.equal(toGoals(70, 8), 1); assert.equal(toGoals(68, 12), 1);
});

const players = new Map([
  ['p1', P('p1', 'P')], ['d1', P('d1', 'D')], ['d2', P('d2', 'D')], ['d3', P('d3', 'D')], ['d4', P('d4', 'D')],
  ['c1', P('c1', 'C')], ['c2', P('c2', 'C')], ['c3', P('c3', 'C')], ['c4', P('c4', 'C')], ['a1', P('a1', 'A')], ['a2', P('a2', 'A')],
  ['bp', P('bp', 'P')], ['bd1', P('bd1', 'D')], ['bd2', P('bd2', 'D')], ['bc1', P('bc1', 'C')], ['bc2', P('bc2', 'C')], ['ba1', P('ba1', 'A')], ['ba2', P('ba2', 'A')],
]);
const lineup = { formation: '4-4-2', starters: ['p1', 'd1', 'd2', 'd3', 'd4', 'c1', 'c2', 'c3', 'c4', 'a1', 'a2'], bench: ['bp', 'bd1', 'bd2', 'bc1', 'bc2', 'ba1', 'ba2'], captainId: 'c1', viceCaptainId: 'a1' };
const ok = (base, bonus = 0) => ({ isSV: false, baseVote: base, bonus, fantaVote: base + bonus, breakdown: [] });
const SV = { isSV: true, svReason: 'non entrato', bonus: 0 };
const allOk = () => new Map([...players.keys()].map((k) => [k, ok(6.5)]));

test('capitano raddoppia solo bonus/malus (art. 6.2)', () => {
  const ratings = allOk(); ratings.set('c1', ok(6.5, 3.5));
  const res = computeLineupResult({ lineup, ratings, players, managerCount: 10 });
  const cap = res.rows.find((r) => r.playerId === 'c1');
  assert.equal(cap.fantaVote, 13.5); assert.equal(cap.isCaptain, true);
});
test('capitano S.V. → vice; entrambi S.V. → nessun raddoppio (art. 6.3)', () => {
  const ratings = allOk(); ratings.set('c1', SV); ratings.set('a1', ok(6.5, 3));
  let res = computeLineupResult({ lineup, ratings, players, managerCount: 10 });
  assert.equal(res.captainId, 'a1'); assert.equal(res.rows.find((r) => r.playerId === 'a1').fantaVote, 12.5);
  ratings.set('a1', SV);
  res = computeLineupResult({ lineup, ratings, players, managerCount: 10 });
  assert.equal(res.captainId, null);
});
test('sostituzioni: stesso ruolo, ordine panchina, massimo 3, poi 5,5 d\'ufficio (art. 8.5-8.6)', () => {
  const ratings = allOk();
  ratings.set('d1', SV); ratings.set('d2', SV); ratings.set('d3', SV); ratings.set('d4', SV);
  ratings.set('bd1', SV); // il primo difensore in panchina è S.V.: salta al secondo
  const res = computeLineupResult({ lineup, ratings, players, managerCount: 10 });
  assert.equal(res.subsApplied.length, 1);
  assert.equal(res.subsApplied[0].in, 'bd2');
  const officials = res.rows.filter((r) => r.official);
  assert.equal(officials.length, 3); assert.equal(officials[0].fantaVote, 5.5);
  assert.equal(res.total, 6.5 * 8 + 5.5 * 3);
});
test('un centrocampista S.V. non è sostituito da un attaccante (art. 8.7)', () => {
  const ratings = allOk(); ratings.set('c1', SV); ratings.set('bc1', SV); ratings.set('bc2', SV);
  const res = computeLineupResult({ lineup, ratings, players, managerCount: 10 });
  assert.equal(res.subsApplied.length, 0); assert.equal(res.rows.find((r) => r.playerId === 'c1').official, true);
});
test('classifica: punti › fantapunti › differenza reti (art. 12.2)', () => {
  const managers = [{ id: 'A' }, { id: 'B' }, { id: 'C' }];
  const results = [
    { homeManagerId: 'A', awayManagerId: 'B', homeGoals: 1, awayGoals: 0, homeScore: 70, awayScore: 65 },
    { homeManagerId: 'C', awayManagerId: 'B', homeGoals: 1, awayGoals: 0, homeScore: 72, awayScore: 60 },
  ];
  const s = computeStandings(managers, results);
  assert.deepEqual(s.map((r) => r.managerId), ['C', 'A', 'B']);
  assert.equal(s[0].points, 3); assert.equal(s[2].lost, 2);
});
test('validazione formazione e proposta d\'ufficio 4-4-2 per l\'editor (art. 8.4)', () => {
  assert.deepEqual(validateLineup(lineup, players), []);
  assert.ok(validateLineup({ ...lineup, formation: '4-4-2', starters: lineup.starters.slice(0, 10) }, players).length > 0);
  const d = defaultLineup([...players.keys()], players);
  assert.equal(d.formation, '4-4-2'); assert.equal(d.starters.length, 11); assert.equal(d.bench.length, 7);
  assert.deepEqual(validateLineup(d, players), []);
});

test('una giornata senza dati non produce risultati: nessun 5,5 d\'ufficio a tappeto', () => {
  const ratings = new Map();                    // nessun voto inserito
  const res = computeLineupResult({ lineup, ratings, players, managerCount: 10 });
  assert.equal(res.rows.every((r) => r.official), true);
  assert.equal(res.total, 5.5 * 11);
  assert.equal(res.goals, 0);                   // 60,5 < soglia 69,0
});

/* ---- lega pubblica: classifica a punti (013) ---- */

const SQ = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

test('classifica a punti: si sommano i fantapunti, chi ne fa piu\' sale', () => {
  const st = classificaPunti(SQ, [
    { managerId: 'a', matchday: 1, punti: 70.5 }, { managerId: 'a', matchday: 2, punti: 60 },
    { managerId: 'b', matchday: 1, punti: 80 }, { managerId: 'b', matchday: 2, punti: 45 },
    { managerId: 'c', matchday: 1, punti: 66 },
  ]);
  // a: 70,5+60 = 130,5 · b: 80+45 = 125 · c: 66
  assert.deepEqual(st.map((r) => r.managerId), ['a', 'b', 'c']);
  assert.deepEqual(st.map((r) => r.position), [1, 2, 3]);
  const a = st[0];
  assert.equal(a.punti, 130.5); assert.equal(a.played, 2); assert.equal(a.migliore, 70.5); assert.equal(a.media, 65.25);
  const b = st[1];
  assert.equal(b.punti, 125); assert.equal(b.migliore, 80);   // la giornata migliore non decide: i punti vengono prima
  // chi non ha giocato nessuna giornata resta a zero, non sparisce
  const vuota = classificaPunti(SQ, []);
  assert.equal(vuota.length, 3);
  assert.deepEqual([...new Set(vuota.map((r) => r.punti))], [0]);
});

test('classifica a punti: i fantapunti sono la classifica, non si convertono in gol', () => {
  const st = classificaPunti(SQ, [{ managerId: 'a', matchday: 1, punti: 71.5 }]);
  const a = st.find((r) => r.managerId === 'a');
  assert.equal(a.punti, a.fantapunti);
  assert.equal(a.punti, 71.5);                 // non 1 gol
});

test('a pari punti decide la giornata migliore; a pari anche quella, pari merito', () => {
  const diverse = classificaPunti(SQ, [
    { managerId: 'a', matchday: 1, punti: 50 }, { managerId: 'a', matchday: 2, punti: 50 },
    { managerId: 'b', matchday: 1, punti: 70 }, { managerId: 'b', matchday: 2, punti: 30 },
  ]);
  assert.deepEqual(diverse.slice(0, 2).map((r) => r.managerId), ['b', 'a']);  // 100 pari, 70 > 50
  assert.deepEqual(diverse.slice(0, 2).map((r) => r.position), [1, 2]);
  const identiche = classificaPunti(SQ, [
    { managerId: 'a', matchday: 1, punti: 60 }, { managerId: 'b', matchday: 1, punti: 60 },
  ]);
  assert.deepEqual(identiche.slice(0, 2).map((r) => r.position), [1, 1], 'pari merito allo stesso posto');
  assert.equal(identiche[2].position, 3, 'e il posto dopo salta il 2');
});

test('una giornata senza consegna vale zero ed e\' giocata', () => {
  const st = classificaPunti(SQ, [
    { managerId: 'a', matchday: 1, punti: 60 }, { managerId: 'a', matchday: 2, punti: 0 },
  ]);
  const a = st.find((r) => r.managerId === 'a');
  assert.equal(a.played, 2); assert.equal(a.punti, 60); assert.equal(a.media, 30);
});

test('i premi vanno ai posti, e uno su un posto che non esiste resta senza nessuno', () => {
  const st = classificaPunti(SQ, [
    { managerId: 'a', matchday: 1, punti: 90 }, { managerId: 'b', matchday: 1, punti: 80 },
  ]);
  const p = premiAssegnati([{ posto: 2, premio: 'Un caffè' }, { posto: 1, premio: 'Una cena' }, { posto: 9, premio: 'Niente' }], st);
  assert.deepEqual(p.map((x) => x.posto), [1, 2, 9]);          // in ordine di posto
  assert.deepEqual(p[0].squadre, ['a']);
  assert.deepEqual(p[1].squadre, ['b']);
  assert.deepEqual(p[2].squadre, [], 'il nono posto in una lega di tre non esiste');
});

test('un premio a pari merito lo vincono tutte e due', () => {
  const st = classificaPunti(SQ, [{ managerId: 'a', matchday: 1, punti: 60 }, { managerId: 'b', matchday: 1, punti: 60 }]);
  const p = premiAssegnati([{ posto: 1, premio: 'Coppa' }], st);
  assert.deepEqual(p[0].squadre.sort(), ['a', 'b']);
});

/* ---- formazione non consegnata: a tavolino (art. 8.4) ---- */

const giocata = (total) => ({ total, goals: toGoals(total, 10), rows: [{}], subsApplied: [], lineup: { formation: '4-4-2' } });

test('a tavolino: chi non consegna perde 0-3, chi consegna tiene i suoi fantapunti (art. 8.4)', () => {
  const casa = giocata(80);                        // 80 → 2 gol con 10 squadre, ma a tavolino sono 3
  const e = esitoScontro(casa, null);
  assert.equal(e.forfait, 'away');
  assert.deepEqual([e.homeGoals, e.awayGoals], [3, 0]);
  assert.deepEqual([e.homeScore, e.awayScore], [80, 0]);
  assert.equal(e.away.lineup, null); assert.deepEqual(e.away.rows, []); assert.equal(e.away.forfait, true);
  const r = esitoScontro(null, giocata(66));
  assert.equal(r.forfait, 'home');
  assert.deepEqual([r.homeGoals, r.awayGoals], [0, 3]);
  assert.deepEqual([r.homeScore, r.awayScore], [0, 66]);
});

test('a tavolino: il numero di gol viene dalle regole', () => {
  const e = esitoScontro(giocata(70), null, { ...DEFAULT_RULES, forfeitGoals: 2 });
  assert.deepEqual([e.homeGoals, e.awayGoals], [2, 0]);
});

test('tutte e due consegnate: nessun tavolino, i gol sono quelli della conversione', () => {
  const e = esitoScontro(giocata(80), giocata(66));
  assert.equal(e.forfait, null);
  assert.deepEqual([e.homeGoals, e.awayGoals], [toGoals(80, 10), toGoals(66, 10)]);
});

test('nessuno consegna: 0-0 nel tabellino ma perdono in due, niente punto del pareggio', () => {
  const e = esitoScontro(null, null);
  assert.equal(e.forfait, 'entrambi');
  const managers = [{ id: 'a' }, { id: 'b' }];
  const st = computeStandings(managers, [{ homeManagerId: 'a', awayManagerId: 'b', ...e }]);
  for (const riga of st) {
    assert.equal(riga.points, 0); assert.equal(riga.lost, 1); assert.equal(riga.drawn, 0);
    assert.equal(riga.gf, 0); assert.equal(riga.gs, 3); assert.equal(riga.played, 1);
  }
});

test('in classifica il tavolino conta come una vittoria 3-0 normale', () => {
  const managers = [{ id: 'a' }, { id: 'b' }];
  const st = computeStandings(managers, [{ homeManagerId: 'a', awayManagerId: 'b', ...esitoScontro(giocata(80), null) }]);
  const a = st.find((r) => r.managerId === 'a'), b = st.find((r) => r.managerId === 'b');
  assert.equal(a.points, 3); assert.equal(a.gf, 3); assert.equal(a.fantapunti, 80);
  assert.equal(b.points, 0); assert.equal(b.gs, 3); assert.equal(b.fantapunti, 0);
});

/* ---- regole riprese dal fantacalcio e adattate (artt. 5.3, 5.4, 8.5, 11.3) ---- */

test('assist da fermo vale meno di un assist su azione (art. 5.3)', () => {
  assert.equal(rate(P('a', 'C'), app(), [ev('a', 'assist')]).bonus, 1);
  assert.equal(rate(P('a', 'C'), app(), [ev('a', 'assist_set')]).bonus, 0.5);
  assert.equal(rate(P('a', 'C'), app(), [ev('a', 'assist'), ev('a', 'assist_set')]).bonus, 1.5);
});

test('gol decisivo: uno solo per partita e solo a chi vince o pareggia (art. 5.4)', () => {
  const R = { ...DEFAULT_RULES, decisiveGoal: 1 };
  const dec = (player, events, m) => computeRating({ player, appearance: app(), events, match: m, rules: R });
  // 2-1: decisivo il gol del sorpasso, non il primo
  const m21 = match({ homeGoals: 2, awayGoals: 1 });
  const evs21 = [ev('p1', 'goal', 10), ev('x', 'goal', 20, 'away'), ev('p2', 'goal', 80)];
  assert.equal(dec(P('p1', 'A'), evs21, m21).bonus, 3);       // solo il gol
  assert.equal(dec(P('p2', 'A'), evs21, m21).bonus, 4);       // gol + decisivo
  // 1-1: decisivo il pareggio
  const m11 = match({ homeGoals: 1, awayGoals: 1 });
  assert.equal(dec(P('p1', 'A'), [ev('x', 'goal', 20, 'away'), ev('p1', 'goal', 80)], m11).bonus, 4);
  // sconfitta: nessun decisivo
  const m12 = match({ homeGoals: 1, awayGoals: 2 });
  assert.equal(dec(P('p1', 'A'), [ev('p1', 'goal', 10), ev('x', 'goal', 20, 'away'), ev('y', 'goal', 30, 'away')], m12).bonus, 3);
  // spento per difetto: la regola non cambia i conti di chi non l'ha accesa
  assert.equal(rate(P('p2', 'A'), app(), evs21, m21).bonus, 3);
});

test('gol decisivo: un autogol avversario fa punteggio ma non dà il bonus a nessuno', () => {
  const R = { ...DEFAULT_RULES, decisiveGoal: 1 };
  const m = match({ homeGoals: 1, awayGoals: 1 });
  const evs = [ev('x', 'goal', 20, 'away'), ev('y', 'own_goal', 80, 'away')];
  const r = computeRating({ player: P('p1', 'A'), appearance: app(), events: evs, match: m, rules: R });
  assert.equal(r.bonus, 0);
});

test('sostituzioni a modulo libero: entra il primo con voto anche di altro ruolo (art. 8.5)', () => {
  const ratings = allOk(); ratings.set('c1', SV); ratings.set('bc1', SV); ratings.set('bc2', SV);
  const stessoRuolo = computeLineupResult({ lineup, ratings, players, managerCount: 10 });
  assert.equal(stessoRuolo.subsApplied.length, 0);            // nessun centrocampista disponibile
  const libero = computeLineupResult({ lineup, ratings, players, managerCount: 10, rules: { ...DEFAULT_RULES, subMode: 'free' } });
  assert.equal(libero.subsApplied.length, 1);
  assert.notEqual(players.get(libero.subsApplied[0].in).role, 'C');
  assert.ok(libero.total > stessoRuolo.total);                // 6,5 invece del 5,5 d'ufficio
});

test('fattore campo: si somma solo a chi gioca in casa (art. 11.3)', () => {
  const R = { ...DEFAULT_RULES, homeBonus: 2 };
  const ratings = allOk();
  const casa = computeLineupResult({ lineup, ratings, players, managerCount: 10, isHome: true, rules: R });
  const fuori = computeLineupResult({ lineup, ratings, players, managerCount: 10, isHome: false, rules: R });
  assert.equal(casa.total - fuori.total, 2);
  assert.equal(casa.sommaRose, fuori.sommaRose);              // le rose valgono uguale
  assert.equal(casa.homeBonus, 2); assert.equal(fuori.homeBonus, 0);
  // spento per difetto
  const senza = computeLineupResult({ lineup, ratings, players, managerCount: 10, isHome: true });
  assert.equal(senza.total, fuori.total);
});

/* ---- il lock e' un dato che finisce sul server: non puo' dipendere dal fuso
       del telefono di chi apre l'app (art. 8.3) ---- */

test('il lock e\' sempre alle 15:00 italiane, da qualunque fuso si guardi', async () => {
  const { oraItaliana } = await import('../src/data.js');
  const aRoma = (d) => new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  // ora legale (+2) e ora solare (+1): lo scarto dall'UTC cambia, l'ora a Roma no
  assert.equal(aRoma(oraItaliana(new Date('2026-08-28T19:00:00Z'))), '15:00');
  assert.equal(aRoma(oraItaliana(new Date('2027-01-08T19:00:00Z'))), '15:00');
  assert.equal(oraItaliana(new Date('2026-08-28T19:00:00Z')).toISOString(), '2026-08-28T13:00:00.000Z');
  assert.equal(oraItaliana(new Date('2027-01-08T19:00:00Z')).toISOString(), '2027-01-08T14:00:00.000Z');
  // il giorno si prende in Italia: alle 23:00 di New York a Roma e' gia' domani
  assert.equal(oraItaliana(new Date('2026-08-29T03:00:00Z')).toISOString(), '2026-08-29T13:00:00.000Z');
});

/* ---- asta (artt. 2-3): la regola che conta e' restare con un credito per
       ogni casella vuota, se no la rosa non si completa piu' ---- */

const G = (id, role, clubId = 'home', q = 10) => ({ id, role, clubId, quotation: q, isActive: true });
const rosaDi = (...pl) => pl.map((p) => ({ playerId: p.id, pricePaid: 1, player: p }));

test('asta: prezzo, ruolo pieno, doppione e giocatore di un altro', async () => {
  const { validaAcquisto } = await import('../src/engine.js');
  const p = G('x', 'A');
  assert.deepEqual(validaAcquisto({ rosa: [], crediti: 500, player: p, prezzo: 50 }), []);
  assert.match(validaAcquisto({ rosa: [], crediti: 500, player: p, prezzo: 0 })[0], /almeno 1/);
  assert.match(validaAcquisto({ rosa: [], crediti: 500, player: p, prezzo: 1.5 })[0], /intero/);
  assert.match(validaAcquisto({ rosa: [], crediti: 500, player: p, prezzo: 5, giaPreso: true })[0], /altra rosa/);
  assert.match(validaAcquisto({ rosa: [], crediti: 500, player: { ...p, isActive: false }, prezzo: 5 })[0], /Fuori dal campionato/);
  // portieri: 3 in rosa e il quarto non entra
  const treP = rosaDi(G('p1', 'P'), G('p2', 'P'), G('p3', 'P'));
  assert.match(validaAcquisto({ rosa: treP, crediti: 500, player: G('p4', 'P'), prezzo: 5 })[0], /portiere: già 3\/3/);
  assert.match(validaAcquisto({ rosa: rosaDi(p), crediti: 500, player: p, prezzo: 5 }).join(' '), /Già in questa rosa/);
});

test('asta: non si puo\' spendere tanto da non poter completare la rosa', async () => {
  const { validaAcquisto, offertaMassima } = await import('../src/engine.js');
  // rosa vuota: 25 caselle. Offrendo per la prima, 24 restano da riempire,
  // quindi il massimo e' 500-24 = 476, non 500.
  assert.equal(offertaMassima({ rosa: [], crediti: 500, role: 'A' }), 476);
  assert.deepEqual(validaAcquisto({ rosa: [], crediti: 500, player: G('x', 'A'), prezzo: 476 }), []);
  assert.match(validaAcquisto({ rosa: [], crediti: 500, player: G('x', 'A'), prezzo: 477 })[0], /Restano 23 crediti per 24 caselle/);
  // ultima casella: si puo' spendere tutto
  const quasi = [];
  for (const [r, n] of [['P', 3], ['D', 8], ['C', 8], ['A', 5]]) for (let i = 0; i < n; i++) quasi.push(G(`${r}${i}`, r));
  const rosa24 = rosaDi(...quasi);
  assert.equal(offertaMassima({ rosa: rosa24, crediti: 30, role: 'A' }), 30);
  assert.deepEqual(validaAcquisto({ rosa: rosa24, crediti: 30, player: G('ultimo', 'A'), prezzo: 30 }), []);
  assert.match(validaAcquisto({ rosa: rosa24, crediti: 30, player: G('ultimo', 'A'), prezzo: 31 })[0], /ne servono 31/);
  // ruolo pieno: non puoi offrire niente per quel ruolo
  assert.equal(offertaMassima({ rosa: rosaDi(G('a', 'P'), G('b', 'P'), G('c', 'P')), crediti: 100, role: 'P' }), 0);
});

test('asta: tetto per società quando la lega lo attiva (art. 2.6)', async () => {
  const { validaAcquisto, DEFAULT_RULES } = await import('../src/engine.js');
  const R = { ...DEFAULT_RULES, maxPerClub: 2 };
  const due = rosaDi(G('a', 'D', 'trepenne'), G('b', 'C', 'trepenne'));
  assert.deepEqual(validaAcquisto({ rosa: due, crediti: 500, player: G('c', 'A', 'folgore'), prezzo: 5, rules: R }), []);
  assert.match(validaAcquisto({ rosa: due, crediti: 500, player: G('c', 'A', 'trepenne'), prezzo: 5, rules: R })[0], /il tetto è 2/);
  // spento per difetto: nessun tetto
  assert.deepEqual(validaAcquisto({ rosa: due, crediti: 500, player: G('c', 'A', 'trepenne'), prezzo: 5 }), []);
});

// ---------------------------------------------------------------- movimenti
test('movimenti: chi sale, chi scende, chi non si muove', () => {
  const prima = [
    { managerId: 'a', position: 1, played: 3 },
    { managerId: 'b', position: 2, played: 3 },
    { managerId: 'c', position: 3, played: 3 },
  ];
  const dopo = [
    { managerId: 'c', position: 1, played: 4 },
    { managerId: 'b', position: 2, played: 4 },
    { managerId: 'a', position: 3, played: 4 },
  ];
  const m = movimenti(prima, dopo);
  assert.equal(m.get('c'), 2, 'c sale di due');
  assert.equal(m.get('b'), 0, 'b e\' ferma');
  assert.equal(m.get('a'), -2, 'a scende di due');
});

test('movimenti: alla prima giornata non c\'e\' un prima, quindi nessuna freccia', () => {
  const prima = [{ managerId: 'a', position: 1, played: 0 }, { managerId: 'b', position: 2, played: 0 }];
  const dopo = [{ managerId: 'b', position: 1, played: 1 }, { managerId: 'a', position: 2, played: 1 }];
  const m = movimenti(prima, dopo);
  assert.equal(m.get('a'), null);
  assert.equal(m.get('b'), null);
});

test('movimenti: una squadra entrata dopo non ha un confronto', () => {
  const prima = [{ managerId: 'a', position: 1, played: 2 }];
  const dopo = [{ managerId: 'a', position: 1, played: 3 }, { managerId: 'nuova', position: 2, played: 1 }];
  const m = movimenti(prima, dopo);
  assert.equal(m.get('a'), 0);
  assert.equal(m.get('nuova'), null);
});

// ---------------------------------------------------------- record di lega
const SF = (matchday, h, a, hg, ag, hs, as_) =>
  ({ played: true, matchday, homeManagerId: h, awayManagerId: a, homeGoals: hg, awayGoals: ag, homeScore: hs, awayScore: as_ });

test('recordLega: senza partite giocate non inventa numeri', () => {
  const r = recordLega([{ played: false, matchday: 1 }]);
  assert.equal(r.vuoto, true);
  assert.equal(r.migliore, null);
  assert.deepEqual(r.strisce, []);
});

test('recordLega: miglior e peggior punteggio, piu\' gol, scarto piu\' largo', () => {
  const r = recordLega([
    SF(1, 'a', 'b', 2, 1, 70.5, 64.0),
    SF(2, 'a', 'c', 4, 0, 82.5, 51.0),
    SF(3, 'b', 'c', 1, 1, 66.0, 66.0),
  ]);
  assert.equal(r.migliore.managerId, 'a');
  assert.equal(r.migliore.punti, 82.5);
  assert.equal(r.migliore.matchday, 2);
  assert.equal(r.peggiore.managerId, 'c');
  assert.equal(r.peggiore.punti, 51.0);
  assert.equal(r.piuGol.gol, 4);
  assert.equal(r.scarto.gol, 4);
  assert.equal(r.scarto.vincitore, 'a');
  assert.equal(r.scarto.perdente, 'c');
});

test('recordLega: a parita\' di record vince la giornata piu\' recente', () => {
  const r = recordLega([SF(1, 'a', 'b', 1, 0, 70.0, 60.0), SF(5, 'b', 'a', 0, 1, 60.0, 70.0)]);
  assert.equal(r.migliore.punti, 70.0);
  assert.equal(r.migliore.matchday, 5, 'a parita\' si racconta quella piu\' recente');
});

test('recordLega: strisce di vittorie e di risultati utili', () => {
  const r = recordLega([
    SF(1, 'a', 'b', 2, 0, 70, 60), SF(2, 'a', 'b', 3, 1, 72, 61),
    SF(3, 'b', 'a', 1, 1, 65, 65), SF(4, 'a', 'b', 0, 2, 55, 71),
  ]);
  const a = r.strisce.find((x) => x.managerId === 'a');
  assert.deepEqual(a.esiti, ['V', 'V', 'N', 'P']);
  assert.equal(a.vittorie, 2, 'due vittorie di fila');
  assert.equal(a.imbattuto, 3, 'tre risultati utili prima della sconfitta');
  const b = r.strisce.find((x) => x.managerId === 'b');
  assert.equal(b.vittorie, 1);
  assert.equal(b.imbattuto, 2, 'pareggio e vittoria in coda');
});

test('recordLega: medie, massimo e minimo per squadra', () => {
  const r = recordLega([SF(1, 'a', 'b', 2, 0, 70, 60), SF(2, 'b', 'a', 1, 0, 80, 50)]);
  const a = r.medie.find((x) => x.managerId === 'a');
  assert.equal(a.giocate, 2);
  assert.equal(a.media, 60);
  assert.equal(a.massimo, 70);
  assert.equal(a.minimo, 50);
  assert.equal(r.medie[0].managerId, 'b', 'la media piu\' alta sta davanti');
});

test('testaATesta: visto da chi lo chiede', () => {
  const partite = [
    SF(1, 'a', 'b', 2, 1, 70, 64),
    SF(6, 'b', 'a', 3, 0, 78, 52),
    SF(11, 'a', 'b', 1, 1, 66, 66),
    SF(2, 'a', 'c', 5, 0, 90, 40),   // non c'entra
  ];
  const da_a = testaATesta(partite, 'a', 'b');
  assert.equal(da_a.partite.length, 3, 'solo gli scontri fra le due');
  assert.deepEqual(da_a.partite.map((f) => f.matchday), [1, 6, 11], 'in ordine di giornata');
  assert.equal(da_a.v, 1); assert.equal(da_a.n, 1); assert.equal(da_a.p, 1);
  assert.equal(da_a.golA, 3); assert.equal(da_a.golB, 5);
  assert.equal(da_a.puntiA, 188, '70 in casa + 52 fuori + 66 in casa'); assert.equal(da_a.puntiB, 208, '64 + 78 + 66');
  const da_b = testaATesta(partite, 'b', 'a');
  assert.equal(da_b.v, 1); assert.equal(da_b.p, 1, 'visto dall\'altra parte si ribalta');
  assert.equal(da_b.golA, 5); assert.equal(da_b.golB, 3);
});

test('testaATesta: due squadre che non si sono mai incontrate', () => {
  const r = testaATesta([SF(1, 'a', 'b', 1, 0, 70, 60)], 'a', 'z');
  assert.equal(r.partite.length, 0);
  assert.equal(r.v + r.n + r.p, 0);
  assert.equal(r.puntiA, 0);
});
