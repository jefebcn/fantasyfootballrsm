/**
 * Console d'asta. Non conduce l'asta: la registra.
 *
 * L'asta vera si fa come si e' sempre fatta — in chiamata, al tavolo, a buste
 * chiuse — e qui si scrive chi ha preso chi e a quanto, con le regole applicate
 * mentre si batte invece che scoperte dopo. Chi guarda vede le rose riempirsi
 * da sole, perche' `rosters` e' fra le tabelle in tempo reale.
 *
 * La regola che serve piu' delle altre e' l'offerta massima: non quanti crediti
 * hai, ma quanti puoi spenderne tenendone uno per ogni casella ancora vuota.
 */
import * as S from '../state.js';
import { esc, icon, roleChip, faccia } from '../ui.js';

let ruolo = 'tutti'; let cerca = ''; let compratore = null;
const RUOLI = [['tutti', 'Tutti'], ['P', 'Portieri'], ['D', 'Difensori'], ['C', 'Centrocampisti'], ['A', 'Attaccanti']];

/** Riquadro di una squadra: crediti, caselle piene, quanto puo' offrire. */
function squadra(m, attiva) {
  const st = S.statoAsta(m.id);
  const caselle = ['P', 'D', 'C', 'A'].map((r) => `<span class="cas${st.per[r] >= st.serve[r] ? ' pieno' : ''}">${r}<b>${st.per[r]}/${st.serve[r]}</b></span>`).join('');
  return `<button class="sq${attiva ? ' on' : ''}" data-sq="${m.id}">
    <span class="sq-t"><b>${esc(m.teamName)}</b><span>${st.presi}/${st.totale}</span></span>
    <span class="sq-c">${st.crediti}<small>crediti</small></span>
    <span class="sq-r">${caselle}</span>
    ${st.vuote ? `<span class="sq-max">max offerta <b>${st.max(null)}</b></span>` : '<span class="sq-max fatta">rosa completa</span>'}</button>`;
}

