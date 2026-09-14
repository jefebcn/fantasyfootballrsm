import * as S from '../state.js';
import { esc, icon } from '../ui.js';

let sent = null;
export const login = {
  title: 'Accedi', appbar: 'none', nav: false,
  render() {
    return `<main class="a-body" style="justify-content:center;padding-top:calc(24px + env(safe-area-inset-top))">
      <div style="text-align:center;padding:12px 0 4px">${icon('towers', 'ic')}<h2 style="font:800 26px var(--font-display);text-transform:uppercase;letter-spacing:-.01em;margin-top:8px">Fantacampionato<br><span style="color:var(--primary)">Sammarinese</span></h2><p class="small muted">Voto Titano · senza pagelle</p></div>
      ${sent ? `<div class="a-card" style="display:flex;flex-direction:column;gap:10px"><b>Controlla la posta</b><p class="small muted">Abbiamo mandato un link e un codice a <b>${esc(sent)}</b>. Tocca il link dal telefono, oppure inserisci il codice qui.</p><label class="lbl" for="otp">Codice a 6 cifre</label><input class="field-input" id="otp" inputmode="numeric" autocomplete="one-time-code" placeholder="123456"><button class="a-btn" id="verify">Entra</button><button class="a-btn sec" id="again" style="height:40px">Usa un'altra e-mail</button></div>`
      : `<div class="a-card" style="display:flex;flex-direction:column;gap:10px"><label class="lbl" for="email">La tua e-mail</label><input class="field-input" id="email" type="email" autocomplete="email" inputmode="email" placeholder="nome@esempio.it"><button class="a-btn" id="send">${icon('share', 'ic sm')}Mandami il link di accesso</button><p class="small muted">Niente password: ricevi un link via e-mail. Al primo accesso l'account viene creato.</p></div>`}
      <button class="a-btn sec" id="demo">Prova la demo locale</button>
      <p class="small muted" style="text-align:center">La demo usa dati generati e resta sul dispositivo.</p>
    </main>`;
  },
  mount(root, ctx) {
    root.querySelector('#send')?.addEventListener('click', async () => {
      const email = root.querySelector('#email').value.trim(); if (!/.+@.+\..+/.test(email)) { ctx.toast('Inserisci un\'e-mail valida'); return; }
      try { await S.signIn(email); sent = email; ctx.render(); } catch (e) { ctx.toast(e.message); }
    });
    root.querySelector('#verify')?.addEventListener('click', async () => {
      const code = root.querySelector('#otp').value.trim(); if (code.length < 6) { ctx.toast('Codice a 6 cifre'); return; }
      try { await S.verifyCode(sent, code); sent = null; } catch (e) { ctx.toast(e.message); }
    });
    root.querySelector('#again')?.addEventListener('click', () => { sent = null; ctx.render(); });
    root.querySelector('#demo')?.addEventListener('click', () => { S.useLocalDemo(); ctx.go(''); });
  },
};
