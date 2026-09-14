# 04 — Schermate

Ogni schermata: scopo, struttura dall'alto in basso, funzionalità, dato mostrato, stato.
Riferimento visivo: `index.html`.

---

## S1 · Dashboard

**Scopo**: in tre secondi capire in che fase siamo e cosa devo fare.

1. App bar: `I SUDATI DEL TITANO` / `DASHBOARD`.
2. Card nome lega breve (`SUDATI TITANO`) — come nell'app italiana, un tap apre il selettore leghe.
3. **Hero**: nome squadra fanta (`Hasta El Chapo FC`), maglia, tre azioni circolari
   (condividi scheda · impostazioni · mercato). Watermark tre torri.
4. **Barra stat**: `8ª Posizione · 0 Punti · 1 Partite · 70,5 Fantapunti`.
5. **Fase settimana** (nuovo): card con badge stato e azione primaria.
   - Aperta → CTA oro `SCHIERA LA FORMAZIONE` + `lock dom 15:00 · 2g 5h`.
   - Provvisorio → `PROVVISORIO · contestazioni fino a mar 18:00` + link `Vedi i voti`.
   - Congelato → `CONGELATO mar 20:00` + `Giornata 11 archiviata`.
6. **Risultati provvisori / Live in corso**: card partita fanta con loghi, risultato in
   gol, fantapunti e bottone verde **Vai al Live** (→ S6). Sottotitolo `2ª di Lega ·
   2ª del Campionato`.
7. **Prossima giornata**: card VS con le due squadre, sottotitolo con la giornata.
8. **Ultimi 5 incontri**: cinque cerchi (V verde · N grigio · P rosso) con risultato e
   fantapunti sotto; i turni futuri sono cerchi vuoti. Identico all'app italiana.
9. Card regola del momento (sostituisce il banner sponsor): es. `Rigore parato: +3,0 al
   portiere, −3,0 al tiratore`. Ruota tra gli articoli del regolamento.

---

## S2 · Rosa

Tab `Rosa` | `Formazione`.

**Rosa**: 25 giocatori raggruppati per ruolo con intestazioni `PORTIERI 3/3`,
`DIFENSORI 8/8`… Riga: chip ruolo · nome · società · quotazione · prezzo pagato ·
media fantavoto stagionale. Giocatore fuori dal campionato: riga barrata + badge
`RIMOSSO · rimborso 50%`. Crediti residui in alto a destra.

**Formazione**:
1. Badge fase (`Aperta · lock dom 15:00`) o lucchetto.
2. Selettore modulo a chip orizzontali: `3-4-3 3-5-2 4-3-3 4-4-2 4-5-1 5-3-2 5-4-1`.
3. Campo verticale con gli 11 slot; slot vuoto tratteggiato; tap → bottom sheet con i
   giocatori del ruolo.
4. Capitano `C` e vice `V` come bollini oro sull'avatar; tap lungo per assegnare.
5. Panchina: lista ordinata 7 slot con maniglia drag; etichetta `L'ordine conta: entra il
   primo del ruolo con voto`.
6. Bottone `CONFERMA FORMAZIONE`; dopo conferma, toast `Formazione salvata · giornata 12`.
7. Se non consegnata al lock: banner `Vale l'ultima formazione valida (giornata 11)`.

---

## S3 · Calendario

Selettore giornata orizzontale `G10 G11 [G12] G13…` con puntino sotto la corrente.

Sezione **Scontri di lega**: card partita fanta per ogni fixture, con risultato e
fantapunti se giocata (`74,5 – 68,0 → 1 – 0`).

Sezione **Partite del campionato** (nuovo): 8 righe `Tre Fiori — La Fiorita · dom 15:00 ·
Acquaviva` con icona play se `videoUrl`. Stato: `Giocata 2-1` / `Rinviata` / `Sospesa 60'`
(art. 10). Nessuna icona casa/trasferta.

---

## S4 · Classifica

1. Badge stato dato.
2. Tabella: `# · Squadra · Pt · G · V N P · GF GS · DR · Fantapunti`.
3. Riga evidenziata per la mia squadra (bordo azzurro).
4. Piè di tabella: `Spareggi: punti › fantapunti totali › differenza reti › scontri diretti`
   (art. 12.2) — sempre visibile, non in un tooltip.
5. Tab secondario `Coppa Titano Fanta` (tabellone a eliminazione) quando attiva.

---

## S5 · Voti (vista pubblica settimanale)

