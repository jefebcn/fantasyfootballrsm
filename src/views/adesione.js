import * as S from '../state.js';
import { esc, icon } from '../ui.js';

/**
 * PER I CALCIATORI (041). Una pagina sola, aperta senza account, per due
 * cose opposte: «ci sto, mettetemi pure» e «non voglio comparire». La
 * seconda e' un diritto (i nomi e le prestazioni sono dati personali, anche
 * se pubblici); la prima e' quella che conta se un giorno qualcuno dice che
 * i nomi non si possono usare.
 *
 * Non e' linkata dall'app: si manda quando serve (#/giocatori). Si scrive
 * soltanto — chi ha mandato cosa lo vede solo chi amministra, dalla console.
 */
let inviato = null;

export const adesione = {
  title: 'Per i giocatori', appbar: 'back', sub: () => 'Il tuo nome in Fantatitano',
  render() {
    if (inviato) {
      return `<main class="a-body"><div class="a-card testo">
        <p><b>${inviato === 'aderisco' ? 'Grazie, ricevuto!' : 'Ricevuto.'}</b></p>
        <p>${inviato === 'aderisco'
    ? 'Il tuo nome e le tue statistiche restano in Fantatitano. Puoi cambiare idea quando vuoi da questa stessa pagina.'
    : 'Entro pochi giorni nell\'app comparirai come «Giocatore» con ruolo e squadra, senza il tuo nome. Formazioni e punteggi degli altri non cambiano.'}</p>
      </div></main>`;
    }
    const club = S.base.clubs.slice().sort((a, b) => a.name.localeCompare(b.name));
    return `<main class="a-body">
      <div class="a-card testo">
        <p><b>Giochi nel Campionato Sammarinese?</b> In Fantatitano compaiono i nomi e le statistiche dei giocatori, presi dai referti pubblici, per far funzionare il fantacalcio: chi ha giocato, chi ha segnato. Nessuna foto, nessun premio in denaro.</p>
        <p>Qui puoi dirci cosa preferisci. È gratuito e non serve un account.</p>
      </div>
      <form id="ades" class="a-card" novalidate>
        <label class="lbl" for="ad-nome">Nome e cognome</label>
        <input class="field-input" id="ad-nome" maxlength="80" autocomplete="name" required>
        <label class="lbl" for="ad-squadra">Squadra</label>
        <select class="field-input" id="ad-squadra"><option value="">—</option>${club.map((c) => `<option>${esc(c.name)}</option>`).join('')}</select>
        <p class="lbl" style="margin-top:12px">Cosa preferisci?</p>
        <label class="ades-scelta"><input type="radio" name="ad-scelta" value="aderisco" checked> <span><b>Ci sto</b>: il mio nome e le mie statistiche possono comparire in Fantatitano.</span></label>
        <label class="ades-scelta"><input type="radio" name="ad-scelta" value="escludimi"> <span><b>Non voglio comparire</b>: mostratemi solo come «Giocatore», con ruolo e squadra.</span></label>
        <label class="lbl" for="ad-contatto">Un contatto, se vuoi una risposta (facoltativo)</label>
        <input class="field-input" id="ad-contatto" maxlength="120" placeholder="e-mail o Instagram" autocomplete="email">
        <label class="lbl" for="ad-nota">Note (facoltativo)</label>
        <textarea class="field-input" id="ad-nota" maxlength="500" rows="3"></textarea>
        <button class="a-btn" type="submit" style="margin-top:14px">${icon('check', 'ic sm')}Invia</button>
        <p class="small muted" style="margin:10px 2px 0">Quello che scrivi lo legge solo chi gestisce l'app, per fare quello che chiedi. Il dettaglio è nell'<a href="#/privacy">informativa</a>.</p>
      </form>
    </main>`;
  },
  mount(root, ctx) {
    root.addEventListener('submit', async (e) => {
      if (e.target.id !== 'ades') return;
      e.preventDefault();
      const f = e.target;
      const nome = f.querySelector('#ad-nome').value.trim();
      if (nome.length < 2) { ctx.toast('Scrivi nome e cognome'); return; }
      const scelta = f.querySelector('input[name="ad-scelta"]:checked')?.value || 'aderisco';
      const btn = f.querySelector('button'); btn.disabled = true;
      try {
        await S.inviaAdesione({ nome, scelta,
          squadra: f.querySelector('#ad-squadra').value,
          contatto: f.querySelector('#ad-contatto').value.trim(),
          nota: f.querySelector('#ad-nota').value.trim() });
        inviato = scelta; ctx.render();
      } catch (err) { ctx.toast(err.message || 'Non è stato possibile inviare'); btn.disabled = false; }
    });
  },
};
