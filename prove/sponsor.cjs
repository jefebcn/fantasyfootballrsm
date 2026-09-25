/**
 * Lo spazio dello sponsor: si vende, e si amministra senza rilasci.
 *
 * Perché esiste: il banner del montepremi è scritto nel codice, e finché
 * anche lo sponsor stava lì, cambiarlo voleva dire un rilascio — cioè
 * dipendere da chi sa rilasciare, e non poter promettere "dal primo del
 * mese" a chi paga.
 *
 * Qui si guarda la cosa che rende vendibile quello spazio: che compaia da
 * solo il giorno giusto, che sparisca da solo il giorno dopo la scadenza, che
 * chi amministra lo possa mettere dalla console, e che sia DICHIARATO — la
 * targhetta "Sponsor" e il rel="sponsored" sul collegamento. Uno spazio
 * comprato travestito da contenuto dell'app inganna chi legge, e il giorno
 * che ci si accorge costa più di quanto abbia reso.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

const giorno = (scarto) => { const d = new Date(); d.setDate(d.getDate() + scarto); return d.toISOString().slice(0, 10); };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    localStorage.setItem('fcs:auth', 'supabase');
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, theme: 'system' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  const p = await ctx.newPage(); p.on('dialog', (d) => d.accept());
  const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  const w = (ms = 450) => p.waitForTimeout(ms);
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await w(250);
  await p.fill('#email', 'a@e.it'); await p.fill('#name', 'Conti25'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1000);
  await p.click('[data-form="create"]'); await w(250);
  await p.fill('#lname', 'Torneo Titano'); await p.fill('#team', 'Hasta El Roxy'); await p.click('#go-create'); await w(1400);

  // Senza sponsor la dashboard non ha nessuno spazio vuoto che lo aspetta.
  await p.evaluate(() => { location.hash = '#/'; }); await w(900);
  et(!(await p.$('.spon')), 'senza sponsor non c\'è nessuna fascia');

  // La console: il primo iscritto del mock non amministra, glielo diamo.
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    s.tables.profiles.find((x) => x.id === s.userId).is_admin = true;
    localStorage.setItem('fcs:mock', JSON.stringify(s));
    location.hash = '#/admin/console';
  });
  await p.reload({ waitUntil: 'load' }); await w(2000);
  await p.evaluate(() => { const t = [...document.querySelectorAll('[data-atab]')].find((x) => x.dataset.atab === 'sponsor'); if (t) t.click(); }); await w(600);
  et(!!(await p.$('#sp-salva')), 'la console ha la scheda Sponsor col modulo');

  // Se ne carica uno che comincia DOMANI: non deve vedersi oggi.
  await p.fill('#sp-nome', 'Bar Titano'); await p.fill('#sp-claim', 'Dal 1972 a Borgo Maggiore');
  await p.fill('#sp-link', 'https://esempio.sm'); await p.fill('#sp-dal', giorno(1));
  await p.click('#sp-salva'); await w(1200);
  await p.evaluate(() => { location.hash = '#/'; }); await w(900);
  et(!(await p.$('.spon')), 'uno sponsor che comincia domani non si vede oggi');

  // Lo si sposta a oggi: adesso deve comparire.
  await p.evaluate(() => { location.hash = '#/admin/console'; }); await w(900);
  await p.evaluate(() => { const t = [...document.querySelectorAll('[data-atab]')].find((x) => x.dataset.atab === 'sponsor'); if (t) t.click(); }); await w(500);
  await p.evaluate(() => document.querySelector('[data-sp-mod]')?.click()); await w(500);
  await p.fill('#sp-dal', giorno(0)); await p.click('#sp-salva'); await w(1200);
  await p.evaluate(() => { location.hash = '#/'; }); await w(900);

  const vetrina = await p.evaluate(() => {
    const a = document.querySelector('.spon'); if (!a) return null;
    return { tag: a.querySelector('.spon-tag')?.innerText || '', nome: a.querySelector('.spon-txt b')?.innerText || '',
      claim: a.querySelector('.spon-txt span')?.innerText || '', href: a.getAttribute('href') || '',
      rel: a.getAttribute('rel') || '', target: a.getAttribute('target') || '', id: a.dataset.sponsor || '' };
  });
  et(!!vetrina, 'spostato a oggi, lo sponsor compare');
  if (vetrina) {
    et(/Bar Titano/.test(vetrina.nome), `col suo nome ("${vetrina.nome}")`);
    et(/1972/.test(vetrina.claim), 'e la riga che si è comprato');
    et(/sponsor/i.test(vetrina.tag), `dichiarato con la targhetta ("${vetrina.tag}")`);
    et(/sponsored/.test(vetrina.rel) && /noopener/.test(vetrina.rel), `il collegamento è marcato come sponsorizzato (rel="${vetrina.rel}")`);
    et(vetrina.href === 'https://esempio.sm', `e porta dove deve ("${vetrina.href}")`);
    et(!!vetrina.id, 'con il suo identificativo addosso, per poterlo contare domani');
    await p.screenshot({ path: `${process.env.USCITA || '/tmp'}/sponsor.png` }).catch(() => {});
  }

  // IL RENDICONTO (018). E' il pezzo che rende RINNOVABILE uno sponsor:
  // senza un numero, l'anno dopo si ricomincia a trattare da zero. Qui si
  // guarda che il numero sia difendibile, non solo che esista.
  const conti = () => p.evaluate(() => (JSON.parse(localStorage.getItem('fcs:mock')).tables.sponsor_conteggi || []));
  const primo = await conti();
  et(primo.length === 1 && primo[0].viste === 1 && primo[0].tocchi === 0,
    `aperta la dashboard, la vista e' contata una volta (${JSON.stringify(primo)})`);

  // UNA VISTA PER DISPOSITIVO AL GIORNO. Si esce e si rientra, poi si
  // ricarica tutta la pagina: la dashboard si ridisegna tre volte e il
  // numero non si muove. Un contatore che conta i disegni dice numeri grossi
  // e indifendibili — al primo controllo di chi paga si sgonfia.
  await p.evaluate(() => { location.hash = '#/classifica'; }); await w(600);
  await p.evaluate(() => { location.hash = '#/'; }); await w(900);
  await p.reload({ waitUntil: 'load' }); await w(1600);
  const dopo = await conti();
  et(dopo.length === 1 && dopo[0].viste === 1,
    `tre disegni dopo, la vista resta una (viste: ${dopo[0] ? dopo[0].viste : 'nessuna riga'})`);

  // IL TOCCO SI CONTA SEMPRE: e' un gesto, non un'apparizione. Il
  // collegamento apre un'altra scheda, che qui si chiude subito.
  await ctx.route('https://esempio.sm/**', (r) => r.abort());
  p.on('popup', (pg) => pg.close().catch(() => {}));
  await p.click('.spon'); await w(900);
  const conTocco = await conti();
  et(conTocco[0] && conTocco[0].tocchi === 1 && conTocco[0].viste === 1,
    `il tocco e' contato, e non conta anche come vista (${JSON.stringify(conTocco[0])})`);

  // E si legge dalla console, che e' dove si guarda prima di rinnovare.
  await p.evaluate(() => { location.hash = '#/admin/console'; }); await w(900);
  await p.evaluate(() => { const t = [...document.querySelectorAll('[data-atab]')].find((x) => x.dataset.atab === 'sponsor'); if (t) t.click(); }); await w(900);
  const rendiconto = await p.evaluate(() => document.querySelector('.sp-conti')?.innerText.replace(/\n/g, ' ') || '');
  et(/1 vista\b/.test(rendiconto) && /1 tocco\b/.test(rendiconto), `la console lo dice a chi vende ("${rendiconto}")`);
  et(/100,0%/.test(rendiconto), 'con la percentuale di tocco');
  await p.screenshot({ path: `${process.env.USCITA || '/tmp'}/sponsor-rendiconto.png` }).catch(() => {});

  // UN INDIRIZZO PERICOLOSO NON DIVENTA UN COLLEGAMENTO. Lo scrive chi
  // amministra, ma "lo scrive uno di cui mi fido" non è un controllo: un
  // javascript: in quel campo girerebbe nel telefono di chiunque apra l'app.
  await p.evaluate(() => { location.hash = '#/admin/console'; }); await w(900);
  await p.evaluate(() => { const t = [...document.querySelectorAll('[data-atab]')].find((x) => x.dataset.atab === 'sponsor'); if (t) t.click(); }); await w(500);
  await p.evaluate(() => document.querySelector('[data-sp-mod]')?.click()); await w(500);
  await p.fill('#sp-link', 'javascript:alert(1)'); await p.click('#sp-salva'); await w(1200);
  await p.evaluate(() => { location.hash = '#/'; }); await w(900);
  const velenoso = await p.evaluate(() => {
    const e = document.querySelector('.spon');
    return { tag: e ? e.tagName : '', href: e ? e.getAttribute('href') : null, testo: e ? e.innerText.replace(/\n/g, ' ') : '' };
  });
  et(velenoso.tag === 'DIV' && velenoso.href === null,
    `un indirizzo javascript: non diventa un collegamento (${velenoso.tag}${velenoso.href ? ` href=${velenoso.href}` : ''})`);
  et(/Bar Titano/.test(velenoso.testo), 'ma lo sponsor resta in vetrina: si perde il tocco, non lo spazio venduto');

  // Scaduto ieri: sparisce da solo, senza che nessuno se ne ricordi.
  await p.evaluate(() => { location.hash = '#/admin/console'; }); await w(900);
  await p.evaluate(() => { const t = [...document.querySelectorAll('[data-atab]')].find((x) => x.dataset.atab === 'sponsor'); if (t) t.click(); }); await w(500);
  await p.evaluate(() => document.querySelector('[data-sp-mod]')?.click()); await w(500);
  // Prima una data impossibile: la fine prima dell'inizio non si salva.
  await p.fill('#sp-al', giorno(-1)); await p.click('#sp-salva'); await w(900);
  const malmesso = await p.evaluate(() => JSON.parse(localStorage.getItem('fcs:mock')).tables.sponsor[0].al);
  et(malmesso === null, `una fine prima dell'inizio non viene salvata (al: ${malmesso})`);
  // Poi uno scaduto per davvero: cominciato dieci giorni fa, finito ieri.
  await p.fill('#sp-dal', giorno(-10)); await p.fill('#sp-al', giorno(-1)); await p.click('#sp-salva'); await w(1200);
  await p.evaluate(() => { location.hash = '#/'; }); await w(900);
  et(!(await p.$('.spon')), 'scaduto ieri, sparisce da solo');

  // E FUORI FINESTRA NON SI CONTA. La regola non sta nella schermata: si
  // chiama il contatore a mano, come potrebbe fare chiunque abbia la chiave
  // pubblica, e il database non deve aggiungere niente a uno sponsor
  // scaduto. Se la finestra vivesse solo nella dashboard, questo passerebbe.
  const idScaduto = await p.evaluate(() => JSON.parse(localStorage.getItem('fcs:mock')).tables.sponsor[0].id);
  const prima = await conti();
  await p.evaluate(async (id) => {
    const S = await import('/src/state.js');
    localStorage.removeItem('fcs:sponsor-visto');      // togliamo anche il freno del telefono
    S.contaSponsor(id, 'vista');
  }, idScaduto);
  await w(800);
  const poi = await conti();
  et(JSON.stringify(prima) === JSON.stringify(poi),
    `su uno sponsor scaduto il contatore non aggiunge niente (${JSON.stringify(poi)})`);

  // ---------------------------------------------------------------- 021
  // LO SPONSOR DI UNA LEGA SOLA. È quello che compra chi paga per la propria
  // lega (MONETIZZAZIONE.md §3b): se comparisse anche altrove non avrebbe
  // comprato un posto, avrebbe comprato un banner.
  const mieLeghe = await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    return (s.tables.leagues || []).map((l) => ({ id: l.id, nome: l.name }));
  });
  et(mieLeghe.length >= 1, `c'è una lega su cui provare (${mieLeghe.map((l) => l.nome).join(', ') || 'nessuna'})`);
  const altrove = 'l_di_un_altro';
  await p.evaluate((dati) => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    const oggi = new Date().toISOString().slice(0, 10);
    const ieri = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    // una lega che esiste ma non e' mia, con dentro il suo sponsor
    (s.tables.leagues ||= []).push({ id: dati.altrove, name: 'Lega di un altro', short_name: 'LDA',
      invite_code: 'ZZZZZZ', rules: {}, created_by: 'u_estraneo', created_at: oggi, started: false, pubblica: false });
    s.tables.sponsor = [
      { id: 'sp_mia', nome: 'Bar della Lega', claim: 'solo qui', logo_url: '', link: 'https://esempio.sm',
        dal: ieri, al: null, attivo: true, lega_id: dati.mia },
      { id: 'sp_altra', nome: 'Sponsor Altrui', claim: 'di un\'altra lega', logo_url: '', link: 'https://altro.sm',
        dal: ieri, al: null, attivo: true, lega_id: dati.altrove },
      { id: 'sp_tutti', nome: 'Tutta App Spa', claim: 'per tutti', logo_url: '', link: 'https://tutti.sm',
        dal: ieri, al: null, attivo: true, lega_id: null },
    ];
    s.tables.sponsor_conteggi = [];
    localStorage.removeItem('fcs:sponsor-visto');
    localStorage.setItem('fcs:mock', JSON.stringify(s));
  }, { mia: mieLeghe[0].id, altrove });
  await p.evaluate(() => { location.hash = '#/'; });
  await p.reload({ waitUntil: 'load' }); await w(2000);
  const fascia = await p.evaluate(() => {
    const a = document.querySelector('.spon a, a.spon, .spon');
    return { testo: (document.querySelector('.spon')?.innerText || '').replace(/\n/g, ' · '),
      id: document.querySelector('[data-sponsor]')?.dataset.sponsor || '' };
  });
  et(/Bar della Lega/.test(fascia.testo), `nella mia lega si vede il MIO sponsor ("${fascia.testo.slice(0, 50)}")`);
  et(!/Sponsor Altrui/.test(fascia.testo), 'e non quello comprato da un\'altra lega');
  et(!/Tutta App Spa/.test(fascia.testo), 'e batte quello di tutta l\'app: quel posto l\'ha pagato lui');
  et(fascia.id === 'sp_mia', `ed è lui a prendersi la vista (${fascia.id || 'nessuno'})`);

  // tolto il suo, torna quello di tutta l'app — non quello dell'altra lega
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    s.tables.sponsor = s.tables.sponsor.filter((x) => x.id !== 'sp_mia');
    localStorage.setItem('fcs:mock', JSON.stringify(s));
  });
  await p.reload({ waitUntil: 'load' }); await w(1800);
  const senzaMio = await p.evaluate(() => (document.querySelector('.spon')?.innerText || '').replace(/\n/g, ' · '));
  et(/Tutta App Spa/.test(senzaMio), `senza uno suo, la lega vede quello di tutta l'app ("${senzaMio.slice(0, 40)}")`);
  et(!/Sponsor Altrui/.test(senzaMio), 'e mai quello di un\'altra lega, nemmeno quando non c\'è altro');

  // e il contatore non si lascia muovere da fuori
  await p.evaluate(async () => {
    const S = await import('/src/state.js');
    localStorage.removeItem('fcs:sponsor-visto');
    S.contaSponsor('sp_altra', 'vista');
    S.contaSponsor('sp_altra', 'tocco');
  });
  await w(900);
  const contiAltrui = await p.evaluate(() => (JSON.parse(localStorage.getItem('fcs:mock')).tables.sponsor_conteggi || [])
    .filter((r) => r.sponsor_id === 'sp_altra'));
  et(contiAltrui.length === 0, `da fuori non gli si muovono i numeri (${JSON.stringify(contiAltrui)})`);

  // la console dice a chi appartiene lo spazio, e lo lascia scegliere
  await p.evaluate(() => { location.hash = '#/admin/console'; });
  await p.reload({ waitUntil: 'load' }); await w(2000);
  await p.evaluate(() => { const t = [...document.querySelectorAll('[data-atab]')].find((x) => x.dataset.atab === 'sponsor'); if (t) t.click(); }); await w(1200);
  const console2 = await p.evaluate(() => ({
    scelta: !!document.getElementById('sp-lega'),
    voci: [...(document.getElementById('sp-lega')?.options || [])].map((o) => o.textContent.trim()),
    elenco: document.querySelector('.adm-sp')?.innerText || '',
  }));
  et(console2.scelta, 'nella console si sceglie dove si vede lo spazio');
  // col NOME della lega dentro: "Solo in" e basta non dice niente, ed e'
  // esattamente quello che usciva col campo sbagliato (admin_leghe torna
  // "nome", non "name")
  et(console2.voci.some((v) => /tutta l'app/i.test(v)) && console2.voci.some((v) => /Solo in Torneo Titano/i.test(v)),
    `fra tutta l'app e le leghe, ognuna col suo nome (${console2.voci.join(' / ')})`);
  et(/solo in «Lega di un altro»/i.test(console2.elenco),
    `e l'elenco dice a chi appartiene, col nome ("${console2.elenco.replace(/\n/g, ' · ').slice(0, 80)}")`);

  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
  await b.close();
  for (const t of ok) console.log('  ok  ' + t);
  for (const t of ko) console.log('  KO  ' + t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
