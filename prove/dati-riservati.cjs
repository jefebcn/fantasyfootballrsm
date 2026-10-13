/**
 * Chi non amministra non vede che server usa l'app.
 *
 * Alex, 13/10: «non mi piace far sapere che server usiamo, quindi Supabase, e
 * altri dati privati miei». In Impostazioni avanzate c'erano per tutti
 * l'indirizzo del server, la diagnostica e le misure; nell'informativa il
 * nome del fornitore e l'indirizzo del progetto; nei dati del titolare nome
 * e telefono di Alex. Qui si guarda che a un iscritto qualunque non arrivi
 * niente di questo, e che a chi amministra le righe tecniche restino.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);
const SPIE = /supabase|mock\.supabase\.co|Alex Conti|2133 4567/i;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    localStorage.setItem('fcs:auth', 'supabase');
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'system' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  const p = await ctx.newPage(); p.on('dialog', (d) => d.accept());
  const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  const w = (ms = 450) => p.waitForTimeout(ms);
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await w(250);
  await p.fill('#email', 'a@e.it'); await p.fill('#name', 'Conti25'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1000);
  await p.click('[data-form="create"]'); await w(250);
  await p.fill('#lname', 'Torneo Titano'); await p.fill('#team', 'Hasta El Roxy'); await p.click('#go-create'); await w(1400);

  const testo = async (hash) => {
    await p.evaluate((h) => { location.hash = h; }, hash);
    await p.waitForSelector('main', { timeout: 8000 }); await w(600);
    return p.evaluate(() => document.querySelector('main')?.innerText || '');
  };

  // un iscritto qualunque
  const avanzate = await testo('#/impostazioni/avanzate');
  et(!SPIE.test(avanzate), 'Impostazioni avanzate: niente nome del server');
  et(!(await p.$('[data-act="server"]')) && !(await p.$('[data-act="diagnostica"]')) && !(await p.$('[data-act="schermo"]')),
    'Impostazioni avanzate: niente server, diagnostica e misure');
  et(!!(await p.$('[data-act="licenze"]')), 'la riga Atleti e società porta a Licenze');
  for (const h of ['#/privacy', '#/archiviazione', '#/licenze', '#/termini']) {
    const t = await testo(h);
    const m = t.match(SPIE);
    et(!m, `${h}: niente fornitore, indirizzo del server o dati personali di Alex${m ? ` («${m[0]}»)` : ''}`);
  }

  // chi amministra le righe tecniche le ha ancora
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    s.tables.profiles.find((x) => x.id === s.userId).is_admin = true;
    localStorage.setItem('fcs:mock', JSON.stringify(s));
    location.hash = '#/impostazioni/avanzate';
  });
  await p.reload({ waitUntil: 'load' });
  await p.waitForSelector('[data-act="server"]', { timeout: 8000 }).catch(() => {});
  et(!!(await p.$('[data-act="server"]')) && !!(await p.$('[data-act="diagnostica"]')), 'chi amministra vede ancora server e diagnostica');

  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
  await b.close();
  for (const t of ok) console.log('  ok  ' + t);
  for (const t of ko) console.log('  KO  ' + t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
