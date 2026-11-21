/**
 * Simulazione della Coppa Fantatitano con tanti iscritti (prove/coppa-simula.html).
 * Disegna la pagina vera (src/views/coppa.js) con dati finti ma validi:
 *   ?n=120            quanti iscritti
 *   ?momento=prima | iscritto | quarti | semifinali | campione
 * Squadre, formazioni e tabellini sono inventati, mai pubblicati: servono a
 * vedere la pagina in ogni momento della coppa prima che succeda davvero.
 */
import { SPRITE } from '../src/sprite.js';
import * as S from '../src/state.js';
import * as CS from '../src/coppa-server.js';
import { disegna, simulaDati, coppa } from '../src/views/coppa.js';
import { COPPA_CALENDARIO } from '../src/coppa-dati.js';
import { TURNI, squadreInGara, coppaFantatitano, punteggio, votiDelTurno } from '../src/coppa-fanta.js';

const q = new URLSearchParams(location.search);
const N = Number(q.get('n')) || 120;
const momento = q.get('momento') || 'prima';
let seme = 7;
const rnd = () => { seme = (seme * 16807) % 2147483647; return seme / 2147483647; };
const prendi = (a) => a[Math.floor(rnd() * a.length)];

// calendario: i quarti veri, poi semifinali e finale inventate
const cal = COPPA_CALENDARIO.map((r) => [...r]);
cal.push([5, 'trefiori', 'virtus', '2027-03-03T20:45:00+01:00', null, null, null], [5, 'lafiorita', 'trepenne', '2027-03-03T20:45:00+01:00', null, null, null],
  [6, 'virtus', 'trefiori', '2027-03-17T20:45:00+01:00', null, null, null], [6, 'trepenne', 'lafiorita', '2027-03-17T20:45:00+01:00', null, null, null],
  [7, 'trefiori', 'lafiorita', '2027-05-22T20:00:00+02:00', null, null, null]);
const fino = { prima: 2, iscritto: 2, quarti: 3, semifinali: 5, campione: 7 }[momento];
const ora = { prima: '2026-11-23T12:00:00+01:00', iscritto: '2026-11-23T12:00:00+01:00', quarti: '2026-11-27T12:00:00+01:00', semifinali: '2027-03-06T12:00:00+01:00', campione: '2027-05-24T12:00:00+02:00' }[momento];

const perClub = (c) => S.base.players.filter((p) => p.clubId === c && !p.doppioneDi);
const referti = [];
for (const r of cal) {
  if (r[0] < 3 || r[0] > fino) continue;
  r[5] = Math.floor(rnd() * 4); r[6] = Math.floor(rnd() * 3);
  const titolari = [r[1], r[2]].map((c) => {
    const g = perClub(c); const di = (ru, k) => g.filter((p) => p.role === ru).slice(0, k).map((p) => p.id);
    return [...di('P', 1), ...di('D', 4), ...di('C', 4), ...di('A', 2)];
  });
  const eventi = [];
  [[r[5], 0], [r[6], 1]].forEach(([n, lato]) => { for (let i = 0; i < n; i++) eventi.push([prendi(titolari[lato].slice(5)), 10 + Math.floor(rnd() * 80), 'goal']); });
  for (let i = 0; i < 3; i++) eventi.push([prendi(titolari[i % 2].slice(1)), 20 + Math.floor(rnd() * 60), 'yellow']);
  referti.push({ g: r[0], casa: r[1], ospite: r[2], arbitro: null, titolari, eventi: eventi.sort((a, b) => b[1] - a[1]), cambi: [] });
}

