import * as S from '../state.js';
import { videoGiornata, giornateConVideo } from '../video.js';
import * as AV from '../notifiche.js';
import * as N from '../notizie.js';
import { esc, premioHtml, fmt, icon, logo, badge, crest, pic, tile, sec, dateIt, timeIt, plurale, freccia, t, lingua } from '../ui.js';
import { locale } from '../lingua.js';
import { movimenti, anteprimaClassifica } from '../engine.js';
import { personaggio, scelto, figura } from '../personaggio.js';
import { partitaDiOggi } from './gioco.js';
import { INVITO_CALCIATORI } from '../config.js';
import { riquadroRichiesta, rispondi } from './chiedi-avvisi.js';
import { eNotte } from '../sole.js';

const RULES = [
  ['Art. 7.4', 'Rigore parato', 'Vale +3,0 al portiere e −3,0 al tiratore. Sul palo o fuori: −3,0 al tiratore e nessun bonus al portiere.'],
  ['Art. 7.5', 'Porta inviolata', 'Spetta solo se la squadra chiude senza subire gol e il giocatore ha disputato almeno 60 minuti.'],
  ['Art. 6.2', 'Capitano', 'Raddoppia bonus e malus, non il voto base. Se è S.V. subentra il vice.'],
  ['Art. 8.5', 'Sostituzioni automatiche', 'Un titolare S.V. è sostituito dal primo panchinaro del suo ruolo con voto. Massimo tre.'],
  ['Art. 9.2', 'Congelamento', 'Martedì alle 20:00 la giornata diventa definitiva, anche se emergono errori.'],
  ['Art. 11', 'Conversione in gol', 'Con dieci fantallenatori il primo gol scatta a 69,0, poi uno ogni 6,0 punti.'],
  ['Art. 4', 'Esito collettivo', 'Vittoria +0,5, sconfitta −0,5; metà tra 20 e 59 minuti. Senza pagelle serve differenziare.'],
];

/**
 * Il richiamo ai voti, solo mentre sono ancora contestabili: la formazione ha
 * gia' il suo bottone sulla card della giornata corrente, e i voti definitivi
 * si aprono dalla card della giornata precedente. Qui resta la sola finestra
 * in cui c'e' davvero qualcosa da fare.
 */
/** L'avviso che il foglio delle notifiche promette da sempre: qui dentro
 *  l'app, dove si vede anche senza aver dato nessun permesso. */
/**
 * Il calendario dei lock disallineato e' un guasto silenzioso: il server chiude
 * le formazioni in un giorno diverso da quello che l'app mostra, e nessuno se
 * ne accorge finche' non si va a vedere la formazione di un avversario e non
 * c'e'. La riga di stato sta in Impostazioni avanzate, che va bene quando e'
 * tutto a posto; quando non lo e' deve venire a galla da sola.
 */
function lockDaSistemare() {
  // Solo al Giudice Dati, che e' l'unico che puo' rimediare dall'app. Per
  // tutti gli altri il calendario arriva con la migrazione 012 e non c'e'
  // niente da fare: un avviso senza rimedio e' solo ansia.
  if (!S.isJudge()) return '';
  const n = S.lockDaSistemare(); if (!n) return '';
  return tile({ href: '#/impostazioni/avanzate', lead: icon('warn'), leadKind: 'warn',
    title: t('Calendario dei lock da allineare'),
    sub: t('{n} giornate: il server chiude le formazioni in un giorno diverso da quello che vedi qui.', { n }) });
}

/**
 * Una proposta di scambio che aspetta una risposta non si vede da nessuna
 * parte finche' non si apre la Rosa: e chi non la apre lascia l'altro ad
 * aspettare. Qui in home viene a galla da sola, come il lock disallineato.
 */
function scambiDaDecidere() {
  const q = S.scambiDaDecidere(); if (!q.length) return '';
  const uno = q.length === 1;
  const chi = S.managersById.get(q[0].da)?.teamName || t('una squadra');
  return tile({ href: '#/scambi', lead: icon('undo'), leadKind: 'accent',
    title: uno ? t('Una proposta di scambio') : t('{n} proposte di scambio', { n: q.length }),
    sub: uno ? t('{chi} aspetta la tua risposta.', { chi }) : t('Aspettano la tua risposta.') });
}

function daConsegnare() {
  const p = S.promemoriaFormazione(); if (!p) return '';
  const ore = Math.floor(p.ore);
  const quando = ore >= 24 ? t('{g}g {h}h', { g: Math.floor(ore / 24), h: ore % 24 }) : ore >= 1 ? t('{n} ore', { n: ore }) : t('meno di un\'ora');
  return tile({ href: '#/rosa/formazione', lead: icon('clock'), leadKind: 'warn',
    title: t('Giornata {n}: manca la formazione', { n: p.giornata }),
    sub: t('Si chiude fra {quando}. Senza consegna la partita è persa 0-3 a tavolino (art. 8.4).', { quando }) });
}

function azione(ph, bloccato = null) {
  const st = S.matchdayStatus(ph.matchday);
  if (st !== 'live' && st !== 'provisional') return '';
  // Se la card della giornata corrente e' gia' quella in corso, questa
  // scheda direbbe la stessa cosa e porterebbe allo stesso posto.
  if (bloccato && bloccato.inGioco === ph.matchday) return '';
  return tile({ href: `#/voti/${ph.matchday}`, lead: icon('votes'), leadKind: 'warn',
    title: t('Voti della giornata {n}', { n: ph.matchday }),
    sub: st === 'live' ? t('Punteggi in arrivo mano a mano che il Giudice inserisce gli eventi')
      : t('Punteggi provvisori: puoi segnalare un errore fino a martedì'),
    badgeHtml: badge(st, st === 'provisional' ? t('fino a mar 18:00') : '') });
}

/**
 * Il tasto principale della giornata, nello stile dei post di Tito (Alex,
 * 11/10: «migliorare la home dal punto di vista grafico dei tasti»): lime
 * pieno, scritta Anton, la freccia in un tondo nero come lo «SWIPE →» delle
 * storie. Era un <a> senza text-decoration:none, quindi sottolineato come un
 * link qualunque.
 */
const tasto = (href, testo) => `<a class="a-btn big tito" href="${href}"><span>${testo}</span><i class="vai">${icon('chev', 'ic sm')}</i></a>`;

/** Conto alla rovescia compatto: "3g 12h", come sulla pastiglia centrale. */
function manca(lockAt) {
  const left = Math.max(0, new Date(lockAt) - S.now());
  if (!left) return '';
  const g = Math.floor(left / 86400000), h = Math.floor((left % 86400000) / 3600000);
  return g ? t('{g}g {h}h', { g, h }) : t('{h}h {m}m', { h, m: Math.floor((left % 3600000) / 60000) });
}

