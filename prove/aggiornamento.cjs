/**
 * L'aggiornamento: dal 15/11 entra da solo, in un momento tranquillo (cambio
 * di schermata, app in secondo piano), al massimo una volta ogni 10 minuti;
 * oltre quel limite aspetta in silenzio: la barra «Aggiorna» non compare mai
 * (Alex, 21/11).
 *
 * Nasce dall'app installata sull'iPhone di Alex, che e' rimasta quella del
 * giorno prima per un giorno intero: sulla schermata Home una PWA resta
 * sospesa e torna su com'era, e il codice nuovo — gia' scaricato — aspettava
 * una riapertura che non arrivava.
 *
 * Il service worker qui e' bloccato, ma l'evento che conta si puo' lanciare a
 * mano su navigator.serviceWorker. Il primo passaggio di controllo e' la
 * prima installazione e non deve dire niente; dal secondo in poi e' un
 * aggiornamento.
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
  const p = await ctx.newPage(); p.on('dialog', d => d.accept());
  const errori = []; p.on('pageerror', e => errori.push(e.message));
  const w = (ms = 450) => p.waitForTimeout(ms);
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1200);
  await p.click('[data-tab="up"]'); await w(250);
  await p.fill('#email', 'a@e.it'); await p.fill('#name', 'Alessandro'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1000);
  await p.click('[data-form="create"]'); await w(250);
  await p.fill('#lname', 'Prova'); await p.fill('#team', 'Prova FC'); await p.click('#go-create'); await w(1200);
  await p.evaluate(() => { location.hash = '#/'; }); await w(800);

  const barra = () => p.evaluate(() => document.getElementById('aggiorna')?.innerText || '');
  et((await barra()) === '', 'niente barra finche\' non cambia niente');

  await p.evaluate(() => navigator.serviceWorker.dispatchEvent(new Event('controllerchange'))); await w(200);
  et((await barra()) === '', 'il primo passaggio di controllo e\' la prima installazione: silenzio');

  // dal 15/11 l'aggiornamento entra da solo: niente barra, si ricarica al primo cambio di schermata
  await p.evaluate(() => { try { localStorage.removeItem('fcs:ricarica-auto'); } catch {} });
  await p.evaluate(() => navigator.serviceWorker.dispatchEvent(new Event('controllerchange'))); await w(200);
  et((await barra()) === '', 'il secondo e\' un aggiornamento: nessuna barra «Aggiorna»');

  // con un campo in uso non si ricarica: si aspetta
  const t0 = await p.evaluate(() => performance.timeOrigin);
  await p.evaluate(() => { const i = document.createElement('input'); i.id = 'prova-campo'; document.body.appendChild(i); i.focus(); location.hash = '#/rosa'; }); await w(900);
  et((await p.evaluate(() => performance.timeOrigin)) === t0, 'mentre si scrive in un campo non ricarica');
  await p.evaluate(() => { document.getElementById('prova-campo')?.remove(); });

  // cambio di schermata in un momento tranquillo: ricarica da sola, sulla schermata nuova
  await Promise.all([p.waitForEvent('load'), p.evaluate(() => { location.hash = '#/classifica'; })]); await w(900);
  const t1 = await p.evaluate(() => performance.timeOrigin);
  et(t1 > t0, 'al cambio di schermata ricarica da sola');
  et((await p.evaluate(() => location.hash)) === '#/classifica', 'e resta sulla schermata scelta');
  et((await barra()) === '', 'senza barre dopo la ricarica');

  // un altro aggiornamento entro 10 minuti: niente seconda ricarica (il vecchio ciclo infinito) e niente barra
  await p.evaluate(() => navigator.serviceWorker.dispatchEvent(new Event('controllerchange'))); await w(100);
  await p.evaluate(() => navigator.serviceWorker.dispatchEvent(new Event('controllerchange'))); await w(100);
  await p.evaluate(() => { location.hash = '#/'; }); await w(900);
  et((await p.evaluate(() => performance.timeOrigin)) === t1, 'entro 10 minuti non ricarica una seconda volta');
  et((await barra()) === '' && !(await p.$('#aggiorna')), 'e non compare nessuna barra «Aggiorna»');

  // passati i 10 minuti, il primo cambio di schermata porta il codice nuovo, sempre in silenzio
  await p.evaluate(() => localStorage.setItem('fcs:ricarica-auto', String(Date.now() - 11 * 60 * 1000)));
  await Promise.all([p.waitForEvent('load'), p.evaluate(() => { location.hash = '#/classifica'; })]); await w(900);
  const t2 = await p.evaluate(() => performance.timeOrigin);
  et(t2 > t1, 'passati i 10 minuti ricarica da sola al cambio di schermata');
  et((await barra()) === '', 'senza barre');
  // la formazione modificata e non confermata vive solo in memoria: con quella in sospeso niente ricarica
  await p.evaluate(() => { location.hash = '#/rosa/formazione'; }); await w(1200);
  const sospesa = () => p.evaluate(async () => (await import('/src/views/formazione.js')).formazioneInSospeso());
  et((await sospesa()) === false, 'formazione appena aperta: niente in sospeso (la ricarica puo\' entrare)');
  const modulo = p.getByRole('button', { name: '3-5-2' });
  if (await modulo.count()) { await modulo.first().click(); await w(400); et((await sospesa()) === true, 'modulo cambiato e non confermato: in sospeso, la ricarica aspetta'); }
  et((await p.evaluate(async () => (await import('/src/app.js')).momentoTranquillo())) === false || !(await modulo.count()), 'e il momento non e\' tranquillo');
  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);

  await b.close();
  for (const t of ok) console.log('  ok  ' + t);
  for (const t of ko) console.log('  KO  ' + t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
