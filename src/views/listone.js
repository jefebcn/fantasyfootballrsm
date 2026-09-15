import * as S from '../state.js';
import { esc, fmt, icon, faccia, ROLE_NAME } from '../ui.js';

let q = '', role = null, clubId = null;
export const listone = {
  title: 'Listone', sub: () => `Listone · ${S.base.players.length} tesserati`,
  render() {
    const owner = new Map(); for (const m of S.base.managers) for (const r of S.base.rosters[m.id]) owner.set(r.playerId, m);
    let list = S.base.players.filter((p) => (!role || p.role === role) && (!clubId || p.clubId === clubId) && (!q || p.name.toLowerCase().includes(q) || p.firstName.toLowerCase().includes(q)));
    list = list.sort((a, b) => b.quotation - a.quotation).slice(0, 120);
    return `<main class="a-body">
      <div class="topbar" style="padding-top:0"><input class="field-input" id="q" placeholder="Cerca fra ${S.base.players.length} tesserati" value="${esc(q)}" autocomplete="off" style="flex:1"></div>
      <div class="chips sticky"><button class="chip${!role ? ' on' : ''}" data-role="">Tutti</button>${['P', 'D', 'C', 'A'].map((r) => `<button class="chip${role === r ? ' on' : ''}" data-role="${r}">${r}</button>`).join('')}<select id="club" class="select" aria-label="Società"><option value="">Società</option>${S.base.clubs.map((c) => `<option value="${c.id}" ${clubId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
      <div class="vlist">${list.map((p) => { const o = owner.get(p.id); const cb = S.clubsById.get(p.clubId); return `<a class="vr" href="#/giocatore/${p.id}" style="text-decoration:none">${faccia(p, cb)}<span class="nm"><b${p.isActive ? '' : ' style="text-decoration:line-through"'}>${esc(p.name)}</b><span>${esc(cb.name)} · ${!p.isActive ? '<b style="color:var(--negative)">fuori campionato</b>' : o ? `di ${esc(o.owner)}` : 'libero'}</span></span><span class="ev"></span><span class="fv" style="font-size:14px">${p.quotation}</span></a>`; }).join('')}</div>
      ${list.length === 120 ? '<p class="small muted" style="text-align:center">Mostrati i primi 120: affina la ricerca.</p>' : ''}
    </main>`;
  },
  mount(root, ctx) {
    const inp = root.querySelector('#q'); inp.oninput = () => { q = inp.value.trim().toLowerCase(); const list = root.querySelector('.vlist'); const html = listone.render(); const tmp = document.createElement('div'); tmp.innerHTML = html; list.innerHTML = tmp.querySelector('.vlist').innerHTML; };
    root.querySelector('#club').onchange = (e) => { clubId = e.target.value || null; ctx.render(); };
    root.querySelector('main').addEventListener('click', (e) => { const b = e.target.closest('[data-role]'); if (b) { role = b.dataset.role || null; ctx.render(); } });
  },
};
