// Chi si e' appena iscritto e non e' ancora in una lega.
//
// Era il giro di chiunque scarichi l'app dallo Store, ed e' il giro di chi la
// controlla prima di pubblicarla: crea un account e si guarda intorno. Su
// quella schermata non c'e' il menu, quindi non c'era modo di arrivare alle
// impostazioni — ne' uscire, ne' cancellare il profilo — e in basso restava
// una barra di schede che riportavano tutte li'.
//
// E prima ancora, la registrazione: l'eta' minima e i termini stavano solo
// nei termini, e nessuna schermata d'iscrizione li nominava.
//
// In fondo, due righe che si erano rotte nella stessa passata: i partecipanti
// della lega (la maglia spingeva il nome sotto) e i premi (una riga vuota
// sotto ognuno).
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const OUT = process.env.USCITA || '/tmp';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    localStorage.setItem('fcs:auth', 'supabase');
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'system' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  const p = await ctx.newPage(); p.on('dialog', (d) => d.accept());
  const w = (ms = 500) => p.waitForTimeout(ms);
  const ko = [];
  const vero = (cond, msg) => { if (!cond) ko.push(msg); };

  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1200);
  await p.click('[data-tab="up"]'); await w(300);
  const legale = await p.evaluate(() => {
    const n = document.querySelector('.nota.legale');
    return n && { testo: n.textContent, link: [...n.querySelectorAll('a')].map((a) => a.getAttribute('href')) };
  });
  vero(legale, 'registrazione: manca la riga su eta\', termini e privacy');
  if (legale) {
    vero(/almeno 14 anni/.test(legale.testo), `registrazione: l'eta' minima non c'e' ("${legale.testo}")`);
    vero(legale.link.includes('termini.html') && legale.link.includes('privacy.html'), `registrazione: link ai termini e all'informativa mancanti (${legale.link})`);
  }
  await p.click('[data-tab="link"]').catch(() => {}); await w(300);
  vero(await p.$('.nota.legale'), 'accesso con link (crea l\'account al primo accesso): manca la riga legale');

  await p.click('[data-tab="in"]').catch(() => {}); await w(200);
  await p.click('[data-tab="up"]'); await w(300);
  await p.fill('#email', 'a@e.it'); await p.fill('#name', 'Alessandro'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1200);
  vero((await p.evaluate(() => location.hash)).includes('leghe'), 'dopo l\'iscrizione non si arriva alle leghe');
  vero(!(await p.$('.a-nav')), 'senza lega c\'e\' ancora la barra in basso');
  const riga = await p.$('.rigaconto');
  vero(riga, 'senza lega: manca la via per le impostazioni');
  if (riga) {
    await riga.click(); await w(700);
    const imp = await p.evaluate(() => ({ hash: location.hash, testo: document.querySelector('.a-body')?.textContent || '' }));
    vero(imp.hash.includes('impostazioni'), `la riga porta a ${imp.hash}, non alle impostazioni`);
    vero(/Esci/.test(imp.testo) && /Cancella il profilo/.test(imp.testo), 'dalle impostazioni senza lega non si esce e non si cancella il profilo');
    vero(!(await p.$('.a-nav')), 'nelle impostazioni senza lega c\'e\' la barra in basso');
  }

  // una lega con premi, a punti, e due partecipanti oltre a me
  await p.evaluate(() => { location.hash = '#/leghe'; }); await w(600);
  await p.click('[data-form="create"]'); await w(300);
  await p.fill('#lname', 'Campionato dei Sudati di San Marino'); await p.fill('#team', 'Hasta El Chapo FC'); await p.click('#go-create'); await w(1200);
  await p.evaluate(() => {
    const K = 'fcs:mock'; const s = JSON.parse(localStorage.getItem(K)); const lg = s.tables.leagues[0];
    lg.classifica = 'punti'; lg.premi = [{ posto: 1, premio: 'Una cena per due' }, { posto: 2, premio: 'Una maglia' }];
    [['Serravalle United', 'Marco', '#c0392b', 'SU'], ['Borgo Maggiore FC', 'Luca', '#27ae60', 'BM']].forEach(([t, o, c, i], k) => {
      s.tables.league_members.push({ id: 'fk' + k, league_id: lg.id, user_id: 'fu' + k, role: 'fantallenatore', team_name: t, owner_name: o, color: c, initials: i, credits: 500, created_at: new Date().toISOString() });
    });
    localStorage.setItem(K, JSON.stringify(s));
  });
  await p.reload({ waitUntil: 'load' }); await w(1500);
  vero(await p.$('.a-nav'), 'con una lega la barra in basso deve tornare');

  await p.evaluate(() => { location.hash = '#/'; }); await w(900);
  const nome = await p.evaluate(() => {
    const b = document.querySelector('.hero-league b');
    return b && { testo: b.textContent, tagliato: b.scrollWidth > b.clientWidth };
  });
  vero(nome && nome.testo === 'Campionato dei Sudati di San Marino', `in home il nome della lega e' "${nome && nome.testo}"`);

  await p.evaluate(() => { location.hash = '#/lega'; }); await w(700);
  const righe = await p.evaluate(() => [...document.querySelectorAll('.prow.conmaglia')].map((r) => {
    const m = r.querySelector('.pmg').getBoundingClientRect(); const t = r.querySelector('.ptxt').getBoundingClientRect();
    return { stessaRiga: t.top < m.bottom, testoDopoMaglia: t.left >= m.right - 1 };
  }));
  vero(righe.length === 3, `partecipanti: ${righe.length} righe invece di 3`);
  righe.forEach((r, i) => vero(r.stessaRiga && r.testoDopoMaglia, `partecipante ${i + 1}: il nome non sta accanto alla maglia`));

  await p.evaluate(() => { location.hash = '#/classifica'; }); await w(700);
  const premi = await p.evaluate(() => [...document.querySelectorAll('.premi .prow')].map((r) => {
    const a = r.querySelector('.ppre').getBoundingClientRect(); const c = r.querySelector('.pchi').getBoundingClientRect();
    return { altezza: r.getBoundingClientRect().height, chiInRiga: c.top < a.bottom };
  }));
  vero(premi.length === 2, `premi: ${premi.length} righe invece di 2`);
  premi.forEach((r, i) => vero(r.chiInRiga && r.altezza < 48, `premio ${i + 1}: riga alta ${Math.round(r.altezza)}px, chi vince va a capo`));
  vero(!(await p.$('.statoriga')), 'classifica vuota: c\'e\' lo stato di una giornata che per questa lega non esiste');

  await p.screenshot({ path: `${OUT}/senza-lega.png` });
  console.log(ko.length ? ko.join('\n') : 'nessun problema');
  await b.close();
  process.exit(ko.length ? 1 : 0);
})();
