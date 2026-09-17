/**
 * Le righe delle impostazioni devono funzionare con TUTTI E TRE i temi.
 *
 * Nasce da un errore vero: applyTheme() scrive data-theme sull'<html>, e il
 * gestore cercava il tasto del tema con closest('[data-theme]'), che risaliva
 * fino alla radice e trovava sempre qualcosa. Con il tema su Chiaro o Scuro
 * ogni tocco veniva preso per un cambio di tema e nessuna riga funzionava.
 * Con "Sistema" l'attributo non c'e' e tutto sembrava a posto: per questo le
 * prove di prima, che giravano tutte su "system", non lo vedevano.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  for (const tema of ['system', 'light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    await ctx.addInitScript((tema) => {
      window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
      localStorage.setItem('fcs:auth', 'supabase');
      localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, theme: tema }));
      localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
    }, tema);
    const p = await ctx.newPage(); p.on('dialog', d => d.accept());
    const errori = []; p.on('pageerror', e => errori.push(e.message));
    await p.evaluate(() => {}).catch(() => {});
    const w = (ms = 450) => p.waitForTimeout(ms);
    await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1200);
    await p.click('[data-tab="up"]'); await w(250);
    await p.fill('#email', 'a@e.it'); await p.fill('#name', 'Alessandro'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1000);
    await p.click('[data-form="create"]'); await w(250);
    await p.fill('#lname', 'Prova'); await p.fill('#team', 'Prova FC'); await p.click('#go-create'); await w(1200);

    // 1. una riga che naviga
    await p.evaluate(() => { location.hash = '#/impostazioni'; }); await w(800);
    await p.click('[data-act="avanzate"]'); await w(800);
    const dove = await p.evaluate(() => location.hash);
    et(dove === '#/impostazioni/avanzate', `${tema}: "Impostazioni avanzate" porta dove deve (${dove})`);
    if (dove !== '#/impostazioni/avanzate') { await ctx.close(); continue; }

    // 2. una riga che cambia una preferenza
    const prima = await p.evaluate(() => JSON.parse(localStorage.getItem('fcs:prefs')).sfondoFoto);
    await p.click('[data-act="sfondo"]'); await w(700);
    const dopo = await p.evaluate(() => JSON.parse(localStorage.getItem('fcs:prefs')).sfondoFoto);
    et(prima !== dopo, `${tema}: l'interruttore della copertina cambia (${prima} -> ${dopo})`);

    // 3. una riga che apre un foglio
    await p.click('[data-act="server"]'); await w(700);
    const foglio = await p.evaluate(() => ({ on: !!document.querySelector('#sheet')?.classList.contains('on'), testo: document.querySelector('#sheet')?.innerText.slice(0, 40) || '' }));
    et(foglio.on && /Server/.test(foglio.testo), `${tema}: "Server della lega" apre il foglio (${foglio.testo.split('\n')[0]})`);
    await p.evaluate(() => { document.getElementById('sheet-scrim')?.click(); }); await w(400);

    // 4. la diagnostica dello schermo
    await p.click('[data-act="schermo"]'); await w(900);
    const mis = await p.evaluate(() => document.querySelector('#sheet')?.innerText || '');
    et(/Misure dello schermo/.test(mis), `${tema}: "Misure dello schermo" si apre`);
    await p.evaluate(() => { document.getElementById('sheet-scrim')?.click(); }); await w(400);

    // 5. e il tasto del tema continua a funzionare
    const bersaglio = tema === 'dark' ? 'light' : 'dark';
    await p.click(`button[data-theme="${bersaglio}"]`); await w(700);
    const applicato = await p.evaluate(() => ({ attr: document.documentElement.getAttribute('data-theme'), pref: JSON.parse(localStorage.getItem('fcs:prefs')).theme }));
    et(applicato.pref === bersaglio && applicato.attr === bersaglio, `${tema}: il tema si cambia ancora (${applicato.pref}/${applicato.attr})`);
    // e torna a "Sistema", che deve togliere l'attributo
    await p.click('button[data-theme="system"]'); await w(700);
    const sistema = await p.evaluate(() => document.documentElement.getAttribute('data-theme'));
    et(sistema === null, `${tema}: "Sistema" togle l'attributo dall'html (${sistema})`);

    et(errori.length === 0, errori.length ? `${tema} eccezioni: ${errori.join(' | ')}` : `${tema}: nessuna eccezione`);
    await ctx.close();
  }
  await b.close();
  console.log('PASSATI (' + ok.length + ')'); ok.forEach(s => console.log('  ok  ' + s));
  console.log(ko.length ? '\nFALLITI (' + ko.length + ')' : '\nnessun problema'); ko.forEach(s => console.log('  KO  ' + s));
  process.exit(ko.length ? 1 : 0);
})();
