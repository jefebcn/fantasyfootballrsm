/**
 * Dati, privacy, termini, archiviazione locale e licenze.
 *
 * Non sono documenti scritti da un legale: sono il resoconto onesto di cosa
 * l'app salva davvero, dove, chi lo vede e come si cancella, messo nell'ordine
 * che l'informativa richiede. Dove manca un dato — il titolare del trattamento
 * su tutti — il testo lo dichiara invece di inventarselo: un buco dichiarato e'
 * meglio di un nome falso in una pagina che la gente legge per fidarsi.
 */
import * as S from '../state.js';
import { esc, icon } from '../ui.js';
import { TITOLARE, CONTATTO, LEGALI_AGGIORNATE, ETA_MINIMA } from '../config.js';

const blocco = (titolo, righe) => `<section class="group"><h3>${titolo}</h3>
  <div class="a-card testo">${righe.filter(Boolean).map((r) => (Array.isArray(r) ? `<p><b>${r[0]}</b> ${r[1]}</p>` : `<p>${r}</p>`)).join('')}</div></section>`;

const dataIt = (iso) => { const d = new Date(iso); return Number.isFinite(+d)
  ? d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) : iso; };

/** Il titolare e' compilato solo se c'e' almeno un nome e un recapito. */
const titolareCompilato = () => !!(TITOLARE.nome && (TITOLARE.email || CONTATTO));
const rigaTitolare = () => {
  const r = [TITOLARE.nome, TITOLARE.sede, TITOLARE.paese,
    TITOLARE.codiceOperatore && `cod. operatore ${TITOLARE.codiceOperatore}`,
    TITOLARE.email || CONTATTO, TITOLARE.pec].filter(Boolean).map(esc);
  return r.join(' · ');
};
const avvisoTitolare = `<div class="warn block">${icon('warn', 'ic sm')}<span><b>Manca il titolare del trattamento.</b>
  Finché i dati di chi gestisce l'app non sono compilati (<code>TITOLARE</code> in <code>src/config.js</code>)
  questa informativa non è completa: va riempita prima di aprire le iscrizioni oltre il giro di amici.</span></div>`;

const piede = () => `<p class="small muted" style="text-align:center;margin-top:4px">
  Ultimo aggiornamento: ${esc(dataIt(LEGALI_AGGIORNATE))}.</p>`;

const disclaimer = blocco('Onestà su questa pagina', [
  'Questo testo descrive come funziona l\'app oggi ed è scritto per farsi capire, non da un legale. Prima di aprire le iscrizioni fuori dal giro di amici va fatto rivedere da chi di dovere, insieme all\'accordo con la FSGC per nomi e prestazioni degli atleti (art. 13 del regolamento).',
]);

