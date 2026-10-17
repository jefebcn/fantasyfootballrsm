import * as S from '../state.js';
import { esc, icon } from '../ui.js';

/**
 * PER I CALCIATORI (041, 044). Una pagina sola, aperta senza account, per due
 * cose opposte: «ci sto, mettetemi pure» e «non voglio comparire». La
 * seconda e' un diritto (i nomi e le prestazioni sono dati personali, anche
 * se pubblici); la prima e' quella che conta se un giorno qualcuno dice che
 * i nomi non si possono usare.
 *
 * Dalla 044 il «si'» regge come consenso: nessuna scelta gia' spuntata, gli
 * sponsor a parte e facoltativi, il genitore sotto i 18 anni, la versione del
 * testo letto e soprattutto la verifica. Dopo l'invio il calciatore riceve un
 * codice e lo manda in DM a @fantatitano dal suo Instagram (o lo conferma la
 * societa'): finche' chi amministra non l'ha verificato, non vale.
 *
 * Si scrive soltanto — chi ha mandato cosa lo vede solo chi amministra, dalla
 * console. Il codice resta su questo telefono, per poterlo rivedere.
 */
const IG = 'fantatitano';
const CHIAVE = 'ft.adesione';
const ricorda = () => { try { return JSON.parse(localStorage.getItem(CHIAVE) || 'null'); } catch { return null; } };
const salva = (v) => { try { v ? localStorage.setItem(CHIAVE, JSON.stringify(v)) : localStorage.removeItem(CHIAVE); } catch { /* niente */ } };
let inviato = null;

// Il testo del consenso, versione S.VERSIONE_CONSENSO. Cambiandolo si cambia
// anche la versione: chi ha aderito prima ha letto quello vecchio.
export const TESTO_CONSENSO = `
  <h3>Cosa comprende il «Ci sto»</h3>
  <ul>
    <li>Il tuo nome, ruolo, squadra e statistiche di gara (presenze, minuti, gol, assist, cartellini) nel gioco: listone, rose, formazioni, voti e classifiche.</li>
    <li>Lo stesso nei post e nelle storie dei social di Fantatitano, per esempio «i migliori della giornata».</li>
    <li><b>Solo se spunti anche la casella sponsor:</b> le stesse informazioni in iniziative con uno sponsor o con premi.</li>
  </ul>
  <h3>Cosa non comprende</h3>
  <ul>
    <li>Foto, video, voce e ogni altro uso della tua immagine: per quelli ti scriviamo a parte e serve un tuo accordo scritto, caso per caso.</li>
    <li>Dati diversi da quelli di gara: età, contatti e residenza non compaiono mai nell'app.</li>
  </ul>
  <h3>Se sei minorenne</h3>
  <p>Sotto i 18 anni il consenso lo dà anche un genitore o chi ne fa le veci, indicato nel modulo.</p>
  <h3>Come verifichiamo che sei tu</h3>
  <p>Dopo l'invio ricevi un codice. Ce lo mandi in privato dal tuo profilo Instagram a <b>@${IG}</b>, oppure ce lo conferma il dirigente della tua squadra. Finché non è verificato il consenso non vale e nell'app non cambia niente.</p>
  <h3>Se cambi idea</h3>
  <p>Puoi ritirare il consenso quando vuoi, da questa pagina o scrivendo a support@fantatitano.site. Entro 7 giorni nell'app compari come «Giocatore», con ruolo e squadra. Se ce lo chiedi togliamo il tuo nome anche dai post già pubblicati. Ritirarlo non costa niente e non ha conseguenze.</p>
  <h3>Cosa conserviamo</h3>
  <p>La tua scelta, il nome, la squadra, il profilo Instagram se lo hai dato, se sei maggiorenne (e il nome del genitore), data e ora, l'indirizzo IP e il tipo di dispositivo da cui hai inviato, la versione di questo testo e come abbiamo verificato che sei tu, compreso lo screenshot del messaggio di verifica. Lo legge solo chi gestisce l'app. Lo teniamo finché il consenso vale e per 2 anni dopo un ritiro, come prova di cosa avevi scelto.</p>`;