const lato = (m) => `<div class="side">${figura(m, 'fig-sfida') || crest(m)}<b>${esc(m.teamName)}</b><span class="own">${esc(m.owner)}</span></div>`;

/**
 * La giornata appena conclusa. È la prima cosa che si cerca riaprendo l'app,
 * quindi sta in cima e porta le sue due azioni addosso: condividere il
 * risultato e aprire voti e pagelle.
 */
function conclusa(r) {
  if (!r) return '';
  const h = S.managersById.get(r.homeManagerId), a = S.managersById.get(r.awayManagerId);
  return sec(t('Giornata precedente'), t('{n}ª giornata', { n: r.matchday })) + `<div class="mcard fin">
    <div class="mrow">${lato(h)}<span class="score pill">${r.homeGoals} – ${r.awayGoals}</span>${lato(a)}</div>
    <div class="mfoot"><span>${fmt(r.homeScore)}</span><em>${t('fantapunti')}</em><span>${fmt(r.awayScore)}</span></div>
    <div class="mcta2">
      <button data-share="${r.id}">${icon('share', 'ic sm')}${t('Condividi')}</button>
      <a href="#/live/${r.id}">${t('Voti, pagelle e altro')}${icon('chev', 'ic sm')}</a>
    </div></div>`;
}

/** Perche' la formazione della prossima non si puo' ancora consegnare. */
const attesaProssima = (b) => (b.mancanti === 1
  ? t('Manca una partita: la formazione della {g}ª si apre a giornata finita', { g: b.giornata })
  : t('Mancano {n} partite su {tot}: la formazione della {g}ª si apre a giornata finita', { n: b.mancanti, tot: b.partite, g: b.giornata }));

/**
 * La giornata in corso: contro chi si gioca, quanto manca al lock, l'invio
 * della formazione e la scheda della partita. Prima la sfida compariva solo a
 * giornata giocata, quindi tra il lunedì e il sabato non si sapeva più con chi.
 */
function corrente(f, n, me, riposo, bloccato = null) {
  if (riposo) return sec(t('Giornata corrente'), t('{n}ª giornata', { n }))
    + tile({ href: '#/calendario', lead: icon('cal'), title: t('Turno di riposo'), sub: t('In questa giornata non hai avversarie') });
  if (!f) return '';
  const h = S.managersById.get(f.homeManagerId), a = S.managersById.get(f.awayManagerId);
  const md = S.matchday(n); const st = S.matchdayStatus(n);
  const saved = S.savedLineup(n, me.id);
  const aperta = st === 'open' || st === 'scheduled';
  const resta = aperta ? manca(md.lockAt) : '';
  const centro = resta ? `<span class="score attesa">${resta}</span>` : `<span class="score vs">VS</span>`;
  // Finite le partite e inseriti gli eventi i punteggi ci sono gia': manca solo
  // dire che sono definitivi, e finora quel passo lo faceva il solo Giudice
  // Dati, quindi la lega restava in sospeso ad aspettare una persona. Adesso il
  // tasto lo vedono tutti, ma resta spento finche' manca all'appello anche una
  // sola partita: l'art. 9.2 non ammette rettifiche dopo la chiusura.
  // Il tasto "Calcola la giornata" non sta qui: questa card guarda avanti e
  // riceve sempre una giornata ancora aperta. Chiudere e' un altro momento e
  // ha una scheda sua (daCalcolare), cosi' in pagina c'e' un solo
  // #chiudi-giornata invece di tre id uguali con un gestore che ne agganciava
  // uno.
  const cta = aperta
    ? tasto('#/rosa/formazione', saved ? t('Modifica la formazione') : t('Inserisci formazione'))
    : tasto(`#/voti/${n}`, t('Voti della giornata'));
  const nota = aperta
    ? (saved ? t('Formazione salvata {data} · si chiude {giorno} alle {ora}', { data: dateIt(saved.submittedAt), giorno: dateIt(md.lockAt), ora: timeIt(md.lockAt) })
      : t('Si chiude {giorno} alle {ora}', { giorno: dateIt(md.lockAt), ora: timeIt(md.lockAt) }))
    : bloccato ? attesaProssima(bloccato) : '';
  // Il tocco sulle due squadre apre il pre-match a tutto campo — la stessa
  // pagina del link "Probabili e altro", che da solo non si vedeva.
  return sec(t('Giornata corrente'), t('{n}ª giornata', { n })) + `<div class="mcard">
    <a class="mrow tocca" href="#/live/${f.id}" aria-label="${t('Apri lo scontro')}">${lato(h)}${centro}${lato(a)}</a>
    ${nota ? `<p class="mnota">${esc(nota)}</p>` : ''}
    <div class="mact">${cta}</div>
    <a class="mcta" href="#/live/${f.id}">${pic('probabili-formazioni', 'lega', 'mini')}${t('Probabili e altro')}${icon('chev', 'ic sm')}</a>
  </div>`;
}

/**
 * Il banner del montepremi.
 *
 * Sta fra le notizie e la giornata corrente: sopra c'e' il contesto del
 * campionato, sotto quello che devi fare adesso, e in mezzo la cosa che puoi
 * fare in piu'. Piu' in alto ruberebbe il posto alla formazione da
 * consegnare, piu' in basso non lo vedrebbe nessuno.
 *
 * E' una fascia scura, come quelle degli sponsor nelle app di fantacalcio:
 * in mezzo a schede tutte chiare e' l'unica cosa di un altro colore, e si
 * vede al primo colpo d'occhio senza urlare. Il fondo e' disegnato dalla CSS
 * — luce del riflettore e righe del campo — e non e' una foto: una foto sono
 * duecento kilobyte da scaricare per una striscia alta settanta punti.
 *
 * DUE FACCE, perche' il banner serve a due momenti diversi della stessa cosa.
 * Da fuori invita: porta dritto a entrare nella lega pubblica, col modulo del
 * nome squadra gia' aperto su QUELLA lega — non nell'elenco, dove poi tocca
 * cercarla. Da dentro ricorda per cosa si gioca e porta ai premi in palio.
 *
 * Il premio scritto e' sempre quello vero, messo da chi ha aperto la lega: un
 * banner che promette una cifra decisa altrove sarebbe una promessa che
 * l'app non puo' mantenere. Senza premi, a chi amministra la lega dice che
 * puo' metterlo lui; agli altri non dice niente e sparisce.
 */
