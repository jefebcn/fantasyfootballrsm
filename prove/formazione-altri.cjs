/**
 * Nella lega pubblica si vede la formazione degli altri (Alex, 11/10: «così
 * per vedere un amico cosa abbia messo»).
 *
 * In una lega a punti non ci sono partite, e la partita (#/live) era l'unico
 * posto dove si vedeva la formazione di un altro. Qui: la riga della
 * classifica si tocca e porta a #/formazione/:id, che mostra l'undici con i
 * voti della giornata gia' chiusa; quella in arrivo resta segreta fino al
 * lock, e la schermata lo dice.
 *
 * Il giorno e' l'11 ottobre: la 5ª si sta giocando (lock passato), la 6ª e'
 * aperta. Le giornate dopo la 5ª si tolgono dai dati, come in voti-spiegati.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const USCITA = process.env.USCITA || '/tmp';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    localStorage.setItem('fcs:auth', 'supabase');
    if (!localStorage.getItem('fcs:prefs')) localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'light' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
    const V = Date; const sc = new V('2026-10-11T12:00:00Z').getTime() - V.now();
    class F extends V { constructor(...a) { if (!a.length) super(V.now() + sc); else super(...a); } static now() { return V.now() + sc; } }
    window.Date = F;
  });
  const p = await ctx.newPage(); p.on('dialog', (d) => d.accept());
  const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  await p.route('**/calendario-dati.js', async (route) => { const r = await route.fetch(); let t = await r.text();
    t = t.replace(/\[(\d+),("[a-z0-9]+","[a-z0-9]+"[^\n]*?),(?:null|\d+),(?:null|\d+)\]/g, (x, n, resto) => (+n > 5 ? `[${n},${resto},null,null]` : x));
    await route.fulfill({ body: t, headers: { 'content-type': 'text/javascript' } }); });
  await p.route('**/eventi-dati.js', async (route) => { const r = await route.fetch();
    const t = (await r.text()).split('\n').filter((riga) => { const d = /^\s*\{g:(\d+),/.exec(riga); return !(d && +d[1] > 5); }).join('\n');
    await route.fulfill({ body: t, headers: { 'content-type': 'text/javascript' } }); });
  const w = (ms = 500) => p.waitForTimeout(ms);

  // la lega pubblica, aperta da chi amministra l'app (come in lega-pubblica.cjs)
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await p.fill('#email', 'uno@e.it'); await p.fill('#name', 'Uno'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1000);
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    s.tables.profiles.find((x) => x.id === s.userId).is_admin = true;
    localStorage.setItem('fcs:mock', JSON.stringify(s));
  });
  await p.reload({ waitUntil: 'load' }); await w(1500);
  await p.click('[data-form="pubblica"]'); await w(400);
  await p.fill('#pname', 'Titano Open'); await p.fill('#team', 'Squadra Uno'); await p.click('#go-pubblica'); await w(1500);

  // un amico, entrato prima della 5ª, con la sua formazione della 5ª consegnata
  await p.evaluate(async () => {
    const S = await import('/src/state.js');
    const tutti = [...S.playersById.values()].filter((x) => x.isActive !== false);
    const di = (r, k) => tutti.filter((x) => x.role === r).slice(0, k).map((x) => x.id);
    const titolari = [...di('P', 1), ...di('D', 4), ...di('C', 4), ...di('A', 2)];
    const panchina = [...tutti.filter((x) => x.role === 'P').slice(1, 2), ...tutti.filter((x) => x.role === 'D').slice(4, 6),
      ...tutti.filter((x) => x.role === 'C').slice(4, 6), ...tutti.filter((x) => x.role === 'A').slice(2, 4)].map((x) => x.id);
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    const lega = s.tables.leagues[0];
    lega.created_at = '2026-10-01T10:00:00Z';   // nata prima della 5ª: la 5ª e' sua
    for (const m of s.tables.league_members) m.created_at = '2026-10-01T10:00:00Z';
    s.tables.profiles.push({ id: 'user_amico', display_name: 'Bea' });
    s.tables.league_members.push({ id: 'm-amico', league_id: lega.id, user_id: 'user_amico', role: 'fantallenatore', team_name: 'Amici FC',
      owner_name: 'Bea', color: '#27ae60', initials: 'AF', credits: 500, created_at: '2026-10-01T10:00:00Z' });
    s.tables.lineups = s.tables.lineups || [];
    s.tables.lineups.push({ league_id: lega.id, member_id: 'm-amico', matchday: 5, submitted_at: '2026-10-09T10:00:00Z',
      lineup: { formation: '4-4-2', starters: titolari, bench: panchina, captainId: titolari[10], viceCaptainId: titolari[9] } });
    localStorage.setItem('fcs:mock', JSON.stringify(s));
  });
  await p.reload({ waitUntil: 'load' }); await w(1500);

  await p.evaluate(() => { location.hash = '#/classifica'; }); await p.waitForSelector('.cls a.crow', { timeout: 8000 });
  const righe = await p.evaluate(() => [...document.querySelectorAll('.cls a.crow')].map((a) => a.getAttribute('href')));
  et(righe.length === 2 && righe.every((h) => /^#\/formazione\//.test(h)), `in classifica ogni squadra si tocca (${righe.join(', ')})`);

  await p.click('.cls a.crow[href="#/formazione/m-amico"]'); await p.waitForSelector('.fd-testa', { timeout: 8000 }); await w(400);
  const amico = await p.evaluate(() => ({
    hash: location.hash, testo: document.querySelector('main')?.innerText || '',
    inCampo: document.querySelectorAll('.fd-campo .ps').length, panchina: document.querySelectorAll('.bench2 .b2').length,
    tot: document.querySelector('.fd-tot b')?.innerText || '',
  }));
  et(amico.hash === '#/formazione/m-amico', 'la riga porta alla sua formazione');
  et(/Amici FC/.test(amico.testo) && /Giornata 5/.test(amico.testo), 'la schermata dice di chi è e quale giornata');
  et(amico.inCampo === 11, `in campo i suoi 11 (${amico.inCampo})`);
  et(amico.panchina === 7, `e i 7 in panchina (${amico.panchina})`);
  et(/^\d+([,.]\d+)?$/.test(amico.tot), `con i fantapunti della giornata (${amico.tot})`);
  et(/4-4-2/.test(amico.testo), 'e il modulo');
  et(/6ª si vede da/.test(amico.testo) && /nessuno copia/.test(amico.testo), 'quella della 6ª resta segreta fino al lock, e lo dice');
  await p.screenshot({ path: `${USCITA}/formazione-altri.png`, fullPage: true });

  // la propria riga: niente consegnata alla 5ª, e lo dice senza rompersi
  await p.evaluate(() => { location.hash = '#/classifica'; }); await p.waitForSelector('.cls a.crow.io', { timeout: 8000 });
  await p.click('.cls a.crow.io'); await p.waitForSelector('.fd-testa', { timeout: 8000 }); await w(300);
  const mia = await p.evaluate(() => document.querySelector('main')?.innerText || '');
  et(/la tua/i.test(mia) && /Nessuna formazione consegnata per la 5ª/.test(mia), 'la propria, se non consegnata, lo dice');

  // una squadra che non c'e'
  await p.evaluate(() => { location.hash = '#/formazione/nessuno'; }); await w(600);
  et(/Squadra non trovata/.test(await p.evaluate(() => document.querySelector('main')?.innerText || '')), 'una squadra che non esiste non rompe niente');

  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
  await b.close();
  ok.forEach((t) => console.log('  ok  ' + t)); ko.forEach((t) => console.log('  KO  ' + t));
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
