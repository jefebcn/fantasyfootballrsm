/**
 * La sezione Futsal (FUTSAL.md). Per ora vive solo sul ramo `futsal` ed e'
 * nascosta: si apre con ?futsal=1 nell'indirizzo, si richiude con ?futsal=0
 * (vedi futsalAttivo). Le formazioni si salvano sul telefono: il server
 * arriva quando il regolamento sara' provato sulle giornate vere.
 */
import { CLUBS } from '../data.js';
import { esc, fmt, icon, sec, tile, dateIt, timeIt, empty, crest } from '../ui.js';
import * as F from '../futsal.js';
import * as FS from '../futsal-server.js';
import { maglia } from '../maglia.js';
import { controllaFormazione, punteggioFormazione, REGOLE_FUTSAL as R } from '../futsal-engine.js';
import { classificaSomma, classificaScontri, calendarioTesta, coppa, formatoCoppa, COPPA } from '../futsal-gare.js';

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
    const srv = FS.stato();
    const mia = srv.attivo ? FS.formazioneDi(n) : leggi()[n];
    const ultima = F.giocate().at(-1);
    const top = ultima ? migliori(ultima, 5) : [];
    const io = FS.io();
    const mvp = ultima && srv.iscritti.length ? classificaSomma(srv.iscritti.map((x) => x.user_id), [ultima], FS.punti)[0] : null;
    return `<main class="a-body fs">
      ${selettore('futsal')}
      ${srv.attivo && srv.caricato && !io ? `<div class="a-card fs-iscriviti">
        <span class="chip">FantaFutsal 2026/27</span>
        <h3>Iscriviti con lo stesso account</h3>
        <p class="small muted">Una squadra per account: ogni settimana scegli Porta, quattro di movimento e due in panchina. Vale per classifica, coppa e leghe con gli amici.</p>
        <input class="field-input" id="fs-squadra" placeholder="Nome della tua squadra" maxlength="30" autocomplete="off">
        <button class="a-btn big" id="fs-iscriviti">Iscriviti</button></div>` : ''}
      ${io ? `<div class="fs-io">${crest({ color: io.colore, initials: io.iniziali })}<div><b>${esc(io.squadra)}</b><span>${(() => { const r = classificaSomma(srv.iscritti.map((x) => x.user_id), F.giocate(), FS.punti).find((x) => x.id === io.user_id); return r ? `${r.posto}º su ${srv.iscritti.length} · ${fmt(r.totale)} punti` : ''; })()}</span></div><a href="#/futsal/classifica">${icon('chev', 'ic sm')}</a></div>` : ''}
      <div class="a-card fs-hero">
        <span class="chip">${n}ª giornata</span>
        <h3>${partite.length ? `${dateIt(partite[0].quando)} – ${dateIt(partite.at(-1).quando)}` : ''}</h3>
        <p class="small muted">${chiude ? `Formazioni chiuse ${dateIt(chiude.toISOString())} alle ${timeIt(chiude.toISOString())}` : ''} · riposa ${esc(F.riposa(n).map(nomeSq).join(', '))}</p>
        <a class="a-btn big" href="#/futsal/formazione" style="text-decoration:none">${icon('shirt', 'ic sm')}${mia ? 'Cambia la formazione' : 'Schiera la formazione'}</a>
        ${mia ? `<p class="small muted" style="margin-top:8px">${srv.attivo ? `Consegnata ${dateIt(FS.consegnataAlle(n))} alle ${timeIt(FS.consegnataAlle(n))}.` : controllaFormazione(espandi(mia)).length ? 'Formazione incompleta: finiscila prima della chiusura.' : 'Formazione pronta sul telefono.'}</p>` : ''}
      </div>
      ${sec('Le partite', `${n}ª giornata`)}
      <div class="a-card fs-list">${partite.map((p) => `<div class="fs-match">${stemma(p.casa)}<b>${esc(nomeSq(p.casa))}</b><span class="fs-ora">${timeIt(p.quando)}<small>${dateIt(p.quando)}</small></span><b class="r">${esc(nomeSq(p.ospite))}</b>${stemma(p.ospite)}</div>`).join('')}</div>
      ${ultima ? `${sec('I migliori', `${ultima}ª giornata`)}
      <div class="a-card fs-list">${top.map(({ g, v }) => `<a class="vr" href="#/futsal/giornata/${ultima}">${ruoloChip(g.ruolo)}<span class="nm"><b>${esc(nomeG(g))}</b><span>${esc(nomeSq(g.club))} · ${esc(g.ruoloFsgc)}</span></span><span class="ev"></span>${voto(v)}</a>`).join('')}</div>` : ''}
      ${io && ultima && FS.formazioneDi(ultima) ? tile({ href: `#/futsal/formazione/${ultima}`, lead: icon('shirt'), title: `La tua ${ultima}ª: ${fmt(FS.risultato(ultima)?.totale)} punti`, sub: 'apri il campo con i punti di ognuno' }) : ''}
      ${mvp && mvp.totale > 0 ? `${sec('Migliore della giornata', `${ultima}ª giornata`)}
      <div class="a-card fs-list"><a class="vr" href="#/futsal/classifica">${crest({ color: FS.iscritto(mvp.id)?.colore, initials: FS.iscritto(mvp.id)?.iniziali })}<span class="nm"><b>${esc(FS.iscritto(mvp.id)?.squadra || '')}</b><span>il punteggio più alto del turno</span></span><span class="ev"></span><span class="fv">${fmt(mvp.totale)}</span></a></div>` : ''}
      ${sec('Il gioco')}
      ${tile({ href: '#/futsal/classifica', lead: icon('cup'), title: 'Classifica', sub: srv.attivo ? `${srv.iscritti.length} iscritti, somma dei punti` : 'si apre col server futsal' })}
      ${tile({ href: '#/futsal/coppa', lead: icon('flag'), title: 'Coppa', sub: 'gironi e tabellone, dalla 9ª giornata' })}
      ${tile({ href: '#/futsal/leghe', lead: icon('userplus'), title: 'Leghe con gli amici', sub: srv.leghe.length ? `${srv.leghe.length} ${srv.leghe.length === 1 ? 'lega' : 'leghe'}` : 'crea un gruppo o entra con un codice' })}
      ${tile({ href: `#/futsal/giornata/${ultima || 1}`, lead: icon('votes'), title: 'Giornate e voti', sub: `${F.giocate().length} giornate giocate, voti dai referti FSGC` })}
      ${tile({ href: '#/futsal/listone', lead: icon('users'), title: 'Listone', sub: `${F.GIOCATORI_FUTSAL.filter((g) => g.ruolo !== 'P').length} giocatori e 15 porte` })}
      ${tile({ href: '#/futsal/regolamento', lead: icon('book'), title: 'Regolamento', sub: 'Porta, difensori, attaccanti: come si fanno i punti' })}
    </main>`;
  },
  mount(root, ctx) {
    caricaE(ctx, '#/futsal');
    root.querySelector('#fs-iscriviti')?.addEventListener('click', async (e) => {
      const nome = root.querySelector('#fs-squadra').value.trim();
      if (nome.length < 2) { ctx.toast('Scrivi il nome della squadra'); return; }
      e.target.disabled = true;
      try { await FS.iscriviti(nome); ctx.toast('Iscritto al FantaFutsal'); ctx.render(); } catch (err) { ctx.toast(err.message); e.target.disabled = false; }
    });
  },
};

/** Carica i dati del server la prima volta e ridisegna, se si e' ancora li'. */
function caricaE(ctx, hash) {
  if (FS.stato().caricato) return;
  FS.carica().then(() => { if (location.hash === hash || (hash === '#/futsal' && location.hash === '#/futsal')) ctx.render(); });
}

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

/** Il campo da futsal: 40x20, linee da parquet. viewBox 100x150, la Porta in basso. */
const CAMPO = `<svg class="fs-righe" viewBox="0 0 100 150" preserveAspectRatio="none" aria-hidden="true">
  <rect x="3" y="3" width="94" height="144" rx="1.5"/><path d="M3 75h94"/>
  <circle cx="50" cy="75" r="13"/><circle cx="50" cy="75" r="1.2" class="pieno"/>
  <path d="M28 3v4a22 18 0 0 0 44 0v-4"/><path d="M28 147v-4a22 18 0 0 1 44 0v4"/>
  <rect x="42" y="0.5" width="16" height="2.5"/><rect x="42" y="147" width="16" height="2.5"/>
  <circle cx="50" cy="30" r="1" class="pieno"/><circle cx="50" cy="120" r="1" class="pieno"/>
