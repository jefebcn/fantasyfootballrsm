/**
 * LO SHOP (Alex, 12/11). Si apre dal menu anche senza lega; quattro foto in
 * scorrimento coi pallini; senza taglia non si ordina; con la spedizione
 * compare l'indirizzo e il totale sale di 2 €; l'ordine arriva, compare in
 * «I tuoi ordini» e in Console → Shop, dove l'admin lo segna pagato.
 * Uso: node prove/shop.cjs  (server su :4173). FOTO=cartella per le schermate.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: process.env.FOTO ? 2 : 1, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    localStorage.setItem('fcs:auth', 'supabase');
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'dark' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  const p = await ctx.newPage(); const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  p.on('dialog', (d) => d.accept());
  const toast = () => p.evaluate(() => document.querySelector('.toast')?.innerText || '');
  const w = (ms) => p.waitForTimeout(ms);
  const foto = async (n, full) => { if (process.env.FOTO) await p.screenshot({ path: `${process.env.FOTO}/${n}.png`, fullPage: !!full }); };
  const totale = () => p.evaluate(() => document.querySelector('.shop-totale b').innerText.trim());
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1200);
  await p.click('[data-tab="up"]'); await p.fill('#email', 'shop@e.it'); await p.fill('#name', 'Shop'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1200);

  // senza lega: lo shop si apre lo stesso
  await p.evaluate(() => { location.hash = '#/shop'; }); await w(900);
  et(await p.$('.shop-art'), 'lo shop si apre anche senza lega');
  et((await p.$$('.shop-scorri img')).length === 4, 'quattro foto');
  et(await p.evaluate(() => document.querySelector('.shop-prezzo')?.innerText.trim()) === '18,00 €', 'prezzo 18,00 €');
  await foto('shop-1');
  // le foto scorrono e il pallino segue
  await p.evaluate(() => { const s = document.querySelector('.shop-scorri'); s.scrollTo({ left: s.clientWidth * 2 }); }); await w(600);
  et(await p.evaluate(() => [...document.querySelectorAll('.shop-punti i')].findIndex((i) => i.classList.contains('on'))) === 2, 'il pallino segue la foto');

  // senza taglia no
  await p.fill('input[name="nome"]', 'Mario Rossi'); await p.fill('input[name="contatto"]', '@mariorossi');
  await p.click('.shop-ordine button[type="submit"]'); await w(400);
  et(/taglia/i.test(await toast()), 'senza taglia chiede la taglia');
  await p.click('[data-taglia="M"]'); await w(200);
  et(await p.evaluate(() => document.querySelector('[data-taglia="M"]').classList.contains('on')), 'taglia M scelta');
  et(await p.inputValue('input[name="nome"]') === 'Mario Rossi', 'il nome resta dopo aver scelto la taglia');
  // spedizione: indirizzo e +2 €
  await p.click('input[value="spedizione"]'); await w(300);
  et(await p.$('textarea[name="indirizzo"]'), 'con la spedizione compare l\'indirizzo');
  et(await totale() === '20,00 €', 'totale 20,00 € con la spedizione');
  await p.click('[data-q="1"]'); await w(200);
  et(await totale() === '38,00 €', 'due top: 38,00 €');
  await p.click('[data-q="-1"]'); await w(200);
  await p.click('.shop-ordine button[type="submit"]'); await w(400);
  et(/indirizzo/i.test(await toast()), 'senza indirizzo lo chiede');
  await p.fill('textarea[name="indirizzo"]', 'Via del Titano 1, 47890 San Marino');
  await foto('shop-2', true);
  await p.click('.shop-ordine button[type="submit"]'); await w(1200);
  et(/Ordine n\. 1 ricevuto/.test(await p.evaluate(() => document.querySelector('.shop-grazie')?.innerText || '')), 'ordine ricevuto');
  et(/20,00 €/.test(await p.evaluate(() => document.querySelector('.shop-miei')?.innerText || '')), 'compare in I tuoi ordini');
  const salvato = await p.evaluate(() => JSON.parse(localStorage.getItem('fcs:mock')).tables.shop_ordini?.[0]);
  et(salvato && salvato.totale_cent === 2000 && salvato.taglia === 'M' && salvato.consegna === 'spedizione', 'sul server: M, spedizione, 20 €');
  await foto('shop-3');

  // console admin
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('fcs:mock')); s.tables.profiles.find((x) => x.id === s.userId).is_admin = true; localStorage.setItem('fcs:mock', JSON.stringify(s)); });
  await p.reload({ waitUntil: 'load' }); await w(1200);
  await p.evaluate(() => { location.hash = '#/admin/console'; }); await w(900);
  await p.click('[data-atab="shop"]'); await w(900);
  const testo = await p.evaluate(() => document.querySelector('.adm-console')?.innerText || '');
  et(/Mario Rossi/.test(testo) && /@mariorossi/.test(testo) && /Via del Titano/.test(testo), 'in console: nome, recapito, indirizzo');
  await foto('shop-admin');
  await p.click('[data-shop-stato="1|pagato"]'); await w(800);
  et(await p.evaluate(() => JSON.parse(localStorage.getItem('fcs:mock')).tables.shop_ordini[0].stato) === 'pagato', 'segnato pagato');

  et(!errori.length, `nessun errore JS ${errori.join(' | ')}`);
  ok.forEach((x) => console.log('  ok ', x)); ko.forEach((x) => console.log('  KO ', x));
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  await b.close(); process.exit(ko.length ? 1 : 0);
})();