// Le frasi che il calciatore spunta: sono il consenso vero e proprio, e la
// 044 le conserva parola per parola insieme al testo (consensi_testi).
export const SCELTE = {
  aderisco: '<b>Ci sto.</b> Il mio nome e le mie statistiche di gara possono comparire in Fantatitano: nel gioco, nelle classifiche e nei post dei social di Fantatitano.',
  sponsor: '<b>Anche con sponsor e premi</b> (facoltativo). Il mio nome può comparire anche in iniziative con uno sponsor o con premi. Foto, video e voce no: per quelli mi chiederete a parte, per iscritto.',
  escludimi: '<b>Non voglio comparire.</b> Mostratemi solo come «Giocatore», con ruolo e squadra. Formazioni e punteggi degli altri non cambiano.',
  genitore: 'Sono il genitore o il tutore e sono d\'accordo con la scelta qui sopra.',
  dichiaro: 'Dichiaro di essere la persona indicata (o il suo genitore) e di aver letto cosa vuol dire.',
};

function verifica(r) {
  const si = r.scelta === 'aderisco';
  return `<main class="a-body">
    <div class="a-card testo ades-fatto">
      <p><b>Ricevuto${r.nome ? `, ${esc(r.nome.split(/\s+/)[0])}` : ''}. Manca un passo: dimostrarci che sei tu.</b></p>
      ${r.codice ? `<div class="ades-codice" id="ad-codice" aria-label="Codice di verifica">${esc(r.codice)}</div>
      <ol class="ades-passi">
        <li>Manda questo codice in un messaggio privato a <b>@${IG}</b> su Instagram, <b>dal tuo profilo</b>.</li>
        <li>Se non hai Instagram, chiedi al dirigente della tua squadra di scriverci il codice.</li>
      </ol>
      <div class="ades-azioni">
        <a class="a-btn" href="https://ig.me/m/${IG}" target="_blank" rel="noopener">${icon('chat', 'ic sm')}Apri Instagram</a>
        <button class="a-btn sec" type="button" id="ad-copia">Copia il codice</button>
      </div>` : `<p>Ti contatteremo noi per confermare che sei tu.</p>`}
      <p class="small muted">${si
    ? 'Finché non è verificato nell\'app non cambia niente. Il codice resta su questo telefono: riaprendo la pagina lo ritrovi.'
    : 'Appena verificato, entro 7 giorni nell\'app comparirai come «Giocatore» con ruolo e squadra. Formazioni e punteggi degli altri non cambiano.'}</p>
    </div>
    <button class="a-btn sec" type="button" id="ad-nuova" style="width:100%">Fai un'altra richiesta</button>
  </main>`;
}

