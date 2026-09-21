/**
 * Lo spazio dello sponsor: si vende, e si amministra senza rilasci.
 *
 * Perché esiste: il banner del montepremi è scritto nel codice, e finché
 * anche lo sponsor stava lì, cambiarlo voleva dire un rilascio — cioè
 * dipendere da chi sa rilasciare, e non poter promettere "dal primo del
 * mese" a chi paga.
 *
 * Qui si guarda la cosa che rende vendibile quello spazio: che compaia da
 * solo il giorno giusto, che sparisca da solo il giorno dopo la scadenza, che
 * chi amministra lo possa mettere dalla console, e che sia DICHIARATO — la
 * targhetta "Sponsor" e il rel="sponsored" sul collegamento. Uno spazio
 * comprato travestito da contenuto dell'app inganna chi legge, e il giorno
 * che ci si accorge costa più di quanto abbia reso.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

const giorno = (scarto) => { const d = new Date(); d.setDate(d.getDate() + scarto); return d.toISOString().slice(0, 10); };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    localStorage.setItem('fcs:auth', 'supabase');
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, theme: 'system' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  const p = await ctx.newPage(); p.on('dialog', (d) => d.accept());
  const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  const w = (ms = 450) => p.waitForTimeout(ms);
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await w(250);
  await p.fill('#email', 'a@e.it'); await p.fill('#name', 'Conti25'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1000);
  await p.click('[data-form="create"]'); await w(250);
  await p.fill('#lname', 'Torneo Titano'); await p.fill('#team', 'Hasta El Roxy'); await p.click('#go-create'); await w(1400);

  // Senza sponsor la dashboard non ha nessuno spazio vuoto che lo aspetta.
  await p.evaluate(() => { location.hash = '#/'; }); await w(900);
  et(!(await p.$('.spon')), 'senza sponsor non c\'è nessuna fascia');

  // La console: il primo iscritto del mock non amministra, glielo diamo.
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    s.tables.profiles.find((x) => x.id === s.userId).is_admin = true;
    localStorage.setItem('fcs:mock', JSON.stringify(s));
    location.hash = '#/admin/console';
  });
  await p.reload({ waitUntil: 'load' }); await w(2000);
  await p.evaluate(() => { const t = [...document.querySelectorAll('[data-atab]')].find((x) => x.dataset.atab === 'sponsor'); if (t) t.click(); }); await w(600);
  et(!!(await p.$('#sp-salva')), 'la console ha la scheda Sponsor col modulo');

  // Se ne carica uno che comincia DOMANI: non deve vedersi oggi.
  await p.fill('#sp-nome', 'Bar Titano'); await p.fill('#sp-claim', 'Dal 1972 a Borgo Maggiore');
  await p.fill('#sp-link', 'https://esempio.sm'); await p.fill('#sp-dal', giorno(1));
  await p.click('#sp-salva'); await w(1200);
  await p.evaluate(() => { location.hash = '#/'; }); await w(900);
  et(!(await p.$('.spon')), 'uno sponsor che comincia domani non si vede oggi');

  // Lo si sposta a oggi: adesso deve comparire.
  await p.evaluate(() => { location.hash = '#/admin/console'; }); await w(900);
  await p.evaluate(() => { const t = [...document.querySelectorAll('[data-atab]')].find((x) => x.dataset.atab === 'sponsor'); if (t) t.click(); }); await w(500);
  await p.evaluate(() => document.querySelector('[data-sp-mod]')?.click()); await w(500);
  await p.fill('#sp-dal', giorno(0)); await p.click('#sp-salva'); await w(1200);
  await p.evaluate(() => { location.hash = '#/'; }); await w(900);

  const vetrina = await p.evaluate(() => {
    const a = document.querySelector('.spon'); if (!a) return null;
    return { tag: a.querySelector('.spon-tag')?.innerText || '', nome: a.querySelector('.spon-txt b')?.innerText || '',
      claim: a.querySelector('.spon-txt span')?.innerText || '', href: a.getAttribute('href') || '',
      rel: a.getAttribute('rel') || '', target: a.getAttribute('target') || '', id: a.dataset.sponsor || '' };
  });
  et(!!vetrina, 'spostato a oggi, lo sponsor compare');
  if (vetrina) {
    et(/Bar Titano/.test(vetrina.nome), `col suo nome ("${vetrina.nome}")`);
    et(/1972/.test(vetrina.claim), 'e la riga che si è comprato');
    et(/sponsor/i.test(vetrina.tag), `dichiarato con la targhetta ("${vetrina.tag}")`);
    et(/sponsored/.test(vetrina.rel) && /noopener/.test(vetrina.rel), `il collegamento è marcato come sponsorizzato (rel="${vetrina.rel}")`);
    et(vetrina.href === 'https://esempio.sm', `e porta dove deve ("${vetrina.href}")`);
    et(!!vetrina.id, 'con il suo identificativo addosso, per poterlo contare domani');
    await p.screenshot({ path: `${process.env.USCITA || '/tmp'}/sponsor.png` }).catch(() => {});
  }

  // UN INDIRIZZO PERICOLOSO NON DIVENTA UN COLLEGAMENTO. Lo scrive chi
  // amministra, ma "lo scrive uno di cui mi fido" non è un controllo: un
  // javascript: in quel campo girerebbe nel telefono di chiunque apra l'app.
  await p.evaluate(() => { location.hash = '#/admin/console'; }); await w(900);
  await p.evaluate(() => { const t = [...document.querySelectorAll('[data-atab]')].find((x) => x.dataset.atab === 'sponsor'); if (t) t.click(); }); await w(500);
  await p.evaluate(() => document.querySelector('[data-sp-mod]')?.click()); await w(500);
  await p.fill('#sp-link', 'javascript:alert(1)'); await p.click('#sp-salva'); await w(1200);
  await p.evaluate(() => { location.hash = '#/'; }); await w(900);
  const velenoso = await p.evaluate(() => {
    const e = document.querySelector('.spon');
    return { tag: e ? e.tagName : '', href: e ? e.getAttribute('href') : null, testo: e ? e.innerText.replace(/\n/g, ' ') : '' };
  });
  et(velenoso.tag === 'DIV' && velenoso.href === null,
    `un indirizzo javascript: non diventa un collegamento (${velenoso.tag}${velenoso.href ? ` href=${velenoso.href}` : ''})`);
  et(/Bar Titano/.test(velenoso.testo), 'ma lo sponsor resta in vetrina: si perde il tocco, non lo spazio venduto');

  // Scaduto ieri: sparisce da solo, senza che nessuno se ne ricordi.
  await p.evaluate(() => { location.hash = '#/admin/console'; }); await w(900);
  await p.evaluate(() => { const t = [...document.querySelectorAll('[data-atab]')].find((x) => x.dataset.atab === 'sponsor'); if (t) t.click(); }); await w(500);
  await p.evaluate(() => document.querySelector('[data-sp-mod]')?.click()); await w(500);
  // Prima una data impossibile: la fine prima dell'inizio non si salva.
  await p.fill('#sp-al', giorno(-1)); await p.click('#sp-salva'); await w(900);
  const malmesso = await p.evaluate(() => JSON.parse(localStorage.getItem('fcs:mock')).tables.sponsor[0].al);
  et(malmesso === null, `una fine prima dell'inizio non viene salvata (al: ${malmesso})`);
  // Poi uno scaduto per davvero: cominciato dieci giorni fa, finito ieri.
  await p.fill('#sp-dal', giorno(-10)); await p.fill('#sp-al', giorno(-1)); await p.click('#sp-salva'); await w(1200);
  await p.evaluate(() => { location.hash = '#/'; }); await w(900);
  et(!(await p.$('.spon')), 'scaduto ieri, sparisce da solo');

  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
  await b.close();
  for (const t of ok) console.log('  ok  ' + t);
  for (const t of ko) console.log('  KO  ' + t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
