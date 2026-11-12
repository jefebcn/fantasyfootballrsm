import * as S from '../state.js';
import { esc, icon, t } from '../ui.js';
import { ARTICOLI, MAX_QUANTITA, SPEDIZIONE_CENT, STATI, euro, totaleCent, articolo } from '../shop.js';

/**
 * LO SHOP (Alex, 12/11: «vorrei implementare una sezione shop, al momento per
 * le cose di abbigliamento»). Per ora un articolo, il top Fantatitano:
 * foto in scorrimento (la prima indossata, poi davanti, lato e dietro),
 * taglia, quantita', consegna e i dati per consegnarla.
 *
 * Nell'app non si paga: Alex ha scelto l'ordine in app. L'ordine si salva sul
 * server (056), il totale lo calcola il database, ad Alex arriva un'e-mail e
 * lo vede nella console admin (scheda Shop); poi scrive lui a chi ha ordinato
 * per il pagamento (al ritiro, bonifico, PayPal).
 *
 * Consegna: ritiro gratis allo stadio durante le partite del campionato,
 * oppure spedizione a 2 €.
 */

const CHIAVE = 'fcs:shop';
const leggi = () => { try { return JSON.parse(localStorage.getItem(CHIAVE)) || {}; } catch { return {}; } };
const scrivi = (v) => { try { localStorage.setItem(CHIAVE, JSON.stringify(v)); } catch { /* privato o pieno: si riscrive la prossima volta */ } };

// la scelta in corso, per articolo; nome, recapito e indirizzo si ricordano
// sul telefono per il prossimo ordine (mai sul server finche' non si ordina)
const scelta = {};
const sceltaDi = (id) => (scelta[id] ||= { taglia: '', quantita: 1, consegna: 'ritiro', ...(({ nome, contatto, indirizzo }) => ({ nome: nome || '', contatto: contatto || '', indirizzo: indirizzo || '' }))(leggi()), note: '' });
let miei;            // undefined = da chiedere, null = non disponibili, [] = nessuno
let fatto = null;    // { id, articolo, totale } dopo un ordine riuscito
let invio = false;

