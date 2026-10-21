# La scheda dell'App Store, pronta da incollare

Tutto quello che App Store Connect chiede, nell'ordine in cui lo chiede.
I limiti di lunghezza li controlla `npm test` (tests/scheda-appstore.test.js),
così non si scopre di essere lunghi incollando.

Le immagini stanno in `store/ios/`:

- `icona-1024.png`: l'icona dell'app, 1024×1024, senza trasparenza (Apple la
  rifiuta se ha il canale alfa). È anche già dentro il progetto Xcode.
- Sette screenshot 1290×2796, il formato iPhone 6,9" che Apple chiede. Si
  rigenerano con `LARGO=430 ALTO=932 FUORI=store/ios node scripts/schermate-store.cjs`.

L'ordine in cui caricarli: `la-giornata`, `la-formazione`, `i-voti`,
`il-voto-titano`, `la-classifica`, `il-negozio`, `gli-highlights`.

---

## Nome

```
Fantatitano
```

## Sottotitolo

```
Il fantacalcio di San Marino
```

## Testo promozionale

```
Schiera la formazione, segui il Voto Titano calcolato dai referti delle partite e sfida i tuoi amici in una lega che dura tutta la stagione.
```

## Parole chiave

Separate da virgole, senza spazi dopo la virgola: lo spazio conta come
carattere e Apple ne concede 100.

```
fantacalcio,san marino,calcio,lega,asta,formazione,voti,campionato,titano,fanta,amici,squadra
```

## Descrizione

```
Fantatitano è il fantacalcio del Campionato Sammarinese. Sedici squadre vere, i giocatori veri, e una lega fra amici che dura tutta la stagione.

IL VOTO LO SCRIVE LA PARTITA
Niente pagelle e niente opinioni. Il voto di ogni giocatore parte da 6,0 e si muove con quello che c'è nel referto della gara: gol, assist, porta inviolata, cartellini, rigori, l'esito della squadra. Il conto resta in chiaro, riga per riga, e puoi vedere da dove nasce ogni decimo.

UNA GIORNATA A SETTIMANA
Schieri 11 titolari e 7 in panchina, ordinati: al posto di un titolare senza voto entra il primo panchinaro dello stesso ruolo. Le formazioni si chiudono alle 15 del giorno della prima gara, e chi non consegna perde 0-3 a tavolino. A fine giornata arrivano i punteggi e il risultato dello scontro diretto.

SE UN DATO È SBAGLIATO, SI CONTESTA
Hai tempo fino al martedì per segnalare un evento che non torna. Alle 20:00 la giornata si congela e non si tocca più: da quel momento la classifica è definitiva, per tutti.

DENTRO L'APP
• Asta iniziale a crediti, e il mercato degli svincolati a stagione aperta
• Scambi fra fantallenatori, con proposta e risposta
• Calendario, classifica, record e storico giornata per giornata
• La scheda di ogni giocatore: voti, gol, assist, minuti, giornata per giornata
• Confronto diretto fra due giocatori, numeri alla mano
• Gli highlights delle partite dal canale della Federazione
• Il promemoria della formazione con le notifiche, se lo vuoi

SENZA PUBBLICITÀ CHE TI INSEGUE
Nessuna profilazione, nessun tracciatore di terze parti, nessun cookie di marketing. In home può comparire uno spazio sponsor, dichiarato come tale e uguale per tutti: non viene scelto in base a chi sei.

Fantatitano non è affiliato alla Federazione Sammarinese Giuoco Calcio né alle società del campionato, e non ne rappresenta le posizioni. Calendario, risultati e tabellini arrivano dai referti pubblici della Federazione.

L'app si usa gratis, senza acquisti. Serve un account con e-mail e nome: si cancella da dentro l'app (Profilo, poi «Elimina account»).
```

## Gli indirizzi

| Campo di App Store Connect | Cosa incollare |
|---|---|
| URL di assistenza | `https://fantatitano.site/assistenza.html` |
| URL di marketing | `https://fantatitano.site/` |
| URL della privacy | `https://fantatitano.site/privacy.html` |
| Copyright | `2026 Fantatitano` |

## Categoria, prezzo, disponibilità

- **Categoria principale**: Sport. **Secondaria**: Intrattenimento. Non
  «Giochi»: in quella categoria Apple fa più domande e la scheda finisce
  fra videogiochi che non c'entrano.