/**
 * Lo spazio dello sponsor.
 *
 * Sta sotto la fascia del montepremi e sopra quello che devi fare: si vede
 * aprendo l'app, ma non ruba il posto alla formazione da consegnare.
 *
 * E' dichiarato: la targhetta dice "Sponsor" e il collegamento porta
 * rel="sponsored". Uno spazio comprato che si finge contenuto dell'app
 * inganna chi legge e, il giorno che ci si accorge, costa piu' di quanto abbia
 * reso.
 */
/**
 * «Vuoi un promemoria prima della scadenza?» — la richiesta gentile delle
 * push (regole in AV.daChiedere). Sta subito sotto la formazione: chi l'ha
 * appena consegnata e' chi capisce a cosa serve. Il permesso del telefono si
 * chiede solo dal «Sì».
 */
function richiestaPromemoria() {
  return riquadroRichiesta();
}

/**
 * «Giochi nel campionato?» (044). Chi usa l'app e' spesso anche chi gioca:
 * il banner porta alla pagina del consenso, una volta sola. Sparisce con
 * «Non gioco» o quando da questo telefono una richiesta e' gia' partita.
 */
/**
 * «Chi è?» in Home: il motivo per aprire l'app anche nei giorni senza
 * partite. Da giocare sta subito sotto la copertina, prima delle notizie,
 * col punto interrogativo che pulsa (Alex, 27/10). Giocata, non deve piu'
 * stare in mezzo (Alex: «appena uno completa il gioco quel banner si sposta
 * piu' in basso e diventa piu' piccolino»): scende verso il fondo, su una
 * riga, e dice com'e' andata. Il nome del giocatore non c'e' mai: chi non
 * l'ha indovinato lo scopre nel gioco, se vuole.
 */
function cartaGioco(dove) {
  const g = partitaDiOggi(); if (!g) return '';
  if ((dove === 'su') === g.finito) return '';
  if (g.finito) {
    const esito = g.vinto ? `${t('Indovinato in {n}', { n: g.tentativi })}${g.serie > 1 ? ` · ${t('{n} di fila', { n: g.serie })}` : ''}` : t('Non indovinato · domani un altro');
    return `<a class="a-card ce-home piccola" href="#/gioco"><span class="ce-home-ico ${g.vinto ? 'si' : 'no'}">${g.vinto ? icon('check') : '✕'}</span><span class="ce-home-txt"><b>${t('Chi è?')} <small>#${g.numero}</small></b><span>${esito}</span></span>${icon('chev', 'ic sm')}</a>`;
  }
  const testo = !g.tentativi ? t('Il giocatore del giorno: indovinalo in 6 tentativi')
    : g.tentativi === 1 ? t('In corso · 1 tentativo su 6') : t('In corso · {n} tentativi su 6', { n: g.tentativi });
  return `<a class="a-card ce-home nuovo" href="#/gioco"><span class="ce-home-ico da-giocare" aria-hidden="true">?</span><span class="ce-home-txt"><b>${t('Chi è?')} <small>#${g.numero}</small></b><span>${testo}</span></span><span class="ce-home-cta">${g.tentativi ? t('Continua') : t('Gioca')}</span></a>`;
}

function invitoCalciatori() {
  if (!INVITO_CALCIATORI || S.store.get().bannerCalciatori) return '';
  try { if (localStorage.getItem('ft.adesione')) return ''; } catch { /* niente */ }
  return `<div class="a-card invito-calc">
    <i class="cp-ico cp-logo">${logo()}</i>
    <div class="cp-txt"><b>${t('Giochi nel campionato sammarinese?')}</b>
      <span>${t('Allora sei già nel listone di Fantatitano, con nome e statistiche. Dicci se ti va bene comparire, oppure se preferisci di no: bastano due minuti.')}</span>
      <div class="cp-btn"><button class="a-btn" data-calc="si">${t('Ci gioco')}</button><button class="a-btn sec" data-calc="no">${t('Non gioco')}</button></div>
    </div>
  </div>`;
}

const INDIRIZZO_OK = /^(https?:\/\/|\/)/i;
function fasciaSponsor() {
  const sp = S.sponsorInVetrina(); if (!sp) return '';
  // Gli indirizzi li scrive chi amministra, ma "lo scrive uno di cui mi fido"
  // non e' un controllo: un javascript: in quel campo diventerebbe codice che
  // gira nel telefono di chiunque apra l'app.
  const link = INDIRIZZO_OK.test(sp.link || '') ? sp.link : '';
  const logo = INDIRIZZO_OK.test(sp.logo || '') ? sp.logo : '';
  const dentro = `<span class="spon-tag">${t('Sponsor')}</span>
    ${logo ? `<img class="spon-logo" src="${esc(logo)}" alt="${esc(sp.nome)}" loading="lazy">`
    : `<span class="spon-logo vuoto">${esc(sp.nome.slice(0, 2).toUpperCase())}</span>`}
    <span class="spon-txt"><b>${esc(sp.nome)}</b>${sp.claim ? `<span>${esc(sp.claim)}</span>` : ''}</span>
    ${link ? `<span class="spon-chev">${icon('chev', 'ic sm')}</span>` : ''}`;
  return link
    ? `<a class="spon" href="${esc(link)}" target="_blank" rel="noopener sponsored" data-sponsor="${esc(sp.id)}">${dentro}</a>`
    : `<div class="spon" data-sponsor="${esc(sp.id)}">${dentro}</div>`;
}

/**
 * «Costruisci la tua rosa»: il bottone che nella lega aperta serve davvero.
 *
 * Chi entra in una lega aperta di mercoledi' sera si trova dentro senza
 * giocatori. Prima la dashboard gli diceva "Rose non ancora assegnate — le
 * assegna l'admin dopo l'asta", che in una lega aperta e' falso due volte:
 * non c'e' un'asta e non c'e' un admin che gliele assegni. Se la rosa e'
 * incompleta questo e' il primo bottone che deve vedere, prima di tutto il
 * resto — e dice quanto manca, quanto ha da spendere e quando chiude.
 */
