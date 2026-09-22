import * as S from '../state.js';
import { esc, icon, faccia, roleChip, ROLE_NAME, ROLE_ORDER, plurale } from '../ui.js';
import { offertaMassima, roleName } from '../engine.js';

/**
 * Mercato degli svincolati (art. 3.4).
 *
 * Prima questa pagina era un elenco e una riga che diceva «le offerte
 * arrivano con la Fase 2»: una promessa che non si e' mai potuta usare.
 *
 * La prima offerta su un giocatore apre una finestra di 24 ore. Dentro la
 * finestra si rilancia, e la finestra NON si allunga: alla scadenza vince
 * l'offerta piu' alta, a parita' la prima arrivata. Le finestre scadute le
 * chiude chiunque apra l'app, perche' nessuno ha un server che gira di notte.
 */

let filtro = 'tutti';

const P = (id) => S.playersById.get(id);
const CB = (id) => S.clubsById.get(P(id)?.clubId);
const squadra = (memberId) => S.managersById.get(memberId)?.teamName || '—';

/** "fra 3 ore", "fra 12 minuti", "scaduta". */
function fra(iso) {
  const ms = new Date(iso) - S.now();
  if (ms <= 0) return 'si chiude adesso';
  const min = Math.round(ms / 60000);
  if (min < 60) return `fra ${min} ${min === 1 ? 'minuto' : 'minuti'}`;
  const ore = Math.floor(min / 60);
  if (ore < 24) return `fra ${ore} ${ore === 1 ? 'ora' : 'ore'}`;
  return `fra ${Math.floor(ore / 24)}g ${ore % 24}h`;
}

/** Il massimo che posso offrire, tenendo un credito per ogni posto vuoto. */
function tetto(role) {
  const me = S.me(); if (!me) return 0;
  const max = offertaMassima({ rosa: S.rosterOf(me.id), crediti: me.credits, role, rules: S.rules() });
  // Gli impegni aperti sono soldi gia' promessi: offrirli due volte
  // significherebbe vincere due aste e non poter pagare la seconda.
  return Math.max(0, max - S.impegnati());
}

function finestra(f) {
  const p = P(f.playerId); if (!p) return '';
  const me = S.me();
  const mia = f.offerte.find((o) => o.member === me?.id);
  const sopra = f.migliore.member === me?.id;
  return `<div class="a-card fin${sopra ? ' avanti' : mia ? ' sotto' : ''}">
    <div class="fhead">${faccia(p, CB(p.id))}
      <span class="nm"><b>${esc(p.name)}</b><span>${esc(CB(p.id).name)} · ${roleName(p.role)} · quot. ${p.quotation}</span></span>
      ${roleChip(p.role)}</div>
    <div class="fmid"><span class="alta"><b>${f.migliore.crediti}</b><span>offerta più alta</span></span>
      <span class="chi">${esc(squadra(f.migliore.member))}</span>
      <span class="quando">${icon('clock', 'ic sm')}${fra(f.scadeAt)}</span></div>
    ${f.offerte.length > 1 ? `<p class="altre">${f.offerte.slice(1).map((o) => `${esc(squadra(o.member))} ${o.crediti}`).join(' · ')}</p>` : ''}
    <div class="fazioni">
      <button class="a-btn" data-rilancia="${esc(p.id)}" data-min="${f.migliore.crediti + 1}">
        ${sopra ? 'Alza la tua offerta' : 'Rilancia'}</button>
      ${mia ? `<button class="a-btn sec" data-ritira="${mia.id}">Ritira</button>` : ''}
    </div>
    ${sopra ? '<p class="nota">Sei tu il più alto.</p>' : mia ? `<p class="nota">La tua è di ${mia.crediti}.</p>` : ''}
  </div>`;
}

