# Pubblicare Fantatitano sull'App Store

La strada completa, in ordine. Il resto è già nel repository. Il giorno del
Mac in prestito è il **passo 7**: tutto quello che viene prima si fa da iPhone
o dal computer, così sul Mac si sta due-tre ore e non un pomeriggio.

**Chi fa cosa.** Da San Marino Apple non accetta l'iscrizione al programma
sviluppatori, quindi l'account lo intesta **l'amico** (cittadino croato, UE).
Lui fa solo i passi marcati **AMICO**: iscriversi, invitare Alex, rinnovare
ogni anno. Una volta invitato come Admin, **TU** (Alex) fai tutto il resto con
il tuo ID Apple. **IO** sono le parti che faccio io nel repository.

Come per Google Play (PLAY.md), l'app **è il sito**: un guscio nativo
(Capacitor) apre `https://fantatitano.site` a schermo intero. Quello che si
aggiorna sul sito arriva anche nell'app, senza passare da Apple. In più il
guscio aggiunge le cose che Apple vuole da un'app vera: notifiche native,
condivisione nativa, link che aprono l'app.

---

## Dove trovi cosa

| Cosa | Dove sta | Quando serve |
|---|---|---|
| Questa guida | `IOS.md` | sempre |
| Testi della scheda, privacy, età, note per il revisore | `store/scheda-appstore.md` | passi 4 e 9 |
| Icona 1024×1024 | `store/ios/icona-1024.png` (è anche già dentro Xcode) | passo 4 |
| Screenshot iPhone 1290×2796 | `store/ios/*.jpg` | passo 4 |
| Progetto Xcode | `ios/App/App.xcodeproj` | passo 7 |
| Impostazioni dell'app (indirizzo del sito, nome, bundle id) | `capacitor.config.json` | non si tocca |
| Pagina mostrata se manca la rete | `nativo/www/offline.html` | non si tocca |
| Notifiche nell'app (lato telefono) | `src/notifiche.js` | non si tocca |
| Notifiche (lato server, invio tramite Apple) | `supabase/functions/promemoria/index.ts` | passo 3 |
| Link universali (i link del sito aprono l'app) | `scripts/ios-link-universali.mjs` | passo 2 |
| Pagina di assistenza per la scheda | `assistenza.html` → `fantatitano.site/assistenza.html` | passo 4 |

**Dati fissi dell'app**, da copiare dove servono:

| | |
|---|---|
| Nome | `Fantatitano` |
| Bundle ID | `site.fantatitano.app` |
| SKU (codice interno, lo vedi solo tu) | `fantatitano-ios` |
| Lingua principale | Italiano |
| Versione / build | `1.0` / `1` |

---

## 1. Account Apple Developer — **AMICO**, da iPhone, subito

È il passo più lento: parte per primo.

1. Sull'iPhone installa l'app **Apple Developer** (gratis, dall'App Store).
2. Entra con il **suo** ID Apple. Serve l'**autenticazione a due fattori**
   attiva (Impostazioni → il suo nome → Accesso e sicurezza).
3. Tocca **Iscriviti ora** (*Enroll*), sceglie **Persona fisica**
   (*Individual*), fotografa il suo documento quando lo chiede.
4. Paga **99 € l'anno** (puoi rimborsarglieli tu: per Apple paga lui).

Tempi: di solito 24-48 ore. Gli arriva un'e-mail «Welcome to the Apple
Developer Program».

**Cosa vuol dire intestarlo a lui.** Per Apple l'app è **sua**: il suo nome
compare sullo Store come sviluppatore, il contratto con Apple è a suo nome e
solo lui può rinnovare l'iscrizione e accettare i nuovi contratti quando
Apple li cambia (arriva un avviso in App Store Connect: va accettato, se no si
bloccano gli aggiornamenti). Tutto il resto lo fai tu come Admin (passo 1b).

**«Sei un operatore commerciale?» (DSA).** Le regole europee obbligano Apple a
chiederlo. Se risponde **sì** (l'app ha sponsor, quindi è un'attività),
sulla scheda compaiono **il suo nome, indirizzo, telefono ed e-mail**. Per
telefono ed e-mail può mettere quelli dell'app (`support@fantatitano.site`);
l'indirizzo deve essere il suo. Se risponde **no** l'app resta disponibile
con l'avviso che non è un operatore commerciale: finché gli sponsor non sono
attivi è una risposta difendibile, e si può cambiare in seguito da App Store
Connect → Business. Decidetelo insieme prima che risponda.

**Una cosa da fare fra voi.** Una scrittura privata semplice, anche una mail
firmata da tutti e due: l'app, il nome Fantatitano e i dati sono tuoi, lui
tiene l'account per conto tuo e lo trasferisce quando glielo chiedi. Apple
permette di **trasferire un'app pubblicata** a un altro account (per esempio
quello di una società) mantenendo recensioni e utenti: passo 11.

## 1b. L'invito ad Alex come Admin — **AMICO**, 5 minuti, poi **TU**

Appena l'account è attivo, dal computer:

1. [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **Utenti e
   accesso** → **+**.
2. Nome, cognome ed **e-mail dell'ID Apple di Alex**.
3. Ruolo **Admin**, e spunta **Accesso a Certificati, Identificatori e
   Profili** (serve per la chiave delle notifiche e per firmare l'app).
4. **Invita**.

**TU**: ti arriva un'e-mail da Apple, tocca **Accetta l'invito** ed entra con
il tuo ID Apple (anche lui con l'autenticazione a due fattori). Da qui in
avanti, ogni volta che la guida dice «developer.apple.com» o «App Store
Connect», entri **tu** col tuo ID Apple e scegli il team dell'amico (in alto
a destra, se hai più team).

## 2. Il Team ID — **TU**, poi **IO**

Dopo l'invito: [developer.apple.com/account](https://developer.apple.com/account)
→ **Membership details** → **Team ID** (10 lettere e numeri). È quello del
team dell'amico.

Mandamelo: con quello lancio

```sh
node scripts/ios-link-universali.mjs IL_TEAM_ID
```

che scrive `.well-known/apple-app-site-association` e lo pubblico col sito.
È il file che fa aprire l'app (invece di Safari) quando qualcuno tocca un
link di fantatitano.site su un iPhone che ha l'app. Non contiene niente di
segreto: il Team ID compare comunque in ogni app pubblicata.

## 3. Chiave per le notifiche (APNs) — **TU**, dal computer, 10 minuti

Le notifiche nell'app iPhone passano da Apple, che vuole una chiave.

1. [developer.apple.com/account](https://developer.apple.com/account) →
   **Certificates, Identifiers & Profiles** → **Keys** → **+**.
2. Nome: `Fantatitano notifiche`. Spunta **Apple Push Notifications service
   (APNs)** → *Configure* → Environment **Sandbox & Production** → Continue →
   Register.
3. **Download**: scarica il file `AuthKey_XXXXXXXXXX.p8`. **Si scarica una
   volta sola**: tienilo in un posto sicuro, non mandarlo in chat e non
   metterlo nel repository. Annota il **Key ID** (10 caratteri).
4. Supabase → il progetto → **Edge Functions** → **Secrets**, aggiungi:

   | Nome | Valore |
   |---|---|
   | `APNS_KEY` | tutto il contenuto del file .p8 (aprilo con un editor di testo), righe `BEGIN` / `END` comprese |
   | `APNS_KEY_ID` | il Key ID |
   | `APNS_TEAM_ID` | il Team ID del passo 2 |

5. **Ridistribuisci la funzione** `promemoria`: il codice nuovo (quello che
   sa parlare con Apple) è in `supabase/functions/promemoria/index.ts`. Dal
   pannello: Edge Functions → promemoria → *Code* → incolla il file → Deploy.
   Da terminale: `supabase functions deploy promemoria --no-verify-jwt`.

Finché i secret non ci sono, gli iPhone dell'app vengono saltati (e rimessi
in coda) e le notifiche web partono come oggi: niente si rompe.

## 4. L'app su App Store Connect — **TU**, dal computer, 30-40 minuti

Si fa tutto dal browser, **prima** del giorno del Mac.

**4a. Registra il Bundle ID.** developer.apple.com → Certificates,
Identifiers & Profiles → **Identifiers** → **+** → *App IDs* → *App*.
Descrizione `Fantatitano`, Bundle ID **Explicit** `site.fantatitano.app`.
Nelle *Capabilities* spunta **Push Notifications** e **Associated Domains**.
Register.

**4b. Crea l'app.** [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
→ **App** → **+** → **Nuova app**: piattaforma iOS, nome `Fantatitano`,
lingua Italiano, Bundle ID `site.fantatitano.app`, SKU `fantatitano-ios`,
accesso completo.

Se il nome «Fantatitano» risultasse già preso, prova `Fantatitano -
Fantacalcio` e dimmelo: aggiorno la scheda.

**4c. Compila la scheda** copiando da `store/scheda-appstore.md`:
sottotitolo, testo promozionale, descrizione, parole chiave, URL, categoria,
prezzo (Gratis), classificazione per età, privacy dell'app. Carica i sette
screenshot da `store/ios/` nella sezione **iPhone 6,9"**, nell'ordine scritto
nella scheda.

La build non c'è ancora: il bottone «Invia per la revisione» resta spento
fino al passo 7. Va bene così.

## 5. Il Mac in prestito — **chi lo presta**, il giorno prima

Da controllare e preparare **prima**, perché sono le cose lente:

1. **macOS 15.6 o più recente** (Mela → Informazioni su questo Mac). Da
   aprile 2026 Apple accetta solo app fatte con **Xcode 26**, che su macOS
   più vecchi non si installa. Qualsiasi Mac con chip Apple (M1 o più nuovi)
   va bene; un Intel vecchio potrebbe non arrivarci.
2. **Xcode** dall'App Store del Mac: pesa più di 10 GB, ci mette ore. Una
   volta installato va **aperto una volta**: chiede di installare i
   componenti iOS (*iOS platform*), si dice sì e si aspetta.
3. **Almeno 40 GB liberi** sul disco.
4. **Node.js** versione LTS da [nodejs.org](https://nodejs.org) (il
   pacchetto .pkg, cinque minuti). Si può fare anche il giorno stesso.

Non serve installare altro: niente CocoaPods, niente Android Studio.

## 6. L'account di prova per Apple — **TU** (o insieme)

Il revisore Apple apre l'app ed entra: se non ha un account che funziona,
rifiuta al primo giro. Serve un account **apposta**:

1. Crea un indirizzo e-mail nuovo, per esempio un Gmail
   `fantatitano.revisione@gmail.com`, e iscriviti all'app con quello.
2. L'account deve avere **una lega con una rosa completa**, così il revisore
   vede la formazione, i voti e la classifica. Il modo più semplice: una lega
   privata «Prova Apple» creata da quell'account, con la rosa assegnata.
   Questo passaggio lo prepariamo insieme quando l'account esiste.
3. Scrivi e-mail e password nelle note per il revisore (passo 9).

## 7. Il giorno del Mac — **TU**, 2-3 ore

Apri il **Terminale** sul Mac (Cmd+Spazio, scrivi «Terminale»):

```sh
git clone https://github.com/jefebcn/fantasyfootballrsm.git
cd fantasyfootballrsm
npm install
npx cap sync ios
npx cap open ios
```

Se `git` non c'è, il Mac propone di installare gli «strumenti da riga di
comando»: si accetta e si riprova. In alternativa: su GitHub *Code →
Download ZIP*, si scompatta, e nel Terminale si entra nella cartella con
`cd ` seguito dal trascinamento della cartella nella finestra.

Si apre Xcode. Poi:

1. **Xcode → Settings → Accounts → +** → *Apple ID* → entra con **il tuo** ID
   Apple (quello invitato come Admin al passo 1b).
2. Nella colonna a sinistra clicca **App** (l'icona blu in cima), poi il
   target **App** → scheda **Signing & Capabilities**:
   - spunta **Automatically manage signing**;
   - **Team**: il team dell'amico (porta il suo nome);
   - controlla che ci siano **Push Notifications** e **Associated Domains**
     (arrivano già dal progetto). Se una manca: **+ Capability** e aggiungila.
3. Aspetta che Xcode scarichi i pacchetti (barra in alto: *Resolving
   Package Graph*). Serve internet; ci mette qualche minuto la prima volta.
4. In alto, come destinazione scegli **Any iOS Device (arm64)**.
5. Menu **Product → Archive**. Dopo qualche minuto si apre l'**Organizer**.
6. **Distribute App → App Store Connect → Upload** → avanti con le scelte
   proposte → **Upload**.
7. Arriva un'e-mail quando Apple ha elaborato la build: 15-30 minuti.

Se vuoi provarla subito sul tuo iPhone col cavo: collega il telefono,
sceglilo come destinazione al posto di *Any iOS Device* e premi ▶. Su
iPhone va attivata la *Modalità sviluppatore* (Impostazioni → Privacy e
sicurezza). Le notifiche in questa modalità passano dal server di prova di
Apple: per provarle così serve il secret `APNS_SANDBOX` = `1` su Supabase, da
**togliere** dopo. Con TestFlight (passo 8) non serve.

**Errori che possono capitare**

| Messaggio | Cosa fare |
|---|---|
| *No account for team* / *Signing requires a development team* | punto 1 e 2: account in Xcode e Team scelto |
| *Failed to register bundle identifier* | il Bundle ID è già registrato su un altro account: dimmelo |
| *You do not have permission to create certificates* | nell'invito del passo 1b manca la spunta «Accesso a Certificati, Identificatori e Profili»: l'amico la aggiunge da Utenti e accesso |
| *Missing package product* / errori sui pacchetti | File → Packages → **Reset Package Caches**, poi riprova |
| *SDK version issue* (90725) all'upload | Xcode troppo vecchio: serve Xcode 26 o più recente |
| L'upload chiede la crittografia | è già dichiarata nel progetto; se lo chiede: «Nessuno degli algoritmi» |

## 8. TestFlight: la prova sul tuo iPhone — **TU**, 20 minuti

App Store Connect → l'app → **TestFlight** → aggiungi te stesso come
*tester interno*. Sull'iPhone installa l'app **TestFlight**, accetta
l'invito e installa Fantatitano.

Da provare, una riga alla volta:

- [ ] L'app si apre con l'icona e la schermata blu con la corona
- [ ] Accesso con e-mail e password
- [ ] Formazione: si apre, si salva
- [ ] Impostazioni → Preferenze notifiche → **Consenti le notifiche**:
      compare la richiesta di iOS, e il foglio dice che il telefono è iscritto
- [ ] Un invito alla lega condiviso: si apre il foglio di condivisione di iOS
- [ ] Un link di fantatitano.site toccato da WhatsApp apre l'app (dopo il
      passo 2)
- [ ] In modalità aereo: compare la pagina «Non riesco a collegarmi», e
      «Riprova» funziona tornata la rete
- [ ] La barra in alto (ora, batteria) si legge su chiaro e su scuro

Se qualcosa non va, mandami uno screenshot: si corregge sul sito e spesso non
serve neanche rifare la build.

## 9. Invio in revisione — **TU**

App Store Connect → l'app → la versione 1.0:

1. **Build**: scegli quella caricata.
2. **Informazioni per la revisione**: e-mail e password dell'account di
   prova (passo 6), le note in inglese da `store/scheda-appstore.md`, il tuo
   recapito (lo vede solo Apple).
3. **Rilascio**: «Rilascia manualmente», così decidi tu il giorno.
4. **Aggiungi per la revisione → Invia**.

Tempi: di solito 24-48 ore. L'esito arriva per e-mail e nell'app App Store
Connect sul telefono.

## 10. Se Apple rifiuta

Succede spesso al primo invio, e non è grave: si risponde dal Resolution
Center e si rimanda.

| Regola citata | Cosa vuol dire | Cosa rispondere / fare |
|---|---|---|
| **4.2** Minimum Functionality | «è solo un sito impacchettato» | Elencare le funzioni native: notifiche push native per il promemoria della formazione, condivisione nativa, link universali, schermata offline. Se insistono, si aggiunge altro di nativo (vibrazione, widget): dimmelo |
| **5.2.1** Intellectual Property | chiedono i diritti su nomi e dati | Spiegare che sono dati pubblici delle partite usati in modo descrittivo, e allegare l'accordo con l'Associazione Calciatori appena c'è |
| **2.1** App Completeness | non sono riusciti a entrare o a vedere i contenuti | Controllare l'account di prova (passo 6) e riprovare |
| **5.1.1(v)** Account deletion | non trovano dove si cancella l'account | Indicare: Profilo → «Elimina account» |

## 11. Dopo la pubblicazione

- **Gli aggiornamenti del sito arrivano da soli** nell'app: niente build
  nuova, niente revisione.
- **Una build nuova serve solo** se cambia la parte nativa (icona, plugin,
  versione minima di iOS) o quando Apple alza i requisiti, circa una volta
  l'anno. Si rifà il passo 7 con il numero di build aumentato (Xcode → target
  App → General → Build: 2, 3, ...).
- Senza Mac si può usare un servizio che compila nel cloud su Mac in affitto
  (per esempio Codemagic, che ha un piano gratuito): si configura una volta
  con le chiavi di App Store Connect. Quando servirà, lo preparo.
- L'abbonamento sviluppatore si rinnova ogni anno (99 €) e lo rinnova
  **l'amico**: se scade, l'app sparisce dallo Store. Conviene il rinnovo
  automatico.
- **Passare l'app a un altro account** (tuo, se un giorno Apple lo permette
  da San Marino, o di una società): App Store Connect → l'app → Informazioni
  sull'app → **Trasferisci app**. Lo avvia l'amico, lo accetta il nuovo
  titolare; l'app resta sullo Store con recensioni e utenti. Prima del
  trasferimento si aggiornano i secret delle notifiche (nuova chiave del
  nuovo team) e il file dei link (passo 2).

## Tempi in breve

| Passo | Chi | Tempo |
|---|---|---|
| 1. Account Apple Developer | AMICO | 1-2 giorni di attesa |
| 1b. Invito di Alex come Admin | AMICO, poi TU | 5 minuti |
| 2-4. Team ID, chiave notifiche, scheda | TU (+ IO) | 1 ora in tutto |
| 5. Preparare il Mac | chi lo presta | la sera prima |
| 6. Account di prova | insieme | 20 minuti |
| 7. Build e upload | TU sul Mac | 2-3 ore |
| 8. TestFlight | TU | 20 minuti |
| 9. Revisione Apple | Apple | 1-2 giorni (+ un giro se rifiutano) |
