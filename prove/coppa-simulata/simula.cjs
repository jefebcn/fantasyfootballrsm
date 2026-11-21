// Simulazione della Coppa Titano futsal con 100 squadre (21/11): node prove/coppa-simulata/genera.mjs && node prove/coppa-simulata/simula.cjs
// Le giornate dopo l'ultima giocata ripetono i referti veri; screenshot in $OUT (default /tmp/coppa-simulata).
require('../strumenti/servi-da-disco.cjs');
const fs = require('fs');
const { chromium } = require('playwright');
const OUT = process.env.OUT || '/tmp/coppa-simulata';
const SQ = JSON.parse(fs.readFileSync(OUT + '/squadre.json', 'utf8'));
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const giro = async (fino, ora, scatti, copia = 17) => {
    const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block', locale: 'it-IT', timezoneId: 'Europe/Rome' });
    await ctx.route(/\/src\/futsal-dati\.js$/, (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(`${OUT}/dati-${fino}.js`) }));
    await ctx.clock.setFixedTime(new Date(ora));
    await ctx.addInitScript(() => { window.__SUPABASE_JS__ = '/tests/mock-supabase.js'; window.__PROVA_FUTSAL__ = true; localStorage.setItem('fcs:futsal', '1'); localStorage.setItem('fcs:futsal:visto', '1'); if (!localStorage.getItem('fcs:mock')) { localStorage.setItem('fcs:auth', 'supabase'); localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'light' })); localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' })); } });
    const p = await ctx.newPage(); p.on('dialog', (d) => d.accept()); const err = []; p.on('pageerror', (e) => err.push(e.message)); const w = (ms) => p.waitForTimeout(ms);
    await p.goto('https://app.local/#/', { waitUntil: 'load' }); await w(1300);
    await p.click('[data-tab="up"]'); await p.fill('#email', `a${fino}@e.it`); await p.fill('#name', 'Alex'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1300);
    await p.evaluate(([sq, copia]) => {
      const m = JSON.parse(localStorage.getItem('fcs:mock')); const me = m.userId; const quando = '2026-11-25T10:00:00.000Z';
      const tutte = [...sq, { ...sq[copia], formazione: { ...sq[copia].formazione, capitano: sq[copia].formazione.vice, vice: sq[copia].formazione.capitano }, user_id: me, squadra: 'Titani Futsal', colore: '#6A4C93', iniziali: 'TF' }];
      m.tables.futsal_iscritti = tutte.map((s, i) => ({ id: `i${i}`, created_at: quando, user_id: s.user_id, squadra: s.squadra, colore: s.colore, iniziali: s.iniziali, club_cuore: s.club_cuore }));
      m.tables.futsal_formazioni = tutte.map((s) => ({ user_id: s.user_id, giornata: 13, formazione: s.formazione, consegnata_at: quando }));
      localStorage.setItem('fcs:mock', JSON.stringify(m));
    }, [SQ, copia]);
    await p.evaluate(() => { location.hash = '#/futsal/coppa'; }); await p.reload({ waitUntil: 'load' }); await w(4000);
    await scatti(p, w);
    console.log(fino, 'errori:', err);
    await ctx.close();
  };
  const sezione = async (p, testo, nome) => {
    const ok = await p.evaluate((t) => { const s = [...document.querySelectorAll('.a-sec')].find((x) => x.textContent.includes(t)); if (!s) return false; s.scrollIntoView({block:'start'}); return true; }, testo);
    await p.waitForTimeout(400); if (ok) await p.screenshot({ path: `${OUT}/${nome}.png` }); else console.log('manca', testo);
  };
  const giu = async (p, px, nome) => { await p.evaluate((y) => { document.querySelector('main').scrollIntoView(); (document.scrollingElement).scrollBy(0, y); const m = document.querySelector('.a-main, main')?.parentElement; if (m) m.scrollBy(0, y); }, px); await p.waitForTimeout(400); await p.screenshot({ path: `${OUT}/${nome}.png` }); };
  await giro(15, '2026-12-26T12:00:00+01:00', async (p) => {
    await p.screenshot({ path: `${OUT}/n1-preliminari-in-corso.png` });
    await sezione(p, 'Girone A', 'n2-preliminari-girone');
    await p.click('[data-tutti]').catch(() => {}); await p.waitForTimeout(600);
    const n = await p.evaluate(() => document.querySelectorAll('.fs-classifica .vr').length); console.log('righe dopo mostra tutte', n);
  });
  await giro(20, '2027-01-29T12:00:00+01:00', async (p) => {
    await p.screenshot({ path: `${OUT}/n3-gironi-in-corso.png` });
    await sezione(p, 'Gironi', 'n4-gironi-sfide');
  }, 70);
  await giro(26, '2027-03-12T12:00:00+01:00', async (p) => {
    await p.screenshot({ path: `${OUT}/n5-quarti.png` });
  }, 70);
  await giro(30, '2027-04-20T12:00:00+02:00', async (p, w) => {
    await p.screenshot({ path: `${OUT}/n6-campione.png` });
    await sezione(p, 'Semifinali', 'n7-semi-finale');
    await p.evaluate(() => { location.hash = '#/futsal'; }); await w(1500);
    await p.screenshot({ path: `${OUT}/n8-home-fine.png` });
  });
  await b.close();
})();