// iscritti e formazioni
const NOMI = ['Real', 'Atletico', 'Dinamo', 'Sporting', 'Torri', 'Titani', 'Borgo', 'Libertà', 'Montale', 'Guaita', 'Cesta', 'Fiamme', 'Lupi', 'Falchi', 'Aquile'];
const LUOGHI = ['Titano', 'Borgo', 'Serravalle', 'Dogana', 'Faetano', 'Chiesanuova', 'Acquaviva', 'Montegiardino', 'Domagnano', 'Fiorentino'];
const COLORI = ['#4B06FC', '#C0392B', '#1E6FB5', '#2E8B57', '#D4A017', '#111111', '#E67E22', '#8E44AD'];
const ids = Array.from({ length: N }, (_, i) => `u${String(i).padStart(3, '0')}`);
const formazioni = new Map();
const lineup = (n, id, nome, colore) => {
  const t = TURNI[n - 1]; const sq = squadreInGara(cal, n);
  // si scelgono soprattutto giocatori che poi giocano davvero (titolari del tabellino finto)
  const giocano = new Set(referti.filter((r) => r.g === t.fsgc).flatMap((r) => r.titolari.flat()));
  const perClubN = (c) => perClub(c).filter((p) => !giocano.size || giocano.has(p.id) || rnd() < 0.08);
  for (let tent = 0; tent < 200; tent++) {
    const usati = {}; const scelti = [];
    const pesca = (ok) => { const c = sq.filter((x) => (usati[x] || 0) < t.tetto); const p = perClubN(prendi(c)).filter((x) => ok(x) && !scelti.includes(x.id)); if (!p.length) return null; const g = prendi(p); usati[g.clubId] = (usati[g.clubId] || 0) + 1; scelti.push(g.id); return g.id; };
    const tit = [pesca((p) => p.role === 'P'), pesca((p) => p.role === 'D'), pesca((p) => p.role === 'C'), pesca((p) => p.role === 'A'), pesca((p) => p.role !== 'P')];
    const ris = pesca(() => true);
    if (tit.every(Boolean) && ris) return { user_id: id, turno: n, squadra: nome, colore, iniziali: nome.split(' ').map((w) => w[0]).join('').slice(0, 2), titolari: tit, riserva: ris, capitano: prendi(tit) };
  }
  return null;
};
ids.forEach((id) => {
  const nome = `${prendi(NOMI)} ${prendi(LUOGHI)}${rnd() < 0.3 ? ` ${Math.floor(rnd() * 90) + 10}` : ''}`;
  const colore = prendi(COLORI);
  const ultimo = { prima: 1, iscritto: 1, quarti: 2, semifinali: 4, campione: 5 }[momento];
  for (const t of TURNI.filter((x) => x.n <= ultimo)) { const f = lineup(t.n, id, nome, colore); if (f) formazioni.set(`${t.n}:${id}`, f); }
});
let io = 'u007';
if (momento === 'prima') formazioni.delete(`1:${io}`);
if (momento === 'quarti') formazioni.delete(`2:${io}`);

CS.simula({ formazioni, contati: momento === 'prima' || momento === 'iscritto' ? N : 0, turni: [] });
const giocatori = new Map(S.base.players.map((p) => [p.id, p]));
simulaDati({ calendario: cal, referti, ora: Date.parse(ora), io, giocatori });

// nei momenti avanzati «io» è una squadra che conta: in semifinale, o il campione
if (momento === 'semifinali' || momento === 'campione') {
  const voti = new Map();
  const punti = (n, id) => { if (n > { semifinali: 3, campione: 5 }[momento]) return null; if (!voti.has(n)) voti.set(n, votiDelTurno({ calendario: cal, referti, giocatore: (x) => giocatori.get(x), n })); const f = formazioni.get(`${n}:${id}`); return f ? punteggio(f, voti.get(n)).totale : 0; };
  const c = coppaFantatitano(CS.iscritti(), punti);
  io = momento === 'campione' ? c.campione : c.tabellone[0].sfide[0].a;
  simulaDati({ calendario: cal, referti, ora: Date.parse(ora), io, giocatori });
}

document.getElementById('sprite').innerHTML = SPRITE;
const app = document.getElementById('app');
const ctx = { params: {}, render: () => { app.innerHTML = disegna(); coppa.mount(app, ctx); }, toast: (t) => console.log('toast', t) };
ctx.render();
document.body.dataset.pronto = '1';
