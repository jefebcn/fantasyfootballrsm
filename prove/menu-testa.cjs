/**
 * Il menu laterale: le etichette centrate sul riquadro dell'icona, e la testa
 * che non si sfascia coi nomi lunghi.
 *
 * LA CENTRATURA. Il browser centra la RIGA di testo, alta ascendente +
 * discendente del font; la banda delle maiuscole — quella che l'occhio
 * allinea — ne sta sopra il centro. Misurato su questo menu: cadeva 0,99px
 * sotto il centro del riquadro, uguale su ogni voce. Un pixel non sembra
 * niente, ma su sedici righe in colonna si legge come "il testo pende".
 *
 * Qui si misura col metodo giusto: metriche del font dalla tela
 * (fontBoundingBoxAscent/Descent per sapere dov'e' la linea di base dentro la
 * riga, altezza della "H" per la banda delle maiuscole). Non si guarda la
 * riga, che e' quello che aveva ingannato la prima misura.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);
const SOGLIA = 0.6;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  for (const tema of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    await ctx.addInitScript((tema) => {
      window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
      localStorage.setItem('fcs:auth', 'supabase');
      localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, theme: tema }));
      localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
    }, tema);
    const p = await ctx.newPage(); p.on('dialog', d => d.accept());
    const errori = []; p.on('pageerror', e => errori.push(e.message));
    const w = (ms = 400) => p.waitForTimeout(ms);
    await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
    await p.click('[data-tab="up"]'); await w(250);
    await p.fill('#email', 'a@e.it'); await p.fill('#name', 'Conti25'); await p.fill('#password', 'password123'); await p.click('#primary'); await w(900);
    await p.click('[data-form="create"]'); await w(250);
    // un nome squadra lungo di proposito: e' quello che faceva uscire il testo
    // dalla sua scatola nella testa vecchia
    await p.fill('#lname', 'Torneo Titano'); await p.fill('#team', 'Hasta El Roxy Fantacalcio Club'); await p.click('#go-create'); await w(1400);
    await p.evaluate(() => { location.hash = '#/'; }); await w(800);
    await p.click('[data-open-drawer]'); await w(700);
    await p.evaluate(() => document.fonts && document.fonts.ready); await w(400);

    const r = await p.evaluate(() => {
      const cv = document.createElement('canvas'); const g = cv.getContext('2d');
      const righe = [];
      for (const it of document.querySelectorAll('.d-item')) {
        const box = it.querySelector('i'); const lab = it.querySelector('.et');
        if (!box || !lab) continue;
        const cs = getComputedStyle(lab);
        g.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const m = g.measureText(lab.textContent.trim());
        const capH = g.measureText('H').actualBoundingBoxAscent;
        const A = m.fontBoundingBoxAscent, D = m.fontBoundingBoxDescent;
        const rl = lab.getBoundingClientRect(), rb = box.getBoundingClientRect();
        const alta = rl.height - (parseFloat(cs.paddingBottom) || 0);
        const base = rl.y + (alta - (A + D)) / 2 + A;
        righe.push({ t: lab.textContent.trim().slice(0, 20), d: +((base - capH / 2) - (rb.y + rb.height / 2)).toFixed(2) });
      }
      // le pastiglie di sezione ("nuvolette"): la riga di testo la si legge col
      // Range, non col rettangolo dell'elemento, perche' dentro la pastiglia
      // c'e' il padding e il rettangolo direbbe il posto sbagliato
      const nuvole = [];
      for (const c of document.querySelectorAll('.d-sec .chip')) {
        const nodo = [...c.childNodes].find((n) => n.nodeType === 3);
        if (!nodo) continue;
        const rg = document.createRange(); rg.selectNode(nodo);
        const rt = rg.getBoundingClientRect(), rc = c.getBoundingClientRect();
        const cs = getComputedStyle(c);
        g.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const m = g.measureText(nodo.textContent.trim());
        const capH = g.measureText('H').actualBoundingBoxAscent;
        const A = m.fontBoundingBoxAscent, D = m.fontBoundingBoxDescent;
        const base = rt.y + (rt.height - (A + D)) / 2 + A;
        nuvole.push({ t: nodo.textContent.trim().slice(0, 20),
          d: +((base - capH / 2) - (rc.y + rc.height / 2)).toFixed(2),
          alta: +rc.height.toFixed(1) });
      }
      // le icone: una misura sola per tutte, contorni e illustrate
      const misure = [...new Set([...document.querySelectorAll('.d-item i > *')]
        .map((f) => { const r = f.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}`; }))];
      // la testa: niente testo che esce dalla sua scatola
      const sbordano = [];
      for (const s of document.querySelectorAll('.d-chi b, .d-chi span, .d-nl b, .d-nl small')) {
        if (s.scrollWidth > Math.ceil(s.getBoundingClientRect().width) + 1) sbordano.push(`${s.className || s.tagName}: ${s.scrollWidth} > ${Math.round(s.getBoundingClientRect().width)}`);
      }
      const q = (s) => !!document.querySelector(s);
      const fuori = [...document.querySelectorAll('.a-drawer .panel *')].filter((e) => {
        const r = e.getBoundingClientRect(); const rp = document.querySelector('.a-drawer .panel').getBoundingClientRect();
        return r.width > 0 && (r.right > rp.right + 1 || r.left < rp.left - 1);
      }).map((e) => e.className).slice(0, 3);
      return { righe, nuvole, misure, sbordano, fuori,
        pezzi: { stemma: q('.d-io .crest'), nome: q('.d-chi b'), esci: q('.d-esci'), lega: q('.d-lega'), conta: (document.querySelector('.d-nl small')?.textContent || '') } };
    });

    const storte = r.righe.filter((x) => Math.abs(x.d) > SOGLIA);
    et(r.righe.length >= 10, `${tema}: ${r.righe.length} voci misurate`);
    et(storte.length === 0, storte.length
      ? `${tema}: ${storte.length} etichette fuori centro (${storte.slice(0, 3).map((x) => `${x.t} ${x.d}`).join(', ')})`
      : `${tema}: tutte le etichette centrate entro ${SOGLIA}px (max ${Math.max(...r.righe.map((x) => Math.abs(x.d))).toFixed(2)})`);
    const nuvStorte = r.nuvole.filter((x) => Math.abs(x.d) > SOGLIA);
    et(r.nuvole.length >= 3, `${tema}: ${r.nuvole.length} pastiglie di sezione misurate`);
    et(nuvStorte.length === 0, nuvStorte.length
      ? `${tema}: ${nuvStorte.length} pastiglie col testo fuori centro (${nuvStorte.slice(0, 3).map((x) => `${x.t} ${x.d} in una alta ${x.alta}`).join(', ')})`
      : `${tema}: testo centrato in tutte le pastiglie entro ${SOGLIA}px (max ${Math.max(...r.nuvole.map((x) => Math.abs(x.d))).toFixed(2)})`);
    // la pastiglia e' un'etichetta, non un bersaglio da toccare: se si porta
    // dietro il min-height:38px di .chip il testo torna a pendere in alto
    et(r.nuvole.every((x) => x.alta < 34), `${tema}: pastiglie alte quanto il testo (${r.nuvole[0]?.alta}px), non 38 come i bersagli di tocco`);
    et(r.misure.length === 1, `${tema}: una misura sola per le icone (${r.misure.join(', ')})`);
    et(r.sbordano.length === 0, r.sbordano.length ? `${tema}: testo che esce dalla sua scatola — ${r.sbordano.join(' | ')}` : `${tema}: nessun testo che sborda, anche col nome squadra lungo`);
    et(r.fuori.length === 0, r.fuori.length ? `${tema}: qualcosa esce dal pannello (${r.fuori.join(', ')})` : `${tema}: niente esce dal pannello`);
    et(r.pezzi.stemma && r.pezzi.nome && r.pezzi.esci && r.pezzi.lega, `${tema}: la testa ha stemma, nome, uscita e scheda della lega`);
    et(/partecipant/.test(r.pezzi.conta) && /cambia lega/.test(r.pezzi.conta), `${tema}: la scheda dice quanti sono e dove porta ("${r.pezzi.conta}")`);
    // LA PORTA. La sezione "Amministrazione" e la voce che porta alla console
    // le deve vedere solo chi amministra l'app. Questo utente e' il primo
    // iscritto, quindi nel mock e' Giudice Dati — le sezioni scure esistono —
    // ma amministratore dell'app non e'. Una volta sola: la porta non cambia
    // col tema.
    if (tema === 'light') {
      const sez = () => p.evaluate(() => ({
        pastiglie: [...document.querySelectorAll('.d-sec .chip')].map((c) => c.textContent.trim()),
        console: !!document.querySelector('.a-drawer [href="#/admin/console"]'),
      }));
      const senza = await sez();
      et(!senza.pastiglie.some((t) => /amministrazione/i.test(t)),
        `chi non amministra l'app non vede la sezione Amministrazione (${senza.pastiglie.join(' · ')})`);
      et(!senza.console, 'e non vede la voce che porta alla console');
      // amministratori si diventa come per davvero: dal database
      await p.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('fcs:mock'));
        s.tables.profiles.find((x) => x.id === s.userId).is_admin = true;
        localStorage.setItem('fcs:mock', JSON.stringify(s));
      });
      await p.reload({ waitUntil: 'load' }); await w(1700);
      await p.click('[data-open-drawer]'); await w(600);
      const con = await sez();
      et(con.pastiglie.some((t) => /amministrazione/i.test(t)) && con.console,
        `a chi amministra l'app compaiono sezione e console (${con.pastiglie.join(' · ')})`);
    }
    et(errori.length === 0, `${tema}: nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
    await ctx.close();
  }
  await b.close();
  for (const t of ok) console.log('  ok  ' + t);
  for (const t of ko) console.log('  KO  ' + t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
