// Dati finti per simulare la stagione intera: le giornate dalla 10ª alla 30ª
// ripetono i referti veri già giocati, con date una settimana dopo l'altra.
import fs from 'fs';
import * as D from '../../src/futsal-dati.js';
import { RUOLO_GIOCO } from '../../src/futsal-engine.js';
const OUT = (process.env.OUT || '/tmp/coppa-simulata') + '/'; fs.mkdirSync(OUT, { recursive: true });
const giocate = [...new Set(D.REFERTI.map((r) => r.g))].sort((a, b) => a - b);
const ultima = giocate.at(-1);
const base = Math.min(...D.CALENDARIO.filter((c) => c[0] === ultima).map((c) => new Date(c[3]).getTime()));
const sposta = (iso, srcG, g) => { const t = new Date(iso).getTime(); const primaSrc = Math.min(...D.CALENDARIO.filter((c) => c[0] === srcG).map((c) => new Date(c[3]).getTime())); return new Date(base + (g - ultima) * 7 * 86400e3 + (t - primaSrc)).toISOString(); };
function dati(fino) {
  const cal = D.CALENDARIO.filter((c) => c[0] <= ultima).map((c) => [...c]);
  const ref = [...D.REFERTI];
  for (let g = ultima + 1; g <= 30; g++) {
    const src = giocate[(g - ultima - 1) % giocate.length];
    for (const c of D.CALENDARIO.filter((x) => x[0] === src)) cal.push([g, c[1], c[2], sposta(c[3], src, g), c[4], g <= fino ? c[5] : null, g <= fino ? c[6] : null]);
    if (g <= fino) for (const r of D.REFERTI.filter((x) => x.g === src)) ref.push({ ...r, g });
  }
  return `export const GIORNATE = 30;\nexport const CALENDARIO = ${JSON.stringify(cal)};\nexport const GIOCATORI = ${JSON.stringify(D.GIOCATORI)};\nexport const REFERTI = ${JSON.stringify(ref)};\n`;
}
fs.writeFileSync(OUT + 'dati-30.js', dati(30));
for (const n of [15, 20, 26]) fs.writeFileSync(OUT + `dati-${n}.js`, dati(n));
// 100 squadre: giocatori presi fra chi è sceso in campo davvero
let h = 7; const rnd = () => { h = (h * 1103515245 + 12345) % 2147483648; return h / 2147483648; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const inCampo = new Set(D.REFERTI.flatMap((r) => r.distinte.flat()));
const gioc = D.GIOCATORI.filter((x) => inCampo.has(x[0])).map(([id, club, , , ruoloFsgc]) => ({ id, club, ruolo: RUOLO_GIOCO[ruoloFsgc] || 'A' }));
const per = { D: gioc.filter((x) => x.ruolo === 'D'), A: gioc.filter((x) => x.ruolo === 'A') };
const clubs = [...new Set(D.CALENDARIO.map((c) => c[1]))];
const A1 = ['Draghi', 'Lupi', 'Falchi', 'Leoni', 'Tori', 'Aquile', 'Squali', 'Orsi', 'Volpi', 'Fulmini'];
const A2 = ['del Titano', 'di Borgo', 'Rossi', 'Neri', 'Blu', 'Furiosi', 'Volanti', 'Ribelli', 'di Città', 'Notturni'];
const COL = ['#D7263D', '#1B998B', '#2E86AB', '#F46036', '#6A4C93', '#C2185B', '#2D3047', '#E0A100'];
const schemi = { '1-3': [1, 3], '2-2': [2, 2], '3-1': [3, 1] };
const squadre = [];
for (let i = 0; i < 99; i++) {
  const nome = `${A1[i % 10]} ${A2[Math.floor(i / 10)]}`;
  const scegli = (r) => { const s = new Set(); while (s.size < 4) s.add(pick(per[r]).id); return [...s]; };
  const Dd = scegli('D'), Aa = scegli('A'); const schema = pick(Object.keys(schemi)); const [nd, na] = schemi[schema];
  const tit = [...Dd.slice(0, nd), ...Aa.slice(0, na)], pan = [...Dd.slice(nd), ...Aa.slice(na)];
  squadre.push({ user_id: `sim${String(i).padStart(3, '0')}`, squadra: nome, colore: pick(COL), iniziali: nome.split(' ').filter((w) => w.length > 2).map((w) => w[0]).join('').slice(0, 2).toUpperCase(), club_cuore: pick(clubs),
    formazione: { schema, porta: pick(clubs), D: Dd, A: Aa, titolari: tit, sesto: pan[0], capitano: tit[0], vice: tit[1] } });
}
fs.writeFileSync(OUT + 'squadre.json', JSON.stringify(squadre));
console.log('giocate vere', giocate, 'squadre', squadre.length, 'D', per.D.length, 'A', per.A.length);
