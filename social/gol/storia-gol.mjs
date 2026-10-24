/**
 * LE STORIE DEI GOL: da un gol vero del Campionato Sammarinese a una storia
 * Instagram 1080x1920, con due o tre numeri sempre diversi.
 *
 * Qui solo i conti e l'HTML: niente rete, niente browser. La fotografia la fa
 * scripts/storie-gol.mjs, e la pubblicazione (quando ci sara') un altro passo.
 *
 * I DATI. Referti e calendario sono quelli dell'app (src/eventi-dati.js,
 * src/calendario-dati.js, dalla FSGC). Da fuori arrivano due cose che stanno
 * nel database e non nei file:
 *   - aderenti: i calciatori che hanno detto «ci sto», anche per i social
 *     (044, giocatori_aderenti()). SOLO LORO hanno nome e numeri personali in
 *     una storia; per gli altri la storia e' della squadra: «GOL DELLA VIRTUS».
 *   - possesso: in quante squadre di Fantatitano e' ciascun giocatore. Un
 *     numero aggregato, nessun nome di chi gioca.
 *
 * LE FIGURE. Niente foto dei calciatori (quelle della FSGC non sono nostre) e
 * niente stemmi ufficiali dei club: ogni squadra e' un tondo col suo colore e
 * la sua sigla, disegnato qui.
 */
import { buildSeason, mulberry32 } from '../../src/data.js';
import { CALENDARIO } from '../../src/calendario-dati.js';
import { REFERTI } from '../../src/eventi-dati.js';

const STAGIONE = buildSeason();
const GIOCATORI = new Map(STAGIONE.players.map((p) => [p.id, p]));
const CLUB = new Map(STAGIONE.clubs.map((c) => [c.id, c]));
const clubDi = (pid) => GIOCATORI.get(pid)?.clubId || pid.replace(/_\d+$/, '');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * I gol di un referto in ordine di minuto. Il referto li elenca dal piu'
 * recente; l'autogol vale per l'altra squadra; l'assist e' l'evento «assist»
 * della stessa squadra allo stesso minuto.
 */
export function golDelReferto(r) {
  const ev = [...r.eventi].reverse();
  const out = [];
  for (const [pid, minuto, tipo] of ev) {
    if (tipo !== 'goal' && tipo !== 'own_goal') continue;
    const suo = clubDi(pid);
    const squadra = tipo === 'own_goal' ? (suo === r.casa ? r.ospite : r.casa) : suo;
    const assist = tipo === 'goal' ? ev.find(([a, m, t]) => t === 'assist' && m === minuto && clubDi(a) === suo)?.[0] || null : null;
    out.push({ pid, minuto, autogol: tipo === 'own_goal', squadra, assist });
  }
  return out;
}

/** Classifica prima di una giornata: 3 punti, 1, 0; poi differenza reti e gol fatti. */
export function classificaPrima(g) {
  const t = new Map(STAGIONE.clubs.map((c) => [c.id, { id: c.id, pt: 0, gf: 0, gs: 0, gio: 0 }]));
  for (const [n, casa, osp, , , gc, go] of CALENDARIO) {
    if (n >= g || gc == null || go == null) continue;
    const a = t.get(casa), b = t.get(osp);
    a.gio++; b.gio++; a.gf += gc; a.gs += go; b.gf += go; b.gs += gc;
    if (gc > go) a.pt += 3; else if (gc < go) b.pt += 3; else { a.pt++; b.pt++; }
  }
  return [...t.values()].sort((x, y) => y.pt - x.pt || (y.gf - y.gs) - (x.gf - x.gs) || y.gf - x.gf);
}

/** Gol (non autogol) segnati da ciascuno nelle giornate prima di g. */
function marcatoriPrima(g) {
  const m = new Map();
  for (const r of REFERTI) if (r.g < g) for (const x of golDelReferto(r)) if (!x.autogol) m.set(x.pid, (m.get(x.pid) || 0) + 1);
  return m;
}

const nome = (pid) => { const p = GIOCATORI.get(pid); return p ? `${p.firstName} ${p.lastName}` : pid; };
const ord = (n) => `${n}°`;

/**
 * Tutto quello che si puo' dire di un gol, prima di scegliere. Ogni fatto ha
 * un peso: quelli rari (primo gol, tripletta, allo scadere) contano di piu'
 * e finiscono in cima alla storia.
 */
