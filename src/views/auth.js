import * as S from '../state.js';
import { esc, icon } from '../ui.js';

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

export const login = {
  title: 'Accedi', appbar: 'none', nav: false,
  render() {
    if (S.authKind() === 'clerk') return `<main class="a-body auth">
      <div class="auth-hero">${icon('towers', 'ic auth-mark')}
        <h1>Fantacampionato<br><em>Sammarinese</em></h1>
        <p>Voto Titano — il fantacalcio del Titano, senza pagelle.</p></div>
      <div class="a-card auth-card clerk-card"><div id="clerk-slot"><div class="skel" style="height:280px"></div></div></div>
    </main>`;
    return `<main class="a-body auth">
      <div class="auth-hero">${icon('towers', 'ic auth-mark')}
        <h1>Fantacampionato<br><em>Sammarinese</em></h1>
        <p>Voto Titano — il fantacalcio del Titano, senza pagelle.</p></div>
      ${notice ? `<div class="warn ${notice.kind === 'ok' ? 'info' : 'block'}">${icon(notice.kind === 'ok' ? 'check' : 'warn', 'ic sm')}<span>${esc(notice.text)}</span></div>` : ''}
      ${pending ? '' : `<div class="seg auth-seg">
        <button class="${tab === 'in' ? 'on' : ''}" data-tab="in">Accedi</button>
        <button class="${tab === 'up' ? 'on' : ''}" data-tab="up">Crea account</button>
        <button class="${tab === 'link' ? 'on' : ''}" data-tab="link">Link</button></div>`}
      <div class="a-card auth-card">${pending ? pendingPanel() : socialBlock() + (tab === 'link' ? linkPanel() : credentialsPanel())}</div>
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
  return `<div class="social">${list.map((k) => { const [ic, label] = PROVIDER[k]; return `<button class="social-btn ${k}" data-provider="${k}">${icon(ic, 'ic social-mark')}${label}</button>`; }).join('')}</div>
    <div class="or"><span>oppure con l'e-mail</span></div>`;
}
function credentialsPanel() {
  const up = tab === 'up';
  return `${field('email', 'E-mail', 'type="email" autocomplete="email" inputmode="email" placeholder="nome@esempio.it"')}
    ${up ? field('name', 'Come ti chiami', 'autocomplete="name" placeholder="Alex" maxlength="24"') : ''}
    ${field('password', 'Password', `type="password" autocomplete="${up ? 'new-password' : 'current-password'}" placeholder="almeno 6 caratteri"`)}
    <button class="a-btn" id="primary">${icon(up ? 'star' : 'shield', 'ic sm')}${up ? 'Crea account' : 'Entra'}</button>
    ${up ? '<p class="auth-hint">Ti serve una sola volta: dopo entri con e-mail e password. Per partecipare a una lega ti servirà il codice invito dell\'organizzatore.</p>'
        : '<div class="auth-links"><button id="forgot">Password dimenticata</button></div>'}`;
}
function linkPanel() {
  return `${field('email', 'E-mail', 'type="email" autocomplete="email" inputmode="email" placeholder="nome@esempio.it"')}
    <button class="a-btn" id="primary">${icon('share', 'ic sm')}Mandami il link</button>
    <p class="auth-hint">Senza password: ricevi un'e-mail, tocchi il link e sei dentro. Se non hai un account, viene creato al primo accesso.</p>`;
}
function pendingPanel() {
  const confirm = pending.kind === 'confirm';
  return `<b class="auth-sent">${confirm ? 'Conferma la tua e-mail' : 'Controlla la posta'}</b>
    <p class="auth-hint">Abbiamo scritto a <b>${esc(pending.email)}</b>. ${confirm ? 'Apri il link nell\'e-mail per attivare l\'account, poi torna qui e accedi.' : 'Tocca il link nell\'e-mail: si apre direttamente l\'app.'}</p>
    <hr class="sep">
    <p class="auth-hint">Se l'e-mail contiene anche un <b>codice a 6 cifre</b>, inseriscilo qui — serve quando il link si apre in un browser diverso.</p>
    ${field('otp', 'Codice a 6 cifre', 'inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456"')}
    <button class="a-btn" id="primary">${icon('check', 'ic sm')}Entra con il codice</button>
    <div class="auth-links"><button id="resend">Rimanda l'e-mail</button><button id="again">Usa un'altra e-mail</button></div>`;
}
