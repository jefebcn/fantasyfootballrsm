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

/**
 * Gli sfondi (social/gol/sfondi) e le pose (social/gol/giocatori), tutti
 * generati per Fantatitano il 24/10/2026: il Titano in sei atmosfere, cinque
 * scorci di stadio, quattro astratti in grigio che prendono il colore della
 * squadra che segna. Le pose sono calciatori qualunque, non ritratti: hanno la
 * maglia magenta e la pagina la ridipinge nel colore del club.
 */
export const SFONDI = ['titano-tramonto', 'titano-notte', 'titano-temporale', 'titano-neve', 'titano-fuochi', 'titano-nebbia',
  'stadio-pioggia', 'stadio-rete', 'stadio-alto', 'stadio-bandierina', 'stadio-rigore',
  'astratto-esplosione', 'astratto-fumetto', 'astratto-velocita', 'astratto-tifo'];
export const POSE = ['braccia', 'scivolata', 'salto', 'tiro'];

const semeDi = (testo, base) => [...testo].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, base);

/**
 * Lo sfondo della n-esima storia della giornata. L'ordine e' rimescolato per
 * giornata e poi si scorre: due storie di fila non hanno mai lo stesso sfondo,
 * e prima di ripeterne uno passano tutti.
 */
export function sfondoPer(storia) {
  const rnd = mulberry32(storia.g * 7919);
  const giro = [...SFONDI].sort(() => rnd() - 0.5);
  return giro[(storia.n || 0) % giro.length];
}
export function posaPer(storia) {
  return POSE[(semeDi(storia.squadra.id, storia.g) + (storia.n || 0)) % POSE.length];
}

/** Il modello: chi non ha nome ha le storie della squadra; gli altri girano. */
export function modelloPer(storia) {
  if (!storia.nominabile) return (storia.n || 0) % 2 ? 'tabellone' : 'squadra';
  const rnd = mulberry32(semeDi(storia.id, 11));
  return ['urlo', 'tabellone', 'scheda'][Math.floor(rnd() * 3)];
}

/** Testo scuro sui colori chiari (il giallo della Folgore), bianco sugli altri. */
function inchiostro(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? '#0A0A0C' : '#FFFFFF';
}
/** «Gol della Virtus», «del Cosmos», «dell'Academy», «de La Fiorita». */
const ARTICOLO = { virtus: 'della ', folgore: 'della ', libertas: 'della ', juvenes: 'della ', lafiorita: 'de ', academy: "dell'" };
export const golDi = (c) => `Gol ${ARTICOLO[c.id] || 'del '}${c.name}`;
const tondo = (c, cls = '') => `<span class="tondo ${cls}" style="background:${c.color};color:${inchiostro(c.color)}">${esc(c.shortName)}</span>`;

/**
 * La ridipintura della maglia, dentro la pagina: ogni pixel magenta prende il
 * colore del club tenendo la sua luce, cosi' pieghe e ombre del disegno
 * restano. Bianchi, pelle, capelli ed erba non sono magenta e non si toccano.
 * Finito, il body prende data-pronto: e' il segnale per la fotografia.
 */
const RIDIPINGI = `<script>
(async () => {
  const hsv = (r, g, b) => { const M = Math.max(r, g, b), m = Math.min(r, g, b), d = M - m;
    let h = 0; if (d) h = M === r ? ((g - b) / d) % 6 : M === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [((h / 6) + 1) % 1, M ? d / M : 0, M]; };
  const rgb = (h, s, v) => { const f = (n) => { const k = (n + h * 6) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
    return [f(5), f(3), f(1)]; };
  for (const c of document.querySelectorAll('canvas.gioc')) {
    const img = new Image(); img.src = c.dataset.src; await img.decode();
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const dati = x.getImageData(0, 0, c.width, c.height), p = dati.data;
    const col = c.dataset.colore; const [th, ts, tv] = hsv(...[1, 3, 5].map((i) => parseInt(col.slice(i, i + 2), 16) / 255));
    for (let i = 0; i < p.length; i += 4) {
      if (p[i + 3] < 10) continue;
      const [h, s, v] = hsv(p[i] / 255, p[i + 1] / 255, p[i + 2] / 255);
      if (h < 0.78 || h > 0.95 || s < 0.2 || v < 0.05) continue;
      const luce = Math.min(1, v / 0.9);
      const nv = tv < 0.3 ? (tv * 0.85 + 0.15) * luce : tv * luce;
      const [r, g, b] = rgb(th, ts * Math.min(1, s / 0.75), Math.min(1, nv));
      p[i] = r * 255; p[i + 1] = g * 255; p[i + 2] = b * 255;
    }
    x.putImageData(dati, 0, 0);
  }
  await document.fonts.ready;
  await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
  document.body.dataset.pronto = '1';
})();
<\/script>`;

