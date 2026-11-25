# Piano di crescita: inviti, condivisioni, premi

Deciso con Alex il 25/11/2026, dopo che la FSGC ha annunciato su Instagram
qualcosa che sembra un fantacalcio. Linea: **niente provocazioni verso la
federazione**, si cresce con condivisioni, inviti e premi messi dai progetti di
Alex. Lo stato giorno per giorno sta in `docs/STATO.md`; qui c'è il piano.

## 1. La regola che regge tutto

- **Mai pagare per partecipare.** Iscrizione a pagamento più premio vuol dire
  gioco con posta, e serve una licenza.
- **Il premio lo offre il progetto, non Fantatitano.** Il progetto organizza la
  promozione a nome suo, Fantatitano fornisce solo la classifica
  (`legale/montepremi-bozza.md` §6).
- **Niente sorteggi.** Un'estrazione fra chi invita amici è una lotteria.
  Si vince per classifica o per un traguardo uguale per tutti.
- **Premi in natura o buoni, mai denaro** (in Italia DPR 430/2001).
- **Prima di annunciare, una verifica con un legale**, anche sulle regole di San
  Marino: le domande sono già in `legale/montepremi-bozza.md` §§3 e 6.
- Minori: l'app accetta iscritti dai 14 anni; per i premi va deciso se
  servono 18 anni.

## 2. Inviti e condivisioni

Già nell'app: pulsante «Invita» nelle leghe, link con il codice
(`S.linkInvito`), livelli dei Reclutatori (migrazione 023,
`src/reclutatori.js`).

| Cosa | Stato |
|---|---|
| **Card della giornata da condividere**: immagine 1080x1920 con fantapunti, posto nella giornata e in classifica, i migliori, il personaggio; link d'invito nel testo che l'accompagna | fatta (`src/card-giornata.js`, `src/views/scheda.js`) |
| **Traguardo inviti**: per esempio 3 amici che consegnano almeno 2 formazioni danno un buono di un progetto di Alex. Contano solo amici che giocano, così non servono account finti | da fare |
| **Classifica delle leghe tra amici**: la lega con la media più alta del mese vince un premio per il gruppo | da fare |

## 3. Premi «offerti da» i progetti di Alex

Ogni premio porta il nome del progetto che lo offre e il suo spazio nell'app
(spazio sponsor con viste e tocchi già nella console, migrazioni 017 e 021).

| Premio | Frequenza | Perché |
|---|---|---|
| Miglior punteggio della giornata | ogni weekend | fa tornare la gente ogni settimana |
| Miglior squadra del mese | mensile | tiene vivo chi è indietro |
| Vincitore della Coppa Fantatitano | a fine coppa | dà valore alla coppa |
| Podio di fine stagione | una volta | il premio più grosso |
| Traguardo inviti | quando si raggiunge | fa crescere gli iscritti |

Gli sponsor esterni vengono dopo: si va dalle aziende quando per tre giornate
di fila almeno metà delle squadre consegna la formazione
(`MONETIZZAZIONE.md` §4b).

## 4. Social

- Ogni lunedì un post con il vincitore della giornata e il premio, con il nome
  del progetto che lo offre.
- Una storia sul traguardo inviti al lancio, poi una al mese.
- Mai «commenta» o «tagga»; nelle grafiche «Link in bio», non l'indirizzo.

## 5. Ordine di lavoro

1. **Card da condividere** (fatta il 25/11).
2. **Decisioni di Alex**: quali progetti, quale premio e valore, quante volte,
   chi organizza (la sua società o il progetto). Poi il regolamento breve e
   le domande al legale.
3. **Nell'app**: premi «offerti da» e traguardo inviti.
4. **Lancio** con un post e una storia, poi il vincitore ogni lunedì.

## 6. I numeri da guardare ogni settimana

Punto di partenza (25/11): 233 profili, circa 80 formazioni per giornata,
20 leghe, 19 formazioni di coppa.

- formazioni consegnate per giornata;
- nuovi iscritti arrivati da un invito (`reclutati`);
- quanti tornano la giornata dopo.
