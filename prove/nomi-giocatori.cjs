/**
 * I nomi dei giocatori, se serve (041): tre strumenti pronti e spenti.
 * - Nomi brevi: un interruttore in console, e tutti i giocatori diventano
 *   iniziali («G.V.»). Formazioni e punti non cambiano.
 * - Chi chiede di non comparire: dalla console si esclude, e nell'app
 *   diventa «Giocatore N».
 * - La pagina #/giocatori: aperta senza account, un calciatore dice «ci sto»
 *   o «toglietemi», e la richiesta arriva in console.
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

  // --- LA PAGINA PER I CALCIATORI, senza account
  await p.goto(`${BASE}/#/giocatori`, { waitUntil: 'load' });
  await p.waitForSelector('#ades', { timeout: 8000 }).catch(() => {});
  et(!!(await p.$('#ades')), 'la pagina #/giocatori si apre senza account');
  await p.fill('#ad-nome', 'Mario Rossi');
  await p.selectOption('#ad-squadra', { index: 2 });
  await p.check('input[name="ad-scelta"][value="escludimi"]');
  await p.fill('#ad-contatto', '@mario');
  await p.click('#ades button[type="submit"]'); await w(900);
  const grazie = await p.evaluate(() => document.querySelector('main')?.innerText || '');
  et(/Ricevuto/.test(grazie) && /Giocatore/.test(grazie), `dopo l'invio dice cosa succederà (${grazie.slice(0, 60).replace(/\n/g, ' ')})`);
  const riga = await p.evaluate(() => (JSON.parse(localStorage.getItem('fcs:mock') || '{}').tables?.adesioni_giocatori || [])[0]);
  et(riga?.nome === 'Mario Rossi' && riga?.scelta === 'escludimi', `la richiesta e' scritta nel database (${JSON.stringify(riga && { nome: riga.nome, scelta: riga.scelta })})`);

  // --- IL PROPRIETARIO, in console
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await w(250);
  await p.fill('#email', 'a@e.it'); await p.fill('#name', 'Conti25'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1000);
  await p.click('[data-form="create"]'); await w(250);
  await p.fill('#lname', 'Torneo Titano'); await p.fill('#team', 'Hasta El Roxy'); await p.click('#go-create'); await w(1400);
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    Object.assign(s.tables.profiles.find((x) => x.id === s.userId), { is_admin: true, is_owner: true });
    localStorage.setItem('fcs:mock', JSON.stringify(s));
    location.hash = '#/admin/console';
  });
  await p.reload({ waitUntil: 'load' });
  await p.waitForSelector('[data-brevi]', { timeout: 8000 }).catch(() => {});
  await p.waitForFunction(() => /Mario Rossi/.test(document.body.innerText), null, { timeout: 8000 }).catch(() => {});
  const console1 = await p.evaluate(() => document.body.innerText);
  et(/Nomi brevi: spenti/.test(console1), 'la console mostra i nomi brevi spenti');
  et(/Mario Rossi/.test(console1) && /Non vuole comparire/.test(console1), 'la richiesta del calciatore arriva in console');

  // un nome vero dal listone, per controllarlo prima e dopo
  const g = await p.evaluate(async () => { const S = await import('/src/state.js'); const x = S.base.players.find((q) => !q.doppioneDi); return { id: x.id, nome: x.name, cognome: x.lastName, iniziali: `${x.firstName[0]}.${x.lastName[0]}.` }; });

  await p.click('[data-brevi="on"]');
  await p.waitForFunction(() => /accesi/.test(document.getElementById('toast')?.textContent || ''), null, { timeout: 8000 }).catch(() => {});
  et(domande.some((d) => /iniziali/.test(d)), 'prima di accenderli spiega cosa succede');
  const brevi = await p.evaluate(async (id) => { const S = await import('/src/state.js'); return S.playersById.get(id).name; }, g.id);
  et(brevi.startsWith(g.iniziali), `accesi: ${g.nome} diventa ${brevi}`);
  await p.evaluate(() => { location.hash = '#/listone'; }); await w(1000);
  const listone = await p.evaluate(() => document.querySelector('main')?.innerText || '');
  et(!listone.includes(g.cognome), 'e nel listone il cognome non si legge più');
  const riga2 = await p.evaluate(() => (JSON.parse(localStorage.getItem('fcs:mock')).tables.app_interruttori || []).find((r) => r.chiave === 'nomi_brevi'));
  et(riga2?.acceso === true, 'l\'interruttore e\' scritto nel database');
  await p.evaluate(async () => { const S = await import('/src/state.js'); await S.impostaNomiBrevi(false); });
  const tornato = await p.evaluate(async (id) => { const S = await import('/src/state.js'); return S.playersById.get(id).name; }, g.id);
  et(tornato === g.nome, `spenti: torna ${tornato}`);

  // --- ESCLUDERE UN GIOCATORE dalla console
  await p.evaluate(() => { location.hash = '#/admin/console'; }); await p.waitForSelector('#adm-escludi', { timeout: 8000 }).catch(() => {});
  await p.fill('#adm-escludi', g.cognome); await p.press('#adm-escludi', 'Enter'); await w(500);
  await p.click(`[data-escludi="${g.id}"]`);
  await p.waitForFunction(() => /Escluso/.test(document.getElementById('toast')?.textContent || ''), null, { timeout: 8000 }).catch(() => {});
  const escluso = await p.evaluate(async (id) => { const S = await import('/src/state.js'); return S.playersById.get(id).name; }, g.id);
  et(/^Giocatore \d+$/.test(escluso), `escluso: compare come «${escluso}»`);
  await p.reload({ waitUntil: 'load' }); await w(1800);
  const dopo = await p.evaluate(async (id) => { const S = await import('/src/state.js'); return S.playersById.get(id).name; }, g.id);
  et(/^Giocatore \d+$/.test(dopo), 'e resta così riaprendo l\'app');
  await p.waitForSelector('[data-riammetti]', { timeout: 8000 }).catch(() => {});
  await p.click(`[data-riammetti="${g.id}"]`); await w(700);
  const rimesso = await p.evaluate(async (id) => { const S = await import('/src/state.js'); return S.playersById.get(id).name; }, g.id);
  et(rimesso === g.nome, `«Rimetti il nome»: torna ${rimesso}`);

  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
  await b.close();
  for (const t of ok) console.log('  ok  ' + t);
  for (const t of ko) console.log('  KO  ' + t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
