import * as S from '../state.js';
import { esc, premioHtml, fmt, badge, crest, empty, icon, dateIt, timeIt, freccia, t, lingua } from '../ui.js';
import { movimenti, conversionParams } from '../engine.js';

let vista = 'classifica';
let contro = null;

const nomeSq = (id) => S.managersById.get(id)?.teamName || '—';
// V/N/P sono le iniziali italiane di vittoria, pareggio, sconfitta: in
// un'altra lingua si scrivono le sue (in spagnolo G/E/P).
const SIGLE = { V: 'sigla vittoria', N: 'sigla pareggio', P: 'sigla sconfitta' };
const sigla = (e) => (lingua() === 'it' || !SIGLE[e] ? e : t(SIGLE[e]));

/**
 * La classifica del Campionato Sammarinese, dai risultati FSGC (Alex, 10/10:
 * «anche in corso»). Durante una giornata comprende le gare gia' finite, e
 * lo dice; la forma sono le ultime cinque, dalla piu' vecchia alla piu'
 * recente.
 */
function campionato() {
  const c = S.classificaCampionato();
  if (!c.gare) return empty(t('Il campionato non ha ancora risultati: la classifica compare dopo le prime partite.'));
  const nota = c.inCorso
    ? `<div class="warn info">${icon('clock', 'ic sm')}<span>${t(c.inCorso.fatte === 1 ? '<b>Classifica di adesso.</b> Comprende la {g}ª giornata, ancora in corso: {fatte} partita giocata su {totali}.' : '<b>Classifica di adesso.</b> Comprende la {g}ª giornata, ancora in corso: {fatte} partite giocate su {totali}.', { g: c.inCorso.giornata, fatte: c.inCorso.fatte, totali: c.inCorso.totali })}</span></div>`
    : '';
  const forma = (f) => f.map((e) => `<i class="fm fm-${e.toLowerCase()}" title="${e === 'V' ? t('vittoria') : e === 'N' ? t('pareggio') : t('sconfitta')}">${sigla(e)}</i>`).join('');
  return `${nota}
    <div class="a-sec"><b>${t('Campionato Sammarinese')}</b><span>${c.inCorso ? t('{g}ª in corso', { g: c.inCorso.giornata }) : t('dopo la {n}ª giornata', { n: c.ultima })}</span></div>
    <div class="cls camp">${c.righe.map((r) => `<div class="crow">
      <i class="pos">${r.pos}</i>${crest({ color: r.club.color, initials: r.club.shortName }, 'sm')}
      <span class="nm"><b>${esc(r.club.name)}</b><span>${t('{g} G · {v}V {n}N {p}P · {gf}–{gs}', { g: r.g, v: r.v, n: r.n, p: r.p, gf: r.gf, gs: r.gs })}</span>${r.forma.length ? `<span class="forma">${forma(r.forma)}</span>` : ''}</span>
      <span class="pt"><b>${r.pt}</b><span>${t('punti')}</span></span></div>`).join('')}</div>
    <p class="tie">${t('Risultati della FSGC · 3 punti la vittoria, 1 il pareggio · a pari punti: differenza reti, poi gol fatti.')}</p>`;
}

/**
 * I record della lega. In una lega fra amici e' la parte di cui si discute
 * tutto l'anno — "il mio 82,5 della seconda" vale piu' di mezza classifica —
 * ed erano tutti dati che c'erano gia' e che nessuno metteva insieme.
 */
