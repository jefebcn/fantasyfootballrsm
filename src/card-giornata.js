/**
 * La card della giornata da condividere: un'immagine 1080x1920 (il formato
 * delle storie) disegnata nel telefono, senza passare dal server.
 *
 * Perche' un'immagine e non solo un testo: e' la cosa che chi non conosce
 * Fantatitano vede nelle storie di un amico, quindi e' il modo piu' economico
 * di farsi conoscere (piano di crescita, Alex 25/11: «partire dalla card da
 * condividere»).
 *
 * Il disegno riceve dati gia' pronti (scheda.js li calcola dalla lega) e non
 * guarda lo stato dell'app: cosi' si prova da solo, con dati finti, in
 * prove/card-giornata.cjs.
 *
 * Regole del marchio (CLAUDE.md): il logo e' media/logo.png cosi' com'e', su
 * un riquadro bianco come il suo sfondo; Anton per i titoli; nessun indirizzo
 * del sito nell'immagine (il link d'invito va nel testo che l'accompagna).
 * I contenuti stanno fra 200 e 1720 px d'altezza: sopra e sotto, nelle storie
 * di Instagram, ci sono il nome del profilo e la barra delle risposte.
 */

export const LARGHEZZA = 1080, ALTEZZA = 1920;

const VIOLA = '#4B0BFF', NOTTE = '#140440', ORO = '#F2B705', BIANCO = '#FFFFFF';
const RUOLI = { P: [ORO, '#1A1302'], D: ['#3DDC84', '#0C2418'], C: ['#2F7BFF', BIANCO], A: ['#FF4D4D', BIANCO] };
const TITOLI = 'Anton, Impact, "Arial Narrow", sans-serif';
const TESTO = 'Lato, "Helvetica Neue", Arial, sans-serif';

/** Un'immagine dello stesso sito (o data:), o null se non si carica. */
async function immagine(src) {
  if (!src) return null;
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    return img;
  } catch { return null; }
}

/** I caratteri vanno caricati prima di disegnare, se no il canvas usa quelli di riserva. */
async function caratteri() {
  if (!document.fonts?.load) return;
  await Promise.all(['100px Anton', '400 40px Lato', '700 40px Lato', '900 40px Lato']
    .map((f) => document.fonts.load(f).catch(() => null)));
}

/** La dimensione piu' grande (fino a `max`) con cui il testo sta in `larghezza`. */
function misura(cx, testo, peso, famiglia, max, larghezza, min = 20) {
  let s = max;
  for (; s > min; s -= 2) { cx.font = `${peso} ${s}px ${famiglia}`; if (cx.measureText(testo).width <= larghezza) break; }
  cx.font = `${peso} ${s}px ${famiglia}`;
  return s;
}

/** Taglia con i puntini quello che non ci sta nemmeno alla dimensione minima. */
function taglia(cx, testo, larghezza) {
  if (cx.measureText(testo).width <= larghezza) return testo;
  let t = testo;
  while (t.length > 1 && cx.measureText(`${t}…`).width > larghezza) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

function rettangolo(cx, x, y, w, h, r) {
  cx.beginPath();
  cx.moveTo(x + r, y);
  cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r);
  cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r);
  cx.closePath();
}

/**
 * Lo sfondo: il Titano di notte disegnato da Alex (media/sfondo-titano-notte.jpg,
 * lo stesso della home dopo il tramonto), in alto dietro la squadra, e sotto
 * la notte che scende verso il viola del marchio. Il cielo sopra il disegno ha
 * lo stesso blu del suo bordo, con qualche stella, cosi' non si vede la
 * giunta. Senza l'immagine resta la sfumatura.
 */
