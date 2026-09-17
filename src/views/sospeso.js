import * as S from '../state.js';
import { esc, icon } from '../ui.js';
import { CONTATTO } from '../config.js';

/**
 * La schermata di chi e' stato sospeso.
 *
 * Nel database un sospeso non schiera e non contesta (015): senza questa
 * schermata vedrebbe l'app funzionare a meta' e prendersi errori che non
 * spiegano niente — "impossibile salvare" mentre tutto sembra al suo posto.
 * Meglio dirglielo una volta, in faccia, col motivo e con la strada per
 * rispondere.
 *
 * Restano aperte due cose, e non e' generosita': le impostazioni, da cui si
 * scaricano i propri dati e si cancella l'account. Sono diritti, e non si
 * sospendono insieme al resto.
 */
export const sospeso = {
  title: 'Account sospeso', appbar: 'none', nav: false,
  render() {
    const chi = S.profileInfo()?.display_name || '';
    return `<main class="a-body auth">
      <div class="auth-hero">${icon('lock', 'ic auth-mark')}<h1>Account sospeso</h1>
        <p>${chi ? `${esc(chi)}, il` : 'Il'} tuo account è stato sospeso da chi amministra l'app.</p></div>
      <div class="a-card auth-card">
        <p class="auth-hint">Finché la sospensione resta non puoi schierare la formazione, aprire contestazioni né entrare in altre leghe. Le squadre e i punti che hai fatto non vengono cancellati.</p>
        <p class="auth-hint">Succede quasi sempre per un nome o un contenuto che qualcuno ha segnalato. Se pensi che sia un errore, scrivilo: si guarda e si rimedia.</p>
        <a class="a-btn" href="mailto:${esc(CONTATTO)}?subject=${encodeURIComponent('Account sospeso')}" style="text-decoration:none">${icon('chat', 'ic sm')}Scrivi a chi amministra</a>
        <div class="auth-links"><a href="#/impostazioni">Impostazioni, dati e account</a></div>
        <div class="auth-links"><button id="esci">Esci dall'account</button></div>
      </div>
    </main>`;
  },
  mount(root) {
    root.querySelector('#esci')?.addEventListener('click', () => S.signOut());
  },
};