function record() {
  const r = S.record();
  if (r.vuoto) return `<div class="a-card"><p class="small muted">${t("I record compaiono quando c'è almeno una giornata conclusa.")}</p></div>`;
  const scheda = (etichetta, chi, valore, sotto) => `<div class="rec">
    <span class="et">${etichetta}</span><b class="val">${valore}</b>
    <span class="chi">${esc(nomeSq(chi))}</span><span class="dove">${sotto}</span></div>`;
  const s5 = (esiti) => esiti.slice(-5).map((e) => `<i class="e ${e.toLowerCase()}">${sigla(e)}</i>`).join('');
  const strisce = r.strisce.filter((x) => x.vittorie > 0).slice(0, 3);

  // UNA SCHEDA COMPARE SOLO SE HA QUALCOSA DA DIRE.
  //
  // Con una giornata sola giocata "miglior punteggio" e "peggior punteggio"
  // sono lo stesso fatto, con lo stesso numero, la stessa squadra e la stessa
  // giornata: due schede identiche una accanto all'altra. E una "vittoria piu'
  // larga +0" non e' una vittoria, e' un pareggio; "piu' gol in una giornata:
  // 0" non e' un record, e' l'assenza di gol. Prima uscivano tutte e quattro
  // con degli zeri, e una schermata di zeri fa credere che qualcosa sia rotto.
  const schede = [scheda(t('Miglior punteggio'), r.migliore.managerId, fmt(r.migliore.punti), t('giornata {n}', { n: r.migliore.matchday }))];
  const unSoloPunteggio = r.migliore.managerId === r.peggiore.managerId
    && r.migliore.matchday === r.peggiore.matchday;
  if (!unSoloPunteggio) schede.push(scheda(t('Peggior punteggio'), r.peggiore.managerId, fmt(r.peggiore.punti), t('giornata {n}', { n: r.peggiore.matchday })));
  if (r.piuGol.gol > 0) schede.push(scheda(t('Più gol in una giornata'), r.piuGol.managerId, r.piuGol.gol, t('giornata {n}', { n: r.piuGol.matchday })));
  if (r.scarto.gol > 0) schede.push(scheda(t('Vittoria più larga'), r.scarto.vincitore, `+${r.scarto.gol}`, t('su {squadra}, giornata {n}', { squadra: esc(nomeSq(r.scarto.perdente)), n: r.scarto.matchday })));
  return `<div class="recs">${schede.join('')}</div>
    ${schede.length === 1 ? `<p class="small muted" style="margin:-2px 2px 0">${t('Una giornata sola: i record veri cominciano dalla seconda.')}</p>` : ''}
    ${strisce.length ? `<div class="a-sec"><b>${t('Strisce')}</b><span>${t('di fila')}</span></div>
      <div class="vlist">${strisce.map((x) => `<div class="vr">${crest(S.managersById.get(x.managerId), 'sm')}
        <span class="nm"><b>${esc(nomeSq(x.managerId))}</b><span>${t(x.vittorie === 1 ? '{n} vittoria di fila · {m} senza perdere' : '{n} vittorie di fila · {m} senza perdere', { n: x.vittorie, m: x.imbattuto })}</span></span>
        <span class="ultimi">${s5(x.esiti)}</span></div>`).join('')}</div>` : ''}
    <div class="a-card dett"><div class="dhead"><b>${t('Medie per giornata')}</b></div>
      <div class="drow cap"><span class="nm"></span><span class="v">${t('media')}</span><span class="v">${t('max')}</span><span class="v">${t('min')}</span></div>
      ${r.medie.map((m) => `<div class="drow${m.managerId === S.me()?.id ? ' io' : ''}"><span class="nm">${esc(nomeSq(m.managerId))}</span>
        <span class="v fp">${fmt(m.media)}</span><span class="v">${fmt(m.massimo)}</span><span class="v">${fmt(m.minimo)}</span></div>`).join('')}</div>`;
}