const CIELO = '#05183F', BASE_MONTE = '#05173B';
function sfondo(cx, titano) {
  const g = cx.createLinearGradient(0, 0, 0, ALTEZZA);
  g.addColorStop(0, CIELO); g.addColorStop(0.57, BASE_MONTE); g.addColorStop(0.8, '#1E0870'); g.addColorStop(1, NOTTE);
  cx.fillStyle = g; cx.fillRect(0, 0, LARGHEZZA, ALTEZZA);
  // stelle fisse (sempre le stesse: la card di due amici deve sembrare la stessa serie)
  let seme = 7;
  const caso = () => { seme = (seme * 16807) % 2147483647; return seme / 2147483647; };
  cx.fillStyle = '#FFFFFF';
  for (let i = 0; i < 46; i++) {
    const x = caso() * LARGHEZZA, y = caso() * 330, r = 1 + caso() * 2.2;
    cx.globalAlpha = 0.25 + caso() * 0.55; cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2); cx.fill();
  }
  cx.globalAlpha = 1;
  if (titano) {
    const h = 820, w = h * (titano.naturalWidth / titano.naturalHeight);
    cx.drawImage(titano, (LARGHEZZA - w) / 2, 250, w, h);
    // il piede del monte si scioglie nella notte, e la notte nel viola
    const giu = cx.createLinearGradient(0, 800, 0, 1080);
    giu.addColorStop(0, 'rgba(5,23,59,0)'); giu.addColorStop(1, BASE_MONTE);
    cx.fillStyle = giu; cx.fillRect(0, 800, LARGHEZZA, 295);
  }
  // un alone viola sotto, dietro i numeri e i migliori
  const l = cx.createRadialGradient(LARGHEZZA / 2, 1500, 0, LARGHEZZA / 2, 1500, 620);
  l.addColorStop(0, 'rgba(110,40,255,.4)'); l.addColorStop(1, 'rgba(110,40,255,0)');
  cx.fillStyle = l; cx.fillRect(0, 0, LARGHEZZA, ALTEZZA);
}

function testata(cx, logo) {
  const x = 72, y = 200, lato = 124;
  cx.save();
  cx.shadowColor = 'rgba(0,0,0,.25)'; cx.shadowBlur = 24; cx.shadowOffsetY = 8;
  rettangolo(cx, x, y, lato, lato, 30); cx.fillStyle = BIANCO; cx.fill();
  cx.restore();
  if (logo) { cx.save(); rettangolo(cx, x, y, lato, lato, 30); cx.clip(); cx.drawImage(logo, x, y, lato, lato); cx.restore(); }
  cx.fillStyle = BIANCO; cx.textBaseline = 'alphabetic';
  cx.font = `64px ${TITOLI}`; cx.fillText('FANTATITANO', x + lato + 30, y + 70);
  cx.globalAlpha = 0.82; cx.font = `700 28px ${TESTO}`;
  cx.fillText('Il fantacalcio del Campionato Sammarinese', x + lato + 32, y + 112);
  cx.globalAlpha = 1;
}

function pillola(cx, testo, x, y) {
  cx.font = `40px ${TITOLI}`;
  const w = cx.measureText(testo).width + 56;
  rettangolo(cx, x, y, w, 70, 35); cx.fillStyle = ORO; cx.fill();
  cx.fillStyle = '#1A1302'; cx.textBaseline = 'middle'; cx.fillText(testo, x + 28, y + 37);
  cx.textBaseline = 'alphabetic';
}

/** Lo stemma: la foto caricata o le iniziali sul colore della squadra. */
function stemma(cx, foto, d, x, y, lato) {
  cx.save();
  cx.beginPath(); cx.arc(x + lato / 2, y + lato / 2, lato / 2, 0, Math.PI * 2); cx.closePath();
  cx.fillStyle = d.colore || VIOLA; cx.fill();
  cx.lineWidth = 10; cx.strokeStyle = BIANCO; cx.stroke();
  cx.clip();
  if (foto) cx.drawImage(foto, x, y, lato, lato);
  else {
    cx.fillStyle = d.inchiostro || BIANCO; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.font = `${Math.round(lato * 0.42)}px ${TITOLI}`;
    cx.fillText(String(d.iniziali || '').slice(0, 3).toUpperCase(), x + lato / 2, y + lato / 2 + 6);
  }
  cx.restore();
  cx.textAlign = 'left'; cx.textBaseline = 'alphabetic';
}

