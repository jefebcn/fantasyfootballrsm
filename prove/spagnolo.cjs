/**
 * L'APP IN SPAGNOLO (Alex, 04/11: tappe 1 e 2).
 *
 * Un telefono in spagnolo (locale es-ES) apre l'app: deve parlare spagnolo da
 * solo. Si gira come un iscritto nuovo — registrazione, lega, rosa — e si
 * aprono le schermate di gioco. Per ognuna due controlli:
 *  1. nessuna frase passata a t() senza traduzione (window.__mancanti);
 *  2. nel testo visibile nessuna parola italiana fra quelle che non possono
 *     comparire in una schermata spagnola (PAROLE, sotto). I nomi propri —
 *     squadre, giocatori, «Fantatitano» — non sono in lista.
 * In fondo: da Impostazioni si torna all'italiano, e l'italiano e' intatto.
 *
 *   SOLO=home,rosa node prove/spagnolo.cjs   -> solo quelle schermate
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const SOLO = (process.env.SOLO || '').split(',').filter(Boolean);
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

// Parole che in una schermata spagnola sono sicuramente italiano rimasto.
// Intere (\b), con la maiuscola o no. Scelte fra quelle che le schermate di
// gioco usano davvero e che in spagnolo si scrivono diverse.
const PAROLE = ['giornata', 'giornate', 'formazione', 'classifica', 'calendario', 'squadra', 'squadre', 'panchina',
  'capitano', 'portiere', 'portieri', 'difensori', 'centrocampisti', 'attaccanti', 'consegna', 'consegnata', 'accedi',
  'registrati', 'giocatori', 'giocatore', 'partita', 'partite', 'della', 'degli', 'delle', 'anche', 'salva', 'conferma',
  'nessuna', 'nessun', 'tocca', 'crediti', 'lega', 'leghe', 'voti', 'impostazioni', 'oggi', 'domani', 'ieri', 'ancora',
  'prossima', 'ultima', 'chiusa', 'aperta', 'mercato', 'negozio', 'quotazione', 'schiera', 'gol subiti', 'ammonizione',
  'espulsione', 'assist vincente', 'rigore', 'punti', 'vittoria', 'pareggio', 'sconfitta', 'iscriviti', 'password dimenticata'];

const SCHERMATE = [
  ['home', '#/'], ['rosa', '#/rosa'], ['formazione', '#/rosa/formazione'], ['voti', '#/voti'],
  ['classifica', '#/classifica'], ['calendario', '#/calendario'], ['live', '#/live'], ['negozio', '#/negozio'],
];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', locale: 'es-ES' });
  await ctx.addInitScript(() => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    localStorage.setItem('fcs:auth', 'supabase');
    if (!localStorage.getItem('fcs:prefs')) localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'dark' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  const p = await ctx.newPage(); p.on('dialog', (d) => d.accept());
  const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  const w = (ms = 700) => p.waitForTimeout(ms);
  const italiano = async (dove) => p.evaluate(({ parole, dove }) => {
    // il testo visibile della pagina, senza le notizie (sono della FSGC, in italiano)
    const root = document.querySelector(dove) || document.body;
    const copia = root.cloneNode(true);
    // fuori: le notizie (della FSGC, in italiano), il menu laterale chiuso e
    // la scheda dal basso chiusa (ci sono nella pagina ma non si vedono)
    copia.querySelectorAll('.notizie, .notizia, [data-it-ok], script, style, .a-drawer:not(.on), #sheet:not(.on), #sheet-scrim').forEach((x) => x.remove());
    const testo = ' ' + (copia.innerText || copia.textContent || '').replace(/\s+/g, ' ') + ' ';
    const trovate = [];
    for (const w of parole) {
      const re = new RegExp(`(^|[^\\p{L}])${w}([^\\p{L}]|$)`, 'iu');
      const m = testo.match(re);
      if (m) { const i = testo.search(re); trovate.push(`«${w}» in «…${testo.slice(Math.max(0, i - 30), i + w.length + 30).trim()}…»`); }
    }
    return trovate;
  }, { parole: PAROLE, dove });
  const mancanti = () => p.evaluate(() => { const m = window.__mancanti || []; window.__mancanti = []; return m; });
  const controlla = async (nome) => {
    const m = await mancanti();
    const it = await italiano('body');
    et(!m.length, `${nome}: tutte le frasi di t() tradotte${m.length ? ` — mancano: ${m.slice(0, 6).map((x) => `«${x.slice(0, 60)}»`).join(', ')}${m.length > 6 ? ` e altre ${m.length - 6}` : ''}` : ''}`);
    et(!it.length, `${nome}: niente italiano a vista${it.length ? ` — ${it.slice(0, 5).join(' · ')}${it.length > 5 ? ` e altre ${it.length - 5}` : ''}` : ''}`);
  };

  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  et(await p.evaluate(() => document.documentElement.lang) === 'es', 'un telefono in spagnolo apre l\'app in spagnolo (html lang=es)');
  if (!SOLO.length || SOLO.includes('accesso')) await controlla('accesso (prima del login)');

  await p.click('[data-tab="up"]'); await w(250);
  if (!SOLO.length || SOLO.includes('accesso')) await controlla('registrazione');
  await p.fill('#email', 'es@e.it'); await p.fill('#name', 'Martín'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1200);
  if (!SOLO.length || SOLO.includes('accesso')) await controlla('dopo la registrazione (scegli lega)');
  await p.click('[data-form="create"]'); await w(250);
  await p.fill('#lname', 'Liga Penne'); await p.fill('#team', 'Los Pennes'); await p.click('#go-create'); await w(1400);
  await p.evaluate(() => { location.hash = '#/lega'; }); await w(700); await p.click('#draft').catch(() => {}); await w(2200);

  for (const [nome, hash] of SCHERMATE) {
    if (SOLO.length && !SOLO.includes(nome)) continue;
    await p.evaluate((h) => { location.hash = h; }, hash); await w(1100);
    await p.screenshot({ path: `${process.env.USCITA || '/tmp'}/spagnolo-${nome}.png` });
    await controlla(nome);
  }
  // il menu laterale
  if (!SOLO.length || SOLO.includes('menu')) {
    await p.evaluate(() => { location.hash = '#/'; }); await w(800);
    await p.click('[data-open-drawer]').catch(() => {}); await w(500);
    await controlla('menu');
    await p.click('[data-close-drawer]').catch(() => {}); await w(300);
  }

  // da Impostazioni si torna all'italiano, e l'italiano e' quello di sempre
  await p.evaluate(() => { location.hash = '#/impostazioni'; }); await w(900);
  await p.click('[data-act="lingua"]').catch(() => {}); await w(400);
  await Promise.all([p.waitForNavigation({ waitUntil: 'load' }).catch(() => {}), p.click('[data-lingua="it"]').catch(() => {})]);
  await w(1400);
  et(await p.evaluate(() => document.documentElement.lang) === 'it', 'da Impostazioni si torna all\'italiano');
  et(await p.evaluate(() => /Classifica/.test(document.querySelector('.a-nav')?.innerText || '')), 'e la barra in basso torna «Classifica»');
  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
  await b.close();
  for (const t of ok) console.log('  ok ', t);
  for (const t of ko) console.log('  KO ', t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
