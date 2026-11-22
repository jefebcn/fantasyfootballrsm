/**
 * LA PAGINA DELLA COPPA FANTATITANO (#/coppa). Le regole in src/coppa-fanta.js.
 *
 * Come la Coppa Titano del futsal: in cima «La tua coppa» (dove sei, prossima
 * sfida, se sei fuori e dove), il tuo girone per primo con la tua squadra
 * evidenziata e la linea «passano i primi N», le classifiche lunghe ridotte con
 * «Mostra tutte», le sfide del turno con ✓ su chi vince, il tabellone con
 * andata e ritorno separati, il campione col risultato della finale.
 * Sopra, finché il turno è aperto, la formazione di coppa.
 *
 * Tutto si disegna da un «modello» (modello()), così la simulazione con tanti
 * iscritti (prove/coppa-simula.html) passa dalle stesse funzioni.
 */
import * as S from '../state.js';
import * as CS from '../coppa-server.js';
import { esc, fmt, icon, crest, sec, empty, dateIt, timeIt, roleChip } from '../ui.js';
import { COPPA_CALENDARIO, COPPA_REFERTI } from '../coppa-dati.js';
import {
  NOME, TURNI, turno, squadreInGara, chiusuraTurno, turnoConcluso, votiDelTurno, punteggio,
  coppaFantatitano, dovesei, validaFormazione, partiteDelTurno, formato,
} from '../coppa-fanta.js';

// ---------------------------------------------------------------- fonti (vere o simulate)
let finto = null;   // { calendario, referti, ora, io, giocatori } per la simulazione
/** Solo per prove e simulazione. */
export function simulaDati(d) { finto = d; }
const cal = () => finto?.calendario || COPPA_CALENDARIO;
const ref = () => finto?.referti || COPPA_REFERTI;
const ora = () => finto?.ora ?? Date.now();
const io = () => (finto ? finto.io : CS.uid());
const giocatore = (id) => (finto?.giocatori ? finto.giocatori.get(id) : S.playersById.get(id));
const club = (id) => S.clubsById.get(id);
const nomeClub = (id) => club(id)?.name || id;
const quando = (d) => `${dateIt(d)} alle ${timeIt(d)}`;

// ---------------------------------------------------------------- il modello
export function modello() {
  const st = CS.stato();
  const ids = CS.iscritti();
  const voti = new Map();
  const votiDi = (n) => {
    if (!voti.has(n)) voti.set(n, votiDelTurno({ calendario: cal(), referti: ref(), giocatore, n }));
    return voti.get(n);
  };
  const conclusi = new Set(TURNI.filter((t) => turnoConcluso(cal(), ref(), t.n)).map((t) => t.n));
  const punti = (n, id) => {
    if (!conclusi.has(n)) return null;
    const f = CS.formazione(n, id);
    return f ? punteggio(f, votiDi(n)).totale : 0;
  };
  const primo = chiusuraTurno(cal(), 1);
  const sorteggiato = primo && primo.getTime() <= ora();
  const c = sorteggiato ? coppaFantatitano(ids, punti) : null;
  const aperto = TURNI.find((t) => { const x = chiusuraTurno(cal(), t.n); return x && x.getTime() > ora(); }) || null;
  return { st, ids, c, punti, conclusi, aperto, sorteggiato, primo, dove: c ? dovesei(c, io()) : null, votiDi };
}

// ---------------------------------------------------------------- pezzi
const sq = (id) => CS.squadra(id);
const stemma = (id) => crest({ color: sq(id).colore, initials: sq(id).iniziali }, 'fs-crest');
const nomeSq = (id) => esc(sq(id).squadra);
const mia = (id) => (id === io() ? ' fs-mia' : '');

