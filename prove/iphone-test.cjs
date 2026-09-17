/**
 * Il caso dell'iPhone di Alex, riprodotto dai numeri misurati sulla sua
 * schermata: schermo 852pt, tacca in alto 59pt, ma la finestra che iOS
 * concede all'app e' alta 793 e parte dal bordo superiore. In fondo restano
 * scoperti 59pt.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

async function apri(b, { finestra, schermo, tacca }) {
  // finestra = quanto iOS dichiara; schermo = quanto e' davvero
  const ctx = await b.newContext({ viewport: { width: 393, height: finestra }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(({ schermo, tacca }) => {
    Object.defineProperty(window.screen, 'height', { get: () => schermo, configurable: true });
    addEventListener('DOMContentLoaded', () => {
      const st = document.createElement('style');
      st.textContent = `:root{--sa-top:${tacca}px;--sa-bottom:34px}`;
      document.head.appendChild(st);
    });
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    localStorage.setItem('fcs:auth', 'supabase');
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, theme: 'light' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  }, { schermo, tacca });
  const p = await ctx.newPage(); p.on('dialog', d => d.accept());
  const w = (ms = 450) => p.waitForTimeout(ms);
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await w(250);
  await p.fill('#email', 'a@e.it'); await p.fill('#name', 'Alessandro'); await p.fill('#password', 'password123');
  await p.click('#primary'); await w(1000);
  await p.click('[data-form="create"]'); await w(250);
  await p.fill('#lname', 'Torneo Titano'); await p.fill('#team', 'Fuego Roxy'); await p.click('#go-create'); await w(1500);
  return { ctx, p };
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());

  // --- il caso di Alex: la finestra e' corta esattamente quanto la tacca
  {
    const { ctx, p } = await apri(b, { finestra: 793, schermo: 852, tacca: 59 });
    const m = await p.evaluate(() => ({
      varApp: getComputedStyle(document.documentElement).getPropertyValue('--h-app').trim(),
      app: Math.round(document.querySelector('.app').getBoundingClientRect().height),
      navBottom: Math.round(document.querySelector('.a-nav').getBoundingClientRect().bottom),
      navTop: Math.round(document.querySelector('.a-nav').getBoundingClientRect().top),
      barraBlu: Math.round(document.querySelector('.a-appbar').getBoundingClientRect().height),
      ih: innerHeight, schermo: screen.height,
      saBottom: getComputedStyle(document.documentElement).getPropertyValue('--sa-bottom').trim(),
      scritte: [...document.querySelectorAll('.a-nav a')].filter(a => a.textContent.trim().length > 1).length,
      scritteSotto: Math.max(...[...document.querySelectorAll('.a-nav a')].map(a => Math.round(a.getBoundingClientRect().bottom))),
    }));
    // iOS disegna solo 793pt: il riquadro deve stare dentro quelli, o le
    // scritte della barra finiscono in un pezzo di schermo che non viene
    // disegnato affatto.
    et(m.varApp === '793px', `il riquadro resta dentro quello che iOS disegna (${m.varApp})`);
    et(m.app === 793, `alto 793 e non 852 (${m.app})`);
    et(m.navBottom === 793, `la barra chiude il riquadro (${m.navBottom})`);
    // la barretta di casa sta gia' fuori dalla finestra: tenerle da parte 34pt
    // dentro la barra sarebbe contarla due volte
    et(m.saBottom === '0px', `la tacca in basso non viene contata due volte (${m.saBottom})`);
    // 58: l'altezza della barra da quando l'icona ha la sua pastiglia (vedi
    // prove/barra-test.cjs, che e' il posto dove quella misura si decide)
    et(793 - m.navTop === 58, `senza tacca in basso la barra e' 58 (${793 - m.navTop})`);
    et(m.scritte === 5, `e le cinque scritte ci sono tutte (${m.scritte})`);
    et(m.scritteSotto <= 793, `l'ultima scritta sta dentro l'area disegnata (fondo a ${m.scritteSotto}, limite 793)`);
    // la barra blu in alto deve venire come sulla sua schermata: ~124pt
    et(Math.abs(m.barraBlu - 124) <= 6, `la barra blu in alto viene ${m.barraBlu}pt (sulla sua schermata: 124)`);
    const SCR = process.env.USCITA || '/tmp';
    // Si ritaglia fino a 793, che e' quanto iOS disegna: sotto ci mette il
    // colore di fondo e basta.
    await p.screenshot({ path: SCR + '/IP_dopo.png', clip: { x: 0, y: 793 - 130, width: 393, height: 130 } });
    // e com'era prima: la tacca in basso contata due volte
    await p.evaluate(() => { document.documentElement.style.setProperty('--sa-bottom', '34px'); });
    await p.waitForTimeout(300);
    await p.screenshot({ path: SCR + '/IP_prima.png', clip: { x: 0, y: 793 - 130, width: 393, height: 130 } });
    await p.evaluate(() => { document.documentElement.style.setProperty('--sa-bottom', '0px'); });
    await ctx.close();
  }

  // --- il nuovo assetto: barra di stato opaca, la web view parte sotto di lei.
  //     La finestra resta 793 ma ora sta in fondo allo schermo, la tacca in
  //     alto vale 0 e quella in basso torna a contare.
  {
    const { ctx, p } = await apri(b, { finestra: 793, schermo: 852, tacca: 0 });
    const m = await p.evaluate(() => ({
      varApp: getComputedStyle(document.documentElement).getPropertyValue('--h-app').trim(),
      sa: getComputedStyle(document.documentElement).getPropertyValue('--sa-bottom').trim(),
      navAlta: Math.round(document.querySelector('.a-nav').getBoundingClientRect().height),
      navBottom: Math.round(document.querySelector('.a-nav').getBoundingClientRect().bottom),
      barraBlu: Math.round(document.querySelector('.a-appbar').getBoundingClientRect().height),
      scritte: [...document.querySelectorAll('.a-nav a')].filter(a => a.textContent.trim().length > 1).length,
    }));
    et(m.varApp === '793px', `la finestra resta quella dichiarata (${m.varApp})`);
    et(m.sa === '34px', `la barretta di casa torna a contare (${m.sa})`);
    et(m.navAlta === 76, `la barra e' 58 + (34 - 16) = 76 (${m.navAlta})`);
    et(m.navBottom === 793, `e chiude il riquadro, che ora sta in fondo allo schermo (${m.navBottom})`);
    et(m.barraBlu <= 70, `l'intestazione blu scende a ${m.barraBlu}pt (prima 124)`);
    et(m.scritte === 5, `le cinque scritte ci sono (${m.scritte})`);
    await ctx.close();
  }

  // --- telefono sano: la finestra e' gia' giusta, la regola NON deve scattare
  {
    const { ctx, p } = await apri(b, { finestra: 852, schermo: 852, tacca: 59 });
    const m = await p.evaluate(() => ({
      varApp: getComputedStyle(document.documentElement).getPropertyValue('--h-app').trim(),
      navBottom: Math.round(document.querySelector('.a-nav').getBoundingClientRect().bottom),
      ih: innerHeight,
      sa: getComputedStyle(document.documentElement).getPropertyValue('--sa-bottom').trim(),
    }));
    et(m.varApp === '852px', `telefono sano: resta la finestra (${m.varApp})`);
    et(m.sa !== '0px', `e la tacca in basso resta quella vera (${m.sa})`);
    et(m.navBottom === 852, `e la barra tocca il fondo lo stesso (scoperti ${852 - m.navBottom})`);
    await ctx.close();
  }

  // --- browser con le barre di Safari: la finestra e' molto piu' corta dello
  //     schermo e la regola non deve scattare, o la barra finirebbe sotto
  //     quella del browser
  {
    const { ctx, p } = await apri(b, { finestra: 700, schermo: 852, tacca: 0 });
    const m = await p.evaluate(() => ({
      varApp: getComputedStyle(document.documentElement).getPropertyValue('--h-app').trim(),
      navBottom: Math.round(document.querySelector('.a-nav').getBoundingClientRect().bottom),
    }));
    et(m.varApp === '700px', `nel browser resta la finestra, non lo schermo (${m.varApp})`);
    et(m.navBottom === 700, `e la barra sta sopra le barre del browser (${m.navBottom})`);
    await ctx.close();
  }

  // --- caso vicino ma non uguale: non deve scattare per caso
  {
    const { ctx, p } = await apri(b, { finestra: 800, schermo: 852, tacca: 59 });
    const m = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--h-app').trim());
    et(m === '800px', `se il conto non torna (800 + 59 != 852) non scatta niente (${m})`);
    await ctx.close();
  }

  await b.close();
  console.log('PASSATI (' + ok.length + ')'); ok.forEach(s => console.log('  ok  ' + s));
  console.log(ko.length ? '\nFALLITI (' + ko.length + ')' : '\nnessun problema'); ko.forEach(s => console.log('  KO  ' + s));
  process.exit(ko.length ? 1 : 0);
})();
