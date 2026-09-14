# 02 — Design system

I valori numerici vivono in `tokens/tokens.css`. Qui si spiega come usarli.

## Colori (ruoli semantici)

| Token | Chiaro | Scuro | Uso |
|---|---|---|---|
| `--bg` | `#EEF2F7` | `#071A29` | Fondo pagina |
| `--surface` | `#FFFFFF` | `#0D2537` | Card, sheet, drawer |
| `--surface-2` | `#F7FAFD` | `#12314A` | Righe alternate, input |
| `--border` | `#DCE5EF` | `#1C4463` | Separatori |
| `--text` / `--text-muted` | `#0C2C45` / `#5A7591` | `#E8F1F8` / `#90AEC6` | Testo |
| `--primary` | `#1B84C6` | `#3AA6E0` | Azioni, nav attiva |
| `--accent` | `#E5A11B` | `#FFC94D` | CTA principale, capitano |
| `--positive` / `--negative` | `#1E9E6A` / `#CE3B3B` | `#35B37E` / `#E35B5B` | Bonus / malus |
| `--warning` | `#D98A15` | `#F0B347` | Provvisorio |
| `--stato-congelato` | `#0E5E93` | `#7CC2E8` | Badge congelato |

Contrasto: testo su `--surface` ≥ 7:1; testo bianco su `--primary` 4.6:1 (AA); testo
`--on-accent` (blu notte) su oro 8.9:1. Nel tema scuro il primario si schiarisce
(`titano-400`) e il testo sopra diventa scuro (`--on-primary`).

## Tipografia

Scala (mobile): H1 26 · H2 20 · H3 17 · Body 15 · Small 13 · Label 11 · Stat 24.

- **Label**: sempre `uppercase`, `letter-spacing: .08em`, `--text-muted`. Esempio: `POSIZIONE`.
- **Numeri in colonna**: `font-variant-numeric: tabular-nums`, famiglia display.
- **Fantavoto**: display 700, con la virgola decimale italiana (`6,5` non `6.5`) in tutta la UI.
- **Nome squadra fanta** nell'hero: display 800, bianco, 26px, `text-wrap: balance`.

## Spaziatura e layout

- Scala 4px; gutter laterale **16px** fisso; card separate da `gap: 12px`.
- App bar 56px; bottom nav 60px + safe-area.
- Contenuto a colonna singola; le griglie sono solo per le stat (4 colonne) e i
  moduli di formazione (campo).
- Larghezza di riferimento 390px; tutto deve reggere a 360px.

## Componenti

### App bar
Gradiente `--grad-header`, testo bianco. Sinistra: hamburger. Centro-sinistra: nome lega
(display 700, 17px, uppercase) + sottotitolo schermata (label 11px, 80% bianco). Destra:
campanella + chat con puntino rosso.

### Hero squadra
Fondo `--grad-hero` con watermark tre torri al 6% di opacità. Nome squadra in alto,
maglia al centro (illustrazione), colonna di **tre azioni circolari** a destra (condividi
scheda · impostazioni · mercato). Sotto: riga loghi "Tre torri · Titani.TV".

### Barra statistiche
Card bianca sovrapposta all'hero di 24px. Quattro colonne divise da hairline: numero
(stat 24, display 700) sopra, label (11, muted) sotto. Il numero della posizione porta
l'ordinale `ª`.

### Badge stato dato
Il componente identitario. Pillola con icona + testo uppercase:

| Stato | Colore | Icona | Testo |
|---|---|---|---|
| Provvisorio | `--warning` su `--warning-soft` | orologio | `PROVVISORIO · contestazioni fino a mar 18:00` |
| Congelato | `--stato-congelato` su `--primary-soft` | lucchetto | `CONGELATO · mar 20:00` |
| In corso | `--positive` con puntino pulsante | — | `LIVE` |

Compare **sempre** in testa a Voti, Classifica, Dettaglio partita fanta e Dashboard
(sezione giornata). Mai nascosto sotto la piega.

### Chip ruolo
Cerchio 22px, lettera display 700 bianca, fondo `--ruolo-{p,d,c,a}`. Stessa dimensione
ovunque: listone, rosa, formazione, data entry.

### Card voto giocatore (riga)
`[chip ruolo] Nome Cognome · Società  ······  6,5 ▸`
Tocco → espande il breakdown:

```
Voto base        6,0
Esito collettivo +0,5   (vittoria, 90')
Gol × 1          +3,5   (C)
Ammonizione      −0,5
─────────────────────
Fantavoto        9,5
```
Ogni riga del breakdown in `--font-data`; segno sempre esplicito; bonus in `--positive`,
malus in `--negative`. Il capitano mostra `×2` sulla riga bonus/malus, non sul voto base
(art. 6.2).

### Card partita fanta
Due squadre con logo, VS centrale in cerchio, punteggio in display. Sotto, i fantapunti
in mono: `75,5 · fantapunti · 70,5`. Se la giornata è in corso o provvisoria, la card
chiude con il bottone verde **Vai al Live** (unico bottone verde dell'app: è lo stato
live, non un'azione).

### Pill doppia voto
`[ 6,5 | 9,5 ]` — cella sinistra **Voto Titano** (base + esito, testo scuro), cella
destra **fantavoto** (azzurro su azzurro chiaro). Stessa forma della pill
«voto | fantavoto» di Leghe Fantacalcio, ma la prima cella non è una pagella. Per un
S.V. la pill mostra `[ S.V. | 5,5 ]` se vale il voto d'ufficio, `[ S.V. | → ]` se è
scattata la sostituzione automatica.

### Slot giocatore sul campo
Avatar 40px a **iniziali sul colore della società reale** (niente caricature né foto:
art. 14.1), chip ruolo in basso a destra, bollino oro `C`/`V` in alto a sinistra,
**indicatori evento** in alto a destra (tessere 16px: G, As, A, E, RP, ↓ uscito / S.V.,
↑ entrato dalla panchina). Sotto: pill doppia e cognome.

### Avatar giocatore
Cerchio con iniziali, sfondo = colore principale della società (16 colori fissi in
config). Stesso avatar in listone, rosa, campo, panchina e data entry.

### Totale parziali
Card a raggio grande in fondo al Live: pillola azzurra `Totale parziali`, riga
`63,5 · Voto Titano · 66,0`, separatore, riga in azzurro `75,5 · con bonus/malus · 70,5`.
È la stessa struttura di «solo voti / con bonus-malus» dell'app italiana.

### Card partita reale
`Tre Fiori — La Fiorita` · `dom 15:00 · Acquaviva` · nessuna icona casa/trasferta.
Se ha `videoUrl`, icona play che apre Titani.TV.

### Bottone
- Primario: `--grad-oro`, testo `--on-accent`, 48px, display 700 uppercase, raggio 12.
- Secondario: outline `--primary`, testo `--primary`.
- Pericolo (Congela giornata): fondo `--negative`, richiede conferma con testo digitato.

### Drawer
Intestazione con gradiente, username oro, e-mail, `LOGOUT` pillola. Sotto: nome lega +
`+`. Poi sezioni con chip titolo (`Setup`, `Gioca`, `Giudice Dati`) e voci con icona
quadrata 32px azzurra.

### Bottom nav
Cinque voci, icona 24 + label 11. Attiva: `--primary` con icona piena; inattive:
`--text-muted` con icona outline. La voce **Voti** porta un badge quando ci sono
punteggi nuovi.

### Bottom sheet
Raggio 20 in alto, maniglia, sfondo `--surface`, ombra `--sh-raise`. Usato per
dettaglio voto, conferma formazione, filtri listone.

## Stati

- **Vuoto**: illustrazione tre torri in outline + una frase + una CTA. Mai solo testo.
- **Caricamento**: skeleton con la stessa geometria della card finale.
- **Errore**: cosa è successo + cosa fare. `Formazione non salvata: il lock è scattato alle
  15:00. Vale l'ultima formazione valida (giornata 11).`
- **Lock**: la formazione bloccata mostra un lucchetto e l'ora del lock; niente campi
  disabilitati grigi, ma card in sola lettura con contorno.

## Motion

- Transizioni 120–220ms; bottom sheet 320ms con easing `--mo-sheet`.
- Il puntino `LIVE` pulsa (2s); il badge Provvisorio non pulsa mai.
- `prefers-reduced-motion`: disattiva pulsazioni e slide, tiene i fade.

## Accessibilità

- Touch target minimo 44px.
- Colore mai unico portatore di significato: i ruoli hanno la lettera, i bonus il segno,
  gli stati l'icona.
- Focus visibile: anello 2px `--primary` con offset 2px.
- Contrasto AA su tutto, AAA sul testo corpo.