function rigaClassifica(r, passa) {
  return `<div class="vr${mia(r.id)}${passa ? ' cf-passa' : ''}"><span class="fs-pos">${r.posto}</span>${stemma(r.id)}<span class="nm"><b>${nomeSq(r.id)}</b><span>${r.vinte}V ${r.pari}N ${r.perse}P · ${fmt(r.fatti)} fatti, ${fmt(r.subiti)} subiti</span></span><span class="fv">${r.punti}</span></div>`;
}
const aperti = new Set();   // gironi con «Mostra tutte» aperto
function tabellaGirone(g, passano) {
  const tutte = aperti.has(g.nome);
  const corta = 8;
  const mio = g.classifica.findIndex((r) => r.id === io());
  const righe = [];
  g.classifica.forEach((r, i) => {
    if (!tutte && i >= corta && i !== mio) return;
    if (!tutte && i === mio && mio > corta) righe.push('<div class="cf-salto">…</div>');
    righe.push(rigaClassifica(r, i < passano));
    if (i === passano - 1 && g.classifica.length > passano) righe.push(`<div class="cf-linea"><span>passano i primi ${passano}</span></div>`);
  });
  const altre = g.classifica.length > corta + 1 && !tutte
    ? `<button class="cf-tutte" data-tutte="${esc(g.nome)}">Mostra tutte le ${g.classifica.length} squadre</button>` : '';
  return `<div class="a-card fs-list cf-cls">${righe.join('')}${altre}</div>`;
}
function sfida(a, b, pa, pb, { vincente = null, media = false } = {}) {
  // il segno davanti al nome: dietro, coi nomi lunghi, lo taglierebbero i puntini
  const v = (x) => (vincente && vincente === x ? '<i class="cf-ok">✓</i> ' : '');
  const lato = (x) => (x ? `${v(x)}${nomeSq(x)}` : media ? 'media del girone' : 'riposa');
  return `<div class="fs-sfida${a === io() || b === io() ? ' fs-mia' : ''}"><span>${lato(a)}</span><b>${pa == null ? '–' : fmt(pa)}</b><i>–</i><b>${pb == null ? '–' : fmt(pb)}</b><span class="r">${lato(b)}</span></div>`;
}
const vincitore = (s) => (s.pa == null || s.pb == null || !s.b ? null : s.pa > s.pb ? s.a : s.pb > s.pa ? s.b : null);

function sfideGirone(g, m) {
  // l'ultimo turno giocato (con ✓ su chi ha vinto) e il prossimo da giocare
  const ultimo = [...g.partite].reverse().find((p) => m.conclusi.has(p.giornata));
  const prossimo = g.partite.find((p) => !m.conclusi.has(p.giornata));
  return [ultimo, prossimo].filter(Boolean).map((p) => {
    const t = turno(p.giornata);
    const chiave = `sfide-${g.nome}-${p.giornata}`;
    const tutte = aperti.has(chiave);
    const mie = p.sfide.filter((s) => s.a === io() || s.b === io());
    const mostra = tutte ? p.sfide : mie.length ? mie : p.sfide.slice(0, 4);
    return `${sec(`${t.nome} · girone ${esc(g.nome)}`, m.conclusi.has(p.giornata) ? 'finito' : dateIt(chiusuraTurno(cal(), p.giornata) || new Date()))}
    <div class="a-card fs-list">${mostra.map((s) => sfida(s.a, s.b, s.pa, s.pb, { vincente: vincitore(s), media: s.media })).join('')}
    ${p.sfide.length > mostra.length ? `<button class="cf-tutte" data-tutte="${esc(chiave)}">Mostra tutte le ${p.sfide.length} sfide</button>` : ''}</div>`;
  }).join('');
}

function tabellone(c) {
  return c.tabellone.map((t) => `${sec(t.nome, t.turni.map((n) => turno(n).nome.replace(t.nome === 'Finale' ? 'Finale' : /Semifinali di /, '')).join(' e '))}
    <div class="a-card fs-list">${t.sfide.map((s) => {
      const tot = (i) => (s.gare.every((x) => x[i] != null) ? s.gare.reduce((y, x) => y + x[i], 0) : null);
      const gare = s.gare.length > 1 ? `<div class="cf-gare">${s.gare.map((x, i) => `<span>${i ? 'Ritorno' : 'Andata'} <b>${x[0] == null ? '–' : fmt(x[0])}</b> – <b>${x[1] == null ? '–' : fmt(x[1])}</b></span>`).join('')}</div>` : '';
      return `${sfida(s.a, s.b, tot(0), tot(1), { vincente: s.vincente })}${gare}`;
    }).join('')}</div>`).join('');
}

