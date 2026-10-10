/**
 * I RECLUTATORI: CHI PORTA UN AMICO SI VEDE.
 *
 * Alex, 10/10: serve un motivo per invitare gli amici, senza montepremi e
 * senza sfide 1 contro 1. Chi porta un amico che entra in una lega diventa
 * «Reclutatore» (migrazione 023), col badge accanto alla sua squadra.
 *
 * Il giro intero, come in invito-link.cjs:
 *   1. Alex crea la lega: in Profilo lega c'e' il riquadro del Reclutatore, e
 *      il link che manda porta ?invito=CODICE e ?da=<Alex>;
 *   2. Bea apre il link e si iscrive: la conferma e-mail torna col «da»
 *      dentro, cosi' vale anche se la apre in un altro browser;
 *   3. Bea apre la conferma altrove: l'app consegna il «da» al database, Bea
 *      entra nella lega, e solo allora Alex ha un amico;
 *   4. Alex riapre: badge accanto alla sua squadra, «Hai portato un amico»;
 *   5. il proprio link non conta;
 *   6. su un database senza la 023 non compare niente: nessuna promessa che
 *      non si possa contare.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const USCITA = process.env.USCITA || '/tmp';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

const conMock = (ctx, stato, { conferma = false, con023 = true } = {}) => ctx.addInitScript(([st, cf, c23]) => {
  window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
  if (cf) window.__MOCK_CONFIRM__ = true;
  if (c23) window.__MOCK_023__ = true;
  localStorage.setItem('fcs:auth', 'supabase');
  localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  if (!localStorage.getItem('fcs:prefs')) localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'light' }));
  if (st && !sessionStorage.getItem('seminato')) { localStorage.setItem('fcs:mock', JSON.stringify(st)); sessionStorage.setItem('seminato', '1'); }
}, [stato, conferma, con023]);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const errori = [];
  const nuova = async (ctx) => { const p = await ctx.newPage(); p.on('dialog', (d) => d.accept()); p.on('pageerror', (e) => errori.push(e.message)); return p; };
  const vp = { viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' };
  const w = (p, ms = 700) => p.waitForTimeout(ms);
  const db = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('fcs:mock')));
  const condiviso = (p, sel) => p.evaluate(async (s) => {
    let testo = null; navigator.share = async (d) => { testo = d.text; };
    document.querySelector(s)?.click(); await new Promise((r) => setTimeout(r, 300)); return testo;
  }, sel);

  // ---- 1. Alex crea la lega
  let ctx = await b.newContext(vp); await conMock(ctx, null);
  let p = await nuova(ctx);
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(p, 1300);
  await p.click('[data-tab="up"]'); await p.fill('#email', 'org@e.it'); await p.fill('#name', 'Alex');
  await p.fill('#password', 'password123'); await p.click('#primary'); await w(p, 1200);
  await p.click('[data-form="create"]'); await p.fill('#lname', 'Torneo Titano'); await p.fill('#team', 'Hasta El Roxy');
  await p.click('#go-create'); await w(p, 1500);
  await p.evaluate(() => { location.hash = '#/lega'; }); await w(p, 900);
  const card = await p.evaluate(() => document.querySelector('.recl-card')?.innerText || '');
  et(/Porta un amico/.test(card), `in Profilo lega c'è il riquadro del Reclutatore ("${card.slice(0, 50)}…")`);
  const testo = await condiviso(p, '#share-recl');
  const dbAlex = await db(p);
  const alex = dbAlex.tables.profiles.find((x) => x.email === 'org@e.it');
  const CODICE = (testo || '').match(/codice ([A-Z0-9]{6})/)?.[1];
  et(!!CODICE && (testo || '').includes(`invito=${CODICE}`), `il link porta il codice della lega (${CODICE || 'nessuno'})`);
  et((testo || '').includes(`da=${alex.id}`), `e chi lo manda (…${(testo || '').slice(-30)})`);
  const testoCodice = await condiviso(p, '#share-code');
  et((testoCodice || '').includes(`da=${alex.id}`), 'anche il tasto «Invita» accanto al codice');
  await p.evaluate(() => { location.hash = '#/'; }); await w(p, 900); await p.click('[data-open-drawer]').catch(() => {}); await w(p, 700);
  const voce = await p.evaluate(() => [...document.querySelectorAll('.d-item')].find((a) => /Invita amici/.test(a.innerText))?.innerText || '');
  et(/Invita amici/.test(voce), `nel menu c'è «Invita amici» (${voce.replace(/\s+/g, ' ') || 'non trovata'})`);
  await ctx.close();

  // ---- 2. Bea apre il link e si iscrive, con la conferma e-mail
  const link = (testo || '').match(/https?:\/\/\S+/)?.[0] || '';
  const percorso = link.replace(/^https?:\/\/[^/]+/, '');
  ctx = await b.newContext(vp); await conMock(ctx, { ...dbAlex, userId: null }, { conferma: true });
  p = await nuova(ctx);
  await p.goto(`${BASE}${percorso}`, { waitUntil: 'load' }); await w(p, 1800);
  const arrivo = await p.evaluate(() => ({ query: location.search, da: localStorage.getItem('fcs:da') }));
  et(!arrivo.query, `l'indirizzo si ripulisce anche del «da» (${arrivo.query || 'pulito'})`);
  et((arrivo.da || '').includes(alex.id), 'chi ha mandato il link si ricorda sul telefono');
  await p.click('[data-tab="up"]'); await w(p, 300);
  await p.fill('#email', 'bea@e.it'); await p.fill('#name', 'Bea'); await p.fill('#password', 'password123');
  await p.click('#primary'); await w(p, 1300);
  const ritorno = await p.evaluate(() => window.__ULTIMO_RITORNO__ || '');
  et(ritorno.includes(`da=${alex.id}`) && ritorno.includes(`invito=${CODICE}`), `la conferma e-mail torna col codice e col «da» (${ritorno.replace(/^https?:\/\/[^/]+/, '')})`);
  const dbBea = await db(p);
  await ctx.close();

  // ---- 3. la conferma si apre in un altro browser: consegna il «da», entra
  const bea = dbBea.tables.profiles.find((x) => x.email === 'bea@e.it');
  ctx = await b.newContext(vp); await conMock(ctx, { ...dbBea, userId: bea.id });
  p = await nuova(ctx);
  await p.goto(`${BASE}${ritorno.replace(/^https?:\/\/[^/]+/, '')}`, { waitUntil: 'load' }); await w(p, 2200);
  const consegna = await p.evaluate(() => ({ esito: window.__ULTIMO_INVITO__, resta: localStorage.getItem('fcs:da') }));
  et(consegna.esito === 'ok', `al primo accesso il «da» arriva al database (${consegna.esito})`);
  et(!consegna.resta, 'e sul telefono si dimentica');
  let prima = (await db(p)).tables.profiles.find((x) => x.id === alex.id).reclutati;
  et(prima === 0, `finché Bea non gioca, Alex non ha amici (${prima})`);
  await p.fill('#team', 'Borgo FC'); await p.click('#go-join'); await w(p, 1800);
  const dopo = (await db(p)).tables.profiles.find((x) => x.id === alex.id).reclutati;
  et(dopo === 1, `Bea entra nella lega: Alex ha un amico (${dopo})`);
  const dbDopo = await db(p);
  await ctx.close();

  // ---- 4. Alex riapre: badge e riquadro
  ctx = await b.newContext(vp); await conMock(ctx, { ...dbDopo, userId: alex.id });
  p = await nuova(ctx);
  await p.goto(`${BASE}/#/lega`, { waitUntil: 'load' }); await w(p, 2000);
  const vista = await p.evaluate(() => ({
    card: document.querySelector('.recl-card')?.innerText || '',
    badge: [...document.querySelectorAll('.prow')].find((r) => /Hasta El Roxy/.test(r.innerText))?.querySelector('.recl')?.innerText || '',
    badgeBea: [...document.querySelectorAll('.prow')].find((r) => /Borgo FC/.test(r.innerText))?.querySelector('.recl') ? 'sì' : 'no',
  }));
  et(/Hai portato un amico/.test(vista.card), `il riquadro dice «Hai portato un amico» ("${vista.card.replace(/\s+/g, ' ').slice(0, 70)}…")`);
  et(/Ancora 2 amici/.test(vista.card), 'e quanto manca al livello d\'argento');
  et(vista.badge.trim() === '1', `accanto a Hasta El Roxy c'è il badge (${vista.badge || 'nessuno'})`);
  et(vista.badgeBea === 'no', 'e Bea, che non ha portato nessuno, non ce l\'ha');
  await p.locator('.recl-card').scrollIntoViewIfNeeded().catch(() => {});
  await p.screenshot({ path: `${USCITA}/reclutatori.png` }).catch(() => {});
  // il contrasto del badge, in chiaro: il testo deve leggersi
  const contrasto = await p.evaluate(() => {
    const el = document.querySelector('.prow .recl'); if (!el) return 0;
    const rgb = (c) => c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
    const lum = ([r, g, bb]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bb); };
    const cs = getComputedStyle(el); const a = lum(rgb(cs.color)), c = lum(rgb(cs.backgroundColor));
    return (Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05);
  });
  et(contrasto >= 4.5, `il badge si legge (contrasto ${contrasto.toFixed(1)}:1)`);

  // ---- 5. il proprio link non conta
  await p.goto(`${BASE}/?invito=${CODICE}&da=${alex.id}`, { waitUntil: 'load' }); await w(p, 2000);
  const proprio = await p.evaluate(() => ({ esito: window.__ULTIMO_INVITO__, n: JSON.parse(localStorage.getItem('fcs:mock')).tables.profiles.find((x) => x.email === 'org@e.it').reclutati }));
  et(proprio.esito === 'se-stesso' && proprio.n === 1, `il proprio link non conta (${proprio.esito}, ${proprio.n})`);
  await ctx.close();

  // ---- 6. database senza la 023: niente riquadro, niente badge, niente voce
  ctx = await b.newContext(vp); await conMock(ctx, null, { con023: false });
  p = await nuova(ctx);
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(p, 1300);
  await p.click('[data-tab="up"]'); await p.fill('#email', 'x@e.it'); await p.fill('#name', 'Xeno');
  await p.fill('#password', 'password123'); await p.click('#primary'); await w(p, 1200);
  await p.click('[data-form="create"]'); await p.fill('#lname', 'Senza 023'); await p.fill('#team', 'Vecchio FC');
  await p.click('#go-create'); await w(p, 1500);
  await p.evaluate(() => { location.hash = '#/lega'; }); await w(p, 900);
  const senza = await p.evaluate(() => ({ card: !!document.querySelector('.recl-card'), badge: !!document.querySelector('.recl') }));
  et(!senza.card && !senza.badge, 'senza la 023 nel database non si promette niente');
  const testoSenza = await condiviso(p, '#share-code');
  et(/invito=[A-Z0-9]{6}/.test(testoSenza || ''), 'e il tasto «Invita» funziona come prima');
  await ctx.close();

  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
  await b.close();
  for (const t of ok) console.log('  ok  ' + t);
  for (const t of ko) console.log('  KO  ' + t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
