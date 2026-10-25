import { test } from 'node:test';
import assert from 'node:assert/strict';
import { votoGiocatore, votoPorta, punteggioFormazione, controllaFormazione, RUOLO_GIOCO } from '../src/futsal-engine.js';
import { GIOCATORI_FUTSAL, PARTITE, votiGiornata, giocate, riposa, SQUADRE } from '../src/futsal.js';
import { REFERTI } from '../src/futsal-dati.js';

// Una partita finta: casa 3-1 ospiti. h1 doppietta e giallo, h2 autogol, a1 gol.
const club = { h1: 'casa', h2: 'casa', hp: 'casa', hp2: 'casa', a1: 'ospiti', ap: 'ospiti', a2: 'ospiti' };
const ruolo = { hp: 'Portiere', hp2: 'Portiere', ap: 'Portiere' };
const ref = {
  g: 1, casa: 'casa', ospite: 'ospiti',
  distinte: [['h1', 'h2', 'hp', 'hp2'], ['a1', 'ap']],
  eventi: [['h1', 10, 'goal'], ['h1', 20, 'goal'], ['h1', 25, 'yellow'], ['h2', 30, 'own_goal'], ['a1', 40, 'goal'], ['hp2', 50, 'goal']],
};
const clubDi = (id) => club[id];
const ruoloDi = (id) => ruolo[id];

test('voto: 6 in distinta + vittoria, gol +3, giallo −0,5', () => {
  const v = votoGiocatore({ id: 'h1', club: 'casa' }, [ref], clubDi);
  assert.equal(v.sv, false);
  assert.equal(v.base, 6.5);
  assert.equal(v.bonus, 5.5);
  assert.equal(v.totale, 12);
});
test('i gol si contano dagli eventi: l\'autogol vale per l\'avversario', () => {
  // casa: h1×2 + hp2 = 3; ospiti: a1 + autogol di h2 = 2 → vittoria casa 3-2
  const v = votoGiocatore({ id: 'a1', club: 'ospiti' }, [ref], clubDi);
  assert.equal(v.base, 5.5);
  assert.equal(votoGiocatore({ id: 'h2', club: 'casa' }, [ref], clubDi).totale, 5.5);
});
test('senza voto se non in distinta o se la squadra riposa', () => {
  assert.equal(votoGiocatore({ id: 'h9', club: 'casa' }, [ref], clubDi).motivo, 'non in distinta');
  assert.equal(votoGiocatore({ id: 'x', club: 'altra' }, [ref], clubDi).motivo, 'la squadra non gioca');
});
test('porta: gol subiti −0,5 l\'uno, eventi di tutti i portieri della squadra', () => {
  const v = votoPorta('casa', [ref], clubDi, ruoloDi);
  // 6 + 0,5 vittoria − 2×0,5 gol subiti + 3 gol del secondo portiere
  assert.equal(v.totale, 8.5);
  const o = votoPorta('ospiti', [ref], clubDi, ruoloDi);
  assert.equal(o.totale, 5.5 - 1.5);
});
test('porta inviolata +3', () => {
  const r = { ...ref, eventi: [['h1', 10, 'goal']] };
  assert.equal(votoPorta('casa', [r], clubDi, ruoloDi).totale, 6.5 + 3);
});

const T = (id, ruolo, c) => ({ id, ruolo, club: c });
const voto = (totale, bonus = 0) => ({ sv: false, base: totale - bonus, bonus, totale });
const SV = { sv: true, motivo: 'non in distinta' };
const base = () => ({
  modulo: '2-2', porta: 'p',
  titolari: [T('d1', 'D', 'c1'), T('d2', 'D', 'c2'), T('a1', 'A', 'c3'), T('a2', 'A', 'c4')],
  panchina: [T('bd', 'D', 'c5'), T('ba', 'A', 'c6')], capitano: 'a1', vice: 'd1',
});