/** «All'andata 23,5 – 21,0. » dal tuo lato, se l'andata è giocata. */
function andata(d) {
  const g = d?.sfida?.gare?.[0];
  if (!g || g[0] == null || g[1] == null) return '';
  const [mio, suo] = d.sfida.a === io() ? g : [g[1], g[0]];
  return `All'andata ${fmt(mio)} – ${fmt(suo)}. `;
}
function laTuaCoppa(m) {
  const d = m.dove, c = m.c;
  const iscritto = !!CS.formazione(1, io());
  if (!m.sorteggiato) {
    const n = m.st.contati || 0;
    return `<div class="a-card fs-hero cf-hero"><span class="chip">${icon('coppa', 'ic sm')} La tua coppa</span>
      <h3>${iscritto ? 'Sei iscritto alla coppa' : 'Entra nella coppa con la formazione dei quarti'}</h3>
      <p class="small muted">${iscritto ? 'Puoi cambiare la formazione fino alla chiusura.' : 'Basta schierare la formazione qui sotto: è gratis e non tocca la rosa della tua lega.'} Il sorteggio dei gironi si fa alla chiusura, ${m.primo ? quando(m.primo) : 'al primo turno'}${n ? `: per ora ${n === 1 ? 'c\'è 1 iscritto' : `ci sono ${n} iscritti`}` : ''}.</p></div>`;
  }
  if (!c?.formato) return '';
  const riga = d?.riga;
  const prossima = () => {
    if (!d?.girone) return '';
    const p = d.girone.partite.find((x) => !m.conclusi.has(x.giornata));
    const s = p?.sfide.find((x) => x.a === io() || x.b === io());
    if (!s) return '';
    const avv = s.a === io() ? s.b : s.a;
    return `<p class="cf-prossima">Prossima sfida · <b>${turno(p.giornata).nome}</b>: contro ${avv ? `<b>${nomeSq(avv)}</b>` : 'la media del girone'}</p>`;
  };
  const testi = {
    'non iscritto': ['Non sei in coppa', 'Alla coppa si entrava con la formazione dei quarti di andata. Ci vediamo alla prossima edizione.'],
    gironi: [`Girone ${esc(d?.girone?.nome || '')} · ${riga ? `${riga.posto}° posto su ${d.girone.classifica.length}` : ''}`, `${riga ? `${riga.punti} punti, ${fmt(riga.fatti)} fantapunti fatti. ` : ''}Passano in semifinale i primi ${c.formato.passano}${c.formato.gironi === 2 ? ' di ogni girone' : ''}.`],
    semifinale: [`Sei in semifinale contro ${d?.avversario ? nomeSq(d.avversario) : ''}`, `${andata(d)}Andata e ritorno sulle semifinali vere: conta la somma dei fantapunti.`],
    finale: [`Sei in finale contro ${d?.avversario ? nomeSq(d.avversario) : ''}`, 'Gara secca sulla finale vera della Coppa Titano.'],
    campione: ['Hai vinto la Coppa Fantatitano', c.finale ? `Finale ${fmt(c.finale.gare[0][0])} – ${fmt(c.finale.gare[0][1])}` : ''],
    fuori: [`Sei fuori: ${esc(d?.dove || '')}`, d?.avversario ? `Ti ha eliminato ${nomeSq(d.avversario)}.` : riga ? `Hai chiuso ${riga.posto}° con ${riga.punti} punti.` : ''],
  }[d?.stato] || ['', ''];
  return `<div class="a-card fs-hero cf-hero"><span class="chip">${icon('coppa', 'ic sm')} La tua coppa</span><h3>${testi[0]}</h3><p class="small muted">${testi[1]}</p>${d?.stato === 'gironi' ? prossima() : ''}</div>`;
}

