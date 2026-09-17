/**
 * Il tasto "Calcola la giornata": lo vedono tutti, ma resta spento finche'
 * manca all'appello anche una sola partita.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: 393, height: 793 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    localStorage.setItem('fcs:auth', 'supabase');
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, theme: 'dark' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  // La giornata corrente nei dati di prova e' la 4a, che non e' ancora stata
  // giocata: lo stato "da chiudere" non si raggiunge. Si sposta l'orologio a
  // dopo il suo lock, cosi' la giornata risulta finita e il tasto deve comparire.
  await ctx.clock.install({ time: new Date('2026-09-20T12:00:00Z') });
  const p = await ctx.newPage(); p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const w = (ms = 450) => p.waitForTimeout(ms);
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  // Servono DUE squadre: con una sola non c'e' la sfida, quindi la card della
  // giornata corrente non si disegna e il tasto non avrebbe dove stare.
  await p.click('[data-tab="up"]'); await w(250);
  await p.fill('#email', 'a@e.it'); await p.fill('#name', 'Conti25'); await p.fill('#password', 'password123');
  await p.click('#primary'); await w(1000);
  await p.click('[data-form="create"]'); await w(250);
  await p.fill('#lname', 'Torneo Titano'); await p.fill('#team', 'Hasta El Roxy'); await p.click('#go-create'); await w(1400);
  const code = await p.evaluate(() => document.body.innerText.match(/[Cc]odice(?: invito)?\s*([A-Z0-9]{6})/)?.[1]);
  await p.evaluate(() => { location.hash = '#/impostazioni'; }); await w(500); await p.click('[data-act="logout"]'); await w(900);
  await p.click('[data-tab="up"]'); await w(250);
  await p.fill('#email', 'b@e.it'); await p.fill('#name', 'Pelli'); await p.fill('#password', 'password123');
  await p.click('#primary'); await w(1000);
  await p.click('[data-form="join"]'); await w(250);
  await p.fill('#code', code); await p.fill('#team', 'Joga Benito FC'); await p.click('#go-join'); await w(1200);
  await p.evaluate(() => { location.hash = '#/impostazioni'; }); await w(500); await p.click('[data-act="logout"]'); await w(900);
  await p.waitForSelector('#password');
  await p.fill('#email', 'a@e.it'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1300);
  await p.evaluate(() => { location.hash = '#/lega'; }); await w(600);
  await p.evaluate(() => document.querySelector('#draft')?.click()); await w(1500);
  await p.evaluate(() => { location.hash = '#/impostazioni/avanzate'; }); await w(800);
  const seme = await p.evaluate(() => { const x = document.querySelector('[data-act="seed"]'); if (!x) return false; x.click(); return true; });
  if (!seme) throw new Error('bottone del seme sparito: la prova girerebbe a vuoto');
  await w(1600);
  // Il seme congela le giornate concluse, quindi lo stato "da chiudere" non si
  // raggiunge da solo: si riapre dalla pagina del Giudice, che e' la via vera.
  await p.evaluate(() => { location.hash = '#/admin/congela'; }); await w(900);
  const riaperta = await p.evaluate(() => { const x = document.querySelector('#reopen'); if (!x) return false; x.click(); return true; });
  await w(1200);
  await p.evaluate(() => { location.hash = '#/'; }); await w(1400);

  console.log('  CTA in home:', await p.evaluate(() => {
    const a = document.querySelector('.mact .a-btn'); const s = document.querySelector('.a-hero, .mcard');
    return JSON.stringify({ cta: a ? a.innerText.trim() : null, sezione: document.body.innerText.match(/Giornata corrente[\s\S]{0,40}/)?.[0] });
  }));
  const stato = await p.evaluate(() => {
    const btn = document.querySelector('#chiudi-giornata');
    return { c: !!btn, spento: btn ? btn.disabled : null, testo: btn ? btn.innerText.trim() : null,
      nota: [...document.querySelectorAll('.mnota')].map(x => x.innerText).join(' | ') };
  });
  console.log('  riaperta:', riaperta, '· stato:', JSON.stringify(stato));
  et(riaperta, 'la giornata si riapre dalla pagina del Giudice');
  et(stato.c, "il tasto \"Calcola la giornata\" compare in home");
  et(/calcola la giornata/i.test(stato.testo || ''), `dice "${stato.testo}"`);
  et(/partite|eventi/i.test(stato.nota), `e la nota spiega lo stato: "${stato.nota}"`);
  if (stato.c && !stato.spento) {
    await p.click('#chiudi-giornata'); await w(1400);
    const dopo = await p.evaluate(() => ({ btn: !!document.querySelector('#chiudi-giornata'),
      voti: !!document.querySelector('a.a-btn.big[href^="#/voti"]') }));
    et(!dopo.btn && dopo.voti, 'premuto: la giornata si chiude e il tasto torna "Voti della giornata"');
  }
  et(errs.length === 0, `nessun errore JS${errs.length ? ': ' + errs[0] : ''}`);
  await b.close();
  console.log('PASSATI (' + ok.length + ')'); ok.forEach(s => console.log('  ok  ' + s));
  console.log(ko.length ? '\nFALLITI (' + ko.length + ')' : '\nnessun problema'); ko.forEach(s => console.log('  KO  ' + s));
  process.exit(ko.length ? 1 : 0);
})();
