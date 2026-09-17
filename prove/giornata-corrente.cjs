/**
 * Che giornata sta giocando l'app.
 *
 * Nasce da uno schermo vero: il 17 settembre, con tre giornate di campionato
 * giocate e nessun voto ancora caricato in lega, la dashboard annunciava
 * "GIORNATA 1" e il pre-match diceva "si chiude ven 28/8" — una data di tre
 * settimane prima. La giornata corrente era definita come "l'ultima che ha
 * dati inseriti", quindi senza dati restava la prima per sempre.
 *
 * Quale giornata si gioca lo dice il calendario, non chi ha avuto tempo di
 * inserire i referti. Qui l'orologio si sposta a mano e si guarda cosa dice
 * l'app, in tre momenti della stagione.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

// Il calendario vero (src/data.js): 1ª 28/08, 2ª 04/09, 3ª 11/09, 4ª 18/09,
// 5ª 09/10. Fra la quarta e la quinta ci sono TRE SETTIMANE, non una: una
// sosta del campionato. Scriverlo qui ha un motivo — la prima stesura di
// questa prova si aspettava il 25/09, cioe' "una settimana dopo", ed e'
// diventata rossa. Aveva torto lei: le date vengono dal calendario FSGC e non
// da una formula, ed e' esattamente il guasto che la migrazione 004 racconta
// (il server le calcolava a +7 giorni e sbagliava di otto).
const MOMENTI = [
  { quando: '2026-08-20T10:00:00Z', etichetta: 'prima che cominci', attesa: 1, data: /28\/8|28\/08/ },
  { quando: '2026-09-17T10:00:00Z', etichetta: 'tre giornate giocate, nessun voto', attesa: 4, data: /18\/9|18\/09/ },
  { quando: '2026-09-18T16:00:00Z', etichetta: 'subito dopo il lock della 4ª', attesa: 5, data: /9\/10|09\/10/ },
];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  for (const m of MOMENTI) {
    const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    await ctx.addInitScript(({ iso }) => {
      window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
      localStorage.setItem('fcs:auth', 'supabase');
      localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, theme: 'system' }));
      localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
      // L'orologio si sposta prima che l'app parta: un Date con uno scarto
      // fisso, cosi' anche i timer e le durate restano coerenti fra loro.
      const Vero = Date;
      const scarto = new Vero(iso).getTime() - Vero.now();
      class Finto extends Vero {
        constructor(...a) { if (!a.length) super(Vero.now() + scarto); else super(...a); }
        static now() { return Vero.now() + scarto; }
      }
      window.Date = Finto;
    }, { iso: m.quando });
    const p = await ctx.newPage(); p.on('dialog', d => d.accept());
    const errori = []; p.on('pageerror', e => errori.push(e.message));
    const w = (ms = 450) => p.waitForTimeout(ms);
    await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
    await p.click('[data-tab="up"]'); await w(250);
    await p.fill('#email', 'a@e.it'); await p.fill('#name', 'Conti25'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1000);
    await p.click('[data-form="create"]'); await w(250);
    await p.fill('#lname', 'Torneo Titano'); await p.fill('#team', 'Hasta El Roxy'); await p.click('#go-create'); await w(1400);
    // un avversario, cosi' c'e' uno scontro da mostrare
    await p.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('fcs:mock'));
      const io = s.tables.league_members[0];
      s.tables.profiles.push({ id: 'u_riv', display_name: 'Wesly', is_judge: false });
      s.tables.league_members.push({ ...io, id: 'm_riv', user_id: 'u_riv', role: 'fantallenatore', team_name: 'Fuego Roxy', owner_name: 'Wesly', color: '#c0392b', initials: 'FR' });
      localStorage.setItem('fcs:mock', JSON.stringify(s));
    });
    await p.evaluate(() => { location.hash = '#/'; });
    await p.reload({ waitUntil: 'load' }); await w(1800);

    const dash = await p.evaluate(() => {
      const sezioni = [...document.querySelectorAll('.a-sec')].map((s) => s.innerText.replace(/\n/g, ' '));
      const corrente = sezioni.find((t) => /Giornata corrente/i.test(t)) || '';
      // La nota della card "Giornata corrente", non la prima della pagina:
      // sopra puo' esserci la scheda "Da calcolare", che ne ha una sua.
      const card = [...document.querySelectorAll('.a-sec')].find((x) => /Giornata corrente/i.test(x.innerText))?.nextElementSibling;
      const nota = card?.querySelector('.mnota')?.innerText || '';
      return { corrente, nota };
    });
    const num = (dash.corrente.match(/(\d+)ª/) || [])[1];
    et(String(m.attesa) === num, `${m.etichetta}: la dashboard dice giornata ${num || '?'} (attesa ${m.attesa})`);
    et(m.data.test(dash.nota), `${m.etichetta}: e la data di chiusura è quella giusta ("${dash.nota.slice(0, 60)}")`);
    // la data non deve MAI essere nel passato rispetto all'orologio
    const passata = await p.evaluate(() => {
      const card = [...document.querySelectorAll('.a-sec')].find((x) => /Giornata corrente/i.test(x.innerText))?.nextElementSibling;
      const t = card?.querySelector('.mnota')?.innerText || '';
      const q = t.match(/(\d{1,2})\/(\d{1,2})/);
      if (!q) return null;
      const oggi = new Date();
      const anno = +q[2] >= 8 ? 2026 : 2027;
      return new Date(anno, +q[2] - 1, +q[1], 23, 59) < oggi;
    });
    et(passata === false || passata === null, `${m.etichetta}: la chiusura non è una data già passata`);

    // il pre-match: stessa giornata, stessa data
    await p.evaluate(() => { const a = document.querySelector('a.mrow.tocca'); if (a) a.click(); }); await w(1100);
    const live = await p.evaluate(() => ({ hash: location.hash, testo: document.body.innerText.replace(/\n/g, ' ').slice(0, 300) }));
    if (/^#\/live\//.test(live.hash)) {
      et(new RegExp(`GIORNATA ${m.attesa}\\b`, 'i').test(live.testo), `${m.etichetta}: il pre-match apre la giornata ${m.attesa}`);
      et(m.data.test(live.testo), `${m.etichetta}: e ci scrive la sua data di chiusura`);
    }
    // LE GIORNATE PRIMA DELLA LEGA non sono sue: la lega creata adesso parte
    // dalla giornata aperta adesso, e di quelle passate non deve chiedere
    // niente — ne' voti da calcolare, ne' incontri.
    await p.evaluate(() => { location.hash = '#/'; }); await w(900);
    const passate = await p.evaluate(() => {
      const t = document.body.innerText;
      return { daCalcolare: (t.match(/Da calcolare\s*(\d+)ª/) || [])[1] || null };
    });
    et(passate.daCalcolare === null,
      `${m.etichetta}: non chiede di calcolare giornate di prima della lega (${passate.daCalcolare || 'nessuna'})`);
    if (m.attesa > 1) {
      await p.evaluate((n) => { location.hash = `#/calendario/${n}`; }, m.attesa - 1); await w(1000);
      const cal = await p.evaluate(() => document.body.innerText);
      et(/si è giocata prima|nata dalla/.test(cal),
        `${m.etichetta}: il calendario della ${m.attesa - 1}ª dice che è di prima della lega`);
    }
    // LA CLASSIFICA ANCORA VUOTA non deve perdere le schede, e deve dire cosa
    // manca. In una lega appena nata manca che si giochi la sua prima
    // giornata: dare la colpa al Giudice Dati, com'era scritto a
    // prescindere, mandava a cercare una persona invece di far aspettare una
    // data.
    await p.evaluate(() => { location.hash = '#/classifica'; }); await w(1100);
    const cls = await p.evaluate(() => ({
      schede: document.querySelectorAll('.seg-cls [data-vista]').length,
      vuota: !!document.querySelector('.empty'),
      testo: document.querySelector('.empty')?.innerText.replace(/\n/g, ' ') || '',
    }));
    if (cls.vuota) {
      et(cls.schede >= 2, `${m.etichetta}: a classifica vuota le schede restano (${cls.schede})`);
      et(!/Giudice Dati/.test(cls.testo), `${m.etichetta}: e non da' la colpa al Giudice Dati`);
      et(new RegExp(`parte dalla ${m.attesa}ª`).test(cls.testo) || /almeno due squadre/.test(cls.testo),
        `${m.etichetta}: dice cosa si sta aspettando ("${cls.testo.slice(0, 90)}")`);
      // e da lì si passa a Record senza uscire dalla schermata
      await p.evaluate(() => { const x = [...document.querySelectorAll('[data-vista]')].find((e) => /record/i.test(e.textContent)); if (x) x.click(); }); await w(800);
      const dopoRecord = await p.evaluate(() => ({ accesa: document.querySelector('.seg-cls .on')?.innerText.trim() || '', body: document.body.innerText.slice(0, 200) }));
      et(/record/i.test(dopoRecord.accesa), `${m.etichetta}: e da lì si passa a Record ("${dopoRecord.accesa}")`);
    }
    et(errori.length === 0, `${m.etichetta}: nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
    await ctx.close();
  }
  await b.close();
  for (const t of ok) console.log('  ok  ' + t);
  for (const t of ko) console.log('  KO  ' + t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
