/**
 * La schermata Voti quando i voti non ci sono, e il pallino del live.
 *
 * Nasce da due schermi veri.
 *
 * 1. Su una gara non ancora giocata la nota diceva "scheduled", cioe' la
 *    parola del database, e sotto ci appendeva "art. 10" e "S.V." come se la
 *    partita fosse stata annullata. Le uniche parole che puo' leggere chi usa
 *    l'app sono italiane, e "S.V. per tutti" va scritto solo dove e' vero:
 *    gli stati senza voto li decide il motore (SV_STATUSES), non una frase
 *    copiata nella schermata.
 *
 * 2. La pastiglia "LIVE IN CORSO" aveva un pallino verde da 8px con un alone
 *    fatto di box-shadow che si allargava di 6px: l'alone e' largo 20px, il
 *    pallino sta in una cassetta da 8px, e il verde finiva addosso al bordo
 *    della pastiglia e fuori (in una pastiglia bassa, .a-sec span .badge, di
 *    pastiglia ne esce del tutto). La regola durevole non e' "sta dentro
 *    QUESTA pastiglia" — le pastiglie sono alte quanto il testo che hanno
 *    dentro — ma "il pallino dipinge dentro la cassetta sua": se vale quella,
 *    non puo' uscire da nessuna pastiglia che lo contenga.
 *
 * Qui si misura: quanto dipinge il pallino in ogni istante dell'animazione, e
 * cosa c'e' scritto nelle note di stato con quattro stati diversi in pagina.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const ok = [], ko = []; const et = (c, t) => (c ? ok : ko).push(t);

// 18 settembre, sera: la 4a giornata ha passato il lock e non e' ancora
// giocata, quindi la giornata e' "live" e le sue gare sono tutte da giocare.
const QUANDO = '2026-09-18T16:00:00Z';

/**
 * Finge che la FSGC abbia gia' pubblicato i referti di qualche gara della 4a.
 * I risultati veri stanno in src/calendario-dati.js (generato dall'import), e
 * si riscrivono al volo: e' l'unico modo di vedere una giornata a meta'.
 */
const conRisultati = async (p, quante) => {
  await p.route('**/calendario-dati.js', async (route) => {
    const r = await route.fetch(); let t = await r.text(); let n = 0;
    t = t.replace(/(\[4,[^\n]*?),null,null\]/g, (m, a) => (n++ < quante ? `${a},2,1]` : m));
    await route.fulfill({ body: t, headers: { 'content-type': 'text/javascript' } });
  });
};

const avvia = async (b, { motoRidotto = false, arrivate = 0 } = {}) => {
  const ctx = await b.newContext({
    viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block',
    ...(motoRidotto ? { reducedMotion: 'reduce' } : {}),
  });
  await ctx.addInitScript(({ iso }) => {
    window.__SUPABASE_JS__ = '/tests/mock-supabase.js';
    localStorage.setItem('fcs:auth', 'supabase');
    localStorage.setItem('fcs:prefs', JSON.stringify({ onboarded: true, theme: 'system' }));
    localStorage.setItem('fcs:supabase', JSON.stringify({ url: 'https://mock.supabase.co', key: 'mock-key-mock-key-mock' }));
    const Vero = Date; const scarto = new Vero(iso).getTime() - Vero.now();
    class Finto extends Vero {
      constructor(...a) { if (!a.length) super(Vero.now() + scarto); else super(...a); }
      static now() { return Vero.now() + scarto; }
    }
    window.Date = Finto;
  }, { iso: QUANDO });
  const p = await ctx.newPage(); p.on('dialog', d => d.accept());
  if (arrivate) await conRisultati(p, arrivate);
  const errori = []; p.on('pageerror', e => errori.push(e.message));
  const w = (ms = 450) => p.waitForTimeout(ms);
  await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await w(1300);
  await p.click('[data-tab="up"]'); await w(250);
  await p.fill('#email', 'a@e.it'); await p.fill('#name', 'Conti25'); await p.fill('#password', 'password123');
  await p.click('#primary'); await w(1000);
  await p.click('[data-form="create"]'); await w(250);
  await p.fill('#lname', 'Torneo Titano'); await p.fill('#team', 'Hasta El Roxy'); await p.click('#go-create'); await w(1400);
  return { ctx, p, w, errori };
};

