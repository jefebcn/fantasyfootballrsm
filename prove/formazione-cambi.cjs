/**
 * L'EDITOR DELLA FORMAZIONE: ogni cambio in un tocco.
 *
 * Alex, 23/10: «è controintuitivo che i giocatori in panchina non li puoi
 * mettere in squadra» e «quelli che vuoi cavare prima li devi selezionare e
 * poi rimettere». Qui:
 *  - toccando un titolare, chi e' in panchina si puo' scegliere (non e' piu'
 *    spento come «gia' schierato») e lo scambio avviene in un tocco;
 *  - dalla panchina, «in campo al posto di…» fa lo stesso dall'altro lato;
 *  - la tribuna (chi non e' convocato) si vede, e da li' si va in panchina;
 *  - «Completa la panchina» riempie i posti liberi, portiere per primo;
 *  - la formazione si conferma come prima.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    localStorage.setItem('fcs:auth', 'supabase');
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'light' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  const p = await ctx.newPage(); p.on('dialog', (d) => d.accept()); const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  const w = (ms = 500) => p.waitForTimeout(ms);
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await p.fill('#email', 'cambi@e.it'); await p.fill('#name', 'Alex');
  await p.fill('#password', 'password123'); await p.click('#primary'); await w(1200);
  await p.click('[data-form="create"]'); await p.fill('#lname', 'Torneo'); await p.fill('#team', 'Prova FC');
  await p.click('#go-create'); await w(1400);
  await p.evaluate(() => { location.hash = '#/lega'; }); await w(700); await p.click('#draft'); await w(2200);
  await p.evaluate(() => { location.hash = '#/rosa/formazione'; }); await w(1300);

  const stato = () => p.evaluate(async () => {
    const S = await import('/src/state.js');
    const tit = [...document.querySelectorAll('[data-slot]')].map((x) => x.querySelector('b')?.innerText || '');
    const panca = [...document.querySelectorAll('[data-bench]')].map((x) => (x.classList.contains('vuota') ? '' : x.querySelector('.nm b')?.innerText.trim() || ''));
    const trib = [...document.querySelectorAll('[data-trib]')].map((x) => x.dataset.trib);
    return { tit, panca, trib, ruoli: Object.fromEntries([...trib].map((id) => [id, S.playersById.get(id).role])) };
  });

  // ---- 1. dal campo: un panchinaro si sceglie e lo scambio e' in un tocco
  const prima = await stato();
  await p.click('[data-slot="A:0"]'); await w(400);
  const acceso = await p.$('#sheet [data-m="campo"]:not([disabled])');
  const testoFoglio = await p.evaluate(() => document.getElementById('sheet').innerText);
  et(/Dalla panchina/i.test(testoFoglio) && /in panchina/i.test(testoFoglio), 'toccando un titolare, chi è in panchina compare fra chi può entrare');
  et(!/già schierato/i.test(testoFoglio), 'nessuno è più spento come «già schierato»');
  const entra = await p.evaluate(() => { const x = document.querySelector('#sheet .plist [data-m="campo"]'); return x && { pid: x.dataset.pid, nome: x.querySelector('b').innerText }; });
  if (acceso && entra) await p.click(`#sheet [data-m="campo"][data-pid="${entra.pid}"]`);
  await w(500);
  const dopo1 = await stato();
  const usciva = prima.tit.find((x, i) => x !== dopo1.tit[i]);
  et(dopo1.tit.some((x) => entra && entra.nome.startsWith(x)), `in un tocco ${entra?.nome} è in campo`);
  et(usciva && dopo1.panca.some((x) => x.startsWith(usciva)), `e ${usciva} è andato a sedersi in panchina`);
  et(!(await p.$('#sheet.on')), 'il foglio si chiude da solo');

  // ---- 2. dalla panchina: «in campo al posto di…»
  await p.click('[data-bench="0"]'); await w(400);
  const t2 = await p.evaluate(() => document.getElementById('sheet').innerText);
  et(/In campo al posto di/i.test(t2), 'dal panchinaro: «In campo al posto di…»');
  const primoPanca = dopo1.panca[0];
  await p.click('#sheet .plist [data-m="campo"]'); await w(500);
  const dopo2 = await stato();
  et(dopo2.tit.some((x) => primoPanca.startsWith(x)), `${primoPanca} dalla panchina al campo in un tocco`);
  et(dopo2.panca.filter(Boolean).length === dopo1.panca.filter(Boolean).length, 'la panchina resta piena come prima: chi esce prende il suo posto');

  // ---- 3. tribuna -> panchina, e completa la panchina
  et(dopo2.trib.length > 0, `la tribuna si vede (${dopo2.trib.length} non convocati)`);
  await p.click('[data-bench="6"]'); await w(300); await p.click('#sheet [data-m="via-panca"]'); await w(300);
  await p.click('[data-bench="0"]'); await w(300); await p.click('#sheet [data-m="via-panca"]'); await w(400);
  const s3 = await stato();
  et(s3.panca.filter(Boolean).length === 5, 'tolti due panchinari: 5 su 7');
  et(!!(await p.$('#completa-panchina')), 'compare «Completa la panchina»');
  const unoTrib = s3.trib[0];
  await p.click(`[data-trib="${unoTrib}"]`); await w(400);
  et(/Mettilo in panchina/i.test(await p.evaluate(() => document.getElementById('sheet').innerText)), 'dalla tribuna: «Mettilo in panchina»');
  await p.click('#sheet [data-m="panca"]'); await w(400);
  const s4 = await stato();
  et(s4.panca.filter(Boolean).length === 6 && !s4.trib.includes(unoTrib), 'dalla tribuna alla panchina in un tocco');
  await p.click('#completa-panchina'); await w(500);
  const s5 = await stato();
  et(s5.panca.filter(Boolean).length === 7, 'completata: 7 su 7');
  const ruoliPanca = await p.evaluate(async () => {
    const S = await import('/src/state.js');
    return [...document.querySelectorAll('.copertura i.manca')].length;
  });
  et(ruoliPanca === 0, 'ogni ruolo ha una riserva in panchina');

  // ---- 4. si conferma come prima, e nessun doppione
  const salvata = await p.evaluate(async () => {
    document.querySelector('#confirm')?.click();
    await new Promise((r) => setTimeout(r, 900));
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    const l = (s.tables.lineups || []).at(-1)?.lineup;
    if (!l) return null;
    const tutti = [...l.starters, ...l.bench].filter(Boolean);
    return { tit: l.starters.filter(Boolean).length, panca: l.bench.length, doppi: tutti.length - new Set(tutti).size };
  });
  et(salvata && salvata.tit === 11 && salvata.panca === 7 && salvata.doppi === 0, `confermata: 11 titolari, 7 in panchina, nessun doppione (${JSON.stringify(salvata)})`);

  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
  await b.close();
  for (const x of ok) console.log('  ok  ' + x);
  for (const x of ko) console.log('  KO  ' + x);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
