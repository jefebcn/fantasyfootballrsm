/**
 * La sezione Futsal (FUTSAL.md). Per ora vive solo sul ramo `futsal` ed e'
 * nascosta: si apre con ?futsal=1 nell'indirizzo, si richiude con ?futsal=0
 * (vedi futsalAttivo).
 *
 * Dal 29/10/2026 e' costruita sul modello di Dunkest (FUTSAL.md § 13): una
 * rosa comprata con i crediti, quotazioni che si muovono dopo ogni giornata,
 * il campo con schema, sesto uomo e panchina, le statistiche dei giocatori
 * con il loro profilo, i campionati principali in home e il regolamento a
 * capitoli. Senza il server futsal la squadra si salva sul telefono.
 */
import { CLUBS } from '../data.js';
import * as Stato from '../state.js';
import { esc, fmt, icon, sec, tile, dateIt, timeIt, empty, crest } from '../ui.js';
import * as F from '../futsal.js';
import * as FS from '../futsal-server.js';
import * as V from '../futsal-valori.js';
import { magliaFs, logoFs, caricaFs } from '../futsal-grafica.js';
import { controllaFormazione, punteggioFormazione, REGOLE_FUTSAL as R } from '../futsal-engine.js';
import { classificaSomma, classificaScontri, calendarioTesta, coppa, formatoCoppa, COPPA, SERIE, giornateSerie } from '../futsal-gare.js';

const CHIAVE = 'fcs:futsal';
const LOCALI = 'fcs:futsal:squadre';

/**
 * L'interruttore che tiene nascosta la sezione a chi non la deve vedere.
 * Gli amministratori dell'app la vedono da soli, per provarla dal vivo in
 * anteprima (Alex, 29/10); gli altri solo con ?futsal=1. ?futsal=0 la spegne
 * anche a un amministratore.
 */