function invitoNegozio() {
  const n = S.negozio(); if (!n) return '';
  // 039: la finestra di riparazione si annuncia a tutti, anche a rosa completa.
  if (n.completa && n.riparazione) {
    return tile({ href: '#/negozio', lead: icon('cart'), leadKind: 'accent',
      // il nome lo scrive il proprietario; tradotto solo quello di riserva
      title: t('{nome} aperto', { nome: n.riparazione.nome === 'Mercato di riparazione' ? t('Mercato di riparazione') : n.riparazione.nome }),
      sub: t('Fino a {data}: togli e compra liberamente', { data: n.riparazione.fine.toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'numeric' }) }) });
  }
  if (n.completa) return '';
  const quando = n.chiude
    ? `${n.chiude.toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'numeric' })} ${String(n.chiude.getHours()).padStart(2, '0')}:${String(n.chiude.getMinutes()).padStart(2, '0')}`
    : null;
  if (n.scoperto) {
    return tile({ href: '#/negozio', lead: icon('cart'), leadKind: 'warn',
      title: t('Rosa bloccata: mancano {n} crediti', { n: n.scoperto }),
      sub: t('Per completarla togli un giocatore caro dal Negozio: ti tornano i crediti che l\'avevi pagato.') });
  }
  if (!n.aperto) {
    // 037: finestra passata, ma la rosa a meta' si puo' ancora completare —
    // ed e' l'unico modo di tornare a consegnare la formazione.
    return tile({ href: '#/negozio', lead: icon('cart'), leadKind: 'warn',
      title: t('Rosa incompleta: {n} da prendere', { n: n.mancanti }),
      sub: t('Senza rosa completa la formazione non si consegna. Completala dal Negozio.') });
  }
  return `<a class="negozio-cta" href="#/negozio" data-negozio>
    <i>${icon('cart')}</i>
    <span class="txt"><b>${t('Costruisci la tua rosa')}</b>
      <span>${n.mancanti === 25 ? t('Scegli i tuoi 25 giocatori') : n.mancanti === 1 ? t('Manca 1 giocatore') : t('Mancano {n} giocatori', { n: n.mancanti })} · ${plurale(n.crediti, t('credito'), t('crediti'))}${quando ? ` · ${t('fino a {quando}', { quando })}` : ''}</span></span>
    <span class="chev">${icon('chev', 'ic sm')}</span></a>`;
}

function invitoPubblica() {
  const primo = (pr) => (pr || []).slice().sort((a, b) => a.posto - b.posto)[0];
  const fascia = (href, titolo, riga, sotto, extra = '') => `<a class="invito" href="${href}"${extra}>
    <i>${pic('trofei', 'lega')}</i>
    <span class="txt"><b>${titolo}</b><span>${riga}</span>${sotto ? `<span class="sot">${sotto}</span>` : ''}</span>
    <span class="chev">${icon('chev', 'ic sm')}</span></a>`;

  if (S.legaPubblica()) {
    const premio = primo(S.premi());
    const squadre = S.base.managers.length;
    if (premio) {
      return fascia('#/classifica', t('Montepremi: {premio}', { premio: premioHtml(premio.premio) }),
        t('Sei in gara per il montepremi finale'),
        `${plurale(squadre, t('squadra'), t('squadre'))} · ${t('vince chi fa più punti')}`);
    }
    if (!S.isLeagueAdmin()) return '';
    return fascia('#/classifica', t('Montepremi da definire'),
      t('Mettilo in palio tu: lo vedranno tutti qui'),
      t('lega pubblica · aperta a tutti senza codice'));
  }

  const l = S.pubblicaInVetrina();
  if (!l) return '';
  const premio = primo(l.premi);
  const squadre = plurale(l.membri, t('squadra'), t('squadre'));
  // Iscritto ma con la lega privata davanti: il banner non invita a entrare
  // dove sei già, ti ci porta. data-vai lo raccoglie il mount qui sotto e
  // cambia lega.
  if (l.dentro) {
    return fascia('#/leghe', premio ? t('Montepremi: {premio}', { premio: premioHtml(premio.premio) }) : t('La tua lega pubblica'),
      premio ? t('Sei in gara per il montepremi finale') : t('Ci sei dentro: vai a giocare'),
      t('{lega} · {squadre} · tocca per andarci', { lega: esc(l.name), squadre }), ` data-vai="${esc(l.id)}"`);
  }
  // data-entra: chi tocca il banner vuole entrare in questa lega, non vedere
  // l'elenco delle leghe.
  return fascia('#/leghe', premio ? t('In palio: {premio}', { premio: premioHtml(premio.premio) }) : t('Lega pubblica aperta a tutti'),
    premio ? t('Entra e competi per il montepremi finale') : t('Entra: ognuno si fa la sua rosa'),
    t('{lega} · {squadre} · senza codice', { lega: esc(l.name), squadre }),
    ` data-entra="${esc(l.id)}"`);
}

/**
 * Una giornata cominciata e non ancora calcolata: i punteggi ci sono gia',
 * manca dire che sono definitivi.
 *
 * Sta in una scheda sua e non dentro la card della giornata corrente, perche'
 * sono due cose di due momenti diversi: una guarda avanti (schiera), questa
 * guarda indietro (chiudi). Tenerle insieme obbligava la card a mostrare una
 * giornata passata, con la sua data di chiusura scaduta.
 *
 * Il tasto lo vedono tutti — se no la lega resta in sospeso ad aspettare una
 * persona — ma resta spento finche' manca all'appello anche una sola partita:
 * l'art. 9.2 non ammette rettifiche dopo la chiusura.
 */
function daCalcolare(ph, bloccato = null) {
  // Una giornata che si sta ancora giocando non si puo' chiudere: il tasto
  // sarebbe spento e la scheda ripeterebbe quello che la card qui sotto dice
  // gia' — "mancano cinque partite". Torna quando c'e' davvero da fare.
  if (bloccato && bloccato.inGioco === ph.matchday) return '';
  const q = S.giornataDaChiudere(ph.matchday);
  if (!q) return '';
  return sec(t('Da calcolare'), t('{n}ª giornata', { n: q.giornata })) + `<div class="mcard">
    <p class="mnota">${q.presto
    ? t('Si calcola da {giorno} alle {ora}: prima la FSGC completa i referti, con cambi e cartellini', { giorno: dateIt(q.da), ora: timeIt(q.da) })
    : q.pronta
      ? t('Tutte le {n} partite hanno gli eventi: da qui i punteggi diventano definitivi', { n: q.partite })
      : t('Mancano gli eventi di {n} partite su {tot}', { n: q.mancanti, tot: q.partite })}</p>
    <div class="mact"><button class="a-btn big" id="chiudi-giornata"${q.pronta ? '' : ' disabled'}>${icon('lock', 'ic sm')}${t('Calcola la giornata')}</button></div>
    <a class="mcta" href="#/voti/${q.giornata}">${pic('voti', 'menu', 'mini')}${t('Voti della {n}ª', { n: q.giornata })}${icon('chev', 'ic sm')}</a>
  </div>`;
}