/** Lo storico contro una squadra: si scelgono dai chip. */
function scontri(con) {
  const me = S.me(); if (!me) return '';
  const altri = S.base.managers.filter((m) => m.id !== me.id);
  if (!altri.length) return '';
  const scelto = altri.some((m) => m.id === con) ? con : altri[0].id;
  const h = S.h2h(me.id, scelto);
  const chip = `<div class="scelte">${altri.map((m) => `<button class="chip${m.id === scelto ? ' on' : ''}" data-h2h="${m.id}">${esc(m.teamName)}</button>`).join('')}</div>`;
  if (!h.partite.length) {
    return `${chip}<div class="a-card"><p class="small muted">${t('Non vi siete ancora incontrati: il calendario vi mette insieme più avanti.')}</p></div>`;
  }
  return `${chip}
    <div class="a-card h2h"><div class="hbar">
      <span class="q v"><b>${h.v}</b><span>${t('vinte')}</span></span>
      <span class="q n"><b>${h.n}</b><span>${t('pari')}</span></span>
      <span class="q p"><b>${h.p}</b><span>${t('perse')}</span></span></div>
      <div class="hnum"><span>${t('gol <b>{a}–{b}</b>', { a: h.golA, b: h.golB })}</span><span>${t('fantapunti <b>{a}–{b}</b>', { a: fmt(h.puntiA), b: fmt(h.puntiB) })}</span></div></div>
    <div class="vlist"><div class="vhead">${t('Gli incontri')} <span>${h.partite.length}</span></div>
      ${h.partite.map((f) => { const casa = f.homeManagerId === me.id;
    const ga = casa ? f.homeGoals : f.awayGoals, gb = casa ? f.awayGoals : f.homeGoals;
    const pa = casa ? f.homeScore : f.awayScore, pb = casa ? f.awayScore : f.homeScore;
    return `<a class="vr" href="#/live/${f.id}" style="text-decoration:none">
        <span class="rl ${ga > gb ? 'rl-d' : ga < gb ? 'rl-a' : 'rl-c'}">${sigla(ga > gb ? 'V' : ga < gb ? 'P' : 'N')}</span>
        <span class="nm"><b>${t('Giornata {n}', { n: f.matchday })}</b><span>${casa ? t('in casa') : t('fuori')} · ${fmt(pa)} – ${fmt(pb)}</span></span>
        <span class="fv">${ga}–${gb}</span></a>`; }).join('')}</div>`;
}

/** Gli incontri della giornata, con il punteggio che c'e' adesso. */
function incontri(n) {
  const me = S.me();
  const righe = S.fixturesOf(n).map((f) => {
    const r = S.fixtureResult(f);
    const h = S.managersById.get(f.homeManagerId), a = S.managersById.get(f.awayManagerId);
    const mio = me && (f.homeManagerId === me.id || f.awayManagerId === me.id);
    return `<a class="gr${mio ? ' io' : ''}" href="#/live/${f.id}">
      <span class="gsq">${crest(h, 'sm')}<b>${esc(h.teamName)}</b></span>
      <span class="pt">${r.played ? `${r.homeGoals}<i>–</i>${r.awayGoals}` : '<i>vs</i>'}
        <small>${r.played ? (r.forfait ? t('a tavolino') : `${fmt(r.homeScore)} – ${fmt(r.awayScore)}`) : ''}</small></span>
      <span class="gsq osp"><b>${esc(a.teamName)}</b>${crest(a, 'sm')}</span></a>`;
  }).join('');
  return `<div class="giornata">${righe}</div>`;
}

/**
 * I premi in palio, con chi li sta vincendo adesso.
 *
 * Restano una promessa fra persone: l'app li scrive e li mostra, non li
 * gestisce e non li paga, e lo dice invece di lasciarlo capire.
 */
function premiCard({ vincitori = true } = {}) {
  const pr = S.premiOra();
  const admin = S.isLeagueAdmin();
  if (!pr.length) {
    return admin
      ? `<div class="a-card premi vuoti"><div class="ph"><b>${t('Premi')}</b></div>
          <p class="small muted">${t("Non c'è niente in palio. Puoi metterci quello che vuoi: una cena, una coppa, i diritti di sfottò per un anno.")}</p>
          <button class="a-btn sec" data-premi>${t('Metti in palio un premio')}</button></div>`
      : '';
  }
  // Finche' non si e' giocata una giornata sono tutti a zero, quindi "chi
  // vince adesso" sarebbe un pari merito fra tutti: un'informazione falsa,
  // meglio mostrare solo cosa c'e' in palio.
  const riga = (p) => {
    const chi = p.squadre.map((id) => S.managersById.get(id)).filter(Boolean);
    return `<div class="prow"><span class="pposto">${p.posto}º</span>
      <span class="ppre">${premioHtml(p.premio)}</span>
      ${vincitori ? `<span class="pchi">${chi.length ? chi.map((m) => esc(m.teamName)).join(', ') : `<i>${t('nessuno a questo posto')}</i>`}</span>` : '<span class="pchi"></span>'}</div>`;
  };
  return `<div class="a-card premi"><div class="ph"><b>${t('Premi in palio')}</b><span>${vincitori ? t('chi li vince se finisse adesso') : t('la classifica non è ancora partita')}</span></div>
    ${pr.map(riga).join('')}
    <p class="small muted">${t("I premi sono un accordo fra i partecipanti: l'app li scrive e li mostra, non li gestisce.")}</p>
    ${admin ? `<button class="a-btn sec" data-premi>${t('Modifica i premi')}</button>` : ''}</div>`;
}

