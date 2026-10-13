/**
 * PANCHINA SCOPERTA.
 *
 * Dalla 6ª un titolare senza voto e senza sostituto e' un buco e conta 0
 * (art. 8.6, Alex 13/10). Se in panchina manca un ruolo che hai in campo —
 * di solito il portiere — quel ruolo non ha rete: l'editor della formazione
 * lo dice prima della consegna, senza bloccarla.
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
  const w = (ms = 700) => p.waitForTimeout(ms);
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await p.fill('#email', 'panca@e.it'); await p.fill('#name', 'Alex');
  await p.fill('#password', 'password123'); await p.click('#primary'); await w(1200);
  await p.click('[data-form="create"]'); await p.fill('#lname', 'Torneo'); await p.fill('#team', 'Prova FC');
  await p.click('#go-create'); await w(1400);
  await p.evaluate(() => { location.hash = '#/lega'; }); await w(700); await p.click('#draft'); await w(2200);
  await p.evaluate(() => { location.hash = '#/rosa/formazione'; }); await w(1200);
  const prima = await p.evaluate(() => document.querySelector('.panchina-scoperta')?.innerText || '');
  et(!prima, `con un portiere in panchina nessun avviso («${prima.slice(0, 60)}»)`);
  await p.click('#confirm'); await w(1200);
  // la formazione salvata, senza il portiere in panchina
  await p.evaluate(async () => {
    const S = await import('/src/state.js');
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    const l = s.tables.lineups[s.tables.lineups.length - 1];
    l.lineup.bench = l.lineup.bench.map((id) => (S.playersById.get(id)?.role === 'P' ? null : id));
    localStorage.setItem('fcs:mock', JSON.stringify(s));
  });
  await p.reload({ waitUntil: 'load' }); await w(1500);
  await p.evaluate(() => { location.hash = '#/rosa/formazione'; }); await w(1200);
  const dopo = await p.evaluate(() => ({ testo: document.querySelector('.panchina-scoperta')?.innerText || '',
    conferma: !document.querySelector('#confirm')?.disabled }));
  et(/nessun portiere/i.test(dopo.testo), `senza portiere in panchina lo dice («${dopo.testo.slice(0, 70)}»)`);
  et(/conta 0/.test(dopo.testo), 'e dice che sarebbe un buco: conta 0');
  et(dopo.conferma, 'ma la consegna non e\' bloccata');
  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
  await b.close();
  for (const x of ok) console.log('  ok  ' + x);
  for (const x of ko) console.log('  KO  ' + x);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