/**
 * La giornata corrente in una lega a punti: non c'e' un avversario da
 * mostrare, c'e' quanto vale la tua giornata e a che posto ti mette.
 *
 * Il posto e' quello che in una lega pubblica si guarda per primo: contro
 * duecento squadre il proprio punteggio da solo non dice niente.
 */
function correntePunti(n, me, bloccato = null) {
  const md = S.matchday(n); const st = S.matchdayStatus(n);
  const aperta = st === 'open' || st === 'scheduled';
  const saved = S.savedLineup(n, me.id);
  const cls = S.standings(); const mio = cls.find((r) => r.managerId === me.id);
  const punti = aperta ? null : S.puntiGiornata(n, me.id);
  const cta = aperta
    ? tasto('#/rosa/formazione', saved ? t('Modifica la formazione') : t('Inserisci formazione'))
    : tasto(`#/voti/${n}`, t('Voti della giornata'));
  const nota = aperta
    ? (saved
      ? t('Formazione salvata {data} · si chiude {giorno} alle {ora}', { data: dateIt(saved.submittedAt), giorno: dateIt(md.lockAt), ora: timeIt(md.lockAt) })
      : t('Si chiude {giorno} alle {ora} — senza consegna questa giornata vale zero', { giorno: dateIt(md.lockAt), ora: timeIt(md.lockAt) }))
    : bloccato ? attesaProssima(bloccato) : '';
  return sec(t('Giornata corrente'), t('{n}ª giornata', { n })) + `<div class="mcard">
    <div class="mrow punti">
      <span class="pblocco"><b>${punti === null ? '—' : fmt(punti)}</b><span>${punti === null ? t('da giocare') : t('punti in giornata')}</span></span>
      <span class="pblocco"><b>${mio ? mio.position : '–'}</b><span>${t('posto su {n}', { n: cls.length })}</span></span>
      <span class="pblocco"><b>${mio ? fmt(mio.punti) : '0'}</b><span>${t('punti totali')}</span></span>
    </div>
    ${nota ? `<p class="mnota">${esc(nota)}</p>` : ''}
    <div class="mact">${cta}</div>
    <a class="mcta" href="#/classifica">${pic('classifica', 'lega', 'mini')}${t('Classifica e premi')}${icon('chev', 'ic sm')}</a>
  </div>`;
}

/** Le lettere dell'esito in spagnolo: ganado, perdido, empate. */
const LETTERA_ES = { v: 'G', p: 'P', n: 'E' };

/** Gli ultimi cinque incontri di lega: avversaria, esito e risultato. */
function ultimiCinque(last, me) {
  if (!last.length) return '';
  return sec(t('Ultimi 5 incontri'), last.length < 5 ? t('{n} giocate', { n: last.length }) : '') + `<div class="a-card last5">
    ${last.map((r) => {
    const home = r.homeManagerId === me.id;
    const opp = S.managersById.get(home ? r.awayManagerId : r.homeManagerId);
    const gf = home ? r.homeGoals : r.awayGoals, gs = home ? r.awayGoals : r.homeGoals;
    const k = gf > gs ? 'v' : gf < gs ? 'p' : 'n';
    return `<a class="l5" href="#/live/${r.id}"><i class="${k}">${lingua() === 'es' ? LETTERA_ES[k] : k.toUpperCase()}</i>${crest(opp, 'sm')}
      <span class="nm"><b>${esc(opp.teamName)}</b><span>${home ? t('in casa') : t('in trasferta')} · ${t('giornata {n}', { n: r.matchday })}</span></span>
      <span class="sc"><b>${gf}–${gs}</b><span>${fmt(home ? r.homeScore : r.awayScore)}–${fmt(home ? r.awayScore : r.homeScore)}</span></span>
      ${icon('chev', 'ic sm')}</a>`;
  }).join('')}</div>`;
}

/**
 * Le prossime partite vere del campionato, in una fila che scorre: è il pezzo
 * di contesto che mancava, e viene dal calendario FSGC, non dalla lega.
 */
/** Gli highlights della giornata piu' recente che ne ha. Copertina disegnata
 *  in casa: la home non contatta Google per il solo fatto di essere aperta. */
function highlights() {
  for (const k of giornateConVideo()) {
    const l = videoGiornata(S.matchesOf(k));
    if (!l.length) continue;
    const riga = ({ m, v }) => { const h = S.clubsById.get(m.homeClubId), a = S.clubsById.get(m.awayClubId);
      return `<a class="vh" href="#/video" data-apri-video="${esc(v.id)}"><span class="vh-p">${icon('play', 'ic sm')}</span>
        <span class="vh-t"><b>${esc(h.name)} — ${esc(a.name)}</b>${m.status === 'played' ? `<span>${m.homeGoals} – ${m.awayGoals}</span>` : ''}</span></a>`; };
    return sec(t('Highlights'), t('{n}ª giornata', { n: k })) + `<div class="a-card vhs">${l.slice(0, 4).map(riga).join('')}
      <a class="vh tutti" href="#/video"><span class="vh-t"><b>${t('Tutti i video')}${l.length > 4 ? ` (${l.length})` : ''}</b></span>${icon('chev', 'ic sm')}</a></div>`;
  }
  return '';
}

function prossimePartite(ph) {
  const cerca = (n) => (n && n <= 30 ? S.matchesOf(n).filter((m) => m.status === 'scheduled') : []);
  let n = ph.matchday; let ms = cerca(n);
  if (!ms.length) { n = ph.next; ms = cerca(n); }
  if (!ms.length) return '';
  const cl = (id) => S.clubsById.get(id);
  return sec(t('Prossime partite'), t('{n}ª giornata', { n })) + `<div class="upcoming">${ms.slice(0, 6).map((m) => {
    const h = cl(m.homeClubId), a = cl(m.awayClubId); const k = m.kickoffAt ? new Date(m.kickoffAt) : null;
    return `<a class="up" href="#/calendario/${n}">
      <span class="when">${k ? `${dateIt(k)} · ${timeIt(k)}` : t('{n}ª giornata', { n })}</span>
      <span class="teams">
        <span class="t">${crest({ color: h.color, initials: h.shortName }, 'sm')}<b>${esc(h.name)}</b></span>
        <em>VS</em>
        <span class="t">${crest({ color: a.color, initials: a.shortName }, 'sm')}<b>${esc(a.name)}</b></span>
      </span>
      ${m.venue ? `<span class="where">${esc(m.venue)}</span>` : ''}</a>`;
  }).join('')}</div>`;
}

