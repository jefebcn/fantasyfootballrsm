import * as S from '../state.js';
import { esc, icon } from '../ui.js';

let tab = 'password';          // 'password' | 'link'
let mode = 'in';               // 'in' | 'up'  (accedi / crea account)
let sentTo = null;             // e-mail a cui è stato mandato il link
let busy = false;
let notice = null;             // { kind: 'ok'|'err', text }

const field = (id, label, attrs = '') => `<label class="lbl" for="${id}">${label}</label><input class="field-input" id="${id}" ${attrs}>`;

/** Riporta la schermata allo stato iniziale quando ci si arriva da un'altra vista (es. dopo il logout). */
export function resetLogin() { tab = 'password'; mode = 'in'; sentTo = null; busy = false; notice = null; }

export const login = {
  title: 'Accedi', appbar: 'none', nav: false,
  render() {
    const body = sentTo ? sentPanel() : tab === 'password' ? passwordPanel() : linkPanel();
    return `<main class="a-body auth">
      <div class="auth-hero">
        ${icon('towers', 'ic auth-mark')}
        <h1>Fantacampionato<br><em>Sammarinese</em></h1>
        <p>Voto Titano — il fantacalcio del Titano, senza pagelle.</p>
      </div>
      ${notice ? `<div class="warn ${notice.kind === 'ok' ? 'info' : 'block'}">${icon(notice.kind === 'ok' ? 'check' : 'warn', 'ic sm')}<span>${esc(notice.text)}</span></div>` : ''}
      ${sentTo ? '' : `<div class="seg auth-seg"><button class="${tab === 'password' ? 'on' : ''}" data-tab="password">Password</button><button class="${tab === 'link' ? 'on' : ''}" data-tab="link">Link via e-mail</button></div>`}
      <div class="a-card auth-card">${body}</div>
      <button class="a-btn ghost" id="demo">${icon('play', 'ic sm')}Guarda la demo senza account</button>
      <p class="auth-foot">I dati della demo restano su questo dispositivo.</p>
    </main>`;
  },
  mount(root, ctx) {
    busy = false;                       // ogni render riabilita il pulsante: dopo un logout la schermata torna usabile
    const $ = (s) => root.querySelector(s);
    const val = (s) => $(s)?.value.trim() || '';
    const setBusy = (on, label) => { busy = on; const b = $('#primary'); if (b) { b.disabled = on; b.dataset.label ||= b.textContent; b.textContent = on ? label : b.dataset.label; } };
    const fail = (e) => { notice = { kind: 'err', text: e.message || String(e) }; ctx.render(); };

    root.querySelector('main').addEventListener('click', async (e) => {
      const t = e.target.closest('[data-tab]'); if (t) { tab = t.dataset.tab; notice = null; ctx.render(); return; }
      const m = e.target.closest('[data-mode]'); if (m) { mode = m.dataset.mode; notice = null; ctx.render(); return; }
      if (e.target.closest('#demo')) { S.useLocalDemo(); ctx.go(''); return; }
      if (e.target.closest('#again')) { sentTo = null; notice = null; ctx.render(); return; }
      if (e.target.closest('#forgot')) {
        const email = val('#email'); if (!valid(email)) { fail(new Error('Scrivi prima la tua e-mail.')); return; }
        try { await S.resetPassword(email); notice = { kind: 'ok', text: `Ti abbiamo mandato un link per reimpostare la password a ${email}.` }; ctx.render(); } catch (err) { fail(err); }
        return;
      }
      if (!e.target.closest('#primary') || busy) return;

      const email = val('#email');
      if (!valid(email)) { fail(new Error('Inserisci un\'e-mail valida.')); return; }

      if (sentTo) {                                   // verifica del codice
        const code = val('#otp').replace(/\s/g, '');
        if (code.length < 6) { fail(new Error('Il codice ha 6 cifre.')); return; }
        setBusy(true, 'Verifico…'); try { await S.verifyCode(sentTo, code); sentTo = null; notice = null; } catch (err) { setBusy(false); fail(err); }
        return;
      }
      if (tab === 'link') {                           // link magico
        setBusy(true, 'Invio…');
        try { await S.signInLink(email); sentTo = email; notice = null; ctx.render(); } catch (err) { setBusy(false); fail(err); }
        return;
      }
      const password = val('#password');               // password
      if (password.length < 6) { fail(new Error('La password deve avere almeno 6 caratteri.')); return; }
      if (mode === 'in') {
        setBusy(true, 'Accedo…'); try { await S.signInPassword(email, password); } catch (err) { setBusy(false); fail(err); }
      } else {
        const name = val('#name') || email.split('@')[0];
        setBusy(true, 'Creo l\'account…');
        try {
          const r = await S.signUpPassword(email, password, name);
          if (r.needsConfirmation) { notice = { kind: 'ok', text: `Account creato. Conferma l'e-mail aprendo il link mandato a ${email}, poi accedi.` }; mode = 'in'; setBusy(false); ctx.render(); }
        } catch (err) { setBusy(false); fail(err); }
      }
    });
    root.querySelector('main').addEventListener('keydown', (e) => { if (e.key === 'Enter') root.querySelector('#primary')?.click(); });
  },
};

const valid = (e) => /.+@.+\..+/.test(e);

function passwordPanel() {
  return `${field('email', 'E-mail', 'type="email" autocomplete="email" inputmode="email" placeholder="nome@esempio.it"')}
    ${mode === 'up' ? field('name', 'Come ti chiami', 'autocomplete="name" placeholder="Alex" maxlength="24"') : ''}
    ${field('password', 'Password', `type="password" autocomplete="${mode === 'in' ? 'current-password' : 'new-password'}" placeholder="almeno 6 caratteri"`)}
    <button class="a-btn" id="primary">${icon(mode === 'in' ? 'shield' : 'star', 'ic sm')}${mode === 'in' ? 'Entra' : 'Crea account'}</button>
    <div class="auth-links">
      ${mode === 'in' ? `<button data-mode="up">Non hai un account? Creane uno</button><button id="forgot">Password dimenticata</button>` : `<button data-mode="in">Hai già un account? Accedi</button>`}
    </div>`;
}
function linkPanel() {
  return `${field('email', 'E-mail', 'type="email" autocomplete="email" inputmode="email" placeholder="nome@esempio.it"')}
    <button class="a-btn" id="primary">${icon('share', 'ic sm')}Mandami il link</button>
    <p class="auth-hint">Niente password: ricevi un'e-mail, tocchi il link e sei dentro. Al primo accesso l'account viene creato.</p>`;
}
function sentPanel() {
  return `<b class="auth-sent">Controlla la posta</b>
    <p class="auth-hint">Abbiamo scritto a <b>${esc(sentTo)}</b>. Tocca il link nell'e-mail: si apre direttamente l'app.</p>
    <hr class="sep">
    <p class="auth-hint">Se l'e-mail contiene anche un <b>codice a 6 cifre</b>, puoi inserirlo qui — utile quando il link si apre in un altro browser.</p>
    ${field('email', 'E-mail', `type="hidden" value="${esc(sentTo)}"`)}
    ${field('otp', 'Codice a 6 cifre', 'inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456"')}
    <button class="a-btn" id="primary">${icon('check', 'ic sm')}Entra con il codice</button>
    <div class="auth-links"><button id="again">Usa un'altra e-mail</button></div>`;
}