export const privacy = {
  title: 'Privacy', appbar: 'back', sub: () => 'Che dati tiene l\'app',
  render() {
    return `<main class="a-body">
      ${titolareCompilato() ? '' : avvisoTitolare}
      ${blocco('Chi risponde dei tuoi dati', [
    titolareCompilato()
      ? `Titolare del trattamento: ${rigaTitolare()}. Per qualsiasi richiesta sui dati scrivi a quell'indirizzo.`
      : 'Non è ancora indicato chi è il titolare del trattamento. Nel frattempo il riferimento è chi amministra la tua lega, che trovi in Partecipanti.',
    'Non c\'è un responsabile della protezione dei dati (DPO): l\'app non fa trattamenti su larga scala né monitoraggio sistematico, quindi non è obbligatorio.',
  ])}
      ${blocco('Cosa viene salvato e perché', [
    ['Il tuo account:', 'indirizzo e-mail e nome che scegli, per farti entrare e riconoscerti. La password non la vede nessuno, nemmeno chi amministra: la custodisce Supabase, cifrata.'],
    ['La tua squadra:', 'nome, stemma, maglia, rosa, formazioni e punteggi di ogni giornata. Senza questi il gioco non esiste.'],
    ['Quello che fai nella lega:', 'contestazioni aperte e, per il Giudice Dati, il registro delle modifiche ai voti. Servono a poter ricostruire come è venuto fuori un punteggio.'],
    'Non ci sono profilazione, pubblicità, tracciatori di terze parti né cookie di marketing. Nessun dato viene venduto o ceduto.',
  ])}
      ${blocco('Su quale base', [
    ['Contratto:', 'account, squadra, rose, formazioni e punteggi. Sono quello che ti serve per giocare: senza, l\'app non può darti il servizio che hai chiesto iscrivendoti.'],
    ['Legittimo interesse:', 'il registro delle modifiche del Giudice Dati e i log tecnici del server, per tenere in piedi il servizio e poter dimostrare come è stato calcolato un voto contestato.'],
    ['Consenso:', 'solo per quello che scegli tu, come caricare una foto come stemma. Lo puoi togliere quando vuoi rimuovendo la foto.'],
  ])}
      ${blocco('Chi lo vede', [
    'Gli altri partecipanti della tua lega vedono nome squadra, nome fantallenatore, stemma, maglia, rosa e formazioni una volta chiuse le giornate. È il gioco.',
    'La tua e-mail non è visibile agli altri partecipanti.',
    ['Fornitori:', 'Supabase (banca dati e accessi) tratta i dati per conto di chi gestisce l\'app, come responsabile del trattamento, e non li usa per sé.'],
    ['YouTube:', 'gli highlights stanno sul canale della FSGC. Nessuna richiesta parte verso Google finché non tocchi play su un video; da quel momento Google vede il tuo indirizzo IP e cosa stai guardando, secondo le sue regole, non le nostre. Il dettaglio è in <a href="#/archiviazione">Cookie e memoria locale</a>.'],
  ])}
      ${blocco('Dove sta e per quanto', [
    `I dati vivono in un progetto Supabase${S.serverHost() ? ` (${esc(S.serverHost())})` : ''}, su server nell'Unione Europea. Non sono previsti trasferimenti fuori dallo Spazio economico europeo; se un domani servissero, questa pagina lo direbbe prima.`,
    ['Per quanto:', 'finché la tua squadra esiste in una lega. Eliminata la lega o il tuo profilo, i dati vanno via con loro. Il registro delle modifiche ai voti resta finché resta la lega, in forma anonima rispetto a chi non ne fa più parte.'],
    'Il listone, il calendario e i tabellini del campionato non sono dati personali tuoi: arrivano dai referti pubblici della FSGC.',
  ])}
      ${blocco('I tuoi diritti', [
    'Puoi chiedere di <b>vedere</b> i dati che ti riguardano, di <b>correggerli</b>, di <b>cancellarli</b>, di <b>limitarne</b> l\'uso, di <b>riceverli</b> in un formato leggibile da una macchina e di <b>opporti</b> a un trattamento fondato sul legittimo interesse.',
    `Molte cose le fai già da solo: nome squadra, stemma e maglia si cambiano in <a href="#/squadra">La mia squadra</a>, e chi ha creato una lega la elimina da <a href="#/lega">Partecipanti</a> con tutto quello che conteneva, per tutti.`,
    titolareCompilato()
      ? `Per il resto scrivi a ${esc(TITOLARE.email || CONTATTO)}: la risposta arriva entro un mese.`
      : 'Per il resto, finché non c\'è un indirizzo indicato, la richiesta va fatta a chi amministra la tua lega.',
    'Se ritieni che i tuoi dati siano trattati male puoi rivolgerti all\'autorità di controllo del tuo Paese: in Italia il Garante per la protezione dei dati personali, a San Marino l\'Autorità Garante per la protezione dei dati personali.',
  ])}
      ${blocco('Minori', [
    `L'app non è pensata per chi ha meno di ${ETA_MINIMA} anni e non chiede né usa dati di bambini. Se ti accorgi che un profilo appartiene a un minore di quell'età, segnalalo a chi amministra la lega: viene rimosso.`,
  ])}
      ${blocco('Se questa pagina cambia', [
    'Le modifiche importanti vengono scritte qui con la data in fondo. Se cambiasse qualcosa di sostanziale — un fornitore nuovo, un trattamento nuovo — lo trovi segnalato nell\'app, non solo in questa pagina.',
  ])}
      ${disclaimer}
      ${piede()}
    </main>`;
  },
};

export const termini = {
  title: 'Termini', appbar: 'back', sub: () => 'Come si sta in questa app',
  render() {
    return `<main class="a-body">
      ${blocco('Cos\'è', [
    'Fantacampionato Sammarinese è un gioco fra amici sul campionato di San Marino. È gratuito, non ci sono acquisti, abbonamenti né premi in denaro.',
    'Non è affiliato alla FSGC né alle società del campionato, e non ne rappresenta le posizioni.',
  ])}
      ${blocco('Chi può iscriversi', [
    `Serve aver compiuto ${ETA_MINIMA} anni e un account a testa. Un profilo per più persone, o più profili per la stessa persona nella stessa lega, falsano il gioco per tutti.`,
    'Le credenziali sono tue: se ti accorgi che qualcun altro entra nel tuo profilo, cambia la password e avvisa chi amministra la lega.',
  ])}
      ${blocco('Come si calcolano i voti', [
    'I voti non li dà un giornalista: escono dagli eventi oggettivi dei referti di gara (il "Voto Titano"). Le regole complete stanno nel <a href="#/regolamento">Regolamento</a>, che vale come riferimento in caso di disaccordo.',
    'Il Giudice Dati inserisce gli eventi e congela le giornate. Fino al congelamento puoi aprire una contestazione; dopo, la giornata non si tocca più.',
    'Chi amministra può cambiare alcune opzioni di regolamento a lega in corso: quando succede, le giornate non ancora congelate vengono ricalcolate. L\'app lo dice a chi sta per farlo.',
  ])}
      ${blocco('Cosa ci si aspetta da te', [
    'Le squadre e i nomi che scegli li vedono gli altri: niente insulti, niente nomi che prendano di mira qualcuno, niente riferimenti che una persona della lega non gradirebbe vedere associati a sé.',
    'Le foto che carichi come stemma devono essere tue o libere da usare. Caricandole confermi di averne il diritto e permetti agli altri della lega di vederle, nient\'altro.',
    'Chi amministra la lega può rimuovere contenuti inadatti e, nei casi seri, togliere dalla lega chi li ha messi. Contro una decisione del genere puoi dire la tua a chi amministra: non c\'è un giudice sopra di lui.',
  ])}
      ${blocco('Garanzie e responsabilità', [
    'L\'app è offerta così com\'è, senza garanzia di continuità: è un progetto amatoriale, può fermarsi, sbagliare un conto o perdere dei dati. Non tenerci dentro qualcosa a cui tieni e che non hai altrove.',
    'Chi gestisce l\'app risponde di quello di cui deve rispondere per legge — e questa riga non serve a scansarlo — ma non di un campionato saltato, di un referto sbagliato alla fonte o di un premio simbolico perso per un punteggio poi corretto.',
  ])}
      ${blocco('Chiudere', [
    'Puoi uscire da una lega quando vuoi da Partecipanti. Chi ha creato la lega può eliminarla, e sparisce per tutti.',
    'Per cancellare l\'account scrivi a chi amministra la lega: vengono rimossi profilo, squadra, rose e formazioni.',
  ])}
      ${blocco('Legge e modifiche', [
    TITOLARE.paese
      ? `Vale la legge di ${esc(TITOLARE.paese)}. Se sei un consumatore, restano ferme le tutele del Paese in cui vivi, che nessuna riga qui può toglierti.`
      : 'La legge applicabile sarà indicata insieme ai dati di chi gestisce l\'app. Se sei un consumatore, restano comunque ferme le tutele del Paese in cui vivi.',
    'Se questi termini cambiano lo trovi scritto qui con la data in fondo. Continuare a usare l\'app dopo una modifica vuol dire accettarla; se non ti va, puoi uscire dalla lega.',
  ])}
      ${blocco('Onestà su questa pagina', [
    'Anche questo testo descrive le intenzioni del progetto ed è scritto per farsi capire: non è un contratto redatto da un legale.',
  ])}
      ${piede()}
    </main>`;
  },
};

export const archiviazione = {
  title: 'Cookie e memoria locale', appbar: 'back', sub: () => 'Cosa resta su questo telefono',
  render() {
    const chiavi = [
      ['fcs:prefs', 'tema, lingua, promemoria, lega aperta l\'ultima volta'],
      ['fcs:auth', 'da quale sistema sei entrato'],
      ['fcs:supabase', 'indirizzo del server, se l\'hai impostato a mano'],
      ['fcs:email', 'l\'e-mail ricordata nella schermata di accesso, se l\'hai chiesto'],
      ['sb-…-auth-token', 'la sessione di accesso, tenuta da Supabase per non farti rifare l\'accesso a ogni apertura. Se ne va quando esci dall\'account'],
    ];
    return `<main class="a-body">
      ${blocco('Nessun banner, e il motivo', [
    'Questa app <b>non usa cookie</b>. Non ce n\'è uno, né di profilazione né di statistica: non c\'è nessun sistema di analisi del traffico e nessuno strumento di terzi che ti segua.',
    'Quello che usa è la memoria locale del browser, e solo per cose tecniche che servono a far funzionare l\'app come l\'hai lasciata. Per questo non compare una finestra a chiederti il consenso: per l\'archiviazione strettamente necessaria non va chiesto, e chiedertelo lo stesso sarebbe solo un fastidio inutile.',
    'Anche i caratteri sono serviti da qui. Prima arrivavano da Google Fonts, il che mandava il tuo indirizzo IP a Google a ogni apertura senza che nessuno l\'avesse chiesto: adesso i file stanno nell\'app.',
  ])}
      ${blocco('L\'unica eccezione: i video', [
    'Gli highlights delle partite stanno su YouTube, che è di Google. <b>Finché non tocchi play non parte nessuna richiesta verso di loro:</b> la copertina con squadre e risultato la disegna l\'app con i dati che ha già, non è un\'immagine scaricata da YouTube.',
    'Quando tocchi play il video viene caricato da <code>youtube-nocookie.com</code>, il dominio che YouTube usa apposta per non installare i suoi cookie pubblicitari. A quel punto Google vede comunque il tuo indirizzo IP e che stai guardando quel video: è inevitabile per far partire un filmato che sta da loro, e succede perché l\'hai chiesto tu toccando play.',
    'Se preferisci non caricarlo dentro l\'app, ogni video ha un collegamento "Apri su YouTube" che ti porta di là: quello che succede dopo vale fra te e Google, e sono le loro regole.',
  ])}
      ${blocco('Cosa c\'è dentro, voce per voce', chiavi.map(([k, d]) => [`<code>${k}</code>`, d]))}
      ${blocco('Dove non arriva', [
    'Questa roba resta su questo dispositivo, in questo browser. Non parte verso nessun server, né il nostro né altri, e non è leggibile da altri siti.',
    'Un video avviato può lasciare qualcosa nella memoria del riquadro di YouTube, che è di Google e non nostra: la cancelli svuotando i dati del sito dal browser, come tutto il resto.',
    'Non c\'è nient\'altro: niente sessionStorage, niente banche dati nel browser, nessuna chiave oltre quelle elencate qui sopra.',
  ])}
      ${blocco('Come si cancella', [
    'Da <a href="#/impostazioni">Profilo</a> puoi uscire dall\'account: la sessione se ne va.',
    'Per togliere tutto il resto basta cancellare i dati del sito dalle impostazioni del browser, o disinstallare l\'app se l\'hai aggiunta alla schermata principale. Non resta niente altrove.',
    'La cache del service worker (le pagine salvate per farla funzionare senza rete) contiene solo file dell\'app: nessun dato tuo.',
  ])}
      ${piede()}
    </main>`;
  },
};

export const licenze = {
  title: 'Licenze e crediti', appbar: 'back', sub: () => 'Di chi è quello che vedi',
  render() {
    return `<main class="a-body">
      ${blocco('I dati del campionato', [
    'Calendario, risultati, tabellini e anagrafiche degli atleti vengono dai referti pubblici della <b>FSGC</b>, la Federazione Sammarinese Giuoco Calcio. Sono pubblicati da lei e qui vengono solo riorganizzati.',
    'Nomi delle società e degli atleti compaiono a scopo descrittivo, per identificare chi ha giocato cosa. L\'app non è affiliata alla FSGC e non ha con lei alcun accordo: prima di aprire le iscrizioni fuori dal giro di amici va chiesto il permesso per l\'uso dei nomi e delle prestazioni degli atleti.',
  ])}
      ${blocco('Software di terze parti', [
    ['supabase-js', 'libreria per la banca dati e gli accessi, licenza MIT, caricata da jsDelivr a versione fissa.'],
    ['Lato e IBM Plex Mono', 'i caratteri, licenza SIL Open Font License 1.1, che permette di ridistribuirli: infatti i file stanno nell\'app invece di essere chiesti a Google a ogni apertura.'],
    'Il resto dell\'app è scritto senza framework né librerie: niente altro codice di terzi gira su questa pagina.',
  ])}
      ${blocco('I video', [
    'Gli highlights sono del canale YouTube della <b>FSGC</b> e restano suoi: l\'app non li copia né li ricarica altrove, si limita a mostrarli da dove stanno e a dire a quale partita appartengono.',
  ])}
      ${blocco('Immagini e personaggi', [
    `<b>Questa è la parte da sistemare prima di aprire al pubblico.</b> Gli avatar selezionabili raffigurano personaggi e persone riconoscibili, e le fotografie di sfondo non sono state realizzate per questo progetto. In una lega privata fra amici è una cosa; pubblicarli a chiunque è un'altra, e vuole materiale originale o con licenza.`,
    'Stemmi e maglie caricati dai partecipanti restano di chi li ha caricati: l\'app li mostra solo agli altri della sua lega.',
    'Il logo, le icone e il campo di gioco sono disegnati per questo progetto.',
  ])}
      ${piede()}
    </main>`;
  },
};
