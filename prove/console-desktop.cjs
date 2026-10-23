/**
 * LA CONSOLE DAL COMPUTER (Alex, 23/10: «la dashboard da admin, da desktop,
 * in grande»). A 1440px la console esce dalla colonna da telefono: menu a
 * sinistra, numeri su una riga larga, grafici affiancati, elenchi su piu'
 * colonne. A 390px resta com'era: in colonna, con le schede in alto.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    localStorage.setItem('fcs:auth', 'supabase');
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'light' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  const p = await ctx.newPage(); p.on('dialog', (d) => d.accept()); const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  const w = (ms = 500) => p.waitForTimeout(ms);
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1200);
  await p.click('[data-tab="up"]'); await p.fill('#email', 'desk@e.it'); await p.fill('#name', 'Alex'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1000);
  await p.click('[data-form="create"]'); await p.fill('#lname', 'Lega Prova'); await p.fill('#team', 'Alex FC'); await p.click('#go-create'); await w(1500);
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('fcs:mock')); Object.assign(s.tables.profiles.find((x) => x.id === s.userId), { is_admin: true, is_owner: true }); localStorage.setItem('fcs:mock', JSON.stringify(s)); });
  await p.reload({ waitUntil: 'load' }); await w(1500);
  await p.evaluate(() => { location.hash = '#/admin/console'; }); await w(2000);

  const misure = () => p.evaluate(() => {
    const r = (s) => document.querySelector(s)?.getBoundingClientRect();
    const tiles = [...document.querySelectorAll('.adm-dash .adm-n')].map((x) => Math.round(x.getBoundingClientRect().top));
    return { app: r('.app')?.width, tabs: r('.adm-tabs'), dash: r('.adm-dash'), con: r('.adm-dash .d-con'), isc: r('.adm-dash .d-isc'),
      perRiga: tiles.filter((t) => t === tiles[0]).length, bottoni: [...document.querySelectorAll('.adm-tabs button')].map((x) => Math.round(x.getBoundingClientRect().left)) };
  });
  const d = await misure();
  et(d.app > 1300, `dal computer la console è larga (${Math.round(d.app)}px, non 640)`);
  et(d.tabs && d.dash && d.tabs.right <= d.dash.left, 'il menu sta a sinistra del cruscotto');
  et(new Set(d.bottoni).size === 1, 'le voci del menu sono in colonna');
  et(d.perRiga >= 4, `i numeri stanno almeno quattro per riga (${d.perRiga})`);
  et(d.con && d.isc && Math.abs(d.con.top - d.isc.top) < 4 && d.con.right <= d.isc.left, 'i due grafici sono affiancati');
  const fs = await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.adm-dash .adm-n b')).fontSize));
  et(fs >= 36, `i numeri sono grandi (${fs}px)`);

  await p.evaluate(() => [...document.querySelectorAll('[data-atab]')].find((x) => x.dataset.atab === 'leghe')?.click()); await w(1200);
  const colonne = await p.evaluate(() => getComputedStyle(document.querySelector('.adm-console .vlist')).gridTemplateColumns.split(' ').length);
  et(colonne >= 2, `gli elenchi vanno su più colonne (${colonne})`);

  // sul telefono come prima
  await p.setViewportSize({ width: 390, height: 844 }); await w(400);
  await p.evaluate(() => [...document.querySelectorAll('[data-atab]')].find((x) => x.dataset.atab === 'numeri')?.click()); await w(900);
  const t = await misure();
  et(t.app <= 640, `sul telefono resta in colonna (${Math.round(t.app)}px)`);
  et(new Set(t.bottoni).size > 1, 'e le schede restano in riga in alto');
  const ordine = await p.evaluate(() => { const y = (s) => document.querySelector(s)?.getBoundingClientRect().top ?? -1; return y('.d-cfg') < y('.d-kpi') && y('.d-kpi') < y('.d-con') && y('.d-con') < y('.d-err'); });
  et(ordine, 'nell\'ordine di sempre: interruttori, numeri, consegne, errori');

  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
  await b.close();
  for (const x of ok) console.log('  ok  ' + x);
  for (const x of ko) console.log('  KO  ' + x);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