/** La classifica di una lega pubblica: la somma dei fantapunti, e basta. */
function tabellaPunti(st, me, inCorso, mosse) {
  return `<div class="cls">${st.map((r) => { const m = S.managersById.get(r.managerId);
    const io = r.managerId === me?.id;
    // si tocca per vedere la sua formazione: in una lega a punti non ci sono
    // partite, e questo e' l'unico posto dove guardarla (#/formazione/:id)
    return `<a class="crow${io ? ' io' : ''}" href="#/formazione/${r.managerId}" aria-label="${t('Formazione di {squadra}', { squadra: esc(m.teamName) })}">
      <i class="pos">${r.position}</i>${inCorso ? freccia(mosse.get(r.managerId)) : ''}${crest(m, 'sm')}
      <span class="nm"><b>${esc(m.teamName)}</b><span>${esc(m.owner)} · ${t(r.played === 1 ? '{n} giornata' : '{n} giornate', { n: r.played })}</span></span>
      <span class="pt"><b>${fmt(r.punti)}</b><span>${t('punti')}</span></span>${icon('chev', 'ic sm cls-chev')}</a>`; }).join('')}</div>
    <p class="small muted" style="margin:-4px 2px 0">${t('Tocca una squadra per vedere la sua formazione: si vede dal lock della giornata.')}</p>
    <a class="a-btn sec" href="#/formazioni" style="text-decoration:none">${icon('users', 'ic sm')}${t('Le formazioni di tutti')}</a>
    <div class="a-card dett"><div class="dhead"><b>${t('Dettaglio')}</b><span>${t('giornate · media · migliore')}</span></div>
      ${st.map((r) => { const m = S.managersById.get(r.managerId);
    return `<div class="drow${r.managerId === me?.id ? ' io' : ''}"><span class="nm">${r.position}. ${esc(m.teamName)}</span>
        <span class="v">${r.played}</span><span class="v">${fmt(r.media)}</span><span class="v fp">${fmt(r.migliore)}</span></div>`; }).join('')}</div>
    <p class="tie">${t('<b>A pari punti</b> conta la giornata migliore; se è pari anche quella si resta pari merito, allo stesso posto. Chi non consegna la formazione fa zero in quella giornata (art. 8.4).')}</p>`;
}

