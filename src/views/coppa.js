/**
 * LA PAGINA DELLA COPPA FANTATITANO (#/coppa). Le regole in src/coppa-fanta.js.
 *
 * Come la Coppa Titano del futsal: in cima «La tua coppa» (dove sei, prossima
 * sfida, se sei fuori e dove), il tuo girone per primo con la tua squadra
 * evidenziata e la linea «passano i primi N», le classifiche lunghe ridotte con
 * «Mostra tutte», le sfide del turno con ✓ su chi vince, il tabellone con
 * gare secche, il campione col risultato della finale.
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
/** «sui quarti di andata», «sulle semifinali di ritorno», «sulla finale» della Coppa Titano. */
const sulTurno = (t) => `${/^Quarti/.test(t.nome) ? 'sui' : /^Semifinali/.test(t.nome) ? 'sulle' : 'sulla'} ${t.nome.toLowerCase()} della Coppa Titano`;

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
  return c.tabellone.map((t) => `${sec(t.nome, sulTurno(turno(t.turni[0])))}
    <div class="a-card fs-list">${t.sfide.map((s) => sfida(s.a, s.b, s.gare[0][0], s.gare[0][1], { vincente: s.vincente })).join('')}</div>`).join('');
}

/** Lo schema del tabellone prima dei nomi: chi incontra chi, secondo il formato. */
function alberoFinto(f) {
  const casella = (titolo, chi, cls = '') => `<span class="${cls}">${titolo}<b>${chi}</b></span>`;
  const fin = `<div class="cf-freccia" aria-hidden="true">›</div><div class="cf-col">${casella(`${icon('coppa', 'ic sm')} Finale`, 'secca', 'cf-fin')}</div>`;
  if (!f || f.tabellone === 4) {
    return `<div class="cf-albero"><div class="cf-col">${casella('Semifinale 1', '1ª – 4ª')}${casella('Semifinale 2', '2ª – 3ª')}</div>${fin}</div>`;
  }
  const q = f.gironi === 4 ? ['1ª A – 2ª B', '1ª C – 2ª D', '1ª B – 2ª A', '1ª D – 2ª C'] : ['1ª A – 4ª B', '2ª B – 3ª A', '1ª B – 4ª A', '2ª A – 3ª B'];
  return `<div class="cf-albero cf-albero-8"><div class="cf-col">${q.map((x, i) => casella(`Quarto ${i + 1}`, x)).join('')}</div><div class="cf-freccia" aria-hidden="true">›</div>
    <div class="cf-col">${casella('Semifinale 1', 'Q1 – Q2')}${casella('Semifinale 2', 'Q3 – Q4')}</div>${fin}</div>`;
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
    gironi: [`Girone ${esc(d?.girone?.nome || '')} · ${riga ? `${riga.posto}° posto su ${d.girone.classifica.length}` : ''}`, `${riga ? `${riga.punti} punti, ${fmt(riga.fatti)} fantapunti fatti. ` : ''}Passano ${c.formato.tabellone === 8 ? 'ai quarti' : 'in semifinale'} i primi ${c.formato.passano}${c.formato.gironi > 1 ? ' di ogni girone' : ''}.`],
    quarti: [`Sei ai quarti contro ${d?.avversario ? nomeSq(d.avversario) : ''}`, 'Gara secca sulle semifinali di andata della Coppa Titano.'],
    semifinale: [d?.attesa ? 'Sei in semifinale' : `Sei in semifinale contro ${d?.avversario ? nomeSq(d.avversario) : ''}`, d?.attesa ? 'L\'avversaria esce dagli altri quarti. Gara secca sulle semifinali di ritorno della Coppa Titano.' : 'Gara secca sulle semifinali di ritorno della Coppa Titano.'],
    finale: [d?.attesa ? 'Sei in finale' : `Sei in finale contro ${d?.avversario ? nomeSq(d.avversario) : ''}`, d?.attesa ? 'L\'avversaria esce dall\'altra semifinale. Gara secca sulla finale della Coppa Titano.' : 'Gara secca sulla finale della Coppa Titano.'],
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
  const inGara = t.n === 1 || (t.n === 2 && iscritto) || (m.c && ['quarti', 'semifinale', 'finale'].includes(m.dove?.stato));
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
  const quando1 = m.primo ? quando(m.primo) : 'alla chiusura dei quarti';
  const formatoTxt = !f ? `Servono almeno 4 iscritti per fare i gironi: ora ${n === 1 ? 'c\'è 1 iscritto' : `sono ${n}`}.`
    : f.gironi === 4 ? `Con ${n} iscritti: quattro gironi, A, B, C e D. Passano ai quarti le prime 2 di ogni girone: 8 squadre.`
      : f.gironi === 2 ? `Con ${n} iscritti: due gironi, A e B. Passano ai quarti le prime 4 di ogni girone: 8 squadre.`
        : `Con ${n} iscritti: un girone unico, passano in semifinale le prime 4.`;
  // Alex, 22/11: «vorrei vedere man mano che la gente si iscrive i tabelloni che si
  // vanno a creare». I gironi veri, coi nomi, rifatti dal sorteggio a ogni iscrizione.
  const ids = CS.iscrittiFinora();
  const prov = f && ids.length >= 4 ? coppaFantatitano(ids, () => null) : null;
  let gironiHtml = '';
  if (prov?.formato) {
    const gironi = prov.gironi;
    const scelto = gironi.find((g) => g.nome === gironeScelto) || gironi.find((g) => g.membri.includes(io())) || gironi[0];
    const nomeG = (g) => (prov.formato.gironi > 1 ? `Girone ${g.nome}` : 'Girone unico');
    const schede = gironi.length > 1 ? `<div class="seg seg-cls cf-schede" role="tablist">${gironi.map((g) => `<button data-girone="${esc(g.nome)}" class="${g === scelto ? 'on' : ''}" role="tab">${gironi.length > 2 ? esc(g.nome) : esc(nomeG(g))}${g.membri.includes(io()) ? (gironi.length > 2 ? ' · tuo' : ' · il tuo') : ''}</button>`).join('')}</div>` : '';
    const tutte = aperti.has(`prov-${scelto.nome}`);
    const mio = scelto.membri.indexOf(io());
    const mostra = scelto.membri.filter((id, i) => tutte || i < 8 || i === mio);
    const righe = mostra.map((id) => `<div class="vr${mia(id)}">${stemma(id)}<span class="nm"><b>${nomeSq(id)}</b><span>${id === io() ? 'la tua squadra' : 'iscritta'}</span></span></div>`).join('');
    const altre = !tutte && scelto.membri.length > mostra.length ? `<button class="cf-tutte" data-tutte="prov-${esc(scelto.nome)}">Mostra tutte le ${scelto.membri.length} squadre</button>` : '';
    gironiHtml = `<p class="cf-etichetta">Gironi provvisori · ${esc(nomeG(scelto))}, ${scelto.membri.length} squadre</p>${schede}<div class="fs-list cf-prov">${righe}${altre}</div>
      <p class="small muted" style="margin:0">Cambiano a ogni nuova iscrizione. Alla chiusura, ${quando1}, restano questi e partono le sfide.</p>`;
  } else if (ids.length) {
    gironiHtml = `<p class="cf-etichetta">Iscritte finora</p><div class="fs-list cf-prov">${ids.map((id) => `<div class="vr${mia(id)}">${stemma(id)}<span class="nm"><b>${nomeSq(id)}</b></span></div>`).join('')}</div>`;
  }
  return `${sec('La coppa che si forma', 'fino al 25/11')}
    <div class="a-card cf-anteprima">
      <p class="cf-num"><b>${n}</b><span>${n === 1 ? 'squadra iscritta' : 'squadre iscritte'} finora</span></p>
      <p class="small muted" style="margin:0">${formatoTxt} Il sorteggio è uguale su tutti i telefoni. Le formazioni restano segrete fino alla chiusura.</p>
      ${gironiHtml}
      <p class="cf-etichetta">Tabellone</p>
      ${alberoFinto(f)}
      <p class="small muted" style="margin:0">Dopo la chiusura qui trovi le classifiche coi punti, le tue sfide col ✓ e i tuoi fantapunti giocatore per giocatore.</p>
    </div>`;
}

