/**
 * Le icone dell'app: dentro ogni gruppo stessa grandezza ottica, e in pagina
 * stesso riquadro, allineate, con la stessa aria intorno.
 *
 * Nasce da un difetto nei file, non nel CSS. Nella barra in basso le cinque
 * icone erano disegnate tutte larghe 112px su una tela da 128 ma alte da 62 a
 * 108, e il calendario era per giunta a meta' scala degli altri: sullo schermo
 * veniva alto 11,6pt contro i 20,2 della coppa. Nel menu era piu' sottile ma
 * uguale: da 112x74 (squadre) a 113x113 (voti), cioe' il 21% di scarto fra la
 * piu' leggera e la piu' pesante.
 *
 * La grandezza ottica e' la media geometrica di base e altezza dell'inchiostro
 * vero: e' quella che l'occhio legge come "peso", non il riquadro. Un campo
 * resta largo e una coppa resta alta, ma pesano uguale.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

const GRUPPI = {
  nav: { cartella: 'nav', tolleranza: 0.08, max: 120,
         icone: ['campo', 'maglia-10', 'calendario', 'coppa', 'grafico'] },
  menu: { cartella: 'menu', tolleranza: 0.08, max: 122,
          icone: ['assist', 'fantascore', 'guide', 'leghe', 'live', 'probabili', 'quotazioni',
                  'squadre', 'statistiche', 'trasferimenti', 'vice-allenatore', 'voti'] },
  // Tredici delle ventiquattro non sono ancora usate da nessuna parte, ma sono
  // dello stesso set e prima o poi entrano: se restassero fuori squadra, il
  // giorno che si accende un gol-x2 stonerebbe accanto agli altri.
  eventi: { cartella: 'eventi', tolleranza: 0.08, max: 122,
            icone: ['ammonizione', 'assist', 'assist-x2', 'autogol', 'azione-pericolosa',
                    'calcio-inizio', 'capitano', 'corner', 'espulsione', 'espulsione-x2',
                    'fuorigioco', 'gol', 'gol-pareggio', 'gol-subito', 'gol-vittoria', 'gol-x2',
                    'palo', 'porta-inviolata', 'recupero', 'rigore-parato', 'rigore-sbagliato',
                    'rigore-segnato', 'sostituzione-in', 'sostituzione-out'] },
  // le quindici della pagina Gestione: si vedono in griglia, una accanto
  // all'altra, quindi se una pesa diverso si nota subito
  lega: { cartella: 'lega', tolleranza: 0.08, max: 122,
          icone: ['andamento', 'calcola', 'calendario', 'chat', 'classifica', 'impostazioni',
                  'la-mia-squadra', 'live', 'premi', 'probabili-formazioni', 'rose', 'scambi',
                  'strumenti', 'supporto', 'trofei'] },
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: 393, height: 793 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    addEventListener('DOMContentLoaded', () => {
      const st = document.createElement('style');
      st.textContent = ':root{--sa-top:0px;--sa-bottom:34px}';
      document.head.appendChild(st);
    });
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    localStorage.setItem('fcs:auth', 'supabase');
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, theme: 'dark' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
  });
  const p = await ctx.newPage(); p.on('dialog', d => d.accept());
  const w = (ms = 450) => p.waitForTimeout(ms);
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);

  // --- i file: grandezza ottica dell'inchiostro, misurata sul pixel vero e con
  //     la stessa soglia dello script che li normalizza (scripts/normalizza-icone.py)
  const misura = (cartella, nomi) => p.evaluate(async ({ cartella, nomi }) => {
    const out = {};
    for (const n of nomi) {
      const im = new Image(); im.src = `/media/icone/${cartella}/${n}.png`;
      await im.decode();
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
      const x = c.getContext('2d'); x.drawImage(im, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data;
      const colonna = new Array(c.width).fill(0), riga = new Array(c.height).fill(0);
      for (let y = 0; y < c.height; y++) for (let xx = 0; xx < c.width; xx++) {
        if (d[(y * c.width + xx) * 4 + 3] > 40) { colonna[xx]++; riga[y]++; }
      }
      // almeno 8 pixel per riga/colonna: una traccia sperduta non deve contare.
      // Senza, un artefatto da sette pixel sul bordo del calendario allargava
      // la misura da 64 a 112 e nascondeva che era a meta' scala.
      const vivi = (a) => { const i = a.findIndex(v => v >= 8); const j = a.length - 1 - [...a].reverse().findIndex(v => v >= 8); return [i, j]; };
      const [x0, x1] = vivi(colonna), [y0, y1] = vivi(riga);
      out[n] = { tela: [c.width, c.height], w: x1 - x0 + 1, h: y1 - y0 + 1, x0, y0 };
    }
    return out;
  }, { cartella, nomi });

  for (const [g, cfg] of Object.entries(GRUPPI)) {
    const mis = await misura(cfg.cartella, cfg.icone);
    const valori = cfg.icone.map(n => Math.sqrt(mis[n].w * mis[n].h));
    const media = valori.reduce((a, c) => a + c, 0) / valori.length;
    const peggio = Math.max(...valori.map(v => Math.abs(v / media - 1)));
    console.log(`  ${g}:`, cfg.icone.map((n, i) => `${n} ${valori[i].toFixed(0)}`).join(' · '));
    et(peggio <= cfg.tolleranza,
      `${g}: le ${cfg.icone.length} icone pesano uguale entro l'${(cfg.tolleranza * 100).toFixed(0)}% (scarto peggiore ${(peggio * 100).toFixed(1)}%)`);
    et(cfg.icone.every(n => mis[n].tela[0] === 128 && mis[n].tela[1] === 128), `${g}: tutte su una tela da 128`);
    et(cfg.icone.every(n => mis[n].w <= cfg.max && mis[n].h <= cfg.max), `${g}: nessuna tocca il bordo della tela`);
    const storte = cfg.icone.filter(n => Math.abs(mis[n].x0 - (128 - mis[n].w) / 2) > 1.5 || Math.abs(mis[n].y0 - (128 - mis[n].h) / 2) > 1.5);
    et(storte.length === 0, `${g}: tutte centrate nella tela${storte.length ? ' — fuori: ' + storte.join(', ') : ''}`);
  }

  // --- in pagina
  await p.click('[data-tab="up"]'); await w(250);
  await p.fill('#email', 'a@e.it'); await p.fill('#name', 'Conti25'); await p.fill('#password', 'password123');
  await p.click('#primary'); await w(1000);
  await p.click('[data-form="create"]'); await w(250);
  await p.fill('#lname', 'Torneo Titano'); await p.fill('#team', 'Hasta El Roxy'); await p.click('#go-create'); await w(1400);
  await p.evaluate(() => document.fonts && document.fonts.ready); await w(300);

  // barra in basso: allineamento e aria
  const g = await p.evaluate(() => {
    const nav = document.querySelector('.a-nav').getBoundingClientRect();
    const voci = [...document.querySelectorAll('.a-nav a')];
    const ico = voci.map(a => a.querySelector('.mi').getBoundingClientRect());
    // l'etichetta sta in uno <span> da quando l'icona ha la sua pastiglia;
    // prima era un nodo di testo nudo dentro l'<a>. Si cerca in tutti e due i
    // posti: quello che conta e' la RIGA vera del testo, letta col Range.
    const testi = voci.map(a => { const el = a.querySelector('span:not(.dot)') || a;
      const n = [...el.childNodes].find(x => x.nodeType === 3 && x.textContent.trim());
      if (!n) return null; const r = document.createRange(); r.selectNode(n); return r.getBoundingClientRect(); }).filter(Boolean);
    return {
      voceAlta: Math.min(...voci.map(a => Math.round(a.getBoundingClientRect().height))),
      cime: [...new Set(ico.map(r => Math.round((r.top - nav.top) * 10) / 10))],
      lati: [...new Set(ico.map(r => `${Math.round(r.width)}x${Math.round(r.height)}`))],
      sopra: Math.round((ico[0].top - nav.top) * 10) / 10,
      quantiTesti: testi.length,
      sotto: testi.length ? Math.round((nav.bottom - Math.max(...testi.map(t => t.bottom))) * 10) / 10 : null,
      riserva: 34 - 16,
    };
  });
  et(g.quantiTesti === 5, `barra: le cinque etichette si trovano e si misurano (${g.quantiTesti})`);
  et(g.cime.length === 1, `barra: le cinque icone partono tutte alla stessa altezza (${g.cime.join(', ')})`);
  et(g.lati.length === 1 && g.lati[0] === '26x26', `barra: e hanno tutte lo stesso riquadro (${g.lati.join(', ')})`);
  et(g.voceAlta >= 44, `barra: il riquadro da toccare e' di ${g.voceAlta}pt`);
  const sottoVisibile = g.sotto - g.riserva;
  et(Math.abs(g.sopra - sottoVisibile) <= 2,
    `barra: aria uguale sopra e sotto — ${g.sopra} sopra, ${sottoVisibile} sotto (la riserva per la barretta di casa, ${g.riserva}, non conta)`);

  // menu laterale: stesso riquadro, stessa aria, tutte alla stessa distanza dal bordo
  // la dashboard ha l'intestazione grande e nessun bottone menu: si passa da
  // una schermata con l'appbar normale
  await p.goto(`${BASE}/#/calendario`, { waitUntil: 'load' }); await w(900);
  await p.click('[data-open-drawer]'); await w(500);
  const m = await p.evaluate(() => {
    const voci = [...document.querySelectorAll('.a-drawer .d-item i.illus')];
    const dati = voci.map(i => {
      const t = i.getBoundingClientRect(), im = i.querySelector('.pic').getBoundingClientRect();
      return { tessera: `${Math.round(t.width)}x${Math.round(t.height)}`, pic: `${Math.round(im.width)}x${Math.round(im.height)}`,
        su: Math.round((im.top - t.top) * 10) / 10, giu: Math.round((t.bottom - im.bottom) * 10) / 10,
        sx: Math.round((im.left - t.left) * 10) / 10 };
    });
    const sfondi = [...new Set(voci.map(i => getComputedStyle(i).backgroundColor))];
    return { quante: voci.length, tessere: [...new Set(dati.map(d => d.tessera))], pics: [...new Set(dati.map(d => d.pic))],
      su: [...new Set(dati.map(d => d.su))], giu: [...new Set(dati.map(d => d.giu))], sx: [...new Set(dati.map(d => d.sx))], sfondi,
      bordi: [...new Set([...document.querySelectorAll('.a-drawer .d-item i')].map(i => Math.round(i.getBoundingClientRect().left)))],
      // anche le icone di contorno del menu: la misura deve essere LA STESSA
      // delle illustrate, se no la colonna e' irregolare e le voci a contorno
      // sembrano piu' leggere. Prima erano 20 contro 24.
      contorni: [...new Set([...document.querySelectorAll('.a-drawer .d-item i > svg')]
        .map(i => { const r = i.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}`; }))] };
  });
  console.log('  menu in pagina:', m.quante, 'icone illustrate · tessera', m.tessere.join('/'), '· pic', m.pics.join('/'));
  et(m.quante >= 8, `menu: ${m.quante} icone illustrate nel pannello`);
  et(m.tessere.length === 1, `menu: stessa tessera per tutte (${m.tessere.join(', ')})`);
  // Non si fissa il numero: si pretende che sia UNO SOLO, e lo stesso per le
  // illustrate e per quelle di contorno. Il valore e' una scelta di disegno e
  // puo' cambiare; che siano tutte uguali no. Prima qui c'era scritto 24x24 a
  // mano, e la prova e' diventata rossa il giorno che le ho pareggiate a 22.
  et(m.pics.length === 1, `menu: stesso riquadro per tutte le illustrate (${m.pics.join(', ')})`);
  et(m.contorni.length === 1 && (!m.pics.length || m.contorni[0] === m.pics[0]),
    `menu: illustrate e di contorno della stessa misura (${m.pics.join(',')} e ${m.contorni.join(',')})`);
  et(m.su.length === 1 && m.giu.length === 1 && Math.abs(m.su[0] - m.giu[0]) <= 0.5,
    `menu: aria uguale sopra e sotto dentro la tessera (${m.su.join(',')} sopra, ${m.giu.join(',')} sotto)`);
  et(m.sx.length === 1, `menu: stessa aria a sinistra (${m.sx.join(', ')})`);
  et(m.bordi.length === 1, `menu: illustrate e di contorno partono dallo stesso bordo (${m.bordi.join(', ')})`);
  et(m.sfondi.length === 1, `menu: stesso fondo per tutte le tessere (${m.sfondi.join(', ')})`);

  // lista Voti: le pastiglie evento in fila, tutte dello stesso riquadro
  // Senza il seme la lega e' vuota e su Voti non c'e' una pastiglia: il
  // controllo passerebbe a vuoto. Se il bottone non c'e' piu', si vuole
  // saperlo, quindi qui si rompe.
  await p.evaluate(() => { location.hash = '#/impostazioni/avanzate'; }); await w(800);
  const seminato = await p.evaluate(() => { const x = document.querySelector('[data-act="seed"]'); if (!x) return false; x.click(); return true; });
  if (!seminato) throw new Error('bottone del seme sparito da #/impostazioni/avanzate: la prova sui Voti girerebbe a vuoto');
  await w(1500);

  // la giornata in corso puo' non avere ancora eventi: si prende la prima
  // giornata giocata che ne ha
  let e = { quante: 0 };
  for (const g of ['voti/1', 'voti/2', 'voti/3', 'voti']) {
    await p.goto(`http://localhost:4173/#/${g}`, { waitUntil: 'load' }); await w(1200);
    e = await p.evaluate(() => {
      const evi = [...document.querySelectorAll('.vr .ev .evi')];
      if (!evi.length) return { quante: 0 };
    const lati = [...new Set(evi.map(i => `${Math.round(i.getBoundingClientRect().width)}x${Math.round(i.getBoundingClientRect().height)}`))];
    // l'inchiostro vero dentro il riquadro: object-fit:contain su una tela da
    // 128, quindi due icone normalizzate devono coprire la stessa area
    const pics = evi.map(i => i.querySelector('.pic')).filter(Boolean);
    const larghi = pics.map(x => Math.round(x.getBoundingClientRect().width));
    const righe = [...document.querySelectorAll('.vr .ev')];
    const strabordano = righe.filter(r => r.scrollWidth > r.clientWidth + 1).length;
      return { quante: evi.length, lati, larghi: [...new Set(larghi)], strabordano };
    });
    if (e.quante) break;
  }
  et(e.quante > 0, `voti: trovate ${e.quante} pastiglie evento su cui misurare`);
  if (e.quante) {
    console.log('  voti in pagina:', e.quante, 'pastiglie evento · riquadro', e.lati.join('/'));
    et(e.lati.length === 1, `voti: stesso riquadro per tutte le pastiglie (${e.lati.join(', ')})`);
    et(e.larghi.length === 1, `voti: stesso riquadro per l'immagine dentro (${e.larghi.join(', ')})`);
    et(e.strabordano === 0, `voti: nessuna fila di eventi straborda (${e.strabordano})`);
  } else {
    console.log('  voti: nessuna pastiglia evento in questa giornata, salto i tre controlli');
  }

  await b.close();
  console.log('PASSATI (' + ok.length + ')'); ok.forEach(s => console.log('  ok  ' + s));
  console.log(ko.length ? '\nFALLITI (' + ko.length + ')' : '\nnessun problema'); ko.forEach(s => console.log('  KO  ' + s));
  process.exit(ko.length ? 1 : 0);
})();
