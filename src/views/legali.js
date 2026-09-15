/**
 * Dati, privacy e termini d'uso.
 *
 * Non sono documenti scritti da un legale: sono il resoconto onesto di cosa
 * l'app salva davvero, dove, chi lo vede e come si cancella. Prima di aprire
 * l'iscrizione a gente fuori dal giro di amici vanno fatti rivedere da chi di
 * dovere — e il testo lo dice invece di far finta di niente.
 */
import * as S from '../state.js';
import { esc } from '../ui.js';

const blocco = (titolo, righe) => `<section class="group"><h3>${titolo}</h3>
  <div class="a-card testo">${righe.map((r) => (Array.isArray(r) ? `<p><b>${r[0]}</b> ${r[1]}</p>` : `<p>${r}</p>`)).join('')}</div></section>`;

export const privacy = {
  title: 'Privacy', appbar: 'back', sub: () => 'Che dati tiene l\'app',
  render() {
    return `<main class="a-body">
      ${blocco('Cosa viene salvato', [
    ['Il tuo account:', 'indirizzo e-mail e nome che scegli. La password non la vede nessuno, nemmeno chi amministra: la custodisce Supabase, cifrata.'],
    ['La tua squadra:', 'nome, stemma, maglia, rosa, formazioni e punteggi di ogni giornata.'],
    ['Quello che fai nella lega:', 'contestazioni aperte e, per il Giudice Dati, il registro delle modifiche ai voti.'],
  ])}
      ${blocco('Chi lo vede', [
    'Gli altri partecipanti della tua lega vedono nome squadra, nome fantallenatore, stemma, maglia, rosa e formazioni una volta chiuse le giornate. È il gioco.',
    'La tua e-mail non è visibile agli altri partecipanti.',
    'Nessun dato viene venduto, ceduto o usato per pubblicità. Non ci sono tracciatori di terze parti e nessun cookie di profilazione.',
  ])}
      ${blocco('Dove sta', [
    `I dati vivono in un progetto Supabase${S.serverHost() ? ` (${esc(S.serverHost())})` : ''}, su server europei. Il listone, il calendario e i tabellini del campionato non sono dati personali: arrivano dai referti pubblici della FSGC.`,
    'Le preferenze dell\'app (tema, promemoria, e-mail ricordata) restano solo su questo dispositivo e non partono mai.',
  ])}
      ${blocco('Cancellare tutto', [
    'Chi ha creato una lega può eliminarla da Partecipanti: sparisce con tutto quello che conteneva, per tutti.',
    'Per cancellare il tuo account scrivi a chi amministra la lega: viene rimossa la riga del profilo e con essa squadra, rose e formazioni.',
  ])}
      ${blocco('Onestà su questa pagina', [
    'Questo testo descrive come funziona l\'app oggi, non è un\'informativa redatta da un legale. Prima di aprire le iscrizioni fuori dal giro di amici va fatta rivedere, insieme all\'accordo con la FSGC per nomi e prestazioni degli atleti (art. 14 del regolamento).',
  ])}
    </main>`;
  },
};

export const termini = {
  title: 'Termini', appbar: 'back', sub: () => 'Come si sta in questa app',
  render() {
    return `<main class="a-body">
      ${blocco('Cos\'è', [
    'Fantacampionato Sammarinese è un gioco fra amici sul campionato di San Marino. È gratuito, non ci sono acquisti, abbonamenti né premi in denaro.',
    'Non è affiliato alla FSGC né alle società del campionato.',
  ])}
      ${blocco('Come si calcolano i voti', [
    'I voti non li dà un giornalista: escono dagli eventi oggettivi dei referti di gara (il "Voto Titano"). Le regole complete stanno nel Regolamento della lega, che vale come riferimento in caso di disaccordo.',
    'Il Giudice Dati inserisce gli eventi e congela le giornate. Fino al congelamento puoi aprire una contestazione.',
  ])}
      ${blocco('Cosa ci si aspetta da te', [
    'Un account a testa. Le squadre e i nomi che scegli li vedono gli altri: niente insulti, niente nomi che prendano di mira qualcuno.',
    'Le foto che carichi come stemma devono essere tue o libere da usare. Chi amministra la lega può rimuovere quelle inadatte.',
  ])}
      ${blocco('Garanzie', [
    'L\'app è offerta così com\'è, senza garanzia di continuità: è un progetto amatoriale e i dati potrebbero andare persi. Non fidarti dell\'app come unico posto dove tieni qualcosa a cui tieni.',
  ])}
      ${blocco('Onestà su questa pagina', [
    'Anche questo testo descrive le intenzioni del progetto, non è un contratto scritto da un legale.',
  ])}
    </main>`;
  },
};