function foto(a) {
  return `<div class="shop-foto" data-galleria="${a.id}">
    <div class="shop-scorri" tabindex="0" aria-label="${esc(t('Foto di {nome}', { nome: t(a.nome) }))}">
      ${a.foto.map((f, i) => `<img src="${f.src}" alt="${esc(t(f.alt))}" width="1000" height="1250" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async">`).join('')}
    </div>
    <div class="shop-punti" aria-hidden="true">${a.foto.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>
  </div>`;
}

function scheda(a) {
  const s = sceltaDi(a.id);
  const tot = totaleCent(a, s.quantita, s.consegna);
  const puo = S.shopDisponibile();
  return `<article class="a-card shop-art">
    ${foto(a)}
    <div class="shop-testa"><h2>${esc(t(a.nome))}</h2><b class="shop-prezzo">${euro(a.prezzoCent)}</b></div>
    ${a.descrizione.map((p) => `<p class="small">${esc(t(p))}</p>`).join('')}
    <form class="shop-ordine" data-art="${a.id}" novalidate>
      <fieldset><legend>${t('Taglia')}</legend>
        <div class="shop-taglie">${a.taglie.map((tg) => `<button type="button" class="chip${s.taglia === tg ? ' on' : ''}" data-taglia="${tg}" aria-pressed="${s.taglia === tg}">${tg}</button>`).join('')}</div>
      </fieldset>
      <fieldset><legend>${t('Quantità')}</legend>
        <div class="shop-q"><button type="button" class="ib" data-q="-1" aria-label="${t('Una in meno')}" ${s.quantita <= 1 ? 'disabled' : ''}>−</button><b aria-live="polite">${s.quantita}</b><button type="button" class="ib" data-q="1" aria-label="${t('Una in più')}" ${s.quantita >= MAX_QUANTITA ? 'disabled' : ''}>+</button></div>
      </fieldset>
      <fieldset><legend>${t('Consegna')}</legend>
        <label class="shop-cons${s.consegna === 'ritiro' ? ' on' : ''}"><input type="radio" name="consegna" value="ritiro" ${s.consegna === 'ritiro' ? 'checked' : ''}>
          <span><b>${t('Ritiro allo stadio')}</b><span class="small muted">${t('Durante le partite del campionato: ci accordiamo per messaggio.')}</span></span><em>${t('Gratis')}</em></label>
        <label class="shop-cons${s.consegna === 'spedizione' ? ' on' : ''}"><input type="radio" name="consegna" value="spedizione" ${s.consegna === 'spedizione' ? 'checked' : ''}>
          <span><b>${t('Spedizione')}</b><span class="small muted">${t('A casa tua, con corriere o posta.')}</span></span><em>${euro(SPEDIZIONE_CENT)}</em></label>
      </fieldset>
      <fieldset><legend>${t('I tuoi dati')}</legend>
        <label class="shop-campo"><span>${t('Nome e cognome')}</span><input class="field-input" name="nome" autocomplete="name" maxlength="80" value="${esc(s.nome)}" required></label>
        <label class="shop-campo"><span>${t('Recapito')}</span><input class="field-input" name="contatto" maxlength="120" value="${esc(s.contatto)}" placeholder="${esc(t('Telefono, e-mail o profilo Instagram'))}" required></label>
        ${s.consegna === 'spedizione' ? `<label class="shop-campo"><span>${t('Indirizzo di spedizione')}</span><textarea class="field-input" name="indirizzo" rows="2" autocomplete="street-address" maxlength="300" placeholder="${esc(t('Via, numero, CAP, città'))}" required>${esc(s.indirizzo)}</textarea></label>` : ''}
        <label class="shop-campo"><span>${t('Note')} <span class="muted">(${t('facoltative')})</span></span><input class="field-input" name="note" maxlength="300" value="${esc(s.note)}"></label>
      </fieldset>
      <div class="shop-totale"><span>${t('Totale')}${s.consegna === 'spedizione' ? ` <span class="small muted">${t('spedizione compresa')}</span>` : ''}</span><b>${euro(tot)}</b></div>
      ${puo
    ? `<button class="a-btn" type="submit" ${invio ? 'disabled' : ''}>${icon('cart', 'ic sm')}${invio ? t('Invio…') : t('Ordina · {totale}', { totale: euro(tot) })}</button>`
    : `<p class="small muted">${t('Per ordinare entra con il tuo account.')}</p>`}
      <p class="small muted shop-paga">${t('Adesso non paghi niente: ti scriviamo noi per confermare l\'ordine e per il pagamento (al ritiro, con bonifico o PayPal).')}</p>
    </form>
  </article>`;
}

function ordini() {
  if (!miei || !miei.length) return '';
  return `<div class="a-sec"><b>${t('I tuoi ordini')}</b><span>${miei.length}</span></div>
    <div class="a-card shop-miei">${miei.map((o) => {
    const a = articolo(o.articolo);
    return `<div class="shop-riga"><div><b>${esc(a ? t(a.nome) : o.articolo)}</b>
      <span class="small muted">${t('n. {id}', { id: o.id })} · ${o.quantita} × ${esc(o.taglia)} · ${o.consegna === 'ritiro' ? t('ritiro allo stadio') : t('spedizione')} · ${euro(o.totale_cent)}</span></div>
      <span class="shop-stato ${esc(o.stato)}">${esc(t(STATI[o.stato] || o.stato))}</span></div>`;
  }).join('')}</div>`;
}

export const shop = {
  title: 'Shop', sub: () => t('Shop'),
  render() {
    const grazie = fatto ? `<div class="a-card shop-grazie" role="status">${icon('check', 'ic')}<div><b>${t('Ordine n. {id} ricevuto', { id: fatto.id })}</b>
      <p class="small">${t('Ti scriviamo al recapito che hai lasciato per confermarlo e per il pagamento. Totale: {totale}.', { totale: euro(fatto.totale) })}</p></div></div>` : '';
    return `<main class="a-body shop">
      ${grazie}
      <div class="a-sec"><b>${t('Abbigliamento')}</b><span>${ARTICOLI.length}</span></div>
      ${ARTICOLI.map(scheda).join('')}
      ${ordini()}
    </main>`;
  },
  mount(root, ctx) {
    if (miei === undefined) { miei = null; S.shopMieiOrdini().then((r) => { miei = r; if (r && r.length) ctx.render(); }); }
    // i pallini seguono la foto che si vede
    root.querySelectorAll('[data-galleria]').forEach((g) => {
      const sc = g.querySelector('.shop-scorri'); const punti = [...g.querySelectorAll('.shop-punti i')];
      sc.addEventListener('scroll', () => {
        const i = Math.round(sc.scrollLeft / Math.max(1, sc.clientWidth));
        punti.forEach((p, k) => p.classList.toggle('on', k === i));
      }, { passive: true });
    });
    const main = root.querySelector('main');
    const aggiorna = (form) => {
      const s = sceltaDi(form.dataset.art);
      for (const k of ['nome', 'contatto', 'indirizzo', 'note']) { const el = form.elements[k]; if (el) s[k] = el.value; }
      return s;
    };
    main.addEventListener('click', (e) => {
      const form = e.target.closest('form[data-art]'); if (!form) return;
      const tg = e.target.closest('[data-taglia]');
      if (tg) { aggiorna(form).taglia = tg.dataset.taglia; ctx.render(); return; }
      const q = e.target.closest('[data-q]');
      if (q) { const s = aggiorna(form); s.quantita = Math.min(MAX_QUANTITA, Math.max(1, s.quantita + Number(q.dataset.q))); ctx.render(); }
    });
    main.addEventListener('change', (e) => {
      const form = e.target.closest('form[data-art]'); if (!form) return;
      if (e.target.name === 'consegna') { aggiorna(form).consegna = e.target.value; ctx.render(); }
    });
    main.addEventListener('input', (e) => { const form = e.target.closest('form[data-art]'); if (form) aggiorna(form); });
    main.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target.closest('form[data-art]'); if (!form || invio) return;
      const a = articolo(form.dataset.art); const s = aggiorna(form);
      const manca = !s.taglia ? t('Scegli la taglia.')
        : s.nome.trim().length < 2 ? t('Scrivi nome e cognome.')
          : s.contatto.trim().length < 3 ? t('Lascia un recapito: telefono, e-mail o Instagram.')
            : s.consegna === 'spedizione' && s.indirizzo.trim().length < 8 ? t('Scrivi l\'indirizzo di spedizione.') : '';
      if (manca) { ctx.toast(manca); return; }
      invio = true; ctx.render();
      let riuscito = false;
      try {
        const id = await S.shopOrdina({ articolo: a.id, taglia: s.taglia, quantita: s.quantita, consegna: s.consegna,
          nome: s.nome.trim(), contatto: s.contatto.trim(), indirizzo: s.consegna === 'spedizione' ? s.indirizzo.trim() : null, note: s.note.trim() });
        scrivi({ ...leggi(), nome: s.nome.trim(), contatto: s.contatto.trim(), indirizzo: s.indirizzo.trim(), ordinato: Date.now() });
        fatto = { id, articolo: a.id, totale: totaleCent(a, s.quantita, s.consegna) };
        s.note = ''; s.taglia = ''; s.quantita = 1;
        riuscito = true;
        miei = await S.shopMieiOrdini();
      } catch (err) {
        ctx.toast(/shop_ordina|function|schema cache/i.test(err.message || '') ? t('Lo shop non è ancora attivo: riprova più tardi.') : (err.message || t('Ordine non inviato, riprova.')));
      } finally {
        invio = false; ctx.render();
        // la conferma sta in cima: ci si torna, se no resta fuori schermo
        if (riuscito) root.querySelector('main')?.scrollTo?.({ top: 0, behavior: 'smooth' });
      }
    });
  },
};

