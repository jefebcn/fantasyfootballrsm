/**
 * La presentazione con i due giochi (src/views/onboarding.js, SLIDES_DUE):
 * prima del lancio del futsal (1/12 alle 8) restano le tre schermate del
 * calcio; dopo, quattro, con le schede Fantacalcio e FantaFutsal. Sempre con
 * lo sfondo animato sotto, e su un telefono basso (iPhone SE) niente esce
 * dallo schermo. Gli screenshot finiscono in $USCITA.
 */
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:4173';
const USCITA = process.env.USCITA || '/tmp';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

async function giro(b, data, vista, nome) {
  const ctx = await b.newContext({ viewport: vista, deviceScaleFactor: 1, isMobile: true, hasTouch: true, serviceWorkers: 'block', locale: 'it-IT', timezoneId: 'Europe/Rome' });
  await ctx.clock.setFixedTime(new Date(data));
  await ctx.addInitScript(() => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    localStorage.setItem('fcs:auth', 'supabase');
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  const p = await ctx.newPage(); const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await p.waitForTimeout(2500);
  const schermate = [];
  for (let i = 0; i < 6; i++) {
    await p.waitForTimeout(700);
    await p.screenshot({ path: path.join(USCITA, `intro-${nome}-${i + 1}.png`) });
    schermate.push(await p.evaluate(() => {
      const q = (s) => document.querySelector(s); const r = (s) => q(s)?.getBoundingClientRect();
      const giochi = [...document.querySelectorAll('.intro-giochi > li')];
      const pallone = q('.intro-giochi li.futsal > i .mi');
      return {
        pallini: document.querySelectorAll('.intro-dots i').length,
        canvas: !!q('#intro-fx') && r('#intro-fx').width > 0,
        giochi: giochi.map((li) => li.querySelector('b').textContent),
        pallone: pallone ? getComputedStyle(pallone).maskImage || getComputedStyle(pallone).webkitMaskImage : null,
        sopra: r('.intro-body') && r('.intro-foot') ? Math.round(r('.intro-body').bottom - r('.intro-foot').top) : 0,
        fuori: Math.round((r('.intro-foot')?.bottom || 0) - innerHeight),
        testo: q('.intro-body')?.innerText || '',
      };
    }));
    if (!(await p.$('[data-next]'))) break;
    await p.click('[data-next]');
  }
  await ctx.close();
  return { schermate, errori };
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const iphone = { width: 393, height: 852 }, se = { width: 375, height: 667 };

  const prima = await giro(b, '2026-11-30T18:00:00+01:00', iphone, 'prima');
  et(prima.schermate.length === 3 && prima.schermate[0].pallini === 3, `prima del lancio: le tre schermate di sempre (${prima.schermate.length})`);
  et(prima.schermate.every((s) => !s.giochi.length && !/futsal/i.test(s.testo)), 'prima del lancio: il futsal non si nomina');

  const dopo = await giro(b, '2026-12-01T08:05:00+01:00', iphone, 'dopo');
  et(dopo.schermate.length === 4 && dopo.schermate[0].pallini === 4, `dal lancio: quattro schermate (${dopo.schermate.length})`);
  et(/campionato a 11/.test(dopo.schermate[0].testo) && /futsal/.test(dopo.schermate[0].testo), 'la prima nomina tutti e due i giochi');
  et(dopo.schermate[1].giochi.join('|') === 'Fantacalcio|FantaFutsal', `la seconda ha le due schede (${dopo.schermate[1].giochi.join(', ')})`);
  et(/pallone\.svg/.test(dopo.schermate[1].pallone || ''), `la scheda del futsal ha il pallone (${dopo.schermate[1].pallone})`);
  et(dopo.schermate.every((s) => !/assist/i.test(s.testo)), 'niente assist: nei referti del futsal non ci sono');
  et(dopo.schermate.every((s) => s.canvas), 'lo sfondo animato c\'e\' in ogni schermata');

  for (const [nome, g] of [['iPhone', dopo], ['iPhone SE', await giro(b, '2026-12-02T10:00:00+01:00', se, 'se')]]) {
    const peggio = g.schermate.reduce((m, s) => Math.max(m, s.sopra, s.fuori), -999);
    et(peggio <= 1, `${nome}: testo e bottoni restano nello schermo, senza sovrapporsi (${peggio}px)`);
    et(g.errori.length === 0, `${nome}: nessun errore JS${g.errori.length ? ' — ' + g.errori[0] : ''}`);
  }
  et(prima.errori.length === 0, `prima del lancio: nessun errore JS${prima.errori.length ? ' — ' + prima.errori[0] : ''}`);

  await b.close();
  ok.forEach((x) => console.log('ok  ', x)); ko.forEach((x) => console.log('KO  ', x));
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