/**
 * Anteprima della classifica di lega, con la propria riga sempre inclusa.
 *
 * Rifatta il 9/10 (Alex: "modificami la visualizzazione della classifica"):
 * il podio ha le medaglie; sotto i punti c'e' il distacco dal primo invece
 * della parola "punti" ripetuta in ogni riga; una barra sottile dice a colpo
 * d'occhio quanto manca; le frecce dicono chi si e' mosso nell'ultima
 * giornata (solo chi si e' mosso: cinque "=" in fila sarebbero rumore); la
 * propria riga ha "TU" e il filo oro. Le regole (chi prende la medaglia,
 * quando non si mostra niente) stanno in anteprimaClassifica, nel motore.
 */
function classificaBreve(me) {
  const st = S.standings(); if (st.length < 2) return '';
  const n = S.currentMatchday();
  return anteprimaClassificaHtml({ st, prima: S.standingsPrima(n), aPunti: S.aPunti(), meId: me.id, squadra: (id) => S.managersById.get(id), n });
}

/** Il disegno dell'anteprima, dai dati: separato perche' si possa guardare con una classifica qualsiasi. */
export function anteprimaClassificaHtml({ st, prima, aPunti, meId, squadra, n }) {
  const scrivi = (v) => (aPunti ? fmt(v) : String(v));
  const { partita, righe } = anteprimaClassifica(st, (r) => (aPunti ? r.punti : r.points), meId);
  const mosse = movimenti(prima, st);
  return sec(t('Classifica'), `${n >= 1 ? `${t('{n}ª giornata', { n })} · ` : ''}${t('{n} squadre', { n: st.length })}`) + `<a class="a-card lead" href="#/classifica">
    ${righe.map((r) => { const m = squadra(r.managerId); const d = mosse.get(r.managerId);
      const sotto = !partita ? `<span class="gap">${t('punti')}</span>`
        : r.distacco === 0 ? `<span class="gap testa">${t('in testa')}</span>`
          : `<span class="gap" aria-label="${t('a {d} dal primo', { d: scrivi(r.distacco) })}">−${scrivi(r.distacco)}</span>`;
      return `<span class="lrow${r.io ? ' io' : ''}">
        <span class="lpos"><i class="pos${r.podio ? ` m${r.podio}` : ''}">${r.position}</i>${d ? freccia(d) : ''}</span>${crest(m, 'sm')}
        <span class="nm"><span class="lnm"><b>${esc(m.teamName)}</b>${r.io ? `<em class="tu">${t('tu')}</em>` : ''}</span><span class="own">${esc(m.owner)}</span>
          ${partita ? `<span class="lbar"><i style="width:${Math.round(r.quota * 100)}%"></i></span>` : ''}</span>
        <span class="pt"><b>${scrivi(r.valore)}</b>${sotto}</span></span>`; }).join('')}
    <span class="lcta">${t('Classifica completa')}${icon('chev', 'ic sm')}</span></a>`;
}

/** Notizie vere del campionato: la prima in grande, le altre in riga. */
const quando = (iso) => {
  if (!iso) return '';
  const d = new Date(iso); const ore = (Date.now() - d) / 3600000;
  if (ore < 1) return t('poco fa');
  if (ore < 24) return t('{n} h fa', { n: Math.round(ore) });
  if (ore < 48) return t('ieri');
  return dateIt(d);
};

/** L'ultima notizia su una riga sola, appena sotto le statistiche. */
function notiziaBreve() {
  const n = N.disponibili()[0]; if (!n) return '';
  return `<a class="nflash" href="${esc(n.link)}" target="_blank" rel="noopener noreferrer" data-it-ok>
    <span class="tag">${esc(quando(n.data) || N.fonte())}</span><b>${esc(n.titolo)}</b></a>`;
}

/** Notizie vere del campionato: la prima e' gia' andata nella riga in cima. */
function notizie() {
  const list = N.disponibili().slice(1); if (!list.length) return '';
  const meta = (n) => `${esc(quando(n.data))}${n.data ? ' · ' : ''}${esc(N.fonte())}`;
  const [prima, ...altre] = list.slice(0, 5);
  const grande = `<a class="nbig" href="${esc(prima.link)}" target="_blank" rel="noopener noreferrer" data-it-ok>
    ${prima.foto ? `<span class="ph"><img src="${esc(prima.foto)}" alt="" decoding="async"></span>` : ''}
    <span class="tx"><b>${esc(prima.titolo)}</b>${prima.sommario ? `<span>${esc(prima.sommario)}</span>` : ''}<em>${meta(prima)}</em></span></a>`;
  const righe = altre.map((n) => `<a class="ni" href="${esc(n.link)}" target="_blank" rel="noopener noreferrer" data-it-ok>
    ${n.fotoMini || n.foto ? `<span class="th"><img src="${esc(n.fotoMini || n.foto)}" alt="" loading="lazy" decoding="async"></span>` : ''}
    <span class="tx"><b>${esc(n.titolo)}</b><em>${meta(n)}</em></span></a>`).join('');
  return sec(t('Notizie'), esc(N.fonte())) + grande + `<div class="news">${righe}
    <a class="lcta" href="https://www.sanmarinortv.sm/sport/calcio-sammarinese-c15" target="_blank" rel="noopener noreferrer">${t('Tutte le notizie su {fonte}', { fonte: esc(N.fonte()) })}${icon('out', 'ic sm')}</a></div>`;
}

/**
 * LA COPERTINA. Il Titano di notte con le tre torri, e sotto, al centro, la
 * squadra: lo stemma (o il personaggio scelto), il nome, l'allenatore. Poi i
 * numeri e tre azioni scritte per esteso.
 *
 * Prima era una vetrina sull'impaginazione di un'altra app — targa della lega,
 * maglia sotto i riflettori con le bandierine, tre bottoni tondi di lato e la
 * card dei numeri che risaliva sopra. Alex, 24/10: rifatta perche' fosse
 * nostra, e con lo stemma al posto della maglia, che era il loro segno.
 */
