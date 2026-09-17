# Montepremi della lega pubblica — BOZZA da far leggere a un legale

**Questo documento non è un regolamento: è una bozza.** L'ho scritta io
(Claude) su richiesta di Alex, e non sono un legale. Serve a due cose: mettere
per iscritto **cosa fa l'app oggi**, così chi la leggerà non deve indovinarlo
dal codice, e **elencare le domande** che vanno decise prima di mettere in
palio del denaro. Finché non è stata letta da un professionista **non va
pubblicata nell'app** e il montepremi non va annunciato pubblicamente: una
promessa scritta male vincola chi la fa più di quanto protegga chi la riceve.

Aggiornata al 17 settembre 2026 · fa riferimento al codice di quella data.

---

## 1. Chi organizza

| | |
|---|---|
| Organizzatore | Mediterranean Digital Solutions Ltd — `src/config.js`, `TITOLARE` |
| Rappresentante | Alex Conti |
| Sede | Level 3, Tower Business Centre, Tower Road, Sliema SLM 1603, Malta |
| Contatto | `support@fantatitano.com` |
| App | Fantatitano, applicazione web (PWA) |

## 2. Cos'è il gioco, in concreto

Fantatitano è un fantacalcio sul **Campionato Sammarinese**. Non esistono
pagelle giornalistiche per quel campionato: ogni voto nasce da **eventi
oggettivi del referto FSGC** (gol, assist, cartellini, minuti, porta
inviolata), con le regole scritte in `src/engine.js` e spiegate nella pagina
Regolamento dell'app. Non c'è nessuna valutazione soggettiva e nessun
elemento casuale introdotto dall'app: a parità di formazione schierata e di
referto, il punteggio è **lo stesso per tutti e ricalcolabile**.

**La lega pubblica** (migrazione `013-lega-pubblica.sql`) è aperta a chiunque
abbia un account, senza codice d'invito. Chi entra:

- riceve un budget di crediti (oggi 500, deciso da chi apre la lega) e
  compone la propria rosa dal listone reale del campionato;
- i giocatori **non sono esclusivi**: lo stesso calciatore può stare nella
  rosa di più partecipanti (con duecento iscritti, altrimenti finirebbero i
  portieri);
- non ci sono scontri diretti: ogni giornata i fantapunti della formazione
  schierata si **sommano**, e la classifica è la somma dei punti di tutte le
  giornate giocate (`classificaPunti()` in `src/engine.js`);
- **non si paga nulla per partecipare**: nessuna quota d'iscrizione, nessun
  acquisto, nessuna puntata. L'app non ha pagamenti di alcun tipo.

**Chi vince**: chi ha il punteggio totale più alto. A parità di punti conta il
**miglior punteggio di giornata**; se anche quello è pari, i partecipanti
risultano **a pari merito** (`position` uguale). *Domanda per il legale:
cosa si fa se due arrivano primi a pari merito — premio diviso, premio
duplicato, spareggio? Oggi il codice li dichiara pari e non decide.*

**Chi non consegna la formazione** prende zero per quella giornata; negli
scontri diretti delle leghe private è previsto il 3-0 a tavolino (art. 4 e
`forfeitGoals` nel motore), ma nella lega pubblica a punti il forfait vale
semplicemente zero punti.

**Il premio** oggi è un testo scritto da chi apre la lega e mostrato nell'app
(colonna `leagues.premi`, per posizione). Non c'è nessun automatismo di
pagamento: il premio lo consegna l'organizzatore fuori dall'app.

## 3. Quello che manca, e che il legale deve decidere

Le ho messe in ordine: la prima cambia tutto il resto.

1. **Legge applicabile e adempimenti.** L'organizzatore è maltese, il
   campionato è sammarinese, i partecipanti saranno in larga parte italiani e
   sammarinesi. Quale disciplina si applica a un concorso con premio in
   denaro, e comporta obblighi preventivi (comunicazione all'autorità,
   regolamento depositato, garanzia/fideiussione a favore dei partecipanti)?
   In Italia le manifestazioni a premio hanno adempimenti pesanti e alcune
   esclusioni; sapere **in quale scatola cade questo gioco** decide se si può
   fare così com'è.
2. **Non è gioco d'azzardo, ma va detto bene.** Non c'è puntata, non c'è
   alea introdotta dall'organizzatore e il risultato dipende dalle scelte del
   partecipante e da fatti sportivi verificabili. È l'argomento che tiene il
   gioco fuori dalla disciplina delle scommesse: va scritto con le parole
   giuste, non con le mie.
3. **Chi paga, quando e come.** Il premio è di chi organizza: forma
   (bonifico? buono?), termine, cosa succede se il vincitore non risponde o
   non fornisce i dati per il pagamento, cosa succede se la stagione viene
   interrotta dalla federazione.
4. **Tasse.** Trattamento fiscale del premio per chi lo dà e per chi lo
   riceve; eventuale ritenuta.
5. **Minori.** L'app accetta iscritti dai **14 anni** (`ETA_MINIMA` in
   `src/config.js`). Un premio in denaro a un minore richiede il consenso di
   chi ne ha la responsabilità: serve una regola, e forse un limite d'età più
   alto per il montepremi (partecipazione libera, premio dai 18).
6. **Esclusioni.** Oggi l'app può **rinominare** una squadra e **sospendere**
   un account (migrazione `015-moderazione.sql`). Il regolamento deve dire
   quando un partecipante viene escluso dal premio (nome offensivo? account
   doppi? accordi fra partecipanti?), chi lo decide e come si contesta la
   decisione.
7. **Modifiche e annullamento.** Cosa può cambiare l'organizzatore a stagione
   iniziata (il premio annunciato, le regole di punteggio) e cosa no. La mia
   opinione tecnica: **il premio annunciato non deve poter cambiare** dopo la
   prima giornata giocata, e oggi il codice non lo impedisce — se serve, lo si
   blocca.
8. **Dove si pubblica.** Un regolamento vincola solo se è accessibile prima
   di partecipare: andrà messo nell'app (accanto a Termini e Privacy) e
   richiamato nella schermata in cui si entra nella lega pubblica.

## 4. Cosa posso fare io, una volta deciso

- scrivere il regolamento nell'app come le altre pagine legali, con la data
  di aggiornamento (`LEGALI_AGGIORNATE`);
- mostrarlo **prima** dell'iscrizione alla lega pubblica, con accettazione
  esplicita registrata;
- bloccare nel database la modifica del premio dopo l'inizio;
- aggiungere un limite d'età per il montepremi diverso da quello
  dell'iscrizione;
- mettere per iscritto nel regolamento le regole di punteggio già in vigore,
  che sono l'unica parte già certa: il motore è provato da 142 controlli
  automatici e il referto FSGC arriva da un import verificato.

## 5. Nel frattempo

Finché i punti 1–8 non hanno una risposta, la cosa prudente è **far girare la
lega pubblica senza montepremi in denaro** (o con un premio non monetario e di
valore modesto, se il legale conferma che cambia il quadro). Il banner del
montepremi nell'app mostra soltanto quello che è scritto nel database: se il
premio non c'è, dice «Montepremi da definire» e non promette nulla.
