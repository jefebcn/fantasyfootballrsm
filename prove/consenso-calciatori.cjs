/**
 * Il consenso dei calciatori (044).
 * - #/giocatori, senza account: nessuna scelta gia' spuntata, gli sponsor
 *   compaiono solo sotto il «Ci sto», il genitore solo sotto i 18 anni, e
 *   «Invia» si accende solo a modulo completo. Dopo: un codice FT-XXXX, che
 *   resta su questo telefono.
 * - La console: la richiesta arriva «da verificare»; scelto il giocatore e
 *   premuto «Verificato via Instagram», ha il bollino «Ha aderito».
 * - La Home: il banner «Giochi nel campionato?», che con «Non gioco» sparisce
 *   e non torna.
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
    if (!localStorage.getItem('fcs:prefs')) localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'system' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  const p = await ctx.newPage();
  p.on('dialog', (d) => d.accept());
  const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  const w = (ms = 450) => p.waitForTimeout(ms);
  const spento = () => p.$eval('#ad-invia', (x) => x.disabled);

  // --- IL MODULO, senza account
  await p.goto(`${BASE}/#/giocatori`, { waitUntil: 'load' });
  await p.waitForSelector('#ades', { timeout: 8000 }).catch(() => {});
  et(await p.$$eval('#ades input[type=radio]:checked', (x) => x.length) === 0, 'nessuna scelta è già spuntata');
  et(await spento(), '«Invia» è spento a modulo vuoto');
  et(await p.$eval('#ad-sponsor-box', (x) => x.hidden), 'la casella sponsor non c\'è finché non dici «Ci sto»');
  await p.fill('#ad-nome', 'Mario Rossi');
  await p.selectOption('#ad-squadra', { label: 'Virtus' });
  await p.fill('#ad-ig', 'mariorossi');
  await p.check('input[name="ad-scelta"][value="aderisco"]');
  et(!(await p.$eval('#ad-sponsor-box', (x) => x.hidden)), 'col «Ci sto» compare la casella sponsor, facoltativa');
  et(!(await p.$eval('#ad-sponsor', (x) => x.checked)), 'e non è spuntata');
  await p.check('#ad-sponsor');
  await p.check('input[name="ad-eta"][value="no"]');
  et(!(await p.$eval('#ad-gen-box', (x) => x.hidden)), 'sotto i 18 anni compare il genitore');
  await p.check('#ad-io');
  et(await spento(), 'minorenne senza genitore: «Invia» resta spento');
  await p.fill('#ad-gen', 'Anna Rossi'); await p.check('#ad-gen-ok');
  et(!(await spento()), 'col genitore d\'accordo «Invia» si accende');
  await p.click('#ad-invia'); await w(900);
  const codice = await p.evaluate(() => document.getElementById('ad-codice')?.textContent || '');
  et(/^FT-[A-Z0-9]{4}$/.test(codice), `dopo l'invio c'è il codice (${codice})`);
  const testo = await p.evaluate(() => document.querySelector('main')?.innerText || '');
  et(/@fantatitano/.test(testo) && /dal tuo profilo/.test(testo), 'e dice a chi mandarlo e da dove');
  const riga = await p.evaluate(() => (JSON.parse(localStorage.getItem('fcs:mock') || '{}').tables?.adesioni_giocatori || [])[0]);
  et(riga && riga.scelta === 'aderisco' && riga.sponsor === true && riga.maggiorenne === false && riga.genitore === 'Anna Rossi'
    && riga.instagram === '@mariorossi' && riga.codice === codice && /^v1/.test(riga.versione || ''),
  `nel database: scelta, sponsor, genitore, Instagram, codice e versione (${JSON.stringify(riga && { s: riga.sponsor, m: riga.maggiorenne, ig: riga.instagram, v: riga.versione })})`);
  await p.reload({ waitUntil: 'load' }); await w(900);
  et((await p.evaluate(() => document.getElementById('ad-codice')?.textContent || '')) === codice, 'riaprendo la pagina il codice c\'è ancora');

  // --- LA CONSOLE: verificare
  await p.evaluate(() => { localStorage.removeItem('ft.adesione'); location.hash = '#/'; }); await p.reload({ waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await w(250);
  await p.fill('#email', 'a@e.it'); await p.fill('#name', 'Conti25'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1000);
  await p.click('[data-form="create"]'); await w(250);
  await p.fill('#lname', 'Torneo Titano'); await p.fill('#team', 'Hasta El Roxy'); await p.click('#go-create'); await w(1400);

  // --- IL BANNER IN HOME
  await p.evaluate(() => { location.hash = '#/'; }); await w(1200);
  et(!!(await p.$('.invito-calc')), 'in Home c\'è il banner «Giochi nel campionato?»');
  await p.click('.invito-calc [data-calc="no"]'); await w(500);
  et(!(await p.$('.invito-calc')), '«Non gioco» lo toglie');
  await p.reload({ waitUntil: 'load' }); await w(1500);
  et(!(await p.$('.invito-calc')), 'e non torna riaprendo l\'app');

  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    Object.assign(s.tables.profiles.find((x) => x.id === s.userId), { is_admin: true, is_owner: true });
    localStorage.setItem('fcs:mock', JSON.stringify(s));
    location.hash = '#/admin/console';
  });
  await p.reload({ waitUntil: 'load' });
  await p.waitForFunction(() => /Mario Rossi/.test(document.body.innerText), null, { timeout: 8000 }).catch(() => {});
  const c1 = await p.evaluate(() => document.body.innerText);
  et(/Da verificare/.test(c1) && c1.includes(codice), 'la richiesta arriva in console, da verificare, col suo codice');
  et(/Minorenne · genitore Anna Rossi/.test(c1) && /Sponsor sì/.test(c1), 'con minorenne, genitore e sponsor in vista');
  const pid = await p.evaluate(() => document.querySelector('[data-ades-gioc]')?.value);
  et(/^virtus_/.test(pid || ''), `propone i giocatori della sua squadra (${pid})`);
  await p.click('[data-ades-ver$="|instagram"]'); await w(400);
  et(/screenshot/i.test(await p.evaluate(() => document.getElementById('toast')?.textContent || '')), 'senza screenshot non verifica e lo dice');
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  await p.setInputFiles('[data-ades-file]', { name: 'dm.png', mimeType: 'image/png', buffer: PNG });
  await p.click('[data-ades-ver$="|instagram"]');
  await p.waitForFunction(() => /Verificato/.test(document.getElementById('toast')?.textContent || ''), null, { timeout: 8000 }).catch(() => {});
  const c2 = await p.evaluate(() => document.body.innerText);
  et(/Verificato · Instagram/.test(c2), 'premuto «Verificato via Instagram» lo stato cambia');
  et(await p.evaluate(async (id) => (await import('/src/state.js')).haAderito(id), pid), 'e il giocatore ha aderito');
  await p.evaluate((id) => { location.hash = `#/giocatore/${id}`; }, pid); await w(1000);
  et(/Ha aderito a Fantatitano/.test(await p.evaluate(() => document.querySelector('main')?.innerText || '')), 'sulla sua scheda c\'è il bollino');
  await p.reload({ waitUntil: 'load' }); await w(1800);
  et(await p.evaluate(async (id) => (await import('/src/state.js')).haAderito(id), pid), 'e resta riaprendo l\'app (dal database)');

  // --- LE PROVE: registro, CSV, attestato, ritiro
  await p.evaluate(() => { location.hash = '#/admin/console'; });
  await p.waitForFunction(() => /passaggi/.test(document.body.innerText), null, { timeout: 8000 }).catch(() => {});
  et(/Registro: 2 passaggi · catena integra/.test(await p.evaluate(() => document.body.innerText)), 'la console mostra il registro: 2 passaggi, catena integra');
  const [scarico] = await Promise.all([p.waitForEvent('download', { timeout: 8000 }).catch(() => null), p.click('[data-ades-csv="consensi"]')]);
  const csv = scarico ? require('fs').readFileSync(await scarico.path(), 'utf8') : '';
  et(/Mario Rossi/.test(csv) && csv.includes(codice) && /127\.0\.0\.1/.test(csv) && /instagram/.test(csv), `il CSV dei consensi ha nome, codice, IP e verifica (${scarico ? scarico.suggestedFilename() : 'nessun file'})`);
  const idRich = await p.evaluate(() => document.querySelector('[href^="#/consenso/"]')?.getAttribute('href').split('/').pop());
  await p.evaluate((id) => { location.hash = `#/consenso/${id}`; }, idRich);
  await p.waitForFunction(() => /Il registro/.test(document.body.innerText), null, { timeout: 8000 }).catch(() => {});
  const att = await p.evaluate(() => document.querySelector('main')?.innerText || '');
  et(/Attestato di consenso n\./.test(att) && /Verificato: il consenso vale/.test(att), 'l\'attestato dice che il consenso vale');
  et(/Ci sto\./.test(att) && /Anche con sponsor e premi/.test(att) && /genitore: Anna Rossi/.test(att), 'con le frasi spuntate e il genitore');
  et(/Inviata dal calciatore/.test(att) && /Verificata/.test(att), 'e i passaggi del registro');
  et(!!(await p.$('.att-prova')), 'e lo screenshot della verifica');
  et(!!(await p.$('#att-pdf')), 'e si salva in PDF');
  await p.evaluate(() => { location.hash = '#/admin/console'; });
  await p.waitForSelector('[data-ades-rit]', { timeout: 8000 }).catch(() => {});
  await p.click('[data-ades-rit]');
  await p.waitForFunction(() => /Ritiro registrato/.test(document.getElementById('toast')?.textContent || ''), null, { timeout: 8000 }).catch(() => {});
  et(!(await p.evaluate(async (id) => (await import('/src/state.js')).haAderito(id), pid)), 'ritirato: il bollino sparisce');
  et(/^Giocatore \d+$/.test(await p.evaluate(async (id) => (await import('/src/state.js')).playersById.get(id).name, pid)), 'e il nome torna «Giocatore»');
  et(/Registro: 3 passaggi/.test(await p.evaluate(() => document.body.innerText)), 'e il ritiro è il terzo passaggio del registro');

  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
  await b.close();
  for (const t of ok) console.log('  ok  ' + t);
  for (const t of ko) console.log('  KO  ' + t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
