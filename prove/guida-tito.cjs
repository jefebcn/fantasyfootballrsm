// La guida di TITO dopo la registrazione.
//
// Chi si iscrive e non ha ancora una lega arriva su tre passi raccontati da
// TITO (dove giocare, la squadra, i giocatori) e solo dopo sulle leghe. Una
// volta sola per dispositivo; si rivede dalle impostazioni. Chi arriva da un
// invito salta la guida: il modulo col codice lo aspetta gia'.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const OUT = process.env.USCITA || '/tmp';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ko = [];
  const vero = (c, m) => { if (!c) ko.push(m); };
  const nuovo = async () => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    await ctx.addInitScript(() => {
      window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
      localStorage.setItem('fcs:auth', 'supabase');
      if (!localStorage.getItem('fcs:prefs')) localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, theme: 'system' }));
      localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
    });
    const p = await ctx.newPage(); p.on('dialog', (d) => d.accept());
    const err = []; p.on('pageerror', (e) => err.push(e.message));
    return { ctx, p, err, w: (ms = 500) => p.waitForTimeout(ms) };
  };
  const iscriviti = async (p, w) => {
    await p.click('[data-tab="up"]'); await w(250);
    await p.fill('#email', 'a@e.it'); await p.fill('#name', 'Alex'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1200);
  };

  // 1. dopo la registrazione: la guida, tre passi, TITO che parla
  {
    const { ctx, p, err, w } = await nuovo();
    await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1200);
    await iscriviti(p, w);
    vero((await p.evaluate(() => location.hash)) === '#/guida', `dopo l'iscrizione si arriva su ${await p.evaluate(() => location.hash)}, non sulla guida`);
    const titoli = [];
    for (let i = 0; i < 3; i++) {
      await p.evaluate(() => document.fonts && document.fonts.ready);
      const s = await p.evaluate(() => {
        const img = document.querySelector('.guida-tito img');
        const f = document.querySelector('.guida-fumetto');
        return { titolo: document.querySelector('.guida h1')?.textContent, passo: document.querySelector('.guida-passo')?.textContent,
          tito: !!(img && img.complete && img.naturalWidth > 0), fumetto: f ? f.getBoundingClientRect().width : 0, punti: document.querySelectorAll('.guida .intro-points li').length };
      });
      titoli.push(s.titolo);
      vero(s.passo === `Passo ${i + 1} di 3`, `passo ${i + 1}: l'indicatore dice "${s.passo}"`);
      vero(s.tito, `passo ${i + 1}: l'immagine di TITO non si carica`);
      vero(s.fumetto > 150, `passo ${i + 1}: il fumetto di TITO e' largo ${Math.round(s.fumetto)}px`);
      vero(s.punti >= 2, `passo ${i + 1}: ${s.punti} punti spiegati`);
      if (i === 0) await p.screenshot({ path: `${OUT}/guida-1.png` });
      if (i < 2) { await p.click('[data-next]'); await w(400); }
    }
    vero(titoli.join('|') === 'Dove giocare|La tua squadra|I giocatori', `i tre passi sono: ${titoli.join(', ')}`);
    const testo = await p.evaluate(() => document.querySelector('.guida').textContent);
    vero(/Negozio/.test(testo) && /asta/.test(testo), 'il terzo passo non spiega negozio e asta');
    await p.screenshot({ path: `${OUT}/guida-3.png` });
    vero(await p.$('[data-fine="crea"]') && await p.$('[data-fine="pubblica"]'), "all'ultimo passo mancano i due pulsanti");
    await p.click('[data-fine="crea"]'); await w(700);
    vero((await p.evaluate(() => location.hash)) === '#/leghe', '«Crea una lega» non porta alle leghe');
    vero(await p.$('#lname'), '«Crea una lega» non apre il modulo di creazione');
    await p.reload({ waitUntil: 'load' }); await w(1200);
    vero((await p.evaluate(() => location.hash)) !== '#/guida', 'la guida ricompare dopo essere stata vista');
    // 2. si rivede dalle impostazioni, e «Salta» riporta alle leghe
    await p.evaluate(() => { location.hash = '#/impostazioni'; }); await w(700);
    const riga = await p.$('[data-act="guida"]');
    vero(riga, 'nelle impostazioni manca «Come si gioca»');
    if (riga) {
      await riga.click(); await w(600);
      vero((await p.evaluate(() => location.hash)) === '#/guida', '«Come si gioca» non apre la guida');
      await p.click('[data-fine="leghe"]'); await w(600);
      vero((await p.evaluate(() => location.hash)) === '#/leghe', '«Salta» senza lega non porta alle leghe');
    }
    if (err.length) ko.push('errori: ' + err.join(' | '));
    await ctx.close();
  }

  // 2b. su un telefono basso (iPhone SE) il pulsante finale si raggiunge:
  // la presentazione non scorre, e la guida la prima volta lo lasciava fuori
  {
    const { ctx, p, w } = await nuovo();
    await p.setViewportSize({ width: 375, height: 667 });
    await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1200);
    await iscriviti(p, w);
    await p.click('[data-next]'); await w(300); await p.click('[data-next]'); await w(400);
    const cta = await p.$('[data-fine="crea"]');
    if (cta) {
      await cta.scrollIntoViewIfNeeded(); await w(200);
      const bb = await cta.boundingBox();
      const dentro = bb && bb.y + bb.height <= 667 && await p.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('[data-fine="crea"]'), { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 });
      vero(dentro, 'iPhone SE: il pulsante «Crea una lega» resta fuori dallo schermo');
    } else ko.push('iPhone SE: manca il pulsante finale');
    await ctx.close();
  }

  // 3. chi arriva da un invito non vede la guida: il codice lo aspetta
  {
    const { ctx, p, err, w } = await nuovo();
    await p.goto(`${BASE}/?invito=ABC123#/`, { waitUntil: 'load' }); await w(1200);
    await iscriviti(p, w);
    vero((await p.evaluate(() => location.hash)) === '#/leghe', `con un invito si arriva su ${await p.evaluate(() => location.hash)}, non sulle leghe`);
    if (err.length) ko.push('errori (invito): ' + err.join(' | '));
    await ctx.close();
  }

  console.log(ko.length ? ko.join('\n') : 'nessun problema');
  await b.close();
  process.exit(ko.length ? 1 : 0);
})();
