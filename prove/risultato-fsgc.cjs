/**
 * Il risultato delle partite di campionato e' della FSGC: non si cambia
 * dall'app, e una sovrascrittura vecchia non deve fare danno.
 *
 * Nasce da uno schermo vero: nella pagina del Giudice Dati la 3a giornata
 * mostrava "Tre Fiori — Domagnano  3 – null". I dati dell'import sono giusti
 * (3-0): il null arrivava da una sovrascrittura salvata coi tasti +/- che
 * c'erano in quella pagina.
 *
 * Due cose si provano: che i tasti non ci sono piu', e che una sovrascrittura
 * con i gol dentro — comprese quelle rimaste sui database veri — viene
 * ignorata, quindi "null" non puo' comparire.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  // L'orologio si ferma al 12 settembre: la 3a giornata (11/9) e' quella
  // corrente, ed e' la sua lista che il Giudice apre entrando. Senza fermarlo
  // la prova era una mina a tempo — girava verde finche' il campionato vero
  // stava alla 3a, e dal 18 settembre la pagina si apriva sulla 4a, dove i
  // risultati non ci sono ancora e "3 – 0" non poteva esserci.
  await ctx.addInitScript(() => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    localStorage.setItem('fcs:auth', 'supabase');
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, theme: 'dark' }));
    const Vero = Date; const scarto = new Vero('2026-09-12T10:00:00Z').getTime() - Vero.now();
    class Finto extends Vero {
      constructor(...a) { if (!a.length) super(Vero.now() + scarto); else super(...a); }
      static now() { return Vero.now() + scarto; }
    }
    window.Date = Finto;
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  const p = await ctx.newPage(); p.on('dialog', d => d.accept());
  const errori = []; p.on('pageerror', e => errori.push(e.message));
  const w = (ms = 450) => p.waitForTimeout(ms);
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await w(250);
  await p.fill('#email', 'a@e.it'); await p.fill('#name', 'Conti25'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1000);
  await p.click('[data-form="create"]'); await w(250);
  await p.fill('#lname', 'Torneo Titano'); await p.fill('#team', 'Hasta El Roxy'); await p.click('#go-create'); await w(1400);

  // Giudice Dati, e una sovrascrittura guasta come quella trovata sul vero:
  // gol ospiti nulli su una partita della 3a giornata.
  const rotta = await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    s.tables.profiles.find((x) => x.id === s.userId).is_judge = true;
    (s.tables.match_overrides ||= []).push({ match_id: 'md3_m1', status: 'played', home_goals: 3, away_goals: null, changed_by: s.userId });
    localStorage.setItem('fcs:mock', JSON.stringify(s));
    return 'md3_m1';
  });
  await p.evaluate(() => { location.hash = '#/admin'; });
  await p.reload({ waitUntil: 'load' }); await w(2200);

  const giornata = await p.evaluate(() => document.body.innerText);
  et(!/null/i.test(giornata), 'la giornata del Giudice non scrive "null" da nessuna parte');
  et(/\d+\s*[–-]\s*\d+/.test(giornata), 'e i risultati si leggono come due numeri');

  // dentro la partita: nessun tasto per cambiare il risultato
  await p.evaluate((id) => { location.hash = `#/admin/partita/${id}`; }, rotta); await w(1400);
  const dentro = await p.evaluate(() => ({
    piuMeno: document.querySelectorAll('[data-g]').length,
    stato: document.querySelectorAll('[data-status]').length,
    testo: document.body.innerText,
    fsgc: document.querySelector('.ris-fsgc')?.innerText.replace(/\n/g, ' ') || '',
  }));
  et(dentro.piuMeno === 0, `nessun tasto per cambiare il risultato (${dentro.piuMeno})`);
  et(dentro.stato > 0, `lo stato della gara si cambia ancora (${dentro.stato} scelte, art. 10)`);
  et(/dalla FSGC|dal sito della federazione/i.test(dentro.testo), 'e la schermata dice da dove viene il risultato');
  et(!/null/i.test(dentro.fsgc) && /3\s*[–-]\s*0/.test(dentro.fsgc), `mostra il risultato vero dell'import ("${dentro.fsgc}")`);
  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);

  await b.close();
  for (const t of ok) console.log('  ok  ' + t);
  for (const t of ko) console.log('  KO  ' + t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
