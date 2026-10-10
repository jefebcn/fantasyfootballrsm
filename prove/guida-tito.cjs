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

  // 1. dopo la registrazione: la guida, quattro passi nel browser (il quarto
  // e' la schermata Home), TITO che parla
  {
    const { ctx, p, err, w } = await nuovo();
    await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1200);
    await iscriviti(p, w);
    vero((await p.evaluate(() => location.hash)) === '#/guida', `dopo l'iscrizione si arriva su ${await p.evaluate(() => location.hash)}, non sulla guida`);
    const titoli = [];
    let terzo = '', lungo = 0;
    for (let i = 0; i < 4; i++) {
      await p.evaluate(() => document.fonts && document.fonts.ready);
      const s = await p.evaluate(() => {
        const img = document.querySelector('.guida-tito img');
        const f = document.querySelector('.guida-fumetto');
        return { titolo: document.querySelector('.guida h1')?.textContent, passo: document.querySelector('.guida-passo')?.textContent,
          tito: !!(img && img.complete && img.naturalWidth > 0), fumetto: f ? f.getBoundingClientRect().width : 0, punti: document.querySelectorAll('.guida .intro-points li').length };
      });
      titoli.push(s.titolo);
      vero(s.passo === `Passo ${i + 1} di 4`, `passo ${i + 1}: l'indicatore dice "${s.passo}"`);
      vero(s.tito, `passo ${i + 1}: l'immagine di TITO non si carica`);
      vero(s.fumetto > 150, `passo ${i + 1}: il fumetto di TITO e' largo ${Math.round(s.fumetto)}px`);
      vero(s.punti >= 2, `passo ${i + 1}: ${s.punti} punti spiegati`);
      if (i === 0) await p.screenshot({ path: `${OUT}/guida-1.png` });
      if (i === 2) {
        terzo = await p.evaluate(() => document.querySelector('.guida').textContent);
        lungo = await p.evaluate(() => [...document.querySelectorAll('.guida .intro-points li span')].reduce((n, x) => n + x.textContent.length, 0));
        await p.screenshot({ path: `${OUT}/guida-3.png` });
      }
      if (i < 3) { await p.click('[data-next]'); await w(400); }
    }
    vero(titoli.join('|') === 'Dove giocare|La tua squadra|I giocatori|Mettimi sulla Home', `i passi sono: ${titoli.join(', ')}`);
    vero(/Negozio/.test(terzo) && /asta/.test(terzo), 'il terzo passo non spiega negozio e asta');
    // il quarto: i tasti da toccare (qui il telefono e' un Android: i tre puntini e «Installa»)
    const quarto = await p.evaluate(() => document.querySelector('.guida').textContent);
    vero(/tre puntini/.test(quarto) && /schermata Home/.test(quarto) && /Installa/.test(quarto), 'il passo della Home non dice quali tasti toccare');
    await p.screenshot({ path: `${OUT}/guida-4.png` });
    vero(await p.$('[data-fine="crea"]') && await p.$('[data-fine="pubblica"]'), "all'ultimo passo mancano i due pulsanti");
    vero(await p.$('.intro-cta[data-fine="pubblica"]'), 'il pulsante giallo non e\' «Entra nella lega pubblica»');
    vero(lungo <= 200, `il terzo passo e' lungo ${lungo} caratteri: su un telefono piccolo non sta`);
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
    const tab = await p.evaluate(() => ({ n: document.querySelectorAll('.lgtab').length, on: document.querySelector('.lgtab.on')?.dataset.vista }));
    vero(tab.n === 3 && tab.on === 'private', `leghe: schede ${tab.n}, aperta «${tab.on}» (senza leghe pubbliche deve aprirsi Private)`);
    await p.click('[data-vista="admin"]'); await w(400);
    vero(await p.$('.vuoto-admin'), 'scheda Admin: a chi non amministra niente non lo dice');
    await p.click('[data-vista="private"]'); await w(400);
    // 2a. con una lega: Impostazioni e Come si gioca stanno in cima al menu.
    // Erano l'ultima riga, sotto due schermate di voci, e non si trovavano.
    await p.click('[data-form="create"]').catch(() => {}); await w(300);
    await p.fill('#lname', 'Lega Titano'); await p.fill('#team', 'Hasta El Chapo FC'); await p.click('#go-create'); await w(1500);
    await p.evaluate(() => { location.hash = '#/'; }); await w(1000);
    await p.click('[data-open-drawer]'); await w(600);
    for (const [href, nome] of [['#/impostazioni', 'Impostazioni'], ['#/guida', 'Come si gioca']]) {
      const bb = await p.evaluate((h) => { const a = document.querySelector(`.a-drawer a.d-item[href="${h}"]`); return a && a.getBoundingClientRect().bottom; }, href);
      vero(bb && bb <= 844, `menu: «${nome}» ${bb ? `sta a ${Math.round(bb)}px, sotto lo schermo` : 'non c\'e\''}`);
    }
    vero(await p.$('.a-drawer .d-esci-fondo[data-logout]'), 'menu: in fondo manca «Esci dall\'account»');
    await p.click('.a-drawer a.d-item[href="#/guida"]').catch(() => {}); await w(700);
    vero((await p.evaluate(() => location.hash)) === '#/guida', '«Come si gioca» dal menu non apre la guida');
    await p.click('[data-fine="leghe"]').catch(() => {}); await w(600);
    vero((await p.evaluate(() => location.hash)) === '#/impostazioni', '«Salta» con una lega non torna alle impostazioni');
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
    await p.click('[data-next]'); await w(300); await p.click('[data-next]'); await w(300); await p.click('[data-next]'); await w(400);
    const cta = await p.$('.intro-cta[data-fine="pubblica"]');
    if (cta) {
      await cta.scrollIntoViewIfNeeded(); await w(200);
      const bb = await cta.boundingBox();
      const dentro = bb && bb.y + bb.height <= 667 && await p.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('[data-fine="pubblica"]'), { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 });
      vero(dentro, 'iPhone SE: il pulsante «Entra nella lega pubblica» resta fuori dallo schermo');
    } else ko.push('iPhone SE: manca il pulsante finale');
    await ctx.close();
  }

  // 2c. «Entra nella lega pubblica»: se ce n'e' una sola aperta, il modulo
  // del nome squadra e' gia' aperto; se non ce n'e' nessuna, lo dice
  for (const conLega of [true, false]) {
    const { ctx, p, err, w } = await nuovo();
    await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1200);
    await iscriviti(p, w);
    if (conLega) await p.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('fcs:mock'));
      (s.tables.leagues ||= []).push({ id: 'pub1', name: 'Titano Open', short_name: 'TO', pubblica: true, classifica: 'punti', max_membri: 50,
        rules: { budget: 300 }, premi: [], invite_code: 'PUB001', created_at: new Date().toISOString() });
      localStorage.setItem('fcs:mock', JSON.stringify(s));
    });
    // il finto server legge le tabelle all'avvio
    if (conLega) { await p.reload({ waitUntil: 'load' }); await w(1200); }
    await p.click('[data-next]'); await w(300); await p.click('[data-next]'); await w(300); await p.click('[data-next]'); await w(400);
    await p.click('[data-fine="pubblica"]'); await w(1200);
    const r = await p.evaluate(() => {
      const img = document.querySelector('.pubcard .pc-tito img');
      return { hash: location.hash, entra: !!document.querySelector('#go-entra'), testo: document.body.textContent,
        tito: !!(img && img.complete && img.naturalWidth > 0), titolo: getComputedStyle(document.querySelector('.pc-nome') || document.body).fontStyle };
    });
    if (conLega) vero(await p.$('.lgtab.on[data-vista="pubbliche"]'), 'con una lega pubblica aperta la scheda «Pubbliche» non e\' quella scelta');
    if (conLega) vero(r.tito && r.titolo === 'italic', `la scheda della lega pubblica non ha TITO (${r.tito}) o il titolo in corsivo (${r.titolo})`);
    vero(r.hash === '#/leghe', `«Entra nella lega pubblica» porta su ${r.hash}`);
    if (conLega) vero(r.entra && /Titano Open/.test(r.testo), 'con una sola lega pubblica aperta il modulo per entrarci non e\' aperto');
    else vero(!r.entra && /non c'è una lega pubblica aperta/.test(r.testo), 'senza leghe pubbliche nessuno dice che non ce ne sono');
    if (err.length) ko.push(`errori (pubblica ${conLega}): ` + err.join(' | '));
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

  // 4. il passo della Home su iPhone: Condividi e «Aggiungi alla schermata
  // Home», da Safari; e chi ha gia' l'app sulla Home quel passo non lo vede
  for (const sullaHome of [false, true]) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
    await ctx.addInitScript((home) => {
      window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
      localStorage.setItem('fcs:auth', 'supabase');
      if (!localStorage.getItem('fcs:prefs')) localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, theme: 'system' }));
      localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
      if (home) Object.defineProperty(navigator, 'standalone', { get: () => true });
    }, sullaHome);
    const p = await ctx.newPage(); const err = []; p.on('pageerror', (e) => err.push(e.message));
    const w = (ms = 500) => p.waitForTimeout(ms);
    await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1200);
    await iscriviti(p, w);
    const quanti = await p.evaluate(() => document.querySelector('.guida-passo')?.textContent);
    if (sullaHome) vero(quanti === 'Passo 1 di 3', `app gia' sulla Home: la guida dice "${quanti}", il passo della Home doveva sparire`);
    else {
      vero(quanti === 'Passo 1 di 4', `iPhone nel browser: la guida dice "${quanti}"`);
      for (let i = 0; i < 3; i++) { await p.click('[data-next]'); await w(350); }
      const t = await p.evaluate(() => document.querySelector('.guida').textContent);
      vero(/Condividi/.test(t) && /Aggiungi alla schermata Home/.test(t) && /Safari/.test(t), 'iPhone: il passo della Home non dice Condividi → «Aggiungi alla schermata Home»');
      await p.screenshot({ path: `${OUT}/guida-4-iphone.png` });
    }
    if (err.length) ko.push('errori (iPhone): ' + err.join(' | '));
    await ctx.close();
  }

  console.log(ko.length ? ko.join('\n') : 'nessun problema');
  await b.close();
  process.exit(ko.length ? 1 : 0);
})();
