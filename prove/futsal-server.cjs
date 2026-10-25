/**
 * Il FantaFutsal col server (supabase/migrations/futsal-01): iscrizione,
 * consegna della formazione dal campo, classifica, migliore della giornata,
 * coppa (prima del sorteggio) e una lega testa a testa con gli amici.
 *
 * Gli altri undici iscritti e le loro formazioni delle giornate 1-6 si
 * scrivono nel finto database prima di ricaricare: sono formazioni vere, che
 * rispettano le regole, scelte a caso dal listone.
 *
 * Gli screenshot finiscono in $USCITA.
 */
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:4173';
const USCITA = process.env.USCITA || '/tmp';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, timezoneId: 'Europe/Rome', locale: 'it-IT', isMobile: true, hasTouch: true, serviceWorkers: 'block' });
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
  const testo = () => p.evaluate(() => document.querySelector('main')?.innerText || '');

  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await w(250);
  await p.fill('#email', 'alex@e.it'); await p.fill('#name', 'Alex'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1200);

  // ---- iscrizione dalla home
  await p.evaluate(() => { location.hash = '#/futsal'; }); await w(900);
  et(!!(await p.$('#fs-iscriviti')), 'senza iscrizione la home propone di iscriversi');
  await foto('1-iscriviti');
  await p.fill('#fs-squadra', 'Titani Futsal'); await p.click('#fs-iscriviti'); await w(900);
  et(/Titani Futsal/.test(await testo()), "iscritto: la squadra compare in cima");

  // ---- undici avversari, e le formazioni di tutti dalla 1ª alla 6ª
  await p.evaluate(async () => {
    const F = await import('/src/futsal.js');
    const s = JSON.parse(localStorage.getItem('fcs:mock'));
    const io = s.userId;
    let seme = 7; const caso = () => { seme = (seme * 16807) % 2147483647; return seme / 2147483647; };
    const nomi = ['Borgo C5', 'Serravalle Five', 'Dogana Calcetto', 'Acquaviva Futsal', 'Tre Penne Fans', 'Murata Boys', 'Faetano Pivot', 'Libertas Ultras', 'Cosmos Club', 'Fiorentino Five', 'Montegiardino C5'];
    const colori = ['#C0392B', '#27AE60', '#8E44AD', '#E67E22', '#16A085', '#2C3E50', '#B03A2E', '#0B3D91', '#E8B53A', '#0E6B3D', '#8E1B2E'];
    s.tables.profiles.push(...nomi.map((n, i) => ({ id: `amico${i}`, display_name: n })));
    s.tables.futsal_iscritti.push(...nomi.map((n, i) => ({ user_id: `amico${i}`, squadra: n, colore: colori[i], iniziali: n.split(' ').map((x) => x[0]).join('').slice(0, 3).toUpperCase(), created_at: '2026-09-10T10:00:00Z' })));
    s.tables.futsal_formazioni ||= [];
    const scegli = (lista) => lista[Math.floor(caso() * lista.length)];
    for (const uid of [io, ...nomi.map((_, i) => `amico${i}`)]) {
      for (const g of F.giocate()) {
        if (uid !== io && caso() < 0.08) continue; // qualcuno ogni tanto dimentica
        const usati = new Set(F.riposa(g));
        const porta = scegli(F.SQUADRE.filter((x) => !usati.has(x.id))).id; usati.add(porta);
        const modulo = caso() < 0.3 ? '3-1' : '2-2';
        const prendi = (r) => { const g2 = scegli(F.GIOCATORI_FUTSAL.filter((x) => x.ruolo === r && !usati.has(x.club))); usati.add(g2.club); return g2.id; };
        const titolari = modulo === '2-2' ? [prendi('D'), prendi('D'), prendi('A'), prendi('A')] : [prendi('D'), prendi('D'), prendi('D'), prendi('A')];
        const panchina = [prendi('D'), prendi('A')];
        s.tables.futsal_formazioni.push({ user_id: uid, giornata: g, formazione: { modulo, porta, titolari, panchina, capitano: titolari.at(-1), vice: titolari[0] }, consegnata_at: '2026-10-01T18:00:00Z' });
      }
    }
    // una lega di amici testa a testa partita dalla 2ª, e una a somma
    s.tables.futsal_leghe = [
      { id: 'lega-lun', nome: 'Amici del lunedì', tipo: 'testa', codice: 'F3A9C1', creata_da: io, avvio_giornata: 2, membri_avvio: [io, 'amico0', 'amico1', 'amico2', 'amico3', 'amico4'], created_at: '2026-09-15T10:00:00Z' },
      { id: 'lega-uff', nome: 'Ufficio', tipo: 'somma', codice: 'F77B02', creata_da: 'amico5', avvio_giornata: null, membri_avvio: null, created_at: '2026-09-15T10:00:00Z' }];
    s.tables.futsal_membri = [...['lega-lun'].flatMap((l) => [io, 'amico0', 'amico1', 'amico2', 'amico3', 'amico4'].map((u, i) => ({ lega_id: l, user_id: u, entrato_at: `2026-09-15T10:0${i}:00Z` }))),
      ...[io, 'amico5', 'amico6', 'amico7'].map((u, i) => ({ lega_id: 'lega-uff', user_id: u, entrato_at: `2026-09-16T10:0${i}:00Z` }))];
    localStorage.setItem('fcs:mock', JSON.stringify(s));
  });
  await p.reload({ waitUntil: 'load' }); await w(1500);
  await p.evaluate(() => { location.hash = '#/futsal'; }); await w(1200);
  const home = await testo();
  et(/Migliore della giornata/i.test(home), 'la home mostra il migliore della giornata');
  et(/su 12/.test(home), 'e il posto in classifica fra 12 iscritti');
  await foto('2-home', true);

  // ---- la formazione della 7ª dal campo
  await p.evaluate(() => { location.hash = '#/futsal/formazione'; }); await w(900);
  await foto('3-campo-vuoto');
  const scegli = async (slot, n = 0) => {
    await p.click(`[data-slot="${slot}"]`); await w(350);
    const bottoni = await p.$$('#sheet [data-scegli]:not([disabled])');
    await bottoni[n].click(); await w(350);
  };
  await scegli('P:0', 4); await scegli('D:0', 1); await scegli('D:1', 3); await scegli('A:0', 0); await scegli('A:1', 2);
  await scegli('pD:0', 5); await scegli('pA:0', 5);
  await p.click('[data-slot="A:0"]'); await w(300); await p.click('[data-fascia="capitano"]'); await w(300);
  await p.click('[data-slot="D:0"]'); await w(300); await p.click('[data-fascia="vice"]'); await w(300);
  await foto('4-campo-pronto', true);
  await p.click('#fs-salva'); await w(1200);
  const consegnata = await p.evaluate(() => JSON.parse(localStorage.getItem('fcs:mock')).tables.futsal_formazioni.find((f) => f.giornata === 7));
  et(consegnata && consegnata.formazione.titolari.length === 4 && consegnata.formazione.panchina.length === 2, 'la formazione della 7ª è sul server, nel formato della migrazione');
  await p.evaluate(() => { location.hash = '#/futsal/formazione'; }); await w(800);
  et(/consegnata/.test(await testo()), 'e la schermata dice quando è stata consegnata');
  await foto('5-campo-consegnato');

  // ---- una giornata gia' giocata: il campo coi punti
  await p.evaluate(() => { location.hash = '#/futsal/formazione/6'; }); await w(900);
  const sesta = await testo();
  et(/fantapunti/.test(sesta) && !(await p.$('#fs-salva')), 'la 6ª è chiusa: campo coi punti, niente da salvare');
  await foto('6-campo-con-punti', true);

  // ---- classifica, coppa, leghe
  await p.evaluate(() => { location.hash = '#/futsal/classifica'; }); await w(900);
  et((await p.$$('.fs-classifica .vr')).length === 12, 'la classifica ha i 12 iscritti');
  await foto('7-classifica');
  await p.evaluate(() => { location.hash = '#/futsal/coppa'; }); await w(800);
  et(/12 iscritti/.test(await testo()), 'la coppa, prima del sorteggio, dice il formato coi 12 iscritti');
  await foto('8-coppa');
  await p.evaluate(() => { location.hash = '#/futsal/leghe'; }); await w(800);
  await foto('9-leghe');
  await p.evaluate(() => { location.hash = '#/futsal/lega/lega-lun'; }); await w(800);
  const lega = await testo();
  et(/F3A9C1/.test(lega) && (await p.$$('.fs-classifica .vr')).length === 6, 'la lega testa a testa ha codice, classifica a 6 e gli scontri');
  await foto('10-lega-testa', true);
  // i punti fatti in lega sono la somma dei punteggi di giornata di quella squadra
  const somme = await p.evaluate(async () => {
    const FS = await import('/src/futsal-server.js');
    return ['amico0', 'amico2'].map((id) => [2, 3, 4, 5, 6].map((g) => FS.punti(g, id)));
  });
  console.log('    punteggi di giornata amico0 / amico2:', JSON.stringify(somme));
  const righe = await p.evaluate(() => [...document.querySelectorAll('.fs-classifica .vr')].map((r) => r.innerText.replace(/\s+/g, ' ')));
  const fatti = (nome) => Number((righe.find((r) => r.includes(nome)) || '').match(/([\d.,]+) fatti/)?.[1].replace(',', '.'));
  et(Math.abs(fatti('Borgo C5') - somme[0].reduce((s, x) => s + x, 0)) < 0.01, `Borgo C5: i punti fatti tornano (${fatti('Borgo C5')})`);
  et(Math.abs(fatti('Dogana Calcetto') - somme[1].reduce((s, x) => s + x, 0)) < 0.01, `Dogana Calcetto: i punti fatti tornano (${fatti('Dogana Calcetto')})`);

  et(!errori.length, `nessun errore in pagina${errori.length ? `: ${errori.join(' | ')}` : ''}`);
  await b.close();
  for (const t of ok) console.log(`  ok  ${t}`);
  for (const t of ko) console.log(`  NO  ${t}`);
  console.log(`\nfutsal col server: ${ok.length} ok, ${ko.length} no — screenshot in ${USCITA}`);
  process.exit(ko.length ? 1 : 0);
})();
