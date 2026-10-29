# Fantatitano Futsal — bozza di regolamento

Stato: **regolamento deciso il 25/10/2026, rifatto sul modello Dunkest il
29/10/2026 (§ 13), ramo `futsal`, non pubblicato.**
Nell'app la sezione esiste ma è nascosta (si apre solo con `?futsal=1`).

> **Dal 29/10 valgono le regole del § 13** (rosa con crediti, schemi, sesto
> uomo, panchina al 50%, mercato e quotazioni). Le sezioni 3, 4 e 8 qui
> sotto raccontano la prima versione: dove dicono altro, vince il § 13. I
> punteggi dei voti (§§ 5-7) restano quelli.

## 1. Da dove vengono le idee

Abbiamo studiato le pagine pubbliche del FantaFutsal di Totoculo (totoculo.it), attivo
da due stagioni. Ne riprendiamo **le meccaniche di gioco**, che sono
idee e non testo: formazione di giornata senza rosa, due moduli, bonus difesa,
capitano obbligatorio, campionato più coppa in tre fasi. Altri dettagli vengono
dal confronto con gli altri fantafutsal (§ 10-bis). Il testo qui
sotto è nostro, e niente del loro codice, grafica o marchio entra nell'app.

Dove le loro regole poggiano su dati che il referto FSGC non ha (voti
statistici di Diretta.it, rigori parati, assist sistematici), la regola è
adattata o tolta, e lo diciamo caso per caso (§ 9).

## 2. I dati FSGC (42 referti, giornate 1–6 del 2026/27)

- Campionato: 15 squadre, 30 giornate, una giornata a settimana dal lunedì al
  giovedì sera (prima gara di solito alle 20:15). Ogni giornata una squadra riposa.
- Partita: due tempi da 30', a volte con recupero (60' + 2').
- Distinta: da 9 a 14 giocatori per squadra, con numero e ruolo (Portiere,
  Centrale, Laterale, Universale, Pivot). Sono tutti sotto "Titolari": **non si
  sa chi è entrato in campo né per quanto**. I cambi non sono registrati.
- Ogni giocatore ha una scheda con nome completo e un codice unico
  (`fsgc.sm/it/giocatore/<nome>/<id>`): gli omonimi si distinguono così.
- Eventi: gol con minuto, gol su rigore, autogol, ammonizioni, espulsioni.
  Assist: la voce esiste ma in 42 partite non è mai stata compilata.
- Numeri: 5,1 gol a partita, 6 pareggi su 42, 12 porte inviolate su 84.

## 3. Formazione di giornata

Niente rosa, niente asta, niente crediti. **A ogni giornata ognuno sceglie
liberamente la formazione fra tutti i giocatori in listone**, come su Totoculo.

- 1 Porta, 4 giocatori di movimento, 2 panchinari (un D e un A), capitano e
  vice: 7 scelte.
- **Al massimo un giocatore per squadra FSGC** (la Porta conta come la sua squadra).
  È il vincolo che impedisce a tutti di schierare la stessa formazione.
- Chiusura: 10 minuti prima della prima gara della giornata. Dopo, formazione e
  modulo non si cambiano.
- Formazione non consegnata: zero punti nella giornata.

Perché niente rosa: le porte sono 15 e una riposa ogni settimana, i giocatori
di movimento sono circa 200. Con la formazione libera spariscono i problemi di
esclusività, di quotazioni e di mercato, e il gioco resta settimanale.

## 4. Ruoli e moduli

I ruoli FSGC diventano **tre** ruoli di gioco, come in FantaCun e Linea Laterale:

| Ruolo di gioco | Ruoli FSGC | Presenze per squadra a partita | Gol a presenza |
|---|---|---|---|
| **P** Porta | i portieri della squadra, insieme (§ 5) | 1 | — |
| **D** Difensore | Centrale, Laterale | ~5,4 | 0,21 |
| **A** Attaccante | Pivot, Universale | ~4,3 | 0,31 |