function copertina(me, row, ph) {
  const foto = S.store.get().sfondoFoto;
  // Dopo il tramonto il Titano di notte (Alex, 12/11): si decide a ogni
  // disegno della home, senza timer.
  const notte = foto && eNotte();
  const numeri = S.aPunti()
    // A punti "Punti" e "Fantapunti" sarebbero lo stesso numero due volte:
    // al suo posto la media, che dice come stai andando e non solo quanto hai
    // accumulato — con due giornate in meno un totale basso non vuol dire
    // niente.
    ? [[fmt(row.punti), t('Punti')], [row.played, t('Giornate')], [fmt(row.media || 0), t('Media')]]
    : [[row.points, t('Punti')], [row.played, t('Partite')], [fmt(row.fantapunti), t('Fantapunti')]];
  return `<div class="a-herowrap">
    <div class="a-hero${foto ? ' foto' : ''}${notte ? ' notte' : ''}">
      ${foto ? `<span class="sfondo"><img src="media/sfondo-titano${notte ? '-notte' : ''}.jpg" alt="" fetchpriority="high"><i></i></span>` : logo('tw')}
      <a class="hero-league" href="#/leghe">
        <span><b>${esc(S.base.league.name)}</b>
        <small>${plurale(S.base.managers.length, t('squadra'), t('squadre'))} · ${t('{n}ª giornata', { n: ph.next })}</small></span>${icon('chev', 'ic sm')}</a>
      <a class="hero-stemma${scelto(me) ? ' pers' : ''}" href="#/squadra" aria-label="${t('Modifica stemma e personaggio')}">
        ${scelto(me) ? personaggio(scelto(me)) : crest(me, 'hero')}</a>
      <div class="hero-chi">
        <h2>${esc(me.teamName)}</h2>
        <p class="hero-owner">${esc(me.owner)}</p>
        <a class="hero-marchio" href="#/regolamento">${logo()}<span>Voto Titano</span></a>
      </div>
      <div class="a-stats">
        <div><b>${row.position}<sup>ª</sup></b><span>${t('Posizione')}</span></div>
        ${numeri.map(([n, l]) => `<div><b>${n}</b><span>${l}</span></div>`).join('')}
      </div>
      <div class="hero-azioni">
        <a href="#/scheda">${icon('share', 'ic sm')}<span>${t('Condividi')}</span></a>
        <a href="#/squadra">${icon('shirt', 'ic sm')}<span>${t('La mia squadra')}</span></a>
        <a href="#/mercato">${icon('cart', 'ic sm')}<span>${t('Mercato')}</span></a>
      </div>
    </div>
  </div>`;
}