/** Il nome della squadra su una o due righe, il piu' grande possibile. */
function nomeSquadra(cx, nome, x, y, larghezza) {
  const parole = String(nome).toUpperCase().split(/\s+/).filter(Boolean);
  const unaRiga = parole.join(' ');
  if (misura(cx, unaRiga, '', TITOLI, 120, larghezza, 64) > 64 || parole.length < 2) {
    cx.fillText(taglia(cx, unaRiga, larghezza), x, y);
    return y;
  }
  // due righe: si cerca il taglio che lascia le due meta' piu' simili
  let meglio = null;
  for (let i = 1; i < parole.length; i++) {
    const a = parole.slice(0, i).join(' '), b = parole.slice(i).join(' ');
    cx.font = `100px ${TITOLI}`;
    const peggiore = Math.max(cx.measureText(a).width, cx.measureText(b).width);
    if (!meglio || peggiore < meglio.peggiore) meglio = { a, b, peggiore };
  }
  const s = Math.min(misura(cx, meglio.a, '', TITOLI, 110, larghezza, 44), misura(cx, meglio.b, '', TITOLI, 110, larghezza, 44));
  cx.font = `${s}px ${TITOLI}`;
  cx.fillText(taglia(cx, meglio.a, larghezza), x, y - s * 1.02);
  cx.fillText(taglia(cx, meglio.b, larghezza), x, y);
  return y;
}

function riquadro(cx, x, y, w, h) {
  rettangolo(cx, x, y, w, h, 28);
  cx.fillStyle = 'rgba(255,255,255,.12)'; cx.fill();
  cx.lineWidth = 2; cx.strokeStyle = 'rgba(255,255,255,.18)'; cx.stroke();
}

/**
 * Disegna la card e la restituisce come PNG.
 *
 * @param {object} d
 * @param {number} d.giornata
 * @param {string} d.stato            «DEFINITIVO», «PROVVISORIO», «IN CORSO»
 * @param {string} d.squadra
 * @param {string} d.allenatore
 * @param {string} d.lega
 * @param {string} d.punti            i fantapunti della giornata, gia' scritti («78,5»)
 * @param {{gf:number,gs:number,avversaria:string,puntiAvversaria:string}|null} d.sfida
 * @param {{valore:string,etichetta:string}[]} d.numeri   due o tre riquadri
 * @param {{nome:string,ruolo:string,voto:string,capitano?:boolean}[]} d.migliori
 * @param {string|null} d.personaggio indirizzo dell'immagine del personaggio
 * @param {{foto?:string|null,iniziali:string,colore?:string,inchiostro?:string}} d.stemma
 * @param {string} [d.logo]
 * @param {string|null} [d.sfondo]  il disegno di sfondo (null: solo la sfumatura)
 * @param {{giornata:string,fantapunti:string,migliori:string,invito:string,vs:string}} d.testi
 * @returns {Promise<Blob>}
 */