Chi segna meno sta in difesa, chi segna di più in attacco. Il ruolo di un
giocatore è quello che la FSGC gli dà più spesso in distinta (3 giocatori su
201 cambiano ruolo da una partita all'altra).

Moduli:

- **2-2 standard**: P, 2 D, 2 A.
- **3-1 difensivo**: P, 3 D, 1 A. Dà diritto al Bonus difesa (§ 7).

## 5. La Porta

Il referto non dice quale portiere ha giocato. Non si sceglie il portiere
singolo ma **la Porta di una squadra**, che prende:

- voto base ed esito della partita della squadra;
- tutti i gol subiti dalla squadra e la porta inviolata;
- i gol e i cartellini di qualunque portiere di quella squadra.

## 6. Punteggi

Ogni giocatore in distinta prende un **voto base di 6**: è l'unico dato oggettivo
sulla presenza. Poi si sommano bonus e malus dal referto.

| Evento | Punti |
|---|---|
| Voto base (in distinta) | 6 |
| Vittoria / sconfitta della squadra | +0,5 / −0,5 |
| Gol (anche su rigore) | +3 |
| Autogol | −1 |
| Ammonizione | −0,5 |
| Espulsione | −1 |
| Rigore sbagliato | −3 |
| Porta: gol subito | −0,5 |
| Porta: porta inviolata | +3 |
| Assist | **non conta** finché la FSGC non li compila sempre |
| Rigore parato | **non conta**: il referto non lo distingue dal rigore fuori |

Il gol vale +3 come su Totoculo. Il gol subito vale −0,5 e non −1: lì il
portiere ha un voto statistico che compensa, qui la Porta parte da 6 e con −1
a gol scenderebbe in media sotto il 4 (2,6 gol subiti a partita).

La porta inviolata vale +3 (FantaCun +4, Linea Laterale +5): succede nel 16%
delle partite e deve pesare nella scelta della Porta.

Calcolato dal motore dell'app (`src/futsal-engine.js`) sulle 42 partite reali:
Porta 5,2 di media, D 6,6, A 6,8. Una formazione da 5 fa in media 32 punti
(27 il 10% più basso, 38 il 10% più alto), capitano escluso.

## 7. Bonus difesa

Con il modulo 3-1, se la media dei punteggi finali di **Porta + i tre D** è
almeno **7,0**, la squadra prende **+2**, una sola volta per giornata.
Contano i punteggi dopo il capitano e dopo l'eventuale sostituzione; uno slot
senza voto né sostituto vale 0 nella media.

Sulle 42 partite si sarebbe attivato nel 19% delle formazioni 3-1. La soglia
è a 7,0 e non a 7,5 per un motivo di conti: un D fa in media 0,3 punti meno di
un A, e a 7,5 il bonus (12% delle volte) non ripagherebbe mai la rinuncia.

## 8. Capitano, panchina, classifica

- **Capitano obbligatorio** e **vice**, scelti fra i quattro di movimento (non
  la Porta). Il capitano raddoppia bonus e malus, non il voto base. Se non ha
  voto la fascia passa al vice; se nemmeno il vice ha voto, nessun raddoppio.
  Come nel calcio Fantatitano.
- **Due panchinari, un D e un A.** Ognuno entra solo al posto di un titolare
  del suo ruolo senza voto, e non eredita la fascia. La Porta non ha
  panchinaro: è senza voto solo se la partita della squadra non si gioca.
- **Senza voto**: chi non è in distinta, chi riposa, gare rinviate o a tavolino.
- **Classifica**: somma dei punti di tutte le giornate; vince chi ha di più
  dopo la 30ª. Spareggi: media per giornata, poi miglior giornata, poi seconda
  miglior giornata, e così via.
- **Tempi**: punteggi provvisori il venerdì, contestazioni fino a domenica alle 18:00,
  congelamento domenica alle 20:00, prima della giornata successiva.

## 9. Cosa di Totoculo non prendiamo, e perché

- **Voti statistici** (Diretta.it): per il futsal sammarinese non esistono.
  Restano voto base fisso più eventi, come nel calcio Fantatitano.
- **Rigore parato +3**: il referto FSGC ha solo "rigore sbagliato".
- **Assist +1**: la FSGC non li compila; la regola resterebbe senza dati.

## 10. Le competizioni della stagione

Una sola formazione a settimana vale per **tutto**: campionato, coppa e leghe
private. Chi gioca non consegna niente in più.

### 10.1 Campionato (classifica generale)

- Tutti gli iscritti al FantaFutsal, una classifica unica.
- Ogni giornata si sommano i punti della formazione (§ 6–8). Niente scontri
  diretti: conta il totale.
- Vince chi ha più punti dopo la 30ª giornata FSGC.
- Spareggi: media punti per giornata, poi miglior giornata, seconda miglior
  giornata, terza, poi sorteggio.

### 10.2 Coppa

La coppa **non ricalcola niente**: il punteggio di ogni gara è esattamente il
punteggio di campionato di quella giornata (capitano, panchina e bonus difesa
compresi). Le chiusure delle formazioni sono le stesse.

**Fase 1 — Gironi preliminari (6 turni).**
Gli iscritti vengono divisi in due gironi, A e B, di pari numero (al massimo
uno di differenza). A ogni turno si affronta un avversario diverso dello stesso
girone, sorteggiato fra quelli non ancora incontrati. Se il girone è dispari,
chi resta senza avversario gioca contro la media dei punteggi del girone in
quella giornata. Vittoria 3, pareggio 1, sconfitta 0.

**Fase 2 — Gironi principali (6 turni, andata e ritorno).**
Passano i primi 16 di ogni girone preliminare: 32 squadre in 8 gironi da 4.
I gironi si formano a fasce, in base al piazzamento: in ogni girone una
squadra dei posti 1–4, una dei posti 5–8, e così via, alternando A e B.
Passano le prime due di ogni girone.

**Fase 3 — Eliminazione diretta (7 turni).**
16 squadre: ottavi, quarti e semifinali con andata e ritorno, conta la somma
dei punti delle due gare; finale in gara unica. In caso di parità passa chi ha
fatto più punti nella gara di ritorno, poi chi era meglio classificato nella
fase 2.

**Classifica dei gironi a pari punti**: differenza fra punti fatti e subiti
negli scontri, poi punti fatti, poi l'ordine del sorteggio iniziale.

**Il sorteggio** è uno solo, all'inizio della coppa, ed è ripetibile: lo fa
ogni telefono con lo stesso seme, e viene uguale per tutti
(`src/futsal-gare.js`, `mescola`). Partecipa chi è iscritto alla chiusura
della 9ª giornata.

**Calendario sulle 30 giornate FSGC** (19 turni in tutto):

| Fase | Turni | Giornate FSGC (proposta) |
|---|---|---|
| Preliminari | 6 | 9–14 |
| Gironi principali | 6 | 15–20 |
| Ottavi (A/R) | 2 | 21–22 |
| Quarti (A/R) | 2 | 23–24 |
| Semifinali (A/R) | 2 | 25–26 |
| Finale | 1 | 27 |

Le giornate 1–8 servono a raccogliere iscrizioni; le 28–30 restano di margine
per gare rinviate. La coppa parte a iscrizioni chiuse.

**Se gli iscritti sono meno di 50** la formula completa non regge. La natura
della coppa e il punteggio restano uguali, cambia solo il formato:

| Iscritti | Formato |
|---|---|
| 50 o più | completo: preliminari → 8 gironi da 4 → ottavi |
| 24–49 | preliminari → passano 8 per girone → 4 gironi da 4 → quarti |
| 8–23 | niente preliminari: gironi da 4 (da 5 se avanzano squadre, solo andata) → tabellone |
| meno di 8 | niente coppa, solo campionato |

**Chi va al tabellone** quando i gironi non sono una potenza di due: tutte le
prime, poi le migliori seconde (punti, differenza, punti fatti) fino a 4, 8 o 16.

### 10.2-bis Leghe private

Una lega privata è un **gruppo** di amici con la propria classifica, calcolata
sulle stesse formazioni. Niente asta e niente rose: chi crea la lega sceglie
solo il tipo di classifica.

- **A somma**: come il campionato, ma fra i membri del gruppo.
- **Testa a testa**: calendario di scontri diretti fra i membri; vince chi fa
  più punti nella giornata (3 punti), pareggio a punteggio uguale (1 punto).
  Non servono fasce di conversione in gol.

### 10.3 Migliore della giornata

A ogni giornata la squadra con il punteggio più alto fra tutti gli iscritti
(anche fuori dalla coppa) viene indicata come migliore della giornata.

### 10.4 Cosa deve mostrare l'app

Nella sezione Futsal, per ogni iscritto: fase della coppa in corso, posizione
nel girone, prossimo turno e avversario, classifica del girone, tabellone,
campione in carica, migliore della giornata, e la formazione dell'avversario
dopo la chiusura.

## 10-bis. Come fanno gli altri fantafutsal (ricerca del 25/10/2026)

Non esiste un fantafutsal "ufficiale" con voti di redazione: nessuno, in Italia
o all'estero, dà pagelle al calcio a 5. Tutti lavorano su eventi e statistiche.

| | Totoculo | FantaCun | Linea Laterale | Any Given Sunday |
|---|---|---|---|---|
| Squadra | formazione libera ogni giornata | rosa 10, 100 crediti, quotazioni che cambiano, mercato libero | rosa 10, 100 crediti, draft a turni | 5 giocatrici + allenatore, 150 crediti, solo Coppa Italia femminile |
| Limite per squadra reale | 1 | 1 | — | 2 |
| Ruoli | P D C A | P D A | P D A | P L C PV (universali ricollocati) |
| In campo | P + 4, moduli 1-2-1 / 2-1-1 | P + 2D + 2A, fisso | P + 4, oppure 5 di movimento | tutte e 5 |
| Panchina | 1, stesso ruolo | 5 fissi (P D D A A), 3 cambi, uno per ruolo | 5, i loro punti non contano | nessun cambio |
| Voto | statistico (Diretta.it) + bonus | nessuno: solo bonus e malus | +1 presenza + eventi | solo eventi |
| Gol | +3 | +2 | +5 A, +6 D, +8 P | +10 |
| Porta: gol subito / inviolata | −1 / +1 | −0,5 / +4 | −1 ogni 2 / +5 | — |
| Capitano | raddoppia bonus/malus, no vice | — | raddoppia, con vice | raddoppia bonus/malus |
| Chiusura | prima della giornata | lunedì 19:00 | 1' prima della prima gara, e ogni giocatore si blocca al via della sua partita | prima del torneo |
| Classifica | somma + coppa | somma + premio di giornata | somma oppure testa a testa | somma |

Cosa ne ricaviamo:

- **Solo eventi, niente pagelle, è la norma.** Il nostro voto base 6 per chi è
  in distinta è più generoso della media ma coerente.
- **Il limite di uno per squadra reale** c'è in tre giochi su quattro: confermato.
- **Due giochi su quattro usano solo tre ruoli (P, D, A)**: alternativa più
  semplice ai nostri quattro.
- **Eventi tipici del futsal** che altri premiano: tiro libero dei 10 metri
  (dal sesto fallo), tiro libero parato, gol da metà campo. Il referto FSGC non
  li distingue: restano fuori.
- **Blocco giocatore per giocatore** (Linea Laterale): la giornata FSGC va dal
  lunedì al giovedì, e si potrebbe cambiare chi gioca giovedì fino al via della
  sua partita. Più complicato con panchina e capitano: da valutare dopo.

## 11. Da fare dopo (non in questa bozza)

- Consegna delle formazioni con salvataggio sul server (oggi l'editor futsal
  salva solo sul telefono), classifiche e leghe private.
- Coppa (calendario e tabellone).
- Blocco giocatore per giocatore (§ 10-bis).
- Albo d'oro (campioni di campionato e coppa per stagione).

## 11-bis. Chi entra la prima volta (26/10/2026)

Rifatto il giro da utente appena registrato, diciotto correzioni: il gioco
spiegato in tre passi prima dell'iscrizione, un menu laterale solo del futsal,
il conto alla rovescia della chiusura, «senza formazione 0 punti» detto
dappertutto, il contatore «Scelti 3 su 7» al posto degli errori a campo vuoto,
capitano e vice con i loro pulsanti, la porta spiegata nel foglio di scelta,
«convocato» al posto di «in distinta», il regolamento con classifica, coppa e
leghe, e il promemoria della formazione.

Il promemoria sul telefono ha bisogno di due cose quando il futsal va in
produzione: la migrazione `futsal-03-promemoria.sql` sul database e la
funzione `promemoria` ridistribuita (`supabase functions deploy promemoria
--no-verify-jwt`). Fino ad allora c'e' l'avviso dentro l'app.

## 12. Decisioni prese (25/10/2026)

(I punti 1, 4 e 6 sono superati dal § 13 del 29/10.)

1. Formazione libera di giornata, nessuna rosa né asta.
2. Leghe private come gruppi sulle stesse formazioni (a somma o testa a testa).
3. Tre ruoli: P (porta di squadra), D (Centrale, Laterale), A (Pivot, Universale).
4. Moduli 2-2 e 3-1, bonus difesa +2 da media 7,0.
5. Gol +3, Porta −0,5 a gol subito, +3 se inviolata; assist e rigori parati fuori.
6. Due panchinari (D e A), capitano con vice.
7. Coppa a tre fasi dalla 9ª alla 27ª giornata.

## 13. Il FantaFutsal sul modello Dunkest (29/10/2026)

Richiesta di Alex: studiare Dunkest (fantabasket NBA, app iOS e
fantasy.dunkest.com) con la skill di reverse engineering e strutturare il
futsal allo stesso modo: statistiche, schemi, regolamento, tutto collegato.

**Cosa si è studiato.** Il sito è un'app Flutter (`main.dart.js`, versione
5.3.9): REA ha inventariato il pacchetto (il bundle Dart da 7,6 MB supera la
memoria del suo analizzatore, quindi stringhe e indirizzi sono letti come
testo). Le API pubbliche `fantaking-api.dunkest.com/api/v1` danno la
configurazione del gioco (rosa 4 G / 4 F / 2 C + coach, 5 in campo e 5 in
panchina, capitano ×1,5, 5 schemi, 3 per squadra, 95 crediti, −5 a cambio),
il profilo giocatore (quotazione, media, plus, popolarità, «on fire»,
infortunio), il trend per giornata e il dettaglio dei punti per statistica.
Il regolamento completo sta su docs.dunkest.com; le schermate vere vengono
dall'App Store. Di Dunkest si prende la **struttura**, non il marchio:
colori, nomi e grafica restano di Fantatitano.

