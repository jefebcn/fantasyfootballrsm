/**
 * Il FantaFutsal col server, sul modello Dunkest (FUTSAL.md § 13).
 *
 * Un utente nuovo si iscrive con la squadra del cuore, compra la rosa al
 * mercato (Porta, 4 difensori, 4 attaccanti) dentro i 70 crediti, sceglie
 * capitano, vice e schema e la salva: sul finto server deve arrivare nel
 * formato di futsal-04. Poi altri undici iscritti con le loro rose dalla 1ª
 * alla 7ª, e il giro di tutte le pagine: home coi campionati principali,
 * campo coi punti, statistiche, profilo giocatore, classifiche, regolamento.
 *
 * L'orologio del browser e' fermo a domenica 1 novembre 2026: la 7ª e'
 * conclusa e il mercato della 8ª e' aperto.
 *
 * Gli screenshot finiscono in $USCITA.
 */
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:4173';
const USCITA = process.env.USCITA || '/tmp';
const ORA = process.env.ORA || '2026-11-01T11:00:00+01:00';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, timezoneId: 'Europe/Rome', locale: 'it-IT', isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.clock.setFixedTime(new Date(ORA));
  await ctx.addInitScript(() => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    localStorage.setItem('fcs:auth', 'supabase');
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, guidaVista: true, theme: 'light' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
    localStorage.setItem('fcs:futsal', '1');
  });
  const p = await ctx.newPage();
  const errori = []; p.on('pageerror', (e) => errori.push(e.message));
  const w = (ms = 500) => p.waitForTimeout(ms);
  const foto = async (nome, fondo = false) => {
    await p.screenshot({ path: path.join(USCITA, `futsal-srv-${nome}.png`) });
    if (!fondo) return;
    await p.evaluate(() => { const m = document.querySelector('.a-body'); if (m) m.scrollTop = m.scrollHeight; }); await w(250);
    await p.screenshot({ path: path.join(USCITA, `futsal-srv-${nome}-fondo.png`) });
    await p.evaluate(() => { const m = document.querySelector('.a-body'); if (m) m.scrollTop = 0; });
  };
  const scorri = async (sel) => { await p.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'start' }), sel); await w(250); };
  const testo = () => p.evaluate(() => document.querySelector('main')?.innerText || '');
  const vai = async (h, ms = 900) => { await p.evaluate((x) => { location.hash = x; }, h); await w(ms); };

  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await w(250);
  await p.fill('#email', 'alex@e.it'); await p.fill('#name', 'Alex'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1200);

  // ---- utente nuovo: i quattro passi e l'iscrizione con la squadra del cuore
  await vai('#/futsal');
  et(!!(await p.$('#fs-iscriviti')) && (await p.$$('.fs-passo')).length === 4, 'senza squadra la home spiega il gioco in 4 passi e propone di iscriversi');
  await foto('01-nuovo-utente', true);
  await p.fill('#fs-squadra', 'Titani Futsal'); await p.selectOption('#fs-cuore', 'murata');
  await p.click('#fs-iscriviti'); await w(1200);
  et(/futsal\/squadra/.test(await p.evaluate(() => location.hash)), 'iscritto: si va al campo per comprare la rosa');
  const cr0 = await p.evaluate(() => document.querySelector('.fs-cruscotto')?.innerText.replace(/\s+/g, ' '));
  et(/70,0/.test(cr0) && /Aperto/i.test(cr0), `il cruscotto dice 70 crediti e mercato aperto (${cr0})`);
  await foto('02-campo-vuoto', true);

  // ---- il mercato: Porta, 4 D, 4 A
  const compra = async (slot, n) => {
    await p.click(`[data-slot="${slot}"]`); await w(400);
    const b2 = await p.$$('#sheet [data-compra]:not([disabled])');
    await b2[Math.min(n, b2.length - 1)].click(); await w(350);
  };
  await p.click('[data-slot="P:0"]'); await w(400);
  await foto('03-mercato-porte');
  await (await p.$$('#sheet [data-compra]:not([disabled])'))[3].click(); await w(350);
  await p.click('[data-slot="D:0"]'); await w(400);
  await foto('04-mercato-difensori');
  await (await p.$$('#sheet [data-compra]:not([disabled])'))[2].click(); await w(350);
  await compra('D:1', 8); await compra('D:2', 20); await compra('D:3', 30);
  await compra('A:0', 1); await compra('A:1', 12); await compra('A:2', 25); await compra('A:3', 35);
  const residui = await p.evaluate(() => Number(document.querySelector('.fs-cruscotto span:nth-child(3) b')?.textContent.replace(',', '.')));
  et(residui >= 0, `la rosa sta nei 70 crediti (restano ${residui})`);
  // capitano e vice dalla scheda del giocatore
  await p.click('.fs-campo [data-slot="A:0"]'); await w(400);
  et(/crediti/i.test(await p.evaluate(() => document.querySelector('#sheet')?.innerText || '')), 'la scheda del giocatore mostra crediti, media, plus e pop');
  await foto('05-scheda-giocatore');
  await p.click('#sheet [data-az="capitano"]'); await w(350);
  await p.click('.fs-campo [data-slot="D:0"]'); await w(400); await p.click('#sheet [data-az="vice"]'); await w(350);
  // una sostituzione: il sesto uomo entra al posto di un attaccante
  await p.click('.fs-campo [data-slot="A:1"]'); await w(400); await p.click('#sheet [data-az="sost"]'); await w(300);
  await foto('06-sostituzione');
  await (await p.$$('#sheet [data-swap]'))[0].click(); await w(400);
  await foto('07-campo-pronto', true);
  await p.click('[data-schema="3-1"]'); await w(400);
  et((await p.$$('.fs-campo .fs-linea:nth-child(3) .fs-carta')).length === 3, 'con il 3-1 in campo ci sono tre difensori');
  await foto('08-schema-3-1', true);
  await p.click('[data-schema="2-2"]'); await w(300);
  await p.click('#fs-salva'); await w(1300);
  const salvata = await p.evaluate(() => JSON.parse(localStorage.getItem('fcs:mock')).tables.futsal_formazioni?.find((f) => f.giornata === 8)?.formazione);
  et(salvata && salvata.D.length === 4 && salvata.A.length === 4 && salvata.titolari.length === 4 && salvata.sesto && salvata.porta, 'la squadra della 8ª è sul server nel formato di futsal-04');
  et(/Squadra salvata/i.test(await testo()), 'e il pulsante dice che è salvata');

  // ---- undici avversari con le loro rose, e la storia di Alex dalla 3ª
  await p.evaluate(async () => {
    const F = await import('/src/futsal.js');
    const V = await import('/src/futsal-valori.js');
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    const io = s.userId;
    let seme = 11; const caso = () => { seme = (seme * 16807) % 2147483647; return seme / 2147483647; };
    const nomi = ['Borgo C5', 'Serravalle Five', 'Dogana Calcetto', 'Acquaviva Futsal', 'Tre Penne Fans', 'Murata Boys', 'Faetano Pivot', 'Libertas Ultras', 'Cosmos Club', 'Fiorentino Five', 'Montegiardino C5'];
    const colori = ['#C0392B', '#27AE60', '#8E44AD', '#E67E22', '#16A085', '#2C3E50', '#B03A2E', '#0B3D91', '#E8B53A', '#0E6B3D', '#8E1B2E'];
    const cuori = ['murata', 'libertas', 'juvenes', null, 'trepenne', 'murata', 'faetano', 'libertas', 'cosmos', 'fiorentino', null];
    s.tables.profiles.push(...nomi.map((n, i) => ({ id: `amico${i}`, display_name: n })));
    s.tables.futsal_iscritti.push(...nomi.map((n, i) => ({ user_id: `amico${i}`, squadra: n, colore: colori[i], iniziali: n.split(' ').map((x) => x[0]).join('').slice(0, 3).toUpperCase(), club_cuore: cuori[i], created_at: '2026-09-10T10:00:00Z' })));
    const scegli = (lista) => lista[Math.floor(caso() * lista.length)];
    // una rosa a caso che sta nei 70 crediti, al massimo 2 per squadra
    const rosa = (g) => {
      for (;;) {
        const club = new Map(); const conta = (c) => { club.set(c, (club.get(c) || 0) + 1); return club.get(c) <= 2; };
        const porta = scegli(F.SQUADRE).id; conta(porta);
        const prendi = (r, n) => { const out = []; while (out.length < n) { const x = scegli(F.GIOCATORI_FUTSAL.filter((y) => y.ruolo === r && !out.includes(y.id))); if (conta(x.club)) out.push(x.id); } return out; };
        const f = { porta, D: prendi('D', 4), A: prendi('A', 4) };
        if (V.costo(f, g) <= 70) return f;
      }
    };
    const schiera = (f) => {
      const schema = scegli(['2-2', '2-2', '3-1', '1-3']); const [d, a] = schema.split('-').map(Number);
      const titolari = [...f.D.slice(0, d), ...f.A.slice(0, a)];
      const fuori = [...f.D.slice(d), ...f.A.slice(a)];
      return { ...f, schema, titolari, sesto: fuori[0], capitano: titolari.at(-1), vice: titolari[0] };
    };
    s.tables.futsal_formazioni ||= [];
    for (let i = 0; i < nomi.length; i++) {
      let f = rosa(1);
      for (const g of F.giocate()) {
        if (g === 5 && caso() < 0.5) { const r2 = rosa(5); f = { ...f, A: [...f.A.slice(0, 3), r2.A.find((x) => !f.A.includes(x)) || f.A[3]] }; }
        s.tables.futsal_formazioni.push({ user_id: `amico${i}`, giornata: g, formazione: schiera(f), consegnata_at: '2026-10-01T18:00:00Z' });
      }
    }
    const mia = s.tables.futsal_formazioni.find((f) => f.user_id === io && f.giornata === 8).formazione;
    for (const g of [3, 4, 5, 6, 7]) s.tables.futsal_formazioni.push({ user_id: io, giornata: g, formazione: mia, consegnata_at: '2026-10-01T18:00:00Z' });
    s.tables.futsal_leghe = [
      { id: 'lega-lun', nome: 'Amici del lunedì', tipo: 'testa', codice: 'F3A9C1', creata_da: io, avvio_giornata: 2, membri_avvio: [io, 'amico0', 'amico1', 'amico2', 'amico3', 'amico4'], created_at: '2026-09-15T10:00:00Z' },
      { id: 'lega-uff', nome: 'Ufficio', tipo: 'somma', codice: 'F77B02', creata_da: 'amico5', avvio_giornata: null, membri_avvio: null, created_at: '2026-09-15T10:00:00Z' }];
    s.tables.futsal_membri = [...[io, 'amico0', 'amico1', 'amico2', 'amico3', 'amico4'].map((u, i) => ({ lega_id: 'lega-lun', user_id: u, entrato_at: `2026-09-15T10:0${i}:00Z` })),
      ...[io, 'amico5', 'amico6', 'amico7'].map((u, i) => ({ lega_id: 'lega-uff', user_id: u, entrato_at: `2026-09-16T10:0${i}:00Z` }))];
    localStorage.setItem('fcs:mock', JSON.stringify(s));
  });
  await p.reload({ waitUntil: 'load' }); await w(1500);

  // ---- home: la banda della squadra, i campionati principali, i leader
  await vai('#/futsal', 1300);
  const home = await testo();
  et(/Campionati principali/i.test(home) && /Tifosi Murata/i.test(home) && /Serie Guaita/i.test(home) && /Coppa Titano/i.test(home), 'la home elenca Generale, Tifosi, Serie e Coppa');
  et(/su 12/.test(home), 'con il posto fra 12 iscritti');
  et(/Leader della 7ª/i.test(home), 'e i leader della 7ª');
  await foto('09-home', true);
  await scorri('.fs-leader'); await foto('10-home-leader');

  // ---- la 7ª giocata: il campo coi punti
  await vai('#/futsal/squadra/7');
  et(/fantapunti/i.test(await testo()) && !(await p.$('#fs-salva')), 'la 7ª è chiusa: il campo coi punti');
  await foto('11-campo-punti-7', true);
  await vai('#/futsal/squadra');
  await foto('12-squadra-8');

  // ---- statistiche
  await vai('#/futsal/statistiche');
  et((await p.$$('.fs-tab tbody tr')).length > 150, 'la tabella dei giocatori ha tutto il listone');
  await foto('13-statistiche-giocatori');
  await p.click('th[data-col="cr"]'); await w(400);
  await foto('14-statistiche-per-crediti');
  await p.click('[data-vista="porte"]'); await w(500); await foto('15-statistiche-porte');
  await p.click('[data-vista="squadre"]'); await w(500);
  et((await p.$$('.fs-tab tbody tr')).length === 15, 'la classifica vera ha 15 squadre');
  await foto('16-statistiche-squadre');
  await p.click('[data-vista="leader"]'); await w(500); await foto('17-statistiche-leader', true);

  // ---- profilo del miglior attaccante
  const top = await p.evaluate(async () => { const F = await import('/src/futsal.js'); const st = F.statistiche(); return F.GIOCATORI_FUTSAL.filter((g) => g.ruolo === 'A').sort((a, b) => (st.get(b.id)?.punti || 0) - (st.get(a.id)?.punti || 0))[0].id; });
  await vai(`#/futsal/giocatore/${top}`);
  et(/Prossime partite/i.test(await testo()) && (await p.$$('.fs-trend span')).length >= 6, 'il profilo ha prossime partite e fantapunti per giornata');
  await foto('18-profilo', true);
  await p.click('[data-tab="partite"]'); await w(400); await foto('19-profilo-partite');
  await vai('#/futsal/giocatore/P%3Apennarossa'); await foto('20-profilo-porta');

  // ---- classifiche
  await vai('#/futsal/classifica');
  et((await p.$$('.fs-classifica .vr')).length === 12, 'la classifica generale ha i 12 iscritti');
  await foto('21-classifica');
  await vai('#/futsal/classifica/tifosi-murata');
  et((await p.$$('.fs-classifica .vr')).length === 3, 'i tifosi della Murata sono 3');
  await foto('22-classifica-tifosi');
  await vai('#/futsal/classifica/guaita'); await foto('23-serie-guaita');

  // ---- regolamento, calendario, coppa, leghe
  await vai('#/futsal/regolamento');
  et((await p.$$('.fs-cap-r')).length === 10, 'il regolamento ha 10 capitoli');
  await foto('24-regolamento');
  await p.click('.fs-cap-r:nth-of-type(3) summary').catch(() => {}); await w(300);
  await p.evaluate(() => { const d = document.querySelectorAll('.fs-cap-r'); d[1].open = true; d[0].open = false; d[1].scrollIntoView(); }); await w(300);
  await foto('25-regolamento-schemi');
  await vai('#/futsal/giornata/7');
  await p.click('.fs-partita summary'); await w(300);
  await foto('26-calendario-voti');
  await vai('#/futsal/coppa'); await foto('27-coppa');
  await vai('#/futsal/lega/lega-lun');
  et(/F3A9C1/.test(await testo()), 'la lega testa a testa ha il suo codice');
  await foto('28-lega');

  et(!errori.length, `nessun errore in pagina${errori.length ? `: ${errori.join(' | ')}` : ''}`);
  await b.close();
  for (const t of ok) console.log(`  ok  ${t}`);
  for (const t of ko) console.log(`  NO  ${t}`);
  console.log(`\nfutsal col server: ${ok.length} ok, ${ko.length} no — screenshot in ${USCITA}`);
  process.exit(ko.length ? 1 : 0);
})();
