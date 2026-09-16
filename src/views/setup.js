import * as S from '../state.js';
import { esc, icon, logo } from '../ui.js';

/** Mostrata quando manca la configurazione del server: senza, l'app non ha dove salvare nulla. */
export const setup = {
  title: 'Configura il server', appbar: 'none', nav: false,
  render() {
    return `<main class="a-body auth">
      <div class="auth-hero">${logo('auth-mark')}<h1>Fanta<em>titano</em></h1>
        <p>Manca il collegamento al server: senza, l'app non può creare account né leghe.</p></div>
      <div class="a-card auth-card">
        <p class="auth-hint">Inserisci i due valori pubblici del progetto Supabase: <b>Settings → API</b>. Restano su questo dispositivo.</p>
        ${['sb-url|Project URL|https://xxxx.supabase.co', 'sb-key|Publishable / anon key|sb_publishable_… oppure eyJ…'].map((f) => { const [id, l, ph] = f.split('|'); return `<label class="lbl" for="${id}" style="margin-top:8px">${l}</label><input class="field-input" id="${id}" placeholder="${ph}" autocomplete="off">`; }).join('')}
        <button class="a-btn" id="save" style="margin-top:12px">${icon('check', 'ic sm')}Collega</button>
      </div>
    </main>`;
  },
  mount(root, ctx) {
    root.querySelector('#save').onclick = () => {
      const url = root.querySelector('#sb-url').value.trim().replace(/\/$/, ''); const key = root.querySelector('#sb-key').value.trim();
      if (!/^https:\/\/.+\.supabase\.co$/.test(url) || key.length < 20) { ctx.toast('URL o chiave non validi'); return; }
      S.setSupabaseConfig(url, key);
    };
  },
};

/** Mostrata quando il server (o la libreria) non risponde: si riprova, non si finge. */
export const offline = {
  title: 'Server non raggiungibile', appbar: 'none', nav: false,
  render() {
    const e = S.connectionError();
    return `<main class="a-body auth">
      <div class="auth-hero">${icon('warn', 'ic auth-mark')}<h1>Niente collegamento</h1>
        <p>${esc(e?.message || 'Il server non risponde.')}</p></div>
      <div class="a-card auth-card">
        <p class="auth-hint">Controlla la connessione e riprova. Se il problema resta, potrebbe essere il server della lega a essere irraggiungibile: i dati non vanno persi, sono sul server.</p>
        <button class="a-btn" id="retry">${icon('undo', 'ic sm')}Riprova</button>
        <div class="auth-links"><button id="reconfig">Cambia server</button></div>
      </div>
    </main>`;
  },
  mount(root, ctx) {
    root.querySelector('#retry').onclick = async () => { ctx.toast('Riprovo…'); const ok = await S.retry(); if (!ok) ctx.toast(S.connectionError()?.message || 'Ancora niente'); };
    root.querySelector('#reconfig').onclick = () => { if (confirm('Scollegare questo server e inserirne un altro?')) S.setSupabaseConfig('', ''); };
  },
};
