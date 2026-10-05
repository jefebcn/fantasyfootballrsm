# Pubblicare Fantatitano su Google Play

Fantatitano è un'app web. Su Play ci va **così com'è**, dentro un guscio
Android che apre il sito a schermo intero, senza barra dell'indirizzo: si
chiama TWA (*Trusted Web Activity*) ed è il modo ufficiale di Google per
portare una PWA sullo Store. Non si riscrive niente: quello che si aggiorna
sul sito è aggiornato anche nell'app, senza passare dallo Store.

Questo file è la strada, in ordine. Le parti che tocca fare a mano sono
marcate **TU**; il resto è già nel repository.

---

## Stato al 21 settembre: la base è in piedi

Misurato dall'esterno, non dato per buono:

| | |
|---|---|
| `https://fantatitano.site/` | 200, serve l'app (versione uguale al repository) |
| `https://www.fantatitano.site/` | 308 verso il dominio nudo, col percorso conservato |
| `…/.well-known/assetlinks.json` | **200 `application/json`, diretto** — nessun redirect |
| `privacy.html`, `termini.html` | 200 |
| Posta in uscita (Resend su `send`) | MX, SPF e DKIM a posto; conferma e-mail attiva e provata |
| Posta in arrivo (`support@`) | inoltro ImprovMX, provato |

**Aggiornato al 21 settembre, sera.** Adesso e' pronto anche tutto il
materiale della scheda, che di solito e' la parte che fa perdere una
giornata:

| | |
|---|---|
| Otto screenshot 1080×1920 | `store/*.jpg`, rigenerabili con `node scripts/schermate-store.cjs` |
| Grafica d'intestazione 1024×500 | `store/grafica-1024x500.jpg` |
| Nome, descrizioni, categoria, Data safety | `store/scheda-play.md`, gia' dentro i limiti |
| Pagina per cancellare l'account | `cancella-account.html` — **Play la pretende**, vedi il punto 2 |

Quindi di questo documento restano da fare i punti **4** (generare il
pacchetto) e **5** (Play Console), piu' la riga dell'impronta al punto 3 —
che si puo' scrivere solo dopo, perche' quel valore lo produce Play.

## 0. Cosa serve prima di cominciare

- **Account Google Play Console**: Alex ne ha già uno (ha pubblicato un'altra
  app), quindi i 25 $ e l'attesa della verifica sono già passati. Due cose da
  guardare lo stesso (**TU**): che la **verifica d'identità** dell'account sia
  completa — Google l'ha resa obbligatoria e senza quella non si pubblica — e
  **con che nome** l'account è intestato, perché quel nome si vede nello Store
  e l'informativa dell'app dichiara come titolare del trattamento
  Mediterranean Digital Solutions Ltd: se l'account è personale, le due cose
  raccontano storie diverse a chi legge.
- Il **dominio** che serve l'app: `fantatitano.site` — **fatto**, punta a
  Vercel con HTTPS e il dominio nudo è quello primario (vedi lo stato qui
  sopra). Il verso conta: se fosse il `www` a servire l'app, `assetlinks.json`
  risponderebbe con un redirect e Android non lo seguirebbe.
- Per generare il pacchetto: **niente**, se usi PWABuilder (punto 4).

Quello che *non* serve: Android Studio, e scrivere codice Android.

## 1. Quello che era già a posto

Il manifesto (`manifest.webmanifest`) ha già tutto quello che Bubblewrap
pretende: `name`, `short_name`, `id`, `start_url`, `scope`, `display:
standalone`, `theme_color`, `background_color`, e le icone 192, 512 e
**maskable** 512 — quest'ultima è quella che Android ritaglia dentro la
forma delle icone del telefono, e senza finisce in un cerchio bianco.

C'è il service worker, quindi l'app si apre anche senza rete: è uno dei
requisiti di qualità che Play guarda.

## 2. Le pagine legali, che Play chiede per indirizzo

`privacy.html` e `termini.html` stanno nella radice del sito e si leggono
**senza JavaScript**: sono generate dalle stesse viste dell'app con
`node scripts/genera-legali.cjs`, quindi non esistono due testi da tenere
allineati. `prove/legali-statiche.cjs` fallisce se qualcuno le modifica a
mano o si dimentica di rigenerarle.

Nei moduli di Play useremo:

