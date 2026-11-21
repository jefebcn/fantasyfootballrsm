import * as S from '../state.js';
import { esc, faccia, t, fmt } from '../ui.js';

// Il Listone: tutti i tesserati, da cercare, filtrare e ordinare. Ordinato per
// gol o per assist è la classifica dei marcatori e degli assistman; «Liberi»
// mostra chi non è in nessuna rosa; la stella tiene i giocatori da seguire
// (restano su questo telefono).
let q = '', role = null, clubId = null, ordine = 'quotazione', soloLiberi = false, soloPreferiti = false;
const PREFERITI = 'fcs:preferiti';
function preferiti() { try { return new Set(JSON.parse(localStorage.getItem(PREFERITI) || '[]')); } catch { return new Set(); } }
function scriviPreferiti(set) { try { localStorage.setItem(PREFERITI, JSON.stringify([...set])); } catch { /* niente */ } }

const ORDINI = {
  quotazione: { etichetta: 'Quotazione', valore: (p) => p.quotation, testo: (p) => String(p.quotation) },
  media: { etichetta: 'Fantamedia', valore: (p, st) => (st?.presenze ? st.media : -1), testo: (p, st) => (st?.presenze ? fmt(st.media) : '–') },
  gol: { etichetta: 'Gol', valore: (p, st) => st?.gol || 0, testo: (p, st) => String(st?.gol || 0) },
  assist: { etichetta: 'Assist', valore: (p, st) => st?.assist || 0, testo: (p, st) => String(st?.assist || 0) },
};

export const listone = {
  title: 'Listone', sub: () => t('Listone · {n} tesserati', { n: S.base.players.length }),
  render() {
    const owners = new Map();
    for (const m of S.base.managers) for (const r of (S.base.rosters[m.id] || [])) { if (!owners.has(r.playerId)) owners.set(r.playerId, []); owners.get(r.playerId).push(m); }
    const stats = S.statisticheStagione();
    const pref = preferiti();
    const o = ORDINI[ordine] || ORDINI.quotazione;
    let list = S.base.players.filter((p) => !p.doppioneDi && (!role || p.role === role) && (!clubId || p.clubId === clubId)
      && (!q || p.name.toLowerCase().includes(q) || p.firstName.toLowerCase().includes(q))
      && (!soloLiberi || (p.isActive && !owners.has(p.id))) && (!soloPreferiti || pref.has(p.id)));
    list = list.sort((a, b) => o.valore(b, stats.get(b.id)) - o.valore(a, stats.get(a.id)) || b.quotation - a.quotation).slice(0, 120);
    // nella lega pubblica un giocatore può stare in più rose: si dice in quante
    const chi = (p) => {
      const os = owners.get(p.id) || [];
      if (!os.length) return t('libero');
      return S.legaPubblica() ? t('in {n} rose', { n: os.length }) : t('di {chi}', { chi: esc(os[0].owner) });
    };
    return `<main class="a-body">
      <div class="topbar" style="padding-top:0"><input class="field-input" id="q" placeholder="${t('Cerca fra {n} tesserati', { n: S.base.players.length })}" value="${esc(q)}" autocomplete="off" style="flex:1"></div>
      <div class="chips sticky"><button class="chip${!role ? ' on' : ''}" data-role="">${t('Tutti')}</button>${['P', 'D', 'C', 'A'].map((r) => `<button class="chip${role === r ? ' on' : ''}" data-role="${r}">${r}</button>`).join('')}<select id="club" class="select" aria-label="${t('Società')}"><option value="">${t('Società')}</option>${S.base.clubs.map((c) => `<option value="${c.id}" ${clubId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
      <div class="chips"><select id="ordine" class="select" aria-label="${t('Ordina per')}">${Object.entries(ORDINI).map(([k, v]) => `<option value="${k}" ${ordine === k ? 'selected' : ''}>${t('Ordina: {cosa}', { cosa: t(v.etichetta) })}</option>`).join('')}</select>
        <button class="chip${soloLiberi ? ' on' : ''}" data-liberi aria-pressed="${soloLiberi}">${t('Liberi')}</button>
        <button class="chip${soloPreferiti ? ' on' : ''}" data-solo-pref aria-pressed="${soloPreferiti}">★ ${t('Preferiti')}${pref.size ? ` ${pref.size}` : ''}</button></div>
      <div class="vlist">${list.length ? list.map((p) => { const cb = S.clubsById.get(p.clubId); const st = stats.get(p.id); const sp = pref.has(p.id); return `<div class="vr li-riga"><a class="li-link" href="#/giocatore/${p.id}" style="text-decoration:none;color:inherit;display:contents">${faccia(p, cb)}<span class="nm"><b${p.isActive ? '' : ' style="text-decoration:line-through"'}>${esc(p.name)}</b><span>${esc(cb.name)} · ${!p.isActive ? `<b style="color:var(--negative)">${t('fuori campionato')}</b>` : chi(p)}${ordine !== 'quotazione' ? ` · ${p.quotation} cr` : ''}</span></span><span class="ev"></span><span class="fv" style="font-size:14px">${o.testo(p, st)}</span></a><button class="li-stella${sp ? ' on' : ''}" data-pref="${esc(p.id)}" aria-pressed="${sp}" aria-label="${sp ? t('Togli dai preferiti') : t('Aggiungi ai preferiti')}">${sp ? '★' : '☆'}</button></div>`; }).join('') : `<p class="small muted" style="text-align:center;padding:20px">${soloPreferiti ? t('Nessun preferito: tocca la stella accanto a un giocatore.') : t('Nessun giocatore con questi filtri.')}</p>`}</div>
      ${list.length === 120 ? `<p class="small muted" style="text-align:center">${t('Mostrati i primi 120: affina la ricerca.')}</p>` : ''}
    </main>`;
  },
  mount(root, ctx) {
    const inp = root.querySelector('#q'); inp.oninput = () => { q = inp.value.trim().toLowerCase(); const list = root.querySelector('.vlist'); const html = listone.render(); const tmp = document.createElement('div'); tmp.innerHTML = html; list.innerHTML = tmp.querySelector('.vlist').innerHTML; };
    root.querySelector('#club').onchange = (e) => { clubId = e.target.value || null; ctx.render(); };
    root.querySelector('#ordine').onchange = (e) => { ordine = e.target.value; ctx.render(); };
    root.querySelector('main').addEventListener('click', (e) => {
      const b = e.target.closest('[data-role]'); if (b) { role = b.dataset.role || null; ctx.render(); return; }
      if (e.target.closest('[data-liberi]')) { soloLiberi = !soloLiberi; ctx.render(); return; }
      if (e.target.closest('[data-solo-pref]')) { soloPreferiti = !soloPreferiti; ctx.render(); return; }
      const st = e.target.closest('[data-pref]');
      if (st) { e.preventDefault(); const pref = preferiti(); const id = st.dataset.pref; if (pref.has(id)) pref.delete(id); else pref.add(id); scriviPreferiti(pref); ctx.render(); }
    });
  },
};
