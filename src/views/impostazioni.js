import * as S from '../state.js';
import { esc, icon, crest } from '../ui.js';
import { applyTheme } from '../app.js';

export const impostazioni = {
  title: 'Impostazioni', appbar: 'back', sub: () => 'Utente, impostazioni e privacy',
  render() {
    const d = S.store.get();
    return `<main class="a-body">
      <div class="a-card"><label class="lbl">Io sono</label><div class="plist">${S.base.managers.map((m) => `<button data-me="${m.id}" style="${m.id === d.userManagerId ? 'background:var(--primary-soft);border-radius:8px' : ''}">${crest(m, 'sm')}<span><b>${esc(m.teamName)}</b><span>${esc(m.owner)} · crediti ${m.credits}</span></span><span>${m.id === d.userManagerId ? icon('check', 'ic sm') : ''}</span></button>`).join('')}</div></div>
      <div class="a-card"><label class="lbl">Ruolo nella lega</label><div class="seg">${[['fantallenatore', 'Fantallenatore'], ['admin', 'Admin di lega'], ['giudice', 'Giudice Dati']].map(([k, l]) => `<button class="${d.role === k ? 'on' : ''}" data-role="${k}">${l}</button>`).join('')}</div><p class="small muted" style="margin-top:8px">Nel pilota il ruolo si sceglie qui; con gli account (Fase 2) lo assegna l'admin.</p></div>
      <div class="a-card"><label class="lbl">Tema</label><div class="seg">${[['system', 'Sistema'], ['light', 'Chiaro'], ['dark', 'Scuro']].map(([k, l]) => `<button class="${d.theme === k ? 'on' : ''}" data-theme="${k}">${l}</button>`).join('')}</div></div>
      <div class="a-card"><label class="lbl">Dati</label><p class="small muted">Formazioni, eventi inseriti e contestazioni sono salvati solo su questo dispositivo. Il listone e il calendario sono generati dalla stagione pilota: i giocatori sono inventati (art. 14.1).</p><button class="a-btn sec" id="reset" style="margin-top:10px">Azzera i dati locali</button></div>
      <div class="a-card"><label class="lbl">Privacy</label><p class="small muted">Nessun dato lascia il dispositivo. Il gioco userà nomi e prestazioni di atleti dilettanti solo previo accordo con la FSGC e informativa ai tesserati (art. 14).</p></div>
      <p class="small muted" style="text-align:center">Versione 0.1 · pilota · motore ${S.rules().engineVersion}</p>
    </main>`;
  },
  mount(root, ctx) {
    root.querySelector('main').addEventListener('click', (e) => {
      const me = e.target.closest('[data-me]'); if (me) { S.store.set({ userManagerId: me.dataset.me }); ctx.toast(`Ora sei ${S.me().owner}`); return; }
      const r = e.target.closest('[data-role]'); if (r) { S.store.set({ role: r.dataset.role }); return; }
      const t = e.target.closest('[data-theme]'); if (t) { S.store.set({ theme: t.dataset.theme }); applyTheme(); return; }
      if (e.target.closest('#reset')) { if (confirm('Azzero formazioni, eventi e contestazioni salvati su questo dispositivo?')) { S.resetAll(); location.reload(); } }
    });
  },
};