| Dunkest | FantaFutsal |
|---|---|
| 10 giocatori + 1 coach, 95 crediti | 8 giocatori (4 D, 4 A) + 1 Porta, 70 crediti |
| Coach: punti dal risultato della squadra | **Porta**: gol subiti, inviolata, esito ed eventi dei portieri |
| 5 schemi (2-2-1, 1-2-2…) | 3 schemi: 1-3, 2-2, 3-1 (col bonus difesa) |
| 5 in campo, sesto uomo 100%, panchina 50% | 4 in campo + Porta, sesto uomo 100%, panchina 50% |
| Capitano ×1,5 | Capitano ×1,5, con il vice se non è convocato |
| Max 3 per squadra NBA | Max 2 per squadra, Porta compresa |
| Cambi tra i turni, a mano | Cambio automatico dalla panchina (la giornata si chiude tutta insieme) |
| Squadra a riposo: media, niente capitano | Uguale |
| Quotazioni con plusvalenze | Uguale, dalle prime 6 giornate |
| Mercato tra le giornate, −5 a cambio | Mercato tra le giornate, 1 cambio gratis poi −1 |
| Overall, Country, Favorite Team, 5 Champions Series, 2 Cup | Generale, Tifosi, 3 Serie (Guaita, Cesta, Montale), Coppa Titano |
| Leghe private a somma o testa a testa, «Dunkest Team» se dispari | Uguale, la squadra in più affronta la media |
| Statistiche: tabellone giocatori, difesa contro posizione | Tabella giocatori e porte, classifica vera con «vs D / vs A», leader |
| Profilo: crediti, FPM, plus, pop, partite, forma | Uguale, più quotazione giornata per giornata |

