/**
 * Le righe delle impostazioni devono funzionare con TUTTI E TRE i temi.
 *
 * Nasce da un errore vero: applyTheme() scrive data-theme sull'<html>, e il
 * gestore cercava il tasto del tema con closest('[data-theme]'), che risaliva
 * fino alla radice e trovava sempre qualcosa. Con il tema su Chiaro o Scuro
 * ogni tocco veniva preso per un cambio di tema e nessuna riga funzionava.
 * Con "Sistema" l'attributo non c'e' e tutto sembrava a posto: per questo le
 * prove di prima, che giravano tutte su "system", non lo vedevano.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  for (const tema of ['system', 'light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    await ctx.addInitScript((tema) => {
      window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
      localStorage.setItem('fcs:auth', 'supabase');
      localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, theme: tema }));
      localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
    }, tema);
    const p = await ctx.newPage(); p.on('dialog', d => d.accept());
    const errori = []; p.on('pageerror', e => errori.push(e.message));
    await p.evaluate(() => {}).catch(() => {});
    const w = (ms = 450) => p.waitForTimeout(ms);
    await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1200);
    await p.click('[data-tab="up"]'); await w(250);
    await p.fill('#email', 'a@e.it'); await p.fill('#name', 'Alessandro'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(1000);
    await p.click('[data-form="create"]'); await w(250);
    await p.fill('#lname', 'Prova'); await p.fill('#team', 'Prova FC'); await p.click('#go-create'); await w(1200);

    // 1. una riga che naviga
    await p.evaluate(() => { location.hash = '#/impostazioni'; }); await w(800);
    await p.click('[data-act="avanzate"]'); await w(800);
    const dove = await p.evaluate(() => location.hash);
    et(dove === '#/impostazioni/avanzate', `${tema}: "Impostazioni avanzate" porta dove deve (${dove})`);
    if (dove !== '#/impostazioni/avanzate') { await ctx.close(); continue; }

    // 2. una riga che cambia una preferenza
    const prima = await p.evaluate(() => JSON.parse(localStorage.getItem('fcs:prefs')).sfondoFoto);
    await p.click('[data-act="sfondo"]'); await w(700);
    const dopo = await p.evaluate(() => JSON.parse(localStorage.getItem('fcs:prefs')).sfondoFoto);
    et(prima !== dopo, `${tema}: l'interruttore della copertina cambia (${prima} -> ${dopo})`);

    // 3. una riga che apre un foglio
    await p.click('[data-act="server"]'); await w(700);
    const foglio = await p.evaluate(() => ({ on: !!document.querySelector('#sheet')?.classList.contains('on'), testo: document.querySelector('#sheet')?.innerText.slice(0, 40) || '' }));
    et(foglio.on && /Server/.test(foglio.testo), `${tema}: "Server della lega" apre il foglio (${foglio.testo.split('\n')[0]})`);
    await p.evaluate(() => { document.getElementById('sheet-scrim')?.click(); }); await w(400);

    // 4. la diagnostica dello schermo
    await p.click('[data-act="schermo"]'); await w(900);
    const mis = await p.evaluate(() => document.querySelector('#sheet')?.innerText || '');
    et(/Misure dello schermo/.test(mis), `${tema}: "Misure dello schermo" si apre`);
    await p.evaluate(() => { document.getElementById('sheet-scrim')?.click(); }); await w(400);

    // 5. e il tasto del tema continua a funzionare
    const bersaglio = tema === 'dark' ? 'light' : 'dark';
    await p.click(`button[data-theme="${bersaglio}"]`); await w(700);
    const applicato = await p.evaluate(() => ({ attr: document.documentElement.getAttribute('data-theme'), pref: JSON.parse(localStorage.getItem('fcs:prefs')).theme }));
    et(applicato.pref === bersaglio && applicato.attr === bersaglio, `${tema}: il tema si cambia ancora (${applicato.pref}/${applicato.attr})`);
    // e torna a "Sistema", che deve togliere l'attributo
    await p.click('button[data-theme="system"]'); await w(700);
    const sistema = await p.evaluate(() => document.documentElement.getAttribute('data-theme'));
    et(sistema === null, `${tema}: "Sistema" togle l'attributo dall'html (${sistema})`);

    // 6. L'INIZIALE DELL'AVATAR SU OGNI COLORE DELLA TAVOLOZZA.
    // Il colore della squadra l'app lo pesca a caso, e l'iniziale del profilo
    // era bianca fissa: sull'oro (#d4a017) misurava 2,38 di contrasto. L'audit
    // lo vedeva una volta su dieci, cioe' quando il caso pescava quel colore.
    // Qui i colori si impongono tutti, uno dopo l'altro, e la prova non
    // dipende piu' dalla fortuna.
    if (tema === 'light') {
      const TAVOLOZZA = ['#1B84C6', '#2b7a3d', '#8a1d1d', '#5b3fa6', '#c46a00', '#1a1a1a', '#2c7a7b', '#b8321f', '#d4a017', '#0e5e93'];
      const storti = [];
      for (const c of TAVOLOZZA) {
        await p.evaluate((c) => {
          const s = JSON.parse(localStorage.getItem('fcs:mock'));
          s.tables.league_members.find((m) => m.user_id === s.userId).color = c;
          localStorage.setItem('fcs:mock', JSON.stringify(s));
        }, c);
        await p.evaluate(() => { location.hash = '#/impostazioni'; });
        await p.reload({ waitUntil: 'load' }); await w(1500);
        const m = await p.evaluate(() => {
          const e = document.querySelector('.pf-av'); if (!e) return null;
          const cs = getComputedStyle(e);
          const leggi = (v) => { const n = v.match(/[\d.]+/g).slice(0, 3).map(Number); return { r: n[0], g: n[1], b: n[2] }; };
          const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
            return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
          const a = lum(leggi(cs.color)), b = lum(leggi(cs.backgroundColor));
          return { r: +(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05))).toFixed(2), testo: cs.color, fondo: cs.backgroundColor, px: parseFloat(cs.fontSize) };
        });
        if (!m) { storti.push(`${c}: nessun avatar`); continue; }
        if (m.r < 4.5) storti.push(`${c}: ${m.r} (${m.testo} su ${m.fondo})`);
      }
      et(storti.length === 0, storti.length
        ? `l'iniziale del profilo non si legge su ${storti.length} colori — ${storti.slice(0, 3).join(' | ')}`
        : `l'iniziale del profilo si legge su tutti i ${TAVOLOZZA.length} colori della tavolozza (AA 4,5)`);
    }
    // 7. UN NOME SOLO, E CAMBIARLO SI VEDE.
    // Due segnalazioni di fila sulla stessa cosa: "se cambio nome nell'app non
    // avviene modifica", e poi "in un posto mi chiamo Hyrox12 ma nel menu
    // appare il vecchio Conti25". Il nome mostrato era la copia dentro
    // league_members (owner_name), scritta all'ingresso nella lega e mai piu'
    // toccata. Ora l'app mostra il nome vivo del profilo e la copia si
    // riallinea: qui si prova che cambiarlo si vede, e che una copia vecchia
    // rimasta nel database non vince piu' sul nome dell'account.
    if (tema === 'light') {
      await p.evaluate(() => { location.hash = '#/impostazioni'; }); await w(900);
      await p.click('[data-act="name"]'); await w(500);
      await p.fill('#pv', 'Alex Conti'); await p.click('#pv-save'); await w(1800);
      const dopoNome = await p.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('fcs:mock'));
        return { conto: s.tables.profiles.find((x) => x.id === s.userId).display_name,
          lega: s.tables.league_members.find((m) => m.user_id === s.userId).owner_name,
          schermo: document.body.innerText };
      });
      et(dopoNome.conto === 'Alex Conti', `il nome dell'account cambia (${dopoNome.conto})`);
      et(dopoNome.lega === 'Alex Conti', `e cambia anche quello che si vede nella lega (${dopoNome.lega})`);
      et(/Alex Conti/.test(dopoNome.schermo), 'e la schermata lo mostra subito');
      // il menu, che e' il posto dove Alex guardava
      await p.evaluate(() => { location.hash = '#/'; }); await w(1200);
      await p.click('[data-open-drawer]'); await w(600);
      const menu = await p.evaluate(() => document.querySelector('.d-chi b')?.innerText || '');
      et(/Alex Conti/i.test(menu), `e nel menu c'è il nome nuovo ("${menu}")`);
      await p.evaluate(() => { document.querySelector('.a-drawer .scrim')?.click(); }); await w(300);
      // LA COPIA VECCHIA NON VINCE. E' il caso di Alex: nel database resta
      // scritto il nome di prima, e il menu mostrava quello. Qui la copia si
      // sporca a mano, senza toccare il profilo, e il nome giusto deve
      // restare quello dell'account.
      await p.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('fcs:mock'));
        s.tables.league_members.find((m) => m.user_id === s.userId).owner_name = 'Conti25';
        localStorage.setItem('fcs:mock', JSON.stringify(s));
      });
      await p.evaluate(() => { location.hash = '#/'; });
      await p.reload({ waitUntil: 'load' }); await w(2000);
      await p.click('[data-open-drawer]'); await w(600);
      const sporca = await p.evaluate(() => document.querySelector('.d-chi b')?.innerText || '');
      et(/Alex Conti/i.test(sporca) && !/Conti25/i.test(sporca),
        `una copia vecchia nel database non vince sul nome dell'account ("${sporca}")`);
      await p.evaluate(() => { document.querySelector('.a-drawer .scrim')?.click(); }); await w(300);
      // e cambiando di nuovo il nome la copia si riallinea
      await p.evaluate(() => { location.hash = '#/impostazioni'; }); await w(1000);
      await p.click('[data-act="name"]'); await w(500);
      await p.fill('#pv', 'Alessandro Conti'); await p.click('#pv-save'); await w(1800);
      const riallineata = await p.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('fcs:mock'));
        return { conto: s.tables.profiles.find((x) => x.id === s.userId).display_name,
          lega: s.tables.league_members.find((m) => m.user_id === s.userId).owner_name };
      });
      et(riallineata.conto === 'Alessandro Conti' && riallineata.lega === 'Alessandro Conti',
        `e la copia nel database si riallinea (${riallineata.conto} / ${riallineata.lega})`);
      // il secondo nome non si scrive piu' da "La mia squadra"
      await p.evaluate(() => { location.hash = '#/squadra'; }); await w(1400);
      const squadra = await p.evaluate(() => ({
        campo: !!document.querySelector('#owner'),
        testo: document.body.innerText.replace(/\n/g, ' '),
      }));
      et(!squadra.campo, 'in "La mia squadra" non c\'è più un secondo nome da scrivere');
      et(/impostazioni/i.test(squadra.testo) && /Alessandro Conti/.test(squadra.testo),
        'e dice qual è il tuo nome e dove si cambia');
    }
    et(errori.length === 0, errori.length ? `${tema} eccezioni: ${errori.join(' | ')}` : `${tema}: nessuna eccezione`);
    await ctx.close();
  }
  await b.close();
  console.log('PASSATI (' + ok.length + ')'); ok.forEach(s => console.log('  ok  ' + s));
  console.log(ko.length ? '\nFALLITI (' + ko.length + ')' : '\nnessun problema'); ko.forEach(s => console.log('  KO  ' + s));
  process.exit(ko.length ? 1 : 0);
})();
