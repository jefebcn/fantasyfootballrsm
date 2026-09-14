import * as S from '../state.js';
import { esc, icon, crest, logo } from '../ui.js';

const COLORS = ['#1B84C6', '#2b7a3d', '#8a1d1d', '#5b3fa6', '#c46a00', '#1a1a1a', '#2c7a7b', '#b8321f', '#d4a017', '#0e5e93'];
let form = 'none'; // 'create' | 'join'
const teamFields = () => `<label class="lbl" for="team">Nome della tua squadra</label><input class="field-input" id="team" placeholder="es. Hasta El Chapo FC" maxlength="28">
  <label class="lbl" for="color" style="margin-top:8px">Colore</label><div class="chipgrid" id="colors">${COLORS.map((c, i) => `<button class="chip${i === 0 ? ' on' : ''}" data-color="${c}" style="width:34px;height:34px;padding:0;background:${c};border-color:${c}" aria-label="${c}"></button>`).join('')}</div>`;

export const leghe = {
  title: 'Le mie leghe', appbar: () => (S.hasLeague() ? 'main' : 'none'), sub: () => 'Le mie leghe',
  render() {
    const mine = S.myLeagues(); const cur = S.currentLeagueId();
    return `<main class="a-body">
      ${mine.length ? '' : `<div class="auth-hero" style="padding-top:20px">${logo('auth-mark')}<h1 style="font-size:22px">Benvenuto${S.profileInfo()?.display_name ? `, ${esc(S.profileInfo().display_name)}` : ''}</h1><p>Crea la tua lega e invita gli altri con un codice, oppure entra in una lega esistente.</p></div>`}
      ${mine.length ? `<div class="vlist"><div class="vhead">Leghe <span>${mine.length}</span></div>${mine.map((l) => `<button class="vr" data-league="${l.id}">${crest({ color: l.id === cur ? 'var(--primary)' : 'var(--c-pietra-400)', initials: (l.short_name || l.name).slice(0, 2).toUpperCase() }, 'sm')}<span class="nm"><b>${esc(l.name)}</b><span>${l.myRole === 'admin' ? 'admin' : 'fantallenatore'} · ${l.started ? 'in corso' : 'in attesa delle rose'} · codice ${esc(l.invite_code)}</span></span><span class="ev"></span><span class="fv" style="font-size:12px">${l.id === cur ? icon('check', 'ic sm') : ''}</span></button>`).join('')}</div>` : ''}
      <div class="row2"><button class="a-btn${form === 'create' ? '' : ' sec'}" data-form="create">Crea una lega</button><button class="a-btn${form === 'join' ? '' : ' sec'}" data-form="join">Entra con codice</button></div>
      ${form === 'create' ? `<div class="a-card" style="display:flex;flex-direction:column;gap:6px"><label class="lbl" for="lname">Nome della lega</label><input class="field-input" id="lname" placeholder="es. I Sudati di RSM" maxlength="40">${teamFields()}<button class="a-btn" id="go-create" style="margin-top:10px">Crea e diventa admin</button></div>` : ''}
      ${form === 'join' ? `<div class="a-card" style="display:flex;flex-direction:column;gap:6px"><label class="lbl" for="code">Codice invito</label><input class="field-input" id="code" placeholder="es. A1B2C3" autocapitalize="characters" maxlength="6">${teamFields()}<button class="a-btn" id="go-join" style="margin-top:10px">Entra nella lega</button></div>` : ''}
    </main>`;
  },
  mount(root, ctx) {
    let color = COLORS[0];
    root.querySelector('main').addEventListener('click', async (e) => {
      const f = e.target.closest('[data-form]'); if (f) { form = form === f.dataset.form ? 'none' : f.dataset.form; ctx.render(); return; }
      const c = e.target.closest('[data-color]'); if (c) { color = c.dataset.color; root.querySelectorAll('[data-color]').forEach((b) => b.classList.toggle('on', b === c)); return; }
      const l = e.target.closest('[data-league]'); if (l) { await S.switchLeague(l.dataset.league); ctx.go(''); return; }
      const team = () => { const t = root.querySelector('#team')?.value.trim(); if (!t) { ctx.toast('Dai un nome alla tua squadra'); return null; } return t; };
      const initials = (t) => t.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
      if (e.target.closest('#go-create')) { const name = root.querySelector('#lname').value.trim(); const t = team(); if (!name) { ctx.toast('Dai un nome alla lega'); return; } if (!t) return;
        try { await S.createLeague(name, t, color, initials(t)); ctx.toast('Lega creata'); form = 'none'; ctx.go('lega'); } catch (err) { ctx.toast(err.message); } return; }
      if (e.target.closest('#go-join')) { const code = root.querySelector('#code').value.trim(); const t = team(); if (code.length < 4) { ctx.toast('Inserisci il codice invito'); return; } if (!t) return;
        try { await S.joinLeague(code, t, color, initials(t)); ctx.toast('Sei dentro'); form = 'none'; ctx.go(''); } catch (err) { ctx.toast(err.message); } }
    });
  },
};
