# Fantatitano Futsal — bozza di regolamento

Stato: **bozza di lavoro sul ramo `futsal`**, non pubblicata. Nell'app non c'è
ancora niente: questo file serve a decidere le regole prima di scrivere codice.

## 1. Da dove vengono le idee

Abbiamo studiato le pagine pubbliche di Totoculo (totoculo.it), che gestisce un
FantaFutsal da due stagioni. Ne riprendiamo **le meccaniche di gioco**, che sono
idee e non testo: formazione di giornata senza rosa, due moduli, bonus difesa,
capitano obbligatorio, panchina unica, coppa parallela a gironi. Il testo qui
sotto è nostro, e niente del loro codice, grafica o marchio entra nell'app.

Dove le loro regole poggiano su dati che il referto FSGC non ha (voti
statistici di Diretta.it, rigori parati, assist sistematici), la regola è
adattata o tolta, e lo diciamo caso per caso (§ 9).

## 2. I dati FSGC (verificati su 38 referti, giornate 1–6 del 2026/27)

- Campionato: 15 squadre, 30 giornate, una giornata a settimana dal lunedì al
  giovedì sera (prima gara di solito alle 20:15). Ogni giornata una squadra riposa.
- Partita: due tempi da 30', a volte con recupero (60' + 2').
- Distinta: da 9 a 14 giocatori per squadra, con numero e ruolo (Portiere,
  Centrale, Laterale, Universale, Pivot). Sono tutti sotto "Titolari": **non si
  sa chi è entrato in campo né per quanto**. I cambi non sono registrati.
- Ogni giocatore ha una scheda con nome completo e un codice unico
  (`fsgc.sm/it/giocatore/<nome>/<id>`): gli omonimi si distinguono così.
- Eventi: gol con minuto, gol su rigore, autogol, ammonizioni, espulsioni.
  Assist: la voce esiste ma in 38 partite non è mai stata compilata.
- Numeri: 5,2 gol a partita, 5 pareggi su 38, 12 porte inviolate su 76.

## 3. Formazione di giornata

Niente rosa, niente asta, niente crediti. **A ogni giornata ognuno sceglie
liberamente la formazione fra tutti i giocatori in listone**, come su Totoculo.

- 1 Porta, 4 giocatori di movimento, 1 panchinaro: 6 scelte.
- **Al massimo un giocatore per squadra FSGC** (la Porta conta come la sua squadra).
  È il vincolo che impedisce a tutti di schierare la stessa formazione.
- Chiusura: 10 minuti prima della prima gara della giornata. Dopo, formazione e
  modulo non si cambiano.
- Formazione non consegnata: zero punti nella giornata.

Perché niente rosa: le porte sono 15 e una riposa ogni settimana, i giocatori
di movimento sono circa 200. Con la formazione libera spariscono i problemi di
esclusività, di quotazioni e di mercato, e il gioco resta settimanale.

## 4. Ruoli e moduli

I ruoli FSGC diventano quattro ruoli di gioco:

| Ruolo di gioco | Ruoli FSGC | Presenze per squadra a partita |
|---|---|---|
| **P** Porta | i portieri della squadra, insieme (§ 5) | 1 |
| **D** Difensore | Centrale, Universale | ~2,7 |
| **C** Centrocampista | Laterale | ~4,8 |
| **A** Attaccante | Pivot | ~2,2 |

Il Centrale da solo è troppo raro (circa mezzo per squadra a partita) per fare
un ruolo: per questo l'Universale sta con lui.

Moduli:

- **1-2-1 standard**: P, 1 D, 2 C, 1 A.
- **2-1-1 difensivo**: P, 2 D, 1 C, 1 A. Dà diritto al Bonus difesa (§ 7).

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
| Porta: porta inviolata | +1 |
| Assist | **non conta** finché la FSGC non li compila sempre |
| Rigore parato | **non conta**: il referto non lo distingue dal rigore fuori |

Il gol vale +3 come su Totoculo. Il gol subito vale −0,5 e non −1: lì il
portiere ha un voto statistico che compensa, qui la Porta parte da 6 e con −1
a gol scenderebbe in media sotto il 4 (2,6 gol subiti a partita).

Sulle 38 partite reali, con queste regole: Porta 4,9 di media, D 6,9, C 6,7,
A 6,9. Una formazione da 5 fa in media 32 punti (27,5 il 10% più basso, 38 il
10% più alto).

## 7. Bonus difesa

Con il modulo 2-1-1, se la media dei punteggi finali di **Porta + D + D** è
almeno **7,5**, la squadra prende **+2**, una sola volta per giornata.
Contano i punteggi dopo il capitano e dopo l'eventuale sostituzione; uno slot
senza voto né sostituto vale 0 nella media.

Sulle 38 partite si sarebbe attivato nel 17% delle formazioni 2-1-1.

## 8. Capitano, panchina, classifica

- **Capitano obbligatorio**, scelto fra i quattro di movimento (non la Porta).
  Raddoppia bonus e malus, non il voto base. Niente vice: se il capitano non ha
  voto, la fascia si perde.
- **Un solo panchinaro**, che entra solo al posto di un titolare **dello stesso
  ruolo** senza voto. Sostituisce al massimo un giocatore e non eredita la fascia.
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
- **Pronostici 1X2 (TC League)**: è un altro gioco; per ora fuori.

## 10. Da fare dopo (non in questa bozza)

- **Coppa** parallela a gironi ed eliminazione diretta che usa gli stessi
  punteggi, senza una formazione in più. Utile quando ci saranno abbastanza iscritti.
- **Migliore della giornata** (punteggio più alto del turno).
- Selettore Calcio / Futsal nell'app, listone futsal, importazione dei referti.

## 11. Punti aperti

1. Formazione libera di giornata (come qui) **oppure** leghe con rosa e asta come nel calcio?
2. Mappatura dei ruoli: Universale con i Difensori va bene?
3. Valori di punteggio: confermare gol +3, Porta −0,5 / +1, bonus difesa a 7,5.
4. Leghe private fra amici: stesse regole, o anche lì la formazione libera?