export const classifica = {
  title: 'Classifica',
  render() {
    const me = S.me(); const n = S.currentMatchday(); const st = S.standings();
    const giocate = st.reduce((s, r) => s + r.played, 0);
    const stato = S.matchdayStatus(n);
    // "In corso" vuol dire: la giornata sta gia' dando punti ma non e' chiusa,
    // quindi quello che si legge e' una proiezione e va detto.
    const inCorso = stato === 'provisional' || stato === 'live';
    const av = S.avanzamento(n);
    const mosse = movimenti(S.standingsPrima(n), st);

    const avviso = inCorso ? `<div class="warn info">${icon('clock', 'ic sm')}<span>${t('<b>Proiezione.</b> La giornata {n} non è ancora congelata: {stato}. Le frecce dicono come ci si sta muovendo rispetto a prima della giornata.', { n, stato: av.totali ? t('{fatte} partite su {totali} hanno un risultato', { fatte: av.fatte, totali: av.totali }) : t('nessuna partita ha ancora un risultato') })}</span></div>` : '';

    // LA BARRA DELLE SCHEDE RESTA IN ALTO, il badge di stato scorre.
    //
    // Era il contrario, ed era al contrario: scorrendo la pagina la barra
    // Classifica/Giornata/Record finiva dietro l'app bar — misurati 63px
    // nascosti — mentre restava appiccicato il badge "CONGELATO · giornata 3".
    // Si perdeva la navigazione e restava l'informazione.
    //
    // E l'etichetta a destra del badge diceva "Record" mentre la scheda
    // "Record" era gia' accesa due centimetri sotto: due volte la stessa
    // parola, e una riga in meno di spazio per il resto. Via.
    const barra = (dentro, conStato = true) => `<div class="segwrap"><div class="seg seg-cls">${dentro}</div></div>
      ${conStato ? `<div class="statoriga">${badge(stato, t('giornata {n}', { n }))}</div>` : ''}`;
    // Il campionato vero sta accanto alla classifica della lega (Alex, 10/10):
    // chi gioca a Fantatitano guarda anche come vanno le squadre dei suoi.
    const tabCamp = `<button class="${vista === 'campionato' ? 'on' : ''}" data-vista="campionato">${t('Campionato')}</button>`;
    const seg = barra(`<button class="${vista === 'classifica' ? 'on' : ''}" data-vista="classifica">${t('Classifica')}</button>
      <button class="${vista === 'giornata' ? 'on' : ''}" data-vista="giornata">${t('Giornata {n}', { n })}</button>
      <button class="${vista === 'record' ? 'on' : ''}" data-vista="record">${t('Record')}</button>${tabCamp}`);
    // A punti la scheda "Giornata" non ha incontri da mostrare: si toglie
    // invece di aprire su una schermata vuota.
    const segPunti = barra(`<button class="${vista !== 'record' && vista !== 'campionato' ? 'on' : ''}" data-vista="classifica">${t('Classifica')}</button>
      <button class="${vista === 'record' ? 'on' : ''}" data-vista="record">${t('Record')}</button>${tabCamp}`);

    if (vista === 'campionato') {
      const btn = (v, testo) => `<button class="${vista === v ? 'on' : ''}" data-vista="${v}">${testo}</button>`;
      return `<main class="a-body">
        ${barra(`${btn('classifica', t('Classifica'))}${giocate && !S.aPunti() ? btn('giornata', t('Giornata {n}', { n })) : ''}${btn('record', t('Record'))}${tabCamp}`, false)}
        ${campionato()}
      </main>`;
    }

    // LA CLASSIFICA CHE NON C'E' ANCORA.
    //
    // Prima questo ramo uscìva PRIMA della barra, quindi con zero giornate
    // giocate spariva anche la navigazione: niente schede, niente Record, e
    // sembrava che la classifica fosse sparita. Adesso la barra resta e lo
    // schermo dice cosa manca — che non e' mai "il Giudice Dati non ha
    // pubblicato i voti", com'era scritto prima a prescindere.
    if (!giocate) {
      const md = S.matchday(S.primaGiornata());
      const soli = S.base.managers.length < 2;
      const testo = soli
        ? (S.legaPubblica()
          ? t('La classifica parte quando ci sono almeno due squadre: la lega è pubblica, chiunque può entrare dall\'elenco delle leghe.')
          : t('La classifica parte quando ci sono almeno due squadre: condividi il codice invito della lega.'))
        : S.primaGiornata() >= n && md && S.now() < new Date(md.lockAt)
          // La prima giornata della lega non e' ancora cominciata: e' il caso
          // di una lega appena nata, ed e' un'attesa, non un guasto.
          ? t('La lega parte dalla {n}ª giornata, che si chiude {data} alle {ora}. La classifica compare coi primi punteggi.', { n: S.primaGiornata(), data: dateIt(md.lockAt), ora: timeIt(md.lockAt) })
          : t('Nessuna giornata conclusa: la classifica compare quando arrivano i primi voti del campionato.');
      const azione = soli
        ? `<a class="a-btn" href="#/${S.legaPubblica() ? 'leghe' : 'lega'}" style="text-decoration:none">${S.legaPubblica() ? t('Vedi le leghe pubbliche') : t('Invita i partecipanti')}</a>`
        : S.schieramentoBloccato()
          ? `<a class="a-btn sec" href="#/voti/${S.schieramentoBloccato().inGioco}" style="text-decoration:none">${t('Voti della {n}ª', { n: S.schieramentoBloccato().inGioco })}</a>`
          : `<a class="a-btn sec" href="#/rosa/formazione" style="text-decoration:none">${t('Schiera la formazione')}</a>`;
      // Niente scheda "Giornata N" ne' badge di stato: in una lega che parte
      // dalla 5a dicevano "PROVVISORIO · giornata 4", cioe' lo stato di una
      // giornata che per questa lega non esiste.
      const vuota = barra(`<button class="${vista !== 'record' ? 'on' : ''}" data-vista="classifica">${t('Classifica')}</button>
      <button class="${vista === 'record' ? 'on' : ''}" data-vista="record">${t('Record')}</button>${tabCamp}`, false);
      return `<main class="a-body">
        ${vuota}
        ${S.aPunti() ? premiCard({ vincitori: false }) : ''}
        ${vista === 'record' ? record() : empty(testo, azione)}
      </main>`;
    }

    if (vista === 'record') {
      return `<main class="a-body">
        ${S.aPunti() ? segPunti : seg}
        <div class="a-sec"><b>${t('Record di lega')}</b><span>${t('fin qui')}</span></div>
        ${record()}
        ${S.aPunti() ? '' : `<div class="a-sec"><b>${t('Testa a testa')}</b><span>${t('i tuoi scontri')}</span></div>${scontri(contro)}`}
      </main>`;
    }

    // A punti non ci sono incontri: se si arriva qui con la vista "giornata"
    // — per esempio cambiando lega — si torna alla classifica invece di
    // mostrare una schermata vuota.
    if (vista === 'giornata' && !S.aPunti()) {
      return `<main class="a-body">
        ${seg}${avviso}${incontri(n)}
        <p class="tie">${t('Tocca un incontro per vedere i due campi, i voti e la panchina.')}</p>
      </main>`;
    }

    // Lega pubblica: nessun avversario, nessun gol, nessuno spareggio da
    // scontri diretti. Cambia la tabella e compaiono i premi.
    if (S.aPunti()) {
      return `<main class="a-body">
        ${segPunti}${avviso}
        ${premiCard()}
        ${tabellaPunti(st, me, inCorso, mosse)}
      </main>`;
    }

    return `<main class="a-body">
      ${seg}${avviso}
      <div class="cls">${st.map((r) => { const m = S.managersById.get(r.managerId);
        const io = r.managerId === me.id;
        return `<div class="crow${io ? ' io' : ''}">
          <i class="pos">${r.position}</i>${inCorso ? freccia(mosse.get(r.managerId)) : ''}${crest(m, 'sm')}
          <span class="nm"><b>${esc(m.teamName)}</b><span>${esc(m.owner)} · ${t('{v}V {n}N {p}P', { v: r.won, n: r.drawn, p: r.lost })}</span></span>
          <span class="pt"><b>${r.points}</b><span>${t('punti')}</span></span></div>`; }).join('')}</div>
      <div class="a-card dett"><div class="dhead"><b>${t('Dettaglio')}</b><span>${t('giocate · differenza reti · fantapunti')}</span></div>
        ${st.map((r) => { const m = S.managersById.get(r.managerId);
          return `<div class="drow${r.managerId === me.id ? ' io' : ''}"><span class="nm">${r.position}. ${esc(m.teamName)}</span>
            <span class="v">${r.played}</span><span class="v">${r.dr > 0 ? '+' : ''}${r.dr}</span><span class="v fp">${fmt(r.fantapunti)}</span></div>`; }).join('')}</div>
      <p class="tie">${t('<b>Spareggi</b> (art. 12.2): punti › fantapunti totali (FP) › differenza reti › scontri diretti.')}</p>
      ${(() => {
    // I parametri della conversione vengono dalle regole, non dal risultato
    // di una formazione: lineupResult() torna null a chi non ha consegnato
    // (art. 8.4) e questa riga andava in errore, portandosi via la
    // classifica intera. Sono un dato della lega, non di una squadra.
    const c = conversionParams(S.squadreConversione(), S.rules());
    return `<div class="a-card a-rule"><span class="art">Art. 11</span><p>${t(S.base.league.managerCount === 1 ? '<b>Conversione in gol:</b> con {n} fantallenatore il primo gol scatta a {soglia} e se ne aggiunge uno ogni {passo} punti. Parità di fantapunteggio = pareggio.' : '<b>Conversione in gol:</b> con {n} fantallenatori il primo gol scatta a {soglia} e se ne aggiunge uno ogni {passo} punti. Parità di fantapunteggio = pareggio.', { n: S.base.league.managerCount, soglia: fmt(c.threshold), passo: fmt(c.step) })}</p></div>`;
  })()}
    </main>`;
  },
  mount(root, ctx) {
    root.querySelector('main').addEventListener('click', (e) => {
      const h = e.target.closest('[data-h2h]');
      if (h) { contro = h.dataset.h2h; ctx.render(); return; }
      if (e.target.closest('[data-premi]')) { apriPremi(ctx); return; }
      const b = e.target.closest('[data-vista]'); if (!b) return;
      vista = b.dataset.vista; ctx.render();
    });
  },
};