export function fattiDelGol(r, k, { aderenti = new Set(), possesso = {}, squadre = 0 } = {}) {
  const gol = golDelReferto(r);
  const x = gol[k];
  const club = CLUB.get(x.squadra);
  const avv = x.squadra === r.casa ? r.ospite : r.casa;
  const conta = (fino) => gol.slice(0, fino).reduce((s, y) => { s[y.squadra === r.casa ? 0 : 1]++; return s; }, [0, 0]);
  const prima = conta(k), dopo = conta(k + 1);
  const io = x.squadra === r.casa ? 0 : 1;
  const nominabile = !x.autogol && aderenti.has(x.pid);
  const fatti = [];
  const f = (peso, valore, testo, chiave) => fatti.push({ peso, valore: String(valore), testo, chiave });

  // --- la partita
  const [mio, suo] = [prima[io], prima[1 - io]];
  if (mio === suo) f(5, 'VANTAGGIO', mio === 0 ? 'sblocca la partita' : `torna avanti, ${dopo[io]}-${dopo[1 - io]}`, 'momento');
  else if (mio + 1 === suo) f(6, 'PAREGGIO', `${dopo[io]}-${dopo[1 - io]}, tutto da rifare`, 'momento');
  else if (mio > suo) f(3, `+${mio + 1 - suo}`, 'la fuga continua', 'momento');
  else f(3, `-${suo - mio - 1}`, 'riapre la partita', 'momento');
  if (x.minuto >= 88) f(8, `${x.minuto}'`, x.minuto > 90 ? 'in pieno recupero' : 'allo scadere', 'minuto');
  else if (x.minuto <= 5) f(7, `${x.minuto}'`, 'dopo pochi minuti', 'minuto');

  const precedenti = REFERTI.filter((y) => y.g < r.g).flatMap((y) => golDelReferto(y));
  const piuVeloce = Math.min(...precedenti.map((y) => y.minuto));
  if (precedenti.length && x.minuto < piuVeloce) f(9, `${x.minuto}'`, 'il gol piu\' veloce della stagione', 'minuto');

  // --- la squadra
  const cl = classificaPrima(r.g);
  const pos = cl.findIndex((c) => c.id === x.squadra) + 1;
  const riga = cl[pos - 1];
  if (riga.gio) {
    f(2, ord(pos), 'posto in classifica prima di questa giornata', 'classifica');
    f(2, riga.gf + dopo[io], 'gol della squadra in campionato', 'golsquadra');
    f(1, (riga.gf / riga.gio).toFixed(1).replace('.', ','), 'gol a partita finora', 'media');
  }
  const andata = CALENDARIO.find(([n, a, b, , , gc]) => n < r.g && gc != null && ((a === r.casa && b === r.ospite) || (a === r.ospite && b === r.casa)));
  if (andata) {
    const [n, a, , , , gc, go] = andata;
    const [m, s] = a === x.squadra ? [gc, go] : [go, gc];
    f(3, `${m}-${s}`, `alla ${n}ª contro ${CLUB.get(avv).name}`, 'precedente');
  }

  // --- il giocatore, solo se ha detto «ci sto»
  if (nominabile) {
    const nelMatch = gol.slice(0, k + 1).filter((y) => y.pid === x.pid && !y.autogol).length;
    if (nelMatch === 2) f(8, 'DOPPIETTA', 'secondo gol in questa partita', 'match');
    if (nelMatch >= 3) f(10, 'TRIPLETTA', `${nelMatch} gol in questa partita`, 'match');
    const marc = marcatoriPrima(r.g);
    const stag = (marc.get(x.pid) || 0) + nelMatch;
    if (stag === 1) f(7, '1°', 'primo gol in campionato', 'stagione');
    else f(4, stag, 'gol in campionato', 'stagione');
    const testa = Math.max(0, ...marc.values());
    if (stag > 1 && stag > testa) f(9, stag, 'in testa ai marcatori', 'marcatori');
    // Il numero conta quando e' grande: «1 squadra lo ha in rosa» non dice niente.
    const n = possesso[x.pid] || 0;
    if (squadre && n >= 5) f(n >= 20 ? 7 : 5, n, 'squadre di Fantatitano lo hanno in rosa', 'fanta');
    if (x.assist && aderenti.has(x.assist)) f(3, 'ASSIST', nome(x.assist), 'assist');
  }

  return {
    id: `${r.g}-${r.casa}-${r.ospite}-${x.minuto}-${x.pid}`,
    g: r.g, minuto: x.minuto, autogol: x.autogol, nominabile,
    marcatore: nominabile ? nome(x.pid) : null,
    ruolo: nominabile ? GIOCATORI.get(x.pid)?.role : null,
    squadra: club, avversaria: CLUB.get(avv),
    casa: CLUB.get(r.casa), ospite: CLUB.get(r.ospite), punteggio: dopo,
    fatti,
  };
}

/**
 * Due o tre fatti: il piu' raro sempre, gli altri pescati a caso fra i
 * rimanenti, un solo fatto per tema (due «minuti» insieme dicono la stessa
 * cosa). Il caso e' fissato dall'id del gol: la stessa storia rifatta esce
 * uguale.
 */
