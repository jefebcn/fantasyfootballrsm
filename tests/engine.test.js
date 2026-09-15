import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeRating, computeLineupResult, computeStandings, toGoals, validateLineup, defaultLineup, DEFAULT_RULES } from '../src/engine.js';

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
test('validazione formazione e formazione d\'ufficio 4-4-2 (art. 8.4)', () => {
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