</svg>`;

/** Una maglia sul campo: colore della squadra, numero, fascia, punti se la giornata e' giocata. */
function inCampo(slot, id, { porta = null, fascia = '', punti = null, entrato = null, modificabile = true } = {}) {
  const g = id && F.giocatore(id);
  const club = porta || g?.club;
  const etichetta = porta ? `Porta ${nomeSq(porta)}` : g ? nomeG(g) : '';
  const vuoto = !club;
  const ruolo = slot.split(':')[0];
  const corpo = vuoto
    ? `<span class="fs-vuota">+</span><b>${{ P: 'Porta', D: 'Difensore', A: 'Attaccante' }[ruolo]}</b>`
    : `<span class="fs-mg">${maglia({ c1: colore.get(club)?.color || '#2B4C7E' })}<i class="fs-num">${porta ? 'P' : g?.numero ?? ''}</i>
        ${fascia ? `<i class="fs-cap">${fascia}</i>` : ''}${punti != null ? `<i class="fs-pt${punti === 0 ? ' zero' : ''}">${fmt(punti)}</i>` : ''}</span>
       <b>${esc(etichetta)}</b><small>${esc(entrato ? `per ${nomeG(F.giocatore(entrato))}` : porta ? 'tutti i portieri' : nomeSq(club))}</small>`;
  return modificabile ? `<button class="fs-slot2${vuoto ? ' vuoto' : ''}" data-slot="${slot}">${corpo}</button>` : `<div class="fs-slot2">${corpo}</div>`;
}

/** Dalla formazione salvata sul server alla bozza dell'editor. */
function daServer(f) {
  const t = (f.titolari || []).map((id) => ({ id, r: F.giocatore(id)?.ruolo }));
  return { modulo: f.modulo, porta: f.porta, D: t.filter((x) => x.r === 'D').map((x) => x.id), A: t.filter((x) => x.r === 'A').map((x) => x.id),
    pD: f.panchina?.[0] || null, pA: f.panchina?.[1] || null, capitano: f.capitano, vice: f.vice };
}
const perServer = (b) => ({ modulo: b.modulo, porta: b.porta, titolari: [...b.D, ...b.A], panchina: [b.pD, b.pA], capitano: b.capitano, vice: b.vice });
let bozzaDi = null;

export const futsalFormazione = {
  title: 'Formazione futsal', appbar: 'futsal', sub: (ctx) => `Formazione · ${Number(ctx.params.n) || F.giornataCorrente()}ª giornata`,
  render(ctx) {
    const n = Number(ctx.params.n) || F.giornataCorrente();
    const srv = FS.stato();
    const salvata = srv.attivo ? FS.formazioneDi(n) : leggi()[n];
    if (bozzaDi !== n) { bozza = null; bozzaDi = n; }
    bozza ||= salvata ? (srv.attivo ? adatta(daServer(salvata)) : salvata) : vuota();
    const chiude = F.chiusura(n);
    const chiusa = !chiude || chiude.getTime() <= Date.now();
    const f = espandi(bozza);
    const errori = controllaFormazione(f);
    const ris = chiusa && salvata ? FS.risultato(n) : null;
    const pt = (id) => ris?.righe.find((r) => r.id === id || (r.posto === 'P' && !id));
    const giocatore = (ruolo, i, id) => {
      const r = id && pt(id);
      // senza voto e sostituito: in campo va la maglia di chi e' entrato
      const chi = r?.entrato?.id || id;
      return inCampo(`${ruolo}:${i}`, chi, { fascia: r?.capitano || (!r && bozza.capitano === id) ? 'C' : !r && bozza.vice === id ? 'V' : '', punti: r ? r.punti : null, entrato: r?.entrato ? id : null, modificabile: !chiusa });
    };
    const consegnata = srv.attivo ? FS.consegnataAlle(n) : null;
    const devoIscrivermi = srv.attivo && srv.caricato && !FS.io();
    const giocate = F.giocate();
    provaSu ||= giocate.at(-1);
    const prova = !chiusa && !errori.length && provaSu ? punteggioFormazione(f, (() => { const v = F.votiGiornata(provaSu); return { porta: v.porta.get(f.porta), giocatori: v.giocatori }; })()) : null;
    return `<main class="a-body fs">
      <div class="a-card fs-stato">
        <div><b>${n}ª giornata</b><span>${chiude ? `${chiusa ? 'chiusa' : 'si chiude'} ${dateIt(chiude.toISOString())} alle ${timeIt(chiude.toISOString())}` : 'date non ancora fissate dalla FSGC'}</span></div>
        ${consegnata ? `<span class="fs-ok">${icon('check', 'ic sm')}consegnata ${dateIt(consegnata)} ${timeIt(consegnata)}</span>` : chiusa ? '<span class="fs-no">non consegnata</span>' : '<span class="fs-no">da consegnare</span>'}
      </div>
      ${chiusa ? '' : `<div class="seg seg-cls" role="tablist" aria-label="Modulo">${Object.keys(R.moduli).map((m) => `<button data-modulo="${m}" class="${bozza.modulo === m ? 'on' : ''}">${m}${m === R.bonusDifesa.modulo ? ' · difensivo' : ''}</button>`).join('')}</div>`}
      <div class="fs-campo">${CAMPO}
        <div class="fs-linea">${bozza.A.map((id, i) => giocatore('A', i, id)).join('')}</div>
        <div class="fs-linea">${bozza.D.map((id, i) => giocatore('D', i, id)).join('')}</div>
        <div class="fs-linea">${inCampo('P:0', null, { porta: bozza.porta, punti: ris ? ris.righe[0].punti : null, modificabile: !chiusa })}</div>
      </div>
      ${ris ? `<div class="a-card fs-totale"><span>${ris.bonusDifesa?.preso ? `Bonus difesa +${fmt(ris.bonusDifesa.punti, 0)} · ` : ''}fantapunti</span><b>${fmt(ris.totale)}</b></div>` : ''}
      <p class="small muted fs-nota">${chiusa ? 'Formazione chiusa: i punti arrivano dai referti FSGC.' : bozza.modulo === R.bonusDifesa.modulo ? `Bonus difesa +${fmt(R.bonusDifesa.punti, 0)} se Porta e tre difensori fanno in media almeno ${fmt(R.bonusDifesa.soglia)}.` : 'Tocca una maglia per sceglierla. Tocca di nuovo un titolare per farlo capitano (C) o vice (V).'}</p>
      ${sec('In panchina', 'entra per un titolare del suo ruolo senza voto')}
      <div class="a-card fs-list">${posto('pD', 0, bozza.pD, 'Difensore di riserva', chiusa)}${posto('pA', 0, bozza.pA, 'Attaccante di riserva', chiusa)}</div>
      ${!chiusa && errori.length ? `<div class="a-card fs-err">${errori.map((e) => `<p>${icon('warn', 'ic sm')}${esc(e)}</p>`).join('')}</div>` : ''}
      ${chiusa ? '' : devoIscrivermi
    ? `<a class="a-btn big" href="#/futsal" style="text-decoration:none">Prima iscriviti al FantaFutsal</a>`
    : `<button class="a-btn big" id="fs-salva" ${errori.length ? 'disabled' : ''}>${consegnata ? 'Aggiorna' : 'Consegna'} la formazione della ${n}ª</button>
      ${srv.attivo ? '' : '<p class="small muted" style="text-align:center">Server futsal non ancora attivo: si salva solo su questo telefono.</p>'}`}
      ${prova ? `${sec('Se l\'avessi schierata', `<select id="fs-prova" class="select">${giocate.map((g) => `<option value="${g}" ${g === provaSu ? 'selected' : ''}>${g}ª giornata</option>`).join('')}</select>`)}
      ${tabellaPunti(prova)}` : ''}
    </main>`;
  },
  mount(root, ctx) {
    caricaE(ctx, location.hash);
    const main = root.querySelector('main');
    main.addEventListener('click', async (e) => {
      const m = e.target.closest('[data-modulo]');
      if (m) { bozza = adatta({ ...bozza, modulo: m.dataset.modulo }); pulisciFasce(); ctx.render(); return; }
      const s = e.target.closest('[data-slot]');
      if (s) { apriScelta(s.dataset.slot, ctx); return; }
      const b = e.target.closest('#fs-salva');
      if (!b) return;
      const n = Number(ctx.params.n) || F.giornataCorrente();
      if (!FS.stato().attivo) { const t = leggi(); t[n] = bozza; scrivi(t); ctx.toast('Formazione salvata sul telefono'); ctx.go('futsal'); return; }
      b.disabled = true;
      try { await FS.consegna(n, perServer(bozza)); ctx.toast('Formazione consegnata'); ctx.go('futsal'); } catch (err) { ctx.toast(err.message); b.disabled = false; }
    });
    root.querySelector('#fs-prova')?.addEventListener('change', (e) => { provaSu = Number(e.target.value); ctx.render(); });
  },
};

/** Una riga di panchina. */
function posto(ruolo, i, id, etichetta, chiusa = false) {
  const g = id && F.giocatore(id);
  const tag = chiusa ? 'div' : 'button';
  return `<${tag} class="vr fs-slot" ${chiusa ? '' : `data-slot="${ruolo}:${i}"`}>${ruoloChip(ruolo === 'pD' ? 'D' : 'A')}<span class="nm"><b>${g ? esc(nomeG(g)) : `<span class="muted">${etichetta}</span>`}</b><span>${g ? `${esc(nomeSq(g.club))} · ${esc(g.ruoloFsgc)}` : 'tocca per scegliere'}</span></span><span class="ev"></span>${chiusa ? '' : icon('chev', 'ic sm')}</${tag}>`;
}

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

// ---- classifica generale
const squadraDi = (id) => FS.iscritto(id) || { squadra: '—', colore: '#5B6B7C', iniziali: '?' };
const rigaSquadra = (id, destra, sotto = '') => { const s = squadraDi(id); return `<div class="vr${id === FS.io()?.user_id ? ' fs-mia' : ''}">${crest({ color: s.colore, initials: s.iniziali }, 'fs-crest')}<span class="nm"><b>${esc(s.squadra)}</b>${sotto ? `<span>${sotto}</span>` : ''}</span><span class="ev"></span>${destra}</div>`; };
const nonAttivo = () => `<main class="a-body fs">${empty('Il server del FantaFutsal non è ancora attivo: classifiche, coppa e leghe partono quando lo sarà.')}</main>`;

export const futsalClassifica = {
  title: 'Classifica futsal', appbar: 'futsal', sub: () => 'Classifica generale',
  render() {
    const srv = FS.stato();
    if (!srv.caricato) return `<main class="a-body fs">${empty('Carico la classifica…')}</main>`;
    if (!srv.attivo) return nonAttivo();
    const giocate = F.giocate();
    const righe = classificaSomma(srv.iscritti.map((x) => x.user_id), giocate, FS.punti);
    return `<main class="a-body fs">
      <p class="small muted fs-nota">${srv.iscritti.length} iscritti · ${giocate.length} giornate con i referti · vince chi fa più punti dopo la 30ª</p>
      <div class="a-card fs-list fs-classifica">${righe.map((r) => `<div class="vr${r.id === FS.io()?.user_id ? ' fs-mia' : ''}"><span class="fs-pos">${r.posto}</span>${crest({ color: squadraDi(r.id).colore, initials: squadraDi(r.id).iniziali }, 'fs-crest')}<span class="nm"><b>${esc(squadraDi(r.id).squadra)}</b><span>${r.giornate} consegnate · media ${fmt(r.media)}</span></span><span class="fv">${fmt(r.totale)}</span></div>`).join('') || '<p class="small muted" style="padding:12px">Ancora nessun iscritto.</p>'}</div>
    </main>`;
  },
  mount(root, ctx) { caricaE(ctx, '#/futsal/classifica'); },
};

// ---- coppa
const sfidaHtml = (s) => `<div class="fs-sfida"><span>${esc(squadraDi(s.a).squadra)}</span><b>${s.pa == null ? '–' : fmt(s.pa)}</b><i>–</i><b>${s.pb == null ? '–' : fmt(s.pb)}</b><span class="r">${s.b ? esc(squadraDi(s.b).squadra) : s.media ? 'media del girone' : 'riposa'}</span></div>`;
const tabellaGirone = (g) => `<div class="a-card fs-list">${g.classifica.map((r) => rigaSquadra(r.id, `<span class="fv">${r.punti}</span>`, `${r.vinte}V ${r.pari}N ${r.perse}P · ${fmt(r.fatti)} fatti`)).join('')}</div>`;

export const futsalCoppa = {
  title: 'Coppa futsal', appbar: 'futsal', sub: () => 'Coppa',
  render() {
    const srv = FS.stato();
    if (!srv.caricato) return `<main class="a-body fs">${empty('Carico la coppa…')}</main>`;
    if (!srv.attivo) return nonAttivo();
    const inizio = F.chiusura(COPPA.preliminari[0]);
    const prima = !inizio || inizio.getTime() > Date.now();
    const ammessi = srv.iscritti.filter((x) => !inizio || new Date(x.created_at) <= inizio).map((x) => x.user_id);
    const formato = formatoCoppa(ammessi.length);
    const descr = { completo: 'preliminari in due gironi, poi 8 gironi da quattro e gli ottavi', medio: 'preliminari in due gironi, poi 4 gironi da quattro e i quarti', ridotto: 'gironi da quattro (o cinque), poi il tabellone' };
    if (prima) {
      return `<main class="a-body fs">
        <div class="a-card fs-hero"><span class="chip">Coppa · si parte con la ${COPPA.preliminari[0]}ª</span>
          <h3>${formato ? `Con ${ammessi.length} iscritti: ${descr[formato.nome]}` : `Servono almeno 8 iscritti: ora sono ${ammessi.length}`}</h3>
          <p class="small muted">Il sorteggio si fa alla chiusura della ${COPPA.preliminari[0]}ª giornata${inizio ? ` (${dateIt(inizio.toISOString())} alle ${timeIt(inizio.toISOString())})` : ''}: partecipa chi è iscritto in quel momento. Nessuna formazione in più, conta quella della giornata. Finale alla ${COPPA.finale}ª.</p></div>
        ${sec('Le fasi')}
        <div class="a-card fs-fasi"><p><b>1 · Preliminari</b> giornate ${COPPA.preliminari.join('–')}, da 24 iscritti in su</p><p><b>2 · Gironi</b> giornate ${COPPA.gironi.join('–')}, andata e ritorno</p><p><b>3 · Tabellone</b> fino alla finale secca della ${COPPA.finale}ª</p></div>
      </main>`;
    }
    const c = coppa(ammessi, FS.punti);
    if (!c.formato) return `<main class="a-body fs">${empty(`La coppa non si gioca: alla chiusura della ${COPPA.preliminari[0]}ª gli iscritti erano ${ammessi.length}, ne servivano 8.`)}</main>`;
    const turni = (partite) => partite.map((p) => `${sec(`${p.giornata}ª giornata`)}<div class="a-card fs-list">${p.sfide.map(sfidaHtml).join('')}</div>`).join('');
    return `<main class="a-body fs">
      ${c.campione ? `<div class="a-card fs-hero"><span class="chip">Campione</span><h3>${esc(squadraDi(c.campione).squadra)}</h3></div>` : ''}
      ${c.tabellone.length ? `${sec('Tabellone')}${c.tabellone.map((t) => `${sec(t.nome, t.giornate.map((g) => `${g}ª`).join(' e '))}<div class="a-card fs-list">${t.sfide.map((s) => sfidaHtml({ a: s.a, b: s.b, pa: s.gare.every((x) => x[0] != null) ? s.gare.reduce((x, y) => x + y[0], 0) : null, pb: s.gare.every((x) => x[1] != null) ? s.gare.reduce((x, y) => x + y[1], 0) : null })).join('')}</div>`).join('')}` : ''}
      ${c.gironi ? c.gironi.map((g) => `${sec(`Girone ${g.nome}`)}${tabellaGirone(g)}`).join('') : ''}
      ${c.preliminari ? c.preliminari.map((g) => `${sec(`Preliminari · girone ${g.nome}`)}${tabellaGirone(g)}${turni(g.partite.slice(-1))}`).join('') : ''}
    </main>`;
  },
  mount(root, ctx) { caricaE(ctx, '#/futsal/coppa'); },
};

// ---- leghe con gli amici
export const futsalLeghe = {
  title: 'Leghe futsal', appbar: 'futsal', sub: () => 'Leghe con gli amici',
  render() {
    const srv = FS.stato();
    if (!srv.caricato) return `<main class="a-body fs">${empty('Carico le leghe…')}</main>`;
    if (!srv.attivo) return nonAttivo();
    if (!FS.io()) return `<main class="a-body fs">${empty('Prima iscriviti al FantaFutsal dalla home.', '<a class="a-btn" href="#/futsal" style="text-decoration:none">Vai alla home</a>')}</main>`;
    return `<main class="a-body fs">
      ${srv.leghe.length ? `${sec('Le tue leghe')}<div class="a-card fs-list">${srv.leghe.map((l) => `<a class="vr" href="#/futsal/lega/${l.id}">${icon(l.tipo === 'testa' ? 'users' : 'cup')}<span class="nm"><b>${esc(l.nome)}</b><span>${l.tipo === 'testa' ? 'testa a testa' : 'a somma di punti'} · ${FS.membriDi(l.id).length} squadre</span></span><span class="ev"></span>${icon('chev', 'ic sm')}</a>`).join('')}</div>` : ''}
      ${sec('Crea una lega')}
      <div class="a-card fs-form"><input class="field-input" id="fs-lnome" placeholder="Nome della lega" maxlength="40" autocomplete="off">
        <div class="seg seg-cls" id="fs-ltipo"><button data-tipo="somma" class="on">A somma</button><button data-tipo="testa">Testa a testa</button></div>
        <p class="small muted">A somma: vince chi fa più punti. Testa a testa: ogni giornata contro un altro del gruppo, 3 punti a chi fa di più.</p>
        <button class="a-btn" id="fs-crea">Crea</button></div>
      ${sec('Entra con un codice')}
      <div class="a-card fs-form"><input class="field-input" id="fs-codice" placeholder="Codice (es. F3A9C1)" maxlength="8" autocomplete="off" style="text-transform:uppercase"><button class="a-btn sec" id="fs-entra">Entra</button></div>
    </main>`;
  },
  mount(root, ctx) {
    caricaE(ctx, '#/futsal/leghe');
    let tipo = 'somma';
    root.querySelector('#fs-ltipo')?.addEventListener('click', (e) => { const b = e.target.closest('[data-tipo]'); if (!b) return; tipo = b.dataset.tipo; root.querySelectorAll('#fs-ltipo button').forEach((x) => x.classList.toggle('on', x === b)); });
    root.querySelector('#fs-crea')?.addEventListener('click', async () => {
      const nome = root.querySelector('#fs-lnome').value.trim(); if (nome.length < 2) { ctx.toast('Scrivi il nome della lega'); return; }
      try { const l = await FS.creaLega(nome, tipo); ctx.go(`futsal/lega/${l.id}`); } catch (err) { ctx.toast(err.message); }
    });
    root.querySelector('#fs-entra')?.addEventListener('click', async () => {
      try { const id = await FS.entraLega(root.querySelector('#fs-codice').value); ctx.go(`futsal/lega/${id}`); } catch (err) { ctx.toast(err.message); }
    });
  },
};

export const futsalLega = {
  title: 'Lega futsal', appbar: 'futsal', sub: (ctx) => FS.stato().leghe.find((l) => l.id === ctx.params.id)?.nome || 'Lega',
  render(ctx) {
    const srv = FS.stato();
    if (!srv.caricato) return `<main class="a-body fs">${empty('Carico la lega…')}</main>`;
    const l = srv.leghe.find((x) => x.id === ctx.params.id);
    if (!l) return `<main class="a-body fs">${empty('Lega non trovata.', '<a class="a-btn" href="#/futsal/leghe" style="text-decoration:none">Le tue leghe</a>')}</main>`;
    const membri = FS.membriDi(l.id);
    const mia = l.creata_da === FS.io()?.user_id;
    let corpo;
    if (l.tipo === 'somma') {
      corpo = `<div class="a-card fs-list fs-classifica">${classificaSomma(membri, F.giocate(), FS.punti).map((r) => `<div class="vr${r.id === FS.io()?.user_id ? ' fs-mia' : ''}"><span class="fs-pos">${r.posto}</span>${crest({ color: squadraDi(r.id).colore, initials: squadraDi(r.id).iniziali }, 'fs-crest')}<span class="nm"><b>${esc(squadraDi(r.id).squadra)}</b><span>media ${fmt(r.media)}</span></span><span class="fv">${fmt(r.totale)}</span></div>`).join('')}</div>`;
    } else if (!l.avvio_giornata) {
      corpo = `<div class="a-card fs-hero"><h3>Il calendario non è ancora fissato</h3><p class="small muted">Quando ci sono tutti, ${mia ? 'avvia la lega' : 'chi l\'ha creata la avvia'}: gli scontri partono dalla prossima giornata aperta e chi arriva dopo non entra più.</p>${mia ? '<button class="a-btn" id="fs-avvia">Avvia la lega</button>' : ''}</div>
        <div class="a-card fs-list">${membri.map((id) => rigaSquadra(id, '')).join('')}</div>`;
    } else {
      const turni = calendarioTesta(l.membri_avvio, l.avvio_giornata);
      const { classifica, partite } = classificaScontri(l.membri_avvio, turni, FS.punti);
      const prossima = partite.find((p) => p.sfide.some((s) => s.pa == null)) || partite.at(-1);
      corpo = `<div class="a-card fs-list fs-classifica">${classifica.map((r) => `<div class="vr${r.id === FS.io()?.user_id ? ' fs-mia' : ''}"><span class="fs-pos">${r.posto}</span>${crest({ color: squadraDi(r.id).colore, initials: squadraDi(r.id).iniziali }, 'fs-crest')}<span class="nm"><b>${esc(squadraDi(r.id).squadra)}</b><span>${r.vinte}V ${r.pari}N ${r.perse}P · ${fmt(r.fatti)} fatti</span></span><span class="fv">${r.punti}</span></div>`).join('')}</div>
        ${prossima ? `${sec(`${prossima.giornata}ª giornata`)}<div class="a-card fs-list">${prossima.sfide.map(sfidaHtml).join('')}</div>` : ''}`;
    }
    return `<main class="a-body fs">
      <div class="a-card fs-stato"><div><b>${esc(l.nome)}</b><span>${l.tipo === 'testa' ? 'testa a testa' : 'a somma di punti'} · ${membri.length} squadre</span></div><span class="fs-codice">${esc(l.codice)}</span></div>
      ${corpo}
      <button class="a-btn ghost" id="fs-esci">Esci dalla lega</button>
    </main>`;
  },
  mount(root, ctx) {
    caricaE(ctx, location.hash);
    root.querySelector('#fs-avvia')?.addEventListener('click', async () => { try { const g = await FS.avviaLega(ctx.params.id); ctx.toast(`Si parte dalla ${g}ª giornata`); ctx.render(); } catch (err) { ctx.toast(err.message); } });
    root.querySelector('#fs-esci')?.addEventListener('click', async () => { if (!confirm('Esci dalla lega?')) return; try { await FS.esciLega(ctx.params.id); ctx.go('futsal/leghe'); } catch (err) { ctx.toast(err.message); } });
  },
};