1. Badge stato dato in testa; a destra il selettore giornata.
2. Filtri chip: `Tutti · Solo miei · P D C A · Società ▾`.
3. Lista per società reale (8 partite → 16 blocchi), ogni blocco con intestazione
   `TRE FIORI 2 – 1 LA FIORITA · Acquaviva`.
4. Riga giocatore: chip ruolo · nome · minuti (`90'` / `27'` / `S.V.`) · eventi come
   icone compatte (⚽ ×1, 👟 assist, 🟨, 🟥, 🧤 rigore parato) · **fantavoto**.
5. Tap → bottom sheet **Breakdown**:
   ```
   Voto base            6,0
   Esito collettivo    +0,5   vittoria · 90'
   Gol × 1             +3,5   centrocampista
   Ammonizione         −0,5
   ──────────────────────────
   Fantavoto            9,5
   ```
   Link `Segnala un errore` → modulo contestazione con evento e minuto precompilati
   (attivo solo in fase Provvisorio).
6. Giocatori S.V. in fondo al blocco, in `--text-muted`, con motivo: `< 20' senza
   eventi`, `non entrato`, `gara rinviata`.

---

## S6 · Live (dettaglio partita fanta)

Ricalca la schermata Live di Leghe Fantacalcio, elemento per elemento.

1. **App bar Live**: indietro · chip lega (avatar, `I SUDATI DI RSM` / `Giornata 2`, chevron
   per cambiare lega) · icona lista · icona condividi scheda.
2. **Testata** su gradiente: nome squadra + modulo a sinistra e a destra; al centro il
   risultato in gol grande (`2 – 1`) e sotto i fantapunti in mono (`75,5 – 70,5`).
3. **Badge di stato**: `Parziale · 6/8 partite inserite` mentre il Giudice Dati inserisce;
   poi `Provvisorio`, poi `Congelato`.
4. Bottone bianco **Conversione in gol** (al posto di «Simula risultato»): apre la formula
   dell'art. 11 con i numeri della partita. Non c'è nulla da simulare, si mostra.
5. **Campo lungo**: la prima squadra dal portiere (in alto) all'attacco; linea di metà campo
   con cerchio; la seconda squadra **specchiata**, dall'attacco al portiere (in basso).
   Ogni slot: avatar a iniziali sul colore della società, chip ruolo, bollino `C`/`V`,
   indicatori evento in alto a destra, **pill doppia** `Voto Titano | fantavoto`, cognome.
   Chi è S.V. mostra la freccia rossa `↓` e la pill `S.V. | →` (sostituito) o `S.V. | 5,5`
   (voto d'ufficio).
6. **Nota sostituzioni**: card informativa azzurra che spiega in una riga cosa ha fatto il
   motore: `capitano S.V., vice S.V. → nessun raddoppio (6.3) · Grandoni S.V. → entra
   Ceccoli (panchina 2) · Valentini senza sostituto: 5,5 d'ufficio (8.6)`.
7. **Panchina** a due colonne (una per squadra), 7 righe: chip ruolo, cognome, società,
   pill verticale `Voto Titano / fantavoto`; `↑` verde accanto a chi è entrato; `⊘`
   per «non ha giocato»; `S.V. / rinv.` per gara rinviata.
8. Card **Legenda Voto Titano** (chevron): apre i valori dell'art. 5.
9. **Totale parziali**: `63,5 · Voto Titano · 66,0` e sotto, in azzurro, `75,5 · con
   bonus/malus · 70,5`.
10. **Bottom bar secondaria a 4**: Campo · Lista · Titani.TV · Campionato. Bottone
    flottante **Altri incontri** per le altre partite fanta della giornata.

---

## S7 · Listone

Ricerca + filtri società/ruolo/quotazione. Riga: chip ruolo · nome · società ·
quotazione · stato (`Libero` / `di Pelli` / `Fuori campionato`). Tesserato FSGC: le righe
della propria società sono grigie con lucchetto `Art. 13.2`.

## S8 · Asta

Prima stagione: **registro acquisti manuale** (README fase 1). Schermata a due colonne
mobile-stack: giocatore chiamato + prezzo + acquirente; validazioni live: budget residuo,
slot ruolo residui, tetto società (se attivo), art. 13.2. Fase 2: asta live realtime con
rilancio a 1 credito e timer.

## S9 · Scheda condivisibile

Immagine 1080×1350 (formato storia/feed) generata server-side: fondo `--grad-hero`, tre
torri, nome squadra, risultato, i tre fantavoti migliori, badge stato. Bottone
`CONDIVIDI SU WHATSAPP`. È la funzione di crescita principale, quindi vive nell'hero.