export async function disegnaCard(d) {
  const cv = document.createElement('canvas');
  cv.width = LARGHEZZA; cv.height = ALTEZZA;
  const cx = cv.getContext('2d');
  const [, logo, pers, foto, titano] = await Promise.all([
    caratteri(), immagine(d.logo || 'media/logo.png'), immagine(d.personaggio), immagine(d.stemma?.foto),
    immagine(d.sfondo === undefined ? 'media/sfondo-titano-notte.jpg' : d.sfondo),
  ]);

  sfondo(cx, titano);
  testata(cx, logo);
  pillola(cx, `${d.testi.giornata} · ${d.stato}`, 72, 370);

  // la squadra: personaggio a destra (o lo stemma), nome a sinistra
  const sinistra = 72, colonna = pers ? 560 : 600;
  if (pers) {
    const h = 640, w = h * (pers.naturalWidth / pers.naturalHeight);
    cx.save(); cx.shadowColor = 'rgba(0,0,0,.35)'; cx.shadowBlur = 40; cx.shadowOffsetY = 16;
    cx.drawImage(pers, LARGHEZZA - w - 40, 470, w, h);
    cx.restore();
    if (foto || d.stemma?.iniziali) stemma(cx, foto, d.stemma, LARGHEZZA - 200, 990, 130);
  } else {
    stemma(cx, foto, d.stemma, LARGHEZZA - 72 - 300, 540, 300);
  }
  cx.fillStyle = BIANCO;
  cx.save(); cx.shadowColor = 'rgba(0,0,0,.55)'; cx.shadowBlur = 18; cx.shadowOffsetY = 4;
  nomeSquadra(cx, d.squadra, sinistra, 700, colonna);
  cx.font = `700 40px ${TESTO}`; cx.globalAlpha = 0.92;
  cx.fillText(taglia(cx, d.allenatore || '', colonna), sinistra, 770);
  cx.font = `400 32px ${TESTO}`; cx.globalAlpha = 0.75;
  cx.fillText(taglia(cx, d.lega || '', colonna), sinistra, 822);
  cx.globalAlpha = 1;

  // il numero grande
  if (d.sfida) {
    cx.font = `220px ${TITOLI}`;
    cx.fillText(`${d.sfida.gf} – ${d.sfida.gs}`, sinistra - 6, 1100);
    cx.font = `700 36px ${TESTO}`;
    cx.fillText(taglia(cx, `${d.testi.vs} ${d.sfida.avversaria}`, colonna), sinistra, 1160);
    cx.globalAlpha = 0.8; cx.font = `400 32px ${TESTO}`;
    cx.fillText(`${d.punti} – ${d.sfida.puntiAvversaria} ${d.testi.fantapunti.toLowerCase()}`, sinistra, 1208);
    cx.globalAlpha = 1;
  } else {
    const s = misura(cx, d.punti, '', TITOLI, 260, colonna, 120);
    cx.fillText(d.punti, sinistra - 6, 1120);
    cx.font = `48px ${TITOLI}`; cx.fillStyle = ORO;
    cx.fillText(d.testi.fantapunti.toUpperCase(), sinistra, 1120 + Math.max(60, s * 0.25));
    cx.fillStyle = BIANCO;
  }

  cx.restore();

  // i numeri della giornata
  const numeri = (d.numeri || []).slice(0, 3);
  if (numeri.length) {
    const y = 1236, h = 160, spazio = 24;
    const w = (LARGHEZZA - 2 * sinistra - spazio * (numeri.length - 1)) / numeri.length;
    numeri.forEach((n, i) => {
      const x = sinistra + i * (w + spazio);
      riquadro(cx, x, y, w, h);
      cx.fillStyle = BIANCO; cx.textAlign = 'center';
      misura(cx, n.valore, '', TITOLI, 80, w - 40, 40);
      cx.fillText(n.valore, x + w / 2, y + 92);
      cx.font = `700 26px ${TESTO}`; cx.globalAlpha = 0.85;
      cx.fillText(taglia(cx, n.etichetta, w - 30), x + w / 2, y + 134);
      cx.globalAlpha = 1; cx.textAlign = 'left';
    });
  }

  // i migliori della formazione
  const migliori = (d.migliori || []).slice(0, 3);
  if (migliori.length) {
    let y = 1450;
    cx.fillStyle = ORO; cx.font = `40px ${TITOLI}`;
    cx.fillText(d.testi.migliori.toUpperCase(), sinistra, y); y += 18;
    for (const g of migliori) {
      const h = 58, w = LARGHEZZA - 2 * sinistra;
      riquadro(cx, sinistra, y, w, h);
      const [fondo, inchiostro] = RUOLI[g.ruolo] || [BIANCO, NOTTE];
      rettangolo(cx, sinistra + 14, y + 9, 40, 40, 10); cx.fillStyle = fondo; cx.fill();
      cx.fillStyle = inchiostro; cx.font = `900 26px ${TESTO}`; cx.textAlign = 'center';
      cx.fillText(g.ruolo, sinistra + 34, y + 39);
      cx.textAlign = 'left'; cx.fillStyle = BIANCO; cx.font = `700 32px ${TESTO}`;
      cx.fillText(taglia(cx, `${g.nome}${g.capitano ? ' (C)' : ''}`, w - 230), sinistra + 74, y + 41);
      cx.textAlign = 'right'; cx.font = `40px ${TITOLI}`;
      cx.fillText(g.voto, sinistra + w - 24, y + 45);
      cx.textAlign = 'left';
      y += h + 10;
    }
  }

  // l'invito, l'ultima riga dentro la zona sicura delle storie
  cx.fillStyle = BIANCO; cx.textAlign = 'center'; cx.globalAlpha = 0.9;
  misura(cx, d.testi.invito, '900', TESTO, 34, LARGHEZZA - 2 * sinistra, 22);
  cx.fillText(d.testi.invito, LARGHEZZA / 2, 1718);
  cx.globalAlpha = 1; cx.textAlign = 'left';

  return new Promise((ok, ko) => cv.toBlob((b) => (b ? ok(b) : ko(new Error('immagine non creata'))), 'image/png'));
}
