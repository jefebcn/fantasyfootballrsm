/**
 * Le pagine legali, anche come HTML statico.
 *
 * PERCHE'. Privacy e Termini nell'app stanno dietro al router a cancelletto
 * (#/privacy): per una persona col browser vanno benissimo, ma i moduli di
 * Google Play e di Apple chiedono un INDIRIZZO, e chi lo controlla — a volte
 * un programma, non una persona — apre quell'indirizzo e si aspetta di
 * leggere il testo. Se al posto del testo trova un'app che deve ancora
 * partire, la pubblicazione torna indietro.
 *
 * COME. Non si riscrive niente a mano: si apre l'app vera col browser, si
 * prende il testo COME LO VEDE chi legge, e lo si impagina in una pagina che
 * sta in piedi da sola, senza JavaScript. La sorgente resta una: le viste in
 * src/views/legali.js. Se cambia il testo nell'app, si rilancia questo
 * script e le pagine seguono — e prove/legali-statiche.cjs si arrabbia se
 * qualcuno se ne dimentica.
 *
 * Uso:  node scripts/genera-legali.cjs     (si avvia da se' un server)
 */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const { writeFileSync } = require('fs');

const PAGINE = [
  ['privacy', 'privacy.html', 'Privacy', 'Che dati tiene Fantatitano, chi li vede e come si cancellano.'],
  ['termini', 'termini.html', 'Termini d\'uso', 'Come si sta in Fantatitano: cosa promette l\'app e cosa si aspetta da chi gioca.'],
  // Play pretende che la strada per cancellare l'account si apra dal web,
  // senza installare l'app e senza fare l'accesso: quindi questa pagina deve
  // esistere anche come HTML statico, non solo dietro al cancelletto.
  ['cancella-account', 'cancella-account.html', 'Cancellare l\'account', 'Come si cancella l\'account Fantatitano: dall\'app o per e-mail, e cosa succede ai dati.'],
];
const PORTA = 4199;

const guscio = (titolo, descrizione, corpo, dove) => `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${titolo} · Fantatitano</title>
<meta name="description" content="${descrizione}">
<meta name="theme-color" content="#1B84C6">
<link rel="icon" href="icons/icon-192.png">
<link rel="stylesheet" href="design/tokens/tokens.css">
<link rel="stylesheet" href="styles/font.css">
<link rel="stylesheet" href="styles/app.css">
<style>
  /* La pagina sta in piedi da sola: niente riquadro dell'app, niente barre. */
  body{margin:0;background:var(--bg);color:var(--text);font-family:var(--font-body)}
  .stat{max-width:720px;margin:0 auto;padding:24px 16px calc(40px + env(safe-area-inset-bottom,0px))}
  .stat header{display:flex;align-items:center;gap:12px;margin-bottom:18px}
  .stat header b{font:800 20px var(--font-display);text-transform:uppercase;letter-spacing:.02em}
  .stat header span{font-size:12px;color:var(--text-muted)}
  .stat .a-body{padding:0;gap:14px;display:flex;flex-direction:column}
  .stat .torna{display:inline-block;margin-top:24px;font-size:13px;color:var(--primary)}
</style>
</head>
<body>
<div class="stat">
  <header><img src="icons/icon-192.png" alt="" width="40" height="40" style="border-radius:10px">
    <span><b>Fantatitano</b><br><span>${titolo}</span></span></header>
  ${corpo}
  <a class="torna" href="./#/${dove}">Apri questa pagina dentro l'app</a>
</div>
</body>
</html>
`;

(async () => {
  const server = spawn('python3', ['-m', 'http.server', String(PORTA)], { stdio: 'ignore' });
  const chiudi = () => { try { server.kill(); } catch { /* gia' morto */ } };
  process.on('exit', chiudi);
  try {
    for (let i = 0; i < 40; i++) {
      try { const r = await fetch(`http://localhost:${PORTA}/index.html`); if (r.ok) break; } catch { /* non ancora su */ }
      await new Promise((k) => setTimeout(k, 250));
    }
    const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
    const ctx = await b.newContext({ viewport: { width: 420, height: 900 }, serviceWorkers: 'block' });
    // Senza account e senza server finto: queste pagine si leggono anche da
    // sloggati, ed e' esattamente la condizione di chi le va a controllare.
    await ctx.addInitScript(() => {
      localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, theme: 'light' }));
    });
    const p = await ctx.newPage();
    for (const [rotta, file, titolo, descrizione] of PAGINE) {
      await p.goto(`http://localhost:${PORTA}/#/${rotta}`, { waitUntil: 'load' });
      await p.waitForSelector('.a-body .group', { timeout: 15000 });
      await p.waitForTimeout(300);
      const corpo = await p.evaluate(() => {
        const m = document.querySelector('.a-body').cloneNode(true);
        // I collegamenti interni dell'app (#/squadra, #/impostazioni) da qui
        // non portano da nessuna parte: diventano testo, cosi' la pagina non
        // promette un salto che non puo' fare.
        m.querySelectorAll('a[href^="#/"]').forEach((a) => a.replaceWith(document.createTextNode(a.textContent)));
        m.querySelectorAll('button, .a-btn, svg').forEach((e) => e.remove());
        return m.outerHTML;
      });
      writeFileSync(file, guscio(titolo, descrizione, corpo, rotta));
      console.log(`${file}: ${corpo.length} caratteri`);
    }
    await b.close();
  } finally { chiudi(); }
})();
