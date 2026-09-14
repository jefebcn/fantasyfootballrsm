# 05 — Admin: inserimento eventi (Giudice Dati)

> "Il collo di bottiglia del progetto non è il codice, è la produzione del dato ogni
> domenica sera." — README §1. Obiettivo: **< 10 minuti a partita**, 8 partite, sotto l'ora
> e mezza per giornata. Mobile-first: si inserisce dal telefono, a bordo campo o davanti a
> Titani.TV.

## Flusso

```
Giornata 12 (Provvisorio)                     ← lista 8 partite con stato ✔ / ● / ○
  └ Partita: Tre Fiori — La Fiorita
       1. Risultato + stato gara               (played / rinviata / sospesa <45 / sospesa >45 / a tavolino)
       2. Formazioni: chi ha giocato           (tap = titolare 90'; tap lungo = minuti; swipe = non convocato)
       3. Eventi                               (tastierino: gol · assist · autogol · giallo · 2° giallo · rosso · rig. sbagliato · rig. parato)
       4. Riepilogo + anteprima voti           (il motore calcola live; il Giudice vede i fantavoti prima di salvare)
       5. Salva → giornata resta Provvisoria
```

## Schermata A · Lista partite della giornata

- Testata: `GIORNATA 12 · PROVVISORIO` + progress `5/8 inserite`.
- Riga partita: `Tre Fiori — La Fiorita · Acquaviva` · stato `✔ 2-1` / `● in inserimento` / `○ da inserire` · icona play Titani.TV.
- Bottone in basso `PUBBLICA PUNTEGGI PROVVISORI` attivo solo con 8/8 (o con partite rinviate marcate).

## Schermata B · Formazioni (chi ha giocato)

Due colonne (una per squadra) impilate su mobile con tab. Ogni tesserato della società
è un chip: grigio = non convocato, pieno = in campo. Tap → 90'. Il campo minuti compare
solo se si tocca il chip già attivo: tastierino numerico `0–90`, preset `45 · 60 · 75`.
Sopra ogni colonna: contatore `11 titolari · 3 subentrati`. Il sistema avverte se
titolari ≠ 11.

Regola visiva: l'espulso mostra i minuti fino al cartellino (art. 7.1) — il tastierino
eventi lo imposta da solo quando si inserisce un rosso.

## Schermata C · Eventi

Timeline verticale della partita `0' → 90'`. In basso una **tastiera eventi** fissa:

| Tasto | Colore | Chiede |
|---|---|---|
| ⚽ Gol | verde | giocatore → (opz.) assist |
| Autogol | rosso | giocatore |
| 🟨 Giallo | ambra | giocatore |
| 🟨🟨 2° giallo | ambra/rosso | giocatore (imposta minuti + malus cumulato −1,5) |
| 🟥 Rosso | rosso | giocatore (imposta minuti) |
| Rig. sbagliato | rosso | tiratore → `parato?` sì/no → portiere |
| Rig. procurato / causato | grigio | **visibile solo se `rules.level2Events`** |

Ogni inserimento: **minuto** (tastierino, default = ultimo +1) → **giocatore** (lista
filtrata per squadra, con ricerca a due lettere). Tre tocchi per evento. Undo sull'ultimo
evento sempre disponibile.

Il **rigore segnato** non esiste come evento: è un gol (art. 7.4). L'interfaccia non
propone mai "rigore segnato" per non generare doppio conteggio.

## Schermata D · Riepilogo e anteprima voti

- Risultato, stato gara, contatori eventi.
- Lista dei 22+ con **fantavoto calcolato in anteprima** e i bonus principali. Il Giudice
  vede subito se un portiere ha preso `+3,0` porta inviolata o se un difensore uscito al
  60' non l'ha presa (art. 7.5): l'errore si scopre prima di salvare.
- Warning bloccanti: `Gol di La Fiorita: 2 registrati, risultato dice 1`. Warning
  informativi: `Nessun assist registrato su 3 gol`.
- `SALVA PARTITA` → log `chi · quando · cosa`.

## Contestazioni

Coda con: chi contesta, partita, evento, minuto, testo. Azioni: `Accolta` (apre l'evento
in modifica, loggato) / `Respinta` (motivo obbligatorio, va nell'archivio precedenti).
Countdown `mar 18:00` in testa. Dopo le 18:00 la coda è in sola lettura.

## Congela giornata

Schermata a schermo pieno rossa: elenco controlli (8/8 partite, 0 contestazioni aperte,
punteggi pubblicati), il testo dell'art. 9.2, campo `Scrivi CONGELA` e bottone. Dopo il
congelamento la giornata mostra il lucchetto ovunque, e ogni tentativo di modifica
risponde `Giornata 12 congelata martedì 20:00 · art. 9.2`.

## Registro modifiche

Tabella cronologica `quando · chi · partita · evento · prima → dopo`. Esportabile. È la
base per le contestazioni e per la credibilità del gioco.
