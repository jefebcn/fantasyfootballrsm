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
const riposo = (media) => ({ sv: false, riposo: true, base: media, bonus: 0, totale: media, voci: [] });
// rosa: d1..d4, a1..a4 di otto squadre diverse; in campo d1 d2 a1 a2, sesto a3, panchina d3 d4 a4
const base = () => ({
  schema: '2-2', porta: 'p',
  D: [T('d1', 'D', 'c1'), T('d2', 'D', 'c2'), T('d3', 'D', 'c3'), T('d4', 'D', 'c4')],
  A: [T('a1', 'A', 'c5'), T('a2', 'A', 'c6'), T('a3', 'A', 'c7'), T('a4', 'A', 'c8')],
  titolari: ['d1', 'd2', 'a1', 'a2'], sesto: 'a3', capitano: 'a1', vice: 'd1',
});
const tutti6 = (extra = {}) => ({ porta: voto(6), giocatori: new Map(['d1', 'd2', 'd3', 'd4', 'a1', 'a2', 'a3', 'a4'].map((id) => [id, extra[id] || voto(6)])) });

test('rosa e formazione valide e i loro errori', () => {
  assert.deepEqual(controllaFormazione(base()), []);
  const tre = { ...base(), porta: 'c1', D: [T('d1', 'D', 'c1'), T('d2', 'D', 'c1'), ...base().D.slice(2)] };
  assert.match(controllaFormazione(tre).join(), /Al massimo 2 per squadra/);
  assert.deepEqual(controllaFormazione({ ...base(), porta: 'c1' }), [], 'due della stessa squadra, Porta compresa, si puo\'');
  assert.match(controllaFormazione({ ...base(), schema: '3-1' }).join(), /in campo vanno 3 difensori/);
  assert.match(controllaFormazione({ ...base(), vice: 'a1' }).join(), /diversi/);
  assert.match(controllaFormazione({ ...base(), sesto: 'a1' }).join(), /sesto uomo/);
  assert.match(controllaFormazione({ ...base(), A: base().A.slice(0, 3) }).join(), /Servono 4 attaccanti/);
  assert.deepEqual(controllaFormazione({ ...base(), schema: '1-3', titolari: ['d1', 'a1', 'a2', 'a3'], sesto: 'a4' }), []);
});
test('in campo e sesto uomo al 100%, panchina al 50%, capitano per 1,5', () => {
  const r = punteggioFormazione(base(), tutti6({ a1: voto(10, 3) }));
  assert.equal(r.capitano, 'a1');
  // Porta 6 + d1 6 + d2 6 + a1 10×1,5 + a2 6 + sesto 6 + tre in panchina 3 ciascuno
  assert.equal(r.totale, 6 + 6 + 6 + 15 + 6 + 6 + 9);
  assert.deepEqual(r.righe.map((x) => x.posto), ['P', 'D', 'D', 'A', 'A', 'S', 'B', 'B', 'B']);
});
test('non convocato: entra il primo della panchina del suo ruolo, al 100%, e la fascia va al vice', () => {
  const r = punteggioFormazione(base(), tutti6({ a1: SV, a4: voto(8) }));
  assert.equal(r.capitano, 'd1');
  assert.equal(r.righe.find((x) => x.id === 'a1').entrato.id, 'a4');
  assert.equal(r.righe.find((x) => x.id === 'a4' && x.posto === 'B').punti, 0, 'non conta due volte');
  // Porta 6 + d1 9 (capitano) + d2 6 + a4 8 + a2 6 + sesto 6 + d3 3 + d4 3
  assert.equal(r.totale, 6 + 9 + 6 + 8 + 6 + 6 + 3 + 3);
});
test('il sesto uomo non sostituisce: conta gia\' per intero', () => {
  const r = punteggioFormazione(base(), tutti6({ a1: SV, a4: SV }));
  assert.equal(r.righe.find((x) => x.id === 'a1').entrato, null);
  assert.equal(r.totale, 6 + 9 + 6 + 0 + 6 + 6 + 3 + 3 + 0);
});
test('chi riposa prende la media ma non la fascia', () => {
  const r = punteggioFormazione(base(), tutti6({ a1: riposo(7) }));
  assert.equal(r.capitano, 'd1');
  assert.equal(r.righe.find((x) => x.id === 'a1').punti, 7);
});
test('il malus dei cambi si toglie dal totale', () => {
  assert.equal(punteggioFormazione(base(), tutti6(), { malus: 2 }).totale, punteggioFormazione(base(), tutti6()).totale - 2);
});
test('bonus difesa con il 3-1: media di Porta e tre D almeno 7,0', () => {
  const f = { ...base(), schema: '3-1', titolari: ['d1', 'd2', 'd3', 'a1'], capitano: 'a1', vice: 'd1' };
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
test('a giornata conclusa chi riposa prende la sua media delle giornate prima', () => {
  const n = giocate().find((k) => k > 1);
  const club = riposa(n)[0];
  const v = votiGiornata(n).porta.get(club);
  assert.equal(v.riposo, true);
  const prima = Array.from({ length: n - 1 }, (_, i) => votiGiornata(i + 1).porta.get(club)).filter((x) => !x.sv && !x.riposo);
  assert.equal(v.totale, Math.round((prima.reduce((s, x) => s + x.totale, 0) / prima.length) * 100) / 100);
});