export const adesione = {
  title: 'Per i calciatori', appbar: 'back', sub: () => 'Il tuo nome in Fantatitano',
  render() {
    const r = inviato || ricorda();
    if (r) return verifica(r);
    const club = S.base.clubs.slice().sort((a, b) => a.name.localeCompare(b.name));
    return `<main class="a-body">
      <div class="a-card testo">
        <p><b>Fantatitano è un fantacalcio gratuito sul campionato sammarinese.</b> Per il momento non è affiliato alla FSGC né alle società, e non usa i loro loghi o marchi. Usa nome, ruolo, squadra e statistiche dei giocatori, presi dai referti pubblici delle partite.</p>
        <p class="small muted">Qui ci dici se sei d'accordo. Non serve un account e puoi cambiare idea quando vuoi.</p>
      </div>
      <form id="ades" novalidate>
        <div class="a-card">
          <label class="lbl" for="ad-nome">Nome e cognome</label>
          <input class="field-input" id="ad-nome" maxlength="80" autocomplete="name" required>
          <label class="lbl" for="ad-squadra">Squadra</label>
          <select class="field-input" id="ad-squadra"><option value="">Scegli la squadra</option>${club.map((c) => `<option>${esc(c.name)}</option>`).join('')}</select>
          <label class="lbl" for="ad-ig">Il tuo profilo Instagram</label>
          <input class="field-input" id="ad-ig" maxlength="60" placeholder="@" autocapitalize="off" autocomplete="off" spellcheck="false">
          <span class="small muted">Serve a verificare che sei tu. Se non hai Instagram lascia vuoto: lo confermerà la tua società.</span>
        </div>
        <div class="a-card" role="radiogroup" aria-labelledby="ad-l-scelta">
          <p class="lbl" id="ad-l-scelta">Cosa preferisci?</p>
          <label class="ades-scelta"><input type="radio" name="ad-scelta" value="aderisco"> <span>${SCELTE.aderisco}</span></label>
          <label class="ades-scelta ades-sub" id="ad-sponsor-box" hidden><input type="checkbox" id="ad-sponsor"> <span>${SCELTE.sponsor}</span></label>
          <label class="ades-scelta"><input type="radio" name="ad-scelta" value="escludimi"> <span>${SCELTE.escludimi}</span></label>
        </div>
        <div class="a-card">
          <p class="lbl" id="ad-l-eta">Hai 18 anni o più?</p>
          <div class="ades-seg" role="radiogroup" aria-labelledby="ad-l-eta">
            <label><input type="radio" name="ad-eta" value="si">Sì</label>
            <label><input type="radio" name="ad-eta" value="no">No</label>
          </div>
          <div id="ad-gen-box" class="ades-gen" hidden>
            <span class="small muted">Sotto i 18 anni serve anche un genitore o chi ne fa le veci.</span>
            <label class="lbl" for="ad-gen">Nome e cognome del genitore</label>
            <input class="field-input" id="ad-gen" maxlength="80" autocomplete="off">
            <label class="ades-chk"><input type="checkbox" id="ad-gen-ok"> <span>${SCELTE.genitore}</span></label>
          </div>
        </div>
        <div class="a-card">
          <details class="ades-testo"><summary>Leggi cosa vuol dire, per intero</summary>${TESTO_CONSENSO}</details>
          <label class="ades-chk"><input type="checkbox" id="ad-io"> <span>${SCELTE.dichiaro}</span></label>
          <button class="a-btn" type="submit" id="ad-invia" style="margin-top:12px;width:100%" disabled>${icon('check', 'ic sm')}Invia</button>
          <p class="small muted" style="margin:10px 2px 0">Testo <span class="mono">${esc(S.VERSIONE_CONSENSO)}</span>. Quello che scrivi lo legge solo chi gestisce l'app. Il dettaglio è nell'<a href="#/privacy">informativa</a>.</p>
        </div>
      </form>
    </main>`;
  },
  mount(root, ctx) {
    const f = root.querySelector('#ades');
    const leggi = () => {
      const v = (sel) => f.querySelector(sel);
      const scelta = v('input[name="ad-scelta"]:checked')?.value;
      const eta = v('input[name="ad-eta"]:checked')?.value;
      v('#ad-sponsor-box').hidden = scelta !== 'aderisco';
      if (scelta !== 'aderisco') v('#ad-sponsor').checked = false;
      v('#ad-gen-box').hidden = eta !== 'no';
      const dati = { nome: v('#ad-nome').value.trim(), squadra: v('#ad-squadra').value, scelta,
        instagram: v('#ad-ig').value.trim().replace(/^@+/, '').replace(/^(.+)$/, '@$1'),
        sponsor: scelta === 'aderisco' && v('#ad-sponsor').checked,
        maggiorenne: eta ? eta === 'si' : null, genitore: eta === 'no' ? v('#ad-gen').value.trim() : '' };
      const ok = dati.nome.length >= 3 && dati.squadra && scelta && eta
        && (eta === 'si' || (dati.genitore.length >= 3 && v('#ad-gen-ok').checked)) && v('#ad-io').checked;
      v('#ad-invia').disabled = !ok;
      return ok ? dati : null;
    };
    if (f) {
      f.addEventListener('input', leggi); f.addEventListener('change', leggi);
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const dati = leggi(); if (!dati) { ctx.toast('Manca qualcosa: completa il modulo e spunta la dichiarazione'); return; }
        const btn = f.querySelector('#ad-invia'); btn.disabled = true;
        try {
          const { codice } = await S.inviaAdesione(dati);
          inviato = { codice, nome: dati.nome, scelta: dati.scelta };
          salva(inviato); ctx.render(); window.scrollTo(0, 0);
        } catch (err) { ctx.toast(err.message || 'Non è stato possibile inviare'); btn.disabled = false; }
      });
    }
    root.querySelector('#ad-copia')?.addEventListener('click', async () => {
      const t = root.querySelector('#ad-codice')?.textContent || '';
      try { await navigator.clipboard.writeText(t); ctx.toast('Codice copiato'); }
      catch { const r = document.createRange(); r.selectNodeContents(root.querySelector('#ad-codice')); window.getSelection().removeAllRanges(); window.getSelection().addRange(r); }
    });
    root.querySelector('#ad-nuova')?.addEventListener('click', () => { inviato = null; salva(null); ctx.render(); window.scrollTo(0, 0); });
  },
};
