/**
 * La modalità prudente (032): un interruttore in console per mettersi in
 * regola in un minuto, se la FSGC o i calciatori chiedessero di togliere
 * qualcosa. Acceso: niente sponsor, highlights solo su YouTube. Spento: tutto
 * come prima. L'import dal sito FSGC lo ferma scripts/importa-fsgc.py, provato
 * in tests/importa-partite-finite.test.js.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    localStorage.setItem('fcs:auth', 'supabase');
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'system' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  const p = await ctx.newPage();
  const domande = []; p.on('dialog', (d) => { domande.push(d.message()); d.accept(); });
  const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  const w = (ms = 450) => p.waitForTimeout(ms);
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await w(250);
  await p.fill('#email', 'a@e.it'); await p.fill('#name', 'Conti25'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1000);
  await p.click('[data-form="create"]'); await w(250);
  await p.fill('#lname', 'Torneo Titano'); await p.fill('#team', 'Hasta El Roxy'); await p.click('#go-create'); await w(1400);

  // chi amministra, e uno sponsor in corso
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    Object.assign(s.tables.profiles.find((x) => x.id === s.userId), { is_admin: true, is_owner: true }); // il proprietario dell'app (033)
    (s.tables.sponsor ||= []).push({ id: 'sp1', nome: 'Bar Titano', claim: 'Dal 1972', link: 'https://esempio.sm', dal: new Date().toISOString().slice(0, 10), al: null, attivo: true });
    localStorage.setItem('fcs:mock', JSON.stringify(s));
    location.hash = '#/';
  });
  await p.reload({ waitUntil: 'load' });
  await p.waitForSelector('.spon', { timeout: 8000 }).catch(() => {});
  et(!!(await p.$('.spon')), 'prima: lo sponsor si vede');

  // senza la 032 l'interruttore e' spento e la console lo dice
  await p.evaluate(() => { location.hash = '#/admin/console'; });
  await p.waitForSelector('[data-prudente]', { timeout: 8000 }).catch(() => {});
  const prima = await p.$eval('.a-card.prudente', (x) => x.innerText).catch(() => '');
  et(/spenta/.test(prima), `la console mostra l'interruttore spento («${prima.split('\n')[0]}»)`);

  await p.click('[data-prudente="on"]');
  await p.waitForFunction(() => /accesa/.test(document.getElementById('toast')?.textContent || ''), null, { timeout: 8000 }).catch(() => {});
  et(domande.some((d) => /import dal sito FSGC si ferma/.test(d)), 'prima di accenderlo spiega cosa succede');
  const riga = await p.evaluate(() => (JSON.parse(localStorage.getItem('fcs:mock')).tables.app_interruttori || []).find((r) => r.chiave === 'prudente'));
  et(riga?.acceso === true, `l'interruttore e' scritto nel database (${JSON.stringify(riga && riga.acceso)})`);

  // riaperta l'app: resta acceso, niente sponsor, video solo su YouTube
  await p.evaluate(() => { location.hash = '#/'; });
  await p.reload({ waitUntil: 'load' }); await p.waitForSelector('.navbar, nav', { timeout: 8000 }).catch(() => {}); await w(1200);
  et(!(await p.$('.spon')), 'acceso: lo sponsor non si vede');
  await p.evaluate(() => { location.hash = '#/video'; });
  await p.waitForSelector('.vid-play', { timeout: 8000 }).catch(() => {});
  const play = await p.evaluate(() => { const a = document.querySelector('.vid-play'); return a ? { tag: a.tagName, href: a.getAttribute('href') || '' } : null; });
  et(play && play.tag === 'A' && /youtube\.com/.test(play.href), `acceso: il play porta su YouTube (${play ? play.tag + ' ' + play.href : 'nessun video'})`);
  if (play) {
    await p.evaluate(() => document.querySelector('.vid-play').addEventListener('click', (e) => e.preventDefault(), { once: true }));
    await p.click('.vid-play'); await w(400);
    et(!(await p.$('.vid iframe')), 'acceso: nessun video incorporato nell\'app');
  }

  // spento: torna tutto
  await p.evaluate(() => { location.hash = '#/admin/console'; });
  await p.waitForSelector('[data-prudente="off"]', { timeout: 8000 }).catch(() => {});
  await p.click('[data-prudente="off"]');
  await p.waitForFunction(() => /spenta/.test(document.getElementById('toast')?.textContent || ''), null, { timeout: 8000 }).catch(() => {});
  await p.evaluate(() => { location.hash = '#/video'; });
  await p.waitForSelector('.vid-play', { timeout: 8000 }).catch(() => {});
  const dopo = await p.evaluate(() => document.querySelector('.vid-play')?.tagName || '');
  et(dopo === 'BUTTON', `spento: il play torna dentro l'app (${dopo})`);
  await p.evaluate(() => { location.hash = '#/'; });
  await p.waitForSelector('.spon', { timeout: 8000 }).catch(() => {});
  et(!!(await p.$('.spon')), 'spento: lo sponsor torna');

  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
  await b.close();
  for (const t of ok) console.log('  ok  ' + t);
  for (const t of ko) console.log('  KO  ' + t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