export const asta = {
  // title resta una stringa: finisce nel titolo della pagina, dove le altre
  // viste ne mettono una e una funzione ci comparirebbe come codice. Quello
  // che cambia fra le due modalita' lo dice sub(), che e' la riga che si
  // legge in cima alla schermata.
  title: 'Rosa', appbar: 'back',
  sub: () => (S.legaPubblica() ? 'Scegli i tuoi 25' : 'Registra gli acquisti'),
  render() {
    // NELLA LEGA PUBBLICA questa schermata cambia padrone: non e' piu' la
    // console di chi conduce l'asta, e' il posto dove OGNUNO si fa la sua
    // rosa coi crediti che ha. Un'asta a duecento non si fa in chiamata, e i
    // giocatori non sono esclusivi (013): la stessa schermata, senza il
    // selettore delle squadre e senza la lista dei liberi, perche' liberi lo
    // sono tutti.
    // NELLA LEGA APERTA QUESTA SCHERMATA NON SERVE PIU'. Ci provava: mostrava
    // l'elenco e faceva scrivere il prezzo a mano. Ma i gestori dei tocchi
    // sono dietro un "se non amministri la lega, esci" (vedi mount), quindi
    // per chiunque non fosse l'amministratore era una vetrina che non si
    // apriva; e la scrittura andava dritta in rosters, che le policy lasciano
    // scrivere solo a chi amministra. Funzionava per una persona sola, e il
    // prezzo lo decideva il telefono. Adesso c'e' il negozio (019), dove il
    // prezzo lo dice il listino del database e chi compra puo' essere
    // chiunque sia nella lega.
    if (S.legaPubblica()) {
      return `<main class="a-body"><div class="empty">${icon('cart')}<p>Qui la rosa te la fai da solo, dal negozio.</p>
        <p class="small muted">In una lega aperta non c'è l'asta: lo stesso giocatore può stare nella rosa di tutti, quindi non c'è niente da contendersi. Si sceglie e si compra, subito.</p>
        <a class="a-btn" href="#/negozio" style="text-decoration:none">Vai al negozio</a></div></main>`;
    }
    if (!S.isLeagueAdmin()) {
      return `<main class="a-body"><div class="empty">${icon('lock')}<p>L'asta la conduce l'amministratore della lega.</p>
        <p class="small muted">Puoi seguirla dalla tua rosa: si riempie da sola mentre lui registra gli acquisti.</p>
        <a class="a-btn sec" href="#/rosa" style="text-decoration:none">La mia rosa</a></div></main>`;
    }
    const mgr = S.base.managers;
    if (!mgr.length) return `<main class="a-body"><div class="empty">${icon('users')}<p>Nessuna squadra in lega: prima servono i partecipanti.</p></div></main>`;
    const mia = S.legaPubblica();
    if (mia) compratore = S.me()?.id || mgr[0].id;
    else if (!compratore || !mgr.some((m) => m.id === compratore)) compratore = mgr[0].id;

    const pr = S.proprietari();
    const st = S.statoAsta(compratore);
    const q = cerca.trim().toLowerCase();
    // I conteggi sulle pastiglie dicono quanti ne restano per ruolo, quindi si
    // fanno prima di filtrare per ruolo (ma dopo la ricerca, se no mentono).
    // Nella pubblica si toglie dall'elenco solo chi e' GIA' NELLA MIA rosa:
    // che un altro l'abbia preso non mi riguarda.
    const miei = new Set(st.rosa.map((x) => x.playerId));
    const tuttiLiberi = S.base.players.filter((p) => p.isActive
      && (mia ? !miei.has(p.id) : !pr.has(p.id))
      && (!q || p.name.toLowerCase().includes(q) || S.clubsById.get(p.clubId).name.toLowerCase().includes(q)));
    const liberi = tuttiLiberi.filter((p) => ruolo === 'tutti' || p.role === ruolo)
      .sort((a, b) => b.quotation - a.quotation);

    const riga = (p) => {
      const max = st.max(p.role);
      const pieno = st.per[p.role] >= st.serve[p.role];
      return `<button class="ar" data-pl="${p.id}" ${pieno || !max ? 'disabled' : ''}>
        ${faccia(p, S.clubsById.get(p.clubId))}
        <span class="nm"><b>${esc(p.name)}</b><span>${esc(S.clubsById.get(p.clubId).name)} · quot. ${p.quotation}</span></span>
        <span class="q">${pieno ? 'ruolo pieno' : `max ${max}`}</span></button>`;
    };
    const ultimi = mia
      ? st.rosa.slice(-6).reverse().map((x) => [x.playerId, { managerId: compratore, pricePaid: x.pricePaid }])
      : [...pr.entries()].slice(-6).reverse();
    return `<main class="a-body">
      ${mia ? `<div class="a-sec"><b>La tua squadra</b><span>${st.crediti} crediti</span></div>
        <div class="sqs">${squadra(S.me(), true)}</div>
        <p class="small muted" style="margin:-4px 2px 0">Lega pubblica: i giocatori non sono esclusivi, lo stesso può stare nella rosa di tutti. Vale il tetto per ruolo e quello dei crediti.</p>`
    : `<div class="a-sec"><b>Squadre</b><span>tocca chi sta comprando</span></div>
        <div class="sqs">${mgr.map((m) => squadra(m, m.id === compratore)).join('')}</div>`}
      ${st.vuote === 0 ? `<div class="warn info">${icon('check', 'ic sm')}<span>Rosa completa: 25 su 25.</span></div>` : ''}
      <div class="a-sec"><b>${mia ? 'Da scegliere' : 'Da assegnare'}</b><span>${liberi.length} ${mia ? 'disponibili' : 'liberi'}</span></div>
      <input class="field-input" id="cerca" placeholder="Cerca giocatore o società" value="${esc(cerca)}" autocomplete="off">
      <div class="scelte">${RUOLI.map(([k, l]) => {
      const n = k === 'tutti' ? tuttiLiberi.length : tuttiLiberi.filter((x) => x.role === k).length;
      return `<button class="chip${ruolo === k ? ' on' : ''}" data-ruolo="${k}">${k === 'tutti' ? l : roleChip(k) + l}<i>${n}</i></button>`;
    }).join('')}</div>
      <div class="alist">${liberi.length ? liberi.slice(0, 40).map(riga).join('')
    : '<p class="small muted" style="padding:14px">Nessun giocatore libero con questi filtri.</p>'}</div>
      ${liberi.length > 40 ? `<p class="small muted" style="text-align:center">Mostrati 40 di ${liberi.length}: usa la ricerca.</p>` : ''}
      ${ultimi.length ? `<div class="a-sec"><b>Ultimi acquisti</b><span>tocca per annullare</span></div>
        <div class="alist">${ultimi.map(([pid, v]) => { const p = S.playersById.get(pid); const m = S.managersById.get(v.managerId);
      return `<button class="ar fatto" data-annulla="${pid}">${roleChip(p.role)}
        <span class="nm"><b>${esc(p.name)}</b><span>${esc(m ? m.teamName : '—')}</span></span>
        <span class="q">${v.pricePaid}${icon('undo', 'ic sm')}</span></button>`; }).join('')}</div>` : ''}
    </main>`;
  },

  mount(root, ctx) {
    if (!S.isLeagueAdmin()) return;
    const main = root.querySelector('main');
    const inp = root.querySelector('#cerca');
    if (inp) {
      inp.oninput = () => { cerca = inp.value; ctx.render(); };
      if (cerca) { inp.focus(); inp.setSelectionRange(cerca.length, cerca.length); }
    }
    main.addEventListener('click', async (e) => {
      const sq = e.target.closest('[data-sq]');
      if (sq) { compratore = sq.dataset.sq; ctx.render(); return; }
      const rl = e.target.closest('[data-ruolo]');
      if (rl) { ruolo = rl.dataset.ruolo; ctx.render(); return; }

      const an = e.target.closest('[data-annulla]');
      if (an) {
        const pid = an.dataset.annulla; const p = S.playersById.get(pid);
        const v = S.proprietari().get(pid); if (!v) return;
        if (!confirm(`Annullare l'acquisto di ${p.name} (${v.pricePaid} crediti)?`)) return;
        try { await S.removeRosterPlayer(v.managerId, pid); ctx.toast(`${p.lastName} tolto · ${v.pricePaid} crediti restituiti`); }
        catch (err) { ctx.toast(err.message || 'Non è stato possibile annullare'); }
        ctx.render(); return;
      }

      const b = e.target.closest('[data-pl]');
      if (b) {
        const p = S.playersById.get(b.dataset.pl);
        const m = S.managersById.get(compratore);
        const max = S.statoAsta(compratore).max(p.role);
        ctx.sheet(`<h3>${esc(p.name)}</h3>
          <p class="sheet-sub">${esc(S.clubsById.get(p.clubId).name)} · quotazione ${p.quotation} · a <b>${esc(m.teamName)}</b></p>
          <label class="lbl" for="prezzo">Prezzo pagato</label>
          <input class="field-input" id="prezzo" type="number" inputmode="numeric" min="1" max="${max}" value="${Math.min(p.quotation, max)}">
          <p class="small muted" id="motivo" style="margin:8px 0 0">Al massimo <b>${max}</b>: gli altri crediti servono per le caselle ancora vuote.</p>
          <button class="a-btn" id="assegna" style="margin-top:12px">${icon('check', 'ic sm')}Assegna a ${esc(m.teamName)}</button>`);
        const sh = document.getElementById('sheet');
        const campo = sh.querySelector('#prezzo'); const btn = sh.querySelector('#assegna'); const motivo = sh.querySelector('#motivo');
        const controlla = () => {
          const err = S.perchePuoiNo(compratore, p.id, Number(campo.value));
          btn.disabled = err.length > 0;
          motivo.innerHTML = err.length ? esc(err.join(' · '))
            : `Al massimo <b>${max}</b>: gli altri crediti servono per le caselle ancora vuote.`;
          motivo.classList.toggle('no', err.length > 0);
        };
        campo.oninput = controlla; controlla();
        campo.focus(); campo.select();
        btn.onclick = async () => {
          btn.disabled = true;
          try {
            await S.addRosterPlayer(compratore, p.id, Number(campo.value));
            ctx.sheet(null); ctx.toast(`${p.lastName} a ${m.teamName} · ${campo.value} crediti`);
          } catch (err) { motivo.textContent = err.message || 'Non è stato possibile assegnare'; motivo.classList.add('no'); btn.disabled = false; return; }
          ctx.render();
        };
        return;
      }
    });
  },
};
