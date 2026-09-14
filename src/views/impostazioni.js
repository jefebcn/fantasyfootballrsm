import * as S from '../state.js';
import { esc, icon, crest, pic } from '../ui.js';
import { applyTheme } from '../app.js';

const row = (ic, title, sub, action = '', cls = '') => `<button class="setting ${cls}" ${action ? `data-act="${action}"` : 'disabled style="cursor:default"'}><i class="ico${typeof ic === 'object' ? ' illus' : ''}">${typeof ic === 'object' ? pic(ic.m, 'menu') : icon(ic)}</i><span class="txt"><b>${title}</b>${sub ? `<span>${sub}</span>` : ''}</span>${action ? icon('chev', 'ic sm chev') : ''}</button>`;
const group = (title, inner) => `<section class="group"><h3>${title}</h3>${inner}</section>`;

export const impostazioni = {
  title: 'Impostazioni', appbar: 'back', sub: () => 'Utente, impostazioni e privacy',
  render() {
    const d = S.store.get(); const u = S.currentUser(); const p = S.profileInfo(); const me = S.me();

    const account = group('Account', `
      <div class="setting" style="cursor:default">${crest({ color: me?.color || 'var(--primary)', initials: me?.initials || (p?.display_name || 'AA').slice(0, 2).toUpperCase() }, 'sm')}<span class="txt"><b>${esc(p?.display_name || '')}</b><span>${esc(u?.email || '')}${p?.is_judge ? ' · Giudice Dati' : ''}</span></span></div>
      ${S.authKind() === 'clerk'
        ? row('gear', 'Gestisci account', 'Nome, e-mail, password e accessi collegati', 'clerk-profile')
        : row({ m: 'vice-allenatore' }, 'Cambia nome', 'Come ti vedono gli altri nella lega', 'name') + row('shield', 'Cambia password', 'Imposta una nuova password per questo account', 'password')}
      ${row('out', 'Esci', 'Torni alla schermata di accesso', 'logout', 'danger')}`);

    const league = S.hasLeague() ? group('Lega', `
      ${row({ m: 'squadre' }, esc(S.base.league.name), `${S.base.managers.length} partecipanti${S.base.league.inviteCode ? ` · codice ${esc(S.base.league.inviteCode)}` : ''}`, 'lega')}
      ${row({ m: 'leghe' }, 'Cambia o crea lega', `${S.myLeagues().length} ${S.myLeagues().length === 1 ? 'lega' : 'leghe'} · entra con un codice invito`, 'leghe')}
      ${row({ m: 'guide' }, 'Regolamento ed opzioni', 'Voto Titano, bonus, soglie di conversione', 'regolamento')}`)
      : group('Lega', row({ m: 'leghe' }, 'Entra in una lega', 'Crea la tua oppure usa un codice invito', 'leghe'));

    const judge = p?.is_judge ? group('Giudice Dati', `
      ${row({ m: 'voti' }, 'Inserisci eventi', `Giornata ${S.currentMatchday()}`, 'admin')}
      ${row({ m: 'statistiche' }, 'Carica le giornate giocate', 'Formazioni, marcatori, assist e cartellini veri dai tabellini FSGC', 'seed')}`) : '';

    const look = group('Aspetto', `<div class="a-card"><label class="lbl">Tema</label><div class="seg">${[['system', 'Sistema'], ['light', 'Chiaro'], ['dark', 'Scuro']].map(([k, l]) => `<button class="${d.theme === k ? 'on' : ''}" data-theme="${k}">${l}</button>`).join('')}</div></div>`);

    const data = group('Dati e privacy', `
      ${row({ m: 'quotazioni' }, 'Da dove vengono i dati', 'Lega, formazioni e voti sul server; listone e calendario generati dall\'app')}
      ${row('shield', 'Atleti e società', 'Nomi e prestazioni useranno dati reali solo previo accordo FSGC (art. 14)')}
      ${row('gear', 'Server della lega', esc((S.serverHost() || '—')), 'server')}
      ${row('shield', 'Diagnostica accessi', 'Controlla sul progetto cosa manca ancora per far entrare la gente', 'diagnostica')}`);

    return `<main class="a-body">${account}${league}${judge}${look}${data}
      <p class="auth-foot">Versione 0.5 · motore ${S.rules().engineVersion}</p></main>`;
  },

  mount(root, ctx) {
    const prompt2 = (title, label, attrs, onSave) => {
      ctx.sheet(`<h3>${title}</h3><label class="lbl" for="pv">${label}</label><input class="field-input" id="pv" ${attrs}><button class="a-btn" id="pv-save" style="margin-top:12px">Salva</button>`);
      document.getElementById('pv-save').onclick = () => onSave(document.getElementById('pv').value.trim());
    };
    root.querySelector('main').addEventListener('click', async (e) => {
      const t = e.target.closest('[data-theme]'); if (t) { S.store.set({ theme: t.dataset.theme }); applyTheme(); return; }
      const a = e.target.closest('[data-act]'); if (!a) return;
      const act = a.dataset.act;
      if (act === 'logout') { await S.signOut(); ctx.go('login'); return; }
      if (act === 'clerk-profile') { S.clerkProfile(); return; }
      if (act === 'lega') { ctx.go('lega'); return; }
      if (act === 'leghe') { ctx.go('leghe'); return; }
      if (act === 'regolamento') { ctx.go('regolamento'); return; }
      if (act === 'admin') { ctx.go('admin'); return; }
      if (act === 'diagnostica') {
        ctx.sheet('<h3>Diagnostica accessi</h3><p class="auth-hint">Lettura in corso dal progetto\u2026</p>');
        let esiti; try { esiti = await S.checkSetup(); } catch (err) { ctx.sheet(`<h3>Diagnostica accessi</h3><p class="auth-hint">${esc(err?.message || String(err))}</p>`); return; }
        const segno = { ok: '\u2713', attenzione: '!', errore: '\u2715', info: 'i' };
        ctx.sheet(`<h3>Diagnostica accessi</h3>
          <div class="diag">${esiti.map((r) => `<div class="d-r ${r.livello}"><i>${segno[r.livello]}</i><span><b>${esc(r.voce)}</b><span>${esc(r.esito)}</span>${r.dove ? `<small>${esc(r.dove)}</small>` : ''}</span></div>`).join('')}</div>
          <p class="auth-hint">Gli interruttori stanno nel pannello Supabase: qui si legge soltanto come sono messi adesso.</p>`);
        return;
      }
      if (act === 'server') {
        ctx.sheet(`<h3>Server della lega</h3><p class="auth-hint">Valori pubblici del progetto Supabase (Settings → API). Cambiarli scollega questo dispositivo dalla lega attuale.</p>
          <label class="lbl" for="sv-url" style="margin-top:8px">Project URL</label><input class="field-input" id="sv-url" value="${esc(S.serverUrl() || '')}" autocomplete="off">
          <label class="lbl" for="sv-key" style="margin-top:8px">Publishable / anon key</label><input class="field-input" id="sv-key" placeholder="lascia vuoto per non cambiarla" autocomplete="off">
          <button class="a-btn" id="sv-save" style="margin-top:12px">Collega</button>`);
        document.getElementById('sv-save').onclick = () => {
          const url = document.getElementById('sv-url').value.trim().replace(/\/$/, ''); const key = document.getElementById('sv-key').value.trim() || S.serverKey();
          if (!/^https:\/\/.+\.supabase\.co$/.test(url) || !key || key.length < 20) { ctx.toast('URL o chiave non validi'); return; }
          S.setSupabaseConfig(url, key);
        };
        return;
      }
      if (act === 'seed') { if (!confirm('Caricare nel database le giornate già giocate, con formazioni ed eventi veri presi dai tabellini della FSGC?')) return; try { await S.seedSampleData(); ctx.toast('Giornate giocate caricate'); } catch (err) { ctx.toast(err.message); } return; }
      if (act === 'password') { prompt2('Cambia password', 'Nuova password', 'type="password" autocomplete="new-password" placeholder="almeno 6 caratteri"', async (v) => { if (v.length < 6) { ctx.toast('Almeno 6 caratteri'); return; } try { await S.updatePassword(v); ctx.sheet(null); ctx.toast('Password aggiornata'); } catch (err) { ctx.toast(err.message); } }); return; }
      if (act === 'name') { prompt2('Cambia nome', 'Come ti chiami', `maxlength="24" value="${esc(S.profileInfo()?.display_name || '')}"`, async (v) => { if (!v) { ctx.toast('Scrivi un nome'); return; } try { await S.updateDisplayName(v); ctx.sheet(null); ctx.toast('Nome aggiornato'); } catch (err) { ctx.toast(err.message); } }); }
    });
  },
};
