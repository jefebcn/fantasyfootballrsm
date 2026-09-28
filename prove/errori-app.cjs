/**
 * GLI ERRORI DEI TELEFONI ARRIVANO IN CONSOLE (022).
 *
 * Prima restavano sul telefono dove succedevano. Qui si fa succedere un
 * errore vero e si guarda che arrivi — e che arrivi COME deve:
 *   - una volta sola per sessione, anche se si ripete;
 *   - senza l'indirizzo e-mail che per caso c'era dentro;
 *   - con la schermata senza identificativi ("giocatore/:id");
 *   - e che la rete che manca NON arrivi: non e' un difetto dell'app.
 * Poi chi amministra lo trova in console, sotto «Chi consegna».
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    localStorage.setItem('fcs:auth', 'supabase');
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, theme: 'light' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  const p = await ctx.newPage(); p.on('dialog', (d) => d.accept());
  const errori = []; p.on('pageerror', (e) => { if (!/PROVA-VOLUTA|Failed to fetch/.test(e.message)) errori.push(e.message); });
  const w = (ms = 700) => p.waitForTimeout(ms);
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await p.fill('#email', 'a@e.it'); await p.fill('#name', 'Alex');
  await p.fill('#password', 'password123'); await p.click('#primary'); await w(1200);
  await p.click('[data-form="create"]'); await p.fill('#lname', 'Torneo'); await p.fill('#team', 'Prova FC');
  await p.click('#go-create'); await w(1500);

  // su una scheda con un identificativo nell'indirizzo, per vedere che non passi
  await p.evaluate(() => { location.hash = '#/giocatore/p_12345678abcd'; }); await w(900);
  const lancia = (msg) => p.evaluate((m) => { setTimeout(() => { throw new Error(m); }, 0); }, msg);
  await lancia('PROVA-VOLUTA: scrivendo a mario.rossi@example.com');
  await lancia('PROVA-VOLUTA: scrivendo a mario.rossi@example.com');   // la stessa, di nuovo
  await lancia('Failed to fetch');                                       // la rete che manca
  await w(1500);

  const righe = await p.evaluate(() => JSON.parse(localStorage.getItem('fcs:mock')).tables.errori_app || []);
  const mia = righe.find((r) => /PROVA-VOLUTA/.test(r.messaggio));
  et(!!mia, `l'errore del telefono arriva (${righe.length} ${righe.length === 1 ? 'riga' : 'righe'})`);
  et(mia && mia.quante === 1, `ripetuto nella stessa sessione, parte una volta sola (×${mia?.quante})`);
  et(mia && !/@/.test(mia.messaggio + mia.dettaglio) && /\[e-mail\]/.test(mia.messaggio),
    `senza l'indirizzo e-mail che c'era dentro ("${mia?.messaggio}")`);
  et(mia && mia.schermata === 'giocatore/:id', `la schermata senza identificativi (${mia?.schermata})`);
  et(mia && /· (Chrome|Safari|altro) ·/.test(mia.dispositivo), `il tipo di telefono, non il telefono (${mia?.dispositivo})`);
  et(mia && /^fcs-v/.test(mia.versione || '') || mia?.versione === 'sconosciuta', `con la versione (${mia?.versione})`);
  et(!righe.some((r) => /Failed to fetch/.test(r.messaggio)), 'la rete che manca non è un difetto dell\'app: non parte');

  // chi amministra lo trova in console
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    s.tables.profiles.find((x) => x.id === s.userId).is_admin = true;
    localStorage.setItem('fcs:mock', JSON.stringify(s));
    location.hash = '#/admin/console';
  });
  await p.reload({ waitUntil: 'load' }); await w(2200);
  const console2 = await p.evaluate(() => ({
    titolo: [...document.querySelectorAll('.a-sec b')].map((x) => x.textContent).find((t) => /Errori/.test(t)) || '',
    riga: document.querySelector('.adm-err summary')?.innerText.replace(/\n/g, ' · ') || '',
  }));
  et(/Errori sui telefoni/.test(console2.titolo), 'in console c\'è la sezione degli errori');
  et(/PROVA-VOLUTA/.test(console2.riga) && /×1/.test(console2.riga), `con l'errore e quante volte ("${console2.riga.slice(0, 90)}")`);
  // aperto, si legge tutto: prima il titolo era tagliato coi puntini e
  // dentro c'era solo ":1", cioe' niente
  const aperto = await p.evaluate(() => {
    const d = document.querySelector('.adm-err details'); if (!d) return null;
    d.open = true;
    const dentro = d.querySelector('.adm-err-dentro');
    return { testo: dentro?.innerText || '', pre: dentro?.querySelector('pre')?.innerText || '' };
  });
  et(aperto && /PROVA-VOLUTA: scrivendo a \[e-mail\]/.test(aperto.testo), 'aperto, il messaggio si legge intero');
  et(aperto && /Dove[\s\S]*giocatore\/:id/.test(aperto.testo) && /Telefono/.test(aperto.testo), 'con dove e su che telefono');
  et(aperto && !/^\s*:?\d*\s*$/.test(aperto.pre || 'x'), `e senza il ":1" che non dice niente (${JSON.stringify(aperto?.pre)})`);
  // e «Chi consegna», con una lega nata dopo tutte le giornate chiuse, non
  // scrive "0 squadre su 0 (0%)"
  const consegne = await p.evaluate(() => document.querySelector('.adm-graf.consegne')?.nextElementSibling?.innerText || '');
  et(!/su 0 \(0%\)/.test(consegne), `«Chi consegna» non fa percentuali su zero squadre ("${consegne.slice(0, 80)}")`);
  await p.screenshot({ path: `${process.env.USCITA || '/tmp'}/errori-app.png` }).catch(() => {});

  et(errori.length === 0, `nessun errore JS oltre a quelli voluti${errori.length ? ' — ' + errori[0] : ''}`);
  await b.close();
  for (const t of ok) console.log('  ok  ' + t);
  for (const t of ko) console.log('  KO  ' + t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