### 13.1 La rosa
Porta di una squadra + 4 difensori + 4 attaccanti, con **70 crediti**, al
massimo **2 della stessa squadra** (Porta compresa). La squadra **resta da
una giornata all'altra**: vale l'ultima salvata. Prima di averla fatta,
quella giornata vale 0.

### 13.2 Schemi
In campo la Porta e 4 giocatori: **1-3, 2-2 o 3-1**. Con il 3-1 resta il
bonus difesa (+2 se Porta e tre D fanno in media almeno 7,0).

### 13.3 Sesto uomo e panchina
Dei 4 fuori, il **sesto uomo** conta al 100%, gli altri tre al **50%**.

### 13.4 Capitano
Capitano e vice fra i 4 in campo: il capitano vale **×1,5**. Se non è
convocato (o riposa) la fascia passa al vice; chi riposa non la prende mai.

### 13.5 Cambio automatico e riposo
Chi è in campo e non è convocato è sostituito dal primo della panchina del
suo ruolo che ha giocato: entra al 100% e non porta la fascia. Il sesto uomo
non sostituisce (conta già per intero). A giornata conclusa chi **riposa**
(o ha la partita rinviata, o senza referto dopo tre giorni) prende la sua
**media** delle giornate prima, senza fascia e senza variazione di valore.

