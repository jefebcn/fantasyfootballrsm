import * as S from '../state.js';
import { esc, icon, crest } from '../ui.js';
import { applyTheme } from '../app.js';

const row = (ic, title, sub, action = '', cls = '') => `<button class="setting ${cls}" ${action ? `data-act="${action}"` : 'disabled style="cursor:default"'}><i class="ico">${icon(ic)}</i><span class="txt"><b>${title}</b>${sub ? `<span>${sub}</span>` : ''}</span>${action ? icon('chev', 'ic sm chev') : ''}</button>`;
const group = (title, inner) => `<section class="group"><h3>${title}</h3>${inner}</section>`;

export const impostazioni = {
  title: 'Impostazioni', appbar: 'back', sub: () => 'Utente, impostazioni e privacy',
  render() {
    const d = S.store.get(); const remote = S.isRemote(); const u = S.currentUser(); const p = S.profileInfo(); const err = S.connectionError();
    const me = S.me();

    const account = remote
      ? group('Account', `
          <div class="setting" style="cursor:default">${crest({ color: me?.color || 'var(--primary)', initials: me?.initials || (p?.display_name || 'AA').slice(0, 2).toUpperCase() }, 'sm')}<span class="txt"><b>${esc(p?.display_name || '')}</b><span>${esc(u?.email || '')}${p?.is_judge ? ' · Giudice Dati' : ''}</span></span></div>
          ${row('shield', 'Cambia password', 'Imposta una nuova password per questo account', 'password')}
          ${row('out', 'Esci', 'Torni alla schermata di accesso', 'logout', 'danger')}`)
      : group('Account', `
          ${err ? `<div class="warn block">${icon('warn', 'ic sm')}<span>${esc(err.message)}</span></div>${row('gear', 'Riprova la connessione', 'Ricollega l\'app al server della lega', 'retry')}`
                : S.supabaseConfigured() ? row('shield', 'Accedi con un account', 'Leghe condivise, formazioni e voti per tutti', 'remote')
                : row('warn', 'Nessun server collegato', 'Collega un progetto Supabase qui sotto per le leghe multiple')}
          <p class="auth-hint" style="padding:0 4px">Sei in <b>modalità demo</b>: dati generati, tutto sul dispositivo.</p>`);

    const league = S.hasLeague() ? group('Lega', `
      ${row('users', esc(S.base.league.name), `${S.base.managers.length} partecipanti${S.base.league.inviteCode ? ` · codice ${esc(S.base.league.inviteCode)}` : ''}`, 'lega')}
      ${remote ? row('cup', 'Cambia lega', `${S.myLeagues().length} leghe · creane una o entra con un codice`, 'leghe') : ''}
      ${row('book', 'Regolamento ed opzioni', 'Voto Titano, bonus, soglie di conversione', 'regolamento')}`) : '';

    const judge = remote && p?.is_judge ? group('Giudice Dati', `
      ${row('edit', 'Inserisci eventi', `Giornata ${S.currentMatchday()}`, 'admin')}
      ${row('archive', 'Carica dati demo', 'Eventi generati delle giornate 1–2, per provare l\'app', 'seed')}`) : '';

    const identity = remote ? '' : group('Identità (demo)', `
      <div class="a-card"><label class="lbl">Io sono</label><div class="plist">${S.base.managers.map((m) => `<button data-me="${m.id}" style="${m.id === d.userManagerId ? 'background:var(--primary-soft);border-radius:8px' : ''}">${crest(m, 'sm')}<span><b>${esc(m.teamName)}</b><span>${esc(m.owner)} · crediti ${m.credits}</span></span><span>${m.id === d.userManagerId ? icon('check', 'ic sm') : ''}</span></button>`).join('')}</div></div>
      <div class="a-card"><label class="lbl">Ruolo</label><div class="seg">${[['fantallenatore', 'Fantallenatore'], ['admin', 'Admin'], ['giudice', 'Giudice Dati']].map(([k, l]) => `<button class="${d.role === k ? 'on' : ''}" data-role="${k}">${l}</button>`).join('')}</div></div>`);

    const look = group('Aspetto', `<div class="a-card"><label class="lbl">Tema</label><div class="seg">${[['system', 'Sistema'], ['light', 'Chiaro'], ['dark', 'Scuro']].map(([k, l]) => `<button class="${d.theme === k ? 'on' : ''}" data-theme="${k}">${l}</button>`).join('')}</div></div>`);

    const server = group('Server', `<div class="a-card">
        <label class="lbl">Connessione Supabase</label>
        <p class="auth-hint">Chiavi pubbliche del progetto (Settings → API). ${S.supabaseConfigured() ? 'Già configurate nell\'app: qui puoi puntare a un altro progetto.' : 'Inserendole qui restano solo su questo dispositivo.'}</p>
        <label class="lbl" for="sb-url" style="margin-top:10px">Project URL</label><input class="field-input" id="sb-url" placeholder="https://xxxx.supabase.co" autocomplete="off">
        <label class="lbl" for="sb-key" style="margin-top:8px">Publishable / anon key</label><input class="field-input" id="sb-key" placeholder="sb_publishable_… oppure eyJ…" autocomplete="off">
        <div class="row2" style="margin-top:12px"><button class="a-btn" id="sb-save" style="height:42px">Collega</button><button class="a-btn sec" id="sb-clear" style="height:42px">Scollega</button></div>
      </div>`);

    const data = group('Dati e privacy', `
      ${row('list', 'Da dove vengono i dati', remote ? 'Lega e voti condivisi sul server; listone e calendario generati dall\'app' : 'Tutto generato e salvato su questo dispositivo')}
      ${row('shield', 'Atleti e società', 'Nomi e prestazioni useranno dati reali solo previo accordo FSGC (art. 14)')}
      ${row('out', 'Azzera i dati locali', 'Preferenze, formazioni e dati demo di questo dispositivo', 'reset', 'danger')}`);

    return `<main class="a-body">${account}${league}${judge}${identity}${look}${server}${data}
      <p class="auth-foot">Versione 0.3 · motore ${S.rules().engineVersion} · ${remote ? 'account Supabase' : 'demo locale'}</p></main>`;
  },

  mount(root, ctx) {
    root.querySelector('main').addEventListener('click', async (e) => {
      const a = e.target.closest('[data-act]');
      if (a) {
        const act = a.dataset.act;
        if (act === 'logout') { await S.signOut(); ctx.go('login'); return; }
        if (act === 'remote') { S.useRemote(); return; }
        if (act === 'retry') { ctx.toast('Riprovo…'); const ok = await S.retryRemote(); ctx.toast(ok ? 'Connesso' : S.connectionError().message); if (ok) ctx.go('login'); return; }
        if (act === 'lega') { ctx.go('lega'); return; }
        if (act === 'leghe') { ctx.go('leghe'); return; }
        if (act === 'regolamento') { ctx.go('regolamento'); return; }
        if (act === 'admin') { ctx.go('admin'); return; }
        if (act === 'seed') { if (!confirm('Caricare nel database gli eventi demo delle giornate 1–2?')) return; try { await S.seedDemo(); ctx.toast('Dati demo caricati'); } catch (err) { ctx.toast(err.message); } return; }
        if (act === 'reset') { if (confirm('Azzero preferenze e dati demo salvati su questo dispositivo?')) { S.resetAll(); location.reload(); } return; }
        if (act === 'password') {
          ctx.sheet(`<h3>Cambia password</h3><label class="lbl" for="np">Nuova password</label><input class="field-input" id="np" type="password" autocomplete="new-password" placeholder="almeno 6 caratteri"><button class="a-btn" id="np-save" style="margin-top:12px">Salva</button>`);
          document.getElementById('np-save').onclick = async () => {
            const v = document.getElementById('np').value.trim(); if (v.length < 6) { ctx.toast('Almeno 6 caratteri'); return; }
            try { await S.updatePassword(v); ctx.sheet(null); ctx.toast('Password aggiornata'); } catch (err) { ctx.toast(err.message); }
          };
          return;
        }
      }
      const me = e.target.closest('[data-me]'); if (me) { S.store.set({ userManagerId: me.dataset.me }); ctx.toast(`Ora sei ${S.me().owner}`); return; }
      const r = e.target.closest('[data-role]'); if (r) { S.store.set({ role: r.dataset.role }); return; }
      const t = e.target.closest('[data-theme]'); if (t) { S.store.set({ theme: t.dataset.theme }); applyTheme(); return; }
      if (e.target.closest('#sb-save')) { const url = root.querySelector('#sb-url').value.trim(), key = root.querySelector('#sb-key').value.trim(); if (!/^https:\/\/.+\.supabase\.co\/?$/.test(url) || key.length < 20) { ctx.toast('URL o chiave non validi'); return; } S.setSupabaseConfig(url.replace(/\/$/, ''), key); return; }
      if (e.target.closest('#sb-clear')) { S.setSupabaseConfig('', ''); }
    });
  },
};
