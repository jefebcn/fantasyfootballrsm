/**
 * Un iPhone dentro Safari: le notifiche non esistono finche' l'app non e'
 * sulla schermata Home, e l'app lo deve DIRE.
 *
 * Nasce da un tentativo vero, il 17 settembre: "non trovo l'impostazione per
 * attivare le notifiche". La voce c'era. Ma su iPhone nel browser
 * `Notification` non e' definito, quindi il foglio mostrava l'interruttore
 * senza il bottone del permesso e senza una parola sul perche'; e il banner
 * "Installa l'app" aspettava beforeinstallprompt, che iOS non manda mai.
 *
 * Chromium non e' Safari, ma il comportamento da riprodurre e' esattamente
 * "Notification assente + user agent iPhone + non installata", e questo si
 * puo' fare. La seconda meta' prova il contrario: installata, Notification
 * presente, e allora il bottone c'e' e la spiegazione no.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  for (const installata of [false, true]) {
    const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', userAgent: UA });
    await ctx.addInitScript((installata) => {
      window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
      localStorage.setItem('fcs:auth', 'supabase');
      localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, theme: 'system' }));
      localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
      Object.defineProperty(navigator, 'maxTouchPoints', { value: 5 });
      if (installata) {
        Object.defineProperty(navigator, 'standalone', { value: true });
      } else {
        // Dentro Safari su iPhone Notification non c'e' proprio.
        delete window.Notification;
        if (typeof window.Notification !== 'undefined') Object.defineProperty(window, 'Notification', { value: undefined, configurable: true });
      }
    }, installata);
    const p = await ctx.newPage(); p.on('dialog', d => d.accept());
    const errori = []; p.on('pageerror', e => errori.push(e.message));
    const w = (ms = 450) => p.waitForTimeout(ms);
    await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1200);
    const dove = installata ? 'installata' : 'in Safari';
    const senzaNotif = await p.evaluate(() => typeof Notification === 'undefined');
    et(senzaNotif === !installata, `${dove}: la simulazione regge (Notification ${senzaNotif ? 'assente' : 'presente'})`);

    await p.click('[data-tab="up"]'); await w(250);
    await p.fill('#email', 'a@e.it'); await p.fill('#name', 'Alessandro'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1000);
    await p.click('[data-form="create"]'); await w(250);
    await p.fill('#lname', 'Prova'); await p.fill('#team', 'Prova FC'); await p.click('#go-create'); await w(1500);

    // il banner in dashboard — dopo la creazione della lega si atterra su
    // #/lega, quindi ci si va apposta: il banner vive solo li'.
    await p.evaluate(() => { location.hash = '#/'; }); await w(900);
    const banner = await p.evaluate(() => document.querySelector('#install-slot')?.innerText || '');
    if (installata) et(banner === '', `${dove}: nessun banner "Installa" in dashboard`);
    else et(/Aggiungi alla schermata Home/.test(banner) && !/Installa\s*$/.test(banner), `${dove}: la dashboard spiega come installare (${banner.split('\n')[0]})`);

    // il foglio delle notifiche
    await p.evaluate(() => { location.hash = '#/impostazioni'; }); await w(800);
    const sotto = await p.evaluate(() => document.querySelector('[data-act="avvisi"] .txt span')?.innerText || '');
    await p.click('[data-act="avvisi"]'); await w(800);
    const foglio = await p.evaluate(() => document.querySelector('#sheet')?.innerText || '');
    const bottone = await p.evaluate(() => !!document.querySelector('#sheet [data-avvisi="permesso"]'));
    if (installata) {
      et(bottone, `${dove}: c'e' il bottone "Consenti le notifiche"`);
      et(!/schermata Home/.test(foglio), `${dove}: nessuna spiegazione sull'installazione`);
      et(sotto === 'Da attivare', `${dove}: sottotitolo "${sotto}"`);
    } else {
      et(!bottone, `${dove}: nessun bottone del permesso, perche' non puo' funzionare`);
      et(/Aggiungi alla schermata Home/.test(foglio), `${dove}: il foglio spiega che va installata`);
      et(/schermata Home/.test(sotto), `${dove}: il sottotitolo lo dice gia' dalla lista ("${sotto}")`);
    }
    et(errori.length === 0, `${dove}: nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
    await ctx.close();
  }
  await b.close();
  for (const t of ok) console.log('  ok  ' + t);
  for (const t of ko) console.log('  KO  ' + t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