function campione(c) {
  if (!c?.campione || c.campione === io()) return '';
  const f = c.finale; const [pa, pb] = f.gare[0];
  const altro = f.a === c.campione ? f.b : f.a;
  const [mio, suo] = f.a === c.campione ? [pa, pb] : [pb, pa];
  return `<div class="a-card fs-hero cf-campione">${crest({ color: sq(c.campione).colore, initials: sq(c.campione).iniziali }, 'cf-crest-big')}<span class="chip">Campione · ${NOME}</span><h3>${nomeSq(c.campione)}</h3><p class="small muted">Finale ${fmt(mio)} – ${fmt(suo)} contro ${nomeSq(altro)}</p></div>`;
}

// ---------------------------------------------------------------- la formazione di coppa
let bozza = null;   // { n, titolari: [5], riserva, capitano, squadra }
const SLOT = [['P', 'Portiere'], ['D', 'Difensore'], ['C', 'Centrocampista'], ['A', 'Attaccante'], ['*', 'Quinto titolare'], ['R', 'Riserva']];
function giocatoriInGara(n) {
  const sqd = squadreInGara(cal(), n);
  const tutti = finto?.giocatori ? [...finto.giocatori.entries()].map(([id, g]) => ({ id, ...g })) : S.base.players;
  return tutti.filter((p) => sqd.includes(p.clubId) && !p.doppioneDi && p.isActive !== false)
    .sort((a, b) => (sqd.indexOf(a.clubId) - sqd.indexOf(b.clubId)) || 'PDCA'.indexOf(a.role) - 'PDCA'.indexOf(b.role) || (a.lastName || '').localeCompare(b.lastName || ''));
}
function bozzaDi(n) {
  if (bozza?.n === n) return bozza;
  const f = CS.formazione(n, io()) || (n > 1 ? CS.formazione(n - 1, io()) : null);
  const me = S.me?.();
  // la formazione del turno, o quella del turno prima se vale ancora (i quarti di ritorno hanno le stesse squadre)
  const usa = f && (CS.formazione(n, io()) || !validaFormazione(f, n, giocatore, squadreInGara(cal(), n)));
  bozza = { n, titolari: usa ? [...f.titolari] : [null, null, null, null, null], riserva: usa ? f.riserva : null,
    capitano: usa ? f.capitano : null, squadra: f?.squadra || me?.teamName || '' };
  return bozza;
}
function formazioneHtml(m) {
  const t = m.aperto; if (!t) return '';
  const iscritto = !!CS.formazione(1, io());
  const inGara = t.n === 1 || (t.n === 2 && iscritto) || (m.c && ['semifinale', 'finale'].includes(m.dove?.stato));
  if (!inGara) return '';
  const sqd = squadreInGara(cal(), t.n);
  const chiude = chiusuraTurno(cal(), t.n);
  const b = bozzaDi(t.n);
  const tutti = giocatoriInGara(t.n);
  const scelti = [...b.titolari, b.riserva];
  const opzioni = (k, scelto) => {
    const ruolo = SLOT[k][0];
    const ok = tutti.filter((p) => (ruolo === 'R' ? true : ruolo === '*' ? p.role !== 'P' : p.role === ruolo));
    return sqd.map((cid) => {
      const lista = ok.filter((p) => p.clubId === cid);
      if (!lista.length) return '';
      return `<optgroup label="${esc(nomeClub(cid))}">${lista.map((p) => `<option value="${esc(p.id)}" ${p.id === scelto ? 'selected' : ''} ${p.id !== scelto && scelti.includes(p.id) ? 'disabled' : ''}>${esc(p.lastName)} ${esc((p.firstName || '')[0] || '')}. · ${p.role}</option>`).join('')}</optgroup>`;
    }).join('');
  };
  const slot = (k) => {
    const v = k === 5 ? b.riserva : b.titolari[k];
    const p = v && giocatore(v);
    return `<label class="cf-slot"><span class="cf-ruolo">${SLOT[k][0] === '*' || SLOT[k][0] === 'R' ? `<b>${SLOT[k][0] === 'R' ? 'R' : '+'}</b>` : roleChip(SLOT[k][0])}<span>${SLOT[k][1]}${p ? ` · <i>${esc(nomeClub(p.clubId))}</i>` : ''}</span></span>
      <select class="select" data-slot="${k}"><option value="">Scegli…</option>${opzioni(k, v)}</select></label>`;
  };
  const tit = b.titolari.filter(Boolean);
  const err = tit.length === 5 && b.riserva ? validaFormazione(b, t.n, giocatore, sqd) : null;
  const salvata = CS.formazione(t.n, io());
  return `${sec(`La tua formazione · ${t.nome}`)}
    <div class="a-card cf-form">
      <p class="cf-chiude">${icon('clock', 'ic sm')} Chiude ${quando(chiude)}, al calcio d'inizio</p>
      <p class="small muted" style="margin:0">Cinque titolari e una riserva fra i giocatori delle squadre in campo (${sqd.map(nomeClub).join(', ')}), al massimo ${t.tetto} per squadra. Il capitano vale doppio; la riserva entra al posto del primo titolare che non gioca.</p>
      ${SLOT.map((_, k) => slot(k)).join('')}
      <label class="lbl" for="cf-cap">Capitano</label>
      <select class="select" id="cf-cap"><option value="">Scegli fra i titolari…</option>${tit.map((id) => `<option value="${esc(id)}" ${id === b.capitano ? 'selected' : ''}>${esc(giocatore(id)?.lastName || id)}</option>`).join('')}</select>
      ${err ? `<p class="cf-err">${esc(err)}</p>` : ''}
      <button class="a-btn" id="cf-salva" ${err || tit.length < 5 || !b.riserva || !b.capitano ? 'disabled' : ''}>${salvata ? 'Aggiorna la formazione' : t.n === 1 && !iscritto ? 'Entra in coppa' : 'Conferma la formazione'}</button>
      ${salvata ? `<p class="small muted" style="margin:0">${icon('check', 'ic sm')} Consegnata. Puoi cambiarla fino alla chiusura.</p>` : ''}
    </div>`;
}

