// La Coppa Fantatitano (Alex, 21/11): coppa fantasy sulle sole partite della
// Coppa Titano vera, con la struttura della coppa del futsal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COPPA_CALENDARIO, COPPA_REFERTI } from '../src/coppa-dati.js';
import {
  TURNI, formato, coppaFantatitano, dovesei, validaFormazione, punteggio, votiDelTurno,
  squadreInGara, chiusuraTurno, turnoAperto, partiteDelTurno,
} from '../src/coppa-fanta.js';

const ids = (n) => Array.from({ length: n }, (_, i) => `u${String(i).padStart(3, '0')}`);
// punteggi finti ma fissi: dipendono da chi e dal turno
const fissi = (fino = 5) => (n, id) => (n <= fino ? (Number(id.slice(1)) * 7 + n * 13) % 50 + 40 : null);

test('il calendario vero: quarti il 25/11 e il 9/12 alle 20:45, semifinali non ancora uscite', () => {
  assert.deepEqual(squadreInGara(COPPA_CALENDARIO, 1).sort(), ['cosmos', 'domagnano', 'folgore', 'lafiorita', 'pennarossa', 'trefiori', 'trepenne', 'virtus']);
  assert.equal(chiusuraTurno(COPPA_CALENDARIO, 1).toISOString(), '2026-11-25T19:45:00.000Z');
  assert.equal(chiusuraTurno(COPPA_CALENDARIO, 2).toISOString(), '2026-12-09T19:45:00.000Z');
  assert.equal(turnoAperto(COPPA_CALENDARIO, Date.parse('2026-11-22T12:00:00Z')).n, 1);
  assert.equal(turnoAperto(COPPA_CALENDARIO, Date.parse('2026-11-26T12:00:00Z')).n, 2);
  // i tabellini della coppa non finiscono fra quelli del campionato: turni FSGC 1 e 2 (ottavi) gia' letti
  assert.ok(COPPA_REFERTI.length >= 14 && COPPA_REFERTI.every((r) => r.g <= 2 || partiteDelTurno(COPPA_CALENDARIO, 1).length));
});

test('il formato si sceglie dagli iscritti: 8 squadre ai quarti da 8 iscritti in su', () => {
  assert.equal(formato(3), null);
  assert.deepEqual([formato(5).gironi, formato(5).tabellone], [1, 4]);
  assert.deepEqual([formato(8).gironi, formato(8).passano, formato(8).tabellone], [2, 4, 8]);
  assert.deepEqual([formato(15).gironi, formato(15).passano], [2, 4]);
  assert.deepEqual([formato(16).gironi, formato(16).passano, formato(16).tabellone], [4, 2, 8]);
  assert.equal(formato(150).gironi, 4);
  assert.equal(coppaFantatitano(ids(3), fissi()).formato, null);
});

test('gironi sui quarti: due scontri a testa, avversari diversi, sorteggio uguale per tutti', () => {
  const c = coppaFantatitano(ids(41), fissi(0));
  assert.deepEqual(c.gironi.map((g) => g.nome), ['A', 'B', 'C', 'D']);
  assert.equal(c.gironi.reduce((s, g) => s + g.membri.length, 0), 41);
  for (const g of c.gironi) {
    assert.equal(g.partite.length, 2);
    for (const id of g.membri) {
      const avv = g.partite.flatMap((p) => p.sfide).filter((s) => s.a === id || s.b === id).map((s) => (s.a === id ? s.b : s.a));
      assert.equal(avv.length, 2);
      assert.equal(new Set(avv).size, 2);
    }
  }
  const d = coppaFantatitano(ids(41).reverse(), fissi(0));
  assert.deepEqual(d.gironi.map((g) => g.membri), c.gironi.map((g) => g.membri));
  assert.equal(c.tabellone.length, 0);
});

test('8 ai quarti (prime contro seconde di un altro girone), poi semifinali e finale secche', () => {
  const c = coppaFantatitano(ids(60), fissi(5));
  const [A, B, C, D] = c.gironi.map((g) => g.classifica.map((r) => r.id));
  const q = c.tabellone[0];
  assert.equal(q.nome, 'Quarti');
  assert.deepEqual(q.turni, [3]);
  assert.deepEqual(q.sfide.map((s) => [s.a, s.b]), [[A[0], B[1]], [C[0], D[1]], [B[0], A[1]], [D[0], C[1]]]);
  for (const s of q.sfide) { const [x, y] = s.gare[0]; if (x !== y) assert.equal(s.vincente, x > y ? s.a : s.b); }
  const sf = c.tabellone[1];
  assert.deepEqual([sf.nome, sf.turni[0]], ['Semifinali', 4]);
  assert.deepEqual(sf.sfide.map((s) => [s.a, s.b]), [[q.sfide[0].vincente, q.sfide[1].vincente], [q.sfide[2].vincente, q.sfide[3].vincente]]);
  assert.deepEqual([c.tabellone[2].nome, c.tabellone[2].turni[0]], ['Finale', 5]);
  assert.ok([c.finale.a, c.finale.b].includes(c.campione));
  assert.equal(dovesei(c, c.campione).stato, 'campione');
  const fuori = c.gironi[0].classifica.at(-1).id;
  assert.deepEqual([dovesei(c, fuori).stato, dovesei(c, fuori).dove], ['fuori', 'Girone A']);
  assert.equal(dovesei(c, 'nessuno').stato, 'non iscritto');
});

