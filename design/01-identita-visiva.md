# 01 — Identità visiva

## Da dove parte

Leghe Fantacalcio funziona perché è **immediata**: header blu saturo, un'unica famiglia
tipografica arrotondata, card bianche su fondo grigio-azzurro, un solo accento caldo (il
giallo) riservato a Premium e CTA. Teniamo integralmente questa grammatica.

Cambiamo il **cromatismo** e il **lessico**: non siamo una copia della Serie A, siamo il
campionato del Titano.

## Palette: perché questi colori

| Nome | Hex | Origine | Uso |
|---|---|---|---|
| **Azzurro Titano** | `#1B84C6` | L'azzurro della bandiera sammarinese (`#5EB6E4`) saturato di un passo per reggere testo bianco AA | Primario: app bar, bottom nav attiva, link, chip attivi |
| **Blu Notte** | `#072F4C` | Fondo profondo dell'hero, come il fondo notturno dello stadio nell'app italiana | Hero maglia, fondi scuri, testo su chiaro (variante 900) |
| **Oro Corona** | `#E5A11B` | La corona dello stemma; sostituisce il giallo `#FFC72C` di Leghe Fantacalcio con una tinta più calda e meno "avviso" | CTA principale, badge capitano, Premium, medaglie |
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

Leghe Fantacalcio usa un'unica grottesca arrotondata. Noi separiamo i ruoli per dare
carattere senza rumore:

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

## Cosa si tiene, cosa si cambia rispetto a Leghe Fantacalcio

| Leghe Fantacalcio | Fantacampionato Sammarinese | Perché |
|---|---|---|
| Header blu royal `#2C64F6` | Azzurro Titano `#1B84C6` → `#1173B0` | Identità nazionale, non Serie A |
| CTA "PASSA A PREMIUM" gialla | CTA "SCHIERA LA FORMAZIONE" oro | Non c'è premium al primo anno; lo slot serve all'azione settimanale |
| Loghi Fantacalcio + Serie A sotto la maglia | Tre torri + "Titani.TV" | Fonte video ufficiale, e niente loghi non autorizzati |
| Stat: Posizione · Punti · Partite · Pt. Totali | Posizione · Punti · Partite · **Fantapunti** | Termine del regolamento (art. 12.2) |
| "Live in corso" | "Live in corso" + **badge stato dato** | Provvisorio / Congelato sempre a vista |
| Bottom bar: Dashboard · Squadre · Calendario · Classifica · Video | Dashboard · **Rosa** · Calendario · Classifica · **Voti** | "Voti" è la vista pubblica settimanale del Voto Titano (priorità 3 del README) |
| Drawer: Setup / Gioca / Gestione | Setup / Gioca / **Giudice Dati** | La sezione admin diventa la sala di data entry |
| Voce "Calcolo giornata" | "Inserisci eventi" · "Punteggi provvisori" · "Congela giornata" | Il ciclo settimanale in tre azioni |
| Voce "Infermeria" | "Fuori dal campionato" | Art. 3.3: chi lascia il campionato, non chi è infortunato (dato non disponibile) |
| Banner sponsor | Card "Contestazioni aperte fino a martedì 18:00" | Lo spazio va alla regola, non alla pubblicità |
