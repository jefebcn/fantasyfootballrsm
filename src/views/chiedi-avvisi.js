/**
 * La richiesta delle notifiche, in un posto solo: la usano la Home (sotto la
 * formazione) e la schermata della formazione, subito dopo il salvataggio.
 *
 * PERCHÉ ANCHE DOPO IL SALVATAGGIO (Alex, 04/11). Le notifiche le avevano 18
 * persone su 211: il riquadro stava solo in Home, e chi consegna la
 * formazione spesso chiude l'app li'. Il momento in cui si capisce a cosa
 * servono e' quello: «ho appena schierato, dimmi quando segnano».
 *
 * Le regole su quando chiedere restano quelle di AV.comeChiedere: dopo la
 * prima formazione, «Non ora» per due settimane, al secondo no basta. La
 * finestra del telefono si apre solo dal «Sì».
 */
import * as S from '../state.js';
import * as AV from '../notifiche.js';
import { esc, icon, t } from '../ui.js';

const TITOLO = 'Vuoi le notifiche di Fantatitano?';
const COSA = 'Ti avvisiamo quando i tuoi giocatori segnano, il lunedì con i punti della tua squadra e prima che si chiuda la formazione.';

/** Cosa chiedere adesso su questo telefono: 'permesso', 'installa', 'apri-browser' o null. */
export function comeChiedereOra() {
  const d = S.store.get();
  return AV.comeChiedere({ avvisi: d.avvisi, chiesto: d.pushChiesto, consegnato: S.haConsegnato(),
    permesso: AV.permesso(), supportate: AV.supportate(), configurato: AV.pushConfigurato(),
    ios: AV.suiOS(), installata: AV.installata(), browser: AV.browserIOS() });
}

/** Il contenuto della richiesta (senza la scheda intorno), o '' se non c'e' niente da chiedere. */
export function corpoRichiesta(come = comeChiedereOra()) {
  if (!come) return '';
  // iPhone nel browser: prima la schermata Home, se no il «Sì» non c'e'
  if (come === 'installa' || come === 'apri-browser') {
    const condividi = esc(AV.doveCondividi().replace(/^./, (c) => c.toLowerCase()));
    const passi = come === 'apri-browser'
      ? [t('Sei dentro un\'altra app (Instagram, Facebook): tocca <b>⋯</b> in alto e <b>Apri nel browser</b>.'),
        t('Lì tocca <b>Condividi</b>: {dove}', { dove: condividi }), t('Scegli <b>Aggiungi alla schermata Home</b>.'),
        t('Apri Fantatitano dall\'icona sulla Home: qui ti chiedo il permesso.')]
      : [t('Tocca <b>Condividi</b>: {dove}', { dove: condividi }), t('Scegli <b>Aggiungi alla schermata Home</b>.'),
        t('Apri Fantatitano dall\'icona sulla Home: qui ti chiedo il permesso.')];
    return `<i class="cp-ico">${icon('bell')}</i>
    <div class="cp-txt"><b>${t(TITOLO)}</b>
      <span>${t(COSA)} ${t('Su iPhone arrivano solo con Fantatitano sulla <b>schermata Home</b>. Ci vogliono dieci secondi:')}</span>
      <ol class="cp-passi">${passi.map((x) => `<li>${x}</li>`).join('')}</ol>
      <div class="cp-btn"><button class="a-btn sec" data-push="no">${t('Non ora')}</button></div>
    </div>`;
  }
  return `<i class="cp-ico">${icon('bell')}</i>
    <div class="cp-txt"><b>${t(TITOLO)}</b>
      <span>${t(COSA)} ${t('Niente altro.')}</span>
      <div class="cp-btn"><button class="a-btn" data-push="si">${t('Sì, attiva')}</button><button class="a-btn sec" data-push="no">${t('Non ora')}</button></div>
    </div>`;
}

/** Il riquadro per la Home. */
export function riquadroRichiesta() {
  const come = comeChiedereOra();
  const corpo = corpoRichiesta(come);
  return corpo ? `<div class="a-card chiedi-push${come === 'permesso' ? '' : ' ios'}" data-come="${come}">${corpo}</div>` : '';
}

/**
 * Il tocco su «Sì» o «Non ora». `fatto` si chiama alla fine, qualunque cosa
 * sia successa (la Home ridisegna, la scheda si chiude).
 */
export async function rispondi(b, ctx, fatto = () => {}) {
  const unNo = () => { const c = S.store.get().pushChiesto; S.store.set({ pushChiesto: { volte: (c?.volte || 0) + 1, ultima: Date.now() } }); };
  if (b.dataset.push === 'no') { unNo(); ctx.toast(t('Va bene. Se cambi idea: Impostazioni → Preferenze notifiche')); fatto(); return; }
  b.disabled = true;
  const esito = await AV.chiediPermesso();
  if (esito === 'granted') {
    S.store.set({ avvisi: true });   // col permesso dato la richiesta sparisce
    fatto();                         // subito: l'iscrizione puo' metterci qualche secondo
    // l'iscrizione aspetta il service worker: se tarda, l'avviso non resta appeso
    const iscritto = await Promise.race([S.iscriviAvvisi().catch(() => false),
      new Promise((r) => { setTimeout(() => r(false), 8000); })]);
    ctx.toast(iscritto ? t('Notifiche attive su questo telefono') : t('Notifiche consentite: arrivano ad app aperta'));
    return;
  } else if (esito === 'denied') {
    ctx.toast(t('Va bene, niente notifiche. Si riattivano dalle impostazioni del telefono'));
  } else {
    // finestra chiusa senza scegliere: vale come un «non ora», non si richiede subito
    unNo();
  }
  fatto();
}

/**
 * Dopo il salvataggio della formazione: la stessa richiesta, in una scheda
 * che sale dal basso. Solo se c'e' qualcosa da chiedere, quindi al massimo
 * due volte in tutto e mai prima di due settimane dal primo «Non ora».
 */
export function chiediDopoIlSalvataggio(ctx) {
  const corpo = corpoRichiesta();
  if (!corpo) return false;
  ctx.sheet(`<div class="chiedi-push dopo-salvataggio">${corpo}</div>`);
  const sh = document.getElementById('sheet');
  if (sh) sh.onclick = (e) => { const b = e.target.closest('[data-push]'); if (b) rispondi(b, ctx, () => ctx.sheet(null)); };
  return true;
}
