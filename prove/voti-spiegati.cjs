/**
 * ROSA E FORMAZIONE: LE SCHEDE, E DA DOVE VENGONO I VOTI.
 *
 * Alex, 10/10, guardando la sua formazione della 5ª:
 *  - «Rosa 25» e «Formazione» erano due chip piccole come i filtri: non si
 *    capiva che erano le due schede della stessa pagina;
 *  - Bonetti in campo aveva 18,5 e da nessuna parte c'era scritto perche'.
 *
 * Qui si guarda che:
 *  - le schede siano una barra a tutta larghezza, con quella attiva segnata;
 *  - sotto la panchina ci sia «Da dove vengono i voti», dal piu' alto, col
 *    primo gia' aperto;
 *  - in ogni dettaglio le voci sommino al fantavoto mostrato (capitano
 *    compreso: il suo raddoppio e' una voce a parte, se no il conto non torna).
 *
 * La giornata e' la 5ª vera (referti FSGC importati), vista il 10 ottobre:
 * le giornate dopo si tolgono, cosi' la prova non cambia quando il campionato
 * va avanti.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const USCITA = process.env.USCITA || '/tmp';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

const conMock = (ctx, { iso, stato = null }) => ctx.addInitScript(({ iso, stato }) => {
  window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
  localStorage.setItem('fcs:auth', 'supabase');
  localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'light' }));
  localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  if (stato && !sessionStorage.getItem('s')) { localStorage.setItem('fcs:mock', JSON.stringify(stato)); sessionStorage.setItem('s', '1'); }
  const V = Date; const sc = new V(iso).getTime() - V.now();
  class F extends V { constructor(...a) { if (!a.length) super(V.now() + sc); else super(...a); } static now() { return V.now() + sc; } }
  window.Date = F;
}, { iso, stato });
// Le giornate dopo `fino` non si sono ancora giocate: risultati ed eventi via.
const soloFino = async (p, fino) => {
  await p.route('**/calendario-dati.js', async (route) => { const r = await route.fetch(); let t = await r.text();
    t = t.replace(/\[(\d+),("[a-z0-9]+","[a-z0-9]+"[^\n]*?),(?:null|\d+),(?:null|\d+)\]/g, (x, n, resto) => (+n > fino ? `[${n},${resto},null,null]` : x));
    await route.fulfill({ body: t, headers: { 'content-type': 'text/javascript' } }); });
  await p.route('**/eventi-dati.js', async (route) => { const r = await route.fetch();
    const t = (await r.text()).split('\n').filter((riga) => { const d = /^\s*\{g:(\d+),/.exec(riga); return !(d && +d[1] > fino); }).join('\n');
    await route.fulfill({ body: t, headers: { 'content-type': 'text/javascript' } }); });
};
const num = (s) => Number(String(s).replace('+', '').replace('−', '-').replace(',', '.'));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const vp = { viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' };
  const errori = [];

  // ---- prima del lock della 5ª: lega, rose, formazione consegnata
  let ctx = await b.newContext(vp); await conMock(ctx, { iso: '2026-10-08T08:00:00Z' });
  let p = await ctx.newPage(); p.on('dialog', (d) => d.accept()); p.on('pageerror', (e) => errori.push(e.message));
  await soloFino(p, 4);
  const w = (ms = 600) => p.waitForTimeout(ms);
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await p.fill('#email', 'a@e.it'); await p.fill('#name', 'Alex'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1000);
  await p.click('[data-form="create"]'); await p.fill('#lname', 'Titano Open'); await p.fill('#team', 'Hasta El Roxy'); await p.click('#go-create'); await w(1400);
  await p.evaluate(() => { location.hash = '#/lega'; }); await w(900);
  await p.click('#draft'); await w(1500);
  await p.evaluate(() => { location.hash = '#/rosa'; }); await w(1000);
  const schede = await p.evaluate(() => [...document.querySelectorAll('.seg-rosa a')].map((a) => ({ t: a.innerText.replace(/\s+/g, ' ').trim(), on: a.classList.contains('on'), h: a.getBoundingClientRect().height, w: a.getBoundingClientRect().width })));
  et(schede.length >= 2 && /Rosa/.test(schede[0].t) && /Formazione/.test(schede[1].t), `in Rosa ci sono le schede Rosa e Formazione (${schede.map((s) => s.t).join(' | ')})`);
  et(schede[0]?.on && !schede[1]?.on, 'e quella attiva è Rosa');
  et(schede.every((s) => s.h >= 44), `alte abbastanza per il pollice (${schede.map((s) => Math.round(s.h)).join(', ')} px)`);
  et(schede.length >= 2 && Math.abs(schede[0].w - schede[1].w) < 4, 'e larghe uguali, a tutta riga');
  await p.click('.seg-rosa a[href="#/rosa/formazione"]'); await w(1000);
  et(/formazione/.test(await p.evaluate(() => location.hash)) && await p.evaluate(() => document.querySelector('.seg-rosa a.on')?.innerText.includes('Formazione')), 'toccando Formazione si passa alla formazione, con la sua scheda accesa');
  await p.click('#confirm'); await w(1200);
  const stato = await p.evaluate(() => JSON.parse(localStorage.getItem('fcs:mock')));
  et((stato.tables.lineups || []).length === 1, 'la formazione della 5ª è consegnata');
  await ctx.close();

  // ---- il 10 ottobre, a 5ª in corso coi referti veri
  ctx = await b.newContext(vp); await conMock(ctx, { iso: '2026-10-10T16:00:00Z', stato });
  p = await ctx.newPage(); p.on('pageerror', (e) => errori.push(e.message));
  await soloFino(p, 5);
  await p.goto(`${BASE}/#/rosa/formazione`, { waitUntil: 'load' }); await p.waitForTimeout(2200);
  const sezione = await p.evaluate(() => {
    const box = document.querySelector('.voti-spiegati'); if (!box) return null;
    const dopoPanchina = !!document.querySelector('.bench') && (document.querySelector('.bench').compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING) > 0;
    const righe = [...box.querySelectorAll('.vr')].map((r) => ({ nome: r.querySelector('.nm b')?.innerText, fv: r.querySelector('.fv')?.innerText, cap: r.querySelector('.fv')?.classList.contains('cap') }));
    const dettagli = [...box.querySelectorAll('.vb')].map((vb) => ({ on: vb.classList.contains('on'),
      voci: [...vb.querySelectorAll(':scope > div:not(.tot)')].map((d) => [d.querySelector('span')?.innerText.split('\n')[0], d.lastElementChild?.innerText]),
      tot: vb.querySelector('.tot span:last-child')?.innerText }));
    return { dopoPanchina, righe, dettagli };
  });
  et(!!sezione, 'sotto la formazione c\'è «Da dove vengono i voti»');
  if (sezione) {
    et(sezione.dopoPanchina, 'ed è dopo la panchina');
    et(sezione.righe.length > 0, `con chi ha già il voto (${sezione.righe.length})`);
    const fv = sezione.righe.map((r) => num(r.fv));
    et(fv.every((x, i) => i === 0 || fv[i - 1] >= x), `dal voto più alto (${sezione.righe.map((r) => `${r.nome} ${r.fv}`).slice(0, 3).join(', ')}…)`);
    et(sezione.dettagli[0]?.on && sezione.dettagli.slice(1).every((d) => !d.on), 'il primo è già aperto, gli altri al tocco');
    const sballati = sezione.dettagli.filter((d) => { const somma = d.voci.reduce((s, [, v]) => s + num(v), 0); return Math.abs(somma - num(d.tot)) > 0.01; });
    et(sballati.length === 0, `in ogni dettaglio le voci fanno il fantavoto (${sballati.length ? JSON.stringify(sballati[0]) : 'tutti tornano'})`);
    sezione.righe.forEach((r, i) => { if (r.cap) et(sezione.dettagli[i].voci.some(([l]) => /Capitano/.test(l)) || num(r.fv) === num(sezione.dettagli[i].voci[0]?.[1]), `il capitano (${r.nome}) ha la voce del raddoppio`); });
    await p.evaluate(() => document.querySelector('.voti-spiegati').previousElementSibling.scrollIntoView({ block: 'start' }));
    await p.screenshot({ path: `${USCITA}/voti-spiegati.png` }).catch(() => {});
    // il tocco apre il secondo
    if (sezione.righe.length > 1) {
      await p.locator('.voti-spiegati .vr').nth(1).click(); await p.waitForTimeout(300);
      et(await p.evaluate(() => document.querySelectorAll('.voti-spiegati .vb')[1].classList.contains('on')), 'toccando il secondo si apre il suo dettaglio');
    }
  }
  // e il Calendario, a 5ª in corso, si apre sulla 5ª coi risultati di venerdì
  await p.goto(`${BASE}/#/calendario`, { waitUntil: 'load' }); await p.waitForTimeout(1500);
  const cal = await p.evaluate(() => ({ g: document.querySelector('#gsel .on')?.innerText.trim(), ris: [...document.querySelectorAll('.rr .sc')].filter((x) => /–/.test(x.innerText)).length }));
  et(/^G5/.test(cal.g || ''), `a 5ª in corso il Calendario si apre sulla 5ª, non sulla 6ª (${cal.g})`);
  et(cal.ris >= 3, `con i risultati già arrivati (${cal.ris})`);
  await ctx.close();
  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
  await b.close();
  for (const t of ok) console.log('  ok  ' + t);
  for (const t of ko) console.log('  KO  ' + t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