test('con 2 gironi passano le prime 4; col girone unico si parte dalle semifinali', () => {
  const due = coppaFantatitano(ids(12), fissi(5));
  const [A, B] = due.gironi.map((g) => g.classifica.map((r) => r.id));
  assert.deepEqual(due.tabellone[0].sfide.map((s) => [s.a, s.b]), [[A[0], B[3]], [B[1], A[2]], [B[0], A[3]], [A[1], B[2]]]);
  const uno = coppaFantatitano(ids(6), fissi(5));
  assert.deepEqual(uno.tabellone.map((t) => [t.nome, t.turni[0]]), [['Semifinali', 4], ['Finale', 5]]);
});

test('gara secca: a pari fantapunti passa chi era meglio piazzato nel girone', () => {
  const tutti = ids(6), base = { 1: {}, 2: {}, 3: {}, 4: {}, 5: {} };
  tutti.forEach((id, i) => { base[1][id] = 90 - i * 10; base[2][id] = 90 - i * 10; });
  const punti = (n, id) => base[n][id] ?? null;
  const c0 = coppaFantatitano(tutti, (n, id) => (n <= 2 ? punti(n, id) : null));
  const cl = c0.gironi[0].classifica.map((r) => r.id);
  for (const id of tutti) base[4][id] = 60;      // semifinali tutte pari
  const c = coppaFantatitano(tutti, punti);
  assert.deepEqual(c.tabellone[0].sfide.map((s) => s.vincente), [cl[0], cl[1]]);
  assert.equal(c.campione, null);
});

test('la formazione di coppa: 5 titolari coi quattro ruoli, riserva, capitano, tetto per squadra', () => {
  const G = { 'virtus_1': { role: 'P', clubId: 'virtus' }, 'folgore_2': { role: 'D', clubId: 'folgore' }, 'cosmos_3': { role: 'C', clubId: 'cosmos' },
    'trefiori_4': { role: 'A', clubId: 'trefiori' }, 'domagnano_5': { role: 'A', clubId: 'domagnano' }, 'trepenne_6': { role: 'C', clubId: 'trepenne' },
    'virtus_7': { role: 'A', clubId: 'virtus' }, 'murata_8': { role: 'A', clubId: 'murata' } };
  const g = (id) => G[id];
  const sq = squadreInGara(COPPA_CALENDARIO, 1);
  const ok = { titolari: ['virtus_1', 'folgore_2', 'cosmos_3', 'trefiori_4', 'domagnano_5'], riserva: 'trepenne_6', capitano: 'trefiori_4' };
  assert.equal(validaFormazione(ok, 1, g, sq), null);
  assert.match(validaFormazione({ ...ok, riserva: 'virtus_7' }, 1, g, sq), /Al massimo 1 giocatore/);
  assert.equal(validaFormazione({ ...ok, riserva: 'virtus_7' }, 3, g, ['virtus', 'folgore', 'cosmos', 'trefiori', 'domagnano']), null);
  assert.match(validaFormazione({ ...ok, riserva: 'murata_8' }, 1, g, sq), /non gioca/);
  assert.match(validaFormazione({ ...ok, titolari: ['trepenne_6', 'folgore_2', 'cosmos_3', 'trefiori_4', 'domagnano_5'], riserva: 'virtus_1' }, 1, g, sq), /portiere/);
  assert.match(validaFormazione({ ...ok, capitano: 'trepenne_6' }, 1, g, sq), /capitano/);
  assert.match(validaFormazione({ ...ok, riserva: null }, 1, g, sq), /riserva/);
});

test('il punteggio: capitano doppio, la riserva entra al posto del primo senza voto', () => {
  const v = (x, sv = false) => ({ fantaVote: x, isSV: sv });
  const voti = new Map([['a', v(6)], ['b', v(7)], ['c', v(null, true)], ['d', v(8)], ['e', v(5.5)], ['r', v(6.5)]]);
  const f = { titolari: ['a', 'b', 'c', 'd', 'e'], riserva: 'r', capitano: 'd' };
  const p = punteggio(f, voti);
  assert.equal(p.totale, 6 + 7 + 16 + 5.5 + 6.5);
  assert.ok(p.righe.find((r) => r.id === 'c').fuori);
  // senza riserva che gioca, chi non gioca vale 0
  assert.equal(punteggio({ ...f, riserva: 'zz' }, voti).totale, 6 + 7 + 16 + 5.5);
});

test('i voti di un turno vengono solo dai tabellini di coppa', () => {
  // un turno finto: i quarti di andata col tabellino degli ottavi Virtus–Murata
  const r = COPPA_REFERTI.find((x) => x.casa === 'virtus' && x.ospite === 'murata');
  const cal = [[TURNI[0].fsgc, 'virtus', 'murata', '2026-10-28T20:45:00+01:00', null, 3, 0]];
  const G = new Map([['virtus_19', { role: 'A', clubId: 'virtus' }], ['virtus_16', { role: 'C', clubId: 'virtus' }]]);
  const voti = votiDelTurno({ calendario: cal, referti: [{ ...r, g: TURNI[0].fsgc }], giocatore: (id) => G.get(id), n: 1 });
  assert.ok(voti.get('virtus_19').fantaVote > 6);   // gol all'83'
  assert.equal(votiDelTurno({ calendario: cal, referti: [], giocatore: (id) => G.get(id), n: 1 }), null);
});