export function scegli(storia, quanti = 3) {
  const rnd = mulberry32([...storia.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7));
  const per = [...storia.fatti].sort((a, b) => b.peso - a.peso);
  const scelti = [per[0]];
  const resto = per.slice(1).filter((x) => x.chiave !== per[0].chiave);
  while (scelti.length < quanti && resto.length) {
    const tot = resto.reduce((s, x) => s + x.peso, 0);
    let t = rnd() * tot, i = 0;
    while ((t -= resto[i].peso) > 0) i++;
    const [x] = resto.splice(i, 1);
    scelti.push(x);
    for (let j = resto.length - 1; j >= 0; j--) if (resto[j].chiave === x.chiave) resto.splice(j, 1);
  }
  return scelti;
}

export const MODELLI = ['urlo', 'tabellone', 'scheda', 'squadra'];

/** Il modello: chi non ha nome ha le storie della squadra; gli altri girano. */
export function modelloPer(storia) {
  if (!storia.nominabile) return storia.punteggio[0] + storia.punteggio[1] > 1 ? 'tabellone' : 'squadra';
  const rnd = mulberry32([...storia.id].reduce((h, c) => (h * 33 + c.charCodeAt(0)) >>> 0, 11));
  return ['urlo', 'tabellone', 'scheda'][Math.floor(rnd() * 3)];
}

/** Testo scuro sui colori chiari (il giallo della Folgore), bianco sugli altri. */
function inchiostro(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? '#0A0A0C' : '#FFFFFF';
}
const tondo = (c, cls = '') => `<span class="tondo ${cls}" style="background:${c.color};color:${inchiostro(c.color)}">${esc(c.shortName)}</span>`;