// ---------------------------------------------------------------- la mia formazione del turno chiuso
function mieiPunti(m) {
  const n = [...TURNI].reverse().find((t) => { const c = chiusuraTurno(cal(), t.n); return c && c.getTime() <= ora() && CS.formazione(t.n, io()); })?.n;
  if (!n) return '';
  const f = CS.formazione(n, io());
  const v = m.votiDi(n);
  const p = punteggio(f, v);
  const righe = p.righe.map((r) => {
    const g = giocatore(r.id);
    return `<div class="vr${r.fuori ? ' cf-fuori' : ''}">${roleChip(g?.role || '?')}<span class="nm"><b>${esc(g?.lastName || r.id)}${r.capitano ? ' <i class="fx-c">C</i>' : ''}${r.riserva ? ' <i class="fx-c v">R</i>' : ''}</b><span>${esc(nomeClub(g?.clubId))}${r.fuori ? ' · non ha giocato' : ''}</span></span><span class="ev"></span><span class="fv">${r.voto == null ? (v ? 's.v.' : '–') : fmt(r.capitano ? r.voto * 2 : r.voto)}</span></div>`;
  }).join('');
  return `${sec('I tuoi fantapunti', `${turno(n).nome} · ${m.conclusi.has(n) ? fmt(p.totale) : v ? `${fmt(p.totale)} provvisori` : 'si gioca'}`)}<div class="a-card fs-list">${righe}</div>`;
}

// ---------------------------------------------------------------- prima del sorteggio: cosa si vedrà
/**
 * Alex, 22/11: «tabelloni o altre statistiche dove si visualizzano?». Prima
 * della chiusura dei quarti la coppa non ha ancora gironi (si sorteggiano
 * fra chi si è iscritto): qui si dice quanti sono, che formato avrà e cosa
 * comparirà, con un'anteprima di girone e tabellone.
 */