/** La storia in HTML. radice: l'indirizzo della cartella del progetto, per font, sfondi e pose. */
export function htmlStoria(storia, modello = modelloPer(storia), radice = '../..') {
  // la carta della squadra occupa mezza storia: li' i fatti sono due
  const fatti = scegli(storia, modello === 'squadra' ? 2 : 3);
  const [gc, go] = storia.punteggio;
  const sfondo = sfondoPer(storia);
  const chi = storia.nominabile ? esc(storia.marcatore) : storia.autogol ? 'Autogol' : esc(golDi(storia.squadra));
  const risultato = `<div class="ris">${tondo(storia.casa)}<b>${gc}<i>–</i>${go}</b>${tondo(storia.ospite)}</div>`;
  const chips = fatti.map((x) => `<div class="fatto"><b>${esc(x.valore)}</b><span>${esc(x.testo)}</span></div>`).join('');
  const testa = `<div class="testa"><img src="${radice}/media/logo-mask.png" alt=""><span>Fantatitano</span><em>${storia.g}ª giornata</em></div>`;
  const piede = `<div class="piede">Il fantacalcio del Campionato Sammarinese · <b>fantatitano.site</b></div>`;
  const giocatore = (cls) => `<canvas class="gioc ${cls}" data-src="${radice}/social/gol/giocatori/${posaPer(storia)}.png" data-colore="${storia.squadra.color}"></canvas>`;
  const ruolo = storia.ruolo ? ` · ${{ P: 'portiere', D: 'difensore', C: 'centrocampista', A: 'attaccante' }[storia.ruolo]}` : '';
  let corpo, figura = '';
  if (modello === 'urlo') {
    figura = giocatore('a-destra');
    corpo = `<div class="urlo"><div class="min">${storia.minuto}'</div><h1>GOL!</h1><h2>${chi}</h2>
      <div class="sq">${tondo(storia.squadra, 'mini')}<span>${esc(storia.squadra.name)}</span></div></div>
      <div class="giu">${risultato}<div class="fatti">${chips}</div></div>`;
  } else if (modello === 'tabellone') {
    corpo = `<div class="tab"><div class="lampo">GOL · ${storia.minuto}'</div>
      <div class="squadre"><div>${tondo(storia.casa, 'big')}<span>${esc(storia.casa.name)}</span></div>
      <b class="num">${gc}<i>:</i>${go}</b>
      <div>${tondo(storia.ospite, 'big')}<span>${esc(storia.ospite.name)}</span></div></div>
      <h2>${chi}</h2></div><div class="giu"><div class="fatti">${chips}</div></div>`;
  } else if (modello === 'scheda') {
    figura = giocatore('al-centro');
    corpo = `<div class="scheda"><div class="occhio">GOL al ${storia.minuto}'</div><h2 class="nome">${chi}</h2>
      <div class="sq">${tondo(storia.squadra, 'mini')}<span>${esc(storia.squadra.name)}${ruolo}</span></div>
      <div class="griglia">${chips}</div>${risultato}</div>`;
  } else {
    figura = giocatore('sopra-carta');
    corpo = `<div class="colore" style="--c:${storia.squadra.color};--t:${inchiostro(storia.squadra.color)}">
      <h1>GOL</h1><h2>${esc(storia.squadra.name)}</h2><div class="min2">${storia.minuto}'</div></div>
      <div class="giu">${risultato}<div class="fatti">${chips}</div></div>`;
  }
  const tinta = sfondo.startsWith('astratto') ? `<div class="tinta" style="background:${storia.squadra.color}"></div>` : '';
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><style>
@font-face{font-family:Anton;src:url(${radice}/media/font/anton-400-latin.woff2)}
@font-face{font-family:Lato;font-weight:700;src:url(${radice}/media/font/lato-700-latin.woff2)}
@font-face{font-family:Lato;font-weight:900;src:url(${radice}/media/font/lato-900-latin.woff2)}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1080px;height:1920px;overflow:hidden}
body{font-family:Lato,sans-serif;color:#fff;background:#04173B;position:relative}
.sfondo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.tinta{position:absolute;inset:0;mix-blend-mode:color;opacity:.9}
/* il velo: leggero in alto, dove lo sfondo racconta; pieno in basso, dove si legge */
.velo{position:absolute;inset:0;background:linear-gradient(180deg,rgba(4,23,59,.55) 0%,rgba(4,23,59,.1) 22%,rgba(4,23,59,.2) 45%,rgba(4,23,59,.8) 68%,rgba(4,23,59,.96) 100%)}
.gioc{position:absolute;z-index:1;filter:drop-shadow(0 30px 40px rgba(0,0,0,.55))}
.gioc.a-destra{right:-130px;top:470px;height:1080px}
.gioc.al-centro{left:50%;transform:translateX(-50%);top:250px;height:900px}
.gioc.sopra-carta{left:50%;transform:translateX(-50%);top:230px;height:640px}
.wrap{position:absolute;inset:0;z-index:2;padding:140px 72px 110px;display:flex;flex-direction:column;gap:40px}
.testa{display:flex;align-items:center;gap:16px;font:400 40px/1 Anton;letter-spacing:.03em;text-transform:uppercase;text-shadow:0 2px 12px rgba(0,0,0,.5)}
.testa img{width:60px;filter:brightness(0) saturate(100%) invert(91%) sepia(62%) saturate(758%) hue-rotate(20deg)}
.testa em{margin-left:auto;font-style:normal;color:#D9F51F;font-size:34px}
.tondo{display:inline-grid;place-items:center;width:120px;height:120px;border-radius:50%;font:400 40px/1 Anton;letter-spacing:.02em;
  border:6px solid #04173B;box-shadow:0 0 0 4px #D9F51F;flex:none}
.tondo.mini{width:72px;height:72px;font-size:24px;border-width:4px;box-shadow:0 0 0 3px #D9F51F}
.tondo.big{width:190px;height:190px;font-size:60px}
.ris{display:flex;align-items:center;justify-content:center;gap:40px;padding:26px;border-radius:40px;background:rgba(4,23,59,.72);
  border:3px solid rgba(255,255,255,.16);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.ris b{font:400 120px/1 Anton;letter-spacing:.02em}.ris b i{font-style:normal;color:#D9F51F;margin:0 18px}
.giu{margin-top:auto;display:flex;flex-direction:column;gap:40px}
.fatti{display:flex;flex-direction:column;gap:36px}
.fatto{display:flex;align-items:center;gap:30px;padding:22px 34px;border-radius:30px;background:#D9F51F;color:#0A0A0C;box-shadow:10px 10px 0 #4B06FC}
.fatto:nth-child(2){background:#fff;transform:rotate(-1.2deg)}
.fatto:nth-child(3){background:#4B06FC;color:#fff;box-shadow:10px 10px 0 #D9F51F;transform:rotate(.8deg)}
.fatto b{font:400 72px/1 Anton;min-width:150px}
.fatto span{font:900 36px/1.15 Lato}
.urlo{margin-top:120px;max-width:590px;text-shadow:0 4px 24px rgba(0,0,0,.45)}
.urlo .min{display:inline-block;padding:10px 26px;border-radius:999px;background:#4B06FC;font:400 56px/1 Anton;text-shadow:none}
.urlo h1{font:400 290px/.86 Anton;color:#D9F51F;margin-top:10px;text-shadow:12px 12px 0 #4B06FC}
.urlo h2,.tab h2{font:400 92px/1 Anton;text-transform:uppercase;margin-top:18px}
.sq{display:flex;align-items:center;gap:20px;margin-top:20px;font:900 40px Lato}
.tab{margin-top:200px;text-align:center;text-shadow:0 4px 24px rgba(0,0,0,.5)}
.lampo{display:inline-block;padding:16px 40px;border-radius:999px;background:#D9F51F;color:#0A0A0C;font:400 64px/1 Anton;transform:rotate(-3deg);box-shadow:8px 8px 0 #4B06FC;text-shadow:none}
.squadre{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;margin-top:60px}
.squadre div{display:flex;flex-direction:column;align-items:center;gap:20px;font:900 38px Lato}
.num{font:400 200px/1 Anton}.num i{font-style:normal;color:#D9F51F}
.scheda{margin-top:auto;display:flex;flex-direction:column;gap:0}
.occhio{display:inline-block;align-self:flex-start;padding:10px 26px;border-radius:999px;background:#D9F51F;color:#0A0A0C;font:400 52px/1 Anton;letter-spacing:.03em}
.nome{font:400 140px/.92 Anton;text-transform:uppercase;margin-top:18px;text-shadow:0 6px 30px rgba(0,0,0,.6)}
.griglia{display:flex;flex-direction:column;gap:36px;margin:40px 0 40px}
.colore{margin-top:600px;padding:34px 40px 44px;border-radius:50px;background:var(--c);color:var(--t);text-align:center;box-shadow:14px 14px 0 #D9F51F}
.colore h1{font:400 170px/.9 Anton}.colore h2{font:400 84px/1 Anton;text-transform:uppercase}
.min2{display:inline-block;margin-top:20px;padding:10px 30px;border-radius:999px;background:#04173B;color:#D9F51F;font:400 56px/1 Anton}
.piede{text-align:center;font:700 30px Lato;opacity:.9;text-shadow:0 2px 10px rgba(0,0,0,.6)}.piede b{color:#D9F51F}
</style></head><body><img class="sfondo" src="${radice}/social/gol/sfondi/${sfondo}.jpg" alt="">${tinta}<div class="velo"></div>${figura}
<div class="wrap">${testa}${corpo}${piede}</div>${RIDIPINGI}</body></html>`;
}

/** Tutte le storie di una giornata gia' giocata, nell'ordine dei gol. */
export function storieDellaGiornata(g, dati) {
  return REFERTI.filter((r) => r.g === g).flatMap((r) => golDelReferto(r).map((_, k) => fattiDelGol(r, k, dati)))
    .map((s, n) => ({ ...s, n }));
}
