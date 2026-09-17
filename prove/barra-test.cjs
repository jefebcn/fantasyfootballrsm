/** La barra in basso: proporzioni, bersagli, e niente scoperto sotto. */
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
    const attesa = 53 + Math.max(tacca - 16, 0);
    et(m.alta === attesa, `${W}x${H} tacca ${tacca}: la barra e' alta ${m.alta} (attesa ${attesa})`);
    et(m.bottom === m.ih, `${W}x${H}: tocca il fondo, scoperto ${m.ih - m.bottom}`);
    et(m.minH >= 44, `${W}x${H}: bersagli alti ${m.minH} (minimo 44)`);
    et(m.minW >= 44, `${W}x${H}: bersagli larghi ${m.minW}`);
    et(m.sottoIlTesto <= Math.max(tacca - 16, 0) + 4, `${W}x${H}: sotto le voci restano ${m.sottoIlTesto}pt (riserva ${Math.max(tacca - 16, 0)})`);
    if (W === 393) await p.screenshot({ path: SCR + '/BR_barra.png', clip: { x: 0, y: H - 140, width: W, height: 140 } });
    await ctx.close();
  }
  await b.close();
  console.log('PASSATI (' + ok.length + ')'); ok.forEach(s => console.log('  ok  ' + s));
  console.log(ko.length ? '\nFALLITI (' + ko.length + ')' : '\nnessun problema'); ko.forEach(s => console.log('  KO  ' + s));
  process.exit(ko.length ? 1 : 0);
})();
