/**
 * La testata della Classifica: cosa resta in alto quando si scorre, e cosa
 * spariisce quando non ha niente da dire.
 *
 * LA BARRA DELLE SCHEDE. Nello schermo di Alex, scorrendo la pagina la barra
 * Classifica/Giornata/Record finiva dietro l'app bar — misurati 63px nascosti
 * — mentre restava appiccicato il badge "CONGELATO · giornata 3". Si perdeva
 * la navigazione e restava l'informazione: al contrario. E l'etichetta a
 * destra del badge diceva "Record" mentre la scheda "Record" era gia' accesa
 * due centimetri sotto.
 *
 * LE SCHEDE DEI RECORD. Con una giornata sola giocata, "miglior punteggio" e
 * "peggior punteggio" sono lo stesso fatto: stesso numero, stessa squadra,
 * stessa giornata, due schede identiche. E una "vittoria piu' larga +0" non
 * e' una vittoria.
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
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, theme: 'dark' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  // La lega nasce prima della stagione, cosi' le giornate giocate sono sue.
  await ctx.clock.install({ time: new Date('2026-08-20T12:00:00Z') });
  const p = await ctx.newPage(); p.on('dialog', d => d.accept());
  const errori = []; p.on('pageerror', e => errori.push(e.message));
  const w = (ms = 450) => p.waitForTimeout(ms);
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await w(250);
  await p.fill('#email', 'a@e.it'); await p.fill('#name', 'Conti25'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1000);
  await p.click('[data-form="create"]'); await w(250);
  await p.fill('#lname', 'Torneo Titano'); await p.fill('#team', 'Hasta El Roxy'); await p.click('#go-create'); await w(1400);
  const code = await p.evaluate(() => document.body.innerText.match(/[Cc]odice(?: invito)?\s*([A-Z0-9]{6})/)?.[1]);
  await p.evaluate(() => { location.hash = '#/impostazioni'; }); await w(500); await p.click('[data-act="logout"]'); await w(900);
  await p.click('[data-tab="up"]'); await w(250);
  await p.fill('#email', 'b@e.it'); await p.fill('#name', 'Wesly'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1000);
  await p.click('[data-form="join"]'); await w(250);
  await p.fill('#code', code); await p.fill('#team', 'FUEGO ROXY'); await p.click('#go-join'); await w(1200);
  await p.evaluate(() => { location.hash = '#/impostazioni'; }); await w(500); await p.click('[data-act="logout"]'); await w(900);
  await p.waitForSelector('#password');
  await p.fill('#email', 'a@e.it'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1300);
  await p.evaluate(() => { location.hash = '#/lega'; }); await w(600);
  await p.evaluate(() => document.querySelector('#draft')?.click()); await w(1600);
  await p.evaluate(() => { location.hash = '#/impostazioni/avanzate'; }); await w(800);
  const seme = await p.evaluate(() => { const x = document.querySelector('[data-act="seed"]'); if (!x) return false; x.click(); return true; });
  if (!seme) throw new Error('bottone del seme sparito: la prova girerebbe a vuoto');
  await w(2000);
  await p.evaluate(() => { location.hash = '#/classifica'; });
  await p.reload({ waitUntil: 'load' }); await w(2000);
  await p.evaluate(() => { const x = [...document.querySelectorAll('[data-vista]')].find((e) => /record/i.test(e.textContent)); if (x) x.click(); }); await w(1200);

  // 1. niente etichetta doppia
  const doppia = await p.evaluate(() => {
    const seg = document.querySelector('.seg-cls');
    const accesa = seg?.querySelector('.on')?.innerText.trim() || '';
    const fuori = [...document.querySelectorAll('.a-body > *')]
      .filter((e) => !e.closest('.segwrap') && e.innerText && e.innerText.trim() === accesa).length;
    return { accesa, fuori };
  });
  et(doppia.accesa.length > 0, `la scheda accesa è "${doppia.accesa}"`);
  et(doppia.fuori === 0, `e il suo nome non è ripetuto altrove nella testata (${doppia.fuori})`);

  // 2. scorrendo, la barra resta e il badge va via
  const prima = await p.evaluate(() => {
    const q = (s) => { const e = document.querySelector(s); return e ? +e.getBoundingClientRect().top.toFixed(1) : null; };
    return { seg: q('.seg-cls'), badge: q('.statoriga') };
  });
  await p.evaluate(() => { document.querySelector('.a-body').scrollTop = 200; }); await w(500);
  const dopo = await p.evaluate(() => {
    const app = document.querySelector('.a-appbar').getBoundingClientRect();
    const s = document.querySelector('.seg-cls');
    const st = document.querySelector('.statoriga');
    const r = s.getBoundingClientRect();
    return { nascosta: +(app.bottom - r.top).toFixed(1), segTop: +r.top.toFixed(1),
      badgeTop: st ? +st.getBoundingClientRect().top.toFixed(1) : null, appBottom: +app.bottom.toFixed(1),
      // quanto ha scorso DAVVERO: una pagina corta si ferma prima dei 200px
      // chiesti, e pretendere che il badge finisca dietro l'app bar voleva
      // dire pretendere una certa quantita' di contenuto sotto.
      scorso: +document.querySelector('.a-body').scrollTop.toFixed(1) };
  });
  et(dopo.nascosta <= 0, `scorrendo la barra delle schede resta tutta visibile (${dopo.nascosta}px sotto l'app bar)`);
  et(dopo.segTop < prima.seg + 2, 'ed è rimasta in alto invece di scorrere via');
  et(dopo.badgeTop !== null && Math.abs((prima.badge - dopo.badgeTop) - dopo.scorso) <= 1,
    `mentre il badge di stato scorre con la pagina (sceso ${(prima.badge - dopo.badgeTop).toFixed(1)}px su ${dopo.scorso}px scorsi)`);

  // 3. i tasti restano raggiungibili: si cambia scheda a pagina scorsa
  await p.evaluate(() => { const x = [...document.querySelectorAll('[data-vista]')].find((e) => /^Classifica$/i.test(e.textContent.trim())); if (x) x.click(); }); await w(900);
  const cambiata = await p.evaluate(() => document.querySelector('.seg-cls .on')?.innerText.trim());
  et(/classifica/i.test(cambiata || ''), `a pagina scorsa si cambia scheda ("${cambiata}")`);

  // 4. le schede dei record che non dicono niente
  await p.evaluate(() => { const x = [...document.querySelectorAll('[data-vista]')].find((e) => /record/i.test(e.textContent)); if (x) x.click(); }); await w(1000);
  const rec = await p.evaluate(() => {
    const et2 = [...document.querySelectorAll('.rec .et')].map((e) => e.innerText.trim());
    const vals = [...document.querySelectorAll('.rec .val')].map((e) => e.innerText.trim());
    return { et2, vals, testo: document.body.innerText };
  });
  et(!rec.vals.some((v) => v === '+0' || v === '0'), `nessuna scheda con un record a zero (${rec.vals.join(' · ')})`);
  // Le etichette escono in maiuscolo: il CSS ha text-transform, e innerText
  // restituisce il testo RESO, non quello scritto nel codice.
  const ha = (t) => rec.et2.some((x) => x.toLowerCase() === t);
  const migliore = ha('miglior punteggio'), peggiore = ha('peggior punteggio');
  et(migliore, 'la scheda del miglior punteggio c\'è');
  et(!(migliore && peggiore) || rec.vals[0] !== rec.vals[1],
    'e non c\'è la stessa scheda due volte con lo stesso numero');
  // le tre colonne delle medie hanno un nome
  et(/MEDIA[\s\S]{0,20}MAX[\s\S]{0,20}MIN/i.test(rec.testo), 'le tre colonne delle medie sono intestate');
  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);

  await b.close();
  for (const t of ok) console.log('  ok  ' + t);
  for (const t of ko) console.log('  KO  ' + t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
