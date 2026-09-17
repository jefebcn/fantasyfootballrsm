/**
 * I tre punti segnati da Alex sulla dashboard:
 *  1. nessuna striscia fra l'intestazione blu e la copertina
 *  2. il marchio "Voto Titano" non incollato alla card dei numeri, ed e' un
 *     collegamento vero invece di una scritta a forma di tasto
 *  3. le scritte della barra in basso il piu' vicino possibile al bordo
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const SCR = process.env.USCITA || '/tmp';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  // finestra 793 e tacche come sul telefono di Alex dopo il cambio di barra di stato
  for (const [tema, conFoto] of [['dark', true], ['light', true], ['dark', false]]) {
    const ctx = await b.newContext({ viewport: { width: 393, height: 793 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    await ctx.addInitScript(({ tema, conFoto }) => {
      addEventListener('DOMContentLoaded', () => {
        const st = document.createElement('style');
        st.textContent = ':root{--sa-top:0px;--sa-bottom:34px}';
        document.head.appendChild(st);
      });
      window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
      localStorage.setItem('fcs:auth', 'supabase');
      localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, theme: tema, sfondoFoto: conFoto }));
      localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
    }, { tema, conFoto });
    const p = await ctx.newPage(); p.on('dialog', d => d.accept());
    const errori = []; p.on('pageerror', e => errori.push(e.message));
    const w = (ms = 450) => p.waitForTimeout(ms);
    const eti = `${tema}${conFoto ? '+foto' : ''}`;
    await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
    await p.click('[data-tab="up"]'); await w(250);
    await p.fill('#email', 'a@e.it'); await p.fill('#name', 'Conti25'); await p.fill('#password', 'password123');
    await p.click('#primary'); await w(1000);
    await p.click('[data-form="create"]'); await w(250);
    await p.fill('#lname', 'Torneo Titano'); await p.fill('#team', 'Hasta El Roxy'); await p.click('#go-create'); await w(1300);
    await p.evaluate(async () => {
      const m = await import('/src/personaggio.js');
      const s = JSON.parse(localStorage.getItem('fcs:mock'));
      s.tables.league_members[0].kit = { personaggio: m.elenco()[0] };
      localStorage.setItem('fcs:mock', JSON.stringify(s));
    });
    await p.evaluate(() => { location.hash = '#/'; });
    await p.reload({ waitUntil: 'load' }); await w(2000);
    await p.evaluate(() => document.fonts && document.fonts.ready); await w(300);

    const m = await p.evaluate(() => {
      const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect();
        return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height) }; };
      const marchio = document.querySelector('.hero-marchio');
      const voci = [...document.querySelectorAll('.a-nav a')];
      return {
        appbar: r('.a-appbar'), hero: r('.a-hero'), marchio: r('.hero-marchio'), stats: r('.a-card.a-stats'),
        slotVisibile: getComputedStyle(document.querySelector('#install-slot')).display,
        marchioTag: marchio ? marchio.tagName : null,
        marchioHref: marchio ? marchio.getAttribute('href') : null,
        nav: r('.a-nav'), ih: innerHeight,
        vociAlte: Math.min(...voci.map(a => Math.round(a.getBoundingClientRect().height))),
        scritteFine: Math.max(...voci.map(a => Math.round(a.getBoundingClientRect().bottom))),
        scritte: voci.filter(a => a.textContent.trim().length > 1).length,
      };
    });

    // 1. niente striscia
    et(m.hero.top === m.appbar.bottom, `${eti}: la copertina attacca all'intestazione (striscia di ${m.hero.top - m.appbar.bottom}pt)`);
    et(m.slotVisibile === 'none', `${eti}: lo spazio vuoto dell'invito a installare esce dal conto (${m.slotVisibile})`);
    // 2. il marchio
    et(m.marchioTag === 'A' && m.marchioHref === '#/regolamento', `${eti}: il marchio e' un collegamento vero (${m.marchioTag} -> ${m.marchioHref})`);
    et(m.stats.top - m.marchio.bottom >= 14, `${eti}: il marchio respira dalla card dei numeri (${m.stats.top - m.marchio.bottom}pt)`);
    // 3. la barra
    et(m.nav.bottom === m.ih, `${eti}: la barra chiude il riquadro (scoperti ${m.ih - m.nav.bottom})`);
    et(m.vociAlte >= 44, `${eti}: bersagli da toccare ${m.vociAlte}pt`);
    et(m.scritte === 5, `${eti}: le cinque scritte ci sono (${m.scritte})`);
    et(m.ih - m.scritteFine <= 22, `${eti}: sotto le scritte restano ${m.ih - m.scritteFine}pt (erano 36)`);
    et(errori.length === 0, `${eti}: ${errori.length ? 'eccezioni ' + errori.join(' | ') : 'nessuna eccezione'}`);
    if (eti === 'dark+foto') await p.screenshot({ path: SCR + '/DT_dopo.png', clip: { x: 0, y: 0, width: 393, height: 793 } });
    await ctx.close();
  }
  await b.close();
  console.log('PASSATI (' + ok.length + ')'); ok.forEach(s => console.log('  ok  ' + s));
  console.log(ko.length ? '\nFALLITI (' + ko.length + ')' : '\nnessun problema'); ko.forEach(s => console.log('  KO  ' + s));
  process.exit(ko.length ? 1 : 0);
})();
