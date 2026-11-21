import * as S from '../state.js';
import { esc, icon, logo, t } from '../ui.js';

/** Mostrata quando manca la configurazione del server: senza, l'app non ha dove salvare nulla. */
export const setup = {
  title: 'Configura il server', appbar: 'none', nav: false,
  render() {
    return `<main class="a-body auth">
      <div class="auth-hero">${logo('auth-mark')}<h1>Fanta<em>titano</em></h1>
        <p>${t('Manca il collegamento al server: senza, l\'app non può creare account né leghe.')}</p></div>
      <div class="a-card auth-card">
        <p class="auth-hint">${t('Inserisci i due valori pubblici del progetto Supabase: <b>Settings → API</b>. Restano su questo dispositivo.')}</p>
        ${[`sb-url|${t('Project URL')}|https://xxxx.supabase.co`, `sb-key|${t('Publishable / anon key')}|${t('sb_publishable_… oppure eyJ…')}`].map((f) => { const [id, l, ph] = f.split('|'); return `<label class="lbl" for="${id}" style="margin-top:8px">${l}</label><input class="field-input" id="${id}" placeholder="${ph}" autocomplete="off">`; }).join('')}
        <button class="a-btn" id="save" style="margin-top:12px">${icon('check', 'ic sm')}${t('Collega')}</button>
      </div>
    </main>`;
  },
  mount(root, ctx) {
    root.querySelector('#save').onclick = () => {
      const url = root.querySelector('#sb-url').value.trim().replace(/\/$/, ''); const key = root.querySelector('#sb-key').value.trim();
      if (!/^https:\/\/.+\.supabase\.co$/.test(url) || key.length < 20) { ctx.toast(t('URL o chiave non validi')); return; }
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
      <div class="auth-hero">${icon('warn', 'ic auth-mark')}<h1>${t('Niente collegamento')}</h1>
        <p>${esc(t(e?.message || 'Il server non risponde.'))}</p></div>
      <div class="a-card auth-card">
        <p class="auth-hint">${t('Controlla la connessione e riprova. Se il problema resta, potrebbe essere il server della lega a essere irraggiungibile: i dati non vanno persi, sono sul server.')}</p>
        <button class="a-btn" id="retry">${icon('undo', 'ic sm')}${t('Riprova')}</button>
        <div class="auth-links"><button id="reconfig">${t('Cambia server')}</button></div>
      </div>
    </main>`;
  },
  mount(root, ctx) {
    root.querySelector('#retry').onclick = async () => { ctx.toast(t('Riprovo…')); const ok = await S.retry(); if (!ok) ctx.toast(t(S.connectionError()?.message || 'Ancora niente')); };
    root.querySelector('#reconfig').onclick = () => { if (confirm(t('Scollegare questo server e inserirne un altro?'))) S.setSupabaseConfig('', ''); };
  },
};