| Campo | Indirizzo |
|---|---|
| Privacy policy | `https://fantatitano.site/privacy.html` |
| Termini | `https://fantatitano.site/termini.html` |
| Cancellazione account | `https://fantatitano.site/privacy.html` (la sezione dei diritti spiega il bottone in Profilo) |

Quell'ultima riga non è un dettaglio: Play **pretende** che un'app con
account permetta di cancellarlo dall'app *e* che esista una pagina che
spiega come si chiede la cancellazione. L'app il bottone ce l'ha già
(Profilo → elimina), la pagina adesso anche.


### La pagina che fa respingere le app: cancellare l'account

Play pretende, per **ogni app che fa creare un account**, due strade per
cancellarlo: una dentro l'app (c'e' gia': Profilo → Elimina account) e una
**raggiungibile dal web**, senza installare niente e senza fare l'accesso. La
pagina deve nominare l'app come sta nella scheda e dire come si chiede.

E' `https://fantatitano.site/cancella-account.html`, e nel Play Console va
incollata nel campo apposito del modulo **Data safety**. Come privacy e
termini, non si scrive a mano: si genera dall'app con
`node scripts/genera-legali.cjs`, e `prove/legali-statiche.cjs` controlla che
le due copie dicano la stessa cosa.

Dice quello che il database fa davvero (migrazione 010), compreso il caso in
cui la cancellazione **si rifiuta**: chi amministra una lega dove gioca anche
qualcun altro non puo' sparire e basta.

## 3. Il file che toglie la barra dell'indirizzo

`/.well-known/assetlinks.json` dice ad Android che quell'app è di questo
sito. Nel repository c'è già, con un **segnaposto** al posto dell'impronta:

- l'impronta giusta **non è quella del tuo computer**: con la firma di Play
  (l'impostazione predefinita) è Google a rifirmare il pacchetto. La trovi in
  Play Console → *Test and release → Setup → App signing → App signing key
  certificate → SHA-256* (**TU**)
- la incolli in `.well-known/assetlinks.json` al posto del segnaposto, fai il
  deploy, e controlli con:

```sh
./scripts/controlla-assetlinks.sh https://fantatitano.site
```

che verifica JSON, forma dell'impronta, `200`, `application/json` e che
quello in rete sia identico a quello nel repository.

Fino a quel momento l'app **funziona lo stesso**, ma con la barra del
browser in cima. È il difetto numero uno delle TWA pubblicate di fretta.

## 4. Generare il pacchetto

### La via senza installare niente: PWABuilder

È un sito, non un programma: fa lo stesso lavoro di Bubblewrap ma nel browser,
e non vuole né Node né il JDK.

- Vai su **pwabuilder.com**, incolla `https://fantatitano.site`
- Ti fa un rapporto sulla PWA (manifesto, service worker, icone): quello che
  chiede lo abbiamo già
- **Package for stores → Android → Generate**, con queste risposte:
  - *Package ID*: `app.fantatitano.site` (lo stesso di assetlinks.json)
  - *App name*: Fantatitano · *Launcher name*: Fantatitano
  - *Signing key*: **Create new** — e poi **scarica e conserva** lo zip che ti
    dà: dentro c'è il keystore e le sue password (**TU**)
- Scarichi lo zip: contiene `app-release-bundle.aab` (quello da caricare su
  Play), il keystore, e un `assetlinks.json` di esempio

Attenzione a una cosa: l'impronta che PWABuilder mette in quell'esempio è
quella della chiave che ha appena creato. Se su Play usi la **firma di Play**
(l'impostazione predefinita, e conviene), l'impronta buona è quella che il
Play Console mostra dopo il caricamento — vedi il punto 3.

### La via da riga di comando: Bubblewrap

Serve Node e un **JDK 17**.

```sh
npm install -g @bubblewrap/cli
bubblewrap init --manifest https://fantatitano.site/manifest.webmanifest
```

Risponde alle domande così:

- **Package name**: `app.fantatitano.site` (è quello già scritto in
  assetlinks.json: se lo cambi, cambialo anche lì)
- **App name**: Fantatitano · **Short name**: Fantatitano
- **Display mode**: standalone · **Orientation**: portrait
- **Status bar color**: `#1B84C6`
- **Signing key**: fatti creare il keystore da Bubblewrap e **conservalo** col
  suo password nel gestore password (**TU**). Serve a ogni aggiornamento: chi
  lo perde non può più aggiornare quella app, e deve pubblicarne un'altra.

Poi:

```sh
bubblewrap build          # produce app-release-bundle.aab
```

## 5. Play Console (**TU**)

- Crea l'app, carica `app-release-bundle.aab` su una **traccia interna** (non
  in produzione: la traccia interna si apre in minuti e la vedi solo tu)
- Compila la scheda: i testi, la categoria, i tag e gli indirizzi da incollare
  stanno **gia' scritti** in `store/scheda-play.md`; le immagini in `store/`
  (otto screenshot 1080×1920 e la grafica 1024×500, tutte JPEG perche' Play
  non vuole il canale alfa). L'icona 512 e' `icons/icon-512.png`
- Nel modulo **Data safety** ricordati il campo della **cancellazione
  dell'account**: `https://fantatitano.site/cancella-account.html`
- **Data safety**: le risposte, voce per voce e col perche', stanno in
  `store/scheda-play.md`. Devono combaciare con `privacy.html`, che e' scritto
  guardando il codice: se divergono, quella che conta per Google e' la loro
- **Content rating**: questionario, categoria sport/gioco
- **Target audience**: l'app accetta iscritti **dai 14 anni** (`ETA_MINIMA` in
  `src/config.js`). Se dichiari un pubblico che comprende i minori, Play
  applica le regole delle *Families*: leggile prima di rispondere