- **Prezzo**: Gratis. Nessun acquisto in-app.
- **Disponibilità**: tutti i paesi (San Marino usa l'App Store italiano).
- **Dispositivi**: solo iPhone. Il progetto Xcode è impostato così, quindi
  Apple non chiede gli screenshot per iPad.

## Classificazione per età: le risposte

Il questionario cambia ogni tanto: queste sono le risposte di sostanza.

- Violenza, contenuti sessuali, linguaggio volgare, droghe, orrore: **Nessuno**
- Gioco d'azzardo simulato: **Nessuno**. Concorsi: **No**
- Contenuti generati dagli utenti: **Sì**, ma visibili solo dentro la propria
  lega (nome della squadra, stemma)
- Accesso libero al web: **No**
- Messaggi fra utenti: **No**
- Pubblicità: **Sì** (lo spazio sponsor in home, uguale per tutti)

L'app accetta iscritti **dai 14 anni** (`ETA_MINIMA` in `src/config.js`). Se il
questionario dà una fascia più bassa, scegli comunque una fascia di **13+**
dalla voce che permette di alzarla, così la scheda e i termini d'uso dicono
la stessa cosa.

## Privacy dell'app («etichette» della privacy): le risposte

Devono combaciare con `privacy.html`. Per ogni dato Apple chiede tre cose:
a cosa serve, se è **collegato** alla persona, se serve a **tracciarla**
(seguirla fra app e siti di altri). A Fantatitano la terza risposta è sempre
**No**: non c'è tracciamento.

| Dato in App Store Connect | Collegato alla persona | Scopo |
|---|---|---|
| Informazioni di contatto → **Indirizzo e-mail** | Sì | Funzionalità dell'app (l'account) |
| Informazioni di contatto → **Nome** | Sì | Funzionalità dell'app (il nome che vedono gli altri della lega) |
| Contenuti dell'utente → **Foto o video** | Sì | Funzionalità dell'app (lo stemma, solo se lo carichi) |
| Contenuti dell'utente → **Altri contenuti dell'utente** | Sì | Funzionalità dell'app (squadra, rosa, formazioni, contestazioni) |
| Identificatori → **ID utente** | Sì | Funzionalità dell'app (chi ha invitato chi, per il badge «Reclutatore») |
| Diagnostica → **Dati sui crash** e **Altri dati diagnostici** | **No** | Funzionalità dell'app (correggere i difetti: nessun identificativo) |

Tutto il resto: **non raccolto**. Niente posizione, dati finanziari, salute,
contatti, cronologia, acquisti, dati d'uso per pubblicità.

Il codice per le notifiche (il «token» del telefono) Apple non lo considera un
dato da dichiarare quando serve solo a mandare le notifiche dell'app stessa.

## Crittografia (esportazione)

Già risposto nel progetto (`ITSAppUsesNonExemptEncryption = NO` in
Info.plist): l'app usa solo HTTPS, che è esente. Se App Store Connect lo chiede
lo stesso: **«Nessuno degli algoritmi menzionati»**.

## Diritti sui contenuti

Domanda: *l'app contiene, mostra o accede a contenuti di terze parti?*
Risposta: **Sì**. Poi: *hai i diritti necessari?* Qui la risposta onesta oggi
è che risultati, calendari e nomi sono dati pubblici delle partite usati in
modo descrittivo, e gli highlights sono il riquadro ufficiale di YouTube del
canale della Federazione. Quando arriva l'accordo con l'Associazione
Calciatori, quel documento è la prova da allegare se Apple la chiede (vedi
IOS.md, «Se Apple rifiuta»).

## Note per il revisore (App Review Information)

Il revisore Apple **deve poter entrare**: senza un account di prova l'app
viene rifiutata al primo giro. Prima di mandare in revisione crea un account
apposta (IOS.md, passo 6) e scrivi qui sotto e-mail e password.

**Accesso**: l'e-mail e la password dell'account di prova (IOS.md, passo 6)

**Note** (da incollare, sono in inglese perché le legge un revisore Apple):

```
Fantatitano is a free fantasy football game for the San Marino football league (Campionato Sammarinese). There are no purchases and no real-money prizes.

Demo account: the credentials above are already in a league with a full squad, so you can open the lineup screen (bottom bar: "Rosa" -> "Formazione"), player scores ("Voti") and the standings ("Classifica").

Native features: push notifications (lineup reminders before the deadline, sent via APNs), native share sheet for league invites, universal links for fantatitano.site.

Account deletion: Profile -> "Elimina account" (also described at https://fantatitano.site/cancella-account.html).

Player names, fixtures and results come from the public match reports of the San Marino Football Federation and are used descriptively. The app is not affiliated with the Federation.
```

**Contatto per il revisore**: nome, cognome, telefono ed e-mail tuoi. Non
compaiono sullo Store: li vede solo Apple.
