/**
 * Il banner del montepremi, nelle sue due facce.
 *
 * Sta fra le notizie e la giornata corrente: sopra il contesto del
 * campionato, sotto quello che devi fare adesso, in mezzo una cosa che puoi
 * fare in piu'. E mostra il premio VERO scritto da chi ha aperto la lega
 * pubblica: un banner che promette una cifra decisa altrove sarebbe una cosa
 * che l'app non puo' mantenere.
 *
 * Da fuori invita e porta DRITTO a entrare in quella lega, col modulo del
 * nome squadra gia' aperto. Da dentro ricorda per cosa si gioca e porta ai
 * premi in palio.
 *
 * IL CONTRASTO SE LO MISURA DA SE'. L'audit generale salta chi ha un
 * gradiente sopra, perche' il colore del fondo non si legge da
 * backgroundColor: qui i colori del gradiente si leggono dallo stile
 * calcolato, ci si compone sopra il velo d'oro e le righe bianche, e si
 * pretende 4,5:1 sul punto piu' chiaro che il fondo puo' assumere.
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
  // La lega pubblica la apre solo chi amministra l'app (014). Il primo
  // amministratore si nomina dal database, come il Giudice Dati: qui si fa
  // quello, che e' il percorso vero e non una scorciatoia della prova.
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    s.tables.profiles.find((x) => x.id === s.userId).is_admin = true;
    localStorage.setItem('fcs:mock', JSON.stringify(s));
  });
  await p.reload({ waitUntil: 'load' }); await w(p, 1600);
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
  // dentro la lega pubblica il banner cambia faccia: non "entra", ma per cosa
  // si gioca — e porta ai premi, non all'elenco delle leghe
  await p.evaluate(() => { location.hash = '#/'; }); await w(p, 1500);
  const dentro = await p.evaluate(() => {
    const a = document.querySelector('.invito');
    return a && { testo: a.innerText.replace(/\n/g, ' · '), href: a.getAttribute('href'), entra: a.hasAttribute('data-entra') };
  });
  et(!!dentro, 'dentro la lega pubblica il banner c\'e\'');
  if (dentro) {
    et(/montepremi/i.test(dentro.testo) && /300/.test(dentro.testo), `e dice il montepremi ("${dentro.testo.slice(0, 60)}")`);
    et(!/entra/i.test(dentro.testo), 'senza invitare a entrare in una lega in cui sei già');
    et(dentro.href === '#/classifica' && !dentro.entra, `e porta ai premi in palio (${dentro.href})`);
  }
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
    return { testo: a.innerText.replace(/\n/g, ' · '), href: a.getAttribute('href'), entra: a.getAttribute('data-entra'),
      alto: +r.height.toFixed(1),
      y: +r.y.toFixed(1), larghezza: +r.width.toFixed(1), sbordaADestra: r.right > innerWidth + 0.5,
      sottoNotizia: notizia ? r.top > notizia.getBoundingClientRect().bottom - 1 : null,
      sopraGiornata: sez ? r.bottom < sez.getBoundingClientRect().top + 1 : null };
  });
  et(!!inv, 'in una lega privata l\'invito compare');
  if (inv) {
    et(/300/.test(inv.testo), `e mostra il premio vero ("${inv.testo.slice(0, 70)}")`);
    et(/Titano Open/.test(inv.testo), 'col nome della lega pubblica');
    et(inv.href === '#/leghe' && inv.entra, `e porta a entrare in quella lega (${inv.href}, data-entra=${inv.entra})`);
    et(inv.sopraGiornata === true, 'sta SOPRA la giornata corrente');
    et(inv.sottoNotizia !== false, 'e sotto il banner delle notizie');
    et(!inv.sbordaADestra, `non sborda a destra (largo ${inv.larghezza})`);
  }
  // ---- il contrasto, sul punto piu' chiaro che il fondo puo' assumere
  const con = await p.evaluate(() => {
    const a = document.querySelector('.invito');
    const tinte = (str) => [...str.matchAll(/rgba?\(([^)]+)\)/g)].map((m) => {
      const n = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
      return { r: n[0], g: n[1], b: n[2], a: n[3] === undefined ? 1 : n[3] };
    });
    const sopra = (f, d) => ({ r: f.r * f.a + d.r * (1 - f.a), g: f.g * f.a + d.g * (1 - f.a), b: f.b * f.a + d.b * (1 - f.a), a: 1 });
    const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
    const rap = (x, y) => { const l1 = lum(x), l2 = lum(y); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
    // il fondo: le fermate del gradiente della fascia, e sopra i due veli del
    // ::before (l'oro del riflettore e le righe bianche) alla loro opacita'
    const fermate = tinte(getComputedStyle(a).backgroundImage).filter((c) => c.a > 0.9);
    const veli = tinte(getComputedStyle(a, '::before').backgroundImage).filter((c) => c.a > 0 && c.a < 1);
    const fondi = fermate.map((f) => veli.reduce((acc, v) => sopra(v, acc), f));
    const chiaro = fondi.reduce((m, c) => (lum(c) > lum(m) ? c : m), fondi[0]);
    const misura = (sel, nome) => { const e = a.querySelector(sel); const cs = getComputedStyle(e);
      return { nome, px: parseFloat(cs.fontSize), peso: cs.fontWeight, r: +rap(tinte(cs.color)[0], chiaro).toFixed(2) }; };
    return { fermate: fermate.length, veli: veli.length,
      chiaro: `rgb(${[chiaro.r, chiaro.g, chiaro.b].map(Math.round).join(',')})`,
      righe: [misura('.txt b', 'titolo'), misura('.txt > span', 'riga'), misura('.txt > span.sot', 'riga piccola')] };
  });
  et(con.fermate >= 2 && con.veli >= 2, `fondo letto davvero: ${con.fermate} fermate e ${con.veli} veli (piu' chiaro ${con.chiaro})`);
  for (const r of con.righe) et(r.r >= 4.5, `${r.nome}: contrasto ${r.r} sul fondo piu' chiaro (${Math.round(r.px)}px/${r.peso})`);

  // ---- toccando il banner si entra DIRETTAMENTE in quella lega
  await p.click('.invito'); await w(p, 400);
  await p.waitForSelector('#go-entra', { timeout: 15000 });
  const diretto = await p.evaluate(() => {
    const c = document.querySelector('#go-entra').closest('.a-card');
    const r = c.getBoundingClientRect();
    return { testo: c.innerText.replace(/\n/g, ' '), inVista: r.top > -1 && r.bottom < innerHeight + 1 };
  });
  et(/Titano Open/.test(diretto.testo), `il banner apre il modulo su quella lega ("${diretto.testo.slice(0, 48)}")`);
  et(diretto.inVista, 'e la pagina ci scorre sopra, invece di lasciarlo sotto lo schermo');
  await p.fill('#team', 'Squadra Due'); await p.click('#go-entra'); await w(p, 1800);
  await p.evaluate(() => { location.hash = '#/'; }); await w(p, 1600);
  const poi = await p.evaluate(() => {
    const a = document.querySelector('.invito');
    return a && { testo: a.innerText.replace(/\n/g, ' · '), href: a.getAttribute('href') };
  });
  et(!!poi && /montepremi/i.test(poi.testo) && poi.href === '#/classifica',
    `una volta entrato il banner passa alla faccia del montepremi ("${poi ? poi.testo.slice(0, 50) : 'assente'}")`);
  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
  await ctx.close();
  await b.close();

  for (const t of ok) console.log('  ok  ' + t);
  for (const t of ko) console.log('  KO  ' + t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