- Installa dalla traccia interna, apri, e guarda **se c'è la barra
  dell'indirizzo**: se c'è, l'impronta del punto 3 non è ancora giusta

## 5b. I 12 tester, che e' la parte lunga

Il link d'iscrizione al test chiuso, quello da mandare alle persone:

```
https://play.google.com/apps/testing/app.fantatitano.site
```

Serve **un telefono Android e un account Google**. Chi lo apre tocca «Diventa
un tester», poi scarica dallo Store come una qualsiasi app.

La regola che fa fallire i tentativi: **12 persone iscritte per 14 giorni
consecutivi**. Chi si iscrive e poi esce non conta, e il conto riparte. Quindi
il messaggio con cui le inviti deve dire due cose: che ci vuole Android, e che
non devono togliersi dal test per due settimane.

**I dodici ci sono dal 22/09/2026.** I quattordici giorni si
compiono il **06/10/2026**: da quel giorno il Console sblocca la
richiesta per la produzione. Fino ad allora l'unica cosa che puo' rovinare il
conto e' qualcuno che si toglie dal test o disinstalla: il contatore riparte
da zero, per tutti.

Il conto degli iscritti si guarda in *Test e release → Test chiusi → Tester*.
Quando arriva a 12 e sono passati i 14 giorni, il Console sblocca «Richiedi
l'accesso alla produzione».

## 5c. La richiesta per la produzione: le risposte

Quando il Console sblocca «Richiedi l'accesso alla produzione» apre un
questionario in tre parti: il test chiuso, l'app, la prontezza. È il punto in
cui Google respinge più spesso, e quasi sempre per risposte generiche («tutto
bene, nessun problema»). Qui sotto ci sono le risposte, scritte coi fatti veri
del test.

**Tre cose prima di incollare.**

1. **Google vede le statistiche del test chiuso**: quanti hanno installato,
   quanti hanno aperto l'app. Le risposte devono combaciare con quei numeri.
   I campi tra parentesi quadre `[ … ]` li sai solo tu: riempili coi numeri
   veri, anche se sono piccoli. Un numero piccolo e onesto passa; un numero
   gonfiato che non torna con le loro statistiche no.
2. **Nei 14 giorni del test non si è giocata nessuna giornata.** La 4ª si è
   chiusa il 20/09, la 5ª si gioca dal 9 all'11/10 (sosta del campionato). I
   tester hanno potuto iscriversi, entrare in una lega, fare la rosa e
   guardare i dati delle prime quattro giornate. Non hanno potuto vivere il
   giro della settimana: formazione, partite, voti, scontro diretto.
   Quindi due strade:
   - **chiedere il 6/10**, con le risposte qui sotto così come sono, che
     dicono la verità sulla sosta;
   - **chiedere lunedì 12/10**, dopo la 5ª giornata. Il requisito dei 14
     giorni resta soddisfatto, e in più le risposte possono dire «hanno
     schierato la formazione e visto i voti di una giornata vera». Il
     passaggio da aggiungere in quel caso è segnato **[dopo la 5ª]**.
   La seconda è più solida: il test chiuso serve proprio a mostrare che la
   gente usa la cosa principale dell'app. Costa sei giorni.
