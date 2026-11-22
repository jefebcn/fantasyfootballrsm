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
  NOME, TURNI, turno, SQUADRE_COPPA, squadreInGara, chiusuraTurno, turnoConcluso, votiDelTurno, punteggio,
  coppaFantatitano, dovesei, validaFormazione, partiteDelTurno, formato,
  eApp, squadreApp, formazioneApp,
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
  const primo = chiusuraTurno(cal(), 1);
  const sorteggiato = primo && primo.getTime() <= ora();
  // gli iscritti veri, e le squadre dell'app che portano la coppa a 32 (coppa-fanta.js)
  const reali = sorteggiato ? CS.iscritti() : CS.iscrittiFinora();
  const app = squadreApp(Math.max(reali.length, sorteggiato ? 0 : st.contati || 0));
  const ids = [...reali, ...app];
  const totale = Math.max(reali.length, sorteggiato ? 0 : st.contati || 0) + app.length;
  const voti = new Map();
  const votiDi = (n) => {
    if (!voti.has(n)) voti.set(n, votiDelTurno({ calendario: cal(), referti: ref(), giocatore, n }));
    return voti.get(n);
  };
  const conclusi = new Set(TURNI.filter((t) => turnoConcluso(cal(), ref(), t.n)).map((t) => t.n));
  const punti = (n, id) => {
    if (!conclusi.has(n)) return null;
    const f = eApp(id) ? formazioneApp(id, n, giocatoriInGara(n)) : CS.formazione(n, id);
    return f ? punteggio(f, votiDi(n)).totale : 0;
  };
  const c = sorteggiato ? coppaFantatitano(ids, punti) : null;
  const aperto = TURNI.find((t) => { const x = chiusuraTurno(cal(), t.n); return x && x.getTime() > ora(); }) || null;
  // prima della chiusura: i gironi provvisori, rifatti dallo stesso sorteggio a ogni iscrizione
  const prov = !sorteggiato && formato(totale) && ids.length >= 4 ? coppaFantatitano(ids, () => null) : null;
  return { st, ids, totale, c, prov, punti, conclusi, aperto, sorteggiato, primo, dove: c ? dovesei(c, io()) : null, votiDi };
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

/**
 * IL TABELLONE (Alex, 22/11: «migliora la grafica del torneo»): un albero vero,
 * quarti → semifinali → finale, con le linee che uniscono le gare. Prima dei
 * nomi mostra chi incontra chi («1ª A – 2ª B»), poi squadre e fantapunti con
 * la vincente in evidenza. Le linee stanno nel CSS (.cf-b-coppia, .cf-b-gara).
 */
