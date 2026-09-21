/**
 * Le scritte in asse: presentazione e accesso.
 *
 * "Centrami le scritte". Sulle due schermate che si vedono prima di entrare
 * — la presentazione e l'accesso — il marchio, i pallini e il bottone erano
 * al centro, mentre occhiello, titolo e testo partivano da sinistra: due
 * assi diversi nella stessa schermata.
 *
 * QUI NON SI GUARDA text-align. Una regola scritta non dice dove finisce
 * l'inchiostro: un titolo largo quanto lo schermo e' "centrato" anche se la
 * riga dentro e' tutta a sinistra. Si misura il rettangolo del TESTO, con un
 * Range sul contenuto, e si confronta il suo centro con il centro dello
 * schermo. Se qualcuno domani toglie il centraggio, la distanza cresce e la
 * prova lo dice.
 *
 * Le schede della seconda schermata, invece, devono restare allineate a
 * sinistra: hanno l'icona di fianco, e un testo centrato accanto a un'icona
 * a sinistra e' una riga che non torna. Anche questo e' un controllo: il
 * centraggio non deve colare dentro le card.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const USCITA = process.env.USCITA || '/tmp';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);
const w = (ms) => new Promise((r) => setTimeout(r, ms));
const TOLLERANZA = 3;          // pt: meno di cosi' e' arrotondamento, non disallineamento

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());

  for (const [nome, vp] of [['telefono', { width: 390, height: 844 }], ['stretto', { width: 320, height: 568 }]]) {
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    const p = await ctx.newPage();
    const errori = [];
    p.on('pageerror', (e) => errori.push(String(e)));

    // Il centro dell'inchiostro, non quello della scatola.
    const asse = (sel) => p.evaluate((s) => {
      const e = document.querySelector(s); if (!e) return null;
      const r = document.createRange(); r.selectNodeContents(e);
      const t = r.getBoundingClientRect(); const box = e.getBoundingClientRect();
      const b2 = t.width > 0 ? t : box;          // elementi senza testo (il marchio) valgono per la loro scatola
      return { centro: b2.x + b2.width / 2, largo: Math.round(b2.width), align: getComputedStyle(e).textAlign };
    }, sel);
    const inAsse = async (sel, eti) => {
      const m = await asse(sel);
      if (!m) { et(false, `${nome}: ${eti} — non c'e' (${sel})`); return; }
      const scarto = Math.round(Math.abs(m.centro - vp.width / 2));
      et(scarto <= TOLLERANZA, `${nome}: ${eti} in asse (fuori di ${scarto}pt, largo ${m.largo})`);
    };

    // --- presentazione, prima schermata -----------------------------------
    await p.goto(`${BASE}/index.html#/onboarding`, { waitUntil: 'domcontentloaded' });
    await w(1400);
    await inAsse('.intro-marchio .marchio', 'il marchio');
    await inAsse('.intro-body p', 'il testo');

    // --- presentazione, seconda schermata ---------------------------------
    await p.evaluate(() => document.querySelector('[data-next]')?.click());
    await w(700);
    await inAsse('.intro-eyebrow', "l'occhiello");
    await inAsse('.intro h1', 'il titolo');
    const card = await asse('.intro-points li');
    et(card && card.align === 'left', `${nome}: le schede restano allineate a sinistra (${card ? card.align : 'assenti'})`);
    // e il marchio grande della prima schermata non deve essere una scritta
    // rifatta: se rimpicciolisce sotto i 180pt non e' piu' il marchio.
    const m1 = await asse('.intro-points');
    et(m1 && m1.largo >= vp.width - 60, `${nome}: le schede occupano la riga (${m1 ? m1.largo : 0}pt su ${vp.width})`);

    // --- accesso -----------------------------------------------------------
    await p.evaluate(() => { location.hash = '#/login'; });
    await w(1200);
    await inAsse('.auth2 .testata .marchio', 'il marchio dell\'accesso');
    await inAsse('.auth2 .tit', "il titolo dell'accesso");
    const testata = await asse('.auth2 .testata .marchio');
    et(testata && testata.largo >= 150, `${nome}: e' il marchio intero, non una scritta (${testata ? testata.largo : 0}pt)`);
    await p.screenshot({ path: `${USCITA}/in-asse-${nome}.png` });

    et(errori.length === 0, `${nome}: nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
    await ctx.close();
  }

  await b.close();
  for (const t of ok) console.log('  ok  ' + t);
  for (const t of ko) console.log('  KO  ' + t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
