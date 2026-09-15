import * as S from '../state.js';
import { esc, icon, crest, pic } from '../ui.js';
import { applyTheme } from '../app.js';
import { CONTATTO, LINGUE } from '../config.js';

const row = (ic, title, sub, action = '', cls = '') => `<button class="setting ${cls}" ${action ? `data-act="${action}"` : 'disabled style="cursor:default"'}><i class="ico${typeof ic === 'object' ? ' illus' : ''}">${typeof ic === 'object' ? pic(ic.m, 'menu') : icon(ic)}</i><span class="txt"><b>${title}</b>${sub ? `<span>${sub}</span>` : ''}</span>${action ? icon('chev', 'ic sm chev') : ''}</button>`;
/**
 * Preferenze notifiche. Il permesso lo chiede davvero il browser, e il testo
 * dice fino a dove arrivano: il promemoria scatta all'apertura dell'app, non
 * a telefono chiuso, perché per quello serve un server push che non c'è.
 */
function apriAvvisi(ctx) {
  const disegna = () => {
    const d = S.store.get(); const on = d.avvisi !== false;
    const perm = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
    ctx.sheet(`<h3>Preferenze notifiche</h3>
      <button class="setting" data-avvisi="${on ? 'off' : 'on'}"><i class="ico">${icon('bell')}</i>
        <span class="txt"><b>Promemoria della formazione</b><span>Un avviso quando manca poco al lock e non hai ancora schierato</span></span>
        <span class="sw${on ? ' on' : ''}"></span></button>
      ${on && perm === 'default' ? `<button class="a-btn" data-avvisi="permesso" style="margin-top:10px">Consenti le notifiche</button>` : ''}
      ${perm === 'denied' ? `<p class="auth-hint">Le notifiche sono bloccate dalle impostazioni del telefono per questo sito: vanno riattivate da lì.</p>` : ''}
      <p class="auth-hint">L'avviso compare quando apri l'app. Per riceverlo a telefono chiuso serve un server che spedisca le notifiche push, e non è ancora acceso: quando lo sarà, questa preferenza varrà anche per quello.</p>`);
    const sh = document.getElementById('sheet');
    sh.onclick = async (e) => {
      const b = e.target.closest('[data-avvisi]'); if (!b) return;
      const v = b.dataset.avvisi;
      if (v === 'permesso') { try { await Notification.requestPermission(); } catch { /* negato */ } disegna(); return; }
      S.store.set({ avvisi: v === 'on' });
      if (v === 'on' && typeof Notification !== 'undefined' && Notification.permission === 'default') {
        try { await Notification.requestPermission(); } catch { /* negato */ }
      }
      disegna();
    };
  };
  disegna();
}

const group = (title, inner) => `<section class="group"><h3>${title}</h3>${inner}</section>`;

/** Le notifiche vere (push sul telefono) hanno bisogno di un server che non
 *  c'è ancora: qui si prepara la preferenza e si dice come stanno le cose. */
const avvisiSottotitolo = (d) => {
  const on = d.avvisi !== false;
  const perm = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
  if (!on) return 'Spenti';
  if (perm === 'granted') return 'Promemoria della formazione attivi';
  if (perm === 'denied') return 'Bloccati dal telefono';
  return 'Da attivare';
};

