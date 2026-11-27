/**
 * LE STORIE AUTOMATICHE DEL FUTSAL (Alex, 27/11: «vai con le storie
 * automatiche»). Le fa l'import stesso, appena pubblica un referto nuovo:
 *
 *   risultato  una per ogni referto nuovo: stemmi, risultato, marcatori col
 *              minuto e il migliore in campo per fantavoto;
 *   giornata   una quando l'ultimo referto chiude la giornata: i tre migliori
 *              e il mercato della giornata dopo (o, prima del lancio, il
 *              giorno in cui si comincia a giocare).
 *
 * I nomi dei giocatori ci sono (Alex, 27/11: «va bene mettere nomi»): sono
 * gli stessi dati di gara che l'app mostra a tutti, presi dal referto FSGC.
 * Gli stemmi sono quelli di fantasia dell'app (media/stemmi), mai quelli
 * ufficiali. Niente indirizzo del sito: «Link in bio».
 * In alto una foto FSGC della partita o di una delle due squadre (Alex, 27/11:
 * «manca lo sfondo»), dall'elenco social/futsal/foto-partite.json, col credito.
 *
 * Qui solo dati e HTML; fotografarle e pubblicarle tocca a
 * scripts/storie-futsal.mjs.
 */

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
const virgola = (x) => (Math.round(x * 100) / 100).toLocaleString('it-IT', { maximumFractionDigits: 2 });
/** Date e ore come a San Marino, anche se la macchina che fotografa sta in UTC. */
const roma = (t, o) => new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', ...o }).format(new Date(t));
const chiave = (r) => `${r.g}-${r.casa}-${r.ospite}`;

/** Una giornata e' finita: ogni partita ha il referto, o e' passata da piu' di tre giorni (src/futsal.js). */
function finita(n, calendario, referti, ora) {
  const ps = calendario.filter((c) => c[0] === n);
  return ps.length > 0 && ps.every((c) => referti.some((r) => r.g === n && r.casa === c[1])
    || (c[3] && Date.parse(c[3]) + 3 * 86400e3 < ora));
}

/**
 * Le storie da fare confrontando i dati di prima dell'import con quelli di
 * adesso: i referti nuovi e le giornate che con loro si chiudono.
 * prima/dopo: { CALENDARIO, REFERTI } dei due src/futsal-dati.js.
 */
export function storieNuove(prima, dopo, ora = Date.now()) {
  const gia = new Set((prima.REFERTI || []).map(chiave));
  const nuovi = (dopo.REFERTI || []).filter((r) => !gia.has(chiave(r)));
  const storie = nuovi.map((r) => ({ tipo: 'risultato', id: `futsal-risultato-${chiave(r)}`, g: r.g, casa: r.casa, ospite: r.ospite }));
  for (const g of [...new Set(nuovi.map((r) => r.g))].sort((a, b) => a - b)) {
    if (finita(g, dopo.CALENDARIO, dopo.REFERTI, ora) && !finita(g, prima.CALENDARIO || dopo.CALENDARIO, prima.REFERTI || [], ora)) {
      storie.push({ tipo: 'giornata', id: `futsal-giornata-${g}`, g });
    }
  }
  return storie;
}

/** «Cognome N.», come nell'app (con i nomi uguali distinti: F.nomeBreve). */
const nomeCorto = (F, x) => (!x ? '' : F.nomeBreve ? F.nomeBreve(x) : `${x.cognome}${x.nome ? ` ${x.nome[0]}.` : ''}`);

/**
 * I fatti di un risultato. F: il modulo src/futsal.js (dati di adesso).
 * Marcatori in ordine di minuto; l'autogol va alla squadra che lo riceve.
 */
