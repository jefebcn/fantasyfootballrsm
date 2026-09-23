# Far camminare Fantatitano con le sue gambe

Piano economico, scritto con i numeri veri: quanto costa tenerla in piedi,
quanto può rendere, e in che ordine conviene muoversi.

---

## 1. Il bersaglio: quanto costa davvero

Oggi l'app gira **gratis**, ma su piani pensati per progetti personali.

| Voce | Oggi | Appena si monetizza |
|---|---|---|
| Vercel | **Pro, già pagato** | nessun costo in più: il piano commerciale c'è già, ed è quello che serve col banner sponsor |
| Supabase | Free, €0 | Free regge ancora un po' (500 MB, 50k utenti/mese); **Pro 25 $/mese** quando servono i backup giornalieri e più spazio |
| Resend | Free, 100 e-mail/giorno | 20 $/mese oltre |
| Dominio | **1 €** il primo anno (~20 € al rinnovo) | uguale |
| Play Console | 25 $ una tantum, già pagati | — |

**Conto in tasca** (Vercel Pro è già pagato e non entra nel conto di
Fantatitano, che ci gira sopra insieme al resto):

- oggi: **1 € il primo anno** — il dominio, e basta
- col rinnovo del dominio: **~20 € l'anno**
- se servono Supabase Pro e Resend a pagamento: **~560 € l'anno**
- più il montepremi da 300 €: **~860 € l'anno** nello scenario più caro

Il numero da tenere in testa è questo: **il pareggio sta sotto i mille euro a
stagione, e oggi sta sotto i venti**. Non serve un modello di business: serve
*uno sponsor*, e serve prima per il montepremi che per i server.

## 2. Il vincolo che decide tutto

San Marino ha **34.000 abitanti**. Il campionato sammarinese ha un seguito di
nicchia dentro una nicchia. Una stima onesta:

- prima stagione: **100–300 iscritti**
- se prende bene: **500–1.500**

Con questi numeri, tutti i modelli «da app» sono fuori discussione: la
pubblicità programmatica ha senso sopra le centinaia di migliaia di
impressioni, un freemium di massa sopra le decine di migliaia di utenti.

**Ma il numero piccolo non è il problema: è il prodotto.** Trecento
sammarinesi che ogni settimana aprono un'app sul campionato locale sono un
pubblico che nessun cartellone raggiunge con quella precisione. Per un'azienda
del posto valgono più di diecimila impressioni generiche comprate a caso. È
questo che si vende — non il traffico.

## 3. Le strade, in ordine di resa

**La regola che le ordina tutte.** Con cento o trecento iscritti, quello che
fai pagare al *giocatore* rende decine di euro; quello che fai pagare a
un'*azienda* ne rende centinaia. Non perché i giocatori siano tirchi: sono
pochi, e mille volte pochi fa sempre pochi. Quindi le strade che contano sono
quelle che aggiungono un cliente aziendale, non un listino per gli utenti.
Le altre restano qui sotto perché hanno senso lo stesso, ma vanno pesate per
quello che sono: qualche decina di euro e un po' di affetto.

### a) Sponsor locale — la principale

Il banner c'è già (quello scuro fra le notizie e la giornata corrente,
`.invito`): è nato per il montepremi, e lo stesso spazio regge un logo.

- **uno sponsor principale**: 800–1.500 € a stagione
- oppure **tre sponsor** da 400 € l'uno, a rotazione

Cosa riceve: logo nel banner, «presented by» sulla lega pubblica, menzione nei
canali. Chi cercare: banche e assicurazioni sammarinesi, concessionarie,
negozi di sport, bar e ristoranti legati al calcio locale. L'accordo con la
FSGC, quando c'è, è la leva migliore: vende credibilità, non spazio.

### b) La lega brandizzata — venduta all'azienda, non al giocatore

Un bar, una concessionaria, una banca comprano **la loro lega**: nome, logo,
premio loro, da girare a clienti o dipendenti. **200–400 € a lega.**

È diversa dal punto (f), dove a pagare è il giocatore per avere funzioni in
più. Qui il prodotto è lo spazio, come lo sponsor, ma vale di più perché
l'azienda non compra un logo in mezzo agli altri: compra un posto dove i suoi
clienti tornano ogni domenica per tre mesi, col suo nome in cima.

Tecnicamente è quasi tutta roba che c'è già: leghe private, stemmi e colori,
lo slot sponsor con date e conteggi. **Manca una cosa sola:** poter legare uno
sponsor a una singola lega invece che a tutta l'app (oggi `sponsor` è
globale). È il pezzo di codice più corto con il ritorno più alto —
per questo sta come punto 5 in fondo, fra le cose da costruire.

### c) I club e la FSGC come clienti, non come contorno

