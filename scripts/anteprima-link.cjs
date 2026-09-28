/**
 * L'immagine che compare quando si condivide fantatitano.site.
 *
 *   node scripts/anteprima-link.cjs      (col server locale sulla 4173)
 *
 * Scrive media/anteprima.jpg, 1200x630: e' la misura che WhatsApp, Telegram
 * e gli altri usano per la scheda grande sotto il messaggio. Ogni invito a
 * una lega passa da li', e senza questa immagine il link arriva nudo — un
 * indirizzo blu in mezzo al testo, che sembra lo spam di tutti i giorni.
 *
 * Stessa pagina della grafica del Play Store (scripts/schermate-store.cjs):
 * marchio vero da styles/logo.css, nessuna seconda versione che resta
 * indietro. Cambia solo il taglio, e il margine: su certi telefoni la scheda
 * diventa quadrata e l'immagine viene ritagliata ai lati, quindi niente sta
 * vicino ai bordi sinistro e destro.
 *
 * SOTTO I 300 kB. Oltre, WhatsApp a volte non mostra l'anteprima e lascia
 * il link senza immagine — cioe' il problema che questo file risolve.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  const g = await ctx.newPage();
  await g.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
  await g.setContent(`<!doctype html><html lang="it"><head><meta charset="utf-8">
    <link rel="stylesheet" href="${BASE}/styles/font.css">
    <link rel="stylesheet" href="${BASE}/styles/logo.css">
    <link rel="stylesheet" href="${BASE}/styles/app.css">
    <style>
      html,body{margin:0;height:100%}
      body{display:grid;place-items:center;
        background:radial-gradient(120% 90% at 50% 0%, #1B84C6 0%, #0A4570 55%, #062033 100%)}
      .dentro{display:flex;flex-direction:column;align-items:center;gap:30px;padding:0 200px;text-align:center}
      .marchio{width:470px;color:#fff;filter:drop-shadow(0 6px 26px rgba(0,0,0,.45))}
      p{margin:0;font:700 30px/1.3 'Lato',var(--font-body,system-ui);color:rgba(255,255,255,.92);letter-spacing:.01em}
      b{color:#E5A11B;font-weight:800}
    </style></head>
    <body><div class="dentro">
      <i class="marchio" role="img" aria-label="Fantatitano"></i>
      <p>Il fantacalcio del <b>Campionato Sammarinese</b></p>
    </div></body></html>`, { waitUntil: 'load' });
  await g.evaluate(() => document.fonts && document.fonts.ready); await g.waitForTimeout(600);
  const fuori = path.join(__dirname, '..', 'media', 'anteprima.jpg');
  await g.screenshot({ path: fuori, type: 'jpeg', quality: 86 });
  const kb = Math.round(fs.statSync(fuori).size / 1024);
  console.log(`${fuori}  ${kb} kB`);
  if (kb > 300) { console.error('troppo pesante per WhatsApp: abbassa la qualita\''); process.exitCode = 1; }
  await b.close();
})();