3. **In inglese**: i revisori leggono anche l'italiano, ma così nessuno passa
   dal traduttore automatico. Sotto ogni risposta c'è il senso in italiano.
   Se un campo ha un limite più corto del testo, taglia dalla fine: le frasi
   sono in ordine d'importanza.

### Parte 1 — Il test chiuso

**Quanto è stato facile trovare i tester?** (scelta multipla) — rispondi come
è andata davvero. Non c'è una risposta che fa passare e una che fa respingere.

**Descrivi il coinvolgimento dei tester durante il test chiuso**

```
Our 12 testers have been enrolled since 22 September 2026. They are football fans who follow the San Marino championship (Campionato Sammarinese), [the people the app is built for: friends and members of local fantasy football groups].

During the test [N] testers created an account and [N] joined a league. They used the account flow (sign-up with e-mail confirmation, password-less login link), joined leagues through invite links, built their squads in the open league and the player market, and browsed real data from the first four matchdays: player ratings computed from official match reports, player profiles, head-to-head comparisons, standings and match highlights.

The championship had a scheduled break during the test (no matches between 21 September and 8 October), so the weekly line-up/matchday loop could not be exercised on a live matchday inside the 14 days. [dopo la 5ª: When matchday 5 was played (9–11 October), [N] testers submitted their line-up before the deadline and followed scores and ratings as the match reports arrived.]
```

*Il senso:* 12 tester dal 22/09, tifosi del campionato. In [N] hanno creato
l'account e in [N] sono entrati in una lega. Hanno usato iscrizione, invito,
rosa, mercato, i dati delle prime quattro giornate. La sosta ha impedito di
provare una giornata dal vivo dentro i 14 giorni.

*Dove trovi i numeri:* gli account e le leghe nella console dell'app (scheda
admin); le formazioni consegnate nel grafico «Chi consegna», che dopo la 5ª
avrà la prima barra del test. Le installazioni le vedi in Play Console,
*Statistiche* della traccia di test.

**Riassumi il feedback ricevuto dai tester, e come l'hai raccolto**

```
We collected feedback in three ways: directly from testers [in a group chat / in person / by e-mail to support@fantatitano.site], through the in-app error reports (since 28 September the app sends crash and error reports with app version, screen and device type, and no personal data, declared in Data safety), and by watching how testers moved through sign-up and league joining.

The main points were: [1. ...], [2. ...], [3. ...]. Examples of issues we found and fixed during the test: the e-mail confirmation link did not bring users back into the app; opening an already-used confirmation link showed a raw error in English; invited users had to copy a league code by hand; users without a league could not find how to install the app on their home screen.
```