Fin qui la federazione compare solo come leva per vendere lo sponsor. Ma è
un cliente: Fantatitano è l'unico posto dove il referto arbitrale diventa
una cosa che la gente apre la domenica.

- **la lega del club**: ogni società ha la sua, con stemma e colori, da
  girare ai propri tifosi. **100–150 € l'una.** I club sono 15: anche solo
  cinque che dicono sì fanno più di uno sponsor principale — e ognuno porta
  dentro i suoi tifosi, che è la cosa che manca più dei soldi.
- **il fantacalcio ufficiale del campionato**: la federazione co-finanzia, in
  cambio del marchio e di un canale suo verso i tifosi.

È la più sottovalutata delle tre, perché paga due volte: in euro e in
iscritti.

### d) Il motore venduto altrove — non gestito altrove

Al §4 la stagione 3 dice «uscire da San Marino». Attenzione a cosa vuol dire:
**gestire** quattro campionati significa quadruplicare il lavoro con la stessa
persona, ed è lì che si rompe tutto.

L'alternativa è **venderlo**. Il Voto Titano non ha niente di sammarinese
dentro: ogni federazione piccola (Andorra, Gibilterra, Malta) e ogni comitato
dilettanti ha lo stesso problema e nessuno che glielo risolva. Installazione
una tantum più canone annuo, il calendario e i tesserati ce li mettono loro.
Si regge con una persona sola, che qui è il vincolo vero.

### e) Premi in natura invece che in denaro

Una cena per due, un abbonamento, materiale sportivo offerti da un negozio.
Costo per noi: zero. E cambia il profilo legale del concorso, che con il
denaro in palio è la parte più delicata (vedi `legale/montepremi-bozza.md`).

### f) Leghe private a pagamento — non l'ingresso, le funzioni

5–10 € a lega per stagione, per funzioni in più (regole su misura, più
partecipanti, statistiche). Trenta leghe fanno 150–300 €.

**Regola da non violare:** si paga per le *funzioni*, mai per entrare in una
lega con un premio in palio. Pagamento + premio = concorso a premi con tutto
quello che comporta.

### g) «Titano Pro» — abbonamento del giocatore

5 € a stagione per statistiche avanzate, notifiche live, personalizzazioni.
Su 300 iscritti con una conversione del 5–10% sono 75–150 €: non risolve, ma
copre la posta e qualche costo minore.

### h) Le piccole, ma vere

Nessuna di queste chiude un bilancio. Messe insieme coprono i costi vivi e
fanno conoscere l'app, che a questi numeri conta quanto l'incasso.

- **Sindacazione dei contenuti.** La top 11 di giornata e i voti a San Marino
  RTV, a Titani.TV, ai giornali locali: come rubrica, o come riquadro da
  incastrare nel loro sito col nostro marchio dentro. Spesso non si paga in
  denaro ma in visibilità — ed è quella che manca più dei soldi.
- **Evento di fine stagione.** Premiazione con gli sponsor. In provincia i
  soldi delle sponsorizzazioni escono più volentieri per una serata con le
  foto che per un banner.
- **Donazioni** («offri un caffè»). Con venti euro l'anno di costi vivi,
  trenta persone che ne danno due chiudono il bilancio. Non è un modello:
  è una cosa onesta da mettere in fondo alla pagina.
- **Merch su richiesta** (la maglia col proprio stemma, stampa on demand).
  Margine ridicolo, magazzino zero. Vale come affetto, non come entrata.

### Quello che NON conviene fare

- **Pubblicità programmatica**: a questi volumi rende pochi euro, e riempie di
  banner un'app che oggi si legge bene. Si perde più di quanto si guadagna.
- **Affiliazioni con le scommesse**: le policy di Google Play sul gioco
  d'azzardo, gli iscritti **dai 14 anni** (`ETA_MINIMA` in `src/config.js`) e
  il rapporto con la federazione. Tre buoni motivi per lasciar perdere: paga
  bene e brucia tutto il resto.

## 4. Il piano, stagione per stagione

**Stagione 1 — pareggiare.**
Un solo sponsor principale (800–1.000 €) e premi in natura. Copre Vercel Pro,
il dominio, e avanza. Obiettivo vero: arrivare a fine stagione con i numeri in
mano.

**Stagione 2 — reggersi.**
Due o tre sponsor, le prime leghe brandizzate (§3b) e leghe di club (§3c),
montepremi in denaro finanziato dagli sponsor e non di tasca. Qui serve il
rendiconto: quanti erano, quanto sono tornati, quanti hanno toccato il
banner. È la stagione in cui si scopre se i club rispondono: quella risposta
decide la terza.

**Stagione 3 — crescere o restare.**
L'unica via per numeri più grandi è uscire da San Marino: altri campionati
piccoli con lo stesso problema (Andorra, Gibilterra, Liechtenstein, Malta) o i
dilettanti romagnoli. Il motore dei voti non ha niente di sammarinese dentro:
cambia il calendario e i tesserati. È una decisione da prendere con i dati
della seconda stagione, non prima.

