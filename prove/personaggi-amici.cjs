/**
 * I PERSONAGGI DEGLI AMICI IN GRANDE.
 *
 * Alex, 12/10: «dare leggermente piu' importanza a questi avatar in certi
 * punti per far vedere cosa hanno i nostri amici». Dove una squadra si
 * mostra da sola, chi ha scelto un personaggio lo mostra al posto dello
 * stemma, con lo stemma (o il logo caricato) piccolo ai suoi piedi; chi non
 * l'ha scelto tiene lo stemma. Qui si guardano i tre punti:
 *   - la sfida della giornata in home;
 *   - la testata dello scontro;
 *   - la formazione di un altro.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const USCITA = process.env.USCITA || '/tmp';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', colorScheme: 'dark' });
  await ctx.addInitScript(() => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    localStorage.setItem('fcs:auth', 'supabase');
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'system' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  const p = await ctx.newPage(); const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  const w = (ms = 700) => p.waitForTimeout(ms);
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await p.fill('#email', 'amici@e.it'); await p.fill('#name', 'Hyrox12');
  await p.fill('#password', 'password123'); await p.click('#primary'); await w(1200);
  await p.click('[data-form="create"]'); await p.fill('#lname', 'Titano Open Season 1'); await p.fill('#team', 'Chirinquito Ducks');
  await p.click('#go-create'); await w(1300);
  // io senza personaggio (resta lo stemma), l'avversario con TITO
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    const io = s.tables.league_members[0];
    s.tables.profiles.push({ id: 'u_rivale', display_name: 'Enea', is_judge: false });
    s.tables.league_members.push({ ...io, id: 'm_rivale', user_id: 'u_rivale', role: 'fantallenatore', team_name: 'Ac Haramball',
      owner_name: 'Enea', color: '#1B84C6', initials: 'AH', crest_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGUlEQVR4nGOQbjn2nxLMMGrAqAGjBgwXAwD1x2QfRINqfgAAAABJRU5ErkJggg==', kit: { personaggio: 30 } });
    localStorage.setItem('fcs:mock', JSON.stringify(s));
  });
  await p.evaluate(() => { location.hash = '#/'; });
  await p.reload({ waitUntil: 'load' }); await w(1800);

  const sfida = await p.evaluate(() => [...document.querySelectorAll('.mcard .side')].map((s) => ({
    pers: s.querySelector('.fig img.pers')?.getAttribute('src') || null, crest: !!s.querySelector('.crest'),
    h: s.querySelector('.fig')?.getBoundingClientRect().height || 0, nome: s.querySelector('b')?.textContent })));
  const lui = sfida.find((x) => /Haramball/.test(x.nome || '')) || {};
  const io = sfida.find((x) => /Chirinquito/.test(x.nome || '')) || {};
  et(/avatar\/30\.webp/.test(lui.pers || ''), `in home la sfida mostra il personaggio dell'avversario (${lui.pers})`);
  et(lui.h >= 70, `e in grande (${Math.round(lui.h)} px)`);
  // Alex, 12/10: il personaggio non deve coprire il logo caricato
  const logo = await p.evaluate(() => { const s = [...document.querySelectorAll('.mcard .side')].find((x) => /Haramball/.test(x.textContent));
    const i = s?.querySelector('.fig .fig-logo .crest.foto img'); if (!i) return null;
    // fuori dallo schermo elementFromPoint non trova niente: prima la si porta in vista
    // (dal 27/10 sopra la sfida c'e' la carta di «Chi è?» e la spinge giu')
    s.scrollIntoView({ block: 'center' });
    const r = i.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { visibile: r.width > 20, sopra: i === e || i.parentElement.contains(e) }; });
  et(logo && logo.visibile && logo.sopra, `e il logo caricato resta in vista, ai piedi del personaggio (${JSON.stringify(logo)})`);
  et(io.crest && !io.pers, 'chi non l\'ha scelto tiene lo stemma');
  await p.evaluate(() => document.querySelector('.mcard')?.scrollIntoView({ block: 'center' })); await w(300);
  await p.screenshot({ path: `${USCITA}/amici-home.png` }).catch(() => {});

  const tocca = p.locator('a.mrow.tocca').first();
  if (await tocca.count()) {
    await tocca.click(); await w(1000);
    const testa = await p.evaluate(() => [...document.querySelectorAll('.l-head .tm')].map((t) => t.querySelector('.fig img')?.getAttribute('src') || null));
    et(testa.some((s) => /avatar\/30\.webp/.test(s || '')), `nello scontro c'e' il personaggio nella testata (${JSON.stringify(testa)})`);
    await p.screenshot({ path: `${USCITA}/amici-scontro.png` }).catch(() => {});
  } else et(false, 'in home c\'e\' la sfida da toccare');

  await p.evaluate(() => { location.hash = '#/formazione/m_rivale'; }); await w(1000);
  const fd = await p.evaluate(() => document.querySelector('.fd-testa .fig img')?.getAttribute('src') || null);
  et(/avatar\/30\.webp/.test(fd || ''), `nella sua formazione c'e' il suo personaggio (${fd})`);
  await p.screenshot({ path: `${USCITA}/amici-formazione.png` }).catch(() => {});

  et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
  await b.close();
  for (const t of ok) console.log('  ok  ' + t);
  for (const t of ko) console.log('  KO  ' + t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
