import * as S from '../state.js';
import { esc, faccia, icon, ROLE_NAME, plurale, t } from '../ui.js';
import { locale } from '../lingua.js';

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
const crediti = (n) => plurale(n, t('credito'), t('crediti'));
const giocatori = (n) => plurale(n, t('giocatore'), t('giocatori'));
/** «mar 4/11 alle 13:00» */
const quandoDi = (d) => t('{giorno} alle {ora}', { giorno: d.toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'numeric' }), ora: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` });

export const negozio = {
  title: 'Costruisci la rosa', appbar: 'back',
  sub: () => t('Compra i tuoi 25 giocatori'),
  render() {
    const n = S.negozio();
    if (!n) {
      return `<main class="a-body"><div class="empty">${icon('lock')}
        <p>${t('Il negozio è solo delle leghe aperte.')}</p>
        <p class="small muted">${t('Nelle leghe private la rosa si fa con l\'asta: i giocatori sono esclusivi, e chi arriva prima se li prende.')}</p></div></main>`;
    }
    const io = S.me();
    const miei = new Set(S.rosterIds(io.id));
    const rosa = S.rosterOf(io.id).sort((a, b) => 'PDCA'.indexOf(a.player.role) - 'PDCA'.indexOf(b.player.role) || b.player.quotation - a.player.quotation);

    // Chi non entra piu' per quota o per crediti resta in elenco ma spento:
    // toglierlo farebbe sembrare che il giocatore non esista.
    const compra = (p) => {
      if (miei.has(p.id)) return ['dentro', ''];
      if (!n.compra) return ['', t('chiuso')];
      if (!n.manca[p.role]) return ['', t('hai già {n} {ruolo}', { n: n.quote[p.role], ruolo: ROLE_NAME[p.role].toLowerCase() })];
      if (p.quotation > n.crediti) return ['', t('crediti finiti')];
      // 038: la riserva per completare la rosa coi meno cari
      if (n.crediti - p.quotation < n.riserva(p.role)) return ['', t('riserva crediti')];
      return ['libero', ''];
    };

    let list = S.base.players.filter((p) => p.isActive !== false && !p.doppioneDi
      && (!ruolo || p.role === ruolo)
      && (!q || p.name.toLowerCase().includes(q) || p.firstName.toLowerCase().includes(q)));
    list = list.sort((a, b) => b.quotation - a.quotation).slice(0, 80);

    const quando = n.chiude ? quandoDi(n.chiude) : null;

    return `<main class="a-body">
      <div class="neg-testa">
        <div class="neg-num"><b>${euro(n.crediti)}</b><span>${t('crediti')}</span></div>
        <div class="neg-num"><b>${25 - n.mancanti}<small>/25</small></b><span>${t('in rosa')}</span></div>
        ${['P', 'D', 'C', 'A'].map((r) => `<div class="neg-q${n.manca[r] ? '' : ' pieno'}">
          <b>${n.per[r]}/${n.quote[r]}</b><span>${r}</span></div>`).join('')}
      </div>
      ${n.riparazione
    ? `<p class="neg-quando riparazione">${icon('clock', 'ic sm')}<span>${t('<b>{nome} aperto</b> fino a {quando}: togli e compra liberamente. Poi la rosa torna bloccata.', { nome: esc(n.riparazione.nome), quando: quandoDi(n.riparazione.fine) })}</span></p>`
    : n.aperto
    // Il testo dentro UN solo elemento: .neg-quando e' una riga flex, e un
    // <b> lasciato figlio diretto diventa un riquadro a se' con lo spazio
    // intorno — sullo schermo usciva "alle 13:00 , quando comincia".
    ? `<p class="neg-quando">${icon('clock', 'ic sm')}<span>${t('Puoi cambiare la rosa fino a {quando}{comincia}. Poi resta quella per tutta la stagione.', { quando: quando ? `<b>${quando}</b>` : t('l\'inizio della tua prima giornata'), comincia: n.giornata ? t(', quando comincia la {n}ª giornata', { n: n.giornata }) : '' })}</span></p>`
    : n.compra
    // 037: la finestra e' passata ma la rosa e' a meta'. Si compra solo
    // quello che manca, e senza rosa intera la formazione non si consegna.
    ? `<p class="neg-quando">${icon('clock', 'ic sm')}<span>${t('<b>Completa la rosa</b>: {manca}, e senza rosa intera la formazione non si consegna. Puoi comprare e, se ti servono crediti, anche togliere giocatori: a 25 la rosa è quella.', { manca: n.mancanti === 1 ? t('ti manca 1 giocatore') : t('ti mancano {n} giocatori', { n: n.mancanti }) })}</span></p>`
    : `<p class="neg-quando chiuso">${icon('lock', 'ic sm')}<span>${t('<b>Il mercato è chiuso</b>: la tua prima giornata è già cominciata.')}</span></p>`}
      ${n.scoperto && n.vende ? `<p class="neg-quando neg-scoperto">${icon('cart', 'ic sm')}<span>${t('<b>Così non ci arrivi</b>: per i {giocatori} che mancano servono almeno <b>{crediti}</b>, anche coi meno cari, e ne hai {n}. Togli uno dei giocatori più cari qui sotto: ti tornano i crediti che l\'avevi pagato, e con quelli completi la rosa.', { giocatori: giocatori(n.mancanti), crediti: crediti(n.riserva()), n: n.crediti })}</span></p>`
    : !n.completa && n.riserva() > 0 ? `<p class="small muted neg-riserva">${t('Riserva crediti: tieni da parte almeno <b>{crediti}</b> per i {giocatori} che mancano, coi meno cari di ogni ruolo.', { crediti: crediti(n.riserva()), giocatori: giocatori(n.mancanti) })}</p>` : ''}
      ${n.completa ? `<div class="neg-fatto">${icon('check', 'ic sm')}<div><b>${t('Rosa completa')}</b><span>${t('25 giocatori. Ora puoi schierare la formazione.')}</span></div>
        <a class="a-btn" href="#/rosa/formazione">${t('Schiera')}</a></div>` : ''}

      ${rosa.length ? `<div class="a-sec"><b>${t('La tua rosa')}</b><span>${t('{n} su 25', { n: rosa.length })}</span></div>
      <div class="vlist">${rosa.map((r) => `<div class="vr">${faccia(r.player, r.club)}
        <span class="nm"><b>${esc(r.player.name)}</b><span>${esc(r.club.name)} · ${r.player.role}</span></span>
        <span class="fv" style="font-size:14px">${r.pricePaid}</span>
        ${n.vende ? `<button class="chip neg-via" data-vendi="${esc(r.playerId)}" aria-label="${t('Togli {nome}', { nome: esc(r.player.name) })}">${icon('trash', 'ic sm')}</button>` : ''}
      </div>`).join('')}</div>` : ''}

      <div class="a-sec"><b>${t('Chi vuoi')}</b><span>${n.mancanti ? t('mancano {n}', { n: n.mancanti }) : t('rosa completa')}</span></div>
      <p class="small muted nota">${t('Il modulo non si sceglie qui: con {p} portieri, {d} difensori, {c} centrocampisti e {a} attaccanti giochi con tutti ({moduli}), e lo cambi a ogni giornata in Formazione.', { p: n.quote.P, d: n.quote.D, c: n.quote.C, a: n.quote.A, moduli: S.rules().modules.join(', ') })}</p>
      <div class="topbar" style="padding-top:0"><input class="field-input" id="q" placeholder="${t('Cerca un giocatore')}" value="${esc(q)}" autocomplete="off" style="flex:1"></div>
      <div class="chips sticky"><button class="chip${!ruolo ? ' on' : ''}" data-ruolo="">${t('Tutti')}</button>${['P', 'D', 'C', 'A'].map((r) => `<button class="chip${ruolo === r ? ' on' : ''}" data-ruolo="${r}">${r}${n.manca[r] ? ` <i>${n.manca[r]}</i>` : ''}</button>`).join('')}</div>
      <div class="vlist">${list.map((p) => {
    const cb = S.clubsById.get(p.clubId); const [stato, perche] = compra(p);
    return `<div class="vr${stato === 'dentro' ? ' neg-dentro' : ''}">${faccia(p, cb)}
        <span class="nm"><b>${esc(p.name)}</b><span>${esc(cb.name)} · ${p.role}${perche ? ` · <i>${esc(perche)}</i>` : ''}</span></span>
        <span class="fv" style="font-size:14px">${p.quotation}</span>
        ${stato === 'dentro'
    ? `<span class="neg-ok">${icon('check', 'ic sm')}</span>`
    : `<button class="chip neg-piu" data-compra="${esc(p.id)}" ${stato ? '' : 'disabled'} aria-label="${t('Compra {nome}', { nome: esc(p.name) })}">${inCorso === p.id ? '…' : '+'}</button>`}
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
        try { const esito = await S.compraGiocatore(inCorso); ctx.toast(t('Preso per {crediti}', { crediti: crediti(esito?.prezzo ?? 0) })); }
        catch (err) { ctx.toast(err.message || t('Non è stato possibile comprarlo')); }
        inCorso = null; ctx.render(); return;
      }
      const v = e.target.closest('[data-vendi]');
      if (v) {
        v.disabled = true;
        try { const esito = await S.vendiGiocatore(v.dataset.vendi); ctx.toast(esito?.formazioni_tolte ? t('Tolto, +{crediti}. Era nella tua formazione: confermala di nuovo', { crediti: crediti(esito?.reso ?? 0) }) : t('Tolto, +{crediti}', { crediti: crediti(esito?.reso ?? 0) })); }
        catch (err) { ctx.toast(err.message || t('Non è stato possibile toglierlo')); }
        ctx.render();
      }
    });
  },
};
