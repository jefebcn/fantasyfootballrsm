/**
 * La card della giornata da condividere (src/card-giornata.js).
 *
 * Si disegna con dati finti, senza l'app intorno: deve uscire un PNG 1080x1920
 * (il formato delle storie) nei due casi, lega a punti con il personaggio e
 * scontro diretto con lo stemma e un nome di squadra lunghissimo. Le immagini
 * finiscono in $USCITA per guardarle; a decidere sono i controlli.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:4173';
const USCITA = process.env.USCITA || '/tmp';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

const testi = { giornata: 'GIORNATA 10', fantapunti: 'Fantapunti', migliori: 'I migliori', invito: 'Gioca gratis con me su FANTATITANO', vs: 'contro' };
const CASI = {
  punti: {
    giornata: 10, stato: 'PROVVISORIO', squadra: 'Hasta El Chapo FC', allenatore: 'Alessandro', lega: 'Fantatitano Open',
    punti: '78,5', sfida: null, personaggio: 'media/avatar/1.webp',
    stemma: { foto: null, iniziali: 'HC', colore: '#1B84C6', inchiostro: '#fff' },
    numeri: [{ valore: '3ª', etichetta: 'nella giornata su 81' }, { valore: '12ª', etichetta: 'in classifica' }],
    migliori: [{ nome: 'Prandelli', ruolo: 'A', voto: '11,5', capitano: true }, { nome: 'Colagiovanni', ruolo: 'C', voto: '8' }, { nome: 'Guidotti', ruolo: 'D', voto: '7,5' }],
    testi,
  },
  sfida: {
    giornata: 9, stato: 'DEFINITIVO', squadra: 'Campionato dei Sudati di San Marino Football Club', allenatore: 'Giulia', lega: 'Lega degli amici del giovedì sera',
    punti: '71', sfida: { gf: 2, gs: 1, avversaria: 'Serravalle United', puntiAvversaria: '66,5' }, personaggio: null,
    stemma: { foto: null, iniziali: 'CS', colore: '#8a1d1d', inchiostro: '#fff' },
    numeri: [{ valore: 'VITTORIA', etichetta: 'Giornata 9' }, { valore: '1ª', etichetta: 'in classifica' }],
    migliori: [{ nome: 'Pancotti', ruolo: 'A', voto: '10' }, { nome: 'Nome Lunghissimo Di Un Giocatore Straniero', ruolo: 'P', voto: '7' }],
    testi,
  },
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const p = await b.newPage();
  const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  await p.goto(`${BASE}/robots.txt`);
  await p.evaluate(() => new Promise((ok) => {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/styles/font.css'; l.onload = ok; l.onerror = ok;
    document.head.appendChild(l);
  }));
  for (const [nome, dati] of Object.entries(CASI)) {
    const r = await p.evaluate(async (d) => {
      const { disegnaCard } = await import('/src/card-giornata.js');
      const blob = await disegnaCard(d);
      const bmp = await createImageBitmap(blob);
      const cv = new OffscreenCanvas(bmp.width, bmp.height); const cx = cv.getContext('2d'); cx.drawImage(bmp, 0, 0);
      const px = (x, y) => Array.from(cx.getImageData(x, y, 1, 1).data);
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return { tipo: blob.type, w: bmp.width, h: bmp.height, logo: px(134, 262), cielo: px(20, 20), sfondo: px(540, 1850), monte: px(540, 700), base64: btoa(bin),
        anton: document.fonts.check('40px Anton') };
    }, dati);
    fs.writeFileSync(path.join(USCITA, `card-${nome}.png`), Buffer.from(r.base64, 'base64'));
    et(r.tipo === 'image/png' && r.w === 1080 && r.h === 1920, `${nome}: PNG 1080x1920 (${r.tipo} ${r.w}x${r.h})`);
    et(r.anton, `${nome}: Anton caricato prima di disegnare`);
    // il riquadro del logo e' bianco come lo sfondo di media/logo.png; in alto il
    // cielo blu notte del Titano, in fondo il viola del marchio
    et(r.logo[0] > 200 && r.logo[1] > 200 && r.logo[2] > 200, `${nome}: riquadro bianco del logo (${r.logo})`);
    et(r.cielo[2] > r.cielo[0] + 30 && r.cielo[2] < 110, `${nome}: cielo blu notte (${r.cielo})`);
    et(r.sfondo[2] > r.sfondo[1] + 30 && r.sfondo[0] > r.sfondo[1], `${nome}: in fondo viola (${r.sfondo})`);
    et(r.monte.join() !== r.cielo.join(), `${nome}: il disegno del Titano c'e' (${r.monte})`);
  }
  et(!errori.length, `nessun errore nella pagina (${errori.join(' | ')})`);
  await b.close();
  ok.forEach((x) => console.log('  ok  ', x)); ko.forEach((x) => console.log('  KO  ', x));
  console.log(`card-giornata: ${ok.length} ok, ${ko.length} KO · immagini in ${USCITA}`);
  process.exit(ko.length ? 1 : 0);
})();
