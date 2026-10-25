/**
 * La sezione Futsal (FUTSAL.md). Per ora vive solo sul ramo `futsal` ed e'
 * nascosta: si apre con ?futsal=1 nell'indirizzo, si richiude con ?futsal=0
 * (vedi futsalAttivo). Le formazioni si salvano sul telefono: il server
 * arriva quando il regolamento sara' provato sulle giornate vere.
 */
import { CLUBS } from '../data.js';
import { esc, fmt, icon, sec, tile, dateIt, timeIt, empty, crest } from '../ui.js';
import * as F from '../futsal.js';
import { controllaFormazione, punteggioFormazione, REGOLE_FUTSAL as R } from '../futsal-engine.js';

const CHIAVE = 'fcs:futsal';
const FORMAZIONI = 'fcs:futsal:formazioni';

/** L'interruttore che tiene nascosta la sezione a chi non la deve vedere. */
export function futsalAttivo() {
  try { return localStorage.getItem(CHIAVE) === '1'; } catch { return false; }
}
/** ?futsal=1 accende, ?futsal=0 spegne: da chiamare all'avvio. */
export function leggiInterruttore() {
  const m = /[?&#]futsal=([01])\b/.exec(`${location.search}&${location.hash}`);
  if (!m) return;
  try { if (m[1] === '1') localStorage.setItem(CHIAVE, '1'); else localStorage.removeItem(CHIAVE); } catch { /* senza storage resta spento */ }
}

/** Calcio | Futsal, in cima alle due home. */
export const selettore = (sport) => `<div class="seg seg-cls sport-sw" role="tablist" aria-label="Sport">
  <a role="tab" class="${sport === 'calcio' ? 'on' : ''}" href="#/">Calcio</a>
  <a role="tab" class="${sport === 'futsal' ? 'on' : ''}" href="#/futsal">Futsal</a></div>`;

// ---- piccoli pezzi
const colore = new Map(CLUBS.map((c) => [c.id, c]));
const nomeSq = (id) => F.squadra.get(id)?.nome || id;
const stemma = (id) => { const c = colore.get(id); return crest({ color: c?.color, initials: c?.shortName || id.slice(0, 3).toUpperCase() }, 'fs-crest'); };
const nomeG = (g) => `${g.cognome} ${g.nome ? `${g.nome[0]}.` : ''}`;
const ruoloChip = (r) => `<span class="rl rl-${r === 'P' ? 'p' : r === 'D' ? 'd' : 'a'}">${r}</span>`;
const voto = (v, cap = false) => (v.sv ? '<span class="fv sv">S.V.</span>' : `<span class="fv${cap ? ' cap' : ''}">${fmt(v.totale)}</span>`);

function leggi() { try { return JSON.parse(localStorage.getItem(FORMAZIONI)) || {}; } catch { return {}; } }
function scrivi(tutte) { try { localStorage.setItem(FORMAZIONI, JSON.stringify(tutte)); } catch { /* niente */ } }

// ---- home
export const futsalHome = {
  title: 'Futsal', appbar: 'futsal', sub: () => 'Campionato Sammarinese di Futsal',
  render() {
    const n = F.giornataCorrente();
    const chiude = F.chiusura(n);
    const partite = F.PARTITE.filter((p) => p.g === n);
    const mia = leggi()[n];
    const ultima = F.giocate().at(-1);
    const top = ultima ? migliori(ultima, 5) : [];
    return `<main class="a-body fs">
      ${selettore('futsal')}
      <div class="a-card fs-hero">
        <span class="chip">${n}ª giornata</span>
        <h3>${partite.length ? `${dateIt(partite[0].quando)} – ${dateIt(partite.at(-1).quando)}` : ''}</h3>
        <p class="small muted">${chiude ? `Formazioni chiuse ${dateIt(chiude.toISOString())} alle ${timeIt(chiude.toISOString())}` : ''} · riposa ${esc(F.riposa(n).map(nomeSq).join(', '))}</p>
        <a class="a-btn big" href="#/futsal/formazione" style="text-decoration:none">${icon('shirt', 'ic sm')}${mia ? 'Cambia la formazione' : 'Schiera la formazione'}</a>
        ${mia ? `<p class="small muted" style="margin-top:8px">${controllaFormazione(espandi(mia)).length ? 'Formazione incompleta: finiscila prima della chiusura.' : 'Formazione pronta.'}</p>` : ''}
      </div>
      ${sec('Le partite', `${n}ª giornata`)}
      <div class="a-card fs-list">${partite.map((p) => `<div class="fs-match">${stemma(p.casa)}<b>${esc(nomeSq(p.casa))}</b><span class="fs-ora">${timeIt(p.quando)}<small>${dateIt(p.quando)}</small></span><b class="r">${esc(nomeSq(p.ospite))}</b>${stemma(p.ospite)}</div>`).join('')}</div>
      ${ultima ? `${sec('I migliori', `${ultima}ª giornata`)}
      <div class="a-card fs-list">${top.map(({ g, v }) => `<a class="vr" href="#/futsal/giornata/${ultima}">${ruoloChip(g.ruolo)}<span class="nm"><b>${esc(nomeG(g))}</b><span>${esc(nomeSq(g.club))} · ${esc(g.ruoloFsgc)}</span></span><span class="ev"></span>${voto(v)}</a>`).join('')}</div>` : ''}
      ${sec('Il gioco')}
      ${tile({ href: `#/futsal/giornata/${ultima || 1}`, lead: icon('votes'), title: 'Giornate e voti', sub: `${F.giocate().length} giornate giocate, voti dai referti FSGC` })}
      ${tile({ href: '#/futsal/listone', lead: icon('users'), title: 'Listone', sub: `${F.GIOCATORI_FUTSAL.filter((g) => g.ruolo !== 'P').length} giocatori e 15 porte` })}
      ${tile({ href: '#/futsal/regolamento', lead: icon('book'), title: 'Regolamento', sub: 'Porta, difensori, attaccanti: come si fanno i punti' })}
    </main>`;
  },
};

function migliori(n, quanti) {
  const { giocatori } = F.votiGiornata(n);
  return [...giocatori].filter(([, v]) => !v.sv).sort((a, b) => b[1].totale - a[1].totale).slice(0, quanti)
    .map(([id, v]) => ({ g: F.giocatore(id), v }));
}

// ---- formazione
// Bozza in memoria: { modulo, porta, D:[id..], A:[id..], pD, pA, capitano, vice }
let bozza = null, provaSu = null;
const vuota = () => ({ modulo: '2-2', porta: null, D: [null, null], A: [null, null], pD: null, pA: null, capitano: null, vice: null });
const conRuolo = (id) => { const g = id && F.giocatore(id); return g ? { id, club: g.club, ruolo: g.ruolo } : null; };
/** Dalla bozza alla forma che vogliono controllaFormazione e punteggioFormazione. */
function espandi(b) {
  return { modulo: b.modulo, porta: b.porta, capitano: b.capitano, vice: b.vice,
    titolari: [...b.D, ...b.A].map(conRuolo), panchina: [conRuolo(b.pD), conRuolo(b.pA)] };
}
function adatta(b) {
  const m = R.moduli[b.modulo];
  const taglia = (a, n) => [...a.slice(0, n), ...Array(Math.max(0, n - a.length)).fill(null)];
  return { ...b, D: taglia(b.D, m.D), A: taglia(b.A, m.A) };
}

export const futsalFormazione = {
  title: 'Formazione futsal', appbar: 'futsal', sub: () => `Formazione · ${F.giornataCorrente()}ª giornata`,
  render() {
    const n = F.giornataCorrente();
    bozza ||= leggi()[n] || vuota();
    const f = espandi(bozza);
    const errori = controllaFormazione(f);
    const posto = (ruolo, i, id, etichetta) => {
      const g = id && F.giocatore(id);
      const fascia = id && (bozza.capitano === id ? 'C' : bozza.vice === id ? 'V' : '');
      return `<button class="vr fs-slot" data-slot="${ruolo}:${i}">${ruoloChip(ruolo === 'pD' ? 'D' : ruolo === 'pA' ? 'A' : ruolo)}<span class="nm"><b>${g ? esc(nomeG(g)) : `<span class="muted">${etichetta}</span>`}</b><span>${g ? `${esc(nomeSq(g.club))} · ${esc(g.ruoloFsgc)}` : 'tocca per scegliere'}</span></span><span class="ev">${fascia ? `<i class="fs-fascia">${fascia}</i>` : ''}</span>${icon('chev', 'ic sm')}</button>`;
    };
    const porta = bozza.porta
      ? `<button class="vr fs-slot" data-slot="P:0">${ruoloChip('P')}<span class="nm"><b>Porta ${esc(nomeSq(bozza.porta))}</b><span>tutti i portieri della squadra</span></span><span class="ev"></span>${icon('chev', 'ic sm')}</button>`
      : posto('P', 0, null, 'Scegli la Porta');
    const giocate = F.giocate();
    provaSu ||= giocate.at(-1);
    const prova = !errori.length && provaSu ? punteggioFormazione(f, (() => { const v = F.votiGiornata(provaSu); return { porta: v.porta.get(f.porta), giocatori: v.giocatori }; })()) : null;
    return `<main class="a-body fs">
      <div class="seg seg-cls" role="tablist" aria-label="Modulo">${Object.keys(R.moduli).map((m) => `<button data-modulo="${m}" class="${bozza.modulo === m ? 'on' : ''}">${m}${m === R.bonusDifesa.modulo ? ' · difensivo' : ''}</button>`).join('')}</div>
      <p class="small muted fs-nota">${bozza.modulo === R.bonusDifesa.modulo ? `Bonus difesa +${fmt(R.bonusDifesa.punti, 0)} se Porta e tre difensori fanno in media almeno ${fmt(R.bonusDifesa.soglia)}.` : 'Una Porta, due difensori, due attaccanti. Al massimo uno per squadra.'}</p>
      ${sec('In campo')}
      <div class="a-card fs-list">${porta}${bozza.D.map((id, i) => posto('D', i, id, 'Scegli un difensore')).join('')}${bozza.A.map((id, i) => posto('A', i, id, 'Scegli un attaccante')).join('')}</div>
      ${sec('In panchina', 'entra al posto di un titolare del suo ruolo senza voto')}
      <div class="a-card fs-list">${posto('pD', 0, bozza.pD, 'Difensore di riserva')}${posto('pA', 0, bozza.pA, 'Attaccante di riserva')}</div>
      <p class="small muted fs-nota">Tocca un titolare già scelto per farlo capitano (C) o vice (V). Il capitano raddoppia bonus e malus.</p>
      ${errori.length ? `<div class="a-card fs-err">${errori.map((e) => `<p>${icon('warn', 'ic sm')}${esc(e)}</p>`).join('')}</div>` : ''}
      <button class="a-btn big" id="fs-salva" ${errori.length ? 'disabled' : ''}>Salva la formazione della ${n}ª</button>
      <p class="small muted" style="text-align:center">Prova: si salva solo su questo telefono.</p>
      ${prova ? `${sec('Se l\'avessi schierata', `<select id="fs-prova" class="select">${giocate.map((g) => `<option value="${g}" ${g === provaSu ? 'selected' : ''}>${g}ª giornata</option>`).join('')}</select>`)}
      ${tabellaPunti(prova)}` : ''}
    </main>`;
  },
  mount(root, ctx) {
    const main = root.querySelector('main');
    main.addEventListener('click', (e) => {
      const m = e.target.closest('[data-modulo]');
      if (m) { bozza = adatta({ ...bozza, modulo: m.dataset.modulo }); pulisciFasce(); ctx.render(); return; }
      const s = e.target.closest('[data-slot]');
      if (s) { apriScelta(s.dataset.slot, ctx); return; }
      if (e.target.closest('#fs-salva')) { const t = leggi(); t[F.giornataCorrente()] = bozza; scrivi(t); ctx.toast('Formazione salvata'); ctx.go('futsal'); }
    });
    root.querySelector('#fs-prova')?.addEventListener('change', (e) => { provaSu = Number(e.target.value); ctx.render(); });
  },
};

function pulisciFasce() {
  const ids = [...bozza.D, ...bozza.A];
  if (!ids.includes(bozza.capitano)) bozza.capitano = null;
  if (!ids.includes(bozza.vice)) bozza.vice = null;
}

function tabellaPunti(r) {
  return `<div class="a-card fs-list">${r.righe.map((x) => {
    const g = x.id && F.giocatore(x.entrato?.id || x.id);
    const nome = x.posto === 'P' ? `Porta ${nomeSq(x.club)}` : nomeG(g);
    const nota = x.entrato ? `entra al posto di ${nomeG(F.giocatore(x.id))}` : x.voto.sv ? x.voto.motivo : x.voto.voci.slice(2).map((v) => v.etichetta).join(' · ') || 'nessun evento';
    return `<div class="vr">${ruoloChip(x.posto)}<span class="nm"><b>${esc(nome)}</b><span>${esc(nota)}</span></span><span class="ev"></span>${x.voto.sv ? '<span class="fv sv">0</span>' : `<span class="fv${x.capitano ? ' cap' : ''}">${fmt(x.punti)}</span>`}</div>`;
  }).join('')}${r.bonusDifesa ? `<div class="vr"><span></span><span class="nm"><b>Bonus difesa</b><span>media ${fmt(r.bonusDifesa.media)} su ${fmt(R.bonusDifesa.soglia)}</span></span><span class="ev"></span><span class="fv">${r.bonusDifesa.punti ? `+${fmt(r.bonusDifesa.punti, 0)}` : '0'}</span></div>` : ''}
  <div class="vr fs-tot"><span></span><span class="nm"><b>Totale</b></span><span class="ev"></span><span class="fv">${fmt(r.totale)}</span></div></div>`;
}

/** Il foglio per scegliere chi va in un posto (o la fascia, se il posto e' gia' pieno). */
function apriScelta(slot, ctx) {
  const [ruolo, i] = slot.split(':'); const idx = Number(i);
  const attuale = ruolo === 'P' ? null : ruolo === 'pD' ? bozza.pD : ruolo === 'pA' ? bozza.pA : bozza[ruolo][idx];
  const usati = new Set([bozza.porta, ...[...bozza.D, ...bozza.A, bozza.pD, bozza.pA].filter((x) => x && x !== attuale).map((x) => F.giocatore(x)?.club)].filter(Boolean));
  if (ruolo === 'P') usati.delete(bozza.porta);
  const metti = (id) => {
    if (ruolo === 'P') bozza.porta = id;
    else if (ruolo === 'pD') bozza.pD = id; else if (ruolo === 'pA') bozza.pA = id;
    else bozza[ruolo][idx] = id;
    pulisciFasce(); ctx.sheet(null); ctx.render();
  };
  const n = F.giornataCorrente(), riposa = new Set(F.riposa(n));
  const fascia = (ruolo === 'D' || ruolo === 'A') && attuale
    ? `<div class="fs-fasce"><button class="a-btn sec" data-fascia="capitano">Capitano</button><button class="a-btn sec" data-fascia="vice">Vice</button><button class="a-btn sec" data-togli>Togli</button></div>` : '';
  let righe;
  if (ruolo === 'P') {
    righe = F.SQUADRE.map((s) => {
      const off = usati.has(s.id) || riposa.has(s.id);
      return `<button class="vr" data-scegli="${s.id}" ${off ? 'disabled' : ''}>${stemma(s.id)}<span class="nm"><b>Porta ${esc(s.nome)}</b><span>${riposa.has(s.id) ? 'riposa in questa giornata' : usati.has(s.id) ? 'squadra già usata' : 'tutti i portieri'}</span></span><span class="ev"></span></button>`;
    }).join('');
  } else {
    const r = ruolo === 'pD' ? 'D' : ruolo === 'pA' ? 'A' : ruolo;
    const st = F.statistiche();
    righe = F.GIOCATORI_FUTSAL.filter((g) => g.ruolo === r)
      .sort((a, b) => (st.get(b.id)?.media || 0) - (st.get(a.id)?.media || 0))
      .map((g) => {
        const s = st.get(g.id), off = usati.has(g.club) || riposa.has(g.club);
        return `<button class="vr" data-scegli="${g.id}" ${off ? 'disabled' : ''}>${stemma(g.club)}<span class="nm"><b>${esc(nomeG(g))}</b><span>${esc(nomeSq(g.club))} · ${esc(g.ruoloFsgc)}${riposa.has(g.club) ? ' · riposa' : usati.has(g.club) ? ' · squadra già usata' : ''}</span></span><span class="ev">${s ? `${s.presenze}p · ${s.gol}g` : ''}</span><span class="fv">${s ? fmt(s.media) : '–'}</span></button>`;
      }).join('');
  }
  ctx.sheet(`<h3>${ruolo === 'P' ? 'Scegli la Porta' : 'Scegli il giocatore'}</h3>${fascia}<div class="fs-scelta">${righe}</div>`);
  const sh = document.getElementById('sheet');
  sh.onclick = (e) => {
    const b = e.target.closest('[data-scegli]'); if (b && !b.disabled) { metti(b.dataset.scegli); return; }
    const fa = e.target.closest('[data-fascia]');
    if (fa) {
      const chi = fa.dataset.fascia, altro = chi === 'capitano' ? 'vice' : 'capitano';
      bozza[chi] = attuale; if (bozza[altro] === attuale) bozza[altro] = null;
      ctx.sheet(null); ctx.render(); return;
    }
    if (e.target.closest('[data-togli]')) metti(null);
  };
}

// ---- giornate e voti
export const futsalGiornata = {
  title: 'Voti futsal', appbar: 'futsal', sub: (ctx) => `Voti · ${ctx.params.n || F.giocate().at(-1)}ª giornata`,
  render(ctx) {
    const giocate = F.giocate();
    const n = Number(ctx.params.n) || giocate.at(-1);
    if (!giocate.length) return `<main class="a-body">${empty('Nessuna giornata giocata.')}</main>`;
    const voti = F.votiGiornata(n);
    const partite = F.PARTITE.filter((p) => p.g === n);
    return `<main class="a-body fs">
      <div class="chips">${giocate.map((g) => `<a class="chip${g === n ? ' on' : ''}" href="#/futsal/giornata/${g}">${g}ª</a>`).join('')}</div>
      ${partite.map((p) => {
        if (p.gc === null) return `<div class="a-card fs-list"><div class="fs-match">${stemma(p.casa)}<b>${esc(nomeSq(p.casa))}</b><span class="fs-ora">–<small>da giocare</small></span><b class="r">${esc(nomeSq(p.ospite))}</b>${stemma(p.ospite)}</div></div>`;
        const ref = F.referto(n, p.casa);
        const lato = (club, i) => {
          const porta = voti.porta.get(club);
          // dalla distinta di questa partita, non dal listone: chi ha cambiato
          // squadra compare dove ha giocato quel giorno
          const giocatori = (ref?.distinte[i] || []).map((id) => ({ g: F.giocatore(id), v: voti.giocatori.get(id) }))
            .filter(({ g, v }) => g && v && !v.sv)
            .sort((a, b) => b.v.totale - a.v.totale);
          return `<div class="vr">${ruoloChip('P')}<span class="nm"><b>Porta ${esc(nomeSq(club))}</b><span>${esc(porta.voci.slice(2).map((v) => v.etichetta).join(' · '))}</span></span><span class="ev"></span>${voto(porta)}</div>
            ${giocatori.map(({ g, v }) => `<div class="vr">${ruoloChip(g.ruolo)}<span class="nm"><b>${esc(nomeG(g))}</b><span>${esc(v.voci.slice(2).map((x) => x.etichetta).join(' · ') || g.ruoloFsgc)}</span></span><span class="ev"></span>${voto(v)}</div>`).join('')}`;
        };
        return `<details class="a-card fs-list fs-partita"><summary>${stemma(p.casa)}<b>${esc(nomeSq(p.casa))}</b><span class="fs-ris">${p.gc} – ${p.go}</span><b class="r">${esc(nomeSq(p.ospite))}</b>${stemma(p.ospite)}</summary>
          ${lato(p.casa, 0)}<div class="fs-div"></div>${lato(p.ospite, 1)}</details>`;
      }).join('')}
      <p class="small muted" style="text-align:center">Riposa: ${esc(F.riposa(n).map(nomeSq).join(', '))}</p>
    </main>`;
  },
};
// ---- listone
let filtro = { ruolo: 'D', club: '', q: '' };
export const futsalListone = {
  title: 'Listone futsal', appbar: 'futsal', sub: () => 'Listone futsal',
  render() {
    const st = F.statistiche();
    let righe;
    if (filtro.ruolo === 'P') {
      const porte = F.SQUADRE.map((s) => {
        const v = F.giocate().map((n) => F.votiGiornata(n).porta.get(s.id)).filter((x) => !x.sv);
        return { s, presenze: v.length, media: v.length ? v.reduce((a, x) => a + x.totale, 0) / v.length : 0 };
      }).sort((a, b) => b.media - a.media);
      righe = porte.map(({ s, presenze, media }) => `<div class="vr">${stemma(s.id)}<span class="nm"><b>Porta ${esc(s.nome)}</b><span>${presenze} partite</span></span><span class="ev"></span><span class="fv">${fmt(media)}</span></div>`).join('');
    } else {
      const q = filtro.q.toLowerCase();
      righe = F.GIOCATORI_FUTSAL.filter((g) => g.ruolo === filtro.ruolo && (!filtro.club || g.club === filtro.club) && (!q || `${g.nome} ${g.cognome}`.toLowerCase().includes(q)))
        .sort((a, b) => (st.get(b.id)?.media || 0) - (st.get(a.id)?.media || 0))
        .map((g) => { const s = st.get(g.id); return `<div class="vr">${stemma(g.club)}<span class="nm"><b>${esc(g.nome)} ${esc(g.cognome)}</b><span>${esc(nomeSq(g.club))} · ${esc(g.ruoloFsgc)}${g.numero ? ` · n. ${g.numero}` : ''}</span></span><span class="ev">${s ? `${s.presenze}p · ${s.gol}g` : ''}</span><span class="fv">${s ? fmt(s.media) : '–'}</span></div>`; }).join('');
    }
    return `<main class="a-body fs">
      <div class="topbar" style="padding-top:0"><input class="field-input" id="fs-q" placeholder="Cerca un giocatore" value="${esc(filtro.q)}" autocomplete="off" style="flex:1"></div>
      <div class="chips sticky">${[['P', 'Porte'], ['D', 'Difensori'], ['A', 'Attaccanti']].map(([r, l]) => `<button class="chip${filtro.ruolo === r ? ' on' : ''}" data-ruolo="${r}">${l}</button>`).join('')}
        <select id="fs-club" class="select" aria-label="Squadra"><option value="">Squadra</option>${F.SQUADRE.map((s) => `<option value="${s.id}" ${filtro.club === s.id ? 'selected' : ''}>${esc(s.nome)}</option>`).join('')}</select></div>
      <p class="small muted fs-nota">Media dei punti nelle giornate in cui era in distinta · p = presenze · g = gol</p>
      <div class="a-card fs-list">${righe || '<p class="small muted" style="padding:12px">Nessuno.</p>'}</div>
    </main>`;
  },
  mount(root, ctx) {
    const main = root.querySelector('main');
    main.addEventListener('click', (e) => { const b = e.target.closest('[data-ruolo]'); if (b) { filtro.ruolo = b.dataset.ruolo; ctx.render(); } });
    root.querySelector('#fs-club').onchange = (e) => { filtro.club = e.target.value; ctx.render(); };
    const q = root.querySelector('#fs-q');
    q.onchange = () => { filtro.q = q.value.trim(); ctx.render(); };
  },
};

// ---- regolamento
export const futsalRegolamento = {
  title: 'Regolamento futsal', appbar: 'futsal', sub: () => 'Regolamento futsal',
  render() {
    const row = (k, v) => `<tr><td>${k}</td><td class="num" style="text-align:right">${v}</td></tr>`;
    const s = (n) => (n > 0 ? `+${fmt(n)}` : fmt(n));
    return `<main class="a-body rules">
      <div class="a-card"><p class="rule-art">COME SI GIOCA</p>
        <p><b>Ogni giornata scegli una formazione</b> fra tutti i giocatori del campionato: niente asta, niente rosa. La stessa formazione vale per la classifica generale, la coppa e le tue leghe con gli amici.</p>
        <p><b>Una Porta, quattro di movimento, due in panchina.</b> Al massimo un giocatore per squadra, Porta e panchina comprese.</p></div>
      <h3>Ruoli</h3>
      <table><tr><th>Ruolo</th><th>Chi è</th></tr>${row('P · Porta', 'tutti i portieri di una squadra')}${row('D · Difensore', 'Centrale, Laterale')}${row('A · Attaccante', 'Pivot, Universale')}</table>
      <p>Il referto FSGC non dice quale portiere ha giocato: per questo si sceglie la Porta di una squadra, che prende i gol subiti e gli eventi di tutti i suoi portieri.</p>
      <h3>Moduli</h3>
      <table>${row('2-2', 'Porta, 2 D, 2 A')}${row('3-1 difensivo', 'Porta, 3 D, 1 A')}</table>
      <p>Con il 3-1, se Porta e tre difensori fanno in media almeno ${fmt(R.bonusDifesa.soglia)}, la squadra prende <b>${s(R.bonusDifesa.punti)}</b>.</p>
      <h3>Punteggi</h3>
      <table><tr><th>Evento</th><th></th></tr>${row('In distinta', fmt(R.voto))}${row('Vittoria / sconfitta', `${s(R.esito.vittoria)} / ${fmt(R.esito.sconfitta)}`)}${row('Gol (anche su rigore)', s(R.gol))}${row('Autogol', fmt(R.autogol))}${row('Ammonizione', fmt(R.ammonizione))}${row('Espulsione', fmt(R.espulsione))}${row('Rigore sbagliato', fmt(R.rigoreSbagliato))}${row('Porta: gol subito', fmt(R.golSubito))}${row('Porta: inviolata', s(R.portaInviolata))}</table>
      <p>Prende il voto chi è in distinta: la FSGC non registra chi entra in campo. Assist e rigori parati non contano, perché il referto non li riporta.</p>
      <h3>Capitano e panchina</h3>
      <p>Il capitano raddoppia bonus e malus, non il voto. Se non ha voto la fascia passa al vice. Un titolare senza voto è sostituito dal panchinaro del suo ruolo, che non prende la fascia.</p>
      <h3>Tempi</h3>
      <p>Le formazioni si chiudono 10 minuti prima della prima partita della giornata (di solito lunedì sera). La giornata va dal lunedì al giovedì; una squadra riposa ogni volta.</p>
    </main>`;
  },
};