export function futsalAttivo() {
  let v = null;
  try { v = localStorage.getItem(CHIAVE); } catch { /* senza storage decide il profilo */ }
  if (v === '1') return true;
  if (v === '0') return false;
  return Stato.isAdmin();
}
/** ?futsal=1 accende, ?futsal=0 spegne: da chiamare all'avvio. */
export function leggiInterruttore() {
  const m = /[?&#]futsal=([01])\b/.exec(`${location.search}&${location.hash}`);
  if (!m) return;
  try { localStorage.setItem(CHIAVE, m[1]); } catch { /* senza storage resta come dice il profilo */ }
}

/** Le icone disegnate per il futsal (media/icone/futsal), colorate dalla CSS come quelle del calcio. */
export const maskFs = (name, cls = '') => `<i class="mi ${cls}" style="--m:url(/media/icone/futsal/${name}.svg)"></i>`;

/** Calcio | Futsal, in cima alle due home. */
export const selettore = (sport) => `<div class="seg seg-cls sport-sw" role="tablist" aria-label="Sport">
  <a role="tab" class="${sport === 'calcio' ? 'on' : ''}" href="#/">Calcio</a>
  <a role="tab" class="${sport === 'futsal' ? 'on' : ''}" href="#/futsal">${maskFs('pallone')}Futsal</a></div>`;

/** Il colore della barra del telefono dentro il futsal (styles/futsal-tema.css). */
export const COLORE_BARRA = '#111111';

// ---------------------------------------------------------------- piccoli pezzi
const colore = new Map(CLUBS.map((c) => [c.id, c]));
const nomeSq = (id) => F.squadra.get(id)?.nome || id;
const stemma = (id, cls = 'fs-crest') => { const c = colore.get(id); return crest({ color: c?.color, initials: c?.shortName || String(id).slice(0, 3).toUpperCase() }, cls); };
const nomeG = (g) => `${g.cognome} ${g.nome ? `${g.nome[0]}.` : ''}`;
const ruoloChip = (r) => `<span class="rl rl-${r === 'P' ? 'p' : r === 'D' ? 'd' : 'a'}">${r}</span>`;
const RUOLI = { P: 'Porta', D: 'Difensore', A: 'Attaccante' };
const cr = (x) => fmt(x, 1);
const piu = (x) => (x > 0 ? `+${fmt(x, 1)}` : x < 0 ? `−${fmt(-x, 1)}` : '0,0');
/** Il colore del punteggio, a fasce come i «fantasy_pts_colors» di Dunkest. */
const fascia = (p) => (p == null ? 'fp-n' : p < 6 ? 'fp-r' : p < 9 ? 'fp-g' : 'fp-v');
const punti = (p, extra = '') => `<span class="fp ${fascia(p)}${extra}">${p == null ? '–' : fmt(p)}</span>`;
const nomeId = (id) => (V.ePorta(id) ? `Porta ${nomeSq(id.slice(2))}` : nomeG(F.giocatore(id)));
const clubId = (id) => (V.ePorta(id) ? id.slice(2) : F.giocatore(id)?.club);
const profilo = (id) => `#/futsal/giocatore/${encodeURIComponent(id)}`;

/** «tra 9 ore», «tra 2 giorni», «tra 25 minuti». */
function traQuanto(d) {
  const m = Math.round((d.getTime() - Date.now()) / 60000);
  if (m < 60) return `tra ${Math.max(1, m)} ${m === 1 ? 'minuto' : 'minuti'}`;
  const h = Math.round(m / 60);
  if (h < 36) return `tra ${h} ${h === 1 ? 'ora' : 'ore'}`;
  return `tra ${Math.round(h / 24)} giorni`;
}
const quando = (d) => `${dateIt(d.toISOString())} alle ${timeIt(d.toISOString())}`;

/** La giornata da preparare: la prima che si chiude nel futuro. */
function daPreparare() {
  for (let n = 1; n <= F.GIORNATE; n++) { const c = F.chiusura(n); if (c && c.getTime() > Date.now()) return n; }
  return null;
}
/** Lo stato del mercato per la giornata n (§ 13.7). */
function mercato(n) {
  const c = F.chiusura(n);
  if (!c) return { aperto: false, stato: 'chiuso', testo: 'Date non ancora fissate dalla FSGC' };
  if (c.getTime() <= Date.now()) return { aperto: false, stato: 'chiuso', testo: `Chiuso ${quando(c)}: si gioca` };
  if (!V.quotazioniPronte(n)) return { aperto: false, stato: 'attesa', testo: `Riapre con i referti della ${n - 1}ª` };
  return { aperto: true, stato: 'aperto', testo: `Si chiude ${traQuanto(c)}` };
}

// ---------------------------------------------------------------- la squadra, sul server o sul telefono
function locali() { try { return JSON.parse(localStorage.getItem(LOCALI)) || {}; } catch { return {}; } }
function scriviLocale(n, f) { const t = locali(); t[n] = f; try { localStorage.setItem(LOCALI, JSON.stringify(t)); } catch { /* niente */ } }
const sulServer = () => FS.stato().attivo;
/** La squadra in vigore alla giornata k (l'ultima salvata fino a k). */
function inVigore(k) {
  if (sulServer()) return FS.inVigore(k);
  const t = locali();
  for (let i = k; i >= 1; i--) if (t[i]?.D) return t[i];
  return null;
}
const salvataIn = (k) => (sulServer() ? FS.formazioneDi(k) : locali()[k] || null);
const bilancioOra = (n, bozza) => V.bilancio(inVigore, n, bozza);
function risultatoDi(k) {
  if (sulServer()) return FS.risultato(k);
  const f = inVigore(k);
  if (!f || !F.giocate().includes(k)) return null;
  const v = F.votiGiornata(k);
  return punteggioFormazione(FS.perMotore(f), { porta: v.porta.get(f.porta), giocatori: v.giocatori }, { malus: bilancioOra(k).malus });
}

/** Il riquadro d'iscrizione: nome della squadra e squadra del cuore. */
const iscrizione = (titolo = 'Crea la tua squadra') => `<div class="a-card fs-iscriviti">
  <span class="chip">FantaFutsal 2026/27 · gratis · stesso account del calcio</span>
  <h3>${titolo}</h3>
  <p class="small muted">Il nome lo vedranno gli altri in classifica. La squadra del cuore ti mette nel suo campionato dei tifosi.</p>
  <input class="field-input" id="fs-squadra" placeholder="Nome della tua squadra" maxlength="30" autocomplete="off">
  <select class="select" id="fs-cuore" aria-label="Squadra del cuore"><option value="">Squadra del cuore (facoltativa)</option>${F.SQUADRE.map((s) => `<option value="${s.id}">${esc(s.nome)}</option>`).join('')}</select>
  <button class="a-btn big" id="fs-iscriviti">Iscriviti e crea la squadra</button></div>`;
function montaIscrizione(root, ctx) {
  root.querySelector('#fs-iscriviti')?.addEventListener('click', async (e) => {
    const nome = root.querySelector('#fs-squadra').value.trim();
    if (nome.length < 2) { ctx.toast('Scrivi il nome della squadra'); return; }
    e.target.disabled = true;
    try { await FS.iscriviti(nome, '#1B84C6', root.querySelector('#fs-cuore').value || null); ctx.toast('Iscritto: ora compra la tua rosa'); ctx.go('futsal/squadra'); } catch (err) { ctx.toast(err.message); e.target.disabled = false; }
  });
}

/** Il gioco in quattro passi, come le schermate di benvenuto di Dunkest. */
const comeSiGioca = () => `<div class="fs-intro">
  ${[['shirt', 'Crea la tua squadra', `${R.budget} crediti per comprare la Porta di una squadra e 8 giocatori veri del campionato sammarinese: 4 difensori e 4 attaccanti.`],
    ['users', 'Sfida gli altri', 'Classifica generale, campionato dei tifosi, le tre Serie, la Coppa Titano e le leghe con gli amici: tutte con la stessa squadra.'],
    ['edit', 'Gestisci la rosa', 'Ogni giornata scegli schema, chi va in campo, sesto uomo e capitano. Tra una giornata e l\'altra compri e vendi.'],
    ['votes', 'Punti dai referti', 'I punti arrivano dai referti ufficiali FSGC: convocazioni, risultato, gol e cartellini. Le quotazioni salgono e scendono con le prestazioni.']]
    .map(([ic, t, d], i) => `<div class="fs-passo"><i>${i + 1}</i>${icon(ic)}<b>${t}</b><p>${d}</p></div>`).join('')}
  <a class="fs-link" href="#/futsal/regolamento">Il regolamento completo ${icon('chev', 'ic sm')}</a></div>`;

/** Per il menu laterale (app.js): chi sei nel futsal. */
export function menuFutsal() {
  const io = FS.io();
  return { iscritto: !!io, squadra: io?.squadra || '', stemma: io ? crest({ color: io.colore, initials: io.iniziali }, 'md') : '' };
}
/** Per la barra in basso: un iscritto senza squadra, con il mercato aperto. */
export function formazioneMancante() {
  if (!FS.stato().attivo || !FS.io()) return false;
  const n = daPreparare();
  return !!n && mercato(n).aperto && !inVigore(n);
}

/** Carica i dati del server la prima volta e ridisegna, se si e' ancora li'. */
function caricaE(ctx) {
  if (FS.stato().caricato) return;
  const h = location.hash;
  FS.carica().then(() => { if (location.hash === h) ctx.render(); });
}

// ---------------------------------------------------------------- statistiche di comodo
const st = () => F.statistiche();
const sp = () => F.statistichePorte();
/** Media punti e presenze di un id (giocatore o Porta). */
function numeri(id) {
  if (V.ePorta(id)) { const x = sp().get(id.slice(2)); return { media: x?.media || 0, presenze: x?.partite || 0, punti: x?.punti || 0, trend: x?.trend || [] }; }
  const x = st().get(id); return { media: x?.media || 0, presenze: x?.presenze || 0, punti: x?.punti || 0, trend: x?.trend || [], ...x };
}
/** «In forma»: nelle ultime tre giocate ha fatto meglio della sua media di prima, come i «Players on fire» di Dunkest. */
function inForma(id) {
  const t = numeri(id).trend.filter((x) => x.punti != null && !x.riposo).map((x) => x.punti);
  if (t.length < 4) return false;
  const ultime = t.slice(-3), prima = t.slice(0, -3);
  const m = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  return m(ultime) >= m(prima) + 1.5;
}
/** La partita del club nella giornata n: «vs Folgore», «@ Murata», «riposa». */
function avversario(club, n) {
  const p = F.PARTITE.find((x) => x.g === n && (x.casa === club || x.ospite === club));
  if (!p) return 'riposa';
  return p.casa === club ? `vs ${nomeSq(p.ospite)}` : `@ ${nomeSq(p.casa)}`;
}

// ---------------------------------------------------------------- home
export const futsalHome = {
  title: 'Futsal', appbar: 'futsal', sub: () => 'Campionato di San Marino',
  render() {
    const srv = FS.stato();
    const io = FS.io();
    const nuovo = srv.attivo && srv.caricato && !io;
    const n = daPreparare() || F.giornataCorrente();
    const m = mercato(n);
    const ultima = F.giocate().at(-1);
    const ids = srv.iscritti.map((x) => x.user_id);
    const giocate = F.giocate();
    const posto = (lista, gg) => { const r = classificaSomma(lista, gg, FS.punti).find((x) => x.id === io?.user_id); return r ? `${r.posto}º su ${lista.length}` : `${lista.length} squadre`; };
    const serieOra = SERIE.find((s) => n <= s.a) || SERIE.at(-1);
    const cuore = io?.club_cuore;
    const tifosi = cuore ? srv.iscritti.filter((x) => x.club_cuore === cuore).map((x) => x.user_id) : [];
    const mia = io ? inVigore(n) : (srv.attivo ? null : inVigore(n));
    const b = mia ? bilancioOra(n) : null;
    const rUltima = ultima && (io || !srv.attivo) ? risultatoDi(ultima) : null;
    return `<main class="a-body fs">
      ${selettore('futsal')}
      ${nuovo ? `<div class="fs-benvenuto">${logoFs('grande')}<p>Il fanta del Campionato Sammarinese di Futsal</p></div>${comeSiGioca()}${iscrizione()}` : ''}
      ${io || !srv.attivo ? `<a class="fs-banda" href="#/futsal/squadra">
        <div class="fs-banda-top">${io ? crest({ color: io.colore, initials: io.iniziali }) : stemma('cailungo')}<div><b>${esc(io?.squadra || 'La mia squadra')}</b><span>${io ? posto(ids, giocate) : 'sul telefono'}${rUltima ? ` · ${ultima}ª: ${fmt(rUltima.totale)} pt` : ''}</span></div>${icon('chev', 'ic sm')}</div>
        <div class="fs-banda-num"><span><b>${n}ª</b>giornata</span><span class="fs-merc ${m.stato}"><b>${{ aperto: 'Aperto', attesa: 'In attesa', chiuso: 'Chiuso' }[m.stato]}</b>mercato</span><span><b>${b ? cr(b.residui) : cr(R.budget)}</b>crediti</span><span><b>${b && b.primo !== null && b.primo < n ? `${b.cambi}` : '–'}</b>cambi</span></div>
        <p>${mia ? esc(m.testo) : m.aperto ? 'Non hai ancora una squadra: compra la tua rosa' : esc(m.testo)}</p></a>` : ''}
      ${!nuovo ? sec('Campionati principali') : ''}
      ${!nuovo ? `<div class="a-card fs-list fs-camp">
        <a class="vr" href="#/futsal/classifica/generale">${icon('globe')}<span class="nm"><b>Generale</b><span>tutte le squadre · dalla 1ª</span></span><span class="ev">${srv.attivo ? posto(ids, giocate) : ''}</span>${icon('chev', 'ic sm')}</a>
        ${cuore ? `<a class="vr" href="#/futsal/classifica/tifosi-${cuore}">${stemma(cuore)}<span class="nm"><b>Tifosi ${esc(nomeSq(cuore))}</b><span>chi ha la tua squadra del cuore</span></span><span class="ev">${posto(tifosi, giocate)}</span>${icon('chev', 'ic sm')}</a>` : ''}
        <a class="vr" href="#/futsal/classifica/${serieOra.id}">${icon('flag')}<span class="nm"><b>${serieOra.nome}</b><span>giornate ${serieOra.da}–${serieOra.a} · classifica a parte</span></span><span class="ev">${srv.attivo ? posto(ids, giornateSerie(serieOra).filter((g) => giocate.includes(g))) : ''}</span>${icon('chev', 'ic sm')}</a>
        <a class="vr" href="#/futsal/coppa">${icon('cup')}<span class="nm"><b>Coppa Titano</b><span>gironi dalla ${COPPA.preliminari[0]}ª, finale alla ${COPPA.finale}ª</span></span><span class="ev"></span>${icon('chev', 'ic sm')}</a>
      </div>
      ${sec('I miei campionati')}
      ${srv.leghe.length ? `<div class="a-card fs-list">${srv.leghe.map((l) => `<a class="vr" href="#/futsal/lega/${l.id}">${icon(l.tipo === 'testa' ? 'users' : 'cup')}<span class="nm"><b>${esc(l.nome)}</b><span>${l.tipo === 'testa' ? 'testa a testa' : 'classifica a somma'} · ${FS.membriDi(l.id).length} squadre</span></span><span class="ev"></span>${icon('chev', 'ic sm')}</a>`).join('')}</div>` : ''}
      <div class="a-card fs-crea"><b>Crea o unisciti a un campionato con gli amici</b><div><a class="a-btn" href="#/futsal/leghe">Crea campionato</a><a class="a-btn sec" href="#/futsal/leghe">Unisciti</a></div></div>` : ''}
      ${ultima ? leader(ultima) : ''}
      ${sec('Le partite', `${n}ª giornata`)}
      <div class="a-card fs-list">${F.PARTITE.filter((p) => p.g === n).map((p) => `<div class="fs-match">${stemma(p.casa)}<b>${esc(nomeSq(p.casa))}</b><span class="fs-ora">${p.quando ? timeIt(p.quando) : '–'}<small>${p.quando ? dateIt(p.quando) : ''}</small></span><b class="r">${esc(nomeSq(p.ospite))}</b>${stemma(p.ospite)}</div>`).join('')}
        <p class="small muted" style="padding:8px 12px;margin:0">Riposa: ${esc(F.riposa(n).map(nomeSq).join(', '))}</p></div>
      ${nuovo ? '' : comeSiGioca()}
    </main>`;
  },
  mount(root, ctx) { caricaE(ctx); montaIscrizione(root, ctx); },
};

/** I leader della giornata: i migliori per punti e per plusvalenza. */
function leader(n) {
  const v = F.votiGiornata(n).giocatori;
  const top = [...v].filter(([, x]) => !x.sv && !x.riposo).sort((a, b) => b[1].totale - a[1].totale).slice(0, 3);
  const pl = V.migliorPlus(n, 3);
  const riga = (id, destra) => `<a class="fs-lead" href="${profilo(id)}">${maglietta(clubId(id), F.giocatore(id)?.numero)}<b>${esc(nomeId(id))}</b><small>${esc(nomeSq(clubId(id)))}</small>${destra}</a>`;
  return `${sec(`Leader della ${n}ª`, '<a href="#/futsal/statistiche">Statistiche</a>')}
    <div class="fs-leader"><p>Fantapunti</p><div>${top.map(([id, x]) => riga(id, punti(x.totale))).join('')}</div>
    ${pl.length ? `<p>Plusvalenza</p><div>${pl.map((x) => riga(x.id, `<span class="fp fp-plus">${piu(x.plus)}</span>`)).join('')}</div>` : ''}</div>`;
}

/** La maglia disegnata del futsal (src/futsal-grafica.js); col cognome sulle spalle dove c'e' spazio. */
const maglietta = (club, num = '', cls = '', nome = '') => `<span class="fs-mg ${cls}">${magliaFs({ colore: colore.get(club)?.color, numero: num, nome, porta: num === 'P' })}</span>`;

// ---------------------------------------------------------------- la squadra (il campo di Dunkest)
// Bozza: { porta, D: [id|null ×4], A: [id|null ×4], schema, sesto, capitano, vice }.
// La rosa e' posizionale: i primi s.D difensori e i primi s.A attaccanti sono
// in campo, gli altri in panchina. Cambiare schema sposta i giocatori da soli.
let bozza = null, bozzaDi = null, tentato = false;
// L'ultima mossa di mercato, per animarla al prossimo disegno: il posto
// appena comprato «entra» in campo e i crediti scorrono dal valore di prima.
let mossa = null;
const vuota = () => ({ porta: null, D: [null, null, null, null], A: [null, null, null, null], schema: '2-2', sesto: null, capitano: null, vice: null });
const S = (b) => R.schemi[b.schema];
const titolariB = (b) => [...b.D.slice(0, S(b).D), ...b.A.slice(0, S(b).A)];
const panchinaB = (b) => [...b.D.slice(S(b).D), ...b.A.slice(S(b).A)];
/** Dal formato salvato alla bozza: i titolari davanti. */
function daSalvata(f) {
  const t = new Set(f.titolari || []);
  const ordina = (a) => [...a.filter((x) => t.has(x)), ...a.filter((x) => !t.has(x))];
  return { porta: f.porta, D: ordina(f.D), A: ordina(f.A), schema: f.schema, sesto: f.sesto, capitano: f.capitano, vice: f.vice };
}
const perSalvare = (b) => ({ schema: b.schema, porta: b.porta, D: b.D, A: b.A, titolari: titolariB(b), sesto: b.sesto, capitano: b.capitano, vice: b.vice });
function sistema(b) {
  const tit = titolariB(b).filter(Boolean), pan = panchinaB(b).filter(Boolean);
  if (!pan.includes(b.sesto)) b.sesto = pan[0] || null;
  if (!tit.includes(b.capitano)) b.capitano = null;
  if (!tit.includes(b.vice) || b.vice === b.capitano) b.vice = null;
  return b;
}
const stessaRosa = (a, b) => { const x = V.elementi(a), y = V.elementi(b); return x.length === y.length && x.every((id) => y.includes(id)); };

/** Una maglia sul campo o in panchina, con quotazione e avversario (o punti a giornata chiusa). */
function cartellino(slot, id, n, { porta = false, fasciaC = '', riga = null, peso = null, modificabile = true, sesto = false } = {}) {
  const ruolo = slot[0];
  if (!id) {
    const corpo = `<span class="fs-vuota">+</span><b>${RUOLI[ruolo]}</b><small>${sesto ? 'sesto uomo' : 'tocca per comprare'}</small>`;
    return modificabile ? `<button class="fs-carta vuoto" data-slot="${slot}">${corpo}</button>` : `<div class="fs-carta vuoto">${corpo}</div>`;
  }
  const club = porta ? id : F.giocatore(id)?.club;
  const vid = porta ? V.idPorta(id) : id;
  const num = porta ? 'P' : F.giocatore(id)?.numero ?? '';
  const sotto = riga
    ? `<small class="fs-pti ${fascia(riga.voto.sv ? null : riga.voto.totale)}">${riga.voto.sv ? 'S.V.' : riga.voto.riposo ? `${fmt(riga.punti)} R` : fmt(riga.punti)}</small>`
    : `<small><em>${cr(V.quotazione(vid, n))}</em> CR · ${esc(avversario(club, n))}</small>`;
  const corpo = `${maglietta(club, num)}${fasciaC ? `<i class="fs-cap">${fasciaC}</i>` : ''}${peso != null ? `<i class="fs-peso">${peso}</i>` : ''}<b>${esc(porta ? `Porta ${nomeSq(id)}` : nomeG(F.giocatore(id)))}</b>${sotto}`;
  return `<button class="fs-carta${sesto ? ' sesto' : ''}${mossa?.slot === slot && mossa.compra ? ' arrivo' : ''}" data-slot="${slot}" data-id="${esc(id)}">${corpo}</button>`;
}

/** Il campo da futsal: 40x20, righe bianche. viewBox 100x150, la Porta in basso. */
const CAMPO = `<svg class="fs-righe" viewBox="0 0 100 150" preserveAspectRatio="none" aria-hidden="true">
  <rect x="3" y="3" width="94" height="144" rx="1.5"/><path d="M3 75h94"/>
  <circle cx="50" cy="75" r="13"/><circle cx="50" cy="75" r="1.2" class="pieno"/>
  <path d="M28 3v4a22 18 0 0 0 44 0v-4"/><path d="M28 147v-4a22 18 0 0 1 44 0v4"/>
  <rect x="42" y="0.5" width="16" height="2.5"/><rect x="42" y="147" width="16" height="2.5"/>
  <circle cx="50" cy="30" r="1" class="pieno"/><circle cx="50" cy="120" r="1" class="pieno"/>
</svg>`;

export const futsalSquadra = {
  title: 'La mia squadra', appbar: 'futsal', sub: (ctx) => `La mia squadra · ${Number(ctx.params.n) || daPreparare() || F.giornataCorrente()}ª giornata`,
  render(ctx) {
    const srv = FS.stato();
    if (srv.attivo && !srv.caricato) return `<main class="a-body fs">${caricaFs('Carico la tua squadra…')}</main>`;
    const n = Number(ctx.params.n) || daPreparare() || F.giornataCorrente();
    const m = mercato(n);
    const chiusa = m.stato === 'chiuso';
    const devoIscrivermi = srv.attivo && !FS.io();
    if (devoIscrivermi) return `<main class="a-body fs">${comeSiGioca()}${iscrizione()}</main>`;
    if (bozzaDi !== n) { bozza = null; bozzaDi = n; tentato = false; }
    const salvata = salvataIn(n);
    const prima = inVigore(n - 1);
    bozza ||= salvata?.D ? daSalvata(salvata) : prima ? daSalvata(prima) : vuota();
    if (chiusa) return risultati(n);
    const b = bozza;
    const sal = perSalvare(b);
    const bil = bilancioOra(n, sal);
    const errori = controllaFormazione(FS.perMotore(sal));
    const modifiche = !salvata?.D || JSON.stringify(perSalvare(daSalvata(salvata))) !== JSON.stringify(sal);
    const cambiaRosa = prima && !stessaRosa(sal, prima);
    const fasc = (id) => (id && b.capitano === id ? 'C' : id && b.vice === id ? 'V' : '');
    const s = S(b);
    const linea = (r, k) => Array.from({ length: k }, (_, i) => cartellino(`${r}:${i}`, b[r][i], n, { fasciaC: fasc(b[r][i]) })).join('');
    const pan = [];
    ['D', 'A'].forEach((r) => b[r].forEach((id, i) => { if (i >= s[r]) pan.push({ slot: `${r}:${i}`, id }); }));
    const comprati = V.elementi(sal).length;
    return `<main class="a-body fs">
      <div class="fs-cruscotto">
        <span><b>${n}ª</b>giornata</span>
        <span class="fs-merc ${m.stato}"><b>${{ aperto: 'Aperto', attesa: 'In attesa', chiuso: 'Chiuso' }[m.stato]}</b>mercato</span>
        <span class="${bil.residui < 0 ? 'neg' : ''}"><b>${cr(bil.residui)}</b>di ${cr(bil.patrimonio)} crediti</span>
        <span><b>${bil.primo !== null && bil.primo < n ? bil.cambi : '∞'}</b>${bil.primo !== null && bil.primo < n ? `cambi${bil.malus ? ` · −${bil.malus} pt` : ''}` : 'cambi'}</span>
      </div>
      <p class="small muted fs-nota">${esc(m.testo)}.${m.aperto ? ` ${bil.primo !== null && bil.primo < n ? `${R.cambiGratis === 1 ? 'Un cambio gratis' : `${R.cambiGratis} cambi gratis`}, poi −${R.malusCambio} punto a cambio.` : 'Prima rosa: cambi illimitati e gratis.'}` : ' Puoi cambiare schema, chi va in campo, sesto uomo e capitano, ma non comprare o vendere.'}</p>
      <div class="seg seg-cls fs-schemi" role="tablist" aria-label="Schema">${Object.keys(R.schemi).map((k) => `<button data-schema="${k}" class="${b.schema === k ? 'on' : ''}">${k}${k === R.bonusDifesa.schema ? ' bonus' : ''}</button>`).join('')}</div>
      <div class="fs-campo">${CAMPO}
        <div class="fs-linea">${linea('A', s.A)}</div>
        <div class="fs-linea">${linea('D', s.D)}</div>
        <div class="fs-linea">${cartellino('P:0', b.porta, n, { porta: true })}</div>
      </div>
      <div class="fs-panca">
        <p><span>Sesto uomo · 100%</span><span>Panchina · ${fmt(R.panchina * 100, 0)}%</span></p>
        <div>${pan.map(({ slot, id }) => cartellino(slot, id, n, { sesto: id && id === b.sesto, peso: id ? (id === b.sesto ? '6°' : '½') : null })).join('')}</div>
      </div>
      <div class="fs-conta"><b>Rosa ${comprati} su 9</b><span>${b.capitano ? 'capitano ✓' : 'capitano –'} · ${b.vice ? 'vice ✓' : 'vice –'} · ${b.sesto ? 'sesto uomo ✓' : 'sesto uomo –'}</span></div>
      <p class="small muted fs-nota">Tocca una maglia per capitano, vice, sostituzioni o per venderla; tocca un «+» per comprare. Al massimo ${R.perClub} giocatori della stessa squadra, Porta compresa.</p>
      ${tentato && errori.length ? `<div class="a-card fs-err">${errori.map((e) => `<p>${icon('warn', 'ic sm')}${esc(e)}</p>`).join('')}</div>` : ''}
      ${tentato && cambiaRosa && !m.aperto ? `<div class="a-card fs-err"><p>${icon('warn', 'ic sm')}Il mercato è chiuso: rimetti la rosa della ${n - 1}ª o aspetta i referti.</p></div>` : ''}
      ${bil.residui < 0 && (cambiaRosa || !prima) ? `<div class="a-card fs-err"><p>${icon('warn', 'ic sm')}Ti mancano ${cr(-bil.residui)} crediti: vendi qualcuno o compra giocatori meno cari.</p></div>` : ''}
      <button class="a-btn big" id="fs-salva" ${modifiche ? '' : 'disabled'}>${modifiche ? `Salva la squadra per la ${n}ª` : `${icon('check', 'ic sm')}Squadra salvata`}</button>
      <p class="small muted" style="text-align:center">${salvata?.D ? `Salvata ${dateIt(FS.consegnataAlle(n) || new Date().toISOString())}. Vale anche per le giornate dopo, finché non la cambi.` : prima ? `È la squadra della ${n - 1}ª: se non la tocchi gioca così.` : 'La squadra resta da una giornata all\'altra: la fai una volta e poi la aggiusti.'}${srv.attivo ? '' : ' Server futsal non ancora attivo: si salva solo su questo telefono.'}</p>
      ${prova(sal, errori)}
    </main>`;
  },
  mount(root, ctx) {
    caricaE(ctx);
    montaIscrizione(root, ctx);
    const main = root.querySelector('main');
    const n = Number(ctx.params.n) || daPreparare() || F.giornataCorrente();
    if (mossa) { scorriCrediti(root, mossa.da); mossa = null; }
    main.addEventListener('click', async (e) => {
      const sc = e.target.closest('[data-schema]');
      if (sc) { bozza.schema = sc.dataset.schema; sistema(bozza); ctx.render(); return; }
      const sl = e.target.closest('[data-slot]');
      if (sl) { if (mercato(n).stato === 'chiuso') { if (sl.dataset.id) ctx.go(`futsal/giocatore/${encodeURIComponent(sl.dataset.slot[0] === 'P' ? V.idPorta(sl.dataset.id) : sl.dataset.id)}`); return; } apri(sl.dataset.slot, n, ctx); return; }
      const pv = e.target.closest('#fs-prova'); if (pv) return;
      const b = e.target.closest('#fs-salva');
      if (!b) return;
      const sal = perSalvare(bozza);
      const prima = inVigore(n - 1);
      const m = mercato(n);
      const errori = controllaFormazione(FS.perMotore(sal));
      const cambia = !prima || !stessaRosa(sal, prima);
      const bil = bilancioOra(n, sal);
      if (errori.length || (cambia && !m.aperto) || (cambia && bil.residui < 0)) { tentato = true; ctx.toast(errori.length ? 'Mancano ancora delle scelte' : !m.aperto ? 'Mercato chiuso' : 'Crediti insufficienti'); ctx.render(); return; }
      if (!sulServer()) { scriviLocale(n, sal); timbro('Squadra salvata', 'sul telefono'); ctx.render(); return; }
      b.disabled = true;
      try { await FS.consegna(n, sal); timbro('Squadra salvata', `${n}ª giornata`); ctx.render(); } catch (err) { ctx.toast(err.message); b.disabled = false; }
    });
    root.querySelector('#fs-prova')?.addEventListener('change', (e) => { provaSu = Number(e.target.value); ctx.render(); });
  },
};
export const futsalFormazione = futsalSquadra;

const fermo = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
/** I crediti scorrono dal valore di prima a quello nuovo, e la differenza vola via. */
function scorriCrediti(root, da) {
  const b = root.querySelector('.fs-cruscotto span:nth-child(3) b');
  if (!b) return;
  const a = Number(b.textContent.replace(',', '.'));
  if (!Number.isFinite(a) || Math.abs(a - da) < 0.05) return;
  const d = Math.round((a - da) * 10) / 10;
  const volo = document.createElement('i');
  volo.className = `fs-volo ${d < 0 ? 'giu' : 'su'}`;
  volo.textContent = `${d > 0 ? '+' : '−'}${cr(Math.abs(d))}`;
  b.parentElement.appendChild(volo);
  setTimeout(() => volo.remove(), 1100);
  if (fermo()) return;
  const t0 = performance.now();
  const passo = (t) => {
    const k = Math.min(1, (t - t0) / 600);
    b.textContent = cr(Math.round((da + (a - da) * (1 - (1 - k) ** 3)) * 10) / 10);
    if (k < 1) requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
}
/** Il timbro sopra lo schermo: la squadra e' salvata (o altro da dire forte). */
function timbro(testo, sotto = '') {
  const t = document.createElement('div');
  t.className = 'fs-timbro'; t.setAttribute('role', 'status');
  t.innerHTML = `<div><b>${esc(testo)}</b>${sotto ? `<small>${esc(sotto)}</small>` : ''}</div>`;
  document.body.appendChild(t);
  navigator.vibrate?.(25);
  setTimeout(() => t.remove(), 1500);
}

let provaSu = null;
/** Quanto avrebbe fatto questa squadra in una giornata gia' giocata: per capire i punti prima di giocare. */
function prova(sal, errori) {
  const giocate = F.giocate();
  if (errori.length || !giocate.length) return '';
  provaSu ||= giocate.at(-1);
  const v = F.votiGiornata(provaSu);
  const r = punteggioFormazione(FS.perMotore(sal), { porta: v.porta.get(sal.porta), giocatori: v.giocatori });
  return `${sec('Prova su una giornata già giocata', `<select id="fs-prova" class="select">${giocate.map((g) => `<option value="${g}" ${g === provaSu ? 'selected' : ''}>${g}ª giornata</option>`).join('')}</select>`)}
    <p class="small muted fs-nota">Quanti punti avrebbe fatto questa squadra nella ${provaSu}ª. È solo una prova: non conta in classifica.</p>${tabellaPunti(r)}`;
}

/** A giornata chiusa: il campo con i punti di ognuno, il totale e il dettaglio. */
function risultati(n) {
  const f = inVigore(n);
  const prossima = daPreparare();
  const vai = prossima && prossima !== n ? tile({ href: `#/futsal/squadra/${prossima}`, lead: icon('edit'), title: `Prepara la ${prossima}ª giornata`, sub: mercato(prossima).testo }) : '';
  if (!f) return `<main class="a-body fs">${empty(`Nella ${n}ª giornata non avevi una squadra.`)}${vai}</main>`;
  const b = daSalvata(f);
  const r = risultatoDi(n);
  const riga = (id) => r?.righe.find((x) => x.id === id && x.posto !== 'B' && x.posto !== 'S') || r?.righe.find((x) => x.id === id);
  const s = S(b);
  const linea = (ruolo, k) => Array.from({ length: k }, (_, i) => { const id = b[ruolo][i]; const x = riga(id); return cartellino(`${ruolo}:${i}`, x?.entrato?.id || id, n, { fasciaC: x?.capitano ? 'C' : '', riga: x, modificabile: false }); }).join('');
  const pan = panchinaB(b).map((id) => { const x = r?.righe.find((y) => y.id === id && (y.posto === 'S' || y.posto === 'B')); return cartellino(`${F.giocatore(id)?.ruolo}:x`, id, n, { sesto: id === b.sesto, peso: id === b.sesto ? '6°' : x?.usato ? '↑' : '½', riga: x, modificabile: false }); }).join('');
  return `<main class="a-body fs">
    <div class="fs-cruscotto"><span><b>${n}ª</b>giornata</span><span class="fs-merc chiuso"><b>Chiuso</b>mercato</span><span><b>${r ? fmt(r.totale) : '–'}</b>fantapunti</span><span><b>${b.schema}</b>schema</span></div>
    <p class="small muted fs-nota">${r ? 'I punti dai referti FSGC. R = riposa, prende la media.' : 'La giornata è chiusa: i punti arrivano con i referti FSGC, di solito il giorno dopo.'}</p>
    <div class="fs-campo">${CAMPO}
      <div class="fs-linea">${linea('A', s.A)}</div><div class="fs-linea">${linea('D', s.D)}</div>
      <div class="fs-linea">${cartellino('P:0', b.porta, n, { porta: true, riga: r?.righe[0], modificabile: false })}</div></div>
    <div class="fs-panca"><p><span>Sesto uomo · 100%</span><span>Panchina · ${fmt(R.panchina * 100, 0)}%</span></p><div>${pan}</div></div>
    ${r ? tabellaPunti(r) : ''}
    ${vai}
  </main>`;
}

function tabellaPunti(r) {
  const nota = (x) => (x.entrato ? `non convocato: entra ${nomeG(F.giocatore(x.entrato.id))}` : x.voto.sv ? x.voto.motivo : x.usato ? 'entrato in campo' : x.voto.voci.slice(x.voto.riposo ? 0 : 2).map((v) => v.etichetta).join(' · ') || 'nessun evento');
  const nome = (x) => (x.posto === 'P' ? `Porta ${nomeSq(x.club)}` : nomeG(F.giocatore(x.entrato?.id || x.id)));
  const peso = (x) => (x.posto === 'S' ? 'sesto' : x.posto === 'B' ? (x.usato ? '' : '50%') : x.capitano ? `×${fmt(R.capitano)}` : '');
  return `<div class="a-card fs-list">${r.righe.map((x) => `<div class="vr">${ruoloChip(x.posto === 'S' || x.posto === 'B' ? x.ruolo : x.posto)}<span class="nm"><b>${esc(nome(x))}${peso(x) ? ` <small class="fs-w">${peso(x)}</small>` : ''}</b><span>${esc(nota(x))}</span></span><span class="ev"></span>${x.voto.sv ? '<span class="fv sv">0</span>' : `<span class="fv${x.capitano ? ' cap' : ''}">${fmt(x.punti)}</span>`}</div>`).join('')}
  ${r.bonusDifesa ? `<div class="vr"><span></span><span class="nm"><b>Bonus difesa</b><span>media ${fmt(r.bonusDifesa.media)} su ${fmt(R.bonusDifesa.soglia)}</span></span><span class="ev"></span><span class="fv">${r.bonusDifesa.punti ? `+${fmt(r.bonusDifesa.punti, 0)}` : '0'}</span></div>` : ''}
  ${r.malus ? `<div class="vr"><span></span><span class="nm"><b>Cambi di mercato</b><span>oltre quelli gratis</span></span><span class="ev"></span><span class="fv">−${fmt(r.malus, 0)}</span></div>` : ''}
  <div class="vr fs-tot"><span></span><span class="nm"><b>Totale</b></span><span class="ev"></span><span class="fv">${fmt(r.totale)}</span></div></div>`;
}

/** Tocca un posto: se e' vuoto si compra, se e' pieno si apre la scheda del giocatore. */
function apri(slot, n, ctx) {
  const [r, i] = slot.split(':'); const idx = Number(i);
  const id = r === 'P' ? bozza.porta : bozza[r][idx];
  if (!id) { listino(r, idx, n, ctx); return; }
  scheda(r, idx, id, n, ctx);
}

/** Il «player modal» di Dunkest: numeri e azioni su un giocatore della rosa. */
function scheda(r, idx, id, n, ctx) {
  const vid = r === 'P' ? V.idPorta(id) : id;
  const club = clubId(vid);
  const x = numeri(vid);
  const pop = FS.stato().attivo ? FS.popolarita(Math.max(1, n - 1)) : null;
  const inCampo = r !== 'P' && idx < S(bozza)[r];
  const mAperto = mercato(n).aperto;
  const tit = titolariB(bozza).filter(Boolean);
  const pan = panchinaB(bozza).filter(Boolean);
  const azioni = [];
  if (inCampo) {
    azioni.push(`<button data-az="capitano" class="${bozza.capitano === id ? 'on' : ''}"><i>C</i>Capitano</button>`);
    azioni.push(`<button data-az="vice" class="${bozza.vice === id ? 'on' : ''}"><i>V</i>Vice</button>`);
    if (pan.length) azioni.push(`<button data-az="sost">${icon('undo')}Sostituisci</button>`);
  } else if (r !== 'P') {
    if (bozza.sesto !== id) azioni.push(`<button data-az="sesto"><i>6</i>Sesto uomo</button>`);
    if (tit.length) azioni.push(`<button data-az="sost">${icon('up')}In campo</button>`);
  }
  azioni.push(`<button data-az="vendi" ${mAperto ? '' : 'disabled'}>${icon('trash')}${r === 'P' ? 'Cambia' : 'Vendi'}</button>`);
  ctx.sheet(`<div class="fs-modale">
    <div class="fs-mod-top">${maglietta(club, r === 'P' ? 'P' : F.giocatore(id)?.numero, 'grande', r === 'P' ? '' : F.giocatore(id)?.cognome)}<div><small>${r === 'P' ? 'Porta' : esc(F.giocatore(id)?.nome || '')}</small><b>${esc(r === 'P' ? nomeSq(id) : F.giocatore(id)?.cognome || '')}</b><span>${RUOLI[r]}${r === 'P' ? '' : ` · ${esc(F.giocatore(id)?.ruoloFsgc || '')}`} · ${esc(nomeSq(club))}</span></div></div>
    <div class="fs-mod-num"><span><b>${cr(V.quotazione(vid, n))}</b>crediti</span><span><b>${fmt(x.media)}</b>media</span><span><b>${piu(V.plusTotale(vid, n))}</b>plus</span><span><b>${pop && pop.squadre ? `${Math.round(pop.di(vid) * 100)}%` : '–'}</b>pop</span></div>
    <div class="fs-mod-az">${azioni.join('')}</div>
    <a class="a-btn sec fs-mod-prof" href="${profilo(vid)}">Profilo completo</a>
    <div id="fs-mod-sost"></div></div>`);
  const sh = document.getElementById('sheet');
  sh.onclick = (e) => {
    const a = e.target.closest('[data-az]');
    const sw = e.target.closest('[data-swap]');
    if (sw) { scambia(id, sw.dataset.swap, ctx); return; }
    if (!a || a.disabled) return;
    const az = a.dataset.az;
    if (az === 'capitano' || az === 'vice') { const altro = az === 'capitano' ? 'vice' : 'capitano'; bozza[az] = id; if (bozza[altro] === id) bozza[altro] = null; ctx.sheet(null); ctx.render(); return; }
    if (az === 'sesto') { bozza.sesto = id; ctx.sheet(null); ctx.render(); return; }
    if (az === 'vendi') {
      mossa = { da: bilancioOra(n, perSalvare(bozza)).residui };
      if (r === 'P') bozza.porta = null; else bozza[r][idx] = null;
      sistema(bozza); ctx.sheet(null); ctx.render(); if (r === 'P') listino('P', 0, n, ctx); return;
    }
    if (az === 'sost') {
      const altri = inCampo ? pan : tit;
      sh.querySelector('#fs-mod-sost').innerHTML = `<p class="sheet-sub">${inCampo ? 'Chi entra al suo posto' : 'Al posto di chi'}: se il ruolo è diverso cambia lo schema.</p>
        <div class="fs-scelta">${altri.map((o) => { const g = F.giocatore(o); return `<button class="vr" data-swap="${o}">${ruoloChip(g.ruolo)}<span class="nm"><b>${esc(nomeG(g))}</b><span>${esc(nomeSq(g.club))} · ${esc(avversario(g.club, n))}</span></span><span class="ev"></span>${punti(numeri(o).media)}</button>`; }).join('')}</div>`;
    }
  };
}

/** Scambia un giocatore in campo con uno in panchina (in un verso o nell'altro). */
function scambia(a, b, ctx) {
  const s = S(bozza);
  const inCampo = (id) => { const r = F.giocatore(id).ruolo; return bozza[r].indexOf(id) < s[r]; };
  const [t, p] = inCampo(a) ? [a, b] : [b, a];
  const rt = F.giocatore(t).ruolo, rp = F.giocatore(p).ruolo;
  if (rt === rp) {
    const arr = bozza[rt], i = arr.indexOf(t), j = arr.indexOf(p);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  } else {
    const dt = bozza.D.slice(0, s.D), db = bozza.D.slice(s.D), at = bozza.A.slice(0, s.A), ab = bozza.A.slice(s.A);
    const via = (arr, x) => arr.filter((y) => y !== x);
    let nD, nA, nuovo;
    if (rt === 'D') { nD = [...via(dt, t), t, ...db]; nA = [...at, p, ...via(ab, p)]; nuovo = `${s.D - 1}-${s.A + 1}`; } else { nA = [...via(at, t), t, ...ab]; nD = [...dt, p, ...via(db, p)]; nuovo = `${s.D + 1}-${s.A - 1}`; }
    if (!R.schemi[nuovo]) { ctx.toast('In campo serve almeno un difensore e un attaccante'); return; }
    // il nuovo arrivato si mette in fondo alla sua linea, chi esce in testa alla panchina
    bozza.D = nD; bozza.A = nA; bozza.schema = nuovo;
  }
  if (bozza.capitano === t) bozza.capitano = p; else if (bozza.vice === t) bozza.vice = p;
  if (bozza.sesto === p) bozza.sesto = t;
  sistema(bozza); ctx.sheet(null); ctx.render();
}

let ordine = 'cr';
/** Il mercato di un posto: chi si puo' comprare, con prezzo, media e prossima partita. */
function listino(r, idx, n, ctx) {
  const m = mercato(n);
  if (!m.aperto) { ctx.toast(`Mercato chiuso: ${m.testo.toLowerCase()}`); return; }
  const sal = perSalvare(bozza);
  const attuale = r === 'P' ? (bozza.porta ? V.idPorta(bozza.porta) : null) : bozza[r][idx];
  const bil = bilancioOra(n, sal);
  const disponibili = bil.residui + (attuale ? V.quotazione(attuale, n) : 0);
  const club = new Map();
  for (const id of V.elementi(sal)) if (id !== attuale) { const c = clubId(id); club.set(c, (club.get(c) || 0) + 1); }
  const rosa = new Set(V.elementi(sal));
  const ids = r === 'P' ? F.SQUADRE.map((q) => V.idPorta(q.id)) : F.GIOCATORI_FUTSAL.filter((g) => g.ruolo === r).map((g) => g.id);
  const chiave = { cr: (id) => V.quotazione(id, n), mpf: (id) => numeri(id).media, plus: (id) => V.plusTotale(id, n) }[ordine];
  const righe = ids.sort((a, b) => chiave(b) - chiave(a)).map((id) => {
    const c = clubId(id), prezzo = V.quotazione(id, n);
    const perche = rosa.has(id) && id !== attuale ? 'già in rosa' : (club.get(c) || 0) >= R.perClub ? `già ${R.perClub} del ${nomeSq(c)}` : prezzo > disponibili + 1e-9 ? 'crediti insufficienti' : '';
    return `<button class="vr fs-compra" data-compra="${esc(id)}" data-nome="${esc(`${nomeId(id)} ${nomeSq(c)}`.toLowerCase())}" ${perche ? 'disabled' : ''}>${stemma(c)}<span class="nm"><b>${esc(nomeId(id))}${inForma(id) ? ' <i class="fs-fuoco" title="in forma">in forma</i>' : ''}</b><span>${esc(nomeSq(c))} · ${esc(avversario(c, n))}${perche ? ` · ${perche}` : ''}</span></span>${punti(numeri(id).presenze ? numeri(id).media : null)}<span class="fs-prezzo">${cr(prezzo)}</span></button>`;
  }).join('');
  ctx.sheet(`<h3>${r === 'P' ? 'Compra una Porta' : `Compra un ${RUOLI[r].toLowerCase()}`}</h3>
    <p class="sheet-sub">Hai <b>${cr(disponibili)} crediti</b>. ${r === 'P' ? 'La Porta prende i gol subiti e gli eventi di tutti i portieri della squadra.' : 'A sinistra del prezzo la media punti a partita.'}</p>
    <input class="field-input" id="fs-cerca" placeholder="Cerca per nome o squadra" autocomplete="off">
    <div class="chips fs-ordina">${[['cr', 'Prezzo'], ['mpf', 'Media'], ['plus', 'Plus']].map(([k, l]) => `<button class="chip${ordine === k ? ' on' : ''}" data-ord="${k}">${l}</button>`).join('')}</div>
    <div class="fs-scelta">${righe}</div>`);
  const sh = document.getElementById('sheet');
  sh.querySelector('#fs-cerca').oninput = (e) => { const q = e.target.value.trim().toLowerCase(); sh.querySelectorAll('[data-compra]').forEach((x) => { x.hidden = q && !x.dataset.nome.includes(q); }); };
  sh.onclick = (e) => {
    const o = e.target.closest('[data-ord]'); if (o) { ordine = o.dataset.ord; listino(r, idx, n, ctx); return; }
    const b = e.target.closest('[data-compra]'); if (!b || b.disabled) return;
    const id = b.dataset.compra;
    const prima = bilancioOra(n, perSalvare(bozza)).residui;
    if (r === 'P') bozza.porta = id.slice(2); else bozza[r][idx] = id;
    mossa = { slot: r === 'P' ? 'P:0' : `${r}:${idx}`, da: prima, compra: true };
    sistema(bozza); ctx.sheet(null); ctx.render();
  };
}

// ---------------------------------------------------------------- profilo giocatore
let schedaProf = 'info';
export const futsalGiocatore = {
  title: 'Giocatore futsal', appbar: 'futsal', sub: (ctx) => nomeId(ctx.params.id),
  render(ctx) {
    const id = ctx.params.id;
    const porta = V.ePorta(id);
    const g = porta ? null : F.giocatore(id);
    if (!porta && !g) return `<main class="a-body fs">${empty('Giocatore non trovato.')}</main>`;
    const club = clubId(id);
    const n = daPreparare() || F.giornataCorrente();
    const x = numeri(id);
    const pop = FS.stato().attivo ? FS.popolarita(Math.max(1, n - 1)) : null;
    const giocate = x.trend.filter((t) => t.punti != null && !t.riposo).map((t) => t.punti);
    const media = (a) => (a.length ? a.reduce((s, y) => s + y, 0) / a.length : null);
    const max = Math.max(10, ...x.trend.map((t) => t.punti || 0));
    const trend = `<div class="fs-trend">${x.trend.map((t) => `<span class="${t.riposo ? 'fp-n' : fascia(t.punti)}" style="--h:${t.punti == null ? 4 : Math.max(4, (t.punti / max) * 100)}%"><i>${t.punti == null ? 'SV' : fmt(t.punti)}</i><b>${t.g}ª</b></span>`).join('')}</div>`;
    const fino = V.ultimaPronta();
    const valori = Array.from({ length: fino }, (_, i) => V.quotazione(id, i + 1));
    const lo = Math.min(...valori) - 0.5, hi = Math.max(...valori) + 0.5;
    const punto = (v, i) => `${(i / Math.max(1, valori.length - 1)) * 100},${40 - ((v - lo) / (hi - lo)) * 36 - 2}`;
    const linea = `<svg class="fs-valore" viewBox="0 0 100 40" preserveAspectRatio="none"><polyline points="${valori.map(punto).join(' ')}"/></svg><div class="fs-valore-l"><span>${cr(valori[0])} alla 1ª</span><span>${cr(valori.at(-1))} alla ${fino}ª</span></div>`;
    const prossime = F.prossime(club, n);
    const log = [...x.trend].reverse().map((t) => {
      const v = porta ? F.votiGiornata(t.g).porta.get(club) : F.votiGiornata(t.g).giocatori.get(id);
      const p = F.PARTITE.find((q) => q.g === t.g && (q.casa === club || q.ospite === club));
      const contro = p ? (p.casa === club ? `vs ${nomeSq(p.ospite)}` : `@ ${nomeSq(p.casa)}`) : 'riposa';
      const ris = p && p.gc != null ? ` ${p.gc}–${p.go}` : '';
      const motivo = v.motivo === 'non in distinta' ? 'non convocato: non è nella distinta FSGC' : v.motivo;
      const voci = v.sv ? motivo : v.voci.map((y) => `${y.etichetta} ${y.valore > 0 ? '+' : ''}${fmt(y.valore)}`).join(' · ');
      const pl = t.g > V.VALORI.base ? V.plus(id, t.g) : null;
      const apri = p && F.referto(t.g, p.casa) ? ` data-partita="${t.g}|${p.casa}"` : '';
      return `<${apri ? 'button' : 'div'} class="vr"${apri}><span class="fs-gg">${t.g}ª</span><span class="nm"><b>${esc(contro)}${ris}</b><span>${esc(voci)}</span></span><span class="ev">${pl ? `<small class="fs-pl ${pl > 0 ? 'su' : 'giu'}">${piu(pl)}</small>` : ''}</span>${v.sv ? '<span class="fv sv">S.V.</span>' : punti(v.totale)}</${apri ? 'button' : 'div'}>`;
    }).join('');
    return `<main class="a-body fs">
      <div class="fs-modale fs-prof">
        <div class="fs-mod-top">${maglietta(club, porta ? 'P' : g.numero, 'grande', porta ? '' : g.cognome)}<div><small>${porta ? 'Porta' : esc(g.nome)}</small><b>${esc(porta ? nomeSq(club) : g.cognome)}</b><span>${porta ? 'tutti i portieri della squadra' : `${esc(g.ruoloFsgc)} · ${RUOLI[g.ruolo]}`} · ${esc(nomeSq(club))}</span></div>${inForma(id) ? '<i class="fs-fuoco">in forma</i>' : ''}</div>
        <div class="fs-mod-num"><span><b>${cr(V.quotazione(id, n))}</b>crediti</span><span><b>${fmt(x.media)}</b>media</span><span><b>${piu(V.plusTotale(id, n))}</b>plus</span><span><b>${pop && pop.squadre ? `${Math.round(pop.di(id) * 100)}%` : '–'}</b>pop</span></div>
      </div>
      <div class="seg seg-cls" role="tablist"><button data-tab="info" class="${schedaProf === 'info' ? 'on' : ''}">Info</button><button data-tab="partite" class="${schedaProf === 'partite' ? 'on' : ''}">Partite</button></div>
      ${schedaProf === 'info' ? `
      ${sec('Prossime partite', `<a href="#/futsal/giornata">Calendario</a>`)}
      <div class="a-card fs-prossime">${prossime.map((p) => { const casa = p.casa === club; const o = casa ? p.ospite : p.casa; return `<div><small>${p.quando ? `${dateIt(p.quando)}` : `${p.g}ª`}</small><small>${p.quando ? timeIt(p.quando) : ''}</small>${stemma(o)}<b>${casa ? 'vs' : '@'} ${esc(nomeSq(o))}</b></div>`; }).join('') || '<p class="small muted">Nessuna partita in calendario.</p>'}</div>
      ${sec('Forma')}
      <div class="a-card fs-forma"><span><b>${media(giocate.slice(-3)) == null ? '–' : fmt(media(giocate.slice(-3)))}</b>media ultime 3</span><span><b>${media(giocate.slice(-5)) == null ? '–' : fmt(media(giocate.slice(-5)))}</b>media ultime 5</span><span><b>${x.presenze}</b>${porta ? 'partite' : 'presenze'}</span></div>
      ${sec('Punti per giornata')}<div class="a-card">${trend}<p class="small muted" style="margin:8px 0 0">Rosso sotto il 6, giallo fino a 9, verde da 9 in su. Grigio: riposo o partita non giocata.</p></div>
      ${sec('Quotazione')}<div class="a-card">${linea}<p class="small muted" style="margin:6px 0 0">Si muove dopo ogni giornata: sale se fa più punti di quanti ne promette il suo prezzo, scende se ne fa meno.</p></div>
      ${porta ? (() => { const q = sp().get(club); return `${sec('Numeri')}<div class="a-card fs-forma"><span><b>${q.subiti}</b>gol subiti</span><span><b>${q.inviolate}</b>inviolate</span><span><b>${q.v}-${q.n}-${q.p}</b>V-N-P</span></div>`; })()
    : `${sec('Numeri')}<div class="a-card fs-forma"><span><b>${x.gol}</b>gol</span><span><b>${x.amm}</b>ammonizioni</span><span><b>${x.esp}</b>espulsioni</span><span><b>${x.autogol + x.rs}</b>autogol e rigori sbagliati</span></div>`}`
    : `<p class="small muted fs-nota">Tocca una partita per vedere le due distinte del referto FSGC.</p><div class="a-card fs-list fs-log">${log || '<p class="small muted" style="padding:12px">Nessuna partita.</p>'}</div>`}
    </main>`;
  },
  mount(root, ctx) {
    caricaE(ctx);
    root.querySelector('main').addEventListener('click', (e) => {
      const t = e.target.closest('[data-tab]'); if (t) { schedaProf = t.dataset.tab; ctx.render(); return; }
      const pa = e.target.closest('[data-partita]');
      if (pa) { const [g, casa] = pa.dataset.partita.split('|'); apriPartita(Number(g), casa, V.ePorta(ctx.params.id) ? null : ctx.params.id, ctx); }
    });
  },
};

// ---------------------------------------------------------------- statistiche
let vistaStat = 'giocatori', ordStat = { col: 'pf', verso: -1 }, filtroStat = { ruolo: '', club: '', q: '' };
const COLONNE_G = [['cr', 'CR', 'crediti'], ['plus', 'PLUS', 'plusvalenza'], ['pf', 'PF', 'fantapunti totali'], ['mpf', 'MPF', 'media fantapunti'], ['pg', 'PG', 'presenze'], ['gol', 'G', 'gol'], ['amm', 'AMM', 'ammonizioni'], ['esp', 'ESP', 'espulsioni'], ['ag', 'AG', 'autogol'], ['rs', 'RS', 'rigori sbagliati']];
const COLONNE_P = [['cr', 'CR', 'crediti'], ['plus', 'PLUS', 'plusvalenza'], ['pf', 'PF', 'fantapunti totali'], ['mpf', 'MPF', 'media'], ['pg', 'PG', 'partite'], ['gs', 'GS', 'gol subiti'], ['inv', 'INV', 'porte inviolate'], ['vnp', 'V-N-P', 'vinte, pari, perse']];
export const futsalStatistiche = {
  title: 'Statistiche futsal', appbar: 'futsal', sub: () => 'Statistiche',
  render() {
    const n = daPreparare() || F.giornataCorrente();
    const tabs = [['giocatori', 'Giocatori'], ['porte', 'Porte'], ['squadre', 'Squadre'], ['leader', 'Leader']];
    let corpo = '';
    if (vistaStat === 'giocatori' || vistaStat === 'porte') {
      const porte = vistaStat === 'porte';
      const q = filtroStat.q.toLowerCase();
      let righe = porte
        ? F.SQUADRE.map((s) => { const x = sp().get(s.id), id = V.idPorta(s.id); return { id, club: s.id, nome: `Porta ${s.nome}`, r: 'P', cr: V.quotazione(id, n), plus: V.plusTotale(id, n), pf: x.punti, mpf: x.media, pg: x.partite, gs: x.subiti, inv: x.inviolate, vnp: x.v * 100 + x.n, vnpT: `${x.v}-${x.n}-${x.p}` }; })
        : F.GIOCATORI_FUTSAL.filter((g) => g.ruolo !== 'P').map((g) => { const x = st().get(g.id) || {}; return { id: g.id, club: g.club, nome: nomeG(g), r: g.ruolo, cr: V.quotazione(g.id, n), plus: V.plusTotale(g.id, n), pf: x.punti || 0, mpf: x.media || 0, pg: x.presenze || 0, gol: x.gol || 0, amm: x.amm || 0, esp: x.esp || 0, ag: x.autogol || 0, rs: x.rs || 0 }; });
      righe = righe.filter((x) => (!filtroStat.ruolo || porte || x.r === filtroStat.ruolo) && (!filtroStat.club || x.club === filtroStat.club) && (!q || `${x.nome} ${nomeSq(x.club)}`.toLowerCase().includes(q)));
      const col = (porte ? COLONNE_P : COLONNE_G).some(([k]) => k === ordStat.col) ? ordStat.col : 'pf';
      righe.sort((a, b) => ordStat.verso * ((a[col] ?? 0) - (b[col] ?? 0)) || a.nome.localeCompare(b.nome));
      const cols = porte ? COLONNE_P : COLONNE_G;
      corpo = `<div class="fs-filtri">${porte ? '' : `<div class="chips">${[['', 'Tutti'], ['D', 'Difensori'], ['A', 'Attaccanti']].map(([r, l]) => `<button class="chip${filtroStat.ruolo === r ? ' on' : ''}" data-fr="${r}">${l}</button>`).join('')}</div>`}
        <div class="fs-filtri-r"><input class="field-input" id="fs-sq" placeholder="Cerca" value="${esc(filtroStat.q)}" autocomplete="off"><select id="fs-sclub" class="select" aria-label="Squadra"><option value="">Tutte le squadre</option>${F.SQUADRE.map((s) => `<option value="${s.id}" ${filtroStat.club === s.id ? 'selected' : ''}>${esc(s.nome)}</option>`).join('')}</select></div></div>
        <div class="fs-tab-wrap"><table class="fs-tab"><thead><tr><th class="fs-tab-n">#</th><th class="fs-tab-g">${porte ? 'Porta' : 'Giocatore'}</th>${cols.map(([k, l, t]) => `<th data-col="${k}" title="${t}" class="${col === k ? (ordStat.verso < 0 ? 'giu' : 'su') : ''}">${l}</th>`).join('')}</tr></thead>
        <tbody>${righe.map((x, i) => `<tr><td class="fs-tab-n">${i + 1}</td><td class="fs-tab-g"><a href="${profilo(x.id)}">${porte ? '' : ruoloChip(x.r)}<span><b>${esc(x.nome)}</b><small>${esc(nomeSq(x.club))}</small></span></a></td>${cols.map(([k]) => `<td class="${col === k ? 'on' : ''}${k === 'plus' ? (x.plus > 0 ? ' su' : x.plus < 0 ? ' giu' : '') : ''}">${k === 'vnp' ? x.vnpT : k === 'plus' ? piu(x.plus) : k === 'cr' || k === 'mpf' || k === 'pf' ? fmt(x[k], k === 'cr' ? 1 : 1) : x[k]}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
        <p class="small muted fs-nota">Tocca un'intestazione per ordinare. ${cols.map(([, l, t]) => `<b>${l}</b> ${t}`).join(' · ')}.</p>`;
    } else if (vistaStat === 'squadre') {
      const cl = F.classificaReale();
      corpo = `<div class="fs-tab-wrap"><table class="fs-tab"><thead><tr><th class="fs-tab-n">#</th><th class="fs-tab-g">Squadra</th><th>PT</th><th>G</th><th>V</th><th>N</th><th>P</th><th>GF</th><th>GS</th><th>DR</th><th title="fantapunti a partita lasciati ai difensori avversari">vs D</th><th title="fantapunti a partita lasciati agli attaccanti avversari">vs A</th></tr></thead>
        <tbody>${cl.map((x, i) => `<tr><td class="fs-tab-n">${i + 1}</td><td class="fs-tab-g"><a href="${profilo(V.idPorta(x.id))}">${stemma(x.id)}<span><b>${esc(nomeSq(x.id))}</b></span></a></td><td class="on">${x.punti}</td><td>${x.g}</td><td>${x.v}</td><td>${x.n}</td><td>${x.p}</td><td>${x.gf}</td><td>${x.gs}</td><td>${x.dr > 0 ? '+' : ''}${x.dr}</td><td>${fmt(x.controD)}</td><td>${fmt(x.controA)}</td></tr>`).join('')}</tbody></table></div>
        <p class="small muted fs-nota">La classifica vera del campionato FSGC. <b>vs D</b> e <b>vs A</b>: quanti fantapunti a partita fanno contro questa squadra i difensori e gli attaccanti avversari. Più è alto, più conviene schierare chi la affronta.</p>`;
    } else {
      const giocate = F.giocate();
      const ult = giocate.at(-1);
      const tutti = F.GIOCATORI_FUTSAL.filter((g) => g.ruolo !== 'P');
      const lista = (titolo, arr, val) => `${sec(titolo)}<div class="a-card fs-list fs-rank">${arr.map((x, i) => `<a class="vr" href="${profilo(x.id)}"><span class="fs-pos">${i + 1}</span>${stemma(clubId(x.id))}<span class="nm"><b>${esc(nomeId(x.id))}</b><span>${esc(nomeSq(clubId(x.id)))}</span></span>${val(x)}</a>`).join('') || '<p class="small muted" style="padding:12px">Ancora nessuno.</p>'}</div>`;
      corpo = `${ult ? lista(`Fantapunti della ${ult}ª`, [...F.votiGiornata(ult).giocatori].filter(([, v]) => !v.sv && !v.riposo).sort((a, b) => b[1].totale - a[1].totale).slice(0, 5).map(([id, v]) => ({ id, v: v.totale })), (x) => punti(x.v)) : ''}
        ${lista('Media stagione (almeno 3 presenze)', tutti.filter((g) => (st().get(g.id)?.presenze || 0) >= 3).sort((a, b) => st().get(b.id).media - st().get(a.id).media).slice(0, 5).map((g) => ({ id: g.id })), (x) => punti(st().get(x.id).media))}
        ${lista('Plusvalenza totale', V.QUOTATI().map((id) => ({ id, p: V.plusTotale(id, n) })).filter((x) => x.p > 0).sort((a, b) => b.p - a.p).slice(0, 5), (x) => `<span class="fp fp-plus">${piu(x.p)}</span>`)}
        ${lista('In forma', tutti.filter((g) => inForma(g.id)).sort((a, b) => st().get(b.id).media - st().get(a.id).media).slice(0, 5).map((g) => ({ id: g.id })), () => '<i class="fs-fuoco">in forma</i>')}
        ${lista('Capocannonieri', tutti.filter((g) => (st().get(g.id)?.gol || 0) > 0).sort((a, b) => st().get(b.id).gol - st().get(a.id).gol).slice(0, 5).map((g) => ({ id: g.id })), (x) => `<span class="fv">${st().get(x.id).gol}</span>`)}
        ${lista('Porte con più inviolate', F.SQUADRE.map((s) => ({ id: V.idPorta(s.id), i: sp().get(s.id).inviolate })).sort((a, b) => b.i - a.i).slice(0, 3), (x) => `<span class="fv">${x.i}</span>`)}`;
    }
    return `<main class="a-body fs">
      <div class="seg seg-cls fs-stab" role="tablist">${tabs.map(([k, l]) => `<button data-vista="${k}" class="${vistaStat === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      ${corpo}
    </main>`;
  },
  mount(root, ctx) {
    const main = root.querySelector('main');
    main.addEventListener('click', (e) => {
      const v = e.target.closest('[data-vista]'); if (v) { vistaStat = v.dataset.vista; ctx.render(); return; }
      const c = e.target.closest('[data-col]'); if (c) { ordStat = c.dataset.col === ordStat.col ? { col: ordStat.col, verso: -ordStat.verso } : { col: c.dataset.col, verso: -1 }; ctx.render(); return; }
      const r = e.target.closest('[data-fr]'); if (r) { filtroStat.ruolo = r.dataset.fr; ctx.render(); }
    });
    root.querySelector('#fs-sclub')?.addEventListener('change', (e) => { filtroStat.club = e.target.value; ctx.render(); });
    const q = root.querySelector('#fs-sq');
    if (q) q.onchange = () => { filtroStat.q = q.value.trim(); ctx.render(); };
  },
};
export const futsalListone = futsalStatistiche;

// ---------------------------------------------------------------- calendario e voti
/**
 * Le due distinte di una partita, come le pubblica la FSGC: tutti i
 * convocati in ordine di numero, col ruolo, gli eventi del referto e il voto.
 * evid: un giocatore da evidenziare (chi apre la partita dal suo profilo).
 */
function distinte(n, casa, evid = null) {
  const p = F.PARTITE.find((x) => x.g === n && x.casa === casa);
  const ref = F.referto(n, casa);
  if (!p || !ref) return '<p class="small muted" style="padding:12px">Il referto di questa partita non c\'e\' ancora.</p>';
  const voti = F.votiGiornata(n);
  const voto = (v) => (!v || v.sv ? '<span class="fv sv">S.V.</span>' : punti(v.totale));
  const segni = (id) => {
    const e = ref.eventi.filter((x) => x[0] === id), c = (t) => e.filter((x) => x[2] === t).length;
    const g = c('goal'), ag = c('own_goal'), am = c('yellow'), es = c('red'), rs = c('pen_missed');
    return `${g ? `<i class="fs-ev gol">${g > 1 ? `${g}×` : ''}gol</i>` : ''}${ag ? '<i class="fs-ev ag">AG</i>' : ''}${am ? '<i class="fs-ev amm"></i>' : ''}${es ? '<i class="fs-ev esp"></i>' : ''}${rs ? '<i class="fs-ev rs">RS</i>' : ''}`;
  };
  const lato = (club, i) => {
    const ids = [...(ref.distinte[i] || [])].sort((a, b) => (Number(F.giocatore(a)?.numero) || 99) - (Number(F.giocatore(b)?.numero) || 99));
    const porta = voti.porta.get(club);
    return `<div class="fs-dist-testa">${stemma(club)}<b>${esc(nomeSq(club))}</b><span>${ids.length} in distinta</span></div>
      <a class="vr fs-dist" href="${profilo(V.idPorta(club))}"><span class="fs-dist-n">P</span><span class="nm"><b>Porta ${esc(nomeSq(club))}</b><span>${esc(porta.voci.slice(2).map((v) => v.etichetta).join(' · ') || 'tutti i portieri')}</span></span><span class="ev"></span>${voto(porta)}</a>
      ${ids.map((id) => { const g = F.giocatore(id); if (!g) return ''; return `<a class="vr fs-dist${id === evid ? ' fs-evid' : ''}" href="${profilo(id)}"><span class="fs-dist-n">${esc(g.numero ?? '')}</span><span class="nm"><b>${esc(g.cognome)} ${esc(g.nome)}</b><span>${esc(g.ruoloFsgc)}</span></span><span class="ev">${segni(id)}</span>${g.ruolo === 'P' ? '<span class="fv sv">–</span>' : voto(voti.giocatori.get(id))}</a>`; }).join('')}`;
  };
  return `${lato(p.casa, 0)}<div class="fs-div"></div>${lato(p.ospite, 1)}`;
}
/** La partita in un foglio, con le due distinte: dal profilo di un giocatore. */
function apriPartita(n, casa, evid, ctx) {
  const p = F.PARTITE.find((x) => x.g === n && x.casa === casa);
  if (!p) return;
  const dentro = evid && F.referto(n, casa)?.distinte.some((d) => d.includes(evid));
  ctx.sheet(`<h3>${n}ª giornata · ${esc(nomeSq(p.casa))} ${p.gc ?? ''}–${p.go ?? ''} ${esc(nomeSq(p.ospite))}</h3>
    <p class="sheet-sub">${p.quando ? `${dateIt(p.quando)} alle ${timeIt(p.quando)} · ` : ''}le distinte del referto FSGC.${evid && !dentro ? ` <b>${esc(nomeId(evid))} non è in nessuna delle due: non era convocato.</b>` : ''}</p>
    <div class="fs-list fs-distinte">${distinte(n, casa, evid)}</div>`);
}

export const futsalGiornata = {
  title: 'Calendario futsal', appbar: 'futsal', sub: (ctx) => `Calendario · ${ctx.params.n || F.giocate().at(-1) || 1}ª giornata`,
  render(ctx) {
    const giocate = F.giocate();
    const n = Number(ctx.params.n) || giocate.at(-1) || 1;
    const partite = F.PARTITE.filter((p) => p.g === n);
    const tutte = [...new Set(F.PARTITE.map((p) => p.g))].sort((a, b) => a - b);
    return `<main class="a-body fs">
      <div class="chips fs-gchips">${tutte.map((g) => `<a class="chip${g === n ? ' on' : ''}${giocate.includes(g) ? '' : ' futura'}" href="#/futsal/giornata/${g}">${g}ª</a>`).join('')}</div>
      <div class="a-card fs-spiega"><b>Come nasce il voto</b><p class="small muted">${fmt(R.voto, 0)} a ogni convocato (anche se non entra in campo), +0,5 se la squadra vince e −0,5 se perde, poi gol, autogol e cartellini. La Porta perde 0,5 per ogni gol subito, +3 se resta inviolata. <b>Tocca una partita</b> per le due distinte complete, con numeri, eventi e voti; tocca un giocatore per il suo profilo.</p></div>
      ${partite.map((p) => {
    const ref = F.referto(n, p.casa);
    if (!ref) return `<div class="a-card fs-list"><div class="fs-match">${stemma(p.casa)}<b>${esc(nomeSq(p.casa))}</b><span class="fs-ora">${p.quando ? timeIt(p.quando) : '–'}<small>${p.quando ? dateIt(p.quando) : 'da fissare'}</small></span><b class="r">${esc(nomeSq(p.ospite))}</b>${stemma(p.ospite)}</div></div>`;
    return `<details class="a-card fs-list fs-partita"><summary>${stemma(p.casa)}<b>${esc(nomeSq(p.casa))}</b><span class="fs-ris">${p.gc} – ${p.go}</span><b class="r">${esc(nomeSq(p.ospite))}</b>${stemma(p.ospite)}</summary>
          ${distinte(n, p.casa)}</details>`;
  }).join('')}
      <p class="small muted" style="text-align:center">Riposa: ${esc(F.riposa(n).map(nomeSq).join(', '))}${F.conclusa(n) ? ' · chi riposa prende la sua media' : ''}</p>
    </main>`;
  },
};

// ---------------------------------------------------------------- regolamento (a capitoli, come i docs di Dunkest)
const mini = (k) => { const s = R.schemi[k]; const fila = (r, q) => `<div>${Array.from({ length: q }, () => `<i class="${r}"></i>`).join('')}</div>`; return `<div class="fs-mini"><div class="fs-mini-c">${fila('a', s.A)}${fila('d', s.D)}${fila('p', 1)}</div><b>${k}</b><small>${s.D} D · ${s.A} A${k === R.bonusDifesa.schema ? ' · bonus difesa' : ''}</small></div>`; };
export const futsalRegolamento = {
  title: 'Regolamento futsal', appbar: 'futsal', sub: () => 'Regolamento',
  render() {
    const row = (k, v) => `<tr><td>${k}</td><td class="num" style="text-align:right">${v}</td></tr>`;
    const s = (x) => (x > 0 ? `+${fmt(x)}` : fmt(x));
    const cap = (titolo, corpo, aperto = false) => `<details class="a-card fs-cap-r"${aperto ? ' open' : ''}><summary>${titolo}</summary><div>${corpo}</div></details>`;
    return `<main class="a-body rules fs">
      <div class="fs-benvenuto">${logoFs('grande')}<p>Regolamento 2026/27</p></div>
      <div class="a-card"><p class="rule-art">IN BREVE</p>
        <p>Il FantaFutsal è il fanta del <b>Campionato Sammarinese di Futsal</b>: compri una rosa di giocatori veri con i crediti, ogni giornata scegli chi va in campo e fai punti con quello che dicono i <b>referti ufficiali FSGC</b>.</p>
        <p>È costruito come Dunkest, il fantabasket più giocato: quotazioni che salgono e scendono, mercato tra una giornata e l'altra, sesto uomo e panchina che contano, campionati principali per tutti e leghe con gli amici.</p></div>
      ${cap('1 · Creazione della squadra', `<p>Con un account (lo stesso del calcio) hai una squadra. Hai <b>${R.budget} crediti</b> per comprare:</p>
        <table>${row('1 Porta', 'la porta di una squadra')}${row('4 Difensori', 'Centrali e Laterali')}${row('4 Attaccanti', 'Pivot e Universali')}</table>
        <p>Al massimo <b>${R.perClub} della stessa squadra</b>, Porta compresa.</p>
        <p><b>Perché la Porta e non il portiere.</b> Ogni squadra porta due o tre portieri e il referto non dice chi ha giocato: compri la porta di una squadra, che prende i gol subiti e gli eventi di tutti i suoi portieri. Fa la parte del «coach» di Dunkest.</p>`, true)}
      ${cap('2 · Schemi', `<p>Ogni giornata vanno in campo la Porta e quattro giocatori, secondo uno schema:</p><div class="fs-minis">${Object.keys(R.schemi).map(mini).join('')}</div>
        <p>Con il <b>${R.bonusDifesa.schema}</b>, se Porta e tre difensori fanno in media almeno ${fmt(R.bonusDifesa.soglia)}, la squadra prende <b>${s(R.bonusDifesa.punti)}</b>.</p>`)}
      ${cap('3 · Gestione della squadra', `<p>Dei quattro rimasti fuori, uno è il <b>sesto uomo</b> e conta al 100%; gli altri tre stanno in <b>panchina e contano al ${fmt(R.panchina * 100, 0)}%</b>.</p>
        <table>${row('In campo e Porta', '100%')}${row('Sesto uomo', '100%')}${row('Panchina', `${fmt(R.panchina * 100, 0)}%`)}${row('Capitano', `×${fmt(R.capitano)}`)}</table>
        <p><b>Capitano e vice</b> si scelgono fra i quattro in campo: il capitano moltiplica per ${fmt(R.capitano)} i suoi punti. Se non è convocato la fascia passa al vice.</p>
        <p><b>Cambio automatico.</b> Se uno in campo non è convocato, entra al 100% il primo della panchina del suo ruolo che ha giocato (il sesto uomo conta già per intero). Dunkest i cambi li fa fare a mano fra un turno e l'altro; qui la giornata si chiude tutta insieme, quindi li fa l'app.</p>
        <p>La squadra si cambia fino a <b>10 minuti prima della prima partita</b> della giornata. <b>Resta da una giornata all'altra</b>: se non tocchi niente gioca quella di prima.</p>`)}
      ${cap('4 · Punteggio dei giocatori', `<table><tr><th>Evento</th><th></th></tr>${row('Convocato (in distinta)', fmt(R.voto))}${row('La sua squadra vince / perde', `${s(R.esito.vittoria)} / ${fmt(R.esito.sconfitta)}`)}${row('Gol (anche su rigore)', s(R.gol))}${row('Autogol', fmt(R.autogol))}${row('Ammonizione', fmt(R.ammonizione))}${row('Espulsione', fmt(R.espulsione))}${row('Rigore sbagliato', fmt(R.rigoreSbagliato))}</table>
        <p><b>Convocato</b> vuol dire nell'elenco della partita sul referto. La FSGC non registra chi entra in campo né i cambi, quindi il voto lo prende ogni convocato. Assist e rigori parati non contano: il referto non li riporta.</p>`)}
      ${cap('5 · Punteggio della Porta', `<table>${row('Voto', fmt(R.voto))}${row('La squadra vince / perde', `${s(R.esito.vittoria)} / ${fmt(R.esito.sconfitta)}`)}${row('Ogni gol subito', fmt(R.golSubito))}${row('Nessun gol subito', s(R.portaInviolata))}${row('Eventi dei suoi portieri', 'come i giocatori')}</table>`)}
      ${cap('6 · Mercato', `<p>Il mercato è <b>aperto tra una giornata e l'altra</b>: apre quando arrivano i referti dell'ultima giornata (di solito il giorno dopo) e chiude 10 minuti prima della prima partita della successiva. Mentre aspetta i referti puoi cambiare schema, titolari e capitano, ma non comprare o vendere.</p>
        <table>${row('Prima rosa', 'cambi illimitati e gratis')}${row('Cambi gratis a giornata', R.cambiGratis)}${row('Ogni cambio in più', `−${R.malusCambio} punto`)}</table>
        <p>Un cambio è un giocatore (o una Porta) che entra in rosa rispetto alla giornata prima.</p>`)}
      ${cap('7 · Quotazioni e plusvalenze', `<p>Ogni giocatore ha un valore in crediti. Quello di partenza viene dalle prime ${V.VALORI.base} giornate: media punti e presenze. Da lì <b>cambia dopo ogni giornata</b>:</p>
        <ul><li>sale se fa più punti di quanti ne promette il suo prezzo, scende se ne fa meno;</li><li>a parità di punti guadagna di più chi costa meno;</li><li>al massimo ${fmt(V.VALORI.variazioneMax)} crediti a giornata, fra ${V.VALORI.min} e ${V.VALORI.max};</li><li>chi non è convocato fa 0 e scende, chi riposa resta fermo.</li></ul>
        <p>Le plusvalenze e minusvalenze dei giocatori che hai in rosa <b>si sommano ai tuoi crediti</b>: comprare bene prima che salgano ti dà spazio per comprare meglio.</p>`)}
      ${cap('8 · Riposo e partite rinviate', `<p>Ogni giornata una squadra riposa. I suoi giocatori e la sua Porta prendono la <b>loro media</b> delle giornate giocate, senza fascia da capitano e senza variazione di quotazione. Lo stesso per una partita rinviata o senza referto dopo tre giorni.</p>`)}
      ${cap('9 · Campionati', `<p>Con la stessa squadra giochi in tutti, senza fare niente:</p>
        <table>${row('Generale', 'somma dei punti di tutte le giornate')}${row('Tifosi', 'chi ha la stessa squadra del cuore')}${SERIE.map((x) => row(x.nome, `giornate ${x.da}–${x.a}`)).join('')}${row('Coppa Titano', `gironi e tabellone, ${COPPA.preliminari[0]}ª–${COPPA.finale}ª`)}</table>
        <p>Le <b>Serie</b> sono come le Champions Series di Dunkest: ognuna ha la sua classifica, che riparte da zero. A parità conta la media per giornata, poi la giornata migliore.</p>
        <p><b>Coppa Titano.</b> Il sorteggio si fa alla chiusura della ${COPPA.preliminari[0]}ª: entra chi ha una squadra, servono almeno 8 iscritti. Gironi con 3 punti a vittoria, poi eliminazione diretta con andata e ritorno e finale secca. Con 50 o più iscritti ci sono anche i preliminari.</p>
        <p><b>Leghe con gli amici.</b> Una lega è un gruppo con la sua classifica: <b>a somma</b> o <b>testa a testa</b> (ogni giornata contro un altro del gruppo, 3 punti a chi fa di più). Con un numero dispari, chi resta fuori affronta la media del gruppo, come la «Dunkest Team».</p>`)}
      ${cap('10 · Arrivare a stagione iniziata', `<p>Ci si iscrive quando si vuole: si parte con ${R.budget} crediti e alle quotazioni del momento. Le giornate già giocate valgono 0 punti in classifica generale, ma le Serie e le leghe nuove ripartono da zero.</p>`)}
    </main>`;
  },
};

// ---------------------------------------------------------------- classifiche
const squadraDi = (id) => FS.iscritto(id) || { squadra: '—', colore: '#5B6B7C', iniziali: '?' };
const rigaSquadra = (id, destra, sotto = '') => { const s = squadraDi(id); return `<div class="vr${id === FS.io()?.user_id ? ' fs-mia' : ''}">${crest({ color: s.colore, initials: s.iniziali }, 'fs-crest')}<span class="nm"><b>${esc(s.squadra)}</b>${sotto ? `<span>${sotto}</span>` : ''}</span><span class="ev"></span>${destra}</div>`; };
const nonAttivo = () => `<main class="a-body fs">${empty('Il server del FantaFutsal non è ancora attivo: classifiche, coppa e leghe partono quando lo sarà.')}</main>`;

let classTot = true, classG = null, classQ = '';
export const futsalClassifica = {
  title: 'Classifiche futsal', appbar: 'futsal', sub: (ctx) => { const v = ctx.params.vista || 'generale'; return SERIE.find((x) => x.id === v)?.nome || (v.startsWith('tifosi-') ? `Tifosi ${nomeSq(v.slice(7))}` : 'Classifica generale'); },
  render(ctx) {
    const srv = FS.stato();
    if (!srv.caricato) return `<main class="a-body fs">${caricaFs('Carico la classifica…')}</main>`;
    if (!srv.attivo) return nonAttivo();
    const vista = ctx.params.vista || 'generale';
    const serie = SERIE.find((x) => x.id === vista);
    const giocate = F.giocate();
    let ids = srv.iscritti.map((x) => x.user_id);
    if (vista.startsWith('tifosi-')) ids = srv.iscritti.filter((x) => x.club_cuore === vista.slice(7)).map((x) => x.user_id);
    const blocco = serie ? giornateSerie(serie).filter((g) => giocate.includes(g)) : giocate;
    classG = blocco.includes(classG) ? classG : blocco.at(-1) ?? null;
    const righe = classificaSomma(ids, classTot || classG == null ? blocco : [classG], FS.punti);
    const mia = righe.find((r) => r.id === FS.io()?.user_id);
    const q = classQ.toLowerCase();
    const viste = [['generale', 'Generale'], ...SERIE.map((x) => [x.id, x.nome.replace('Serie ', '')]), ...(FS.io()?.club_cuore ? [[`tifosi-${FS.io().club_cuore}`, 'Tifosi']] : [])];
    return `<main class="a-body fs">
      <div class="chips">${viste.map(([k, l]) => `<a class="chip${k === vista ? ' on' : ''}" href="#/futsal/classifica/${k}">${l}</a>`).join('')}</div>
      <div class="a-card fs-posto"><span><small>Posizione</small><b>${mia ? `${mia.posto}/${righe.length}` : `–/${righe.length}`}</b></span><span><small>${classTot ? 'Punti totali' : `Punti ${classG}ª`}</small><b>${mia ? fmt(mia.totale) : '–'}</b></span></div>
      ${serie && !blocco.length ? `<p class="small muted fs-nota">La ${serie.nome} si gioca dalla ${serie.da}ª alla ${serie.a}ª giornata: la classifica parte con la ${serie.da}ª.</p>` : ''}
      <div class="seg seg-cls"><button data-tot="1" class="${classTot ? 'on' : ''}">Totale</button><button data-tot="0" class="${classTot ? '' : 'on'}">Giornata</button></div>
      ${classTot ? '' : `<select id="fs-cg" class="select">${blocco.map((g) => `<option value="${g}" ${g === classG ? 'selected' : ''}>${g}ª giornata</option>`).join('')}</select>`}
      <input class="field-input" id="fs-cq" placeholder="Cerca una squadra" value="${esc(classQ)}" autocomplete="off" style="margin-top:8px">
      <div class="a-card fs-list fs-classifica">${righe.filter((r) => !q || squadraDi(r.id).squadra.toLowerCase().includes(q)).map((r) => `<div class="vr${r.id === FS.io()?.user_id ? ' fs-mia' : ''}"><span class="fs-pos">${r.posto}</span>${crest({ color: squadraDi(r.id).colore, initials: squadraDi(r.id).iniziali }, 'fs-crest')}<span class="nm"><b>${esc(squadraDi(r.id).squadra)}</b><span>${squadraDi(r.id).club_cuore ? `tifa ${esc(nomeSq(squadraDi(r.id).club_cuore))} · ` : ''}media ${fmt(r.media)}</span></span><span class="fv">${fmt(r.totale)}</span></div>`).join('') || '<p class="small muted" style="padding:12px">Nessuna squadra.</p>'}</div>
    </main>`;
  },
  mount(root, ctx) {
    caricaE(ctx);
    root.querySelector('main').addEventListener('click', (e) => { const t = e.target.closest('[data-tot]'); if (t) { classTot = t.dataset.tot === '1'; ctx.render(); } });
    root.querySelector('#fs-cg')?.addEventListener('change', (e) => { classG = Number(e.target.value); ctx.render(); });
    const q = root.querySelector('#fs-cq'); if (q) q.onchange = () => { classQ = q.value.trim(); ctx.render(); };
  },
};

// ---------------------------------------------------------------- coppa
const sfidaHtml = (s) => `<div class="fs-sfida"><span>${esc(squadraDi(s.a).squadra)}</span><b>${s.pa == null ? '–' : fmt(s.pa)}</b><i>–</i><b>${s.pb == null ? '–' : fmt(s.pb)}</b><span class="r">${s.b ? esc(squadraDi(s.b).squadra) : s.media ? 'media del girone' : 'riposa'}</span></div>`;
const tabellaGirone = (g) => `<div class="a-card fs-list">${g.classifica.map((r) => rigaSquadra(r.id, `<span class="fv">${r.punti}</span>`, `${r.vinte}V ${r.pari}N ${r.perse}P · ${fmt(r.fatti)} fatti`)).join('')}</div>`;

export const futsalCoppa = {
  title: 'Coppa futsal', appbar: 'futsal', sub: () => 'Coppa Titano',
  render() {
    const srv = FS.stato();
    if (!srv.caricato) return `<main class="a-body fs">${caricaFs('Carico la coppa…')}</main>`;
    if (!srv.attivo) return nonAttivo();
    const inizio = F.chiusura(COPPA.preliminari[0]);
    const prima = !inizio || inizio.getTime() > Date.now();
    const ammessi = srv.iscritti.filter((x) => !inizio || new Date(x.created_at) <= inizio).map((x) => x.user_id);
    const formato = formatoCoppa(ammessi.length);
    const descr = { completo: 'preliminari in due gironi, poi 8 gironi da quattro e gli ottavi', medio: 'preliminari in due gironi, poi 4 gironi da quattro e i quarti', ridotto: 'gironi da quattro (o cinque), poi il tabellone' };
    if (prima) {
      return `<main class="a-body fs">
        <div class="a-card fs-hero"><span class="chip">Coppa Titano · si parte con la ${COPPA.preliminari[0]}ª</span>
          <h3>${formato ? `Con ${ammessi.length} iscritti: ${descr[formato.nome]}` : `Servono almeno 8 iscritti: ora sono ${ammessi.length}`}</h3>
          <p class="small muted">Il sorteggio si fa alla chiusura della ${COPPA.preliminari[0]}ª giornata${inizio ? ` (${quando(inizio)})` : ''}: partecipa chi è iscritto in quel momento. Nessuna squadra in più: conta quella della giornata. Finale alla ${COPPA.finale}ª.</p></div>
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
  mount(root, ctx) { caricaE(ctx); },
};

// ---------------------------------------------------------------- leghe con gli amici
export const futsalLeghe = {
  title: 'Leghe futsal', appbar: 'futsal', sub: () => 'Campionati con gli amici',
  render() {
    const srv = FS.stato();
    if (!srv.caricato) return `<main class="a-body fs">${caricaFs('Carico le leghe…')}</main>`;
    if (!srv.attivo) return nonAttivo();
    if (!FS.io()) return `<main class="a-body fs">${iscrizione('Per creare o entrare in una lega, crea la tua squadra')}<p class="small muted fs-nota">Una lega è un gruppo di amici con la sua classifica, con la stessa squadra della classifica generale.</p></main>`;
    return `<main class="a-body fs">
      ${srv.leghe.length ? `${sec('I miei campionati')}<div class="a-card fs-list">${srv.leghe.map((l) => `<a class="vr" href="#/futsal/lega/${l.id}">${icon(l.tipo === 'testa' ? 'users' : 'cup')}<span class="nm"><b>${esc(l.nome)}</b><span>${l.tipo === 'testa' ? 'testa a testa' : 'a somma di punti'} · ${FS.membriDi(l.id).length} squadre</span></span><span class="ev"></span>${icon('chev', 'ic sm')}</a>`).join('')}</div>` : ''}
      ${sec('Crea un campionato')}
      <div class="a-card fs-form"><input class="field-input" id="fs-lnome" placeholder="Nome del campionato" maxlength="40" autocomplete="off">
        <div class="seg seg-cls" id="fs-ltipo"><button data-tipo="somma" class="on">Classifica a somma</button><button data-tipo="testa">Testa a testa</button></div>
        <p class="small muted">A somma: vince chi fa più punti. Testa a testa: ogni giornata contro un altro del gruppo, 3 punti a chi fa di più. Il calendario si fissa quando lo avvii, e da lì non entra più nessuno.</p>
        <button class="a-btn" id="fs-crea">Crea</button></div>
      ${sec('Unisciti con un codice')}
      <div class="a-card fs-form"><input class="field-input" id="fs-codice" placeholder="Codice (es. F3A9C1)" maxlength="8" autocomplete="off" style="text-transform:uppercase"><button class="a-btn sec" id="fs-entra">Unisciti</button></div>
    </main>`;
  },
  mount(root, ctx) {
    caricaE(ctx);
    montaIscrizione(root, ctx);
    let tipo = 'somma';
    root.querySelector('#fs-ltipo')?.addEventListener('click', (e) => { const b = e.target.closest('[data-tipo]'); if (!b) return; tipo = b.dataset.tipo; root.querySelectorAll('#fs-ltipo button').forEach((x) => x.classList.toggle('on', x === b)); });
    root.querySelector('#fs-crea')?.addEventListener('click', async () => {
      const nome = root.querySelector('#fs-lnome').value.trim(); if (nome.length < 2) { ctx.toast('Scrivi il nome del campionato'); return; }
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
    if (!srv.caricato) return `<main class="a-body fs">${caricaFs('Carico la lega…')}</main>`;
    const l = srv.leghe.find((x) => x.id === ctx.params.id);
    if (!l) return `<main class="a-body fs">${empty('Lega non trovata.', '<a class="a-btn" href="#/futsal/leghe" style="text-decoration:none">I tuoi campionati</a>')}</main>`;
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
      const { classifica, partite } = classificaScontri(l.membri_avvio, turni, FS.punti, { mediaAlRiposo: true });
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
    caricaE(ctx);
    root.querySelector('#fs-avvia')?.addEventListener('click', async () => { try { const g = await FS.avviaLega(ctx.params.id); ctx.toast(`Si parte dalla ${g}ª giornata`); ctx.render(); } catch (err) { ctx.toast(err.message); } });
    root.querySelector('#fs-esci')?.addEventListener('click', async () => { if (!confirm('Esci dalla lega?')) return; try { await FS.esciLega(ctx.params.id); ctx.go('futsal/leghe'); } catch (err) { ctx.toast(err.message); } });
  },
};

