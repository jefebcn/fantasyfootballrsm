# La scheda di Google Play, pronta da incollare

I testi qui sotto sono già dentro i limiti di Play (nome 30, descrizione
breve 80, descrizione lunga 4000). Le lunghezze le misura
`npm test` (tests/scheda-play.test.js), così non si scopre di essere lunghi
incollando.

Le immagini stanno in questa stessa cartella e le rigenera
`node scripts/schermate-store.cjs`: otto screenshot 1080×1920 e la grafica
d'intestazione 1024×500, tutte JPEG — Play non vuole il canale alfa.

L'ordine in cui caricarle, che è la storia che racconta la scheda:
`la-giornata`, `la-formazione`, `i-voti`, `il-voto-titano`, `lo-scontro`,
`la-classifica`, `il-negozio`, `gli-highlights`. Otto schermate che mostrano
otto cose diverse: le prime versioni avevano calendario, rosa e listone, cioè
tre elenchi che in miniatura sembrano la stessa immagine ripetuta.

---

## Nome dell'app

```
Fantatitano
```

## Descrizione breve

```
Il fantacalcio del Campionato Sammarinese: asta, formazione e Voto Titano.
```

## Descrizione lunga

```
Fantatitano è il fantacalcio del Campionato Sammarinese. Sedici squadre vere, i giocatori veri, e una lega fra amici che dura tutta la stagione.

IL VOTO LO SCRIVE LA PARTITA
Niente pagelle e niente opinioni. Il voto di ogni giocatore parte da 6,0 e si muove con quello che c'è nel referto della gara: gol, assist, porta inviolata, cartellini, rigori, l'esito della squadra. Il conto resta in chiaro, riga per riga, e puoi vedere da dove nasce ogni decimo.

UNA GIORNATA A SETTIMANA
Schieri 11 titolari e 7 in panchina, ordinati: al posto di un titolare senza voto entra il primo panchinaro dello stesso ruolo. Le formazioni si chiudono all'inizio della prima gara della giornata, e chi non consegna perde 0-3 a tavolino. La domenica sera arrivano i punteggi e il risultato dello scontro diretto.

SE UN DATO È SBAGLIATO, SI CONTESTA
Hai tempo fino al martedì per segnalare un evento che non torna. Alle 20:00 la giornata si congela e non si tocca più: da quel momento la classifica è definitiva, per tutti.

DENTRO L'APP
• Asta iniziale a crediti, e il mercato degli svincolati a stagione aperta
• Scambi fra fantallenatori, con proposta e risposta
• Calendario, classifica, record e storico giornata per giornata
• La scheda di ogni giocatore: voti, gol, assist, minuti, giornata per giornata
• Confronto diretto fra due giocatori, numeri alla mano
• Gli highlights delle partite dal canale della Federazione
• Il promemoria della formazione, se lo vuoi
• Si apre anche senza rete: quello che hai già visto resta lì

SENZA PUBBLICITÀ CHE TI INSEGUE
Nessuna profilazione, nessun tracciatore di terze parti, nessun cookie di marketing. In home può comparire uno spazio sponsor, dichiarato come tale e uguale per tutti: non viene scelto in base a chi sei.

Fantatitano non è affiliato alla Federazione Sammarinese Giuoco Calcio né alle società del campionato, e non ne rappresenta le posizioni. Calendario, risultati e tabellini arrivano dai referti pubblici della Federazione.

L'app si usa gratis. Serve un account con e-mail e nome: si cancella da dentro l'app, e come si fa è scritto anche su fantatitano.site/cancella-account.html
```

## Categoria e classificazione

- **Categoria**: Sport (non «Giochi»: non è un gioco di abilità né un
  videogioco, e nella categoria sbagliata la scheda finisce fra concorrenti
  che non c'entrano)
- **Tag**: fantacalcio, San Marino, campionato, lega, sport
- **Pubblico**: l'app accetta iscritti **dai 14 anni** (`ETA_MINIMA` in
  `src/config.js`). Se dichiari un pubblico che comprende i minori, Play
  applica le regole *Families*: vanno lette prima di rispondere, non dopo.

