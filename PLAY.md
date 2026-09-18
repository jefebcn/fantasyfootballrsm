# Pubblicare Fantatitano su Google Play

Fantatitano è un'app web. Su Play ci va **così com'è**, dentro un guscio
Android che apre il sito a schermo intero, senza barra dell'indirizzo: si
chiama TWA (*Trusted Web Activity*) ed è il modo ufficiale di Google per
portare una PWA sullo Store. Non si riscrive niente: quello che si aggiorna
sul sito è aggiornato anche nell'app, senza passare dallo Store.

Questo file è la strada, in ordine. Le parti che tocca fare a mano sono
marcate **TU**; il resto è già nel repository.

---

## 0. Cosa serve prima di cominciare

- **Account Google Play Console**: 25 $ una volta sola (**TU**)
- Il **dominio** che serve l'app: `fantatitano.site` — deve essere già in
  piedi su Vercel, con HTTPS
- Un computer con **Node** e un **JDK 17** per generare il pacchetto

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

## 4. Generare il pacchetto (Bubblewrap)

```sh
npm install -g @bubblewrap/cli
bubblewrap init --manifest https://fantatitano.site/manifest.webmanifest
```

Risponde alle domande così:

- **Package name**: `site.fantatitano.app` (è quello già scritto in
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
- Compila: descrizione breve e lunga, categoria **Sport**, icona 512, grafica
  di intestazione 1024×500, **almeno due screenshot** di telefono
- **Data safety**: l'app raccoglie e-mail e nome, li usa per far funzionare
  l'account, sono cifrati in transito e si cancellano dall'app. Le risposte
  devono combaciare con quello che dice `privacy.html`, che è scritto
  guardando il codice
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
