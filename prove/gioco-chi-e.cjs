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

  // in Home, sotto la formazione: la carta del gioco, da giocare
  await p.evaluate(() => { location.hash = '#/'; }); await w(900);
  et(await p.locator('.ce-home').count() === 1, 'in Home c\'e\' la carta del gioco');
  et((await p.textContent('.ce-home')).includes('Gioca'), 'e invita a giocare');
  await p.locator('.ce-home').scrollIntoViewIfNeeded(); await w(200);
  await p.screenshot({ path: `${USCITA}/gioco-0-home.png` });
  await p.click('.ce-home'); await w(900);
  et(await p.locator('.ce-sagoma').count() === 1, 'la carta porta al gioco');
  // la prima volta si spiega perche' continuare a giocare
  et((await p.textContent('#sheet')).includes('Perché giocare ogni giorno'), 'la prima volta si apre la scheda «perché giocare»');
  await p.screenshot({ path: `${USCITA}/gioco-6-perche.png` });
  await p.click('[data-chiudi]'); await w(400);
  const m = await p.evaluate(async () => {
    const G = await import('/src/gioco.js'); const S = await import('/src/state.js');
    const mi = G.misteroDel(G.oggi(S.now()), S.base.players, G.statistiche(S.base));
    const altri = S.base.players.filter((x) => x.isActive && !x.doppioneDi && x.id !== mi.id && x.clubId !== mi.clubId).slice(0, 2);
    return { id: mi.id, nome: mi.lastName, altri: altri.map((x) => ({ id: x.id, nome: x.lastName })) };
  });
  et(await p.locator('.ce-sagoma').count() === 1, 'all\'inizio il giocatore e\' coperto');
  et((await p.textContent('.ce-num b')).trim().startsWith('#3'), `il 29/10 e\' il #3 (${(await p.textContent('.ce-num b')).trim()})`);
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

  // perche' continuare: punti, medaglie, classifica del mese
  await w(800);
  et((await p.textContent('.ce-stimolo')).includes('+4 punti'), `a fine partita i punti di oggi: ${await p.textContent('.ce-stimolo')}`);
  et(await p.locator('.ce-med').count() === 3, 'tre medaglie');
  const cl = await p.locator('.ce-classifica').textContent().catch(() => '');
  et(/Alex/.test(cl) && /4\s*pt/.test(cl), `in classifica con 4 punti: ${cl.replace(/\s+/g, ' ')}`);
  await p.locator('.ce-classifica').scrollIntoViewIfNeeded().catch(() => {}); await w(200);
  await p.screenshot({ path: `${USCITA}/gioco-7-classifica.png` });
  await p.click('[data-ambito="lega"]'); await w(900);
  const cll = await p.locator('.ce-classifica').textContent().catch(() => '');
  et(/Real Titano/.test(cll), `nella classifica della lega il nome della squadra: ${cll.replace(/\s+/g, ' ')}`);
  await p.click('[data-info]'); await w(300);
  et((await p.textContent('#sheet')).includes('Re del Titano'), 'il tasto ⓘ riapre la spiegazione');
  await p.click('[data-chiudi]'); await w(300);

  // in Home la carta dice com'e' andata
  await p.evaluate(() => { location.hash = '#/'; }); await w(900);
  et((await p.textContent('.ce-home')).includes('Indovinato in 3'), 'in Home: indovinato in 3');
  et(await p.locator('.ce-home.piccola[href="#/gioco"]').count() === 1, 'piccola, e porta al gioco');
  await p.locator('.ce-home').scrollIntoViewIfNeeded(); await w(200);
  await p.screenshot({ path: `${USCITA}/gioco-4-home-dopo.png` });

  // al database va solo com'e' andata, e in admin si conta
  const salvata = await p.evaluate(() => JSON.parse(localStorage.getItem('fcs:mock')).tables.gioco_partite || []);
  et(salvata.length === 1 && salvata[0].tentativi === 3 && salvata[0].vinto === true, `salvata nel database: ${JSON.stringify(salvata)}`);
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('fcs:mock')); s.tables.profiles.find((x) => x.id === s.userId).is_admin = true; localStorage.setItem('fcs:mock', JSON.stringify(s)); });
  await p.reload({ waitUntil: 'load' }); await w(1200);
  await p.evaluate(() => { location.hash = '#/admin/console'; }); await w(1800);
  const tab = await p.locator('.adm-gioco').textContent().catch(() => '');
  et(/Giocano/.test(tab) && /\b1\b/.test(tab) && /100%/.test(tab), `in admin la tabella: ${tab.replace(/\s+/g, ' ').slice(0, 120)}`);
  await p.locator('.adm-gioco').scrollIntoViewIfNeeded().catch(() => {}); await w(200);
  await p.screenshot({ path: `${USCITA}/gioco-5-admin.png` });

  // riaperta, la partita e' ancora quella
  await p.reload({ waitUntil: 'load' }); await w(1200);
  await p.evaluate(() => { location.hash = '#/gioco'; }); await w(800);
  et(await p.locator('.ce-rivela').count() === 1, 'riaperta: la partita di oggi e\' gia\' finita');
  // la Home, a partita finita: la carta scende e si fa piccola
  await p.evaluate(() => { location.hash = '#/'; }); await w(900);
  et(await p.locator('.ce-home.piccola').count() === 1 && await p.locator('.ce-home.nuovo').count() === 0, 'giocata: in Home la carta e\' piccola e non in cima');

  // persa: il nome si vede solo se lo si chiede
  await p.evaluate(async ({ mi, altri }) => {
    const G = await import('/src/gioco.js'); const S = await import('/src/state.js');
    const giorno = G.oggi(S.now());
    const sei = S.base.players.filter((x) => x.isActive && !x.doppioneDi && x.id !== mi).slice(0, 6).map((x) => x.id);
    const s = JSON.parse(localStorage.getItem('fcs:gioco') || '{}'); s[giorno] = { tentativi: sei, vinto: false };
    localStorage.setItem('fcs:gioco', JSON.stringify(s));
  }, { mi: m.id, altri: m.altri });
  await p.evaluate(() => { location.hash = '#/'; }); await w(300);
  await p.evaluate(() => { location.hash = '#/gioco'; }); await w(900);
  et(await p.locator('[data-rivela]').count() === 1 && !(await p.textContent('main')).includes(m.nome + '\n'), 'persa: il nome non c\'e\', c\'e\' «Rivela il giocatore»');
  et(!(await p.locator('.ce-perso').textContent()).includes(m.nome), 'e la carta non lo dice');
  await p.screenshot({ path: `${USCITA}/gioco-8-perso.png` });
  await p.click('[data-rivela]'); await w(400);
  et((await p.textContent('.ce-rivela')).includes(m.nome), 'toccato «Rivela»: ecco chi era');
  await p.evaluate(() => { location.hash = '#/'; }); await w(900);
  et((await p.textContent('.ce-home.piccola')).includes('Non indovinato') && !(await p.textContent('.ce-home.piccola')).includes(m.nome), 'in Home: non indovinato, senza nome');
  await p.locator('.ce-home.piccola').scrollIntoViewIfNeeded().catch(() => {}); await w(200);
  await p.screenshot({ path: `${USCITA}/gioco-9-home-piccola.png` });
  et(errori.length === 0, `nessun errore JS ${errori.join(' | ')}`);

  for (const t of ok) console.log('  ok ', t);
  for (const t of ko) console.log('  KO ', t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  await b.close(); process.exit(ko.length ? 1 : 0);
})();