test('formazione valida e i suoi errori', () => {
  assert.deepEqual(controllaFormazione(base()), []);
  const doppio = { ...base(), panchina: [T('bd', 'D', 'c1'), T('ba', 'A', 'c6')] };
  assert.match(controllaFormazione(doppio).join(), /un giocatore per squadra/);
  const modulo = { ...base(), modulo: '3-1' };
  assert.match(controllaFormazione(modulo).join(), /Servono 3 difensori/);
  assert.match(controllaFormazione({ ...base(), vice: 'a1' }).join(), /diversi/);
});
test('capitano raddoppia solo bonus e malus', () => {
  const voti = { porta: voto(6), giocatori: new Map([['d1', voto(6)], ['d2', voto(6)], ['a1', voto(9.5, 3)], ['a2', voto(6)]]) };
  const r = punteggioFormazione(base(), voti);
  assert.equal(r.capitano, 'a1');
  assert.equal(r.totale, 6 + 6 + 6 + 12.5 + 6);
});
test('capitano senza voto: entra il panchinaro del ruolo e la fascia va al vice', () => {
  const voti = { porta: voto(6), giocatori: new Map([['d1', voto(9, 3)], ['d2', voto(6)], ['a1', SV], ['a2', voto(6)], ['ba', voto(7, 1)]]) };
  const r = punteggioFormazione(base(), voti);
  assert.equal(r.capitano, 'd1');
  assert.equal(r.righe.find((x) => x.id === 'a1').entrato.id, 'ba');
  assert.equal(r.totale, 6 + 12 + 6 + 7 + 6);
});
test('senza sostituto del ruolo il posto vale zero', () => {
  const voti = { porta: voto(6), giocatori: new Map([['d1', SV], ['d2', voto(6)], ['a1', voto(6)], ['a2', voto(6)], ['bd', SV], ['ba', voto(8)]]) };
  assert.equal(punteggioFormazione(base(), voti).totale, 24);
});
test('bonus difesa con il 3-1: media di Porta e tre D almeno 7,0', () => {
  const f = { ...base(), modulo: '3-1', titolari: [T('d1', 'D', 'c1'), T('d2', 'D', 'c2'), T('d3', 'D', 'c7'), T('a1', 'A', 'c3')], capitano: 'a1', vice: 'd1' };
  const sopra = { porta: voto(7), giocatori: new Map([['d1', voto(7)], ['d2', voto(7)], ['d3', voto(7)], ['a1', voto(6)]]) };
  assert.deepEqual(punteggioFormazione(f, sopra).bonusDifesa, { media: 7, preso: true, punti: 2 });
  const sotto = { porta: voto(7), giocatori: new Map([['d1', voto(7)], ['d2', voto(7)], ['d3', voto(6.5)], ['a1', voto(6)]]) };
  assert.equal(punteggioFormazione(f, sotto).bonusDifesa.preso, false);
  assert.equal(punteggioFormazione(base(), sopra).bonusDifesa, null);
});

// ---- sui dati veri
test('i referti importati tornano col risultato ufficiale', () => {
  for (const r of REFERTI) {
    const p = PARTITE.find((x) => x.g === r.g && x.casa === r.casa && x.ospite === r.ospite);
    const casa = votiGiornata(r.g).porta.get(r.casa);
    assert.ok(p && p.gc !== null, `${r.casa}-${r.ospite} nel calendario`);
    assert.equal(casa.sv, false);
    const subiti = casa.voci.find((v) => /Gol subiti/.test(v.etichetta));
    assert.equal(subiti ? Number(subiti.etichetta.split('× ')[1]) : 0, p.go, `${r.casa}-${r.ospite} g${r.g}`);
  }
});
test('ogni ruolo FSGC ha un ruolo di gioco, ogni giocatore una squadra', () => {
  for (const g of GIOCATORI_FUTSAL) {
    assert.ok(Object.hasOwn(RUOLO_GIOCO, g.ruoloFsgc), `${g.id} ${g.ruoloFsgc}`);
    assert.ok(SQUADRE.some((s) => s.id === g.club), g.club);
  }
});
test('una squadra riposa a ogni giornata', () => {
  for (const n of giocate()) assert.equal(riposa(n).length, 1, `giornata ${n}`);
});