/**
 * Quanto dipinge il pallino, misurato dal centro della sua cassetta.
 *
 * Si guardano l'elemento e i suoi due pseudo, in venticinque istanti
 * dell'animazione: per ognuno, mezza larghezza dipinta = (misura x scala) / 2
 * piu' quanto sporge l'ombra (spostamento + sfocatura + allargamento). E'
 * apposta una sovrastima: un'ombra sfocata sfuma, un bordo no.
 */
const QUANTO_DIPINGE = () => {
  const pulse = document.querySelector('.badge--live .pulse');
  if (!pulse) return { errore: 'nessun pallino live in pagina' };
  const anims = document.getAnimations().filter((a) => a.effect && a.effect.target === pulse);
  const durata = anims.length ? Number(anims[0].effect.getTiming().duration) || 0 : 0;
  const ombra = (st) => {
    const sh = st.boxShadow;
    if (!sh || sh === 'none' || /inset/.test(sh)) return 0;
    const n = (sh.match(/-?\d+(?:\.\d+)?px/g) || []).map(parseFloat);
    const [x = 0, y = 0, sfoca = 0, largo = 0] = n;
    return Math.max(Math.abs(x), Math.abs(y)) + Math.abs(sfoca) + Math.abs(largo);
  };
  const scala = (st) => {
    const m = /matrix\(([^)]+)\)/.exec(st.transform || '');
    if (!m) return 1;
    const v = m[1].split(',').map(Number);
    return Math.max(Math.abs(v[0]), Math.abs(v[3]));
  };
  const cassetta = pulse.getBoundingClientRect();
  let peggio = { mezza: 0, quando: 0, chi: '' };
  const passi = 24;
  for (let i = 0; i <= passi; i++) {
    const t = durata ? (durata * i) / passi : 0;
    for (const a of anims) { a.pause(); a.currentTime = t; }
    for (const ps of [null, '::before', '::after']) {
      const st = getComputedStyle(pulse, ps);
      if (ps && (st.content === 'none' || !st.content)) continue;
      // getComputedStyle da' la misura del contenuto: bordi e imbottitura si
      // dipingono in piu' e vanno aggiunti a mano (l'alone E' un bordo).
      const px = (v) => parseFloat(v) || 0;
      const largo = px(st.width) + px(st.borderLeftWidth) + px(st.borderRightWidth) + px(st.paddingLeft) + px(st.paddingRight);
      const alto = px(st.height) + px(st.borderTopWidth) + px(st.borderBottomWidth) + px(st.paddingTop) + px(st.paddingBottom);
      const s = scala(st), e = ombra(st);
      const mezza = Math.max(largo * s, alto * s) / 2 + e;
      if (mezza > peggio.mezza) peggio = { mezza, quando: t, chi: ps || 'pallino' };
    }
  }
  for (const a of anims) { a.play(); }
  const badge = pulse.closest('.badge').getBoundingClientRect();
  return {
    animazioni: anims.length,
    durata,
    cassetta: { w: cassetta.width, h: cassetta.height },
    peggio,
    // di quanto il dipinto esce dalla cassetta, e dalla pastiglia
    fuoriCassetta: peggio.mezza - Math.min(cassetta.width, cassetta.height) / 2,
    fuoriPastiglia: Math.max(
      (cassetta.left + cassetta.width / 2 - peggio.mezza) < badge.left ? badge.left - (cassetta.left + cassetta.width / 2 - peggio.mezza) : 0,
      (cassetta.left + cassetta.width / 2 + peggio.mezza) > badge.right ? (cassetta.left + cassetta.width / 2 + peggio.mezza) - badge.right : 0,
      (cassetta.top + cassetta.height / 2 - peggio.mezza) < badge.top ? badge.top - (cassetta.top + cassetta.height / 2 - peggio.mezza) : 0,
      (cassetta.top + cassetta.height / 2 + peggio.mezza) > badge.bottom ? (cassetta.top + cassetta.height / 2 + peggio.mezza) - badge.bottom : 0,
    ),
  };
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());

  // ---- 1. le parole della nota di stato -------------------------------
  {
    const { ctx, p, w, errori } = await avvia(b);
    // Tre gare della 4a giornata prendono uno stato ciascuna: rinviata,
    // sospesa dopo il 45' e a tavolino. La quarta resta com'e': da giocare.
    await p.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('fcs:mock'));
      s.tables.match_overrides = s.tables.match_overrides || [];
      s.tables.match_overrides.push(
        { match_id: 'md4_m1', status: 'postponed' },
        { match_id: 'md4_m2', status: 'suspended_after_45' },
        { match_id: 'md4_m3', status: 'awarded' },
      );
      localStorage.setItem('fcs:mock', JSON.stringify(s));
      location.hash = '#/voti/4';
    });
    await p.reload({ waitUntil: 'load' }); await w(1800);
    await p.evaluate(() => { location.hash = '#/voti/4'; }); await w(1000);

    const v = await p.evaluate(() => ({
      testo: document.body.innerText,
      note: [...document.querySelectorAll('.vnota')].map((x) => ({
        cls: x.className,
        testo: x.innerText.replace(/\n/g, ' · '),
        sv: !!x.querySelector('.vnota-e'),
        icona: !!x.querySelector('svg.ic'),
        // la nota sta in cima alla lista, prima delle righe dei voti
        prima: x.previousElementSibling?.className || '',
      })),
      vecchie: document.querySelectorAll('.vlist .vb').length,
    }));

    const parole = /\b(scheduled|played|postponed|suspended_before_45|suspended_after_45|awarded|partial|provisional|frozen)\b/i;
    const trovata = parole.exec(v.testo);
    et(!trovata, `nessuna parola del database sullo schermo${trovata ? ` — c'è "${trovata[0]}"` : ''}`);
    et(v.note.length >= 4, `ogni gara senza voti ha la sua nota di stato (${v.note.length})`);
    et(v.note.every((x) => x.icona), 'ogni nota ha la sua icona');
    et(v.note.every((x) => /vhead/.test(x.prima)), 'la nota sta subito sotto il titolo della gara');
    et(v.vecchie === 0, `la nota non usa più la griglia dei bonus (.vb rimasti: ${v.vecchie})`);

    const cerca = (re) => v.note.find((x) => re.test(x.testo));
    const attesa = cerca(/Non ancora giocata/);
    et(!!attesa, 'la gara da giocare dice "Non ancora giocata"');
    et(!!attesa && /Si gioca \w{3} \d{1,2}\/\d{1,2} alle \d{2}:\d{2}/.test(attesa.testo),
      `e dice quando si gioca ("${attesa ? attesa.testo : ''}")`);
    et(!!attesa && !/art\. 10|S\.V\./.test(attesa.testo), 'e non le appiccica art. 10 né S.V.');

    const rinviata = cerca(/Gara rinviata/);
    et(!!rinviata && rinviata.sv, 'la rinviata dice "Gara rinviata" e "S.V. per tutti"');
    et(!!rinviata && /art\. 10/.test(rinviata.testo), 'e cita l\'articolo 10');

    const sospesa = cerca(/Sospesa dopo il 45/);
    et(!!sospesa, 'la sospesa dopo il 45\' ha la sua frase');
    // Qui stava lo sbaglio vecchio: il motore (SV_STATUSES) NON da' S.V. a
    // tutti dopo il 45', gli eventi valgono. La nota diceva il contrario.
    et(!!sospesa && !sospesa.sv, 'e NON dice "S.V. per tutti", perché gli eventi valgono');

    const tavolino = cerca(/tavolino/i);
    et(!!tavolino && tavolino.sv, 'la gara a tavolino dice S.V. per tutti');
    et(errori.length === 0, `nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
    await p.screenshot({ path: `${process.env.USCITA || '/tmp'}/voti-stato.png` }).catch(() => {});
    await ctx.close();
  }

  // ---- 2. il pallino del live dipinge dentro la sua cassetta -----------
  for (const motoRidotto of [false, true]) {
    const come = motoRidotto ? 'con le animazioni ridotte' : 'con le animazioni accese';
    const { ctx, p, w, errori } = await avvia(b, { motoRidotto, arrivate: 3 });
    await p.evaluate(() => { location.hash = '#/voti/4'; }); await w(1000);
    const vivo = await p.evaluate(() => {
      const bd = document.querySelector('.topbar .badge');
      return { cls: bd ? bd.className : '', testo: bd ? bd.innerText.trim() : '' };
    });
    et(/badge--live/.test(vivo.cls), `la 4ª giornata si annuncia in corso (${vivo.testo || 'niente pastiglia'})`);

    // La barra non e' solo una pastiglia larga mezza schermata: dice quante
    // gare sono arrivate. Qui ne sono arrivate tre su otto.
    const barra = await p.evaluate(() => {
      const bar = document.querySelector('.topbar .statolive');
      if (!bar) return null;
      const t = bar.querySelector('.statolive-t'), pieno = bar.querySelector('.statolive-t i');
      const tb = document.querySelector('.topbar').getBoundingClientRect();
      const bb = bar.getBoundingClientRect(), rt = t.getBoundingClientRect(), rp = pieno.getBoundingClientRect();
      return {
        conto: bar.querySelector('b')?.textContent.trim() || '',
        ora: t.getAttribute('aria-valuenow'), max: t.getAttribute('aria-valuemax'),
        etichetta: t.getAttribute('aria-label') || '',
        quota: rt.width ? rp.width / rt.width : 0,
        traccia: rt.width,
        sfora: Math.max(bb.right - tb.right, tb.left - bb.left),
      };
    });
    if (!barra) { et(false, `${come}: manca la barra della giornata in corso`); } else {
      et(barra.conto === '3/8', `${come}: la barra conta le gare arrivate (${barra.conto})`);
      et(barra.ora === '3' && barra.max === '8', `${come}: e lo dice anche a chi legge con la voce (${barra.ora}/${barra.max}, "${barra.etichetta}")`);
      et(Math.abs(barra.quota - 3 / 8) < 0.02, `${come}: l'avanzamento è lungo quanto deve (${(barra.quota * 100).toFixed(1)}%)`);
      et(barra.traccia >= 26, `${come}: la traccia resta visibile (${barra.traccia.toFixed(0)}px)`);
      et(barra.sfora <= 0.51, `${come}: e la barra non esce dalla testata (${barra.sfora.toFixed(2)}px)`);
    }

    const m = await p.evaluate(QUANTO_DIPINGE);
    if (m.errore) { et(false, `${come}: ${m.errore}`); } else {
      if (!motoRidotto) et(m.animazioni === 1 && m.durata > 0, `${come}: il pallino ha una sola animazione (${m.animazioni}, ${m.durata}ms)`);
      et(m.fuoriCassetta <= 0.51,
        `${come}: il verde non esce dalla sua cassetta (dipinge ${m.peggio.mezza.toFixed(2)}px dal centro, cassetta ${(m.cassetta.w / 2).toFixed(2)}px, il peggio è ${m.peggio.chi} a ${Math.round(m.peggio.quando)}ms)`);
      et(m.fuoriPastiglia <= 0.51,
        `${come}: e quindi non esce dalla pastiglia (sfora ${m.fuoriPastiglia.toFixed(2)}px)`);
    }
    et(errori.length === 0, `${come}: nessun errore JS${errori.length ? ' — ' + errori[0] : ''}`);
    await ctx.close();
  }

  await b.close();
  for (const t of ok) console.log('  ok  ' + t);
  for (const t of ko) console.log('  KO  ' + t);
  console.log(ko.length ? `${ko.length} problemi` : 'nessun problema');
  process.exit(ko.length ? 1 : 0);
})();