/**
 * L'editor dei premi, per chi amministra la lega.
 *
 * Righe posto + descrizione, fino a dieci. La forma la ricontrolla il
 * database (premi_validi in 013): qui si guida, non si difende — le due cose
 * non sono la stessa e quella che conta e' la seconda.
 */
function apriPremi(ctx) {
  let righe = S.premi().length ? S.premi().map((p) => ({ ...p })) : [{ posto: 1, premio: '' }];
  const disegna = () => {
    ctx.sheet(`<h3>${t('Premi in palio')}</h3>
      <p class="auth-hint">${t("Quello che vince chi arriva in una certa posizione. È un accordo fra voi: l'app lo scrive e lo mostra, non lo gestisce.")}</p>
      <div id="pr-righe">${righe.map((r, i) => `<div class="pr-riga">
        <input class="field-input pr-posto" type="number" min="1" max="99" value="${r.posto}" aria-label="${t('Posto')}" inputmode="numeric">
        <input class="field-input pr-premio" value="${esc(r.premio)}" placeholder="${t('es. una cena offerta')}" maxlength="120" aria-label="${t('Premio')}">
        <button class="pr-via" data-via="${i}" aria-label="${t('Togli')}">${icon('trash', 'ic sm')}</button></div>`).join('')}</div>
      ${righe.length < 10 ? `<button class="a-btn sec" id="pr-piu" style="margin-top:8px">${t('Aggiungi un premio')}</button>` : `<p class="small muted">${t('Dieci premi sono il massimo.')}</p>`}
      <button class="a-btn" id="pr-salva" style="margin-top:10px">${t('Salva i premi')}</button>`);
    const sh = document.getElementById('sheet');
    // Si rilegge dai campi prima di ogni cosa: se no, aggiungere una riga
    // cancellava quello che era stato appena scritto nelle altre.
    const leggi = () => {
      righe = [...sh.querySelectorAll('.pr-riga')].map((d) => ({
        posto: parseInt(d.querySelector('.pr-posto').value, 10) || 1,
        premio: d.querySelector('.pr-premio').value,
      }));
    };
    sh.onclick = async (e) => {
      const via = e.target.closest('[data-via]');
      if (via) { leggi(); righe.splice(+via.dataset.via, 1); if (!righe.length) righe = [{ posto: 1, premio: '' }]; disegna(); return; }
      if (e.target.closest('#pr-piu')) {
        leggi();
        righe.push({ posto: Math.min(99, Math.max(...righe.map((r) => r.posto)) + 1), premio: '' });
        disegna(); return;
      }
      const salva = e.target.closest('#pr-salva');
      if (salva) {
        leggi();
        const puliti = righe.filter((r) => r.premio.trim());
        salva.disabled = true;
        try { await S.salvaPremi(puliti); ctx.sheet(null); ctx.toast(puliti.length ? t('Premi salvati') : t('Premi rimossi')); ctx.render(); }
        catch (err) { ctx.toast(err.message || t('Non è stato possibile salvare')); salva.disabled = false; }
      }
    };
  };
  disegna();
}