function bracket(f, c) {
  f = f || formato(SQUADRE_COPPA);
  const otto = f.tabellone === 8;
  const giri = otto ? ['Quarti', 'Semifinali', 'Finale'] : ['Semifinali', 'Finale'];
  const sigla = otto ? ['Q', 'S'] : ['S'];
  const primi = otto
    ? (f.gironi === 4 ? [['1ª A', '2ª B'], ['1ª C', '2ª D'], ['1ª B', '2ª A'], ['1ª D', '2ª C']] : [['1ª A', '4ª B'], ['2ª B', '3ª A'], ['1ª B', '4ª A'], ['2ª A', '3ª B']])
    : [['1ª', '4ª'], ['2ª', '3ª']];
  const nomi = !!c?.tabellone?.length;
  const riga = (id, etichetta, p, s) => {
    const esito = s?.vincente ? (s.vincente === id ? ' vince' : ' perde') : '';
    return `<div class="cf-b-riga${esito}${id && id === io() ? ' mia' : ''}">${id ? stemma(id) : '<i class="cf-b-vuoto"></i>'}<span class="cf-n">${id ? nomeSq(id) : esc(etichetta)}</span>${p == null ? '' : `<b>${fmt(p)}</b>`}</div>`;
  };
  const colonne = giri.map((nome, r) => {
    const quante = 2 ** (giri.length - 1 - r);
    const vere = c?.tabellone?.[r]?.sfide || [];
    const gare = Array.from({ length: quante }, (_, i) => {
      const s = vere[i];
      const et = r === 0 ? primi[i] : [`Vinc. ${sigla[r - 1]}${2 * i + 1}`, `Vinc. ${sigla[r - 1]}${2 * i + 2}`];
      const mia = s && (s.a === io() || s.b === io());
      return `<div class="cf-b-gara${s ? '' : ' vuota'}${mia ? ' mia' : ''}${r === giri.length - 1 ? ' cf-b-fin' : ''}">${riga(s?.a, et[0], s?.gare?.[0]?.[0], s)}${riga(s?.b, et[1], s?.gare?.[0]?.[1], s)}</div>`;
    });
    const corpo = quante === 1 ? `<div class="cf-b-coppia sola">${gare[0]}</div>`
      : Array.from({ length: quante / 2 }, (_, k) => `<div class="cf-b-coppia">${gare[2 * k]}${gare[2 * k + 1]}</div>`).join('');
    const t = c?.tabellone?.[r] ? turno(c.tabellone[r].turni[0]) : TURNI.find((x) => x.fanta === nome);
    return `<div class="cf-b-col"><p class="cf-b-tit">${r === giri.length - 1 ? icon('coppa', 'ic sm') : ''}${nome}<small>${t ? esc(dataTurno(t)) : ''}</small></p><div class="cf-b-corpo">${corpo}</div></div>`;
  }).join('');
  const campione = c?.campione ? `<p class="cf-b-campione">${icon('coppa', 'ic sm')} Campione: <b>${nomeSq(c.campione)}</b></p>` : '';
  // coi nomi il tabellone è più largo dello schermo: si apre sul turno in corso e il successivo
  const col = nomi ? Math.min(c.tabellone.length - 1, giri.length - 2) : 0;
  return `<div class="cf-b-scorri" data-col="${col}"><div class="cf-b cf-b-${giri.length}${nomi ? ' nomi' : ''}">${colonne}</div></div>${nomi ? '<p class="cf-b-scorri-nota">Scorri di lato per tutto il tabellone</p>' : ''}${campione}`;
}
/** «sab 6/3» del turno vero, o «da decidere» se la FSGC non l'ha ancora messo in calendario. */
function dataTurno(t) {
  const d = chiusuraTurno(cal(), t.n);
  return d ? dateIt(d) : 'da decidere';
}