E quando si arriva lì, la domanda non è «dove andiamo», è **chi tiene su
l'altro campionato**: gestirlo noi vuol dire raddoppiare il lavoro con la
stessa persona, venderlo (§3d) no. Con un uomo solo la seconda strada è
l'unica che regge.

## 5. Cosa va costruito prima di vendere

In ordine, e sono tutte cose piccole:

1. ~~**Slot sponsor gestibile dalla console**~~ — **fatto** (migrazione 017).
   Console → Sponsor: nome, riga, logo, collegamento, dal/al, acceso. Compare
   da solo il giorno che comincia, sparisce il giorno dopo la scadenza. Lo
   spazio è dichiarato (targhetta «Sponsor», `rel="sponsored"`) e gli
   indirizzi pericolosi non diventano collegamenti.
2. ~~**Conteggio di impressioni e tocchi**~~ — **fatto** (migrazione 018).
   Console → Sponsor: sotto ogni nome, viste, tocchi e percentuale di tocco,
   più gli ultimi sette giorni. Una **vista è un dispositivo in un giorno**,
   non un disegno della schermata: chi apre l'app dieci volte oggi conta uno.
   È un numero più piccolo e più difendibile — quello gonfio, al primo
   controllo di uno sponsor serio, si sgonfia e porta via la fiducia.
   Non si registra chi guarda: per ogni sponsor c'è una riga al giorno con
   due numeri, nessun identificativo, nessun indirizzo IP. Il contatore è
   l'unica porta di scrittura della tabella e rifiuta gli sponsor fuori
   finestra. Resta possibile, come per qualunque contatore che non scheda
   chi lo tocca, che qualcuno chiami la funzione più volte: è il prezzo di
   non tenere un registro delle persone, e va detto a chi compra.
3. ~~**Pagina sponsor** con i ringraziamenti e il kit~~ — **saltata**, per
   scelta di Alex (21 settembre). Non è bloccante: i numeri che sarebbero
   finiti nel kit ci sono già nella console (scheda Numeri e rendiconto dello
   sponsor), e si leggono da lì quando servono. Resta qui scritta perché il
   giorno che gli sponsor diventano più di uno, una pagina che li ringrazia
   pubblicamente è la cosa che li fa rinnovare senza chiederlo.
4. **Leghe private a pagamento**: un link di pagamento (Stripe o simile) e un
   flag sulla lega. Nessuna carta di credito passa per noi. Prima di
   muoversi, il vincolo del §6 sulla fatturazione di Google Play.
5. **Sponsor legato alla singola lega** — il pezzo che manca alla lega
   brandizzata (§3b), ed è corto: oggi la tabella `sponsor` vale per tutta
   l'app, serve una colonna `lega_id` (vuota = come adesso, tutti) e il
   filtro dove il banner si disegna. I conteggi di viste e tocchi sono già
   per sponsor, quindi il rendiconto per quel cliente esce da solo.
   **A parità di tempo è questo che rende di più**, perché è la differenza
   fra vendere un logo (§3a) e vendere un posto intero (§3b).

## 6. Le cose legali da sistemare prima del primo euro

- **Chi fattura allo sponsor.** L'informativa dichiara come titolare del
  trattamento Mediterranean Digital Solutions Ltd. Se a incassare è un'altra
  entità — o una persona fisica — le due cose vanno allineate prima di
  firmare, non dopo.
- **Il concorso a premi**: `legale/montepremi-bozza.md`, da chiudere prima di
  annunciare il montepremi dentro lo Store (policy di Play compresa).
- **La fatturazione di Google Play.** Ora che l'app passa dallo Store come
  TWA, quello che si vende *dentro* l'app e vale solo dentro l'app —
  «Titano Pro», leghe a pagamento comprate dal giocatore — ricade sotto le
  regole di pagamento di Play, con la sua percentuale. Non tocca gli sponsor
  né le leghe vendute a un'azienda con fattura nostra, che sono accordi fuori
  dall'app: un'altra ragione per cui §3b e §3c sono più pulite. Le regole sui
  link di pagamento esterni sono cambiate più volte e cambiano per paese:
  **da verificare sulla policy del giorno, non a memoria**, prima di scrivere
  una riga di codice che incassa.
- **Vercel Hobby non è ammesso per uso commerciale**: il giorno che entra un
  euro di sponsor, il piano va cambiato. È scritto nelle loro FAQ.

## 7. Il numero da guardare

Non gli iscritti: **quanti consegnano la formazione ogni settimana**. È la
metrica che dice se l'app è viva, ed è quella che convince uno sponsor a
rinnovare. La console amministrativa ha già la scheda «Numeri»: da lì si
ricava, e va guardata ogni lunedì.