/** La storia in HTML. radice: l'indirizzo della cartella del progetto, per font e sfondo. */
export function htmlStoria(storia, modello = modelloPer(storia), radice = '../..') {
  const fatti = scegli(storia, 3);
  const [gc, go] = storia.punteggio;
  const chi = storia.nominabile ? esc(storia.marcatore) : storia.autogol ? 'Autogol' : `Gol della ${esc(storia.squadra.name)}`;
  const risultato = `<div class="ris">${tondo(storia.casa)}<b>${gc}<i>–</i>${go}</b>${tondo(storia.ospite)}</div>`;
  const chips = fatti.map((x) => `<div class="fatto"><b>${esc(x.valore)}</b><span>${esc(x.testo)}</span></div>`).join('');
  const testa = `<div class="testa"><img src="${radice}/media/logo-mask.png" alt=""><span>Fantatitano</span><em>${storia.g}ª giornata</em></div>`;
  const piede = `<div class="piede">Il fantacalcio del Campionato Sammarinese · <b>fantatitano.site</b></div>`;
  let corpo;
  if (modello === 'urlo') {
    corpo = `<div class="urlo"><div class="min">${storia.minuto}'</div><h1>GOL!</h1><h2>${chi}</h2>
      <div class="sq">${tondo(storia.squadra, 'mini')}<span>${esc(storia.squadra.name)}</span></div></div>
      ${risultato}<div class="fatti">${chips}</div>`;
  } else if (modello === 'tabellone') {
    corpo = `<div class="tab"><div class="lampo">GOL · ${storia.minuto}'</div>
      <div class="squadre"><div>${tondo(storia.casa, 'big')}<span>${esc(storia.casa.name)}</span></div>
      <b class="num">${gc}<i>:</i>${go}</b>
      <div>${tondo(storia.ospite, 'big')}<span>${esc(storia.ospite.name)}</span></div></div>
      <h2>${chi}</h2></div><div class="fatti">${chips}</div>`;
  } else if (modello === 'scheda') {
    corpo = `<div class="scheda"><div class="occhio">GOL al ${storia.minuto}'</div><h2 class="nome">${chi}</h2>
      <div class="sq">${tondo(storia.squadra, 'mini')}<span>${esc(storia.squadra.name)}${storia.ruolo ? ` · ${{ P: 'portiere', D: 'difensore', C: 'centrocampista', A: 'attaccante' }[storia.ruolo]}` : ''}</span></div>
      <div class="griglia">${chips}</div></div>${risultato}`;
  } else {
    corpo = `<div class="colore" style="--c:${storia.squadra.color};--t:${inchiostro(storia.squadra.color)}">
      ${tondo(storia.squadra, 'enorme')}<h1>GOL</h1><h2>${esc(storia.squadra.name)}</h2><div class="min2">${storia.minuto}'</div></div>
      ${risultato}<div class="fatti">${chips}</div>`;
  }
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><style>
@font-face{font-family:Anton;src:url(${radice}/media/font/anton-400-latin.woff2)}
@font-face{font-family:Lato;font-weight:700;src:url(${radice}/media/font/lato-700-latin.woff2)}
@font-face{font-family:Lato;font-weight:900;src:url(${radice}/media/font/lato-900-latin.woff2)}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1080px;height:1920px;overflow:hidden}
body{font-family:Lato,sans-serif;color:#fff;background:#04173B;position:relative}
.sfondo{position:absolute;left:0;right:0;top:0;height:620px;background:url(${radice}/media/sfondo-titano.jpg) center bottom/cover}
.sfondo::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(4,23,59,.25),rgba(4,23,59,0) 40%,#04173B)}
.wrap{position:absolute;inset:0;padding:150px 72px 120px;display:flex;flex-direction:column;gap:46px}
.testa{display:flex;align-items:center;gap:16px;font:400 40px/1 Anton;letter-spacing:.03em;text-transform:uppercase}
.testa img{width:60px;filter:brightness(0) saturate(100%) invert(91%) sepia(62%) saturate(758%) hue-rotate(20deg)}
.testa em{margin-left:auto;font-style:normal;color:#D9F51F;font-size:34px}
.tondo{display:inline-grid;place-items:center;width:120px;height:120px;border-radius:50%;font:400 40px/1 Anton;letter-spacing:.02em;
  border:6px solid #04173B;box-shadow:0 0 0 4px #D9F51F;flex:none}
.tondo.mini{width:72px;height:72px;font-size:24px;border-width:4px;box-shadow:0 0 0 3px #D9F51F}
.tondo.big{width:190px;height:190px;font-size:60px}
.tondo.enorme{width:300px;height:300px;font-size:96px;border-width:10px;box-shadow:0 0 0 8px #D9F51F}
.ris{display:flex;align-items:center;justify-content:center;gap:40px;padding:34px;border-radius:40px;background:rgba(255,255,255,.07);border:3px solid rgba(255,255,255,.14)}
.ris b{font:400 130px/1 Anton;letter-spacing:.02em}.ris b i{font-style:normal;color:#D9F51F;margin:0 18px}
.fatti{display:flex;flex-direction:column;gap:22px}
.fatto{display:flex;align-items:center;gap:30px;padding:26px 34px;border-radius:30px;background:#D9F51F;color:#0A0A0C;box-shadow:10px 10px 0 #4B06FC}
.fatto:nth-child(2){background:#fff;transform:rotate(-1.2deg)}
.fatto b{font:400 76px/1 Anton;min-width:150px}
.fatto span{font:900 38px/1.15 Lato}
.urlo{margin-top:180px;text-align:left}
.urlo .min{display:inline-block;padding:10px 26px;border-radius:999px;background:#4B06FC;font:400 56px/1 Anton}
.urlo h1{font:400 300px/.86 Anton;color:#D9F51F;margin-top:10px;text-shadow:12px 12px 0 #4B06FC}
.urlo h2,.tab h2{font:400 96px/1 Anton;text-transform:uppercase;margin-top:18px}
.sq{display:flex;align-items:center;gap:20px;margin-top:20px;font:900 40px Lato}
.tab{margin-top:220px;text-align:center}
.lampo{display:inline-block;padding:16px 40px;border-radius:999px;background:#D9F51F;color:#0A0A0C;font:400 64px/1 Anton;transform:rotate(-3deg);box-shadow:8px 8px 0 #4B06FC}
.squadre{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;margin-top:60px}
.squadre div{display:flex;flex-direction:column;align-items:center;gap:20px;font:900 38px Lato}
.num{font:400 200px/1 Anton}.num i{font-style:normal;color:#D9F51F}
.scheda{margin-top:200px}
.occhio{font:400 56px/1 Anton;color:#D9F51F;letter-spacing:.04em}
.nome{font:400 150px/.92 Anton;text-transform:uppercase;margin-top:16px}
.griglia{display:flex;flex-direction:column;gap:22px;margin-top:44px}
.colore{margin-top:120px;padding:60px 40px;border-radius:50px;background:var(--c);color:var(--t);text-align:center;box-shadow:14px 14px 0 #D9F51F}
.colore h1{font:400 260px/.9 Anton;margin-top:20px}.colore h2{font:400 90px/1 Anton;text-transform:uppercase}
.min2{display:inline-block;margin-top:24px;padding:10px 30px;border-radius:999px;background:#04173B;color:#D9F51F;font:400 60px/1 Anton}
.piede{margin-top:auto;text-align:center;font:700 30px Lato;opacity:.85}.piede b{color:#D9F51F}
</style></head><body><div class="sfondo"></div><div class="wrap">${testa}${corpo}${piede}</div></body></html>`;
}

/** Tutte le storie di una giornata gia' giocata, nell'ordine dei gol. */
export function storieDellaGiornata(g, dati) {
  return REFERTI.filter((r) => r.g === g).flatMap((r) => golDelReferto(r).map((_, k) => fattiDelGol(r, k, dati)));
}