## Gli indirizzi da incollare nei moduli

| Campo di Play Console | Indirizzo |
|---|---|
| Informativa privacy | `https://fantatitano.site/privacy.html` |
| Cancellazione dell'account (Data safety) | `https://fantatitano.site/cancella-account.html` |
| Sito web | `https://fantatitano.site/` |
| E-mail di assistenza | `support@fantatitano.site` |

## Data safety: le risposte, e perché

Devono combaciare con `privacy.html`, che è scritto guardando il codice. Se le
due cose divergono, quella che conta per Google è questa, e la differenza è
una segnalazione.

**Prima pagina**

- *L'app raccoglie o condivide dati?* → **Sì**
- *Criptati in transito?* → **Sì** (tutto su HTTPS: Vercel e Supabase)
- *Metodi di creazione account*: **Nome utente e password** + **Nome utente e
  altra autenticazione** (il link/codice via e-mail, «Entra senza password»).
  **Non** OAuth: sul server gli unici provider attivi sono quelli e-mail.
- *URL per eliminare l'account*: `https://fantatitano.site/cancella-account.html`
- *Modo per eliminare parte dei dati senza chiudere l'account?* → **Sì**
  (uscire da una lega porta via squadra, rosa, formazioni e contestazioni di
  quella lega; più la richiesta via e-mail). È scritto nella pagina qui sopra.

**Tipi di dati: le quattro categorie da aprire, e nient'altro**

| Categoria | Cosa spuntare | Raccolti / Condivisi | Obbl. | Perché |
|---|---|---|---|---|
| Informazioni personali | **Nome**, **Indirizzo email**, **ID utente** | raccolti / non condivisi | sì | Gestione dell'account (il nome anche: Funzionalità dell'app — lo vedono gli altri della lega) |
| Foto e video | **Foto** | raccolti / non condivisi | no | Funzionalità dell'app (lo stemma della squadra) |
| Attività nell'app | **Altri contenuti generati dagli utenti** | raccolti / non condivisi | sì | Funzionalità dell'app (squadra, rosa, formazioni, contestazioni) |
| ID dispositivo o altri ID | **ID dispositivo o altri ID** | raccolti / non condivisi | no | Funzionalità dell'app (l'indirizzo a cui mandare le notifiche, solo se le accendi) |

Tutto il resto resta a zero: niente posizione, informazioni finanziarie,
salute, messaggi, audio, file, calendario, contatti, cronologia di ricerca o
navigazione, e nessun dato di diagnostica — non c'è un sistema di analisi del
traffico, e questo va dichiarato non spuntando niente.

**«Condivisi con terze parti» è no, e non è una furbizia**: Supabase tratta i
dati *per conto* di chi gestisce l'app (responsabile del trattamento) e non li
usa per sé. Nel modulo di Play questo non è «condivisione».

**L'unico punto che resta da decidere: il video di YouTube.** Gli highlights
stanno su YouTube e il riquadro si carica **solo quando qualcuno tocca play**,
da `youtube-nocookie.com`. Da quel momento Google vede l'indirizzo IP e quale
video si sta guardando. Due letture, tutte e due difendibili:

- l'app non raccoglie né trasmette niente — è l'utente che apre un contenuto
  di terzi, come toccare un link;
- oppure, per prudenza, si dichiara sotto *Attività nell'app → Interazioni con
  l'app*, **condivisa** con terze parti.

La prima è quella coerente con l'informativa dell'app, che quel passaggio lo
spiega già per intero. La seconda costa una spunta e toglie ogni discussione,
al prezzo di far comparire «condivide dati con terze parti» nella scheda.
Se un giorno il video venisse aperto solo con un collegamento esterno, la
domanda sparirebbe del tutto.

## Il montepremi, prima di scriverlo nella scheda

Nella descrizione **non c'è** il montepremi, di proposito: Play ha una policy
sui concorsi a premi e va risolto prima quello che sta in
`legale/montepremi-bozza.md`. Un rifiuto per policy costa settimane, e la
descrizione si può aggiornare in qualunque momento senza ricaricare il
pacchetto.
