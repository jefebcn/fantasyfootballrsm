/**
 * CHI NON RICEVE LA MAIL DI CONFERMA (Alex, 12/10: «il miglior giocatore
 * del campionato non riesce a entrare, non gli arriva la mail»).
 *
 * Chi non conferma non ha ancora un profilo, quindi nella Console non c'era.
 * Qui si guarda che in Console → Persone compaia «Da confermare» con nome,
 * e-mail e quando e' partita l'ultima mail; che «Conferma io» lo confermi e
 * dica che gli e' partita la mail «il tuo account e' attivo»; che dopo sparisca
 * dalla lista; e che a un giocatore qualunque la Console non lo mostri.
 *
 * E il caso vero di quel giorno: Matteo era iscritto e confermato dal 10/10,
 * e si REGISTRAVA DI NUOVO. Supabase in quel caso non da' errore e non manda
 * nessuna mail; l'app diceva «manca solo la conferma». Ora deve dire che
 * l'account c'e' gia' e portarlo su «Accedi» con l'e-mail scritta.
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
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'system' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  const p = await ctx.newPage(); const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  const dialoghi = []; p.on('dialog', (d) => { dialoghi.push(d.message()); d.accept(); });
  const toast = () => p.evaluate(() => document.querySelector('.toast, .a-toast')?.innerText || '');
  const w = (ms) => p.waitForTimeout(ms);
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1200);
  await p.click('[data-tab="up"]'); await p.fill('#email', 'alex@e.it'); await p.fill('#name', 'Alex'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1000);
  // Alex amministratore, e due iscritti che non hanno confermato
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    s.tables.profiles.find((x) => x.id === s.userId).is_admin = true;
    s.tables.da_confermare = [
      { id: 'u-matty', email: 'matty@esempio.it', nome: 'Matty', iscritto: '2026-10-11T18:00:00Z', mail_inviata: '2026-10-12T07:00:00Z' },
      { id: 'u-gigi', email: 'gigi@esempio.it', nome: 'Gigi', iscritto: '2026-10-10T18:00:00Z', mail_inviata: '2026-10-10T18:00:00Z' },
    ];
    localStorage.setItem('fcs:mock', JSON.stringify(s));
  });
  await p.reload({ waitUntil: 'load' }); await w(1300);
  await p.evaluate(() => { location.hash = '#/admin/console'; }); await w(900);
  await p.click('[data-atab="persone"]'); await p.waitForSelector('[data-conferma]', { timeout: 15000 }).catch(() => {});
  const lista = await p.evaluate(() => ({ testo: document.querySelector('main')?.innerText || '', tasti: document.querySelectorAll('[data-conferma]').length }));
  et(/Da confermare/i.test(lista.testo) && lista.tasti === 2, `in Persone c'è «Da confermare» con i due iscritti (${lista.tasti})`);
  et(/matty@esempio\.it/.test(lista.testo) && /Matty/.test(lista.testo), 'con nome ed e-mail');
  et(/ultima mail/i.test(lista.testo), 'e quando è partita l\'ultima mail');

  await p.click('[data-conferma="u-matty"]'); await w(900);
  et(dialoghi.some((d) => /matty@esempio\.it/.test(d) && /mail/i.test(d)), 'prima chiede conferma, nominando l\'e-mail');
  const t = await toast();
  et(/Confermato/i.test(t) && /mail/i.test(t), `e poi dice che è confermato e che gli è partita la mail («${t}»)`);
  await p.waitForFunction(() => document.querySelectorAll('[data-conferma]').length === 1, null, { timeout: 8000 }).catch(() => {});
  const dopo = await p.evaluate(() => ({ testo: document.querySelector('main')?.innerText || '', tasti: [...document.querySelectorAll('[data-conferma]')].map((x) => x.dataset.conferma) }));
  et(dopo.tasti.length === 1 && dopo.tasti[0] === 'u-gigi', `Matty sparisce dalla lista, Gigi resta (${dopo.tasti.join(', ')})`);
  const stato = await p.evaluate(() => JSON.parse(localStorage.getItem('fcs:mock')).tables.da_confermare.find((x) => x.id === 'u-matty'));
  et(!!stato?.confermata, 'e il suo account risulta confermato');

  // un giocatore qualunque: la Console non c'e'
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('fcs:mock')); s.tables.profiles.find((x) => x.id === s.userId).is_admin = false; localStorage.setItem('fcs:mock', JSON.stringify(s)); });
  await p.reload({ waitUntil: 'load' }); await w(1200);
  await p.evaluate(() => { location.hash = '#/admin/console'; }); await w(900);
  et(await p.evaluate(() => !document.querySelector('[data-conferma]')), 'a chi non è amministratore la lista non si mostra');

  // ---- chi si registra con un'e-mail che ha gia' un account
  const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx2.addInitScript(() => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js'; window.__MOCK_CONFIRM__ = true;
    localStorage.setItem('fcs:auth', 'supabase');
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'system' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  const q = await ctx2.newPage(); q.on('pageerror', (e) => errori.push(e.message));
  const v = (ms) => q.waitForTimeout(ms);
  await q.goto(`${BASE}/#/`, { waitUntil: 'load' }); await v(1200);
  // l'account c'e' gia' (iscritto e confermato), ma lui non e' dentro
  await q.evaluate(() => { const s = JSON.parse(localStorage.getItem('fcs:mock') || '{"tables":{}}'); s.tables = s.tables || {}; s.tables.profiles = [{ id: 'u-matteo', email: 'prandelli@esempio.it', password: 'giusta123', display_name: 'Matteo Prandelli' }]; s.userId = null; localStorage.setItem('fcs:mock', JSON.stringify(s)); });
  await q.reload({ waitUntil: 'load' }); await v(1200);
  await q.click('[data-tab="up"]'); await v(250);
  await q.fill('#email', 'prandelli@esempio.it'); await q.fill('#name', 'Matteo'); await q.fill('#password', 'nuova123'); await q.click('#primary'); await v(1000);
  const gia = await q.evaluate(() => ({ testo: document.querySelector('main')?.innerText || '', email: document.querySelector('#email')?.value,
    attesa: /Controlla la posta|manca solo la conferma/i.test(document.querySelector('main')?.innerText || ''), titolo: document.querySelector('.tit')?.innerText }));
  et(!gia.attesa, 'registrandosi con un\'e-mail già iscritta NON lo manda ad aspettare una mail');
  et(/c'è già un account/i.test(gia.testo) && /non serve crearne un altro/i.test(gia.testo), 'gli dice che l\'account c\'è già e non serve crearne un altro');
  et(/Accedi/i.test(gia.titolo || '') && gia.email === 'prandelli@esempio.it', `e lo porta su «Accedi» con l'e-mail già scritta (${gia.titolo} · ${gia.email})`);
  await q.fill('#password', 'giusta123'); await q.click('#primary'); await v(1300);
  et(await q.evaluate(() => !document.querySelector('#primary') || !/Accedi/.test(document.querySelector('.tit')?.innerText || '')), 'e con la sua password entra');
  await ctx2.close();

  et(!errori.length, `nessun errore JS${errori.length ? `: ${errori[0]}` : ''}`);
  await b.close();
  ok.forEach((x) => console.log('  ok  ' + x)); ko.forEach((x) => console.log('  KO  ' + x));
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