export const dashboard = {
  title: 'Home',
  render() {
    const me = S.me(); const ph = S.weekPhase();
    if (!me) return `<main class="a-body"><div class="empty">${logo()}<p>${t('Non fai parte di questa lega.')}</p><a class="a-btn" href="#/leghe" style="text-decoration:none">${t('Le mie leghe')}</a></div></main>`;
    const st = S.standings(); const row = st.find((r) => r.managerId === me.id) || { position: '–', points: 0, punti: 0, played: 0, fantapunti: 0 };
    const noRoster = S.rosterIds(me.id).length === 0;
    // Le mie giocate finora: l'ultima e' la "giornata precedente", le cinque in
    // fondo sono lo storico. La corrente e' quella ancora da giocare.
    const mie = S.resultsUntil(ph.matchday).filter((r) => r.homeManagerId === me.id || r.awayManagerId === me.id);
    const last = mie.slice(-5).reverse();
    const ultima = mie[mie.length - 1] || null;
    // LA CARD E' LA GIORNATA CHE DEVI GIOCARE, sempre: quella ancora aperta.
    //
    // Prima faceva due lavori in uno — schierare prima del lock e calcolare
    // dopo — e per farli seguiva nextMatchday(), che era "l'ultima con dei
    // dati". Senza voti caricati restava indietro: il 17 settembre, con tre
    // giornate giocate, annunciava "Giornata 1 · si chiude ven 28/8", una data
    // di tre settimane prima.
    //
    // I due lavori sono di due persone diverse: schierare e' del giocatore,
    // calcolare e' di chi tiene i conti della lega. Il secondo ha una scheda
    // sua (daCalcolare), che compare solo quando c'e' da fare.
    // UNA GIORNATA PER VOLTA. Finche' quella in corso non e' finita la card
    // resta sua: prima annunciava "Giornata corrente · 5ª" con dentro
    // "INSERISCI FORMAZIONE" mentre la 4ª aveva ancora cinque partite da
    // giocare. La prossima arriva quando questa ha finito.
    const bloccato = S.schieramentoBloccato();
    const nCur = bloccato ? bloccato.inGioco : ph.next;
    const cur = nCur <= 30 ? S.myFixture(nCur, me.id) : null;
    const riposo = !cur && nCur <= 30 && S.base.managers.length > 1;
    const [art, titolo, testo] = RULES[Math.floor(Date.now() / 86400000) % RULES.length];

    return `<main class="a-body home">
      <div id="install-slot"></div>
      ${copertina(me, row, ph)}
      ${cartaGioco('su')}
      ${invitoNegozio()}
      ${notiziaBreve()}
      ${invitoPubblica()}
      ${fasciaSponsor()}
      ${S.aPunti() ? '' : conclusa(ultima)}
      ${daCalcolare(ph, bloccato)}
      ${S.aPunti() ? correntePunti(Math.min(30, nCur), me, bloccato) : corrente(cur, nCur, me, riposo, bloccato)}
      ${noRoster && !S.legaPubblica() ? tile({ href: S.isLeagueAdmin() ? '#/lega' : '#/leghe', lead: icon('warn'), leadKind: 'warn',
          title: t('Rose non ancora assegnate'),
          sub: S.isLeagueAdmin() ? t('Generale o inserirle dalla gestione lega') : t("Le assegna l'admin della lega dopo l'asta") }) : azione(ph, bloccato)}
      ${richiestaPromemoria()}
      ${invitoCalciatori()}
      ${ultimiCinque(last, me)}
      ${prossimePartite(ph)}
      ${lockDaSistemare()}
      ${scambiDaDecidere()}
      ${daConsegnare()}
      ${classificaBreve(me)}
      ${cartaGioco('giu')}
      ${highlights()}
      ${notizie()}
      ${sec(t('Dal regolamento'))}
      <div class="rule"><span class="art">${art}</span><p><b>${t(titolo)}.</b> ${t(testo)}</p></div>
    </main>`;
  },
  mount(root, ctx) {
    // La notifica di sistema all'apertura: e' quella che il foglio delle
    // impostazioni promette da sempre. Una per giornata, e solo se il permesso
    // c'e' — non lo si chiede qui, si chiede dalle impostazioni.
    const d = S.store.get();
    if (d.avvisi !== false) {
      AV.avvisaFormazione(S.promemoriaFormazione(), {
        giaAvvisato: d.avvisatoPer,
        segna: (n) => S.store.set({ avvisatoPer: n }),
      }).catch(() => { /* notifiche negate o non disponibili: l'avviso in-app resta */ });
    }
    const slot = root.querySelector('#install-slot');
    const show = () => {
      if (S.store.get().installedDismissed || !slot) return;
      // Su iPhone l'evento beforeinstallprompt non arriva mai, quindi il banner
      // non compariva mai: si installa a mano, da Condividi. E la differenza non
      // e' solo lo schermo intero — le notifiche a telefono chiuso su iPhone
      // esistono SOLO con l'app installata, quindi senza questo passo la voce
      // "Preferenze notifiche" resta un interruttore senza bottone.
      if (!window.__installPrompt && AV.motivoNonSupportate() !== 'ios-nel-browser') return;
      // la scheda del promemoria dice gia' gli stessi passi, e meglio
      if (!window.__installPrompt && root.querySelector('.chiedi-push.ios')) return;
      const ios = !window.__installPrompt;
      slot.innerHTML = `<div class="install">${logo()}<div style="flex:1"><b>${t('Installa l\'app')}</b>${ios
        ? t('Tocca <b>Condividi</b> in basso, poi <b>Aggiungi alla schermata Home</b>: si apre a tutto schermo e arrivano le notifiche.')
        : t('Sulla schermata Home si apre a tutto schermo.')}</div>${ios ? '' : `<button class="ok" id="inst-ok">${t('Installa')}</button>`}<button class="no" id="inst-no">✕</button></div>`;
      const ok = slot.querySelector('#inst-ok');
      if (ok) ok.onclick = async () => { const p = window.__installPrompt; if (!p) return; p.prompt(); await p.userChoice; window.__installPrompt = null; slot.innerHTML = ''; };
      slot.querySelector('#inst-no').onclick = () => { S.store.set({ installedDismissed: true }); slot.innerHTML = ''; };
    };
    show(); document.addEventListener('installable', show, { once: true });
    if (root.querySelector('.invito-calc')) S.contaBannerUnaVolta('visto');
    root.querySelector('.invito-calc')?.addEventListener('click', (e) => {
      if (e.target.closest('[data-calc="si"]')) { S.contaBannerUnaVolta('ci_gioco'); location.hash = '#/giocatori'; return; }
      if (e.target.closest('[data-calc="no"]')) { S.contaBannerUnaVolta('non_gioco'); S.store.set({ bannerCalciatori: true }); ctx.toast(t('Va bene, non lo mostro più')); }
    });
    root.querySelector('.chiedi-push')?.addEventListener('click', (e) => {
      const b = e.target.closest('[data-push]'); if (b) rispondi(b, ctx, () => ctx.render());
    });
    // Chiudere la giornata e' definitivo (art. 9.2), quindi si chiede conferma
    // e si aspetta il server prima di dire che e' fatta: se il database
    // rifiuta — giornata gia' chiusa, nessun evento — il messaggio e' il suo.
    const ch = root.querySelector('#chiudi-giornata');
    if (ch) ch.onclick = async () => {
      const q = S.giornataDaChiudere(); if (!q) return;
      if (!confirm(t('Calcolare la giornata {n}? I punteggi diventano definitivi e non si rettificano piu\'.', { n: q.giornata }))) return;
      ch.disabled = true;
      try { await S.chiudiGiornata(q.giornata); ctx.toast(t('Giornata {n} calcolata', { n: q.giornata })); }
      catch (e) { ctx.toast(e.message || t('Non e\' stato possibile calcolare la giornata')); ch.disabled = false; }
      ctx.render();
    };

    // "Condividi" sulla giornata conclusa: stesso testo della scheda, ma senza
    // uscire dalla dashboard.
    root.querySelector('[data-share]')?.addEventListener('click', async (e) => {
      const f = S.fixture(e.currentTarget.dataset.share); if (!f) return;
      const r = S.fixtureResult(f); const me = S.me(); const home = r.homeManagerId === me.id;
      const opp = S.managersById.get(home ? r.awayManagerId : r.homeManagerId);
      const text = t('{squadra} {gf}–{gs} {avversaria} · giornata {n} · {punti} fantapunti (Voto Titano) — {link}', {
        squadra: me.teamName, gf: home ? r.homeGoals : r.awayGoals, gs: home ? r.awayGoals : r.homeGoals, avversaria: opp.teamName,
        n: r.matchday, punti: fmt(home ? r.homeScore : r.awayScore), link: S.linkInvito() });
      if (navigator.share) { try { await navigator.share({ title: 'Fantatitano', text }); } catch { /* annullato */ } }
      else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    });
    // Il banner della lega pubblica porta dritto a entrare in QUELLA lega: qui
    // si segna quale, e la schermata delle leghe apre il modulo da sola. Non
    // e' un parametro nell'indirizzo perche' il router legge solo il percorso,
    // e sessionStorage muore con la scheda: se resta appeso non fa danni.
    root.querySelector('[data-entra]')?.addEventListener('click', (e) => {
      try { sessionStorage.setItem('fcs:entra-pubblica', e.currentTarget.dataset.entra); } catch { /* niente storage: si entra dall'elenco */ }
    });
    // Già iscritto: il banner cambia lega e resta sulla dashboard, che e' la
    // stessa cosa che si fa dal menu — due tocchi in meno.
    root.querySelector('[data-vai]')?.addEventListener('click', async (e) => {
      e.preventDefault();
      const id = e.currentTarget.dataset.vai;
      try { await S.switchLeague(id); ctx.go(''); } catch (err) { ctx.toast(err.message || t('Non ci sono riuscito')); }
    });
    // LO SPONSOR SI CONTA QUI, non dentro render(): render() gira anche per
    // disegnare una lista che e' cambiata, e conterebbe viste che nessuno ha
    // visto. Qui la fascia e' nel documento per davvero. Il resto della regola
    // — una sola vista per dispositivo al giorno — sta in S.contaSponsor.
    const spon = root.querySelector('.spon');
    if (spon) {
      S.contaSponsor(spon.dataset.sponsor, 'vista');
      // Il tocco si conta prima di uscire: il collegamento apre un'altra
      // scheda (target=_blank), quindi questa resta viva e la chiamata parte.
      spon.addEventListener('click', () => S.contaSponsor(spon.dataset.sponsor, 'tocco'));
    }
    N.carica(() => ctx.render());
    // Le leghe pubbliche: una volta per apertura, e si ridisegna quando
    // arrivano. Se non ce ne sono, il banner non compare e non si e' perso
    // niente.
    S.caricaPubbliche(() => ctx.render());
    // 'error' non risale: si ascolta in cattura. Una foto che non carica sparisce
    // insieme al suo riquadro, invece di lasciare l'icona di immagine rotta.
    root.addEventListener('error', (e) => {
      const img = e.target; if (img?.tagName !== 'IMG') return;
      const box = img.closest('.ph, .th'); if (box) box.remove();
    }, true);
  },
};
