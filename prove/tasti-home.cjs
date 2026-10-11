/**
 * I TASTI DELLA HOME NELLO STILE DEI POST DI TITO (Alex, 11/10: «vorrei
 * migliorare la home dal punto di vista grafico dei tasti»).
 *
 * Prima «INSERISCI FORMAZIONE» e «Classifica e premi» erano <a> senza
 * text-decoration:none: sottolineati come link qualunque. Qui si guarda che:
 *  - il tasto della giornata sia lime, scritto in Anton, senza sottolineatura,
 *    con la freccia nel tondo, alto abbastanza per il pollice;
 *  - Anton sia caricato davvero (se manca, il tasto ricade su un altro
 *    carattere e nessuno se ne accorge);
 *  - «Classifica e premi», «Voto Titano», «Costruisci la tua rosa» e il
 *    montepremi abbiano il nuovo stile, senza sottolineature;
 *  - le icone in alto abbiano il loro riquadro e il nome della lega resti
 *    intero, in chiaro e in scuro;
 *  - fuori dalla home lo stesso stile: schede, titoli, moduli, tasti.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const USCITA = process.env.USCITA || '/tmp';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);
const LIME = 'rgb(217, 245, 31)';

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const errori = [];
  for (const tema of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', colorScheme: tema });
    await ctx.addInitScript(() => {
      window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
      localStorage.setItem('fcs:auth', 'supabase');
      localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'system' }));
      localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
    });
    const p = await ctx.newPage(); p.on('pageerror', (e) => errori.push(e.message));
    const w = (ms) => p.waitForTimeout(ms);
    await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1200);
    await p.click('[data-tab="up"]'); await p.fill('#email', 'a@e.it'); await p.fill('#name', 'Alex'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1000);
    await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('fcs:mock')); s.tables.profiles.find((x) => x.id === s.userId).is_admin = true; localStorage.setItem('fcs:mock', JSON.stringify(s)); });
    await p.reload({ waitUntil: 'load' }); await w(1300);
    await p.click('[data-vista="admin"]'); await w(300);
    await p.click('[data-form="pubblica"]'); await w(400);
    await p.fill('#pname', 'Titano Open Season'); await p.fill('#ppremio', '300€'); await p.fill('#team', 'Hasta El Roxy'); await p.click('#go-pubblica'); await w(1500);
    await p.evaluate(() => { location.hash = '#/'; });
    await p.waitForSelector('.home .a-btn.tito', { timeout: 15000 }).catch(() => {});
    await p.evaluate(() => document.fonts.ready);

    const m = await p.evaluate(() => {
      const st = (q) => { const e = document.querySelector(q); if (!e) return null; const c = getComputedStyle(e); const r = e.getBoundingClientRect();
        return { bg: c.backgroundColor, deco: c.textDecorationLine, font: c.fontFamily, h: r.height, w: r.width }; };
      const titolo = document.querySelector('.a-appbar .t b');
      return {
        tasto: st('.home .a-btn.tito'), vai: !!document.querySelector('.home .a-btn.tito .vai .ic'),
        testo: document.querySelector('.home .a-btn.tito')?.innerText.trim(),
        mcta: st('.home .mcard .mcta'), marchio: st('.home .hero-marchio'), marchioTesto: st('.home .hero-marchio > span'),
        negozio: st('.home .negozio-cta'), negozioTitolo: st('.home .negozio-cta .txt b'),
        invito: st('.home .invito'), invitoTitolo: st('.home .invito .txt b'),
        anton: document.fonts.check('21px Anton'),
        icone: [...document.querySelectorAll('.a-appbar .ib:not([data-open-drawer])')].map((e) => getComputedStyle(e).backgroundColor),
        titoloIntero: titolo ? titolo.scrollWidth <= titolo.clientWidth : false,
      };
    });
    et(m.tasto && m.tasto.bg === LIME, `[${tema}] il tasto della giornata è lime (${m.tasto?.bg})`);
    et(m.tasto && m.tasto.deco === 'none', `[${tema}] e non è sottolineato (${m.tasto?.deco})`);
    et(m.tasto && /Anton/.test(m.tasto.font) && m.anton, `[${tema}] scritto in Anton, caricato davvero`);
    et(m.vai && /formazione/i.test(m.testo || ''), `[${tema}] con la freccia nel tondo («${m.testo}»)`);
    et(m.tasto && m.tasto.h >= 48, `[${tema}] alto abbastanza per il pollice (${Math.round(m.tasto?.h)} px)`);
    et(m.mcta && m.mcta.deco === 'none' && /Anton/.test(m.mcta.font), `[${tema}] «Classifica e premi» in Anton, senza sottolineatura`);
    et(m.marchio && m.marchio.bg === LIME && /Anton/.test(m.marchioTesto?.font || ''), `[${tema}] «Voto Titano» è l'adesivo lime`);
    et(!m.negozio || (m.negozio.bg === LIME && /Anton/.test(m.negozioTitolo.font)), `[${tema}] «Costruisci la tua rosa» lime in Anton`);
    et(m.invito && /Anton/.test(m.invitoTitolo.font), `[${tema}] il montepremi ha il titolo in Anton`);
    et(m.icone.length === 3 && m.icone.every((c) => c !== 'rgba(0, 0, 0, 0)'), `[${tema}] le tre icone in alto hanno il loro riquadro`);
    et(m.titoloIntero, `[${tema}] e il nome della lega resta intero`);
    await p.evaluate(() => document.querySelector('.home .mcard')?.scrollIntoView({ block: 'center' }));
    await p.screenshot({ path: `${USCITA}/tasti-home-${tema}.png` }).catch(() => {});

    // Fuori dalla home lo stesso stile (Alex, 11/10: «portalo anche su rosa e
    // formazione e in altre schermate»): scheda scelta lime, titoli in Anton,
    // tasto principale lime, tasto secondario no.
    await p.evaluate(() => { location.hash = '#/rosa/formazione'; });
    await p.waitForSelector('.seg-rosa a.on', { timeout: 15000 }).catch(() => {});
    const fuori = await p.evaluate(() => {
      const c = (q) => { const e = document.querySelector(q); return e ? getComputedStyle(e) : null; };
      return { scheda: c('.seg-rosa a.on')?.backgroundColor, titolo: c('.a-sec b')?.fontFamily,
        modulo: c('.moduli .chip.on')?.backgroundColor };
    });
    et(fuori.scheda === LIME, `[${tema}] in Formazione la scheda scelta è lime (${fuori.scheda})`);
    et(/Anton/.test(fuori.titolo || ''), `[${tema}] e i titoli di sezione sono in Anton`);
    et(fuori.modulo === 'rgb(75, 6, 252)', `[${tema}] il modulo scelto è viola (${fuori.modulo})`);
    await p.evaluate(() => { location.hash = '#/classifica'; }); await w(1200);
    const tasti = await p.evaluate(() => [...document.querySelectorAll('.a-btn')].filter((e) => e.offsetParent)
      .map((e) => ({ sec: e.classList.contains('sec'), bg: getComputedStyle(e).backgroundColor, font: getComputedStyle(e).fontFamily })));
    const pieni = tasti.filter((t) => !t.sec);
    et(pieni.length > 0 && pieni.every((t) => t.bg === LIME && /Anton/.test(t.font)), `[${tema}] in Classifica il tasto principale è lime in Anton (${pieni.length})`);
    et(tasti.filter((t) => t.sec).every((t) => t.bg !== LIME), `[${tema}] i tasti secondari restano col bordo`);
    await ctx.close();
  }
  et(!errori.length, `nessun errore JS${errori.length ? `: ${errori[0]}` : ''}`);
  await b.close();
  ok.forEach((t) => console.log('  ok  ' + t)); ko.forEach((t) => console.log('  KO  ' + t));
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