export function fattiRisultato(F, s) {
  const r = F.referto(s.g, s.casa);
  const p = F.PARTITE.find((x) => x.g === s.g && x.casa === s.casa && x.ospite === s.ospite);
  const lato = (id) => (r.distinte[0].includes(id) ? 0 : r.distinte[1].includes(id) ? 1 : -1);
  const gol = [[], []];
  for (const [id, min, tipo] of [...r.eventi].sort((a, b) => a[1] - b[1])) {
    if (tipo !== 'goal' && tipo !== 'own_goal') continue;
    const l = lato(id);
    if (l < 0) continue;
    const per = tipo === 'own_goal' ? 1 - l : l;
    gol[per].push({ chi: nomeCorto(F, F.giocatore(id)), min, autogol: tipo === 'own_goal' });
  }
  const voti = F.votiGiornata(s.g).giocatori;
  const migliore = [...r.distinte[0], ...r.distinte[1]]
    .map((id) => ({ id, v: voti.get(id) }))
    .filter((x) => x.v && !x.v.sv && !x.v.riposo)
    .sort((a, b) => b.v.totale - a.v.totale)[0];
  const g = migliore && F.giocatore(migliore.id);
  return {
    ...s,
    nomeCasa: F.squadra.get(s.casa)?.nome || s.casa,
    nomeOspite: F.squadra.get(s.ospite)?.nome || s.ospite,
    gc: p?.gc ?? gol[0].length, go: p?.go ?? gol[1].length,
    gol,
    migliore: g ? { chi: `${String(g.nome).split(' ')[0]} ${g.cognome}`, club: F.squadra.get(g.club)?.nome || g.club, voto: migliore.v.totale } : null,
  };
}

/**
 * I fatti di una giornata finita: i tre migliori per fantavoto e cosa viene
 * dopo. Prima del lancio (lancio: ms) il mercato non serve a nessuno: si dice
 * da quale giornata si comincia.
 */
export function fattiGiornata(F, s, { ora = Date.now(), lancio = 0 } = {}) {
  const voti = F.votiGiornata(s.g).giocatori;
  const top = [...voti].filter(([, v]) => !v.sv && !v.riposo)
    .sort((a, b) => b[1].totale - a[1].totale).slice(0, 3)
    .map(([id, v]) => { const g = F.giocatore(id); return { chi: `${String(g.nome).split(' ')[0]} ${g.cognome}`, club: g.club, nomeClub: F.squadra.get(g.club)?.nome || g.club, voto: v.totale }; });
  let dopo;
  if (lancio && ora < lancio) {
    let n = s.g + 1;
    while (F.chiusura(n) && F.chiusura(n).getTime() < lancio) n++;
    dopo = { titolo: `Si gioca dal ${roma(lancio, { day: 'numeric', month: 'numeric' })}`, sotto: `Si apre alle ${roma(lancio, { hour: 'numeric' })} · la tua prima giornata è la ${n}ª` };
  } else {
    const c = F.chiusura(s.g + 1);
    dopo = { titolo: `Mercato della ${s.g + 1}ª aperto`, sotto: c ? `Chiude ${roma(c, { weekday: 'short', day: 'numeric', month: 'numeric' })} alle ${roma(c, { hour: '2-digit', minute: '2-digit' })}` : 'Fai la tua squadra' };
  }
  return { ...s, top, dopo };
}

/**
 * La foto di sfondo: prima una della stessa partita (anche a campi invertiti),
 * poi una di casa o ospite, poi una qualunque. seme (la giornata) fa girare le
 * foto quando ce n'e' piu' di una. pool: le voci di foto-partite.json.
 */
export function fotoPer(pool, casa, ospite, seme = 0) {
  const ha = (f, c) => f.casa === c || f.ospite === c;
  const stessa = pool.filter((f) => ha(f, casa) && ha(f, ospite) && casa !== ospite);
  const una = pool.filter((f) => ha(f, casa) || ha(f, ospite));
  const scelta = stessa.length ? stessa : una.length ? una : pool;
  return scelta.length ? scelta[Math.abs(seme) % scelta.length] : null;
}