### 13.6 Punti
Gli stessi dei §§ 5-7 per giocatori e Porta.

### 13.7 Quotazioni, crediti e mercato
- Quotazione di partenza dalle giornate 1-6: media punti (tirata verso 6, o
  5 per le porte, come con due partite in più) pesata sulle presenze;
  fra 3 e 18 crediti, a mezzo credito. Oggi vanno da 3 a 13.
- Dopo ogni giornata conclusa: variazione = (punti − atteso) × 0,1, al
  massimo ±0,6, dove l'atteso è 4,5 + (valore − 3)/2 (3 + … per le porte).
  Chi non è convocato fa 0; chi riposa non si muove.
- **Patrimonio** = 70 + plusvalenze dei giocatori avuti in rosa;
  **crediti residui** = patrimonio − valore della rosa oggi.
- **Mercato**: aperto fra la fine di una giornata (referti arrivati) e
  10 minuti prima della prima partita della successiva. Mentre aspetta i
  referti si cambiano schema, titolari e capitano, ma non si compra.
- Prima rosa: cambi illimitati e gratis. Poi **1 cambio gratis a giornata,
  −1 punto per ogni altro**.
- Il database controlla rosa, schema, crediti e mercato
  (`futsal-04-rosa.sql`); le quotazioni gli arrivano da
  `futsal-05-quotazioni.sql`, generato con `node scripts/genera-futsal-sql.mjs`
  dopo ogni importazione.

