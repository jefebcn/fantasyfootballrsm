---
version: alpha
name: Fantatitano · Notte e oro — Frame (storie 9:16)
description: >
  Il look del video di lancio di Fantatitano, direzione A "Notte e oro" scelta nella regia
  (regia/lancio-formazione/direzioni.html). Fondo blu notte con alone, testo bianco in Lato
  nero corsivo maiuscolo, l'oro solo per l'accento (il taglio, l'invito finale), pastiglie blu.
  E' lo stile dell'app Fantatitano di oggi: chi tocca l'inserzione ritrova lo stesso mondo.
unit: il fotogramma — 1080×1920 (storie Instagram)
principle: il brand e' sacro · la composizione e' libera · ogni testo al massimo 3 parole per riga, 2 righe, ogni riga entro 936px

colors:
  fondo: "#0D1733"          # blu notte, il fondo di ogni scena
  alone: "#21397F"          # l'alone radiale dietro al testo, che respira
  inchiostro: "#FFFFFF"     # tutto il testo principale (17,7:1 sul fondo)
  oro: "#FFC94D"            # SOLO accento: il fendente, NON SOLO, la pastiglia del sito, la spunta di "salvata" (11,6:1 sul fondo)
  testo-su-oro: "#0D1733"   # il testo dentro la pastiglia oro (11,6:1)
  pastiglia: "#3F6ADD"      # pastiglie blu, testo bianco sopra (4,9:1)
  occhiello: "#4FA5DE"      # occhielli: FANTACALCIO?, GIOCA GRATIS SU (6,5:1 sul fondo)
  oro-luce: "#FFF4D6"       # il filo di luce dentro il fendente
  cornice-telefono: "#05080F"

typography:
  # Lato e' il carattere dell'app ed e' obbligatorio, anche se la lista dei caratteri
  # "generici" di HyperFrames lo sconsiglia: qui il brand vince. Incorporato da assets/font
  # con @font-face (HyperFrames ha il Lato solo dritto; il corsivo 900 e' nostro).
  display:   { fontFamily: "Lato", weight: 900, style: italic, px: 260, lineHeight: 0.9, tracking: "-0.01em", upper: true }   # SERIE A
  titolo:    { fontFamily: "Lato", weight: 900, style: italic, px: 150, lineHeight: 0.95, tracking: "0", upper: true }       # ARRIVA IL / FANTACALCIO; "DEL CAMPIONATO / SAMMARINESE" a 112px (misurata: a 150px esce dai 936px utili)
  marchio:   { fontFamily: "Lato", weight: 900, style: italic, px: 146, lineHeight: 1.0, upper: true }                      # FANTATITANO (146px: la larghezza massima nei 936px utili)
  scritta:   { fontFamily: "Lato", weight: 900, style: italic, px: 120, lineHeight: 0.95, upper: true }                     # SCHIERA / I TUOI 11 · FORMAZIONE / SALVATA
  occhiello: { fontFamily: "Lato", weight: 900, style: italic, px: 96, lineHeight: 1.0, upper: true }                       # FANTACALCIO? · NON SOLO
  etichetta: { fontFamily: "Lato", weight: 900, style: italic, px: 54, tracking: "0.04em", upper: true }                    # GIOCA GRATIS SU
  pastiglia: { fontFamily: "Lato", weight: 900, style: italic, px: 64, tracking: "0.02em", upper: false }                   # fantatitano.site · FANTATITANO
  font-face:
    - { weight: 400, style: normal, src: "assets/font/lato-400-latin.woff2" }
    - { weight: 700, style: normal, src: "assets/font/lato-700-latin.woff2" }
    - { weight: 900, style: normal, src: "assets/font/lato-900-latin.woff2" }
    - { weight: 900, style: italic, src: "assets/font/lato-900i-latin.woff2" }

spacing:
  safe-top: "250px"        # coperto dall'interfaccia delle storie (nome, barra di avanzamento)
  safe-bottom: "340px"     # coperto dal pulsante "Scopri di più" dell'inserzione
  pad-x: "72px"
  gap-lg: "48px"
  gap-md: "28px"
  gap-sm: "14px"

components:
  sfondo:
    background: "radial-gradient(120% 70% at 50% 45%, {colors.alone} 0%, {colors.fondo} 62%)"
    description: "Lo stesso in tutte le scene. L'alone respira: scala 100%→104%→100% su 4 battiti (2 s), sempre."
  corona-cornice:
    src: "assets/brand/corona-bianca.png"
    size: "64px di larghezza"
    opacity: 0.85
    placement: "x 48px, y 270px (subito sotto la fascia coperta), per tutto il video fino a 15,0 s"
    description: "La cornice (5.3 B). A 15,0 s scende al centro e diventa la corona grande del marchio."
  corona-marchio:
    src: "assets/brand/corona-bianca.png"
    size: "360px di larghezza"
    description: "La corona grande della scena 6, sopra FANTATITANO."
  spada:
    shape: "spada disegnata in SVG, lunga 1140px: lama {colors.oro-luce} con filo {colors.inchiostro}, contorno {colors.fondo}, scanalatura {colors.oro}; guardia e pomo {colors.oro}; impugnatura {colors.alone}"
    glow: "drop-shadow 0 0 16px oro al 70%"
    description: "Richiesta di Alex dopo la prima anteprima (9/10): il fendente diventa una spada che attraversa lo schermo in 0,42 s (punta a meta' schermo a 1,0 s) con due copie in ritardo per la scia di velocita' e un lampo all'impatto. La sua scia e' il fendente qui sotto."
  fendente:
    stroke: "{colors.oro} 18px, con filo {colors.oro-luce} 4px al centro, estremi tondi"
    angle: "da sinistra-basso a destra-alto, circa -9°, piu' largo della parola"
    description: "Il taglio su SERIE A (5.1 bis): attraversa in 0,2 s; la parola si spezza lungo la linea, metà sopra +20px su, metà sotto 20px giu', poi i pezzi al 40%."
  telefono:
    frame: "rettangolo arrotondato raggio 64px, cornice {colors.cornice-telefono} 14px, ombra morbida 0 40px 80px rgba(0,0,0,.45)"
    width: "620px (scene 3 e 5)"
    screen: "le schermate vere di assets/app (1170×2532), a filo dello schermo"
    description: "Una sagoma sobria, senza notch disegnati ne' tasti: dice 'e' un'app' e basta."
  tocco:
    shape: "cerchio bianco 120px, 30% di opacita', che si allarga a 160px e sparisce in 0,3 s"
    description: "Dove l'utente tocca lo schermo: modulo 4-4-2, il + del portiere, un nome, Conferma."
  pastiglia-blu:
    background: "{colors.pastiglia}"
    color: "{colors.inchiostro}"
    typography: "{typography.pastiglia}"
    radius: "999px"
    padding: "22px 44px"
  pastiglia-oro:
    background: "{colors.oro}"
    color: "{colors.testo-su-oro}"
    typography: "{typography.pastiglia}"
    radius: "999px"
    padding: "26px 56px"
  spunta-salvata:
    shape: "cerchio {colors.oro} 140px con spunta {colors.testo-su-oro}"
    description: "Accanto a FORMAZIONE SALVATA."
---

# Fantatitano · Notte e oro — Frame

## Overview

Un manifesto sportivo scuro: blu notte con un alone che respira, scritte enormi in Lato nero
corsivo maiuscolo, l'oro usato con parsimonia come un evidenziatore. Il video lancia il
fantacalcio del campionato sammarinese e lo prova mostrando l'app vera: le schermate reali
dentro un telefono sobrio, i nomi veri dei giocatori.

## The Frame

- 1080×1920, 30 fps. Tutto il contenuto che conta sta fra y 250 e y 1580 (fuori ci sono
  l'interfaccia delle storie e il pulsante dell'inserzione), con 72px ai lati.
- Il primo fotogramma e' gia' l'aggancio (FANTACALCIO? / SERIE A): e' anche l'anteprima della storia.

## Composition Rules

### Do

- Una sola cosa protagonista per scena; il resto fermo o spento.
- Testo al massimo 3 parole per riga e 2 righe insieme; nomi sempre uguali: FANTATITANO,
  campionato sammarinese, formazione, fantatitano.site (minuscolo).
- L'oro solo dove c'e' un accento: il fendente, NON SOLO, la spunta di "salvata", la pastiglia del sito.
- Le schermate dell'app sono vere (assets/app): si ingrandiscono e si ritagliano, non si ridisegnano.
- Quando si legge il campo (scena 4) si entra nello schermo fino al 170%: i nomi arrivano a ~34px.

### Don't

- Nessuna data e nessuna giornata a schermo (l'inserzione gira per settimane): non mostrare la
  scheda in cima alla pagina della formazione ne' l'avviso "Formazione salvata · giornata 6"
  (06-salvata-toast.png: coprirlo o non usarlo).
- Niente foto di persone: in campo ci sono i personaggi illustrati dell'app, va bene; nessuna foto vera.
- Niente TITO, niente montepremi, niente Voto Titano, asta o mercato.
- Mai l'oro come testo sul blu delle pastiglie; mai testo sotto 4,5:1 di contrasto.
- Niente contenuto nelle fasce coperte (sopra y 250, sotto y 1580).

## Motion

- **Griglia:** 120 BPM, un evento per battito (0,5 s); 40 battiti in 20 s. Dentro la scena 4 i
  giocatori entrano ogni mezzo battito (0,25 s).
- **Entrate:** 8 fotogrammi (0,27 s a 30 fps), arresto netto con sorpasso del 6% (es. back.out
  leggero), poi fermo. Ogni scritta resta ferma almeno 1,5 s.
- **Quiete:** mentre si muove il protagonista, il resto e' fermo; solo l'alone del fondo respira
  (100%→104% su 2 s, avanti e indietro, per tutto il video).
- **Passaggi:** passaggio di testimone fra le parti (i pezzi di SERIE A → la linea oro diventa la
  sottolineatura del titolo; il titolo → la pastiglia FANTATITANO sopra il telefono; il telefono →
  la corona del marchio). Dentro la prova (scene 3-4) tagli netti sul battito.
- **Camera:** ferma, con due spinte al 108% (sul taglio a 1,0 s, su "salvata" a 12,5 s); la
  terza spinta, sul campo che si riempie, e' diventata l'ingresso nello schermo al 170% della
  scena 4 (decisione C.1).
- **Il taglio (1,0 s):** fendente 0,2 s; spaccatura ±20px; tremolio dello schermo 0,15 s
  (±6px, 3 scosse); pezzi al 40% entro 1,5 s.
- **Tutto fermo** negli ultimi 3 secondi (17,0-20,0 s).
