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

test('il formato si sceglie dagli iscritti', () => {
  assert.equal(formato(3), null);
  assert.equal(formato(5).gironi, 1);
  assert.equal(formato(8).gironi, 2);
  assert.equal(formato(150).gironi, 2);
  assert.equal(coppaFantatitano(ids(3), fissi()).formato, null);
});

test('gironi sui quarti: due scontri a testa, avversari diversi, sorteggio uguale per tutti', () => {
  const c = coppaFantatitano(ids(41), fissi(0));
  assert.equal(c.gironi.length, 2);
  assert.equal(c.gironi[0].membri.length + c.gironi[1].membri.length, 41);
  for (const g of c.gironi) {
    assert.equal(g.partite.length, 2);
    for (const id of g.membri) {
      const avv = g.partite.flatMap((p) => p.sfide).filter((s) => s.a === id || s.b === id).map((s) => (s.a === id ? s.b : s.a));
      assert.equal(avv.length, 2);
      assert.equal(new Set(avv).size, 2);
    }
  }
  // lo stesso sorteggio in qualunque ordine arrivino gli iscritti
  const d = coppaFantatitano(ids(41).reverse(), fissi(0));
  assert.deepEqual(d.gironi.map((g) => g.membri), c.gironi.map((g) => g.membri));
  assert.equal(c.tabellone.length, 0);
});

test('semifinali A1–B2 e B1–A2 sulla somma, poi finale secca e campione', () => {
  const c = coppaFantatitano(ids(30), fissi(5));
  const [A, B] = c.gironi.map((g) => g.classifica.map((r) => r.id));
  const semi = c.tabellone[0];
  assert.deepEqual(semi.sfide.map((s) => [s.a, s.b]), [[A[0], B[1]], [B[0], A[1]]]);
  for (const s of semi.sfide) {
    const ta = s.gare[0][0] + s.gare[1][0], tb = s.gare[0][1] + s.gare[1][1];
    if (ta !== tb) assert.equal(s.vincente, ta > tb ? s.a : s.b);
  }
  assert.equal(c.tabellone[1].nome, 'Finale');
  assert.ok([c.finale.a, c.finale.b].includes(c.campione));
  assert.equal(dovesei(c, c.campione).stato, 'campione');
  const fuori = c.gironi[0].classifica.at(-1).id;
  assert.deepEqual([dovesei(c, fuori).stato, dovesei(c, fuori).dove], ['fuori', 'Girone A']);
  assert.equal(dovesei(c, 'nessuno').stato, 'non iscritto');
});

test('in parità di somma passa chi ha fatto di più al ritorno, poi chi era meglio nel girone', () => {
  const tutti = ids(4), base = { 1: {}, 2: {}, 3: {}, 4: {}, 5: {} };
  tutti.forEach((id, i) => { base[1][id] = 90 - i * 10; base[2][id] = 90 - i * 10; });
  const punti = (n, id) => base[n][id] ?? null;
  // prima i gironi, per sapere chi si incontra in semifinale
  const [s1, s2] = coppaFantatitano(tutti, (n, id) => (n <= 2 ? punti(n, id) : 0)).tabellone[0].sfide;
  // s1: somma pari, al ritorno vince b; s2: tutto pari, passa chi era meglio nel girone (a)
  Object.assign(base[3], { [s1.a]: 70, [s1.b]: 60, [s2.a]: 65, [s2.b]: 65 });
  Object.assign(base[4], { [s1.a]: 60, [s1.b]: 70, [s2.a]: 65, [s2.b]: 65 });
  const c = coppaFantatitano(tutti, punti);
  assert.equal(c.tabellone[0].sfide[0].vincente, s1.b);
  assert.equal(c.tabellone[0].sfide[1].vincente, s2.a);
  assert.equal(c.campione, null);      // la finale non ha ancora punteggi
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
