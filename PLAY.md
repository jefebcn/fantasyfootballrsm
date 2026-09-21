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
