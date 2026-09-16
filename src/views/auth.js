import * as S from '../state.js';
import { esc, icon, logo } from '../ui.js';

let tab = 'in';            // 'in' | 'up' | 'link'
let pending = null;        // { email, kind: 'confirm' | 'link' }
let busy = false;
let notice = null;         // { kind: 'ok' | 'err', text }

let pendingTab = null;
/** Consente a un'altra vista di aprire l'accesso già sulla scheda giusta. */
export function prepareLogin(t) { pendingTab = t; }
export function resetLogin() { tab = pendingTab || 'in'; pendingTab = null; pending = null; busy = false; notice = null; }
const valid = (e) => /.+@.+\..+/.test(e);
const field = (id, label, attrs = '') => `<label class="lbl" for="${id}">${label}</label><input class="field-input" id="${id}" ${attrs}>`;
/** Campo della schermata d'accesso: etichetta dentro al campo, come nel modello. */
const campo = (id, ph, attrs = '', extra = '') => `<div class="campo">${extra}<input id="${id}" placeholder="${ph}" ${attrs}></div>`;

const RICORDA = 'fcs:email';
const emailRicordata = () => { try { return localStorage.getItem(RICORDA) || ''; } catch { return ''; } };

export const login = {
  title: 'Accedi', appbar: 'none', nav: false,
  render() {
    if (S.authKind() === 'clerk') return `<main class="a-body auth">
      <div class="auth-hero">${logo('auth-mark')}
        <h1>Fanta<em>titano</em></h1>
        <p>Voto Titano — il fantacalcio del Titano, senza pagelle.</p></div>
      <div class="a-card auth-card clerk-card"><div id="clerk-slot"><div class="skel" style="height:280px"></div></div></div>
    </main>`;
    const titolo = pending ? 'Controlla la posta' : tab === 'up' ? 'Registrati' : tab === 'link' ? 'Entra col link' : 'Accedi';
    return `<main class="a-body auth2">
      <div class="sfondo">
        <img src="media/sfondo-accesso.jpg" alt="" fetchpriority="high" decoding="async">
        <i class="velo"></i>
      </div>
      <div class="contenuto">
        <div class="marchio">${logo('auth-mark')}<span>Fanta<b>titano</b></span></div>
        <h1 class="tit">${titolo}</h1>
        ${notice ? `<div class="avviso ${notice.kind}">${icon(notice.kind === 'ok' ? 'check' : 'warn', 'ic sm')}<span>${esc(notice.text)}</span></div>` : ''}
        ${pending ? pendingPanel() : tab === 'link' ? linkPanel() : credentialsPanel()}
        ${pending ? '' : socialBlock()}
        ${pending ? '' : `<p class="passa">${tab === 'up'
          ? 'Hai già un account? <button data-tab="in">Accedi</button>'
          : 'Non hai ancora un account? <button data-tab="up">Registrati</button>'}</p>`}
      </div>
    </main>`;
  },
  mount(root, ctx) {
    busy = false;
    const slot = root.querySelector('#clerk-slot');
    if (slot) { slot.innerHTML = ''; S.clerkMount(slot, 'sign-in'); return; }
    const val = (s) => root.querySelector(s)?.value.trim() || '';
    const setBusy = (on, label) => { busy = on; const b = root.querySelector('#primary'); if (b) { b.disabled = on; b.dataset.label ||= b.textContent; b.textContent = on ? label : b.dataset.label; } };
    const fail = (e) => { notice = { kind: 'err', text: e.message || String(e) }; ctx.render(); };

    root.querySelector('main').addEventListener('click', async (e) => {
      const t = e.target.closest('[data-tab]'); if (t) { tab = t.dataset.tab; notice = null; ctx.render(); return; }
      const sp = e.target.closest('[data-provider]');
      if (sp) { notice = null; sp.disabled = true; try { await S.signInWithProvider(sp.dataset.provider); } catch (err) { sp.disabled = false; fail(err); } return; }
      if (e.target.closest('#again')) { pending = null; notice = null; ctx.render(); return; }
      if (e.target.closest('#resend')) {
        try { pending.kind === 'confirm' ? await S.resendConfirmation(pending.email) : await S.signInLink(pending.email); notice = { kind: 'ok', text: 'E-mail rimandata.' }; ctx.render(); } catch (err) { fail(err); }
        return;
      }
      const occhio = e.target.closest('#vedi');
      if (occhio) { const c = root.querySelector('#password'); if (c) { const visibile = c.type === 'text'; c.type = visibile ? 'password' : 'text'; occhio.setAttribute('aria-label', visibile ? 'Mostra la password' : 'Nascondi la password'); } return; }
      if (e.target.closest('#vailink')) { tab = 'link'; notice = null; ctx.render(); return; }
      if (e.target.closest('#forgot')) {
        const email = val('#email'); if (!valid(email)) { fail(new Error('Scrivi prima la tua e-mail.')); return; }
        try { await S.resetPassword(email); notice = { kind: 'ok', text: `Link per reimpostare la password mandato a ${email}.` }; ctx.render(); } catch (err) { fail(err); }
        return;
      }
      if (!e.target.closest('#primary') || busy) return;

      if (pending) {                                       // verifica del codice a 6 cifre
        const code = val('#otp').replace(/\s/g, '');
        if (code.length < 6) { fail(new Error('Il codice ha 6 cifre.')); return; }
        setBusy(true, 'Verifico…'); try { await S.verifyCode(pending.email, code); pending = null; notice = null; } catch (err) { setBusy(false); fail(err); }
        return;
      }
      const email = val('#email');
      if (!valid(email)) { fail(new Error('Inserisci un\'e-mail valida.')); return; }
      // «Ricorda la mia e-mail» fa esattamente quello che dice: niente password salvate.
      try {
        const spunta = root.querySelector('#ricorda');
        if (spunta) spunta.checked ? localStorage.setItem(RICORDA, email) : localStorage.removeItem(RICORDA);
      } catch { /* modalità privata */ }

      if (tab === 'link') {
        setBusy(true, 'Invio…');
        try { await S.signInLink(email); pending = { email, kind: 'link' }; notice = null; ctx.render(); } catch (err) { setBusy(false); fail(err); }
        return;
      }
      const password = val('#password');
      if (password.length < 6) { fail(new Error('La password deve avere almeno 6 caratteri.')); return; }
      if (tab === 'in') {
        setBusy(true, 'Accedo…'); try { await S.signInPassword(email, password); } catch (err) { setBusy(false); fail(err); }
        return;
      }
      const name = val('#name') || email.split('@')[0];
      setBusy(true, 'Creo l\'account…');
      try {
        const r = await S.signUpPassword(email, password, name);
        if (r.needsConfirmation) { pending = { email, kind: 'confirm' }; notice = { kind: 'ok', text: 'Account creato: manca solo la conferma.' }; ctx.render(); }
      } catch (err) { setBusy(false); fail(err); }
    });
    root.querySelector('main').addEventListener('keydown', (e) => { if (e.key === 'Enter') root.querySelector('#primary')?.click(); });
  },
};