function laTuaCoppa(m) {
  const d = m.dove, c = m.c;
  const iscritto = !!CS.formazione(1, io());
  if (!m.sorteggiato) return testata(m, iscritto);
  if (!c?.formato) return '';
  const riga = d?.riga;
  const prossima = () => {
    if (!d?.girone) return '';
    const p = d.girone.partite.find((x) => !m.conclusi.has(x.giornata));
    const s = p?.sfide.find((x) => x.a === io() || x.b === io());
    if (!s) return '';
    const avv = s.a === io() ? s.b : s.a;
    const quando2 = chiusuraTurno(cal(), p.giornata);
    return `<p class="cf-prossima">Prossima sfida${quando2 ? ` · <b>${dateIt(quando2)}</b>` : ''}: contro ${avv ? `<b>${nomeSq(avv)}</b>` : 'la media del girone'}</p>`;
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
  return `<div class="a-card cf-top cf-hero"><div class="cf-top-su"><span class="cf-top-ico">${icon('coppa')}</span><div><span class="cf-top-k">La tua coppa</span><h3>${testi[0]}</h3></div></div>
    <p class="cf-top-stato si">${testi[1]}</p>${d?.stato === 'gironi' ? prossima() : ''}</div>`;
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
let modifica = false;   // la formazione consegnata si mostra corta; «Modifica» la riapre
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
  const consegnata = CS.formazione(t.n, io());
  if (consegnata && !modifica) {
    // già consegnata: i sei giocatori in breve, così la pagina resta sulla coppa
    const chi = [...consegnata.titolari, consegnata.riserva].map((id) => {
      const g = giocatore(id);
      return `<div class="cf-mia-g">${roleChip(g?.role || '?')}<span><b>${esc(g?.lastName || id)}${id === consegnata.capitano ? ' <i class="fx-c">C</i>' : ''}${id === consegnata.riserva ? ' <i class="fx-c v">R</i>' : ''}</b><small>${esc(nomeClub(g?.clubId))}</small></span></div>`;
    }).join('');
    return `${sec('La tua formazione', 'consegnata')}
      <div class="a-card cf-mia"><div class="cf-mia-gr">${chi}</div>
      <p class="cf-chiude">${icon('clock', 'ic sm')} ${esc(t.nome)}: puoi cambiarla fino a ${quando(chiude)}</p>
      <button class="a-btn sec" id="cf-modifica">Modifica la formazione</button></div>`;
  }
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
  const f = formato(m.totale);
  const quando1 = m.primo ? quando(m.primo) : 'alla chiusura dei quarti';
  let gironiHtml = '';
  if (m.prov?.formato) {
    const gironi = m.prov.gironi;
    const scelto = gironi.find((g) => g.nome === gironeScelto) || gironi.find((g) => g.membri.includes(io())) || gironi[0];
    const nomeG = (g) => (m.prov.formato.gironi > 1 ? `Girone ${g.nome}` : 'Girone unico');
    const tutte = aperti.has(`prov-${scelto.nome}`);
    const mio = scelto.membri.indexOf(io());
    const mostra = scelto.membri.filter((id, i) => tutte || i < 12 || i === mio);
    const altre = !tutte && scelto.membri.length > mostra.length ? `<button class="cf-tutte" data-tutte="prov-${esc(scelto.nome)}">Mostra tutte le ${scelto.membri.length} squadre</button>` : '';
    gironiHtml = `${sec('I gironi', 'provvisori')}${schedeGironi(gironi, scelto, nomeG)}
      <div class="a-card cf-gr-card"><p class="cf-gr-tit"><b>${esc(nomeG(scelto))}</b><span>${scelto.membri.length} squadre · passano le prime ${m.prov.formato.passano}</span></p>
      <div class="cf-gr">${mostra.map((id) => `<div class="cf-gr-sq${mia(id)}">${stemma(id)}<span class="cf-n">${nomeSq(id)}</span>${id === io() ? '<i>TU</i>' : ''}</div>`).join('')}</div>${altre}
      <p class="small muted cf-gr-nota">Cambiano a ogni nuova iscrizione. Alla chiusura, ${quando1}, restano questi e partono le sfide.</p></div>`;
  }
  return `${gironiHtml}${sec('Il tabellone', f?.tabellone === 4 ? 'semifinali e finale' : 'dai quarti alla finale')}<div class="a-card cf-b-card">${bracket(f, null)}</div>`;
}

/** Le schede dei gironi: A B C D, il tuo segnato. */
function schedeGironi(gironi, scelto, nome) {
  if (gironi.length < 2) return '';
  return `<div class="seg seg-cls cf-schede" role="tablist">${gironi.map((g) => `<button data-girone="${esc(g.nome)}" class="${g === scelto ? 'on' : ''}" role="tab">${gironi.length > 2 ? esc(g.nome) : esc(nome(g))}${g.membri.includes(io()) ? (gironi.length > 2 ? ' · tuo' : ' · il tuo') : ''}</button>`).join('')}</div>`;
}

/** In cima, prima della chiusura: la coppa, il conto alla rovescia, i numeri e dove sei. */
function testata(m, iscritto) {
  const f = formato(m.totale);
  const resta = m.primo ? m.primo.getTime() - ora() : 0;
  const giorni = Math.floor(resta / 864e5), ore = Math.floor((resta % 864e5) / 36e5);
  const manca = resta <= 0 ? '' : giorni ? `mancano ${giorni === 1 ? '1 giorno' : `${giorni} giorni`}${ore ? ` e ${ore === 1 ? '1 ora' : `${ore} ore`}` : ''}`
    : ore ? `mancano ${ore === 1 ? '1 ora' : `${ore} ore`}` : 'meno di un\'ora';
  const stat = (n, cosa) => `<div><b>${n}</b><span>${cosa}</span></div>`;
  const mioG = m.prov?.gironi?.find((g) => g.membri.includes(io()));
  const stato = iscritto
    ? `<p class="cf-top-stato si">${icon('check', 'ic sm')}<span>Sei dentro con <b>${nomeSq(io())}</b>${mioG && m.prov.formato.gironi > 1 ? ` · per ora nel girone ${esc(mioG.nome)}` : ''}</span></p>`
    : `<p class="cf-top-stato">Schiera qui sotto 5 giocatori e una riserva per entrare: è gratis e non tocca la rosa della tua lega.</p>`;
  return `<div class="a-card cf-top">
    <div class="cf-top-su"><span class="cf-top-ico">${icon('coppa')}</span><div><span class="cf-top-k">Sulla Coppa Titano vera</span><h2>${NOME}</h2></div></div>
    <p class="cf-top-chiude">${icon('clock', 'ic sm')}<span>Chiude ${m.primo ? quando(m.primo) : 'al primo turno'}${manca ? ` · <b>${manca}</b>` : ''}</span></p>
    ${f ? `<div class="cf-stat">${stat(m.totale, 'squadre')}${stat(f.gironi, f.gironi === 1 ? 'girone' : 'gironi')}${stat(f.tabellone, f.tabellone === 8 ? 'ai quarti' : 'in semifinale')}</div>` : ''}
    ${stato}</div>`;
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
  const schede = schedeGironi(gironi, scelto, nome);
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
    ${conTab ? `${sec('Il tabellone')}<div class="a-card cf-b-card">${bracket(c.formato, c)}</div>` : ''}
    ${c?.formato ? sezioneGironi(gironi, c, m, conTab) : ''}
    ${c?.formato && !conTab ? `${sec('Il tabellone', 'dopo i gironi')}<div class="a-card cf-b-card">${bracket(c.formato, c)}</div>` : ''}
    ${m.sorteggiato && !c?.formato ? empty(`La coppa non si gioca: alla chiusura dei quarti le squadre erano ${m.ids.length}, ne servivano almeno 4.`) : ''}
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
    <p class="small muted">Gironi: 2 sfide a testa, 3 punti a chi fa più fantapunti, 1 a testa in parità; a pari punti conta la differenza fra fantapunti fatti e subiti, poi i fatti. Con 16 squadre o più 4 gironi e passano le prime 2 di ognuno; da 8 a 15 2 gironi e passano le prime 4: in tutti e due i casi 8 squadre ai quarti. Quarti, semifinali e finale in gara secca: a pari fantapunti passa chi era meglio piazzato nel girone. Il sorteggio è uno solo, alla chiusura dei quarti, ed è uguale su tutti i telefoni. Per completare i gironi giocano anche squadre dell'app, finché gli iscritti non bastano a riempirli.</p></div>`;
}

export const coppa = {
  title: NOME, appbar: 'back', testata: () => NOME, sub: () => 'Si gioca sulla Coppa Titano',
  render() { return disegna(); },
  mount(root, ctx) {
    if (!finto && !CS.stato().caricato) {
      const h = location.hash;
      CS.carica().then(() => { if (location.hash === h) ctx.render(); });
    }
    root.querySelectorAll('[data-tutte]').forEach((x) => x.addEventListener('click', () => { aperti.add(x.dataset.tutte); ctx.render(); }));
    root.querySelectorAll('.cf-b-scorri').forEach((x) => {
      const col = x.querySelectorAll('.cf-b-col')[Number(x.dataset.col) || 0];
      if (col && x.scrollWidth > x.clientWidth) x.scrollLeft = col.offsetLeft - 6;
    });
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
    root.querySelector('#cf-modifica')?.addEventListener('click', () => { modifica = true; ctx.render(); });
    root.querySelector('#cf-cap')?.addEventListener('change', (e) => { b.capitano = e.target.value || null; ctx.render(); });
    root.querySelector('#cf-salva')?.addEventListener('click', async (e) => {
      // Alex, 22/11: il nome non si chiede, è quello della squadra nella lega
      const me = S.me?.();
      const nome = me?.teamName || CS.formazione(1, io())?.squadra || 'Squadra';
      e.target.disabled = true;
      try {
        await CS.salva(t.n, { ...b, squadra: nome, colore: me?.color, iniziali: me?.initials });
        bozza = null; modifica = false;
        ctx.toast(t.n === 1 ? 'Sei in coppa' : 'Formazione di coppa consegnata');
        ctx.render();
      } catch (err) { ctx.toast(err.message); e.target.disabled = false; }
    });
  },
};
