/**
 * Le immagini per la scheda di Google Play.
 *
 * Non e' una prova: non decide niente, produce file. Sta qui e non in prove/
 * apposta — ./prove/tutte.sh deve restare un elenco di cose che possono
 * fallire, e questo non fallisce mai: fa otto immagini.
 *
 * COME SI OTTENGONO 1080x1920 SENZA UN TELEFONO. Non si apre una finestra da
 * 1080 di larghezza: verrebbe l'impaginazione del computer, con le colonne
 * larghe, e sarebbe una bugia su come si vede davvero. Si apre una finestra
 * da 360 — un telefono — e si moltiplica per tre la densita': stessa
 * impaginazione, tre volte i pixel. E' quello che fa un telefono vero.
 *
 * I dati sono quelli del finto Supabase, gli stessi delle prove: squadre
 * inventate, nessun nome di persona vera. Nella scheda di uno Store non ci
 * vanno i dati di chi gioca.
 *
 *   node scripts/schermate-store.cjs        scrive in store/
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:4173';
const FUORI = process.env.FUORI || 'store';

// Play vuole 9:16 in verticale, lato minimo 320 e massimo 3840, e per essere
// consigliabile almeno quattro immagini da 1080 in su. 360x640 per tre fa
// esattamente 1080x1920.
const LARGO = 360, ALTO = 640, DENSITA = 3;

// Alcune schermate vanno fatte scorrere: la cosa che vale non e' sempre in
// cima. Nella formazione, per dire, sopra c'e' l'avviso della consegna e il
// campo comincia a meta' pagina — ed e' il campo la ragione per cui uno
// scarica un'app di fantacalcio.
const SCHERMATE = [
  ['', 'la-giornata'],
  ['rosa/formazione', 'la-formazione', '.campo'],
  ['voti', 'i-voti'],
  ['classifica', 'la-classifica'],
  ['calendario', 'il-calendario'],
  ['rosa', 'la-rosa'],
  ['listone', 'il-listone'],
];

(async () => {
  fs.mkdirSync(FUORI, { recursive: true });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: LARGO, height: ALTO }, deviceScaleFactor: DENSITA,
    isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    localStorage.setItem('fcs:auth', 'supabase');
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, theme: 'light' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  const p = await ctx.newPage(); p.on('dialog', (d) => d.accept());
  const w = (ms = 500) => p.waitForTimeout(ms);

  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await w(250);
  await p.fill('#email', 'demo@fantatitano.site'); await p.fill('#name', 'Alessandro'); await p.fill('#password', 'password123');
  await p.click('#primary'); await w(1000);
  await p.click('[data-form="create"]'); await w(250);
  await p.fill('#lname', 'Lega Titano'); await p.fill('#team', 'Hasta El Roxy'); await p.click('#go-create'); await w(1200);
  await p.evaluate(() => {
    const K = 'fcs:mock'; const s = JSON.parse(localStorage.getItem(K)); const lg = s.tables.leagues[0];
    // LA LEGA E' NATA A INIZIO STAGIONE. La prima giornata di una lega la
    // decide la sua data di nascita (state.js, primaGiornata): una lega creata
    // adesso comincia dalla giornata di adesso e non ha nessuna partita alle
    // spalle. Per le immagini serve una lega che ha gia' giocato, quindi la si
    // fa nascere prima del campionato.
    lg.created_at = '2026-07-01T00:00:00.000Z';
    s.tables.league_members.forEach((m) => { m.created_at = lg.created_at; });
    [['Serravalle United', 'Marco', '#c0392b', 'SU'], ['Borgo Maggiore FC', 'Luca', '#27ae60', 'BM'],
      ['Domagnano Stars', 'Sara', '#8e44ad', 'DS'], ['Fiorentino Boys', 'Giulia', '#e67e22', 'FB']]
      .forEach(([t, o, c, i], k) => s.tables.league_members.push({ id: 'fk' + k, league_id: lg.id, user_id: 'fu' + k,
        role: 'fantallenatore', team_name: t, owner_name: o, color: c, initials: i, credits: 500, created_at: new Date().toISOString() }));
    localStorage.setItem(K, JSON.stringify(s));
  });
  await p.reload({ waitUntil: 'load' }); await w(1600);
  await p.evaluate(() => { location.hash = '#/lega'; }); await w(700);
  await p.click('#draft').catch(() => {}); await w(2200);
  await p.evaluate(() => { location.hash = '#/impostazioni/avanzate'; }); await w(700);
  const seme = await p.evaluate(() => { const x = document.querySelector('[data-act="seed"]'); if (!x) return false; x.click(); return true; });
  if (!seme) throw new Error("la voce che carica le giornate non c'e': le immagini verrebbero da una lega vuota");
  await w(4000);

  // UNA LEGA CHE HA GIOCATO. Senza questo passo le immagini mostrano zeri:
  // zero punti, zero partite, classifica tutti a pari merito. E' l'app vera,
  // ma non e' come si vede dopo un mese — e una scheda di Store che mostra
  // un'app vuota fa scaricare meno di una che non c'e'.
  //
  // Si schiera per tutti e cinque i fantallenatori sulle giornate gia'
  // giocate, con undici titolari presi dalla loro rosa, e poi si congelano:
  // i punti li calcola il motore vero, non un numero scritto a mano qui.
  const giocate = await p.evaluate(async () => {
    const S = await import('/src/state.js');
    const perRuolo = (ids) => { const o = { P: [], D: [], C: [], A: [] };
      ids.forEach((id) => { const g = S.playersById.get(id); if (g) o[g.role].push(id); }); return o; };
    let fatte = 0;
    for (let n = S.primaGiornata(); n < S.giornataAperta(); n++) {
      for (const m of S.base.managers) {
        const r = perRuolo(S.rosterIds(m.id));
        const undici = [...r.P.slice(0, 1), ...r.D.slice(0, 4), ...r.C.slice(0, 4), ...r.A.slice(0, 2)];
        if (undici.length < 11) continue;
        const panca = [...r.D.slice(4, 6), ...r.C.slice(4, 6), ...r.A.slice(2, 4)];
        try { S.saveLineup(n, m.id, { formation: '4-4-2', starters: undici, bench: panca,
          captainId: undici[10] || undici[0], viceCaptainId: undici[9] || undici[1] }); } catch { /* giornata chiusa */ }
      }
      try { await S.chiudiGiornata(n); fatte++; } catch { /* gia' chiusa o senza eventi */ }
    }
    return fatte;
  });
  if (!giocate) throw new Error('nessuna giornata calcolata: le immagini mostrerebbero una lega a zero');
  console.log(`giornate giocate e calcolate: ${giocate}`);
  await p.reload({ waitUntil: 'load' }); await w(2200);

  // La scheda di un giocatore: e' li' che si vede da dove nasce il voto, riga
  // per riga, ed e' la cosa che distingue quest'app dalle altre. Il giocatore
  // non si sceglie a caso: si prende quello che ha fatto piu' cose in campo,
  // se no la scheda esce piena di trattini.
  const aperta = await p.evaluate(async () => {
    const S = await import('/src/state.js');
    const conti = new Map();
    for (let n = 1; n <= 30; n++) {
      for (const m of S.matchesOf(n)) {
        for (const e of S.eventsOf(m.id)) conti.set(e.playerId, (conti.get(e.playerId) || 0) + 1);
      }
    }
    const [chi] = [...conti.entries()].sort((a, b) => b[1] - a[1])[0] || [];
    if (!chi) return null;
    location.hash = `#/giocatore/${chi}`;
    return chi;
  });
  if (aperta) { await w(1200); await p.evaluate(() => document.fonts && document.fonts.ready);
    await p.screenshot({ path: path.join(FUORI, 'il-voto-titano.jpg'), type: 'jpeg', quality: 92 });
    console.log(`${FUORI}/il-voto-titano.jpg  (${aperta})`); }

  for (const [rotta, nome, verso] of SCHERMATE) {
    await p.evaluate((h) => { location.hash = '#/' + h; }, rotta); await w(900);
    await p.evaluate(() => document.fonts && document.fonts.ready);
    await p.evaluate((sel) => {
      if (!sel) return;
      const e = document.querySelector(sel); if (!e) return;
      // scrollIntoView e non window.scrollTo: a scorrere non e' sempre la
      // finestra — qui scorre un contenitore interno, e uno scrollTo sulla
      // finestra non muoveva niente. Cosi' funziona in tutti e due i casi.
      e.scrollIntoView({ block: 'center' });
      // E poi un ritocco: centrato, in cima restava la META' di una pastiglia
      // del modulo, che in una scheda di Store sembra un ritaglio storto. Si
      // cerca chi scorre davvero — non e' detto sia la finestra — e si scende
      // finche' il campo tocca il bordo di sopra.
      let q = e.parentElement;
      while (q && q.scrollHeight <= q.clientHeight + 1) q = q.parentElement;
      const dove = q || document.scrollingElement;
      // Sotto la barra del titolo, non sotto il bordo dello schermo: la barra
      // sta sopra a quello che scorre, e scendere fino a zero le fa mangiare
      // la prima riga — al primo tentativo il portiere era tagliato a meta'.
      const barra = document.querySelector('.a-appbar');
      const cima = barra ? barra.getBoundingClientRect().bottom + 6 : 6;
      dove.scrollTop += e.getBoundingClientRect().top - cima;
    }, verso || null); await w(500);
    const file = path.join(FUORI, `${nome}.jpg`);
    // JPEG e non PNG: Play vuole immagini senza canale alfa, e uno screenshot
    // PNG di Chromium ne ha sempre uno.
    await p.screenshot({ path: file, type: 'jpeg', quality: 92 });
    console.log(`${file}  ${Math.round(fs.statSync(file).size / 1024)} kB`);
  }
  // ---------------------------------------------------------------- 1024x500
  // La grafica d'intestazione: Play la vuole 1024x500, senza canale alfa, ed
  // e' la prima cosa che si vede della scheda. Non e' uno screenshot: e' una
  // pagina fatta apposta, col marchio vero preso da styles/logo.css — lo
  // stesso file che usa l'app, cosi' non esiste una seconda versione del
  // marchio che un giorno resta indietro.
  //
  // Niente scritte piccole e niente roba negli angoli: nelle liste Play la
  // ritaglia e ci mette sopra i suoi bottoni.
  const ctx2 = await b.newContext({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
  const g = await ctx2.newPage();
  await g.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
  await g.setContent(`<!doctype html><html lang="it"><head><meta charset="utf-8">
    <link rel="stylesheet" href="${BASE}/styles/logo.css">
    <link rel="stylesheet" href="${BASE}/styles/app.css">
    <style>
      html,body{margin:0;height:100%}
      body{display:grid;place-items:center;
        background:radial-gradient(120% 90% at 50% 0%, #1B84C6 0%, #0A4570 55%, #062033 100%)}
      .dentro{display:flex;flex-direction:column;align-items:center;gap:26px;padding:0 60px;text-align:center}
      .marchio{width:430px;color:#fff;filter:drop-shadow(0 6px 26px rgba(0,0,0,.45))}
      p{margin:0;font:600 25px/1.3 var(--font-body,system-ui);color:rgba(255,255,255,.92);letter-spacing:.01em}
      b{color:#E5A11B;font-weight:800}
    </style></head>
    <body><div class="dentro">
      <i class="marchio" role="img" aria-label="Fantatitano"></i>
      <p>Il fantacalcio del <b>Campionato Sammarinese</b></p>
    </div></body></html>`, { waitUntil: 'load' });
  await g.evaluate(() => document.fonts && document.fonts.ready); await g.waitForTimeout(600);
  const copertina = path.join(FUORI, 'grafica-1024x500.jpg');
  await g.screenshot({ path: copertina, type: 'jpeg', quality: 94 });
  console.log(`${copertina}  ${Math.round(fs.statSync(copertina).size / 1024)} kB`);

  await b.close();
})();
