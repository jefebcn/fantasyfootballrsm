/**
 * La sezione Futsal (FUTSAL.md), sul ramo `futsal`.
 *
 * Due cose prima di tutto: spenta non si vede (niente selettore, e
 * #/futsal riporta a casa), accesa con ?futsal=1 si gira tutta. Poi una rosa
 * comprata al mercato senza il server futsal (resta sul telefono), con
 * capitano e vice, e il suo punteggio provato sull'ultima giornata giocata.
 *
 * Gli screenshot finiscono in $USCITA.
 */
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:4173';
const USCITA = process.env.USCITA || '/tmp';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, timezoneId: 'Europe/Rome', locale: 'it-IT', isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.clock.setFixedTime(new Date(process.env.ORA || '2026-11-01T11:00:00+01:00'));
  await ctx.addInitScript(() => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    // questa prova gira come un database SENZA le migrazioni futsal: la
    // formazione resta sul telefono (prove/futsal-server.cjs fa l'altro caso)
    window.__MOCK_SENZA_FUTSAL__ = true;
    localStorage.setItem('fcs:auth', 'supabase');
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'light' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  const p = await ctx.newPage();
  const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  const w = (ms = 500) => p.waitForTimeout(ms);
  // Il corpo scorre dentro .a-body, non la pagina: «intera» fa un secondo
  // scatto scorrendo fino in fondo.
  const foto = async (nome, intera = false) => {
    await p.screenshot({ path: path.join(USCITA, `futsal-${nome}.png`) });
    if (!intera) return;
    await p.evaluate(() => { const m = document.querySelector('.a-body'); if (m) m.scrollTop = m.scrollHeight; }); await w(250);
    await p.screenshot({ path: path.join(USCITA, `futsal-${nome}-fondo.png`) });
    await p.evaluate(() => { const m = document.querySelector('.a-body'); if (m) m.scrollTop = 0; });
  };

  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await w(250);
  await p.fill('#email', 'alex@e.it'); await p.fill('#name', 'Alex'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1200);

  // ---- spento
  et(!(await p.$('.sport-sw')), 'spento: nessun selettore Calcio/Futsal');
  await p.evaluate(() => { location.hash = '#/futsal'; }); await w(600);
  et(!/futsal/.test(await p.evaluate(() => location.hash)), 'spento: #/futsal riporta a casa');
  await foto('0-spento');

  // ---- un amministratore la vede da solo, senza ?futsal=1 (anteprima di Alex)
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('fcs:mock')); s.tables.profiles.find((x) => x.id === s.userId).is_admin = true; localStorage.setItem('fcs:mock', JSON.stringify(s)); });
  // cambiare solo il pezzo dopo # non ricarica: serve un reload vero per rileggere il profilo
  await p.evaluate(() => { location.hash = '#/leghe'; }); await p.reload({ waitUntil: 'load' }); await w(1500);
  et(!!(await p.$('.sport-sw')), 'amministratore: il selettore Calcio/Futsal compare da solo');
  await p.goto(`${BASE}/?futsal=0#/leghe`, { waitUntil: 'load' }); await w(1300);
  et(!(await p.$('.sport-sw')), 'amministratore con ?futsal=0: la sezione si spegne');
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('fcs:mock')); s.tables.profiles.find((x) => x.id === s.userId).is_admin = false; localStorage.setItem('fcs:mock', JSON.stringify(s)); });

  // ---- acceso
  await p.goto(`${BASE}/?futsal=1#/leghe`, { waitUntil: 'load' }); await w(1300);
  et(!/futsal=/.test(await p.evaluate(() => location.search)), "l'interruttore si toglie dall'indirizzo");
  et(!!(await p.$('.sport-sw')), 'acceso: il selettore compare');
  await foto('1-selettore-calcio');
  await p.click('.sport-sw a[href="#/futsal"]'); await w(700);
  const home = await p.evaluate(() => document.querySelector('main')?.innerText || '');
  et(/giornata/i.test(home) && /mercato/i.test(home), 'la home del futsal mostra la giornata e il mercato');
  await foto('2-home', true);

  // ---- la rosa sul telefono: Porta, 4 D, 4 A dal mercato (orologio a domenica 1/11: mercato aperto)
  await p.evaluate(() => { location.hash = '#/futsal/squadra'; }); await w(700);
  await foto('3-campo-vuoto');
  const compra = async (slot, n) => {
    await p.click(`[data-slot="${slot}"]`); await w(350);
    const b2 = await p.$$('#sheet [data-compra]:not([disabled])');
    await b2[Math.min(n, b2.length - 1)].click(); await w(300);
  };
  await compra('P:0', 4);
  for (const [i, n] of [[0, 5], [1, 15], [2, 25], [3, 35]]) await compra(`D:${i}`, n);
  for (const [i, n] of [[0, 5], [1, 15], [2, 25], [3, 35]]) await compra(`A:${i}`, n);
  await p.click('.fs-campo [data-slot="A:0"]'); await w(300); await p.click('#sheet [data-az="capitano"]'); await w(300);
  await p.click('.fs-campo [data-slot="D:0"]'); await w(300); await p.click('#sheet [data-az="vice"]'); await w(300);
  const pronta = await p.evaluate(() => !document.querySelector('#fs-salva')?.disabled && !document.querySelector('.fs-err'));
  et(pronta, 'rosa completa e nei crediti: si può salvare');
  const prova = await p.evaluate(() => document.querySelector('.fs-tot .fv')?.textContent || '');
  et(/\d/.test(prova), `e si vede il punteggio sull'ultima giornata (${prova})`);
  await foto('4-campo-pronto', true);
  await p.click('[data-schema="3-1"]'); await w(400);
  et(/Bonus difesa/.test(await p.evaluate(() => document.querySelector('main').innerText)), 'con il 3-1 la prova mostra il bonus difesa');
  await p.click('#fs-salva'); await w(900);
  et(!!(await p.evaluate(() => JSON.parse(localStorage.getItem('fcs:futsal:squadre') || '{}')[8]?.D)), 'senza server la squadra resta sul telefono');

  // ---- calendario, statistiche, regolamento
  await p.evaluate(() => { location.hash = '#/futsal/giornata/6'; }); await w(700);
  await p.click('.fs-partita summary'); await w(300);
  const voti = await p.evaluate(() => document.querySelectorAll('.fs-partita[open] .vr').length);
  et(voti > 10, `una partita aperta mostra porte e giocatori (${voti} righe)`);
  await foto('5-voti');
  await p.evaluate(() => { location.hash = '#/futsal/statistiche'; }); await w(700);
  await p.click('[data-vista="porte"]'); await w(500);
  et((await p.$$('.fs-tab tbody tr')).length === 15, 'le porte nelle statistiche sono 15');
  await foto('6-statistiche-porte');
  await p.evaluate(() => { location.hash = '#/futsal/regolamento'; }); await w(600);
  await foto('7-regolamento', true);

  et(!errori.length, `nessun errore in pagina${errori.length ? `: ${errori.join(' | ')}` : ''}`);
  await b.close();
  for (const t of ok) console.log(`  ok  ${t}`);
  for (const t of ko) console.log(`  NO  ${t}`);
  console.log(`\nfutsal: ${ok.length} ok, ${ko.length} no — screenshot in ${USCITA}`);
  process.exit(ko.length ? 1 : 0);
})();
