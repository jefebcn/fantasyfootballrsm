# La scheda di Google Play, pronta da incollare

I testi qui sotto sono già dentro i limiti di Play (nome 30, descrizione
breve 80, descrizione lunga 4000). Le lunghezze le misura
`npm test` (tests/scheda-play.test.js), così non si scopre di essere lunghi
incollando.

Le immagini stanno in questa stessa cartella e le rigenera
`node scripts/schermate-store.cjs`: otto screenshot 1080×1920 e la grafica
d'intestazione 1024×500, tutte JPEG — Play non vuole il canale alfa.

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

Devono combaciare con `privacy.html`, che è scritto guardando il codice. Se
le due cose divergono, quella che conta per Google è questa, e la differenza
è una segnalazione.

**Dati raccolti** (raccolti, non condivisi con terzi):

| Dato | Perché | Obbligatorio |
|---|---|---|
| Indirizzo e-mail | far entrare nell'account e riconoscerti | sì |
| Nome | il nome del fantallenatore, visibile agli altri della lega | sì |
| Contenuti creati dall'utente (squadra, rosa, formazioni, contestazioni) | è il gioco | sì |
| Identificativi del dispositivo per le notifiche | mandare il promemoria della formazione | no, solo se le accendi |

- **Condivisi con terze parti**: nessuno. Supabase tratta i dati *per conto*
  di chi gestisce l'app (responsabile del trattamento), e non li usa per sé:
  nel modulo di Play non è «condivisione».
- **Cifrati in transito**: sì, tutto su HTTPS.
- **Si possono cancellare**: sì, dall'app e dal web (l'indirizzo qui sopra).
- **Raccolta facoltativa**: le notifiche sono l'unica voce che si accende e
  si spegne.

## Il montepremi, prima di scriverlo nella scheda

Nella descrizione **non c'è** il montepremi, di proposito: Play ha una policy
sui concorsi a premi e va risolto prima quello che sta in
`legale/montepremi-bozza.md`. Un rifiuto per policy costa settimane, e la
descrizione si può aggiornare in qualunque momento senza ricaricare il
pacchetto.