// ------------------------------------------------------------------ grafica
// Lo stile del futsal (FUTSAL.md § 13.12): carta #F2F0E9, nero #111, rosso
// #FF4B2B, Teko per i numeri e i titoli, Lato per i testi.
const testa = (base) => `<!doctype html><html lang="it"><head><meta charset="utf-8"><style>
@font-face{font-family:Teko;src:url(${base}/media/font/teko-latin.woff2) format('woff2');font-weight:300 700}
@font-face{font-family:Lato;src:url(${base}/media/font/lato-700-latin.woff2) format('woff2');font-weight:700}
@font-face{font-family:Lato;src:url(${base}/media/font/lato-900-latin.woff2) format('woff2');font-weight:900}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1080px;height:1920px;overflow:hidden}
body{background:#F2F0E9;color:#111;font-family:Lato,sans-serif;position:relative}
body:before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(-62deg,transparent 0 120px,rgba(17,17,17,.035) 120px 124px)}
/* Instagram copre i primi ~250px e gli ultimi ~250px: tutto sta in mezzo */
main{position:absolute;left:70px;right:70px;top:240px;bottom:250px;display:flex;flex-direction:column;gap:34px}
.logo{align-self:flex-start;background:#111;color:#fff;padding:10px 34px 2px;transform:skewX(-12deg)}
.logo b{display:block;font:700 70px/1 Teko;letter-spacing:2px;text-transform:uppercase;transform:skewX(12deg)}
.logo em{font-style:normal;color:#FF4B2B}
.tit small{display:block;font:600 60px/1 Teko;color:#FF4B2B;letter-spacing:3px;text-transform:uppercase}
.tit b{display:block;font:700 116px/.9 Teko;text-transform:uppercase;letter-spacing:1px}
.carta{background:#fff;border:6px solid #111;box-shadow:16px 16px 0 #FF4B2B;margin-right:16px}
.rf{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:40px 20px 34px}
.sq{display:flex;flex-direction:column;align-items:center;gap:18px}
.sq img{width:190px;height:205px;object-fit:contain}
.sq b{font:900 36px/1.05 Lato;text-transform:uppercase;text-align:center}
.ris{font:700 200px/1 Teko;letter-spacing:-2px;padding:24px 10px 0;white-space:nowrap}
.ris span{color:#FF4B2B;margin:0 6px}
.gol{display:grid;grid-template-columns:1fr 1fr;gap:30px;padding:0 10px}
.gol div{display:flex;flex-direction:column;gap:8px}
.gol div:last-child{text-align:right}
.gol p{font:700 32px/1.15 Lato}
.gol p small{font:600 38px/1 Teko;color:#FF4B2B;margin-left:8px}
.mig{margin:0 -70px;background:#111;color:#fff;padding:24px 90px;display:flex;align-items:center;justify-content:space-between;gap:30px}
.mig small{display:block;font:600 38px/1 Teko;color:#FF4B2B;letter-spacing:3px;text-transform:uppercase}
.mig b{display:block;font:700 70px/1 Teko;text-transform:uppercase}
.mig span{font:700 32px/1 Lato;color:#bbb;display:block;margin-top:2px}
.mig strong{font:700 130px/1 Teko;color:#FF4B2B}
.top{padding:10px 36px}
.riga{display:grid;grid-template-columns:70px 110px 1fr auto;align-items:center;gap:20px;padding:22px 0;border-bottom:4px solid #111}
.riga:last-child{border:0}
.riga i{font:700 110px/1 Teko;font-style:normal;color:#FF4B2B}
.riga img{width:100px;height:110px;object-fit:contain}
.riga b{font:700 56px/1 Teko;text-transform:uppercase;display:block}
.riga span{font:700 30px/1 Lato;color:#666}
.riga strong{font:700 100px/1 Teko}
.dopo{background:#FF4B2B;color:#111;border:6px solid #111;padding:26px 40px;transform:skewX(-6deg);margin:0 10px}
.dopo b{display:block;font:700 86px/1 Teko;text-transform:uppercase;transform:skewX(6deg)}
.dopo span{display:block;font:900 38px/1.1 Lato;transform:skewX(6deg)}
.cta{margin-top:auto;border-top:6px solid #111;padding-top:22px;display:flex;justify-content:space-between;align-items:baseline}
.cta b{font:700 64px/1 Teko;text-transform:uppercase}
.cta b em{font-style:normal;color:#FF4B2B}
.cta span{font:700 24px/1 Lato;color:#666}
/* la foto: in alto a tutta larghezza, scura dove ci sono logo e titolo, poi sfuma nella carta */
.foto{position:absolute;left:0;top:0;width:1080px;height:1040px;object-fit:cover;background:#111}
.velo{position:absolute;left:0;top:0;width:1080px;height:1041px;background:linear-gradient(180deg,rgba(17,17,17,.5) 0,rgba(17,17,17,.1) 22%,rgba(17,17,17,.15) 45%,rgba(17,17,17,.65) 72%,rgba(17,17,17,.7) 86%,#F2F0E9 100%)}
/* lo spazio che lascia vedere la foto: si stringe da solo se i marcatori sono tanti */
.aria{flex:1 1 auto;max-height:330px;min-height:0}
.cred{position:absolute;right:70px;top:250px;font:700 24px/1 Lato;color:#fff;text-shadow:0 1px 6px rgba(0,0,0,.7)}
.conFoto .tit b{color:#fff;text-shadow:0 4px 18px rgba(0,0,0,.55)}
.conFoto .tit small{text-shadow:0 2px 10px rgba(0,0,0,.6)}
</style></head><body>`;
const fine = '</main><script>Promise.all([document.fonts.ready,...[...document.images].map((i)=>i.decode().catch(()=>{}))]).then(()=>document.body.dataset.pronto=1)</script></body></html>';
const logo = '<div class="logo"><b>Fanta<em>futsal</em></b></div>';
/** La foto (se c'e') sta sotto <main>, col velo e il credito; main prende la classe per i titoli bianchi. */
const apri = (f, base) => (f.foto
  ? `<img class="foto" src="${base}/social/futsal/foto/${encodeURIComponent(f.foto.id)}.jpg" alt=""><div class="velo"></div><div class="cred">${esc(f.foto.credito)}</div><main class="conFoto">`
  : '<main>');