// ---------------------------------------------------------------- i gironi: il tuo, e gli altri a un tocco
/**
 * Alex, 22/11: «si possano vedere anche altri gironi oltre al proprio». Con
 * due gironi una scheda per girone: si apre sul tuo, l'altro è a un tocco.
 * Ogni girone ha classifica intera («Mostra tutte») e sfide del turno.
 */
let gironeScelto = null;
function sezioneGironi(gironi, c, m, conTab) {
  if (!gironi.length) return '';
  const nome = (g) => (c.formato.gironi > 1 ? `Girone ${g.nome}` : 'Girone unico');
  const scelto = gironi.find((g) => g.nome === gironeScelto) || gironi.find((g) => g.membri.includes(io())) || gironi[0];
  const schede = gironi.length > 1
    ? `<div class="seg seg-cls cf-schede" role="tablist">${gironi.map((g) => `<button data-girone="${esc(g.nome)}" class="${g === scelto ? 'on' : ''}" role="tab">${gironi.length > 2 ? esc(g.nome) : esc(nome(g))}${g.membri.includes(io()) ? (gironi.length > 2 ? ' · tuo' : ' · il tuo') : ''}</button>`).join('')}</div>` : '';
  return `${sec(conTab ? 'I gironi' : 'Gironi', `${esc(nome(scelto))} · ${scelto.classifica.length} squadre`)}${schede}${tabellaGirone(scelto, c.formato.passano)}${conTab ? '' : sfideGirone(scelto, m)}`;
}

