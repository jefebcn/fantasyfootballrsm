/**
 * Il FantaFutsal dall'inizio, come lo fa un utente vero: iscrizione, mercato,
 * leghe pubbliche e fra amici, inviti, cambi (Alex, 21/11/2026).
 *
 * L'orologio è fermo a sabato 21/11/2026: la 10ª è conclusa e il mercato
 * dell'11ª è aperto. Server finto (tests/mock-supabase.js).
 *
 *  A) Alex: iscrizione, mercato (ricerca, ordine, 2 per squadra, crediti), capitano, salva
 *  B) Alex amministratore: apre una lega pubblica; crea una lega a somma e una testa a testa;
 *     «Invita» manda il link giusto (senza codice per la pubblica)
 *  C) Marco arriva dal link d'invito: si iscrive, entra; entra nella pubblica dall'elenco;
 *     la lega a somma non conta la 10ª giocata prima che nascesse; cambi con malus
 *  D) Alex avvia la testa a testa; Luca arriva tardi (messaggio con gli accenti) ed entra
 *     nella pubblica dal link; Marco esce da una lega
 *
 *   node prove/futsal-leghe.cjs [cartella-screenshot]
 * Senza BASE serve le pagine dal disco (page.route): non serve avviare un server.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const REPO = path.resolve(__dirname, '..');
const BASE = process.env.BASE || 'http://app.local';
const USCITA = process.argv[2] || process.env.USCITA || '/tmp';
const ORA = '2026-11-21T11:00:00+01:00';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);
const TIPI = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

(async () => {
  fs.mkdirSync(USCITA, { recursive: true });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, timezoneId: 'Europe/Rome', locale: 'it-IT', isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  if (!process.env.BASE) {
    await ctx.route(`${BASE}/**`, async (r) => {
      let p = decodeURIComponent(new URL(r.request().url()).pathname); if (p.endsWith('/')) p += 'index.html';
      const f = path.join(REPO, p);
      if (!f.startsWith(REPO) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
      return r.fulfill({ status: 200, body: fs.readFileSync(f), contentType: TIPI[path.extname(f)] || 'application/octet-stream' });
    });
  }
  await ctx.clock.setFixedTime(new Date(ORA));
  await ctx.addInitScript(() => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    localStorage.setItem('fcs:auth', 'supabase');
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'light' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
    localStorage.setItem('fcs:futsal', '1'); window.__PROVA_FUTSAL__ = true;
    // l'invito si legge: niente foglio di condivisione, si copia
    window.__copiato = [];
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => { window.__copiato.push(t); } }, configurable: true });
  });
  const p = await ctx.newPage();
  const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  p.on('dialog', (d) => d.accept());
  const w = (ms = 500) => p.waitForTimeout(ms);
  let k = 0;
  const foto = async (nome, fondo = false) => {
    k++; const n = String(k).padStart(2, '0');
    await p.screenshot({ path: path.join(USCITA, `${n}-${nome}.png`) });
    if (!fondo) return;
    await p.evaluate(() => { const m = document.querySelector('.a-body'); if (m) m.scrollTop = m.scrollHeight; }); await w(250);
    await p.screenshot({ path: path.join(USCITA, `${n}b-${nome}-fondo.png`) });
    await p.evaluate(() => { const m = document.querySelector('.a-body'); if (m) m.scrollTop = 0; });
  };
  const testo = () => p.evaluate(() => document.querySelector('main')?.innerText || '');
  const toast = () => p.evaluate(() => document.getElementById('toast')?.textContent || '');
  const vai = async (h, ms = 900) => { await p.evaluate((x) => { location.hash = x; }, h); await w(ms); };
  const mock = () => p.evaluate(() => JSON.parse(localStorage.getItem('fcs:mock')));
  const iscriviAccount = async (email, nome) => { await p.click('[data-tab="up"]'); await w(250); await p.fill('#email', email); await p.fill('#name', nome); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1300); };
  const esci = async () => { await vai('#/impostazioni', 700); await p.click('[data-act="logout"]'); await w(900); await p.waitForSelector('#password'); };
  const entra = async (email) => { await p.fill('#email', email); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1400); };
  const cruscotto = () => p.evaluate(() => document.querySelector('.fs-cruscotto')?.innerText.replace(/\s+/g, ' ') || '');
  const scheda = async (v) => { await p.click(`.fs-tabs-leghe [data-vleghe="${v}"]`); await w(400); };
  const invito = async () => { await p.evaluate(() => { window.__copiato = []; }); await p.click('#fs-invita'); await w(300); return p.evaluate(() => window.__copiato[0] || ''); };
  const compra = async (slot, pos, cerca = '') => {
    await p.click(`[data-slot="${slot}"]`); await w(400);
    if (cerca) { await p.fill('#fs-cerca', cerca); await w(200); }
    const bt = await p.$$('#sheet [data-compra]:not([disabled]):not([hidden])');
    if (!bt.length) return false;
    await bt[Math.min(pos, bt.length - 1)].click(); await w(450); return true;
  };

  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await iscriviAccount('alex@e.it', 'Alex');

  // ================= A) Alex: iscrizione e mercato
  await vai('#/futsal', 1200);
  et((await p.$$('.fs-passo')).length === 4 && !!(await p.$('#fs-iscriviti')), 'A1 utente nuovo: la home spiega il gioco in 4 passi e propone l\'iscrizione');
  await foto('alex-home-nuovo-utente', true);
  await p.fill('#fs-squadra', 'Titani Futsal'); await p.selectOption('#fs-cuore', 'murata');
  await p.click('#fs-iscriviti'); await w(1300);
  const c0 = await cruscotto();
  et(/11ª/.test(c0) && /Aperto/i.test(c0) && /70,0/.test(c0), `A2 iscritto: campo vuoto, 11ª, mercato aperto, 70 crediti (${c0})`);
  await foto('alex-campo-vuoto', true);
  await p.click('[data-slot="P:0"]'); await w(450);
  et((await p.$$('#sheet [data-compra]')).length === 15, 'A3 il mercato delle Porte ha le 15 squadre');
  await foto('mercato-porte');
  await p.fill('#fs-cerca', 'tre fiori'); await w(250);
  await (await p.$$('#sheet [data-compra]:not([disabled]):not([hidden])'))[0].click(); await w(450);
  await p.click('[data-slot="D:0"]'); await w(450); await p.fill('#fs-cerca', 'fiorita'); await w(250);
  await foto('mercato-ricerca');
  await (await p.$$('#sheet [data-compra]:not([disabled]):not([hidden])'))[0].click(); await w(200);
  et(!!(await p.$('.fs-carta.arrivo')), 'A4 acquisto: la maglia entra in campo con l\'animazione');
  await w(400);
  await compra('D:1', 0, 'fiorita');
  // la La Fiorita ha solo 2 difensori: il terzo dei suoi si cerca fra gli attaccanti
  await p.click('[data-slot="A:0"]'); await w(400); await p.fill('#fs-cerca', 'fiorita'); await w(250);
  const bloccati = await p.evaluate(() => [...document.querySelectorAll('#sheet [data-compra]:not([hidden])')].map((x) => ({ dis: x.disabled, t: x.innerText })));
  et(bloccati.length > 2 && bloccati.every((x) => x.dis) && bloccati.some((x) => /già 2 del/i.test(x.t)), `A5 con 2 della La Fiorita in rosa, il terzo è bloccato («già 2 del…», ${bloccati.length})`);
  await foto('limite-2-per-squadra');
  await p.fill('#fs-cerca', ''); await w(200);
  await p.click('#sheet [data-ord="cr"]'); await w(300);
  let bt = await p.$$('#sheet [data-compra]:not([disabled]):not([hidden])'); await bt[0].click(); await w(450);
  await compra('D:2', 0); await compra('D:3', 99); await compra('A:1', 0); await compra('A:2', 99);
  await p.click('[data-slot="A:3"]'); await w(450);
  const cari = await p.evaluate(() => [...document.querySelectorAll('#sheet [data-compra]')].filter((x) => /crediti insufficienti/.test(x.innerText)).length);
  et(cari > 0, `A6 all'ultimo acquisto i troppo cari sono bloccati per crediti (${cari})`);
  await foto('crediti-insufficienti');
  bt = await p.$$('#sheet [data-compra]:not([disabled]):not([hidden])'); await bt[Math.floor(bt.length / 2)].click(); await w(600);
  et(/Rosa 9 su 9/.test(await testo()), `A7 rosa completa 9 su 9 (${await cruscotto()})`);
  await p.click('.fs-campo [data-slot="A:0"]'); await w(400); await p.click('#sheet [data-az="capitano"]'); await w(350);
  await p.click('.fs-campo [data-slot="D:0"]'); await w(400); await p.click('#sheet [data-az="vice"]'); await w(350);
  await p.click('[data-schema="3-1"]'); await w(400);
  await p.click('#fs-salva'); await w(1700);
  let s = await mock();
  const fA = s.tables.futsal_formazioni?.find((f) => f.user_id === s.userId && f.giornata === 11)?.formazione;
  et(fA && fA.D.length === 4 && fA.A.length === 4 && fA.porta && fA.capitano && fA.vice && fA.sesto && fA.schema === '3-1', 'A8 la squadra dell\'11ª è sul server con capitano, vice, sesto uomo e schema 3-1');

  // ================= B) le leghe di Alex (amministratore dell'app)
  await vai('#/futsal/leghe', 1000);
  et(!(await p.$('[data-vleghe="admin"]')), 'B1 chi non amministra l\'app non vede la scheda Admin');
  // come nel calcio: senza pubbliche in cui entrare si apre «Private», e «Pubbliche» lo dice
  const aperta = await p.evaluate(() => document.querySelector('.fs-tabs-leghe .on')?.dataset.vleghe);
  await scheda('pubbliche');
  et(aperta === 'private' && /non c'è una lega pubblica/i.test(await testo()), `B2 senza pubbliche si apre «Private» (${aperta}); «Pubbliche» dice che non ce n'è`);
  await foto('leghe-pubbliche-vuote');
  // il primo amministratore si nomina dal database, come nel calcio (014)
  await p.evaluate(() => { const st = JSON.parse(localStorage.getItem('fcs:mock')); st.tables.profiles.find((x) => x.id === st.userId).is_admin = true; localStorage.setItem('fcs:mock', JSON.stringify(st)); });
  await p.reload({ waitUntil: 'load' }); await w(1500);
  await vai('#/futsal/leghe', 1100);
  await scheda('admin');
  await foto('admin-apri-lega-pubblica');
  await p.fill('#fs-pnome', 'Titano Futsal Open'); await p.fill('#fs-pmax', '100'); await p.fill('#fs-ppremio', 'Una cena offerta');
  await p.click('#fs-crea-pub'); await w(1300);
  s = await mock();
  const pub = s.tables.futsal_leghe.find((l) => l.pubblica);
  et(pub && pub.max_membri === 100 && pub.tipo === 'somma' && pub.dalla_giornata === 11 && pub.premi[0]?.premio === 'Una cena offerta', `B3 lega pubblica aperta: 100 posti, a somma dalla 11ª, premio salvato (${pub?.dalla_giornata})`);
  const tPub = await testo();
  et(/aperta a tutti/i.test(tPub) && !(await p.$('.fs-codice')) && /1\/100 squadre/.test(tPub) && /Una cena offerta/.test(tPub), 'B4 la pagina della pubblica: niente codice, 1/100 squadre, premio in vista');
  await foto('lega-pubblica-creata');
  const invPub = await invito();
  et(/futsal-pubblica=/.test(invPub) && !/futsal-codice=/.test(invPub) && /#\/futsal\/leghe/.test(invPub) && /aperta a tutti/.test(invPub), `B5 «Invita» della pubblica: link senza codice («${invPub.slice(0, 60)}…»)`);
  await vai('#/futsal/leghe', 900); await scheda('private');
  await p.click('#fs-crea'); await w(400);
  et(/nome della lega/i.test(await toast()), 'B6 senza nome la lega non si crea (avviso)');
  await p.fill('#fs-lnome', 'Amici del venerdì'); await p.click('#fs-crea'); await w(1200);
  const codSomma = await p.evaluate(() => document.querySelector('.fs-codice')?.textContent.trim());
  const idSomma = (await p.evaluate(() => location.hash)).split('/').pop();
  et(/^F[0-9A-F]{5}$/.test(codSomma || '') && /punti dalla 11ª/.test(await testo()), `B7 lega a somma con codice ${codSomma}, punti dalla 11ª`);
  const invSomma = await invito();
  et(invSomma.includes(`futsal-codice=${codSomma}`) && invSomma.includes(codSomma), `B8 «Invita» della lega fra amici: codice e link («${invSomma.slice(0, 60)}…»)`);
  await foto('lega-somma-invita');
  await vai('#/futsal/leghe', 900); await scheda('private');
  await p.fill('#fs-lnome', 'Sfida del lunedì'); await p.click('#fs-ltipo [data-tipo="testa"]'); await w(200);
  await p.click('#fs-crea'); await w(1200);
  const codTesta = await p.evaluate(() => document.querySelector('.fs-codice')?.textContent.trim());
  const idTesta = (await p.evaluate(() => location.hash)).split('/').pop();
  et(!!(await p.$('#fs-avvia')) && !!(await p.$('#fs-invita')), `B9 testa a testa (${codTesta}): da avviare, e si può invitare`);
  await vai('#/futsal/leghe', 900);
  et((await p.$$('.fs-list .vr')).length === 2, 'B10 la scheda Private elenca le 2 leghe fra amici');
  await foto('leghe-private');
  await scheda('pubbliche');
  et(/Sei dentro/i.test(await testo()), 'B11 nella scheda Pubbliche la propria lega dice «Sei dentro»');
  await foto('leghe-pubbliche-dentro');

  // ================= C) Marco arriva dal link d'invito
  await esci();
  await p.goto(invSomma.match(/https?:\/\/\S+/)[0].replace(/^https?:\/\/[^/?#]+/, BASE), { waitUntil: 'load' }); await w(1300);
  et(!/futsal-codice/.test(await p.evaluate(() => location.search)), 'C1 il codice d\'invito si legge e l\'indirizzo si ripulisce');
  await iscriviAccount('marco@e.it', 'Marco');
  await vai('#/futsal/leghe', 1000);
  et(!!(await p.$('#fs-iscriviti')), 'C2 senza squadra, le leghe chiedono prima di iscriversi');
  await p.fill('#fs-squadra', 'Dogana Five'); await p.selectOption('#fs-cuore', 'juvenes'); await p.click('#fs-iscriviti'); await w(1300);
  await vai('#/futsal', 1100);
  et(/Hai un invito in una lega/i.test(await testo()), 'C3 la home ricorda l\'invito in sospeso');
  await vai('#/futsal/leghe', 1000);
  et(!!(await p.$('#fs-invito-entra')) && (await p.inputValue('#fs-codice')) === codSomma, 'C4 le leghe si aprono su «Private» con l\'invito e il codice già scritto');
  await foto('marco-invito-in-arrivo');
  await p.click('#fs-invito-entra'); await w(1300);
  const tSomma = await testo();
  et(/2 squadre/.test(tSomma) && /Dogana Five/.test(tSomma) && /Titani Futsal/.test(tSomma), 'C5 Marco entra con un tocco: 2 squadre');
  await vai('#/futsal/leghe', 900);
  et(!(await p.$('#fs-invito-entra')), 'C6 entrato, l\'invito sparisce');
  await scheda('private');
  await p.fill('#fs-codice', 'zzzzzz'); await p.click('#fs-entra'); await w(500);
  et(/non trovato/i.test(await toast()), 'C7 codice sbagliato: «Codice non trovato»');
  await p.fill('#fs-codice', codTesta.toLowerCase()); await p.click('#fs-entra'); await w(1200);
  et(!(await p.$('#fs-avvia')) && /chi l'ha creata la avvia/i.test(await testo()), 'C8 nella testa a testa (codice in minuscolo) Marco non può avviare');
  await vai('#/futsal/leghe', 900); await scheda('pubbliche');
  et(!(await p.$('[data-vleghe="admin"]')), 'C9 Marco non amministra: niente scheda Admin');
  await foto('marco-leghe-pubbliche');
  await p.click('[data-entra-pub]'); await w(1300);
  et(/2\/100 squadre/.test(await testo()), 'C10 Marco entra nella pubblica dall\'elenco, senza codice: 2/100');
  // Marco aveva giocato la 10ª: nella lega nata per l'11ª non conta
  await p.evaluate(async () => {
    const F = await import('/src/futsal.js'); const V = await import('/src/futsal-valori.js');
    const st = JSON.parse(localStorage.getItem('fcs:mock'));
    const usati = new Map();
    const prendi = (r, n) => { const out = []; for (const g of F.GIOCATORI_FUTSAL.filter((x) => x.ruolo === r).sort((a, b) => V.quotazione(a.id, 10) - V.quotazione(b.id, 10))) { if (out.length === n) break; if ((usati.get(g.club) || 0) < 2) { usati.set(g.club, (usati.get(g.club) || 0) + 1); out.push(g.id); } } return out; };
    usati.set('cosmos', 1);
    const D = prendi('D', 4), A = prendi('A', 4);
    st.tables.futsal_formazioni.push({ user_id: st.userId, giornata: 10, formazione: { porta: 'cosmos', D, A, schema: '2-2', titolari: [D[0], D[1], A[0], A[1]], sesto: A[2], capitano: A[0], vice: D[0] }, consegnata_at: '2026-11-15T18:00:00Z' });
    localStorage.setItem('fcs:mock', JSON.stringify(st));
  });
  await p.reload({ waitUntil: 'load' }); await w(1500);
  await vai(`#/futsal/lega/${idSomma}`, 1100);
  const punti = await p.evaluate(() => [...document.querySelectorAll('.fs-classifica .fv')].map((x) => x.textContent.trim()));
  et(punti.length === 2 && punti.every((x) => x === '0,0') && /parte dalla 11ª/.test(await testo()), `C11 la lega a somma non conta la 10ª giocata prima che nascesse (${punti.join(', ')})`);
  await foto('lega-somma-dalla-11');
  await vai('#/futsal/classifica', 1000);
  et(/Dogana Five/.test(await testo()) && !/^0,0$/.test(await p.evaluate(() => document.querySelector('.fs-classifica .fv')?.textContent.trim() || '')), 'C12 la classifica generale invece conta la 10ª, come prima');
  // cambi di mercato
  await vai('#/futsal/squadra', 1200);
  et(/0\s*cambi/i.test(await cruscotto()) && /squadra della 10ª/i.test(await testo()), 'C13 all\'11ª ritrova la rosa della 10ª, 0 cambi');
  for (const sl of ['A:2', 'A:3']) {
    await p.click(`.fs-campo [data-slot="${sl}"], .fs-panca [data-slot="${sl}"]`); await w(400);
    await p.click('#sheet [data-az="vendi"]'); await w(450);
    await compra(sl, 20);
  }
  const cM1 = await cruscotto();
  et(/2\s*cambi\s*·\s*−1 pt/i.test(cM1), `C14 due cambi: uno gratis, il secondo −1 punto (${cM1})`);
  await foto('marco-due-cambi');
  await p.click('#fs-salva'); await w(1500);

  // ================= D) avvio, chi arriva tardi, chi esce
  await esci(); await entra('alex@e.it');
  await vai(`#/futsal/lega/${idTesta}`, 1100);
  await p.click('#fs-avvia'); await w(1200);
  et(/11ª/.test(await toast()) && !(await p.$('#fs-invita')), 'D1 avviata dall\'11ª: chiusa, non si invita più');
  await foto('lega-testa-avviata');
  await esci();
  await p.goto(invPub.match(/https?:\/\/\S+/)[0].replace(/^https?:\/\/[^/?#]+/, BASE), { waitUntil: 'load' }); await w(1300);
  await iscriviAccount('luca@e.it', 'Luca');
  await vai('#/futsal/leghe', 1000);
  await p.fill('#fs-squadra', 'Luca C5'); await p.click('#fs-iscriviti'); await w(1300);
  await vai('#/futsal/leghe', 1000);
  et(!!(await p.$('.fs-pub.fs-invitato [data-entra-pub]')), 'D2 dal link della pubblica: «Pubbliche» con la lega evidenziata');
  await foto('luca-invito-pubblica');
  await p.click('.fs-pub.fs-invitato [data-entra-pub]'); await w(1300);
  et(/3\/100 squadre/.test(await testo()), 'D3 Luca entra nella pubblica: 3/100');
  await vai('#/futsal/leghe', 900); await scheda('private');
  await p.fill('#fs-codice', codTesta); await p.click('#fs-entra'); await w(600);
  const tTardi = await toast();
  et(/è già partita/.test(tTardi), `D4 dopo l'avvio non si entra, con gli accenti: «${tTardi}»`);
  await foto('luca-lega-gia-partita');
  await esci(); await entra('marco@e.it');
  await vai(`#/futsal/lega/${idSomma}`, 1000);
  await p.click('#fs-esci'); await w(1200);
  s = await mock();
  et(!s.tables.futsal_membri.some((m) => m.lega_id === idSomma && m.user_id === s.userId) && /futsal\/leghe/.test(await p.evaluate(() => location.hash)), 'D5 Marco esce dalla lega a somma e torna alle leghe');
  await vai('#/futsal', 1100); await foto('marco-home-leghe', true);

  et(!errori.length, `nessun errore in pagina${errori.length ? `: ${errori.join(' | ')}` : ''}`);
  await b.close();
  for (const t of ok) console.log(`  ok  ${t}`);
  for (const t of ko) console.log(`  NO  ${t}`);
  console.log(`\nleghe futsal: ${ok.length} ok, ${ko.length} no — screenshot in ${USCITA}`);
  process.exit(ko.length ? 1 : 0);
})().catch((e) => { console.error(e); for (const t of ok) console.log(`  ok  ${t}`); for (const t of ko) console.log(`  NO  ${t}`); process.exit(1); });
