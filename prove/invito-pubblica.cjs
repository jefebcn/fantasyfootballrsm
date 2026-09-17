/**
 * Nelle leghe private, l'invito alla lega pubblica.
 *
 * Sta fra le notizie e la giornata corrente: sopra il contesto del
 * campionato, sotto quello che devi fare adesso, in mezzo una cosa che puoi
 * fare in piu'. E mostra il premio VERO scritto da chi ha aperto la lega
 * pubblica: un banner che promette una cifra decisa altrove sarebbe una cosa
 * che l'app non puo' mantenere.
 *
 * Si prova anche che NON compare dove non deve: dentro la lega pubblica
 * stessa, e quando non ce n'e' nessuna aperta.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

const prepara = (ctx, stato) => ctx.addInitScript((stato) => {
  window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
  localStorage.setItem('fcs:auth', 'supabase');
  localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, theme: 'dark' }));
  localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  // UNA VOLTA SOLA. addInitScript rigira a ogni caricamento della pagina:
  // senza il segno, il reload rimetteva userId a null e buttava fuori
  // l'utente appena entrato — e la prova finiva sulla schermata d'accesso
  // senza dire perche'.
  if (stato && !localStorage.getItem('fcs:seminato')) {
    const s = JSON.parse(stato); s.userId = null;
    localStorage.setItem('fcs:mock', JSON.stringify(s));
    localStorage.setItem('fcs:seminato', '1');
  }
}, stato);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const w = (p, ms = 450) => p.waitForTimeout(ms);
  const errori = [];

  // ---- primo: crea una lega pubblica col premio da 300 euro
  let ctx = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await prepara(ctx, null);
  let p = await ctx.newPage(); p.on('dialog', d => d.accept()); p.on('pageerror', e => errori.push('1: ' + e.message));
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(p, 1300);
  await p.click('[data-tab="up"]'); await w(p, 250);
  await p.fill('#email', 'uno@e.it'); await p.fill('#name', 'Uno'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(p, 1000);
  await p.click('[data-form="pubblica"]'); await w(p, 500);
  // il colore non si chiede piu': se ricompare, questa prova lo vede
  const chiedeColore = await p.evaluate(() => !!document.querySelector('[data-color]'));
  et(!chiedeColore, 'la creazione non chiede piu\' di scegliere un colore');
  await p.fill('#pname', 'Titano Open'); await p.fill('#pbudget', '500'); await p.fill('#pmax', '200');
  await p.fill('#ppremio', '300 €'); await p.fill('#team', 'Squadra Uno');
  await p.click('#go-pubblica'); await w(p, 1700);
  const colore = await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    return s.tables.league_members[0].color;
  });
  et(/^#[0-9a-f]{6}$/i.test(colore || ''), `e assegna un colore da sé (${colore})`);
  // dentro la lega pubblica l'invito NON deve comparire
  await p.evaluate(() => { location.hash = '#/'; }); await w(p, 1500);
  et(!(await p.evaluate(() => !!document.querySelector('.invito'))), 'dentro la lega pubblica l\'invito non compare');
  const stato = await p.evaluate(() => localStorage.getItem('fcs:mock'));
  await ctx.close();

  // ---- secondo: sta in una lega privata e deve vedere l'invito
  ctx = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await prepara(ctx, stato);
  p = await ctx.newPage(); p.on('dialog', d => d.accept()); p.on('pageerror', e => errori.push('2: ' + e.message));
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(p, 1300);
  await p.click('[data-tab="up"]'); await w(p, 250);
  await p.fill('#email', 'due@e.it'); await p.fill('#name', 'Due'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(p, 1200);
  await p.click('[data-form="create"]'); await w(p, 300);
  await p.fill('#lname', 'Fra amici'); await p.fill('#team', 'Hasta El Roxy'); await p.click('#go-create'); await w(p, 1600);
  // Un avversario nella lega privata: con una squadra sola la card "Giornata
  // corrente" non si disegna, e non ci sarebbe niente sopra cui stare.
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    const mia = s.tables.league_members.find((m) => m.user_id === s.userId);
    s.tables.profiles.push({ id: 'u_riv', display_name: 'Wesly', is_judge: false });
    s.tables.league_members.push({ ...mia, id: 'm_riv', user_id: 'u_riv', role: 'fantallenatore', team_name: 'Fuego Roxy', initials: 'FR' });
    localStorage.setItem('fcs:mock', JSON.stringify(s));
  });
  await p.evaluate(() => { location.hash = '#/'; });
  await p.reload({ waitUntil: 'load' }); await w(p, 2200);

  const inv = await p.evaluate(() => {
    const a = document.querySelector('.invito');
    if (!a) return null;
    const r = a.getBoundingClientRect();
    const sez = [...document.querySelectorAll('.a-sec')].find((x) => /Giornata corrente/i.test(x.innerText));
    const notizia = document.querySelector('.nb, .notizia, .nbreve') || [...document.querySelectorAll('.a-body > *')].find((e) => /ieri|ore fa|poco fa/i.test(e.innerText || ''));
    return { testo: a.innerText.replace(/\n/g, ' · '), href: a.getAttribute('href'),
      y: +r.y.toFixed(1), larghezza: +r.width.toFixed(1), sbordaADestra: r.right > innerWidth + 0.5,
      sottoNotizia: notizia ? r.top > notizia.getBoundingClientRect().bottom - 1 : null,
      sopraGiornata: sez ? r.bottom < sez.getBoundingClientRect().top + 1 : null };
  });
  et(!!inv, 'in una lega privata l\'invito compare');
  if (inv) {
    et(/300/.test(inv.testo), `e mostra il premio vero ("${inv.testo.slice(0, 70)}")`);
    et(/Titano Open/.test(inv.testo), 'col nome della lega pubblica');
    et(inv.href === '#/leghe', `e porta all'elenco delle leghe (${inv.href})`);
    et(inv.sopraGiornata === true, 'sta SOPRA la giornata corrente');
    et(inv.sottoNotizia !== false, 'e sotto il banner delle notizie');
    et(!inv.sbordaADestra, `non sborda a destra (largo ${inv.larghezza})`);
  }
  // entrando nella pubblica, l'invito sparisce
  await p.evaluate(() => { location.hash = '#/leghe'; });
  // L'elenco arriva dal server: si aspetta la riga, non un tempo a caso.
  await p.waitForSelector('[data-pubblica]', { timeout: 15000 });
  await p.click('[data-pubblica]');
  await p.waitForSelector('#go-entra', { timeout: 15000 });
  await p.fill('#team', 'Squadra Due'); await p.click('#go-entra'); await w(p, 1800);
  await p.evaluate(() => { location.hash = '#/'; }); await w(p, 1600);
  et(!(await p.evaluate(() => !!document.querySelector('.invito'))), 'una volta entrato, l\'invito non compare piu\'');
  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
  await ctx.close();
  await b.close();

  for (const t of ok) console.log('  ok  ' + t);
  for (const t of ko) console.log('  KO  ' + t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
