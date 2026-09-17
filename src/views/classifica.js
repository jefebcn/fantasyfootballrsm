import * as S from '../state.js';
import { esc, fmt, badge, crest, empty, icon, dateIt, timeIt } from '../ui.js';
import { movimenti, conversionParams } from '../engine.js';

let vista = 'classifica';
let contro = null;

/** ▲2 / ▼1 / = rispetto a prima della giornata in corso. */
function freccia(d) {
  if (d === null) return '';
  if (d === 0) return '<i class="mv pari" aria-label="posizione invariata">=</i>';
  return `<i class="mv ${d > 0 ? 'su' : 'giu'}" aria-label="${d > 0 ? `sale di ${d}` : `scende di ${-d}`}">${d > 0 ? '▲' : '▼'}${Math.abs(d)}</i>`;
}

const nomeSq = (id) => S.managersById.get(id)?.teamName || '—';

/**
 * I record della lega. In una lega fra amici e' la parte di cui si discute
 * tutto l'anno — "il mio 82,5 della seconda" vale piu' di mezza classifica —
 * ed erano tutti dati che c'erano gia' e che nessuno metteva insieme.
 */
function record() {
  const r = S.record();
  if (r.vuoto) return `<div class="a-card"><p class="small muted">I record compaiono quando c'è almeno una giornata conclusa.</p></div>`;
  const scheda = (etichetta, chi, valore, sotto) => `<div class="rec">
    <span class="et">${etichetta}</span><b class="val">${valore}</b>
    <span class="chi">${esc(nomeSq(chi))}</span><span class="dove">${sotto}</span></div>`;
  const s5 = (esiti) => esiti.slice(-5).map((e) => `<i class="e ${e.toLowerCase()}">${e}</i>`).join('');
  const strisce = r.strisce.filter((x) => x.vittorie > 0).slice(0, 3);

  // UNA SCHEDA COMPARE SOLO SE HA QUALCOSA DA DIRE.
  //
  // Con una giornata sola giocata "miglior punteggio" e "peggior punteggio"
  // sono lo stesso fatto, con lo stesso numero, la stessa squadra e la stessa
  // giornata: due schede identiche una accanto all'altra. E una "vittoria piu'
  // larga +0" non e' una vittoria, e' un pareggio; "piu' gol in una giornata:
  // 0" non e' un record, e' l'assenza di gol. Prima uscivano tutte e quattro
  // con degli zeri, e una schermata di zeri fa credere che qualcosa sia rotto.
  const schede = [scheda('Miglior punteggio', r.migliore.managerId, fmt(r.migliore.punti), `giornata ${r.migliore.matchday}`)];
  const unSoloPunteggio = r.migliore.managerId === r.peggiore.managerId
    && r.migliore.matchday === r.peggiore.matchday;
  if (!unSoloPunteggio) schede.push(scheda('Peggior punteggio', r.peggiore.managerId, fmt(r.peggiore.punti), `giornata ${r.peggiore.matchday}`));
  if (r.piuGol.gol > 0) schede.push(scheda('Più gol in una giornata', r.piuGol.managerId, r.piuGol.gol, `giornata ${r.piuGol.matchday}`));
  if (r.scarto.gol > 0) schede.push(scheda('Vittoria più larga', r.scarto.vincitore, `+${r.scarto.gol}`, `su ${esc(nomeSq(r.scarto.perdente))}, giornata ${r.scarto.matchday}`));
  return `<div class="recs">${schede.join('')}</div>
    ${schede.length === 1 ? `<p class="small muted" style="margin:-2px 2px 0">Una giornata sola: i record veri cominciano dalla seconda.</p>` : ''}
    ${strisce.length ? `<div class="a-sec"><b>Strisce</b><span>di fila</span></div>
      <div class="vlist">${strisce.map((x) => `<div class="vr">${crest(S.managersById.get(x.managerId), 'sm')}
        <span class="nm"><b>${esc(nomeSq(x.managerId))}</b><span>${x.vittorie} ${x.vittorie === 1 ? 'vittoria' : 'vittorie'} di fila · ${x.imbattuto} senza perdere</span></span>
        <span class="ultimi">${s5(x.esiti)}</span></div>`).join('')}</div>` : ''}
    <div class="a-card dett"><div class="dhead"><b>Medie per giornata</b></div>
      <div class="drow cap"><span class="nm"></span><span class="v">media</span><span class="v">max</span><span class="v">min</span></div>
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
    return `${chip}<div class="a-card"><p class="small muted">Non vi siete ancora incontrati: il calendario vi mette insieme più avanti.</p></div>`;
  }
  return `${chip}
    <div class="a-card h2h"><div class="hbar">
      <span class="q v"><b>${h.v}</b><span>vinte</span></span>
      <span class="q n"><b>${h.n}</b><span>pari</span></span>
      <span class="q p"><b>${h.p}</b><span>perse</span></span></div>
      <div class="hnum"><span>gol <b>${h.golA}–${h.golB}</b></span><span>fantapunti <b>${fmt(h.puntiA)}–${fmt(h.puntiB)}</b></span></div></div>
    <div class="vlist"><div class="vhead">Gli incontri <span>${h.partite.length}</span></div>
      ${h.partite.map((f) => { const casa = f.homeManagerId === me.id;
    const ga = casa ? f.homeGoals : f.awayGoals, gb = casa ? f.awayGoals : f.homeGoals;
    const pa = casa ? f.homeScore : f.awayScore, pb = casa ? f.awayScore : f.homeScore;
    return `<a class="vr" href="#/live/${f.id}" style="text-decoration:none">
        <span class="rl ${ga > gb ? 'rl-d' : ga < gb ? 'rl-a' : 'rl-c'}">${ga > gb ? 'V' : ga < gb ? 'P' : 'N'}</span>
        <span class="nm"><b>Giornata ${f.matchday}</b><span>${casa ? 'in casa' : 'fuori'} · ${fmt(pa)} – ${fmt(pb)}</span></span>
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
        <small>${r.played ? (r.forfait ? 'a tavolino' : `${fmt(r.homeScore)} – ${fmt(r.awayScore)}`) : ''}</small></span>
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
      ? `<div class="a-card premi vuoti"><div class="ph"><b>Premi</b></div>
          <p class="small muted">Non c'è niente in palio. Puoi metterci quello che vuoi: una cena, una coppa, i diritti di sfottò per un anno.</p>
          <button class="a-btn sec" data-premi>Metti in palio un premio</button></div>`
      : '';
  }
  // Finche' non si e' giocata una giornata sono tutti a zero, quindi "chi
  // vince adesso" sarebbe un pari merito fra tutti: un'informazione falsa,
  // meglio mostrare solo cosa c'e' in palio.
  const riga = (p) => {
    const chi = p.squadre.map((id) => S.managersById.get(id)).filter(Boolean);
    return `<div class="prow"><span class="pposto">${p.posto}º</span>
      <span class="ppre">${esc(p.premio)}</span>
      ${vincitori ? `<span class="pchi">${chi.length ? chi.map((m) => esc(m.teamName)).join(', ') : '<i>nessuno a questo posto</i>'}</span>` : '<span class="pchi"></span>'}</div>`;
  };
  return `<div class="a-card premi"><div class="ph"><b>Premi in palio</b><span>${vincitori ? 'chi li vince se finisse adesso' : 'la classifica non è ancora partita'}</span></div>
    ${pr.map(riga).join('')}
    <p class="small muted">I premi sono un accordo fra i partecipanti: l'app li scrive e li mostra, non li gestisce.</p>
    ${admin ? '<button class="a-btn sec" data-premi>Modifica i premi</button>' : ''}</div>`;
}

/** La classifica di una lega pubblica: la somma dei fantapunti, e basta. */
function tabellaPunti(st, me, inCorso, mosse) {
  return `<div class="cls">${st.map((r) => { const m = S.managersById.get(r.managerId);
    const io = r.managerId === me?.id;
    return `<div class="crow${io ? ' io' : ''}">
      <i class="pos">${r.position}</i>${inCorso ? freccia(mosse.get(r.managerId)) : ''}${crest(m, 'sm')}
      <span class="nm"><b>${esc(m.teamName)}</b><span>${esc(m.owner)} · ${r.played} ${r.played === 1 ? 'giornata' : 'giornate'}</span></span>
      <span class="pt"><b>${fmt(r.punti)}</b><span>punti</span></span></div>`; }).join('')}</div>
    <div class="a-card dett"><div class="dhead"><b>Dettaglio</b><span>giornate · media · migliore</span></div>
      ${st.map((r) => { const m = S.managersById.get(r.managerId);
    return `<div class="drow${r.managerId === me?.id ? ' io' : ''}"><span class="nm">${r.position}. ${esc(m.teamName)}</span>
        <span class="v">${r.played}</span><span class="v">${fmt(r.media)}</span><span class="v fp">${fmt(r.migliore)}</span></div>`; }).join('')}</div>
    <p class="tie"><b>A pari punti</b> conta la giornata migliore; se è pari anche quella si resta pari merito, allo stesso posto. Chi non consegna la formazione fa zero in quella giornata (art. 8.4).</p>`;
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

    const avviso = inCorso ? `<div class="warn info">${icon('clock', 'ic sm')}<span><b>Proiezione.</b> La giornata ${n} non è ancora congelata: ${av.totali ? `${av.fatte} partite su ${av.totali} hanno un risultato` : 'nessuna partita ha ancora un risultato'}. Le frecce dicono come ci si sta muovendo rispetto a prima della giornata.</span></div>` : '';

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
    const barra = (dentro) => `<div class="segwrap"><div class="seg seg-cls">${dentro}</div></div>
      <div class="statoriga">${badge(stato, `giornata ${n}`)}</div>`;
    const seg = barra(`<button class="${vista === 'classifica' ? 'on' : ''}" data-vista="classifica">Classifica</button>
      <button class="${vista === 'giornata' ? 'on' : ''}" data-vista="giornata">Giornata ${n}</button>
      <button class="${vista === 'record' ? 'on' : ''}" data-vista="record">Record</button>`);
    // A punti la scheda "Giornata" non ha incontri da mostrare: si toglie
    // invece di aprire su una schermata vuota.
    const segPunti = barra(`<button class="${vista !== 'record' ? 'on' : ''}" data-vista="classifica">Classifica</button>
      <button class="${vista === 'record' ? 'on' : ''}" data-vista="record">Record</button>`);

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
          ? 'La classifica parte quando ci sono almeno due squadre: la lega è pubblica, chiunque può entrare dall\'elenco delle leghe.'
          : 'La classifica parte quando ci sono almeno due squadre: condividi il codice invito della lega.')
        : S.primaGiornata() >= n && md && S.now() < new Date(md.lockAt)
          // La prima giornata della lega non e' ancora cominciata: e' il caso
          // di una lega appena nata, ed e' un'attesa, non un guasto.
          ? `La lega parte dalla ${S.primaGiornata()}ª giornata, che si chiude ${dateIt(md.lockAt)} alle ${timeIt(md.lockAt)}. La classifica compare coi primi punteggi.`
          : 'Nessuna giornata conclusa: la classifica compare quando arrivano i primi voti del campionato.';
      const azione = soli
        ? `<a class="a-btn" href="#/${S.legaPubblica() ? 'leghe' : 'lega'}" style="text-decoration:none">${S.legaPubblica() ? 'Vedi le leghe pubbliche' : 'Invita i partecipanti'}</a>`
        : `<a class="a-btn sec" href="#/rosa/formazione" style="text-decoration:none">Schiera la formazione</a>`;
      return `<main class="a-body">
        ${S.aPunti() ? segPunti : seg}
        ${S.aPunti() ? premiCard({ vincitori: false }) : ''}
        ${vista === 'record' ? record() : empty(testo, azione)}
      </main>`;
    }

    if (vista === 'record') {
      return `<main class="a-body">
        ${S.aPunti() ? segPunti : seg}
        <div class="a-sec"><b>Record di lega</b><span>fin qui</span></div>
        ${record()}
        ${S.aPunti() ? '' : `<div class="a-sec"><b>Testa a testa</b><span>i tuoi scontri</span></div>${scontri(contro)}`}
      </main>`;
    }

    // A punti non ci sono incontri: se si arriva qui con la vista "giornata"
    // — per esempio cambiando lega — si torna alla classifica invece di
    // mostrare una schermata vuota.
    if (vista === 'giornata' && !S.aPunti()) {
      return `<main class="a-body">
        ${seg}${avviso}${incontri(n)}
        <p class="tie">Tocca un incontro per vedere i due campi, i voti e la panchina.</p>
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
          <span class="nm"><b>${esc(m.teamName)}</b><span>${esc(m.owner)} · ${r.won}V ${r.drawn}N ${r.lost}P</span></span>
          <span class="pt"><b>${r.points}</b><span>punti</span></span></div>`; }).join('')}</div>
      <div class="a-card dett"><div class="dhead"><b>Dettaglio</b><span>giocate · differenza reti · fantapunti</span></div>
        ${st.map((r) => { const m = S.managersById.get(r.managerId);
          return `<div class="drow${r.managerId === me.id ? ' io' : ''}"><span class="nm">${r.position}. ${esc(m.teamName)}</span>
            <span class="v">${r.played}</span><span class="v">${r.dr > 0 ? '+' : ''}${r.dr}</span><span class="v fp">${fmt(r.fantapunti)}</span></div>`; }).join('')}</div>
      <p class="tie"><b>Spareggi</b> (art. 12.2): punti › fantapunti totali (FP) › differenza reti › scontri diretti.</p>
      ${(() => {
    // I parametri della conversione vengono dalle regole, non dal risultato
    // di una formazione: lineupResult() torna null a chi non ha consegnato
    // (art. 8.4) e questa riga andava in errore, portandosi via la
    // classifica intera. Sono un dato della lega, non di una squadra.
    const c = conversionParams(S.base.league.managerCount, S.rules());
    return `<div class="a-card a-rule"><span class="art">Art. 11</span><p><b>Conversione in gol:</b> con ${S.base.league.managerCount} ${S.base.league.managerCount === 1 ? 'fantallenatore' : 'fantallenatori'} il primo gol scatta a ${fmt(c.threshold)} e se ne aggiunge uno ogni ${fmt(c.step)} punti. Parità di fantapunteggio = pareggio.</p></div>`;
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
    ctx.sheet(`<h3>Premi in palio</h3>
      <p class="auth-hint">Quello che vince chi arriva in una certa posizione. È un accordo fra voi: l'app lo scrive e lo mostra, non lo gestisce.</p>
      <div id="pr-righe">${righe.map((r, i) => `<div class="pr-riga">
        <input class="field-input pr-posto" type="number" min="1" max="99" value="${r.posto}" aria-label="Posto" inputmode="numeric">
        <input class="field-input pr-premio" value="${esc(r.premio)}" placeholder="es. una cena offerta" maxlength="120" aria-label="Premio">
        <button class="pr-via" data-via="${i}" aria-label="Togli">${icon('trash', 'ic sm')}</button></div>`).join('')}</div>
      ${righe.length < 10 ? '<button class="a-btn sec" id="pr-piu" style="margin-top:8px">Aggiungi un premio</button>' : '<p class="small muted">Dieci premi sono il massimo.</p>'}
      <button class="a-btn" id="pr-salva" style="margin-top:10px">Salva i premi</button>`);
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
        try { await S.salvaPremi(puliti); ctx.sheet(null); ctx.toast(puliti.length ? 'Premi salvati' : 'Premi rimossi'); ctx.render(); }
        catch (err) { ctx.toast(err.message || 'Non è stato possibile salvare'); salva.disabled = false; }
      }
    };
  };
  disegna();
}
