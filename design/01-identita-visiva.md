# 01 — Identità visiva

## Da dove parte

Un'app che si apre una volta a settimana deve essere **immediata**: un'intestazione di
colore pieno, card chiare su un fondo neutro, un solo accento caldo riservato all'azione
della settimana (schierare la formazione). Il colore e il lessico vengono dal Titano:
la bandiera, le torri, la pietra del Monte, e le parole del regolamento.

## Palette: perché questi colori

| Nome | Hex | Origine | Uso |
|---|---|---|---|
| **Azzurro Titano** | `#1B84C6` | L'azzurro della bandiera sammarinese (`#5EB6E4`) saturato di un passo per reggere testo bianco AA | Primario: app bar, bottom nav attiva, link, chip attivi |
| **Blu Notte** | `#072F4C` | Il cielo sopra il Titano la sera delle partite | Hero maglia, fondi scuri, testo su chiaro (variante 900) |
| **Oro Corona** | `#E5A11B` | La corona dello stemma: una tinta calda, che non sembra un avviso | CTA principale, badge capitano, medaglie |
| **Verde Alloro** | `#1E9E6A` | Il ramo d'alloro dello stemma | Live in corso, bonus positivi, porta inviolata |
| **Rosso Cartellino** | `#CE3B3B` | — | Malus, espulsioni, errori |
| **Ambra** | `#D98A15` | — | **Dato provvisorio**, finestra contestazioni aperta |
| **Pietra** | `#EEF2F7` → `#0C2C45` | La pietra del Monte Titano; neutro con bias azzurro, mai grigio puro | Fondi, bordi, testo |

### Regole d'uso

- Un solo accento caldo per schermata. L'oro compete con l'ambra: dove c'è un badge
  `PROVVISORIO`, la CTA oro va sotto la piega o diventa outline.
- Il verde è **stato**, non accento: non usarlo mai per bottoni.
- I ruoli di listone hanno colore fisso in tutta l'app: **P** oro, **D** verde, **C** azzurro,
  **A** rosso. Stessa scala cromatica dei bonus: chi vede il chip impara il peso del gol.

## Tipografia

Tre famiglie, ognuna col suo compito, per dare carattere senza rumore:

| Ruolo | Famiglia | Perché |
|---|---|---|
| Display / numeri | **Archivo** 700–800 | Condensata, sportiva, con cifre tabulari nette per punteggi e classifiche |
| Corpo / UI | **Asap** 400–600 | Umanista compatta, ottima leggibilità a 13–15px su mobile |
| Dato tecnico | **IBM Plex Mono** 500 | Minuti, codici evento, breakdown del voto: dove il numero deve allinearsi al centesimo |

Tutte da Google Fonts, con fallback di sistema dichiarato.

## Simbolo

Le **tre torri** (Guaita, Cesta, Montale) stilizzate in tre rettangoli merlati di altezza
crescente, con la penna sulla cima. Funziona a 16px come favicon e a 200px come
watermark nell'hero. Niente stemma ufficiale: l'art. 14.2 richiede autorizzazione per loghi
e denominazioni, il simbolo delle torri è nostro.

## Scelte di prodotto che si vedono nell'interfaccia

| Elemento | Scelta | Perché |
|---|---|---|
| Intestazione | Azzurro Titano `#1B84C6` → `#1173B0` | Identità nazionale |
| Bottone principale | «SCHIERA LA FORMAZIONE» in oro | È l'azione della settimana |
| Sotto la maglia | Tre torri + «Titani.TV» | Fonte video ufficiale; nessun logo senza autorizzazione |
| Statistiche squadra | Posizione · Punti · Partite · **Fantapunti** | Termine del regolamento (art. 12.2) |
| Giornata in corso | «Live in corso» + **badge stato dato** | Provvisorio / Congelato sempre a vista |
| Barra in basso | Dashboard · Rosa · Calendario · Classifica · **Voti** | «Voti» è la vista pubblica settimanale del Voto Titano |
| Area del Giudice Dati | «Inserisci eventi» · «Punteggi provvisori» · «Congela giornata» | Il ciclo settimanale in tre azioni |
| Giocatori usciti | «Fuori dal campionato» | Art. 3.3: chi lascia il campionato (l'infermeria non ha dati) |
| Spazio in Home | Card «Contestazioni aperte fino a martedì 18:00» | Lo spazio va alla regola |