export const impostazioni = {
  title: 'Profilo', appbar: 'back', sub: () => 'Account, preferenze e privacy',
  render() {
    const d = S.store.get(); const u = S.currentUser(); const p = S.profileInfo(); const me = S.me();

    const ruolo = p?.is_judge ? 'Giudice Dati' : me?.role === 'admin' ? 'Amministratore di lega' : me ? 'Fantallenatore' : 'Nessuna lega';
    const iniziale = (p?.display_name || u?.email || '?').trim()[0]?.toUpperCase() || '?';

    const testa = `<div class="pf-testa">
      <span class="pf-av" style="--c:${me?.color || 'var(--primary)'}">${esc(iniziale)}</span>
      <div class="pf-dati">
        <span class="pf-et">E-mail</span><b>${esc(u?.email || '—')}</b>
        <span class="pf-et">Nome</span><b>${esc(p?.display_name || '—')}</b>
        <span class="pf-et">Profilo</span><b>${esc(ruolo)}</b>
      </div>
      <button class="pf-pen" data-act="name" aria-label="Cambia nome">${icon('edit', 'ic sm')}</button>
    </div>`;

    const generale = group('Generale', `
      ${row('globe', 'Impostazione lingua', LINGUE.find(([k]) => k === (d.lingua || 'it'))?.[1] || 'Italiano', 'lingua')}
      ${row('bell', 'Preferenze notifiche', avvisiSottotitolo(d), 'avvisi')}
      ${row('chat', 'Contattaci', CONTATTO || 'Indirizzo non ancora impostato', 'contatto')}
      ${row('gear', 'Impostazioni avanzate', 'Tema, lega, server e diagnostica', 'avanzate')}`);

    const conto = group('Account', `
      ${row('shield', 'Privacy e dati', 'Cosa salva l\'app, chi lo vede, come si cancella', 'privacy')}
      ${row('book', 'Termini d\'uso', 'Com\'è fatto il gioco e cosa ci si aspetta', 'termini')}
      ${S.authKind() === 'clerk' ? row('gear', 'Gestisci account', 'Nome, e-mail, password e accessi collegati', 'clerk-profile')
    : row('lock', 'Cambia password', 'Imposta una nuova password per questo account', 'password')}
      ${row('out', 'Esci', 'Torni alla schermata di accesso', 'logout', 'danger')}`);

    return `<main class="a-body">${testa}${generale}${conto}
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
      if (act === 'avanzate') { ctx.go('impostazioni/avanzate'); return; }
      if (act === 'privacy') { ctx.go('privacy'); return; }
      if (act === 'termini') { ctx.go('termini'); return; }
      if (act === 'lingua') {
        ctx.sheet(`<h3>Lingua</h3>${LINGUE.map(([k, l]) => `<button class="setting" data-lingua="${k}"><i class="ico">${icon('check')}</i><span class="txt"><b>${l}</b></span></button>`).join('')}
          <p class="auth-hint">Per ora l'app parla solo italiano. Non è una scelta definitiva: quando ci sarà una seconda lingua comparirà qui.</p>`);
        return;
      }
      if (act === 'contatto') {
        if (CONTATTO) { location.href = `mailto:${CONTATTO}?subject=${encodeURIComponent('Fantacampionato Sammarinese')}`; return; }
        ctx.sheet(`<h3>Contattaci</h3><p class="auth-hint">Non c'è ancora un indirizzo a cui scrivere: si imposta in <code>src/config.js</code>, alla voce <code>CONTATTO</code>. Finché resta vuoto questa voce non manda niente, invece di aprire una mail verso il nulla.</p>`);
        return;
      }
      if (act === 'avvisi') { apriAvvisi(ctx); return; }
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

/** Tutto il tecnico che prima stava in mezzo ai dati dell'account. */
export const avanzate = {
  title: 'Impostazioni avanzate', appbar: 'back', sub: () => 'Tema, lega, server e diagnostica',
  render() {
    const d = S.store.get(); const p = S.profileInfo();

    const look = group('Aspetto', `<div class="a-card"><label class="lbl">Tema</label><div class="seg">${[['system', 'Sistema'], ['light', 'Chiaro'], ['dark', 'Scuro']].map(([k, l]) => `<button class="${d.theme === k ? 'on' : ''}" data-theme="${k}">${l}</button>`).join('')}</div></div>`);

    const league = S.hasLeague() ? group('Lega', `
      ${row({ m: 'squadre' }, esc(S.base.league.name), `${S.base.managers.length} partecipanti${S.base.league.inviteCode ? ` · codice ${esc(S.base.league.inviteCode)}` : ''}`, 'lega')}
      ${row({ m: 'leghe' }, 'Cambia o crea lega', `${S.myLeagues().length} ${S.myLeagues().length === 1 ? 'lega' : 'leghe'} · entra con un codice invito`, 'leghe')}
      ${row({ m: 'guide' }, 'Regolamento ed opzioni', 'Voto Titano, bonus, soglie di conversione', 'regolamento')}`)
      : group('Lega', row({ m: 'leghe' }, 'Entra in una lega', 'Crea la tua oppure usa un codice invito', 'leghe'));

    const judge = p?.is_judge ? group('Giudice Dati', `
      ${row({ m: 'voti' }, 'Inserisci eventi', `Giornata ${S.currentMatchday()}`, 'admin')}
      ${row({ m: 'statistiche' }, 'Carica le giornate giocate', 'Formazioni, marcatori, assist e cartellini veri dai tabellini FSGC', 'seed')}`) : '';

    const data = group('Dati', `
      ${row({ m: 'quotazioni' }, 'Da dove vengono i dati', 'Lega, formazioni e voti sul server; listone e calendario generati dall\'app')}
      ${row('shield', 'Atleti e società', 'Nomi e prestazioni useranno dati reali solo previo accordo FSGC (art. 14)')}
      ${row('gear', 'Server della lega', esc(S.serverHost() || '—'), 'server')}
      ${row('shield', 'Diagnostica accessi', 'Controlla sul progetto cosa manca ancora per far entrare la gente', 'diagnostica')}`);

    return `<main class="a-body">${look}${league}${judge}${data}
      <p class="auth-foot">Versione 0.5 · motore ${S.rules().engineVersion}</p></main>`;
  },
  mount: (root, ctx) => impostazioni.mount(root, ctx),
};
