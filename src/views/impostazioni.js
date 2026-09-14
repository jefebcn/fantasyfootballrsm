import * as S from '../state.js';
import { esc, icon, crest } from '../ui.js';
import { applyTheme } from '../app.js';

export const impostazioni = {
  title: 'Impostazioni', appbar: 'back', sub: () => 'Utente, impostazioni e privacy',
  render() {
    const d = S.store.get(); const remote = S.isRemote(); const u = S.currentUser(); const p = S.profileInfo();
    const account = remote
      ? `<div class="a-card"><label class="lbl">Account</label><p><b>${esc(p?.display_name || '')}</b><br><span class="small muted">${esc(u?.email || '')}${p?.is_judge ? ' · Giudice Dati' : ''}</span></p><div class="row2" style="margin-top:10px"><a class="a-btn sec" href="#/leghe" style="text-decoration:none;height:40px">Le mie leghe</a><button class="a-btn sec" id="logout" style="height:40px">Esci</button></div>${p?.is_judge ? `<button class="a-btn sec" id="seed" style="margin-top:10px;height:40px">Carica dati demo (giornate 1–2)</button><p class="small muted" style="margin-top:6px">Inserisce nel database gli eventi generati della stagione pilota, per provare l'app con dati. Solo su tabelle vuote.</p>` : ''}</div>`
      : `<div class="a-card"><label class="lbl">Account</label><p class="small muted">Sei in modalità locale (demo). ${S.supabaseConfigured() ? 'Supabase è configurato: puoi accedere con la tua e-mail.' : 'Per account e leghe multiple collega un progetto Supabase.'}</p>${S.supabaseConfigured() ? `<button class="a-btn" id="go-remote" style="margin-top:10px">Accedi con e-mail</button>` : ''}</div>`;
    const localIdentity = remote ? '' : `<div class="a-card"><label class="lbl">Io sono (demo)</label><div class="plist">${S.base.managers.map((m) => `<button data-me="${m.id}" style="${m.id === d.userManagerId ? 'background:var(--primary-soft);border-radius:8px' : ''}">${crest(m, 'sm')}<span><b>${esc(m.teamName)}</b><span>${esc(m.owner)} · crediti ${m.credits}</span></span><span>${m.id === d.userManagerId ? icon('check', 'ic sm') : ''}</span></button>`).join('')}</div></div>
      <div class="a-card"><label class="lbl">Ruolo nella lega (demo)</label><div class="seg">${[['fantallenatore', 'Fantallenatore'], ['admin', 'Admin di lega'], ['giudice', 'Giudice Dati']].map(([k, l]) => `<button class="${d.role === k ? 'on' : ''}" data-role="${k}">${l}</button>`).join('')}</div><p class="small muted" style="margin-top:8px">Con gli account il ruolo admin lo assegna la lega, il Giudice Dati si nomina dal database.</p></div>`;
    return `<main class="a-body">
      ${account}${localIdentity}
      <div class="a-card"><label class="lbl">Tema</label><div class="seg">${[['system', 'Sistema'], ['light', 'Chiaro'], ['dark', 'Scuro']].map(([k, l]) => `<button class="${d.theme === k ? 'on' : ''}" data-theme="${k}">${l}</button>`).join('')}</div></div>
      <div class="a-card"><label class="lbl">Connessione Supabase</label><p class="small muted">Chiavi pubbliche del progetto (Settings → API). Salvate solo su questo dispositivo; in produzione stanno in <code>src/config.js</code>.</p><label class="lbl" for="sb-url" style="margin-top:8px">Project URL</label><input class="field-input" id="sb-url" placeholder="https://xxxx.supabase.co" autocomplete="off"><label class="lbl" for="sb-key" style="margin-top:8px">Anon key</label><input class="field-input" id="sb-key" placeholder="eyJ…" autocomplete="off"><div class="row2" style="margin-top:10px"><button class="a-btn" id="sb-save" style="height:40px">Collega</button><button class="a-btn sec" id="sb-clear" style="height:40px">Scollega</button></div></div>
      <div class="a-card"><label class="lbl">Dati</label><p class="small muted">${remote ? 'Formazioni, eventi e contestazioni sono condivisi nella lega tramite Supabase.' : 'Formazioni, eventi e contestazioni sono salvati solo su questo dispositivo.'} Il listone e il calendario sono generati dalla stagione pilota: i giocatori sono inventati (art. 14.1).</p><button class="a-btn sec" id="reset" style="margin-top:10px">Azzera i dati locali</button></div>
      <div class="a-card"><label class="lbl">Privacy</label><p class="small muted">Il gioco userà nomi e prestazioni di atleti dilettanti solo previo accordo con la FSGC e informativa ai tesserati (art. 14).</p></div>
      <p class="small muted" style="text-align:center">Versione 0.2 · motore ${S.rules().engineVersion}</p>
    </main>`;
  },
  mount(root, ctx) {
    root.querySelector('main').addEventListener('click', async (e) => {
      const me = e.target.closest('[data-me]'); if (me) { S.store.set({ userManagerId: me.dataset.me }); ctx.toast(`Ora sei ${S.me().owner}`); return; }
      const r = e.target.closest('[data-role]'); if (r) { S.store.set({ role: r.dataset.role }); return; }
      const t = e.target.closest('[data-theme]'); if (t) { S.store.set({ theme: t.dataset.theme }); applyTheme(); return; }
      if (e.target.closest('#logout')) { await S.signOut(); ctx.go('login'); return; }
      if (e.target.closest('#go-remote')) { S.useRemote(); return; }
      if (e.target.closest('#seed')) { if (!confirm('Caricare nel database gli eventi demo delle giornate 1–2?')) return; try { await S.seedDemo(); ctx.toast('Dati demo caricati'); } catch (err) { ctx.toast(err.message); } return; }
      if (e.target.closest('#sb-save')) { const url = root.querySelector('#sb-url').value.trim(), key = root.querySelector('#sb-key').value.trim(); if (!/^https:\/\/.+\.supabase\.co$/.test(url) || key.length < 20) { ctx.toast('URL o chiave non validi'); return; } S.setSupabaseConfig(url, key); return; }
      if (e.target.closest('#sb-clear')) { S.setSupabaseConfig('', ''); return; }
      if (e.target.closest('#reset')) { if (confirm('Azzero le preferenze e i dati demo salvati su questo dispositivo?')) { S.resetAll(); location.reload(); } }
    });
  },
};