function anteprima(m) {
  if (m.sorteggiato) return '';
  const n = m.st.contati || 0;
  const f = formato(n);
  const perGirone = f?.gironi === 2 ? `${Math.floor(n / 2)}-${Math.ceil(n / 2)}` : n;
  const formatoTxt = !f ? `Servono almeno 4 iscritti: ora ${n === 1 ? 'c\'è 1 iscritto' : `sono ${n}`}.`
    : f.gironi === 2 ? `Con ${n} iscritti: due gironi, A e B, da ${perGirone} squadre. Passano in semifinale le prime 2 di ogni girone.`
      : `Con ${n} iscritti: un girone unico, passano in semifinale le prime 4.`;
  const io = CS.formazione(1, CS.uid()) ? (S.me?.()?.teamName || 'La tua squadra') : 'La tua squadra';
  const riga = (pos, nome, pt, mia = false, passa = false) => `<div class="vr${mia ? ' fs-mia' : ''}${passa ? ' cf-passa' : ''}"><span class="fs-pos">${pos}</span><span class="cf-finto"></span><span class="nm"><b>${esc(nome)}</b><span>2 sfide · fantapunti fatti e subiti</span></span><span class="fv">${pt}</span></div>`;
  const quando1 = m.primo ? quando(m.primo) : 'alla chiusura dei quarti';
  return `${sec('Cosa vedrai qui', 'dal 25/11')}
    <div class="a-card cf-anteprima">
      <p class="cf-num"><b>${n}</b><span>${n === 1 ? 'squadra iscritta' : 'squadre iscritte'} finora</span></p>
      <p class="small muted" style="margin:0">${formatoTxt} Il sorteggio si fa ${quando1}, uguale su tutti i telefoni.</p>
      <ol class="cf-passi">
        <li><b>Il tuo girone</b> con la classifica: 3 punti a chi fa più fantapunti, 1 a testa in parità.</li>
        <li><b>Le tue sfide</b> dei quarti di andata e di ritorno, col ✓ su chi vince.</li>
        <li><b>I tuoi fantapunti</b> giocatore per giocatore, dai voti delle partite di coppa.</li>
        <li><b>Il tabellone</b> da marzo: semifinali di andata e ritorno, poi la finale secca.</li>
      </ol>
      <p class="cf-etichetta">Anteprima · girone A</p>
      <div class="fs-list cf-cls cf-finta">
        ${riga(1, 'Squadra', 6)}${riga(2, io, 4, true, true)}<div class="cf-linea"><span>passano i primi 2</span></div>${riga(3, 'Squadra', 3)}${riga(4, 'Squadra', 1)}
      </div>
      <p class="cf-etichetta">Anteprima · tabellone</p>
      <div class="cf-albero">
        <div class="cf-col"><span>Semifinale 1<b>1ª A – 2ª B</b></span><span>Semifinale 2<b>1ª B – 2ª A</b></span></div>
        <div class="cf-freccia" aria-hidden="true">›</div>
        <div class="cf-col"><span class="cf-fin">${icon('coppa', 'ic sm')} Finale<b>secca</b></span></div>
      </div>
    </div>`;
}

