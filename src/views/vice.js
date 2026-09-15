/** Arrivo dal link d'invito: si diventa allenatore in seconda di una squadra. */
import * as S from '../state.js';
import { esc, icon, logo } from '../ui.js';

let stato = 'pronto';   // pronto | attesa | fatto | errore
let messaggio = '';

export const vice = {
  title: 'Invito', appbar: 'back', nav: false,
  render({ params }) {
    const code = String(params.code || '').toUpperCase();
    if (!S.currentUser()) {
      return `<main class="a-body"><div class="empty">${logo()}
        <p>Per accettare l'invito serve prima entrare con il tuo account.</p>
        <a class="a-btn" href="#/login" style="text-decoration:none">Accedi o registrati</a>
        <p class="small muted">Poi riapri il link che ti hanno mandato.</p></div></main>`;
    }
    if (stato === 'fatto') {
      return `<main class="a-body"><div class="empty">${logo()}
        <p><b>Ci sei.</b> ${esc(messaggio)}</p>
        <a class="a-btn" href="#/" style="text-decoration:none">Vai alla squadra</a></div></main>`;
    }
    return `<main class="a-body">
      <div class="a-card" style="display:flex;flex-direction:column;gap:12px;align-items:center;text-align:center">
        ${icon('userplus', 'ic')}
        <b style="font:700 18px var(--font-display)">Allenatore in seconda</b>
        <p class="small muted">Stai per gestire una squadra insieme a chi ti ha invitato: potrai schierare la formazione e cambiare stemma, maglia e nomi. Non prendi una squadra tua e non occupi un posto in classifica.</p>
        <code class="sm-codice">${esc(code)}</code>
        ${stato === 'errore' ? `<p class="small" style="color:var(--negative)">${esc(messaggio)}</p>` : ''}
        <button class="a-btn" id="ok" ${stato === 'attesa' ? 'disabled' : ''}>${stato === 'attesa' ? 'Un attimo…' : 'Accetta l\'invito'}</button>
      </div></main>`;
  },
  mount(root, ctx) {
    root.querySelector('#ok')?.addEventListener('click', async () => {
      stato = 'attesa'; ctx.render();
      try {
        await S.entraComeVice(root.querySelector('.sm-codice').textContent.trim());
        stato = 'fatto'; messaggio = `Ora alleni ${S.me()?.teamName || 'la squadra'} in ${S.base.league.name}.`;
      } catch (err) { stato = 'errore'; messaggio = err.message; }
      ctx.render();
    });
  },
};
