/**
 * «Chi è?», il giocatore del giorno: una partita intera dal telefono.
 *
 * Il 29 ottobre, a lega appena creata: si apre #/gioco, si cerca un nome,
 * si sceglie dai suggerimenti, gli indizi escono colorati; poi il giocatore
 * giusto, la rivelazione, il risultato da condividere senza il nome. Si
 * riapre la pagina e la partita e' ancora li', finita.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const USCITA = process.env.USCITA || '/tmp';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    localStorage.setItem('fcs:auth', 'supabase');
    if (!localStorage.getItem('fcs:prefs')) localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'dark' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
    const V = Date; const sc = new V('2026-10-29T10:00:00Z').getTime() - V.now();
    class F extends V { constructor(...a) { if (!a.length) super(V.now() + sc); else super(...a); } static now() { return V.now() + sc; } }
    window.Date = F;
    window.__condiviso = null;
    Object.defineProperty(navigator, 'share', { value: async (d) => { window.__condiviso = d.text; }, configurable: true });
  });
  const p = await ctx.newPage(); p.on('dialog', (d) => d.accept());
  const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  const w = (ms = 450) => p.waitForTimeout(ms);
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await w(250);
  await p.fill('#email', 'a@e.it'); await p.fill('#name', 'Alex'); await p.fill('#password', 'password123');
  await p.click('#primary'); await w(1000);
  await p.click('[data-form="create"]'); await w(250);
  await p.fill('#lname', 'Lega Titano'); await p.fill('#team', 'Real Titano'); await p.click('#go-create'); await w(1300);

  await p.evaluate(() => { location.hash = '#/gioco'; }); await w(900);
  const m = await p.evaluate(async () => {
    const G = await import('/src/gioco.js'); const S = await import('/src/state.js');
    const mi = G.misteroDel(G.oggi(S.now()), S.base.players, G.statistiche(S.base));
    const altri = S.base.players.filter((x) => x.isActive && !x.doppioneDi && x.id !== mi.id && x.clubId !== mi.clubId).slice(0, 2);
    return { id: mi.id, nome: mi.lastName, altri: altri.map((x) => ({ id: x.id, nome: x.lastName })) };
  });
  et(await p.locator('.ce-sagoma').count() === 1, 'all\'inizio il giocatore e\' coperto');
  et((await p.textContent('.ce-num b')).trim() === '#3', `il 29/10 e\' il #3 (${(await p.textContent('.ce-num b')).trim()})`);
  await p.screenshot({ path: `${USCITA}/gioco-1-inizio.png` });

  // due tentativi sbagliati, scritti e scelti dai suggerimenti
  for (const x of m.altri) {
    await p.fill('#ce-q', x.nome.slice(0, 4)); await w(250);
    await p.click(`[data-pick="${x.id}"]`); await w(400);
  }
  const righe = await p.locator('.ce-riga:not(.ce-intesta)').count();
  et(righe === 2, `due tentativi, due righe (${righe})`);
  et(await p.locator('.ce-riga:not(.ce-intesta) .ce-c').count() === 12, 'sei indizi per riga');
  et((await p.textContent('.ce-conti')).includes('2/6'), 'due tentativi su sei');
  await p.fill('#ce-q', m.nome.slice(0, 3)); await w(300);
  await p.screenshot({ path: `${USCITA}/gioco-2-tentativi.png` });

  // il giocatore giusto
  await p.fill('#ce-q', m.nome); await w(300);
  await p.click(`[data-pick="${m.id}"]`); await w(500);
  et(await p.locator('.ce-rivela').count() === 1, 'indovinato: il giocatore si vede');
  et((await p.textContent('.ce-rivela')).includes('Indovinato in 3'), 'e dice in quanti tentativi');
  et(await p.locator('#ce-q').count() === 0, 'a partita finita non si cerca piu\'');
  et((await p.textContent('.ce-conti')).includes('3/6') && (await p.textContent('.ce-conti')).includes('1'), 'tre su sei, serie di 1');
  await p.screenshot({ path: `${USCITA}/gioco-3-vinto.png` });

  await p.click('#ce-condividi'); await w(300);
  const testo = await p.evaluate(() => window.__condiviso);
  et(/^Chi è\? #3 · 3\/6/.test(testo || ''), `condivisione: ${JSON.stringify(testo)}`);
  et(testo && !testo.includes(m.nome), 'la condivisione non dice il nome');

  // riaperta, la partita e' ancora quella
  await p.reload({ waitUntil: 'load' }); await w(1200);
  await p.evaluate(() => { location.hash = '#/gioco'; }); await w(800);
  et(await p.locator('.ce-rivela').count() === 1, 'riaperta: la partita di oggi e\' gia\' finita');
  et(errori.length === 0, `nessun errore JS ${errori.join(' | ')}`);

  for (const t of ok) console.log('  ok ', t);
  for (const t of ko) console.log('  KO ', t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  await b.close(); process.exit(ko.length ? 1 : 0);
})();