export const mercato = {
  title: 'Mercato', appbar: 'back', sub: () => 'Svincolati · rilancio 24h',
  render() {
    const me = S.me();
    if (!me) return `<main class="a-body"><div class="empty"><p>Il mercato si apre dentro una lega.</p></div></main>`;

    const fuori = S.base.players.filter((p) => !p.isActive);
    const aperte = S.finestreAperte();
    const liberi = S.svincolati();
    const impegnati = S.impegnati();

    if (!S.mercatoDisponibile()) {
      return `<main class="a-body">
        <div class="a-card a-rule"><span class="art">Da fare</span><p>Il mercato ha bisogno della migrazione <code>supabase/migrations/007-mercato-svincolati.sql</code>, da eseguire una volta nell'SQL Editor. Finché non c'è, qui sotto resta il solo elenco.</p></div>
        <div class="vlist"><div class="vhead">Svincolati <span>${liberi.length}</span></div>${liberi.slice(0, 60).map((p) => `<a class="vr" href="#/giocatore/${esc(p.id)}" style="text-decoration:none">${faccia(p, CB(p.id))}<span class="nm"><b>${esc(p.name)}</b><span>${esc(CB(p.id).name)}</span></span><span class="fv">${p.quotation}</span></a>`).join('')}</div>
      </main>`;
    }

    const perRuolo = filtro === 'tutti' ? liberi : liberi.filter((p) => p.role === filtro);
    const elenco = perRuolo.sort((a, b) => b.quotation - a.quotation).slice(0, 60);

    return `<main class="a-body">
      <div class="a-card a-fase"><div class="r"><p><b>${me.credits}</b> crediti<span class="small muted">${impegnati ? ` · ${impegnati} impegnati in offerte` : ''}</span></p>
        <span class="small muted">rosa ${S.rosterOf(me.id).length}/25</span></div>
        <p class="small muted">La prima offerta apre una finestra di <b>24 ore</b>. Dentro la finestra si rilancia, ma la finestra non si allunga: alla scadenza vince la più alta, a parità la prima arrivata.</p></div>

      ${aperte.length ? `<div class="a-sec"><b>Finestre aperte</b><span>${aperte.length}</span></div>${aperte.map(finestra).join('')}` : ''}

      ${fuori.length ? `<div class="a-sec"><b>Fuori dal campionato</b><span>${fuori.length}</span></div>
        <div class="vlist">${fuori.map((p) => `<a class="vr" href="#/giocatore/${esc(p.id)}" style="text-decoration:none">${roleChip(p.role)}<span class="nm"><b style="text-decoration:line-through">${esc(p.name)}</b><span>${esc(CB(p.id).name)} · rimosso d'ufficio · rimborso 50%</span></span><span class="fv sv">50%</span></a>`).join('')}</div>` : ''}

      <div class="a-sec"><b>Svincolati</b><span>${liberi.length}</span></div>
      <div class="scelte">${[['tutti', 'Tutti'], ...ROLE_ORDER.map((r) => [r, ROLE_NAME[r]])].map(([k, l]) => `<button class="chip${filtro === k ? ' on' : ''}" data-filtro="${k}">${l}</button>`).join('')}</div>
      <div class="vlist">${elenco.length ? elenco.map((p) => {
    const ap = S.offertePer(p.id);
    return `<div class="vr">${faccia(p, CB(p.id))}
          <span class="nm"><b>${esc(p.name)}</b><span>${esc(CB(p.id).name)} · quot. ${p.quotation}${ap.length ? ` · <b>${ap[0].crediti}</b> offerti` : ''}</span></span>
          <button class="a-btn sec piccolo" data-rilancia="${esc(p.id)}" data-min="${ap.length ? ap[0].crediti + 1 : 1}">Offri</button></div>`;
  }).join('') : '<p class="small muted" style="padding:12px">Nessuno svincolato in questo ruolo.</p>'}</div>

      <div class="a-card a-rule"><span class="art">Art. 3.3</span><p>Chi lascia il campionato è rimosso d'ufficio dalle rose con un <b>rimborso del 50%</b> di quanto pagato, spendibile solo qui.</p></div>
    </main>`;
  },

  mount(root, ctx) {
    const main = root.querySelector('main');
    main.addEventListener('click', async (e) => {
      const f = e.target.closest('[data-filtro]');
      if (f) { filtro = f.dataset.filtro; ctx.render(); return; }

      const r = e.target.closest('[data-ritira]');
      if (r) {
        r.disabled = true;
        try { await S.ritiraOfferta(r.dataset.ritira); ctx.toast('Offerta ritirata'); ctx.render(); }
        catch (err) { ctx.toast(err.message || 'Non è andata'); r.disabled = false; }
        return;
      }

      const b = e.target.closest('[data-rilancia]');
      if (!b) return;
      const id = b.dataset.rilancia; const minimo = Number(b.dataset.min) || 1;
      const p = P(id); if (!p) return;
      const max = tetto(p.role);
      if (max < minimo) {
        ctx.sheet(`<h3>${esc(p.name)}</h3><p class="auth-hint">Servirebbe${minimo === 1 ? '' : 'ro'} almeno <b>${plurale(minimo, 'credito', 'crediti')}</b> e il massimo che puoi offrire è <b>${max}</b>${S.impegnati() ? `, perché ne hai ${S.impegnati()} già impegnati in altre offerte` : ''}. Un credito per ogni posto ancora vuoto resta da parte: serve a poter completare la rosa.</p>`);
        return;
      }
      ctx.sheet(`<h3>Offerta per ${esc(p.name)}</h3>
        <p class="auth-hint">${esc(roleName(p.role))} del ${esc(CB(p.id).name)} · quotazione ${p.quotation}. Minimo <b>${minimo}</b>, massimo <b>${max}</b>.</p>
        <label class="lbl" for="off">Crediti</label>
        <input class="field-input" id="off" type="number" inputmode="numeric" min="${minimo}" max="${max}" step="1" value="${minimo}">
        <button class="a-btn" id="off-ok" style="margin-top:12px">${icon('check', 'ic sm')}Offri</button>`);
      const campo = document.getElementById('off');
      document.getElementById('off-ok').onclick = async (ev) => {
        const v = Math.trunc(Number(campo.value) || 0);
        if (v < minimo) { ctx.toast(`Almeno ${plurale(minimo, 'credito', 'crediti')}`); return; }
        if (v > max) { ctx.toast(`Massimo ${plurale(max, 'credito', 'crediti')}`); return; }
        ev.target.disabled = true;
        try { await S.offri(id, v); ctx.sheet(null); ctx.toast('Offerta mandata'); ctx.render(); }
        catch (err) { ctx.toast(err.message || 'Non è andata'); ev.target.disabled = false; }
      };
    });
  },
};