*Il senso:* come hai raccolto il feedback (chat, di persona, e-mail; i
rapporti d'errore automatici) e cosa è emerso. **Le righe `[1. 2. 3.]` sono le
cose che ti hanno detto i tester**: mettile tu. Gli esempi dopo sono problemi
veri trovati e corretti nel periodo del test. Togli quelli che non vuoi
attribuire al test.

### Parte 2 — L'app

**Chi è il pubblico dell'app?**

```
Football fans in San Marino and the surrounding Italian area (Romagna and Montefeltro) who follow the Campionato Sammarinese, the 16-club national league: players' friends and families, club supporters and local fantasy football groups. The app is in Italian and requires users to be at least 14 years old.
```

*Il senso:* tifosi del campionato sammarinese, a San Marino e nei dintorni.
App in italiano, dai 14 anni in su (`ETA_MINIMA` in `src/config.js`).

**Come offre valore agli utenti?**

```
Fantatitano is the only fantasy football game built on the San Marino championship. Mainstream fantasy games cover only the big leagues, so the people who follow this league every week had no way to play a season-long fantasy game on it.

Ratings are not opinions: every player's score starts from 6.0 and is computed from the official match report (goals, assists, clean sheets, cards, penalties, result), and the app shows where each tenth of a point comes from. Users can dispute a wrong event until Tuesday 20:00, then the matchday is frozen for everyone. Friends play in private leagues with an auction, a player market, trades, weekly line-ups and head-to-head matches. The app is free, has no ad tracking and no third-party analytics, and works offline for content already viewed.
```

*Il senso:* l'unico fantacalcio sul campionato sammarinese. Voti calcolati
dai referti, in chiaro, con le contestazioni e il congelamento del martedì.
Leghe private con asta, mercato, scambi, formazioni e scontri diretti. Gratis,
senza tracciamento, funziona anche offline.

**Quante installazioni prevedi nel primo anno?** (scelta multipla) — **la
fascia più bassa.** San Marino ha circa 34.000 abitanti e il campionato ha un
pubblico locale: dichiarare di più non aiuta, e un numero credibile dice che
sai per chi è l'app.

### Parte 3 — La prontezza per la produzione

**Cosa hai cambiato nell'app in base a quello che hai imparato nel test?**

```
Changes shipped during the closed test (22 September – 6 October):
- Sign-up: fixed the e-mail confirmation redirect so the link opens the app, and replaced the raw error for an already-used link with a clear message and next steps.
- Joining a league: invite links now carry the league code, so invited users join with one tap instead of copying a code.
- First run: users who arrive without friends see the open league first, the one thing they can do right away; features that make no sense in an open league are hidden there.
- Install: a menu entry to add the app to the home screen, reachable even before joining a league.
- Reliability: crash and error reports from devices now reach the admin console; match data from the official reports is refreshed every 20 minutes on matchdays instead of a few times a day.
- Account and rules: sign-up now states the minimum age (14) and links the Terms and the Privacy Policy; users who have not joined a league yet can reach settings, sign out and delete their account; the line-up deadline is explained the same way everywhere and can never fall after the first kick-off.
- Smaller fixes: link previews when sharing, layout fixes, wording fixes, and security headers.
```

*Il senso:* l'elenco dei cambiamenti fatti nel periodo del test, tutti veri
e già online (verifica della mail, invito col codice, primo avvio, tasto per
installare, rapporti d'errore, import ogni 20 minuti; e dal 5/10 età e
termini all'iscrizione, impostazioni raggiungibili anche senza lega, la
chiusura delle formazioni detta uguale dappertutto; ritocchi). Se un tester
ti ha chiesto una cosa precisa, dillo nella frase: «a tester asked for…» vale
più di un elenco.

**Come hai deciso che l'app è pronta per la produzione?**

```
The app has been running publicly at fantatitano.site on the real championship data, and the Android app is a Trusted Web Activity of that same web app, so fixes reach users without a new release. During the test we checked that:
- every change runs automated tests: a deploy is blocked unless the unit tests pass, and browser tests of the main screens and database tests run on every change;
- the server, the match-data import and the database are monitored around the clock, with alerts on failure, and the database has encrypted nightly backups;
- crash and error reports reach us within minutes and no open report is left unexplained;
- account deletion works from inside the app and from fantatitano.site/cancella-account.html, and the privacy policy matches the Data safety form.
[dopo la 5ª: Matchday 5 (9–11 October) ran end to end with testers: line-ups locked at kick-off, ratings arrived from the match reports and standings updated.]
```

*Il senso:* l'app è online su fantatitano.site coi dati veri, e quella
Android è la stessa app, quindi le correzioni arrivano senza ricaricare il
pacchetto. Le prove senza browser bloccano la pubblicazione; quelle col
browser e sul database girano a ogni modifica; sorveglianza
continua di server, import e database (UptimeRobot e la Sentinella); backup
cifrato ogni notte; rapporti d'errore; cancellazione dell'account che
funziona; informativa coerente col modulo. **Prima di incollare** la riga sui
rapporti d'errore, apri la sezione errori della console e controlla che non
ce ne siano di aperti senza spiegazione.

**Se respingono:** la mail dice cosa manca. Di solito chiedono altro test con
tester più attivi. Non riscrivere le stesse risposte con altre parole:
aggiungi quello che è successo dopo (una giornata giocata, i numeri nuovi).

## 6. Il premio in denaro, prima di dichiararlo

Play ha una policy sui concorsi: un'app che mette in palio denaro deve
rispettare regole precise (regolamento accessibile, niente pagamento per
partecipare, restrizioni per Paese e per età). Fantatitano non fa pagare
nulla per partecipare, che è la condizione più importante, ma **prima di
annunciare il montepremi nello Store** va risolto quello che sta in
`legale/montepremi-bozza.md`. Un rifiuto per policy costa settimane.

## 7. Dopo la pubblicazione

- Gli aggiornamenti del sito arrivano **da soli**: il pacchetto su Play non va
  ricaricato per una modifica all'app
- Si ricarica solo per cambiare icona, nome, o le impostazioni del guscio
- Le notifiche push continuano a funzionare: dentro la TWA sono quelle del
  sito, e su Android non serve che l'utente aggiunga niente alla schermata
  Home