const piede = (sotto) => `<div class="cta"><b>Gioca gratis · <em>Link in bio</em></b><span>${esc(sotto)}</span></div>`;
const stemmaImg = (base, id) => `<img src="${base}/media/stemmi/${encodeURIComponent(id)}.webp" alt="">`;
/** I gol di una squadra raggruppati per giocatore: «Oddone D. 2' 8' 41'». */
function perGiocatore(gs) {
  const m = new Map();
  for (const x of gs) { const k = `${x.chi}|${x.autogol ? 1 : 0}`; m.set(k, [...(m.get(k) || []), x]); }
  return [...m.values()].map((xs) => `<p>${esc(xs[0].chi)}${xs[0].autogol ? ' (aut.)' : ''}${xs.map((x) => `<small>${esc(x.min)}'</small>`).join('')}</p>`).join('') || '<p>&nbsp;</p>';
}

export function htmlRisultato(f, base) {
  return `${testa(base)}${apri(f, base)}${logo}${f.foto ? '<div class="aria"></div>' : ''}
  <div class="tit"><small>${f.g}ª giornata</small><b>Risultato finale</b></div>
  <div class="carta rf">
    <div class="sq">${stemmaImg(base, f.casa)}<b>${esc(f.nomeCasa)}</b></div>
    <div class="ris">${esc(f.gc)}<span>–</span>${esc(f.go)}</div>
    <div class="sq">${stemmaImg(base, f.ospite)}<b>${esc(f.nomeOspite)}</b></div>
  </div>
  <div class="gol"><div>${perGiocatore(f.gol[0])}</div><div>${perGiocatore(f.gol[1])}</div></div>
  ${f.migliore ? `<div class="mig"><div><small>Il migliore in campo</small><b>${esc(f.migliore.chi)}</b><span>${esc(f.migliore.club)}</span></div><strong>${esc(virgola(f.migliore.voto))}</strong></div>` : ''}
  ${piede('Dati: referto FSGC')}${fine}`;
}

export function htmlGiornata(f, base) {
  return `${testa(base)}${apri(f, base)}${logo}${f.foto ? '<div class="aria"></div>' : ''}
  <div class="tit"><small>${f.g}ª giornata</small><b>I migliori</b></div>
  <div class="carta top">${f.top.map((x, i) => `<div class="riga"><i>${i + 1}</i>${stemmaImg(base, x.club)}<div><b>${esc(x.chi)}</b><span>${esc(x.nomeClub)}</span></div><strong>${esc(virgola(x.voto))}</strong></div>`).join('')}</div>
  <div class="dopo"><b>${esc(f.dopo.titolo)}</b><span>${esc(f.dopo.sotto)}</span></div>
  ${piede('Fantavoti dai referti FSGC')}${fine}`;
}
