/**
 * Un referto gia' in lega e poi completato dalla FSGC si puo' aggiornare.
 *
 * Il 13/10 la Folgore della 5ª aveva dieci titolari nei voti: il referto era
 * entrato in lega prima che due giocatori fossero nel listone, e una partita
 * che in lega ha gia' qualcosa non si ricaricava mai piu'. L'import l'aveva
 * corretta, la lega no.
 *
 * Qui: si toglie a una partita della 4ª un titolare e un evento (la versione
 * a meta'), si fa lo stesso su una della 2ª congelata, e si riapre. Il Giudice
 * deve sentirselo dire, la congelata non deve comparire, e il tasto in
 * Impostazioni deve riportare la partita com'e' nel referto, senza doppioni.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

const conta = (p, gara) => p.evaluate((gara) => {
  const s = JSON.parse(localStorage.getItem('fcs:mock'));
  return { eventi: s.tables.match_events.filter((r) => r.match_id === gara).length,
    presenze: s.tables.match_appearances.filter((r) => r.match_id === gara).length,
    totale: s.tables.match_events.length + s.tables.match_appearances.length };
}, gara);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    localStorage.setItem('fcs:auth', 'supabase');
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'system' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  const p = await ctx.newPage();
  const domande = []; p.on('dialog', (d) => { domande.push(d.message()); d.accept(); });
  const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  const w = (ms = 450) => p.waitForTimeout(ms);
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await w(250);
  await p.fill('#email', 'a@e.it'); await p.fill('#name', 'Conti25'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1000);
  await p.click('[data-form="create"]'); await w(250);
  await p.fill('#lname', 'Torneo Titano'); await p.fill('#team', 'Hasta El Roxy'); await p.click('#go-create'); await w(1400);

  const gara = 'md4_m1', congelata = 'md2_m1';
  const intera = await conta(p, gara);
  et(intera.eventi > 0 && intera.presenze >= 22, `la partita della 4ª entra intera (${intera.presenze} presenze, ${intera.eventi} eventi)`);
  const pulite = await p.evaluate(async () => (await import('/src/state.js')).refertiDaAggiornare().length);
  et(pulite === 0, `appena caricati, nessun referto da aggiornare (${pulite})`);

  // la versione a meta': un titolare e un evento in meno
  await p.evaluate(({ gara, congelata }) => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    for (const id of [gara, congelata]) {
      const t = s.tables.match_appearances.findIndex((r) => r.match_id === id && r.started);
      s.tables.match_appearances.splice(t, 1);
      const e = s.tables.match_events.findIndex((r) => r.match_id === id);
      s.tables.match_events.splice(e, 1);
    }
    s.tables.matchday_status = [...(s.tables.matchday_status || []), { matchday: 2, status: 'frozen' }];
    localStorage.setItem('fcs:mock', JSON.stringify(s));
  }, { gara, congelata });
  const freddaPrima = await conta(p, congelata);
  await p.reload({ waitUntil: 'load' });
  await p.waitForFunction(() => /Referti FSGC completati/.test(document.getElementById('toast')?.textContent || ''), null, { timeout: 8000 }).catch(() => {});
  const avviso = await p.evaluate(() => document.getElementById('toast')?.textContent || '');
  et(/una partita da aggiornare/.test(avviso), `il Giudice se lo sente dire all'apertura («${avviso}»)`);
  const elenco = await p.evaluate(async () => (await import('/src/state.js')).refertiDaAggiornare());
  et(elenco.length === 1 && elenco[0] === gara, `da aggiornare solo la partita aperta, non la congelata (${elenco.join(', ')})`);
  const dopoRiapertura = await conta(p, gara);
  et(dopoRiapertura.presenze === intera.presenze - 1, `riaprire non la tocca da solo (${dopoRiapertura.presenze} presenze)`);

  await p.evaluate(() => { location.hash = '#/impostazioni/avanzate'; });
  await p.waitForSelector('[data-act="riallinea"]');
  const sotto = await p.$eval('[data-act="riallinea"]', (x) => x.innerText);
  et(/Una partita diversa dal referto FSGC/.test(sotto), `in Impostazioni avanzate c'e' la riga col conto («${sotto.replace(/\s+/g, ' ')}»)`);
  await p.click('[data-act="riallinea"]');
  await p.waitForFunction(() => /Aggiornate/.test(document.getElementById('toast')?.textContent || ''), null, { timeout: 8000 }).catch(() => {});
  et(domande.some((d) => /modifiche fatte a mano/.test(d) && /4ª/.test(d)), 'prima di riscrivere chiede, e dice quale partita e cosa si perde');
  const rifatta = await conta(p, gara);
  et(rifatta.presenze === intera.presenze && rifatta.eventi === intera.eventi,
    `la partita torna com'e' nel referto, senza doppioni (${rifatta.presenze} presenze, ${rifatta.eventi} eventi)`);
  const fredda = await conta(p, congelata);
  const resto = await p.evaluate(async () => (await import('/src/state.js')).refertiDaAggiornare().length);
  et(resto === 0, `dopo, niente piu' da aggiornare (${resto})`);
  et(fredda.presenze === freddaPrima.presenze && fredda.eventi === freddaPrima.eventi, `la congelata resta com'era (${fredda.presenze} presenze, ${fredda.eventi} eventi)`);
  const ora = await p.$eval('[data-act="riallinea"]', (x) => x.innerText).catch(() => '');
  et(/In lega come nei referti FSGC/.test(ora), `e la riga lo dice («${ora.replace(/\s+/g, ' ')}»)`);

  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
  await b.close();
  for (const t of ok) console.log('  ok  ' + t);
  for (const t of ko) console.log('  KO  ' + t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
