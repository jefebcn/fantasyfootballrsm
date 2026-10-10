/**
 * LA CLASSIFICA DEL CAMPIONATO VERO, ANCHE A GIORNATA IN CORSO.
 *
 * Alex, 10/10: accanto alla classifica della lega, quella del Campionato
 * Sammarinese, aggiornata anche mentre la giornata si gioca.
 *
 * La prova ricalcola la classifica PER CONTO SUO, dal file dei risultati
 * (calendario-dati.js), e la confronta con quella sullo schermo: se lo
 * schermo e la prova facessero lo stesso conto con lo stesso codice, un
 * errore passerebbe in tutte e due. I dati sono fissati: la 5ª giornata ha
 * i risultati del venerdì e del sabato, quelli della domenica no — cosi' la
 * giornata e' «in corso» qualunque giorno giri la prova.
 */
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const BASE = process.env.BASE || 'http://localhost:4173';
const USCITA = process.env.USCITA || '/tmp';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

// le gare come le vede la prova: fino alla 5ª, e della 5ª solo fino a sabato
const RIGA = /\[(\d+),"([a-z0-9]+)","([a-z0-9]+)","([^"]+)"([^\n]*?),(null|\d+),(null|\d+)\]/g;
const tieni = (g, quando) => g < 5 || (g === 5 && quando < '2026-10-11');
function attesa() {
  const t = fs.readFileSync(path.join(__dirname, '../src/calendario-dati.js'), 'utf8');
  const pt = {}; let gare5 = 0, fatte5 = 0;
  for (const m of t.matchAll(RIGA)) {
    const [, g, casa, ospite, quando, , gc, go] = m; const n = +g;
    if (n === 5) { gare5++; if (gc !== 'null' && tieni(n, quando)) fatte5++; }
    if (gc === 'null' || go === 'null' || !tieni(n, quando)) continue;
    const a = +gc, b = +go;
    pt[casa] = (pt[casa] || 0) + (a > b ? 3 : a === b ? 1 : 0);
    pt[ospite] = (pt[ospite] || 0) + (b > a ? 3 : a === b ? 1 : 0);
  }
  return { pt, gare5, fatte5 };
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    localStorage.setItem('fcs:auth', 'supabase');
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'light' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  const p = await ctx.newPage(); const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  await p.route('**/calendario-dati.js', async (route) => {
    const r = await route.fetch(); const t = (await r.text()).replace(RIGA, (x, g, casa, ospite, quando, resto, gc, go) =>
      (tieni(+g, quando) ? x : `[${g},"${casa}","${ospite}","${quando}"${resto},null,null]`));
    await route.fulfill({ body: t, headers: { 'content-type': 'text/javascript' } });
  });
  const w = (ms = 600) => p.waitForTimeout(ms);
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await p.fill('#email', 'a@e.it'); await p.fill('#name', 'Alex'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1000);
  await p.click('[data-form="create"]'); await p.fill('#lname', 'Titano Open'); await p.fill('#team', 'Hasta El Roxy'); await p.click('#go-create'); await w(1400);
  await p.evaluate(() => { location.hash = '#/classifica'; }); await w(900);
  et(!!(await p.$('[data-vista="campionato"]')), 'in Classifica c\'è la scheda Campionato');
  await p.click('[data-vista="campionato"]'); await w(700);
  const vista = await p.evaluate(() => ({
    nota: document.querySelector('.warn.info')?.innerText || '',
    righe: [...document.querySelectorAll('.cls.camp .crow')].map((r) => ({ pos: +r.querySelector('.pos').innerText, nome: r.querySelector('.nm b').innerText, sigla: r.querySelector('.crest').innerText.trim(), pt: +r.querySelector('.pt b').innerText, forma: r.querySelectorAll('.fm').length })),
  }));
  const { pt, gare5, fatte5 } = attesa();
  const sigla = await p.evaluate(async () => { const S = await import('/src/state.js'); return Object.fromEntries(S.base.clubs.map((c) => [c.shortName, c.id])); });
  et(vista.righe.length === 16, `ci sono tutte e 16 le squadre (${vista.righe.length})`);
  const sbagliate = vista.righe.filter((r) => (pt[sigla[r.sigla]] || 0) !== r.pt);
  et(sbagliate.length === 0, `i punti tornano col conto fatto a parte (${sbagliate.length ? sbagliate.map((r) => `${r.nome} ${r.pt} invece di ${pt[sigla[r.sigla]] || 0}`).join(', ') : 'tutti'})`);
  et(vista.righe.every((r, i) => i === 0 || vista.righe[i - 1].pt >= r.pt), 'in ordine di punti');
  et(vista.righe.every((r) => r.forma <= 5), 'la forma è al massimo delle ultime cinque');
  et(new RegExp(`5ª giornata, ancora in corso: ${fatte5} partite giocate su ${gare5}`).test(vista.nota), `e dice che la 5ª è in corso, con quante partite giocate ("${vista.nota.replace(/\s+/g, ' ')}")`);
  await p.screenshot({ path: `${USCITA}/campionato.png` }).catch(() => {});
  // le altre schede ci sono ancora e funzionano
  await p.click('[data-vista="classifica"]'); await w(500);
  et(!(await p.$('.cls.camp')), 'tornando a Classifica si vede di nuovo quella della lega');
  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
  await b.close();
  for (const t of ok) console.log('  ok  ' + t);
  for (const t of ko) console.log('  KO  ' + t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
