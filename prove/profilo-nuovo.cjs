/**
 * IL PRIMO ACCESSO NON SI FERMA SUL PROFILO.
 *
 * Console, 17/10: «permission denied for table profiles» (backend.js,
 * profile ← ensureProfile ← init), da un iPhone sull'accesso e da un
 * Android sulla schermata offline. Dalla 026 il proprio profilo arriva da
 * mio_profilo(); a chi entra per la prima volta il profilo non c'e' ancora,
 * la funzione non trova niente e l'app ripiegava su select('*') dei
 * profili, che la 026 rifiuta. Chi si iscriveva restava fuori.
 * Qui l'utente c'e' ma il profilo no, e si guarda che:
 *   - l'app crei il profilo e faccia entrare;
 *   - sullo schermo e in Console non ci sia «permission denied».
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
    globalThis.__MOCK_PROFILO_ASSENTE__ = true;
  });
  const p = await ctx.newPage(); p.on('dialog', (d) => d.accept());
  const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  const w = (ms = 700) => p.waitForTimeout(ms);
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await p.fill('#email', 'nuovo@e.it'); await p.fill('#name', 'Nuovo');
  await p.fill('#password', 'password123'); await p.click('#primary'); await w(1800);
  const dopo = await p.evaluate(() => ({ hash: location.hash, testo: document.body.innerText, scritto: !!globalThis.__mockProfiloScritto,
    negati: (JSON.parse(localStorage.getItem('fcs:mock')).tables.errori_app || []).filter((e) => /permission denied/i.test(e.messaggio)).length }));
  et(dopo.scritto, 'il profilo lo crea l\'app al primo accesso');
  et(!/^#\/(offline|setup|login)/.test(dopo.hash) && !document_offline(dopo.testo), `si entra (${dopo.hash})`);
  et(!/permission denied/i.test(dopo.testo), 'nessun messaggio del database sullo schermo');
  et(dopo.negati === 0, `in Console non arriva «permission denied» (${dopo.negati})`);
  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
  await b.close();
  for (const t of ok) console.log('  ok  ' + t);
  for (const t of ko) console.log('  KO  ' + t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
function document_offline(t) { return /Riprova/.test(t) && /connessione/i.test(t); }
