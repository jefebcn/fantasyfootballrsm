/**
 * La richiesta gentile delle notifiche (Alex, 11/10: «che arrivi la
 * richiesta vuoi attivare notifiche push, senza essere invasivo»).
 *
 * Su 26 iscritti un solo telefono aveva le push: si attivavano solo dalle
 * impostazioni. Qui si prova il riquadro in dashboard: non c'e' prima della
 * prima formazione; dopo si'; «Non ora» lo toglie e resta tolto; dopo due
 * settimane torna; «Sì» chiede il permesso e lo fa sparire.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', userAgent: UA });
  await ctx.addInitScript(() => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    localStorage.setItem('fcs:auth', 'supabase');
    if (!localStorage.getItem('fcs:prefs')) localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'system' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
    // Il permesso di partenza cambia fra Chromium locale e quello di GitHub
    // (vedi iphone-notifiche.cjs): qui lo decide la prova, e anche la
    // risposta della finestra di sistema.
    const stato = { p: sessionStorage.getItem('prova:permesso') || 'default' };
    Object.defineProperty(Notification, 'permission', { get: () => stato.p, configurable: true });
    Notification.requestPermission = async () => {
      window.__chiesto = (window.__chiesto || 0) + 1;
      stato.p = sessionStorage.getItem('prova:risposta') || 'granted';
      sessionStorage.setItem('prova:permesso', stato.p);
      return stato.p;
    };
  });
  const p = await ctx.newPage(); p.on('dialog', (d) => d.accept());
  const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  const w = (ms = 450) => p.waitForTimeout(ms);
  const riquadro = () => p.evaluate(() => !!document.querySelector('.chiedi-push'));
  const casa = async () => { await p.evaluate(() => { location.hash = '#/'; }); await p.waitForSelector('.a-hero', { timeout: 8000 }); await w(300); };
  const ricarica = async () => { await p.reload({ waitUntil: 'load' }); await p.waitForSelector('.a-hero', { timeout: 8000 }); await w(300); };

  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1200);
  await p.click('[data-tab="up"]'); await w(250);
  await p.fill('#email', 'a@e.it'); await p.fill('#name', 'Alessandro'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1000);
  await p.click('[data-form="create"]'); await w(250);
  await p.fill('#lname', 'Prova'); await p.fill('#team', 'Prova FC'); await p.click('#go-create'); await w(1500);
  await casa();
  et(!(await riquadro()), 'prima della prima formazione la richiesta non c\'è');

  // una formazione consegnata, scritta nel database finto
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    const m = s.tables.league_members.find((x) => x.user_id === s.userId);
    s.tables.lineups = s.tables.lineups || [];
    s.tables.lineups.push({ league_id: m.league_id, member_id: m.id, matchday: 1, lineup: { modulo: '4-4-2', titolari: [], panchina: [] }, submitted_at: new Date().toISOString() });
    localStorage.setItem('fcs:mock', JSON.stringify(s));
  });
  await ricarica();
  et(await riquadro(), 'dopo la prima formazione compare «Vuoi un promemoria prima della scadenza?»');
  const testo = await p.evaluate(() => document.querySelector('.chiedi-push')?.innerText || '');
  et(/Sì, attiva/i.test(testo) && /Non ora/i.test(testo), 'con «Sì, attiva» e «Non ora»');
  et(await p.evaluate(() => !window.__chiesto), 'la finestra del telefono non si apre da sola');
  await p.screenshot({ path: `${process.env.USCITA || '/tmp'}/richiesta-promemoria.png` });

  await p.click('.chiedi-push [data-push="no"]'); await w(500);
  et(!(await riquadro()), '«Non ora» lo toglie');
  await ricarica();
  et(!(await riquadro()), 'e resta tolto riaprendo l\'app');
  et(await p.evaluate(() => !window.__chiesto), '«Non ora» non apre la finestra del telefono');

  // passate due settimane torna, una volta
  await p.evaluate(() => {
    const prefs = JSON.parse(localStorage.getItem('fcs:prefs'));
    prefs.pushChiesto.ultima = Date.now() - 15 * 24 * 3600 * 1000;
    localStorage.setItem('fcs:prefs', JSON.stringify(prefs));
  });
  await ricarica();
  et(await riquadro(), 'dopo due settimane torna');

  await p.click('.chiedi-push [data-push="si"]'); await w(800);
  et(await p.evaluate(() => window.__chiesto === 1), '«Sì» apre la finestra del telefono, una volta');
  et(!(await riquadro()), 'col permesso dato il riquadro sparisce');
  et(await p.evaluate(() => JSON.parse(localStorage.getItem('fcs:prefs')).avvisi === true), 'e il promemoria risulta acceso');
  await ricarica();
  et(!(await riquadro()), 'e non torna più');

  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
  await b.close();
  ok.forEach((t) => console.log('  ok  ' + t)); ko.forEach((t) => console.log('  KO  ' + t));
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
