/**
 * La barra in basso: proporzioni, bersagli, niente scoperto sotto — e lo
 * stile nuovo.
 *
 * DOVE SEI non si dice col colore e basta. Prima l'unica differenza fra la
 * voce aperta e le altre era il blu del testo: su uno schermo al sole, o per
 * chi non distingue bene i blu, cinque voci si somigliano tutte. Adesso
 * l'icona della voce aperta sta in una pastiglia accesa, e qui si controlla
 * che ce ne sia UNA sola e che i contrasti reggano.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const SCR = process.env.USCITA || '/tmp';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  for (const [W, H, tacca] of [[393, 852, 34], [360, 780, 0], [430, 932, 34]]) {
    const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    await ctx.addInitScript(() => {
      window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
      localStorage.setItem('fcs:auth', 'supabase');
      localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, theme: 'light' }));
      localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
    });
    const p = await ctx.newPage(); p.on('dialog', d => d.accept());
    const w = (ms = 450) => p.waitForTimeout(ms);
    await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
    await p.click('[data-tab="up"]'); await w(250);
    await p.fill('#email', 'a@e.it'); await p.fill('#name', 'Alessandro'); await p.fill('#password', 'password123');
    await p.click('#primary'); await w(1000);
    await p.click('[data-form="create"]'); await w(250);
    await p.fill('#lname', 'Prova'); await p.fill('#team', 'Prova FC'); await p.click('#go-create'); await w(1400);
    // sulla dashboard, che e' dove una voce della barra e' aperta: la
    // creazione finisce su una schermata fuori dalla barra, e senza questo
    // passaggio non c'e' nessuna voce accesa da misurare
    await p.evaluate(() => { location.hash = '#/'; }); await w(800);
    // la tacca del telefono, simulata: Chromium non ha env(safe-area-inset-*)
    await p.evaluate((t) => { document.documentElement.style.setProperty('--sa-bottom', t + 'px'); }, tacca);
    await w(400);

    const m = await p.evaluate(() => {
      const n = document.querySelector('.a-nav').getBoundingClientRect();
      const voci = [...document.querySelectorAll('.a-nav a')].map(e => { const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; });
      const testi = [...document.querySelectorAll('.a-nav a')].map(e => { const r = e.getBoundingClientRect(); return Math.round(r.bottom); });
      return { alta: Math.round(n.height), bottom: Math.round(n.bottom), ih: innerHeight,
               minH: Math.min(...voci.map(v => v.h)), minW: Math.min(...voci.map(v => v.w)),
               sottoIlTesto: Math.round(innerHeight - Math.max(...testi)) };
    });
    // 58: la pastiglia dell'icona (28) con l'etichetta sotto. Se qualcuno
    // cambia l'altezza senza pensarci, questa riga lo ferma.
    const attesa = 58 + Math.max(tacca - 16, 0);
    et(m.alta === attesa, `${W}x${H} tacca ${tacca}: la barra e' alta ${m.alta} (attesa ${attesa})`);
    et(m.bottom === m.ih, `${W}x${H}: tocca il fondo, scoperto ${m.ih - m.bottom}`);
    et(m.minH >= 44, `${W}x${H}: bersagli alti ${m.minH} (minimo 44)`);
    et(m.minW >= 44, `${W}x${H}: bersagli larghi ${m.minW}`);
    et(m.sottoIlTesto <= Math.max(tacca - 16, 0) + 4, `${W}x${H}: sotto le voci restano ${m.sottoIlTesto}pt (riserva ${Math.max(tacca - 16, 0)})`);
    // lo stile: una pastiglia accesa sola, e i contrasti misurati
    const st = await p.evaluate(() => {
      const leggi = (v) => { const n = v.match(/[\d.]+/g).slice(0, 3).map(Number); return { r: n[0], g: n[1], b: n[2] }; };
      const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
        return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
      const rap = (a, b) => { const x = lum(leggi(a)), y = lum(leggi(b)); return +((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2); };
      const trasp = (v) => !v || v === 'transparent' || /rgba\(0, 0, 0, 0\)/.test(v);
      const voci = [...document.querySelectorAll('.a-nav a')];
      const accese = voci.filter((a) => !trasp(getComputedStyle(a.querySelector('.np')).backgroundColor));
      const on = document.querySelector('.a-nav a.on');
      const nav = getComputedStyle(document.querySelector('.a-nav'));
      return {
        pastiglie: voci.filter((a) => !!a.querySelector('.np')).length,
        accese: accese.length,
        accesaGiusta: accese.length === 1 && accese[0].classList.contains('on'),
        bordo: nav.borderTopWidth,
        iconaSuPastiglia: rap(getComputedStyle(on).color, getComputedStyle(on.querySelector('.np')).backgroundColor),
        etichettaSuBarra: rap(getComputedStyle(on).color, nav.backgroundColor),
        spentaSuBarra: rap(getComputedStyle(document.querySelector('.a-nav a:not(.on)')).color, nav.backgroundColor),
      };
    });
    et(st.pastiglie === 5, `${W}x${H}: tutte e cinque le voci hanno la loro pastiglia (${st.pastiglie})`);
    et(st.accesaGiusta, `${W}x${H}: una pastiglia accesa sola, e sulla voce aperta (${st.accese} accese)`);
    et(parseFloat(st.bordo) >= 1, `${W}x${H}: la barra e' separata dal contenuto da un bordo (${st.bordo})`);
    et(st.iconaSuPastiglia >= 3, `${W}x${H}: icona accesa sulla pastiglia, contrasto ${st.iconaSuPastiglia} (minimo 3)`);
    et(st.etichettaSuBarra >= 4.5, `${W}x${H}: etichetta accesa, contrasto ${st.etichettaSuBarra} (minimo 4,5)`);
    et(st.spentaSuBarra >= 4.5, `${W}x${H}: etichette spente, contrasto ${st.spentaSuBarra} (minimo 4,5)`);
    if (W === 393) await p.screenshot({ path: SCR + '/BR_barra.png', clip: { x: 0, y: H - 140, width: W, height: 140 } });
    await ctx.close();
  }
  await b.close();
  console.log('PASSATI (' + ok.length + ')'); ok.forEach(s => console.log('  ok  ' + s));
  console.log(ko.length ? '\nFALLITI (' + ko.length + ')' : '\nnessun problema'); ko.forEach(s => console.log('  KO  ' + s));
  process.exit(ko.length ? 1 : 0);
})();
