/**
 * LA SESSIONE PERSA NON DIVENTA UN ERRORE DEL DATABASE.
 *
 * Console, 12/10: «new row violates row-level security policy for table
 * "profiles"», da un iPhone, sulla schermata offline (backend.js,
 * ensureProfile). Con la rete che va e viene il token scade e non si
 * rinnova: le richieste partono come anonimo, il profilo non si vede, e
 * l'app provava a CREARLO — la RLS rifiutava, e un iscritto restava fuori
 * con un messaggio del database.
 * Qui si perde la sessione dopo l'avvio e si guarda che:
 *   - l'app dica che manca la connessione, con «Riprova», e non parli di RLS;
 *   - in Console non arrivi niente (e' la rete, non un difetto);
 *   - il profilo resti quello di prima;
 *   - tornata la sessione, «Riprova» faccia entrare.
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
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'light' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
    if (sessionStorage.getItem('prova:persa')) globalThis.__MOCK_SESSIONE_PERSA__ = true;
    if (sessionStorage.getItem('prova:dopo')) globalThis.__MOCK_SCADE_DOPO_PROFILO__ = true;
  });
  const p = await ctx.newPage(); p.on('dialog', (d) => d.accept());
  const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  const w = (ms = 700) => p.waitForTimeout(ms);
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await p.fill('#email', 's@e.it'); await p.fill('#name', 'Matty');
  await p.fill('#password', 'password123'); await p.click('#primary'); await w(1200);
  await p.click('[data-form="create"]'); await p.fill('#lname', 'Torneo'); await p.fill('#team', 'Prova FC');
  await p.click('#go-create'); await w(1500);
  const nomePrima = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('fcs:mock')); return s.tables.profiles.find((x) => x.id === s.userId)?.display_name; });

  // il telefono torna dallo sfondo con la rete che balla: la sessione e' persa
  await p.evaluate(() => sessionStorage.setItem('prova:persa', '1'));
  await p.reload({ waitUntil: 'load' }); await w(2000);
  const fuori = await p.evaluate(() => ({ hash: location.hash, testo: document.body.innerText, riprova: !!document.getElementById('retry') }));
  et(!/row-level security|violates|permission denied/i.test(fuori.testo), 'nessun messaggio del database sullo schermo');
  et(fuori.riprova && /connessione/i.test(fuori.testo), `dice che manca la connessione, con «Riprova» (${fuori.hash})`);
  const dopo = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('fcs:mock'));
    return { nome: s.tables.profiles.find((x) => x.id === s.userId)?.display_name,
      rls: (s.tables.errori_app || []).filter((e) => /row-level security|permission denied/i.test(e.messaggio)).length }; });
  et(dopo.rls === 0, `in Console non arriva come errore dell'app (${dopo.rls})`);
  et(dopo.nome === nomePrima, `il profilo resta quello di prima («${dopo.nome}»)`);

  // torna la rete: «Riprova» fa entrare
  await p.evaluate(() => { sessionStorage.removeItem('prova:persa'); globalThis.__MOCK_SESSIONE_PERSA__ = false; });
  if (fuori.riprova) { await p.click('#retry'); await w(1800); }
  const dentro = await p.evaluate(() => ({ hash: location.hash, testo: document.body.innerText }));
  et(/Prova FC|Torneo/.test(dentro.testo), `tornata la sessione, «Riprova» fa entrare (${dentro.hash})`);

  // Console, 18/10: la sessione cade DOPO il profilo, mentre arrivano i nomi
  // della lega (che leggono i profili): stessa schermata, niente database
  await p.evaluate(() => { localStorage.setItem('fcs:mock', JSON.stringify({ ...JSON.parse(localStorage.getItem('fcs:mock')), tables: { ...JSON.parse(localStorage.getItem('fcs:mock')).tables, errori_app: [] } })); sessionStorage.setItem('prova:dopo', '1'); });
  await p.reload({ waitUntil: 'load' }); await w(2000);
  const meta = await p.evaluate(() => ({ hash: location.hash, testo: document.body.innerText, riprova: !!document.getElementById('retry'),
    negati: (JSON.parse(localStorage.getItem('fcs:mock')).tables.errori_app || []).filter((e) => /permission denied/i.test(e.messaggio)).length }));
  et(meta.riprova && /connessione/i.test(meta.testo), `sessione caduta a meta' avvio: dice che manca la connessione (${meta.hash})`);
  et(!/permission denied/i.test(meta.testo), 'e non mostra «permission denied»');
  et(meta.negati === 0, `e in Console non arriva (${meta.negati})`);
  await p.evaluate(() => { sessionStorage.removeItem('prova:dopo'); globalThis.__MOCK_SESSIONE_PERSA__ = false; });
  if (meta.riprova) { await p.click('#retry'); await w(1800); }
  et(/Prova FC|Torneo/.test(await p.evaluate(() => document.body.innerText)), 'e «Riprova» fa rientrare');
  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
  await b.close();
  for (const t of ok) console.log('  ok  ' + t);
  for (const t of ko) console.log('  KO  ' + t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
