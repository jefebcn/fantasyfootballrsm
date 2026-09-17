/**
 * Lo splash: il marchio intero, non tre pezzi.
 *
 * "Quella corona e la scritta sembrano separate": lo splash montava la
 * corona, il nome e il sottotitolo come tre elementi in colonna, con
 * distanze e pesi decisi dal CSS invece che dal marchio. Adesso e' il
 * marchio vero — corona, FANTATITANO e il motto in un pezzo solo.
 *
 * Qui lo splash si guarda per davvero: il finto Supabase arriva con quattro
 * secondi di ritardo, cosi' la schermata di caricamento resta in piedi il
 * tempo di misurarla. Senza quel ritardo passa in un lampo e la prova
 * diventerebbe una corsa contro il caricamento.
 *
 * LA MASCHERA DEVE ESSERE DENTRO IL CSS. E' la prima schermata: una richiesta
 * a parte vorrebbe dire un marchio che arriva dopo, e senza rete non
 * arriverebbe. Qui si controlla che sia un data URI e che non pesi piu' del
 * dovuto — sta su styles/logo.css, che si carica a ogni apertura.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);
const TETTO_CSS = 48 * 1024;   // oggi 35 kB: 16 di corona, 17 di marchio

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());

  // il peso del CSS che porta le maschere: si misura una volta, senza browser
  const risp = await fetch(`${BASE}/styles/logo.css`);
  const css = await risp.text();
  et(css.length <= TETTO_CSS, `styles/logo.css pesa ${Math.round(css.length / 1024)} kB (tetto ${TETTO_CSS / 1024})`);
  et(/data:image\/webp;base64/.test(css), 'il marchio e\' dentro il CSS, non una richiesta a parte');

  for (const [nome, vp, ridotto] of [
    ['telefono', { width: 390, height: 844 }, false],
    ['stretto', { width: 320, height: 568 }, false],
    ['motoridotto', { width: 390, height: 844 }, true],
  ]) {
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block',
      ...(ridotto ? { reducedMotion: 'reduce' } : {}) });
    await ctx.addInitScript(() => {
      window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
      localStorage.setItem('fcs:auth', 'supabase');
      localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, theme: 'dark' }));
      localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
    });
    await ctx.route('**/tests/mock-supabase.js', async (r) => { await new Promise((k) => setTimeout(k, 4000)); await r.continue(); });
    const p = await ctx.newPage();
    const errori = []; p.on('pageerror', (e) => errori.push(e.message));
    await p.goto(`${BASE}/#/`, { waitUntil: 'commit' });
    await p.waitForSelector('.splash', { timeout: 10000 });
    await p.waitForTimeout(600);

    const m = await p.evaluate(async () => {
      const e = document.querySelector('.splash .marchio');
      if (!e) return null;
      const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
      const sag = (cs.maskImage && cs.maskImage !== 'none' ? cs.maskImage : cs.webkitMaskImage) || '';
      const url = (sag.match(/url\("?([^")]+)"?\)/) || [])[1] || '';
      // le proporzioni vere della maschera: la scatola non le deve deformare
      let vera = null;
      if (url) {
        vera = await new Promise((k) => { const i = new Image(); i.onload = () => k({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => k(null); i.src = url; });
      }
      const bar = document.querySelector('.splash-bar')?.getBoundingClientRect() || null;
      return {
        w: +r.width.toFixed(1), h: +r.height.toFixed(1),
        dentro: r.left >= 0 && r.right <= innerWidth + 0.5,
        centrato: Math.abs((r.left + r.width / 2) - innerWidth / 2) < 1,
        sopraLaBarra: bar ? r.bottom < bar.top : null,
        barCentrata: bar ? Math.abs((bar.left + bar.width / 2) - innerWidth / 2) < 1 : null,
        bianco: cs.backgroundColor,
        dataUri: url.startsWith('data:'),
        vera, pezziSeparati: document.querySelectorAll('.splash b, .splash span').length,
      };
    });

    et(!!m, `${nome}: il marchio c'e' nello splash`);
    if (m) {
      et(m.w > 150 && m.h > 90, `${nome}: e si vede, ${m.w}x${m.h}`);
      et(m.dentro, `${nome}: sta dentro lo schermo`);
      et(m.centrato && m.barCentrata !== false, `${nome}: centrato, e la barra con lui`);
      et(m.sopraLaBarra === true, `${nome}: la barra del caricamento gli sta sotto`);
      et(m.dataUri, `${nome}: la maschera e' un data URI (niente richiesta, funziona offline)`);
      et(m.bianco === 'rgb(255, 255, 255)', `${nome}: bianco sul blu (${m.bianco})`);
      et(m.pezziSeparati === 0, `${nome}: niente piu' corona e scritte come pezzi separati (${m.pezziSeparati})`);
      // deformazione: il rapporto della scatola contro quello della maschera
      if (m.vera) {
        const scarto = Math.abs((m.w / m.h) - (m.vera.w / m.vera.h)) / (m.vera.w / m.vera.h) * 100;
        et(scarto < 1, `${nome}: non e' schiacciato (${scarto.toFixed(2)}% di scarto dalle proporzioni vere)`);
      } else {
        et(false, `${nome}: la maschera non si carica`);
      }
    }
    // LA BARRA DEL CARICAMENTO. E' una cometa: un segmento con la coda che
    // sfuma e un alone, quindi ha una direzione. Un blocchetto pieno che va
    // avanti e indietro non dice da dove arriva.
    const bar = await p.evaluate(() => {
      const t = document.querySelector('.splash-bar'), i = t?.querySelector('i');
      if (!t || !i) return null;
      const cs = getComputedStyle(i), ct = getComputedStyle(t);
      const rt = t.getBoundingClientRect(), ri = i.getBoundingClientRect();
      return {
        coda: /linear-gradient/.test(cs.backgroundImage),
        alone: cs.boxShadow !== 'none',
        pista: ct.backgroundColor,
        tonda: parseFloat(ct.borderRadius) >= 2,
        anim: i.getAnimations().map((a) => ({ n: a.animationName, s: a.playState })),
        // il segmento non deve uscire dalla pista: la taglia overflow:hidden
        dentro: ct.overflow === 'hidden',
        visibile: ri.width > 0 && ri.height > 0,
        largo: +(ri.width / rt.width * 100).toFixed(0),
      };
    });
    et(!!bar, `${nome}: la barra del caricamento c'e'`);
    if (bar) {
      et(bar.coda, `${nome}: il segmento ha la coda che sfuma (gradiente)`);
      et(bar.alone, `${nome}: e l'alone`);
      et(bar.dentro, `${nome}: che resta dentro la pista`);
      et(bar.largo >= 35 && bar.largo <= 60, `${nome}: il segmento occupa il ${bar.largo}% della pista`);
      if (ridotto) {
        // Chi ha chiesto meno movimento non deve vedere niente che scorra, ma
        // la barra deve restare: se sparisce, lo splash sembra piantato.
        et(bar.anim.length === 0, `${nome}: niente animazione (${bar.anim.map((a) => a.n).join(',') || 'nessuna'})`);
        et(bar.visibile, `${nome}: la barra resta visibile lo stesso`);
      } else {
        et(bar.anim.some((a) => a.s === 'running'), `${nome}: l'animazione gira (${bar.anim.map((a) => `${a.n}:${a.s}`).join(', ') || 'nessuna'})`);
      }
    }
    et(errori.length === 0, `${nome}: nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
    await ctx.close();
  }
  await b.close();
  for (const t of ok) console.log('  ok  ' + t);
  for (const t of ko) console.log('  KO  ' + t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
