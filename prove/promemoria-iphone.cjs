/**
 * IL PROMEMORIA SU IPHONE DAL BROWSER.
 *
 * 13/10: 2 telefoni iscritti al promemoria della formazione. Su iPhone, aperto
 * da Safari, le notifiche non esistono finche' l'app non sta sulla schermata
 * Home, e la richiesta del promemoria non compariva mai. Qui si fa un iPhone
 * (Safari, senza Notification) e si guarda che, dopo la prima formazione:
 *   - in home compaia la scheda coi passi per la schermata Home;
 *   - senza il banner «Installa» doppione sopra;
 *   - «Non ora» la faccia sparire.
 * E dentro Instagram: prima «Apri nel browser».
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);
const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const INSTAGRAM = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.0';

async function giro(b, ua, nome) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', userAgent: ua });
  await ctx.addInitScript(() => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    localStorage.setItem('fcs:auth', 'supabase');
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'light' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
    // come Safari su iPhone senza l'app sulla Home: le notifiche non ci sono
    delete window.Notification;
  });
  const p = await ctx.newPage(); p.on('dialog', (d) => d.accept()); const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  const w = (ms = 700) => p.waitForTimeout(ms);
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await p.fill('#email', `${nome}@e.it`); await p.fill('#name', 'Alex');
  await p.fill('#password', 'password123'); await p.click('#primary'); await w(1200);
  await p.click('[data-form="create"]'); await p.fill('#lname', 'Torneo'); await p.fill('#team', 'Prova FC');
  await p.click('#go-create'); await w(1400);
  await p.evaluate(() => { location.hash = '#/'; }); await w(1200);
  const prima = await p.evaluate(() => !!document.querySelector('.chiedi-push'));
  await p.evaluate(() => { location.hash = '#/lega'; }); await w(700); await p.click('#draft'); await w(2200);
  await p.evaluate(() => { location.hash = '#/rosa/formazione'; }); await w(1200);
  await p.click('#confirm'); await w(1200);
  await p.evaluate(() => { location.hash = '#/'; }); await w(1500);
  const dopo = await p.evaluate(() => ({ come: document.querySelector('.chiedi-push')?.dataset.come || null,
    testo: document.querySelector('.chiedi-push')?.innerText.replace(/\s+/g, ' ') || '',
    banner: !!document.querySelector('#install-slot .install') }));
  let sparita = null;
  await p.evaluate(() => document.querySelector('.chiedi-push')?.scrollIntoView({ block: 'center' })); await p.screenshot({ path: `${process.env.USCITA || '/tmp'}/promemoria-${nome}.png` }).catch(() => {});
  if (dopo.come) { await p.click('.chiedi-push [data-push="no"]'); await w(700); sparita = await p.evaluate(() => !document.querySelector('.chiedi-push')); }
  await ctx.close();
  return { prima, ...dopo, sparita, errori };
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const s = await giro(b, SAFARI, 'safari');
  et(!s.prima, 'iPhone: prima della prima formazione non si chiede niente');
  et(s.come === 'installa', `iPhone da Safari: dopo la formazione compare la scheda (${s.come})`);
  et(/schermata Home/.test(s.testo) && /Aggiungi alla schermata Home/.test(s.testo) && /Condividi/.test(s.testo), `con i passi: Condividi, Aggiungi alla schermata Home («${s.testo.slice(0, 90)}»)`);
  et(!s.banner, 'senza il banner «Installa» doppione');
  et(s.sparita === true, '«Non ora» la fa sparire');
  const i = await giro(b, INSTAGRAM, 'insta');
  et(i.come === 'apri-browser' && /Apri nel browser/.test(i.testo), `dentro Instagram: prima «Apri nel browser» (${i.come})`);
  const errori = [...s.errori, ...i.errori];
  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
  await b.close();
  for (const x of ok) console.log('  ok  ' + x);
  for (const x of ko) console.log('  KO  ' + x);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
