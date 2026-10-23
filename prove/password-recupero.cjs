/**
 * IL RECUPERO DELLA PASSWORD, fino in fondo.
 *
 * Log del 23/10: chi apriva il link di «Password dimenticata?» entrava, ma
 * l'app non gli chiedeva la password nuova; riapriva il link («gia' usato»)
 * e poi sbagliava due volte la password vecchia. Qui:
 *  - tornati dal link (type=recovery) si apre subito «Scegli la nuova password»;
 *  - le regole del server (6 caratteri, una lettera, un numero) si spuntano
 *    mentre si scrive, e una password che non le rispetta non parte;
 *  - salvata, la password e' quella nuova;
 *  - il secondo tocco sullo stesso link, da dentro, offre di sceglierla
 *    invece di mandare a chiedere un altro link;
 *  - all'iscrizione «calcio» viene fermata in italiano, prima del server.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    if (location.protocol === 'about:') return;   // la pagina vuota fra due aperture non ha localStorage
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    localStorage.setItem('fcs:auth', 'supabase');
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'light' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  const p = await ctx.newPage(); p.on('dialog', (d) => d.accept()); const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  const w = (ms = 500) => p.waitForTimeout(ms);
  const foglio = () => p.evaluate(() => (document.querySelector('#sheet.on') ? document.getElementById('sheet').innerText : ''));
  const toast = () => p.evaluate(() => [...document.querySelectorAll('.toast, #toast')].map((x) => x.innerText).join(' '));

  // ---- iscrizione: «calcio» si ferma prima del server, in italiano
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await p.fill('#email', 'recupero@e.it'); await p.fill('#name', 'Andrea');
  await p.fill('#password', 'calcio'); await p.click('#primary'); await w(700);
  const avviso = await p.evaluate(() => document.querySelector('main, .app')?.innerText || '');
  et(/deve avere un numero/i.test(avviso), 'iscrizione con «calcio»: «La password deve avere un numero»');
  et(await p.inputValue('#email') === 'recupero@e.it' && await p.inputValue('#name') === 'Andrea', 'e l\'errore non svuota e-mail e nome');
  await p.fill('#password', 'calcio1'); await p.click('#primary'); await w(1200);

  // ---- ritorno dal link del recupero: il frammento porta type=recovery
  await p.goto('about:blank');   // un cambio di solo frammento non ricaricherebbe la pagina
  await p.goto(`${BASE}/#access_token=finto&refresh_token=finto&type=recovery`, { waitUntil: 'load' }); await w(1800);
  const f1 = await foglio();
  et(/Scegli la nuova password/.test(f1), 'tornati dal link si apre subito «Scegli la nuova password»');
  et(/recupero@e\.it/.test(f1), 'e dice con quale account si è entrati');
  et(!/type=recovery|access_token/.test(await p.evaluate(() => location.href)), 'i token spariscono dall\'indirizzo');

  // le regole si spuntano mentre si scrive
  await p.fill('#np1', 'calcio'); await w(150);
  const spunte = await p.evaluate(() => [...document.querySelectorAll('.np-regole li.ok')].map((x) => x.dataset.regola));
  et(spunte.includes('lunga') && spunte.includes('lettera') && !spunte.includes('numero'), `«calcio»: spuntate lunghezza e lettera, non il numero (${spunte})`);
  await p.fill('#np2', 'calcio'); await p.click('#np-salva'); await w(500);
  const ancora = await foglio();
  et(/Scegli la nuova password/.test(ancora), 'senza numero non si salva: il foglio resta aperto');
  await p.fill('#np1', 'Titano26'); await p.fill('#np2', 'Titano25'); await w(150);
  et(/non sono uguali/.test(await p.evaluate(() => document.querySelector('.np-uguali')?.innerText || '')), 'due password diverse: lo dice mentre si scrive');
  await p.fill('#np2', 'Titano26'); await p.click('#np-salva'); await w(800);
  const salvata = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('fcs:mock')); return s.tables.profiles.find((x) => x.id === s.userId)?.password; });
  et(salvata === 'Titano26', 'salvata: la password è quella nuova');
  et(!(await foglio()), 'e il foglio si chiude');
  et(await p.evaluate(() => sessionStorage.getItem('fcs:recupero-password')) === null, 'il recupero è chiuso: alla prossima apertura non lo richiede');

  // ---- secondo tocco sullo stesso link, da dentro
  await p.goto('about:blank');
  await p.goto(`${BASE}/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`, { waitUntil: 'load' }); await w(1800);
  const f2 = await foglio();
  et(/già usato/i.test(f2) && /sei già dentro/i.test(f2), `il link riaperto da dentro: «l'avevi già usato… sei già dentro»`);
  await p.click('#ritorno-pw'); await w(400);
  et(/nuova password/i.test(await foglio()), 'e da lì si sceglie la password, senza chiedere un altro link');

  // ---- da Impostazioni, lo stesso foglio
  await p.evaluate(() => document.getElementById('sheet-scrim')?.click()); await w(300);
  await p.evaluate(() => { location.hash = '#/impostazioni'; }); await w(800);
  await p.click('[data-act="password"]'); await w(400);
  const f3 = await foglio();
  et(/Cambia password/.test(f3) && !!(await p.$('#np1')) && !!(await p.$('#np2')), 'da Impostazioni: lo stesso foglio, con due campi e le regole');

  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
  void toast;
  await b.close();
  for (const x of ok) console.log('  ok  ' + x);
  for (const x of ko) console.log('  KO  ' + x);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
