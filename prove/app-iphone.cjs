/**
 * L'app dell'App Store, senza un iPhone.
 *
 * Dentro l'app (cartella ios/, Capacitor) la pagina e' fantatitano.site e i
 * plugin nativi si raggiungono da un "ponte": window.Capacitor con l'elenco
 * dei plugin (PluginHeaders) e due funzioni, nativePromise e nativeCallback,
 * che parlano con Swift. Qui il ponte lo finge la prova, con le stesse forme
 * di quello vero, e risponde come risponderebbe iOS.
 *
 * Cosa si verifica:
 *  - l'app si riconosce come app (niente banner "Installa", niente "Aggiungi
 *    alla schermata Home");
 *  - Consenti le notifiche -> permesso chiesto a iOS -> registrazione -> il
 *    codice del telefono finisce in push_subscriptions come "apns:<codice>";
 *  - toccare una notifica porta alla formazione;
 *  - Condividi passa dal foglio nativo;
 *  - nessun errore in pagina. Un errore vero trovato cosi': una promessa che
 *    si risolveva col plugin chiamava un metodo nativo "then" inesistente.
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
    // il ponte finto: iOS si riconosce da webkit.messageHandlers.bridge
    const chiamate = (window.__nativo = []); const ascolti = (window.__ascolti = {});
    const m = (...nomi) => nomi.map((name) => ({ name, rtype: name === 'addListener' ? 'callback' : 'promise' }));
    window.webkit = { messageHandlers: { bridge: { postMessage() {} } } };
    window.Capacitor = {
      // queste due le mette il ponte vero (native-bridge.js) prima che parta la pagina
      isNativePlatform: () => true, getPlatform: () => 'ios',
      PluginHeaders: [
        { name: 'PushNotifications', methods: m('checkPermissions', 'requestPermissions', 'register', 'unregister', 'addListener', 'removeListener') },
        { name: 'Share', methods: m('share') },
        { name: 'App', methods: m('getLaunchUrl', 'addListener', 'removeListener') },
      ],
      nativePromise(plugin, metodo, opz) {
        chiamate.push(`${plugin}.${metodo}`);
        if (metodo === 'checkPermissions') return Promise.resolve({ receive: 'prompt' });
        if (metodo === 'requestPermissions') return Promise.resolve({ receive: 'granted' });
        if (metodo === 'register') {
          setTimeout(() => (ascolti['PushNotifications.registration'] || []).forEach((cb) => cb({ value: 'f0ca1e5babe' })), 50);
          return Promise.resolve();
        }
        if (metodo === 'getLaunchUrl') return Promise.resolve({});
        if (metodo === 'share') { window.__condiviso = opz; return Promise.resolve({}); }
        return Promise.resolve({});
      },
      nativeCallback(plugin, metodo, opz, cb) {
        (ascolti[`${plugin}.${opz.eventName}`] ||= []).push(cb);
        return Promise.resolve(String(Math.random()));
      },
    };
  });
  const p = await ctx.newPage(); p.on('dialog', (d) => d.accept());
  const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  const w = (ms = 450) => p.waitForTimeout(ms);
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1200);

  const stato = () => p.evaluate(async () => { const AV = await import('/src/notifiche.js'); return { nativa: AV.nativa(), installata: AV.installata(), permesso: AV.permesso() }; });
  const s0 = await stato();
  et(s0.nativa && s0.installata, `l'app si riconosce come app (${JSON.stringify(s0)})`);

  await p.click('[data-tab="up"]'); await w(250);
  await p.fill('#email', 'iphone@e.it'); await p.fill('#name', 'Alessandro'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1000);
  await p.click('[data-form="create"]'); await w(250);
  await p.fill('#lname', 'Prova'); await p.fill('#team', 'Prova FC'); await p.click('#go-create'); await w(1500);
  await p.evaluate(() => { location.hash = '#/'; }); await w(900);
  const testoHome = await p.evaluate(() => document.body.innerText);
  et(!/Installa l'app|Aggiungi alla (schermata )?Home/i.test(testoHome), 'nessun invito a installare: e\' gia\' un\'app');

  // Impostazioni -> Preferenze notifiche -> Consenti
  await p.evaluate(() => { location.hash = '#/impostazioni'; }); await w(800);
  await p.click('[data-sheet="avvisi"], [data-act="avvisi"], button:has-text("Preferenze notifiche")').catch(() => {});
  await w(500);
  const consenti = await p.$('[data-avvisi="permesso"]');
  et(!!consenti, 'nel foglio c\'e\' «Consenti le notifiche»');
  if (consenti) { await consenti.click(); await w(1200); }
  const chiamate = await p.evaluate(() => window.__nativo);
  et(chiamate.includes('PushNotifications.requestPermissions'), 'il permesso lo chiede iOS');
  et(chiamate.includes('PushNotifications.register'), 'poi il telefono si registra presso Apple');
  const righe = await p.evaluate(() => (JSON.parse(localStorage.getItem('fcs:mock') || '{}').tables?.push_subscriptions || []));
  et(righe.some((r) => r.endpoint === 'apns:f0ca1e5babe'), `il codice del telefono e' salvato come apns:… (${righe.map((r) => r.endpoint).join(', ') || 'nessuna riga'})`);
  const foglio = await p.evaluate(() => document.body.innerText);
  et(!/Mandami un avviso di prova/.test(foglio), 'niente «avviso di prova» locale: nell\'app le notifiche arrivano da Apple');

  // tocco su una notifica -> formazione
  await p.evaluate(() => (window.__ascolti['PushNotifications.pushNotificationActionPerformed'] || []).forEach((cb) => cb({ notification: { data: { url: './#/rosa/formazione' } } })));
  await w(600);
  et(await p.evaluate(() => location.hash === '#/rosa/formazione'), 'toccare la notifica apre la formazione');

  // condividere passa dal foglio nativo
  await p.evaluate(() => navigator.share({ title: 'Fantatitano', text: 'prova' })); await w(200);
  et(await p.evaluate(() => window.__condiviso?.text === 'prova'), 'Condividi usa il foglio nativo di iOS');

  et(!errori.length, `nessun errore in pagina${errori.length ? ': ' + errori.join(' | ') : ''}`);
  await b.close();
  ok.forEach((t) => console.log('  ok ', t)); ko.forEach((t) => console.log('  KO ', t));
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