const PROVIDER = { google: ['google', 'Continua con Google'], apple: ['apple', 'Continua con Apple'] };
function socialBlock() {
  const list = S.oauthProviders();
  if (!list.length) return '';
  return `<div class="oppure"><span>oppure accedi con</span></div>
    <div class="tondi">${list.map((k) => `<button class="tondo" data-provider="${k}" aria-label="${PROVIDER[k][1]}">${icon(PROVIDER[k][0], 'ic')}</button>`).join('')}</div>`;
}
function credentialsPanel() {
  const up = tab === 'up';
  return `${campo('email', 'E-mail', `type="email" autocomplete="email" inputmode="email" value="${esc(up ? '' : emailRicordata())}"`)}
    ${up ? campo('name', 'Come ti chiami', 'autocomplete="name" maxlength="24"') : ''}
    ${campo('password', up ? 'Password, almeno 6 caratteri' : 'Password',
      `type="password" autocomplete="${up ? 'new-password' : 'current-password'}"`,
      `<button type="button" class="occhio" id="vedi" aria-label="Mostra la password">${icon('eye', 'ic sm')}</button>`)}
    <div class="riga">
      ${up ? '<span></span>' : `<label class="ricorda"><input type="checkbox" id="ricorda" ${emailRicordata() ? 'checked' : ''}>Ricorda la mia e-mail</label>`}
      <button class="sottile" id="${up ? 'vailink' : 'forgot'}">${up ? 'Entra senza password' : 'Password dimenticata?'}</button>
    </div>
    <button class="a-btn oro" id="primary">${up ? 'Crea account' : 'Accedi'}</button>
    ${up ? '' : '<button class="sottile centro" data-tab="link">Entra senza password, con un link</button>'}`;
}
function linkPanel() {
  return `${campo('email', 'E-mail', `type="email" autocomplete="email" inputmode="email" value="${esc(emailRicordata())}"`)}
    <button class="a-btn oro" id="primary">Mandami il link</button>
    <p class="nota">Senza password: ricevi un'e-mail, tocchi il link e sei dentro. Se non hai un account, viene creato al primo accesso.</p>
    <button class="sottile centro" data-tab="in">Torna all'accesso con password</button>`;
}
function pendingPanel() {
  const conferma = pending.kind === 'confirm';
  return `<b class="auth-sent">${conferma ? 'Conferma la tua e-mail' : 'Controlla la posta'}</b>
    <p class="auth-hint">Abbiamo scritto a <b>${esc(pending.email)}</b>.
      <b>Apri il link dentro l'e-mail</b>: ${conferma ? "l'account si attiva e rientri da qui." : 'si apre direttamente l\'app.'}</p>
    <div class="auth-links"><button id="resend">Rimanda l'e-mail</button><button id="again">Usa un'altra e-mail</button></div>
    <details class="auth-more">
      <summary>Non è arrivata niente?</summary>
      <ul class="auth-list">
        <li>Guarda nello <b>spam</b> e, su Gmail, nella scheda <b>Promozioni</b>.</li>
        <li>Le e-mail di servizio sono <b>poche all'ora</b>: se hai già premuto «Rimanda» più volte, aspetta un'ora prima di riprovare.</li>
        <li>Chiedi all'organizzatore della lega di disattivare la conferma via e-mail: si entra subito, senza posta.</li>
      </ul>
      <hr class="sep">
      <p class="auth-hint"><b>Solo se</b> l'e-mail contiene un codice a 6 cifre, scrivilo qui. Molte e-mail contengono solo il link: in quel caso questo campo non serve.</p>
      ${field('otp', 'Codice a 6 cifre', 'inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456"')}
      <button class="a-btn ghost" id="primary">${icon('check', 'ic sm')}Entra con il codice</button>
    </details>`;
}
