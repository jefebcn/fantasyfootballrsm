/**
 * La formazione è «salvata» solo quando il server l'ha ricevuta.
 *
 * Prima il messaggio «Formazione salvata» partiva subito e la consegna
 * restava sul telefono anche se il server non l'aveva presa (fuori rete):
 * uno credeva di aver consegnato e prendeva lo 0-3 a tavolino. Qui il finto
 * server rifiuta le scritture (__MOCK_RETE_GIU__): deve comparire «NON
 * consegnata», il tasto deve restare da confermare e il server deve restare
 * vuoto. Poi la rete torna e la consegna passa.
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
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'dark' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  const p = await ctx.newPage(); p.on('dialog', (d) => d.accept()); const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  const w = (ms = 700) => p.waitForTimeout(ms);
  const tasto = () => p.evaluate(() => { const t = document.querySelector('#confirm'); return { testo: t?.innerText.trim() || '', gia: !!t?.classList.contains('gia-confermata') }; });
  const consegnate = () => p.evaluate(() => JSON.parse(localStorage.getItem('fcs:mock')).tables.lineups.length);
  const avviso = () => p.evaluate(() => document.getElementById('toast')?.textContent || '');
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await p.fill('#email', 'rete@e.it'); await p.fill('#name', 'Alex');
  await p.fill('#password', 'password123'); await p.click('#primary'); await w(1200);
  await p.click('[data-form="create"]'); await p.fill('#lname', 'Torneo'); await p.fill('#team', 'Prova FC');
  await p.click('#go-create'); await w(1400);
  await p.evaluate(() => { location.hash = '#/lega'; }); await w(700); await p.click('#draft'); await w(2200);
  await p.evaluate(() => { location.hash = '#/rosa/formazione'; }); await w(1200);

  await p.evaluate(() => { window.__MOCK_RETE_GIU__ = true; });
  await p.click('#confirm'); await w(1200);
  const msg = await avviso();
  et(/NON consegnata/.test(msg), `senza rete dice che NON è consegnata («${msg}»)`);
  et(!/salvata/i.test(msg), 'e non dice «salvata»');
  const t1 = await tasto();
  et(!t1.gia && /conferma/i.test(t1.testo), `il tasto resta da confermare («${t1.testo}»)`);
  et((await consegnate()) === 0, 'il server non ha nessuna formazione');

  await p.evaluate(() => { window.__MOCK_RETE_GIU__ = false; });
  await p.click('#confirm'); await w(1400);
  const msg2 = await avviso();
  et(/salvata/i.test(msg2), `con la rete torna «salvata» («${msg2}»)`);
  const t2 = await tasto();
  et(t2.gia, `e il tasto dice già confermata («${t2.testo}»)`);
  et((await consegnate()) >= 1, 'e il server ha la formazione');
  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);

  await b.close();
  for (const x of ok) console.log('  ok  ' + x);
  for (const x of ko) console.log('  KO  ' + x);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