### 13.8 Campionati
Con la stessa squadra, senza fare niente: **Generale**, **Tifosi** (chi ha la
stessa squadra del cuore, scelta all'iscrizione), **Serie Guaita** (8ª–14ª),
**Serie Cesta** (15ª–22ª), **Serie Montale** (23ª–30ª) e la **Coppa Titano**
(§ 10.2). Più le leghe con gli amici (§ 10.2-bis).

### 13.9 Statistiche e profilo
Tabella giocatori ordinabile (CR, PLUS, PF, MPF, presenze, gol, cartellini,
autogol, rigori sbagliati), tabella porte (gol subiti, inviolate, V-N-P),
classifica vera del campionato con i fantapunti concessi a D e A, leader
(punti, media, plusvalenza, in forma, gol, inviolate). Il profilo ha
prossime partite, forma (ultime 3 e 5), fantapunti per giornata a colori,
quotazione nel tempo e il dettaglio partita per partita.

### 13.10 Nell'app
Barra in basso: Home · Squadra · Statistiche · Calendario · Classifiche.
La home ha la banda della squadra (giornata, mercato, crediti, cambi), i
campionati principali, «I miei campionati», i leader e le partite.

### 13.11 Da decidere con Alex
1. Budget 70, max 2 per squadra, 1 cambio gratis e −1 a cambio: tarati sui
   dati delle prime 6 giornate, da confermare.
2. Il cambio automatico (Dunkest non ce l'ha): tenerlo?
3. Al lancio: applicare `futsal-04-rosa.sql` e `futsal-05-quotazioni.sql`,
   e far rigenerare/applicare le quotazioni dopo ogni importazione (oggi è a
   mano, come futsal-02).

### 13.12 La grafica del futsal (29/10/2026)
Dentro il futsal l'app è un'altra: la radice prende `data-sport="futsal"` e
`styles/futsal-tema.css` ridefinisce variabili e forme, senza toccare il
calcio. Fra sei stili provati dal vivo Alex ha scelto **i colori del «Carta»
con la struttura dell'«Arena»**: carta chiara, inchiostro nero e un solo
colore (rosso-arancio `#FF4B2B`), titoli e numeri in Teko; schede, campo e
menu con gli angoli tagliati, tasti e linguette a parallelogramma, barretta
inclinata nei titoli, barra rossa sopra la voce scelta in basso. Icone
proprie in `media/icone/futsal` (barra in basso, menu, selettore), menu
laterale proprio, velo nero col nome del gioco quando si arriva dal calcio.
