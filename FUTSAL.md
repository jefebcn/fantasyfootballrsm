# Fantatitano Futsal — bozza di regolamento

Stato: **regolamento deciso il 25/10/2026, ramo `futsal`, non pubblicato.**
Nell'app la sezione esiste ma è nascosta (si apre solo con `?futsal=1`).

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

**Classifica dei gironi a pari punti**: miglior punteggio nel turno in
questione, poi differenza punti negli scontri, poi punti fatti, poi sorteggio.

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
| 8–23 | niente preliminari: gironi da 4 → passano le prime due → tabellone |
| meno di 8 | niente coppa, solo campionato |

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

## 12. Decisioni prese (25/10/2026)

1. Formazione libera di giornata, nessuna rosa né asta.
2. Leghe private come gruppi sulle stesse formazioni (a somma o testa a testa).
3. Tre ruoli: P (porta di squadra), D (Centrale, Laterale), A (Pivot, Universale).
4. Moduli 2-2 e 3-1, bonus difesa +2 da media 7,0.
5. Gol +3, Porta −0,5 a gol subito, +3 se inviolata; assist e rigori parati fuori.
6. Due panchinari (D e A), capitano con vice.
7. Coppa a tre fasi dalla 9ª alla 27ª giornata.
