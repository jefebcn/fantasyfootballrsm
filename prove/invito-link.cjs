/**
 * IL LINK D'INVITO PORTA IL CODICE DENTRO.
 *
 * Prima chi veniva invitato riceveva «entra col codice ABC123 —
 * fantatitano.site» e doveva: aprire, iscriversi, andare nella posta a
 * confermare, rientrare, trovare «Entra con codice» e RICOPIARE il codice a
 * mano. Il codice doveva sopravvivere a un giro fuori dall'app, ed era li'
 * che l'invito si perdeva.
 *
 * Qui si fa il giro intero, con quattro persone diverse:
 *   1. chi organizza crea la lega e condivide: il link porta ?invito=CODICE;
 *   2. chi e' invitato apre il link, lo schermo d'accesso gli dice che il
 *      codice lo tiene l'app, si iscrive — e la conferma e-mail torna con
 *      il codice dentro;
 *   3. apre la conferma IN UN ALTRO BROWSER (la memoria del telefono li' e'
 *      vuota): il codice arriva lo stesso, il modulo e' gia' compilato, entra;
 *   4. chi e' gia' nella lega e riapre il link non trova nessun modulo;
 *   e un codice storto nel link non fa niente.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

const conMock = (ctx, stato, conferma) => ctx.addInitScript(([st, cf]) => {
  window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
  if (cf) window.__MOCK_CONFIRM__ = true;
  localStorage.setItem('fcs:auth', 'supabase');
  localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  if (!localStorage.getItem('fcs:prefs')) localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, theme: 'light' }));
  // il database finto e' uno per contesto: si passa quello di chi ha creato
  // la lega, cosi' il codice esiste davvero anche per gli altri
  if (st && !sessionStorage.getItem('seminato')) { localStorage.setItem('fcs:mock', JSON.stringify(st)); sessionStorage.setItem('seminato', '1'); }
}, [stato, conferma]);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const errori = [];
  const nuova = async (ctx) => { const p = await ctx.newPage(); p.on('dialog', (d) => d.accept()); p.on('pageerror', (e) => errori.push(e.message)); return p; };
  const vp = { viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' };
  const w = (p, ms = 700) => p.waitForTimeout(ms);

  // ---- 1. chi organizza
  let ctx = await b.newContext(vp); await conMock(ctx, null, false);
  let p = await nuova(ctx);
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(p, 1300);
  await p.click('[data-tab="up"]'); await p.fill('#email', 'org@e.it'); await p.fill('#name', 'Alex');
  await p.fill('#password', 'password123'); await p.click('#primary'); await w(p, 1200);
  await p.click('[data-form="create"]'); await p.fill('#lname', 'Torneo Titano'); await p.fill('#team', 'Hasta El Roxy');
  await p.click('#go-create'); await w(p, 1500);
  // cosa manda il tasto «Invita»: si prende il testo invece di aprire il foglio di sistema
  await p.evaluate(() => { location.hash = '#/lega'; }); await w(p, 900);
  const inviato = await p.evaluate(async () => {
    let testo = null;
    navigator.share = async (d) => { testo = d.text; };
    document.getElementById('share-code')?.click();
    await new Promise((r) => setTimeout(r, 300));
    return testo;
  });
  const CODICE = (inviato || '').match(/codice ([A-Z0-9]{6})/)?.[1];
  et(!!CODICE, `il tasto Invita manda il codice (${CODICE || 'nessuno'})`);
  et(new RegExp(`\\?invito=${CODICE}\\b`).test(inviato || ''), `e il link lo porta dentro ("…${(inviato || '').slice(-40)}")`);
  const db = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('fcs:mock')); s.userId = null; return s; });
  await ctx.close();

  // ---- 2. chi e' invitato apre il link e si iscrive (conferma e-mail attiva)
  ctx = await b.newContext(vp); await conMock(ctx, db, true);
  p = await nuova(ctx);
  await p.goto(`${BASE}/?invito=${CODICE}`, { waitUntil: 'load' }); await w(p, 1800);
  const arrivo = await p.evaluate(() => ({
    query: location.search, ricordato: localStorage.getItem('fcs:invito'),
    avviso: document.querySelector('.avviso.invito')?.innerText || '',
  }));
  et(!arrivo.query, `l'indirizzo si ripulisce del codice (${arrivo.query || 'pulito'})`);
  et(/"codice":"[A-Z0-9]{6}"/.test(arrivo.ricordato || ''), 'il codice si ricorda sul telefono');
  et(new RegExp(CODICE).test(arrivo.avviso), `lo schermo d'accesso dice che il codice lo tiene l'app, per chi entra e per chi si iscrive ("${arrivo.avviso.slice(0, 60)}…")`);
  await p.click('[data-tab="up"]'); await w(p, 300);
  await p.fill('#email', 'bea@e.it'); await p.fill('#name', 'Bea'); await p.fill('#password', 'password123');
  await p.click('#primary'); await w(p, 1300);
  const ritorno = await p.evaluate(() => window.__ULTIMO_RITORNO__ || '');
  et(new RegExp(`\\?invito=${CODICE}$`).test(ritorno),
    `la conferma e-mail torna col codice dentro, cosi' vale anche in un altro browser (${ritorno})`);
  const dbBea = await p.evaluate(() => JSON.parse(localStorage.getItem('fcs:mock')));
  await ctx.close();

  // ---- 3. la conferma si apre in un ALTRO browser: memoria vuota, sessione nuova
  const bea = dbBea.tables.profiles.find((x) => x.email === 'bea@e.it');
  ctx = await b.newContext(vp); await conMock(ctx, { ...dbBea, userId: bea.id }, false);
  p = await nuova(ctx);
  await p.goto(`${BASE}/?invito=${CODICE}`, { waitUntil: 'load' }); await w(p, 2200);
  const modulo = await p.evaluate(() => ({
    hash: location.hash, codice: document.getElementById('code')?.value || '',
    spiega: document.querySelector('.invitato')?.innerText || '',
  }));
  et(/leghe/.test(modulo.hash), `arriva alle leghe, non alla dashboard vuota (${modulo.hash})`);
  et(modulo.codice === CODICE, `il modulo «Entra con codice» è già compilato (${modulo.codice || 'vuoto'})`);
  et(/già qui/i.test(modulo.spiega), 'e dice che deve scegliere solo il nome della squadra');
  if (modulo.codice) {
    await p.fill('#team', 'Borgo FC'); await p.click('#go-join'); await w(p, 1800);
  }
  const dentro = await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    return { squadre: (s.tables.league_members || []).filter((m) => m.user_id === s.userId).map((m) => m.team_name),
      resta: localStorage.getItem('fcs:invito'), hash: location.hash };
  });
  et(dentro.squadre.includes('Borgo FC'), `ed entra nella lega (${dentro.squadre.join(', ') || 'in nessuna'})`);
  et(!dentro.resta, 'e l\'invito, fatto il suo lavoro, si dimentica');

  // ---- 4. chi e' gia' dentro riapre il link: niente modulo
  const dbDopo = await p.evaluate(() => JSON.parse(localStorage.getItem('fcs:mock')));
  await ctx.close();
  ctx = await b.newContext(vp); await conMock(ctx, dbDopo, false);
  p = await nuova(ctx);
  await p.goto(`${BASE}/?invito=${CODICE}`, { waitUntil: 'load' }); await w(p, 2200);
  const giaDentro = await p.evaluate(() => ({ hash: location.hash, modulo: !!document.getElementById('code'), resta: localStorage.getItem('fcs:invito') }));
  et(!giaDentro.modulo && !/leghe/.test(giaDentro.hash), `chi è già nella lega non trova il modulo (${giaDentro.hash})`);
  et(!giaDentro.resta, 'e l\'invito non resta appeso');
  await ctx.close();

  // ---- 5. chi ha GIA' una sua lega e viene invitato in un'altra. E' il caso
  // che la porta del router deve gestire da sola: chi non ha leghe ci finisce
  // comunque, alle leghe; chi ne ha una finirebbe sulla sua dashboard, e
  // l'invito si perderebbe li'.
  const alex = dbDopo.tables.profiles.find((x) => x.email === 'org@e.it');
  const altra = { ...dbDopo, userId: alex.id, tables: { ...dbDopo.tables,
    leagues: [...dbDopo.tables.leagues, { id: 'l_amici', name: 'Lega degli Amici', short_name: 'LDA', invite_code: 'QWE123',
      rules: {}, created_by: 'u_altro', created_at: new Date().toISOString(), started: false, pubblica: false }] } };
  ctx = await b.newContext(vp); await conMock(ctx, altra, false);
  p = await nuova(ctx);
  await p.goto(`${BASE}/?invito=QWE123`, { waitUntil: 'load' }); await w(p, 2200);
  const conLega = await p.evaluate(() => ({ hash: location.hash, codice: document.getElementById('code')?.value || '' }));
  et(/leghe/.test(conLega.hash) && conLega.codice === 'QWE123',
    `chi ha già una sua lega e viene invitato in un'altra trova il modulo compilato, non la sua dashboard (${conLega.hash}, ${conLega.codice || 'vuoto'})`);
  await ctx.close();

  // ---- e un codice storto nel link non fa niente
  ctx = await b.newContext(vp); await conMock(ctx, null, false);
  p = await nuova(ctx);
  await p.goto(`${BASE}/?invito=%3Cb%3Ex%3C%2Fb%3E`, { waitUntil: 'load' }); await w(p, 1500);
  et(!(await p.evaluate(() => localStorage.getItem('fcs:invito'))), 'un codice storto nel link non si ricorda');
  await ctx.close();

  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
  await b.close();
  for (const t of ok) console.log('  ok  ' + t);
  for (const t of ko) console.log('  KO  ' + t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
