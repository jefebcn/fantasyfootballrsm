import * as S from '../state.js';
import { esc, faccia, icon, ROLE_NAME, plurale } from '../ui.js';

/**
 * Il negozio della lega aperta: la rosa te la fai da solo, subito.
 *
 * PERCHE' NON E' UN'ASTA. In una lega aperta lo stesso giocatore puo' stare
 * in dieci squadre: non c'e' niente da contendersi, e un'asta sarebbe una
 * fila per comprare aria. Qui si tocca un nome e il giocatore e' tuo, col
 * prezzo del listino.
 *
 * IL PREZZO E LE QUOTE NON LI DECIDE QUESTA SCHERMATA. Li applica il
 * database (migrazione 019), che ha il listino e guarda chi chiama. Qui si
 * disegna, si spengono i bottoni che verrebbero rifiutati, e si dice perche'.
 * Se qualcuno aggira la schermata, trova la stessa regola un livello sotto.
 */
let q = '', ruolo = null, inCorso = null;

const euro = (n) => `${n}`;

export const negozio = {
  title: 'Costruisci la rosa', appbar: 'back',
  sub: () => 'Compra i tuoi 25 giocatori',
  render() {
    const n = S.negozio();
    if (!n) {
      return `<main class="a-body"><div class="empty">${icon('lock')}
        <p>Il negozio è solo delle leghe aperte.</p>
        <p class="small muted">Nelle leghe private la rosa si fa con l'asta: i giocatori sono esclusivi, e chi arriva prima se li prende.</p></div></main>`;
    }
    const io = S.me();
    const miei = new Set(S.rosterIds(io.id));
    const rosa = S.rosterOf(io.id).sort((a, b) => 'PDCA'.indexOf(a.player.role) - 'PDCA'.indexOf(b.player.role) || b.player.quotation - a.player.quotation);

    // Chi non entra piu' per quota o per crediti resta in elenco ma spento:
    // toglierlo farebbe sembrare che il giocatore non esista.
    const compra = (p) => {
      if (miei.has(p.id)) return ['dentro', ''];
      if (!n.aperto) return ['', 'chiuso'];
      if (!n.manca[p.role]) return ['', `hai già ${n.quote[p.role]} ${ROLE_NAME[p.role].toLowerCase()}`];
      if (p.quotation > n.crediti) return ['', 'crediti finiti'];
      return ['libero', ''];
    };

    let list = S.base.players.filter((p) => p.isActive !== false
      && (!ruolo || p.role === ruolo)
      && (!q || p.name.toLowerCase().includes(q) || p.firstName.toLowerCase().includes(q)));
    list = list.sort((a, b) => b.quotation - a.quotation).slice(0, 80);

    const quando = n.chiude
      ? `${n.chiude.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'numeric' })} alle ${String(n.chiude.getHours()).padStart(2, '0')}:${String(n.chiude.getMinutes()).padStart(2, '0')}`
      : null;

    return `<main class="a-body">
      <div class="neg-testa">
        <div class="neg-num"><b>${euro(n.crediti)}</b><span>crediti</span></div>
        <div class="neg-num"><b>${25 - n.mancanti}<small>/25</small></b><span>in rosa</span></div>
        ${['P', 'D', 'C', 'A'].map((r) => `<div class="neg-q${n.manca[r] ? '' : ' pieno'}">
          <b>${n.per[r]}/${n.quote[r]}</b><span>${r}</span></div>`).join('')}
      </div>
      ${n.aperto
    // Il testo dentro UN solo elemento: .neg-quando e' una riga flex, e un
    // <b> lasciato figlio diretto diventa un riquadro a se' con lo spazio
    // intorno — sullo schermo usciva "alle 13:00 , quando comincia".
    ? `<p class="neg-quando">${icon('clock', 'ic sm')}<span>Puoi cambiare la rosa fino a ${quando ? `<b>${quando}</b>` : 'l\'inizio della tua prima giornata'}${n.giornata ? `, quando comincia la ${n.giornata}ª giornata` : ''}. Poi è quella.</span></p>`
    : `<p class="neg-quando chiuso">${icon('lock', 'ic sm')}<span><b>Il mercato è chiuso</b>: la tua prima giornata è già cominciata.</span></p>`}
      ${n.completa ? `<div class="neg-fatto">${icon('check', 'ic sm')}<div><b>Rosa completa</b><span>25 giocatori. Ora puoi schierare la formazione.</span></div>
        <a class="a-btn" href="#/rosa/formazione">Schiera</a></div>` : ''}

      ${rosa.length ? `<div class="a-sec"><b>La tua rosa</b><span>${rosa.length} su 25</span></div>
      <div class="vlist">${rosa.map((r) => `<div class="vr">${faccia(r.player, r.club)}
        <span class="nm"><b>${esc(r.player.name)}</b><span>${esc(r.club.name)} · ${r.player.role}</span></span>
        <span class="fv" style="font-size:14px">${r.pricePaid}</span>
        ${n.aperto ? `<button class="chip neg-via" data-vendi="${esc(r.playerId)}" aria-label="Togli ${esc(r.player.name)}">${icon('trash', 'ic sm')}</button>` : ''}
      </div>`).join('')}</div>` : ''}

      <div class="a-sec"><b>Chi vuoi</b><span>${n.mancanti ? `mancano ${n.mancanti}` : 'rosa completa'}</span></div>
      <div class="topbar" style="padding-top:0"><input class="field-input" id="q" placeholder="Cerca un giocatore" value="${esc(q)}" autocomplete="off" style="flex:1"></div>
      <div class="chips sticky"><button class="chip${!ruolo ? ' on' : ''}" data-ruolo="">Tutti</button>${['P', 'D', 'C', 'A'].map((r) => `<button class="chip${ruolo === r ? ' on' : ''}" data-ruolo="${r}">${r}${n.manca[r] ? ` <i>${n.manca[r]}</i>` : ''}</button>`).join('')}</div>
      <div class="vlist">${list.map((p) => {
    const cb = S.clubsById.get(p.clubId); const [stato, perche] = compra(p);
    return `<div class="vr${stato === 'dentro' ? ' neg-dentro' : ''}">${faccia(p, cb)}
        <span class="nm"><b>${esc(p.name)}</b><span>${esc(cb.name)} · ${p.role}${perche ? ` · <i>${esc(perche)}</i>` : ''}</span></span>
        <span class="fv" style="font-size:14px">${p.quotation}</span>
        ${stato === 'dentro'
    ? `<span class="neg-ok">${icon('check', 'ic sm')}</span>`
    : `<button class="chip neg-piu" data-compra="${esc(p.id)}" ${stato ? '' : 'disabled'} aria-label="Compra ${esc(p.name)}">${inCorso === p.id ? '…' : '+'}</button>`}
      </div>`;
  }).join('')}</div>
    </main>`;
  },
  mount(root, ctx) {
    const inp = root.querySelector('#q');
    if (inp) inp.oninput = () => { q = inp.value.trim().toLowerCase(); ctx.render(); const c = root.querySelector('#q'); if (c) { c.focus(); c.setSelectionRange(c.value.length, c.value.length); } };
    root.querySelector('main').addEventListener('click', async (e) => {
      const r = e.target.closest('[data-ruolo]');
      if (r) { ruolo = r.dataset.ruolo || null; ctx.render(); return; }
      const c = e.target.closest('[data-compra]');
      if (c && !c.disabled) {
        inCorso = c.dataset.compra; c.disabled = true;
        try { const esito = await S.compraGiocatore(inCorso); ctx.toast(`Preso per ${plurale(esito?.prezzo ?? 0, 'credito', 'crediti')}`); }
        catch (err) { ctx.toast(err.message || 'Non è stato possibile comprarlo'); }
        inCorso = null; ctx.render(); return;
      }
      const v = e.target.closest('[data-vendi]');
      if (v) {
        v.disabled = true;
        try { const esito = await S.vendiGiocatore(v.dataset.vendi); ctx.toast(`Tolto, +${plurale(esito?.reso ?? 0, 'credito', 'crediti')}`); }
        catch (err) { ctx.toast(err.message || 'Non è stato possibile toglierlo'); }
        ctx.render();
      }
    });
  },
};
