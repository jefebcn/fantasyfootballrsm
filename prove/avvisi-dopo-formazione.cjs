/**
 * LE NOTIFICHE SI CHIEDONO SUBITO DOPO LA FORMAZIONE (Alex, 04/11).
 *
 * Le avevano 18 persone su 211: il riquadro stava solo in Home, e chi
 * consegna spesso chiude l'app dalla formazione. Qui: salvata la formazione
 * sale la scheda «Vuoi le notifiche di Fantatitano?», la finestra del
 * telefono si apre solo dal «Sì», «Non ora» la chiude e al salvataggio dopo
 * non torna; con il permesso gia' dato non compare.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

async function prova(b, { email, risposta, primaNo }) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36' });
  await ctx.addInitScript((risp) => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    localStorage.setItem('fcs:auth', 'supabase');
    if (!localStorage.getItem('fcs:prefs')) localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'dark' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
    // il permesso lo decide la prova (Chromium locale e quello di GitHub partono diversi)
    const stato = { p: sessionStorage.getItem('prova:permesso') || 'default' };
    Object.defineProperty(Notification, 'permission', { get: () => stato.p, configurable: true });
    Notification.requestPermission = async () => {
      window.__chiesto = (window.__chiesto || 0) + 1;
      stato.p = risp; sessionStorage.setItem('prova:permesso', stato.p); return stato.p;
    };
  }, risposta);
  const p = await ctx.newPage(); p.on('dialog', (d) => d.accept()); const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  const w = (ms = 700) => p.waitForTimeout(ms);
  const scheda = () => p.evaluate(() => { const s = document.querySelector('#sheet .dopo-salvataggio'); return s ? s.innerText : ''; });
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await p.fill('#email', email); await p.fill('#name', 'Alex');
  await p.fill('#password', 'password123'); await p.click('#primary'); await w(1200);
  await p.click('[data-form="create"]'); await p.fill('#lname', 'Torneo'); await p.fill('#team', 'Prova FC');
  await p.click('#go-create'); await w(1400);
  await p.evaluate(() => { location.hash = '#/lega'; }); await w(700); await p.click('#draft'); await w(2200);
  await p.evaluate(() => { location.hash = '#/rosa/formazione'; }); await w(1200);
  et(!(await scheda()), `${email}: prima di salvare non si chiede niente`);
  await p.click('#confirm'); await w(1200);
  return { p, w, scheda, errori, chiusura: () => ctx.close(), primaNo };
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());

  // 1. «Sì»: la finestra del telefono una volta, la scheda si chiude, non torna
  {
    const { p, w, scheda, errori, chiusura } = await prova(b, { email: 'si@e.it', risposta: 'granted' });
    const testo = await scheda();
    et(/Vuoi le notifiche di Fantatitano\?/.test(testo), 'salvata la formazione sale la richiesta delle notifiche');
    et(/segnano/.test(testo) && /lunedì/.test(testo) && /formazione/.test(testo), 'e dice cosa arriva: gol, punti del lunedì, scadenza');
    et(await p.evaluate(() => !window.__chiesto), 'la finestra del telefono non si apre da sola');
    await p.screenshot({ path: `${process.env.USCITA || '/tmp'}/avvisi-dopo-formazione.png` });
    await p.click('#sheet [data-push="si"]'); await w(1200);
    et(await p.evaluate(() => window.__chiesto === 1), '«Sì» apre la finestra del telefono, una volta');
    et(!(await scheda()), 'e la scheda si chiude');
    await p.click('[data-down="0"]'); await w(600); await p.click('#confirm'); await w(1200);
    et(!(await scheda()), 'col permesso dato, al salvataggio dopo non si chiede più');
    et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
    await chiusura();
  }
  // 2. «Non ora»: si chiude, la finestra non si apre, al salvataggio dopo non torna
  {
    const { p, w, scheda, errori, chiusura } = await prova(b, { email: 'no@e.it', risposta: 'granted' });
    et(!!(await scheda()), 'anche per un altro iscritto la richiesta sale');
    await p.click('#sheet [data-push="no"]'); await w(800);
    et(!(await scheda()), '«Non ora» la chiude');
    et(await p.evaluate(() => !window.__chiesto), 'e non apre la finestra del telefono');
    await p.click('[data-down="0"]'); await w(600); await p.click('#confirm'); await w(1200);
    et(!(await scheda()), 'al salvataggio dopo non torna (due settimane di pausa)');
    et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
    await chiusura();
  }
  await b.close();
  for (const t of ok) console.log('  ok ', t);
  for (const t of ko) console.log('  KO ', t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
