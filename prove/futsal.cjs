/**
 * La sezione Futsal (FUTSAL.md), sul ramo `futsal`.
 *
 * Due cose prima di tutto: spenta non si vede (niente selettore, e
 * #/futsal riporta a casa), accesa con ?futsal=1 si gira tutta. Poi una
 * formazione schierata a mano dal foglio di scelta, con capitano e vice, e
 * il suo punteggio provato sull'ultima giornata giocata.
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

  // ---- acceso
  await p.goto(`${BASE}/?futsal=1#/leghe`, { waitUntil: 'load' }); await w(1300);
  et(!/futsal=/.test(await p.evaluate(() => location.search)), "l'interruttore si toglie dall'indirizzo");
  et(!!(await p.$('.sport-sw')), 'acceso: il selettore compare');
  await foto('1-selettore-calcio');
  await p.click('.sport-sw a[href="#/futsal"]'); await w(700);
  const home = await p.evaluate(() => document.querySelector('main')?.innerText || '');
  et(/giornata/i.test(home) && /Schiera la formazione/i.test(home), 'la home del futsal mostra giornata e formazione');
  await foto('2-home', true);

  // ---- formazione dal foglio di scelta
  await p.evaluate(() => { location.hash = '#/futsal/formazione'; }); await w(600);
  await foto('3-formazione-vuota');
  const scegli = async (slot, n = 0) => {
    await p.click(`[data-slot="${slot}"]`); await w(350);
    const bottoni = await p.$$('#sheet [data-scegli]:not([disabled])');
    await bottoni[n].click(); await w(350);
  };
  await scegli('P:0', 2);
  await p.click('[data-slot="D:0"]'); await w(350); await foto('4-foglio-scelta');
  await (await p.$$('#sheet [data-scegli]:not([disabled])'))[0].click(); await w(350);
  await scegli('D:1'); await scegli('A:0'); await scegli('A:1'); await scegli('pD:0'); await scegli('pA:0');
  await p.click('[data-slot="A:0"]'); await w(300); await p.click('[data-fascia="capitano"]'); await w(300);
  await p.click('[data-slot="D:0"]'); await w(300); await p.click('[data-fascia="vice"]'); await w(300);
  const pronta = await p.evaluate(() => !document.querySelector('#fs-salva')?.disabled && !document.querySelector('.fs-err'));
  et(pronta, 'formazione completa: si può salvare');
  const prova = await p.evaluate(() => document.querySelector('.fs-tot .fv')?.textContent || '');
  et(/\d/.test(prova), `e si vede il punteggio sull'ultima giornata (${prova})`);
  await foto('5-formazione-pronta', true);

  // 3-1: un difensore in piu', il bonus difesa nella prova
  await p.click('[data-modulo="3-1"]'); await w(400);
  await scegli('D:2');
  await p.click('[data-slot="A:0"]'); await w(300); await p.click('[data-fascia="capitano"]'); await w(300);
  const bonus = await p.evaluate(() => /Bonus difesa/.test(document.querySelector('main').innerText));
  et(bonus, 'con il 3-1 la prova mostra il bonus difesa');
  await foto('6-formazione-3-1', true);
  await p.click('#fs-salva'); await w(2700);
  et(/futsal$/.test(await p.evaluate(() => location.hash)), 'salvata, si torna alla home del futsal');

  // ---- voti, listone, regolamento
  await p.evaluate(() => { location.hash = '#/futsal/giornata/6'; }); await w(700);
  await p.click('.fs-partita summary'); await w(300);
  const voti = await p.evaluate(() => document.querySelectorAll('.fs-partita[open] .vr').length);
  et(voti > 10, `una partita aperta mostra porte e giocatori (${voti} righe)`);
  await foto('7-voti', true);
  await p.evaluate(() => { location.hash = '#/futsal/listone'; }); await w(700);
  await foto('8-listone');
  await p.click('[data-ruolo="P"]'); await w(500);
  et((await p.$$('.fs-list .vr')).length === 15, 'le porte in listone sono 15');
  await foto('9-listone-porte');
  await p.evaluate(() => { location.hash = '#/futsal/regolamento'; }); await w(600);
  await foto('10-regolamento', true);

  et(!errori.length, `nessun errore in pagina${errori.length ? `: ${errori.join(' | ')}` : ''}`);
  await b.close();
  for (const t of ok) console.log(`  ok  ${t}`);
  for (const t of ko) console.log(`  NO  ${t}`);
  console.log(`\nfutsal: ${ok.length} ok, ${ko.length} no — screenshot in ${USCITA}`);
  process.exit(ko.length ? 1 : 0);
})();