// ---------------------------------------------------------------- la pagina
export function disegna(m = modello()) {
  const { st, c } = m;
  if (!st.caricato) return `<main class="a-body">${empty('Carico la coppa…')}</main>`;
  if (!st.attivo) return `<main class="a-body">${empty(`La ${NOME} sta per partire: i quarti della Coppa Titano si giocano mercoledì 25 novembre.`)}</main>`;
  if (st.errore) return `<main class="a-body">${empty(`Non riesco a caricare la coppa: ${esc(st.errore)}`)}</main>`;
  const gironi = c?.gironi ? [...c.gironi].sort((a, b) => (b.membri.includes(io()) ? 1 : 0) - (a.membri.includes(io()) ? 1 : 0)) : [];
  const conTab = c?.tabellone?.length;
  return `<main class="a-body cf">
    ${campione(c)}
    ${laTuaCoppa(m)}
    ${formazioneHtml(m)}
    ${anteprima(m)}
    ${mieiPunti(m)}
    ${conTab ? `${sec('Tabellone')}${tabellone(c)}` : ''}
    ${c?.formato ? gironi.map((g) => `${sec(c.formato.gironi === 2 ? `Girone ${esc(g.nome)}` : 'Girone unico', `${g.classifica.length} squadre`)}${tabellaGirone(g, c.formato.passano)}${conTab ? '' : sfideGirone(g, m)}`).join('') : ''}
    ${m.sorteggiato && !c?.formato ? empty(`La coppa non si gioca: alla chiusura dei quarti gli iscritti erano ${m.ids.length}, ne servivano almeno 4.`) : ''}
    ${regole()}
  </main>`;
}
function regole() {
  const righe = TURNI.map((t) => {
    const c = chiusuraTurno(cal(), t.n);
    const partite = partiteDelTurno(cal(), t.n).length;
    return `<p><b>${t.nome}</b> · ${c ? `${quando(c)}, ${partite === 1 ? '1 partita' : `${partite} partite`}` : 'data non ancora decisa dalla FSGC'}${t.n <= 2 ? ' · gironi' : t.n <= 4 ? ' · semifinali' : ' · finale secca'}</p>`;
  }).join('');
  return `${sec('Come funziona')}<div class="a-card fs-fasi cf-regole">
    <p>Si gioca solo sulle partite della Coppa Titano vera: i fantapunti vengono dai voti delle partite di coppa, non dal campionato. Una coppa sola per tutti, con una formazione a parte: non serve la rosa della lega.</p>
    ${righe}
    <p class="small muted">Gironi: 3 punti a chi fa più fantapunti, 1 a testa in parità; a pari punti conta la differenza fra fantapunti fatti e subiti, poi i fatti. Semifinali con andata e ritorno (conta la somma, poi il ritorno, poi il piazzamento nel girone), finale secca. Il sorteggio è uno solo, alla chiusura dei quarti, ed è uguale su tutti i telefoni.</p></div>`;
}

export const coppa = {
  title: NOME, appbar: 'back', sub: () => NOME,
  render() { return disegna(); },
  mount(root, ctx) {
    if (!finto && !CS.stato().caricato) {
      const h = location.hash;
      CS.carica().then(() => { if (location.hash === h) ctx.render(); });
    }
    root.querySelectorAll('[data-tutte]').forEach((x) => x.addEventListener('click', () => { aperti.add(x.dataset.tutte); ctx.render(); }));
    const m = modello();
    const t = m.aperto; if (!t) return;
    const b = bozzaDi(t.n);
    root.querySelectorAll('[data-slot]').forEach((s) => s.addEventListener('change', () => {
      const k = Number(s.dataset.slot);
      if (k === 5) b.riserva = s.value || null; else b.titolari[k] = s.value || null;
      if (b.capitano && !b.titolari.includes(b.capitano)) b.capitano = null;
      ctx.render();
    }));
    root.querySelector('#cf-cap')?.addEventListener('change', (e) => { b.capitano = e.target.value || null; ctx.render(); });
    root.querySelector('#cf-salva')?.addEventListener('click', async (e) => {
      // Alex, 22/11: il nome non si chiede, è quello della squadra nella lega
      const me = S.me?.();
      const nome = me?.teamName || CS.formazione(1, io())?.squadra || 'Squadra';
      e.target.disabled = true;
      try {
        await CS.salva(t.n, { ...b, squadra: nome, colore: me?.color, iniziali: me?.initials });
        bozza = null;
        ctx.toast(t.n === 1 ? 'Sei in coppa' : 'Formazione di coppa consegnata');
        ctx.render();
      } catch (err) { ctx.toast(err.message); e.target.disabled = false; }
    });
  },
};