// ---------------------------------------------------------------- la pagina
export function disegna(m = modello()) {
  const { st, c } = m;
  if (!st.caricato) return `<main class="a-body">${empty('Carico la coppa…')}</main>`;
  if (!st.attivo) return `<main class="a-body">${empty(`La ${NOME} sta per partire: i quarti della Coppa Titano si giocano mercoledì 25 novembre.`)}</main>`;
  if (st.errore) return `<main class="a-body">${empty(`Non riesco a caricare la coppa: ${esc(st.errore)}`)}</main>`;
  const gironi = c?.gironi || [];
  const conTab = c?.tabellone?.length;
  return `<main class="a-body cf">
    ${campione(c)}
    ${laTuaCoppa(m)}
    ${formazioneHtml(m)}
    ${anteprima(m)}
    ${mieiPunti(m)}
    ${conTab ? `${sec('Tabellone')}${tabellone(c)}` : ''}
    ${c?.formato ? sezioneGironi(gironi, c, m, conTab) : ''}
    ${m.sorteggiato && !c?.formato ? empty(`La coppa non si gioca: alla chiusura dei quarti gli iscritti erano ${m.ids.length}, ne servivano almeno 4.`) : ''}
    ${regole()}
  </main>`;
}
function regole() {
  const righe = TURNI.map((t) => {
    const c = chiusuraTurno(cal(), t.n);
    const partite = partiteDelTurno(cal(), t.n).length;
    return `<p><b>${t.fanta}</b> · ${sulTurno(t)} · ${c ? `${quando(c)}, ${partite === 1 ? '1 partita' : `${partite} partite`}` : 'data non ancora decisa dalla FSGC'}</p>`;
  }).join('');
  return `${sec('Come funziona')}<div class="a-card fs-fasi cf-regole">
    <p>Si gioca solo sulle partite della Coppa Titano vera: i fantapunti vengono dai voti delle partite di coppa, non dal campionato. Una coppa sola per tutti, con una formazione a parte: non serve la rosa della lega.</p>
    ${righe}
    <p class="small muted">Gironi: 2 sfide a testa, 3 punti a chi fa più fantapunti, 1 a testa in parità; a pari punti conta la differenza fra fantapunti fatti e subiti, poi i fatti. Con 16 iscritti o più 4 gironi e passano le prime 2 di ognuno; da 8 a 15 2 gironi e passano le prime 4: in tutti e due i casi 8 squadre ai quarti. Quarti, semifinali e finale in gara secca: a pari fantapunti passa chi era meglio piazzato nel girone. Il sorteggio è uno solo, alla chiusura dei quarti, ed è uguale su tutti i telefoni.</p></div>`;
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
    root.querySelectorAll('[data-girone]').forEach((x) => x.addEventListener('click', () => { gironeScelto = x.dataset.girone; ctx.render(); }));
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
