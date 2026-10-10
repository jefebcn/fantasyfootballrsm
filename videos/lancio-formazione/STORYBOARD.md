---
format: 1080x1920
duration: 20s
message: "Arriva il fantacalcio del campionato sammarinese."
arc: Aggancio → Lancio → Prova (telefono, campo, salvata) → Invito
audience: chi gioca gia' al fantacalcio di Serie A, fra San Marino e la Romagna
mode: collaborative
music: assets/audio/musica.wav — elettronica sportiva 120 BPM composta per il video, piena da 0 a 20 s
---

# Lancio Fantatitano: la formazione — storyboard v2

Bozzetti: `storyboard.html` (v1), un fotogramma fermo per scena.

## Decisioni

- **Messaggio:** "Arriva il fantacalcio del campionato sammarinese." — un'affermazione, non un argomento.
- **Pubblico e arco:** chi gioca gia' al fantacalcio di Serie A; aggancio → lancio → prova → invito.
- **Formato:** 1080×1920 (storie Instagram), 20 s, 30 fps; nessuna voce, musica si', niente sottotitoli. Contenuto fra y 250 e y 1580 (fasce coperte dall'interfaccia delle storie).
- **Filo conduttore (spine):** la **linea oro** e la **corona**. La linea nasce come fendente su SERIE A, diventa la sottolineatura del titolo; la corona piccola resta nell'angolo dal primo fotogramma e alla fine scende al centro a diventare il marchio (callback della scena 6 alla scena 1).
- **Brand:** tutto da `frame.md` (Notte e oro; Lato nero corsivo; colori dai token dell'app, contrasti calcolati nella regia).
- **Divieti:** niente interfaccia finta (solo le catture vere di `assets/app`); niente foto di persone; nessuna data ne' giornata a schermo; niente TITO, montepremi, Voto Titano, asta, mercato, Play Store. Due fallimenti di movimento da evitare: la **presentazione** (ogni battuta una scheda nuova, senza testimone) e il **salvaschermo** (movimento che non dice niente).
- **Fotogramma fermo:** la scena 6, da 17,0 a 20,0 s: niente si muove, il marchio e il sito si leggono.
- **Griglia:** 120 BPM, un evento per battito (0,5 s); i giocatori della scena 4 ogni mezzo battito (0,25 s).
- **Blocchi del catalogo da installare prima della costruzione:** `device-frame-stage` (il telefono, scene 3-5), `touch-indicator` (i tocchi), `headline-slam` (lo scuotimento di tre fotogrammi sul taglio), `strikethrough-replace` (base del tratto oro). Il taglio che spacca la parola non esiste nel catalogo: si compone dalle regole (sotto).
- **Audio:** `musica.wav` 0-20 s; `sfx-fendente.wav` a 0,8 s (colpo a 1,0 s); 11 × `sfx-tick.wav` da 9,0 a 11,5 s ogni 0,25 s; `sfx-conferma.wav` a 12,5 s.
- **Verita':** le schermate sono l'app vera (catture del 9/10 con dati di prova, tema scuro); i nomi in campo sono giocatori veri del listone del campionato sammarinese; i personaggi in campo sono le illustrazioni dell'app, non foto.

## Changes from v1

- Alex, dopo la prima anteprima: "i personaggi/giocatori risultano senza faccia" → le finestre dei posti partono 120px piu' in alto, i giocatori si vedono interi.
- Alex: "il fendente deve essere una spada o un altro oggetto per dare maggiore risalto" → una spada (1140px, bagliore oro, contorno scuro) attraversa lo schermo da 0,89 a 1,31 s, punta a meta' schermo a 1,0 s; la scia oro e' la linea di prima; lampo all'impatto.

## Versione 2 (Alex, 9/10: "troppo tempo morto, deve essere un continuo di animazioni, ganci; troppo spoglio")

Regola nuova: **ogni mezzo secondo succede qualcosa, e niente e' mai fermo del tutto.** Il fondo vive per
tutti i 20 s (due fasci di luce da stadio che oscillano, 40 granelli d'oro che salgono, il cerchio di centrocampo
che si allarga); ogni scena ha una spinta lenta di camera; le parole entrano "sbattendo" sul battito o
ricomponendosi da lettere sparse, con scossa e onda d'urto. Cadono le regole v1 "ogni scritta ferma 1,5 s" e
"ultimi 3 s fermi".

| Tempo | Cosa succede |
|---|---|
| 0–2,0 | FANTACALCIO? / SERIE A con spinta lenta; SERIE A trema sempre di piu' (0,5–0,95); spada a 1,0 (lampo, scossa); NON SOLO sbatte a 1,2 con onda; 1,8 i pezzi volano via, NON SOLO ci viene addosso, lampo a 2,0 |
| 2,0–4,75 | ARRIVA (2,0) · IL (2,25) · FANTACALCIO si ricompone (2,42) e atterra con scossa e sottolineatura oro (2,78), onda d'oro sulle lettere; 3,2 il titolo sale e resta come testata; DEL CAMPIONATO entra da destra (3,28); la fascia azzurra si apre e SAMMARINESE si ricompone (3,5); le Tre Torri salgono (3,5); due giocatori dell'app entrano dai lati (3,65/3,78); riflesso sulla fascia; 4,4 tutto si chiude al centro |
| 4,55–6,75 | la pastiglia FANTATITANO spunta con onda e sale (4,82); il telefono entra inclinato (4,82); SCHIERA (5,15) / I TUOI **11** (5,4, l'11 batte con onda); tocco su 4-4-2 (6,0); tuffo nello schermo al 170% (6,42) |
| 6,75–10,75 | tocco sul + (6,9), l'elenco sale come un foglio (7,15), tocco sul nome (7,42); portiere (7,72) e altri dieci ogni 0,25 s (8,0–10,25) con scintille e contatore TITOLARI n/11; la camera spinge piano; 10,3 11/11 batte e piove oro; 10,55 si esce sul telefono |
| 10,75–13,0 | tocco su Conferma (10,98), coriandoli dal pulsante (11,05), spunta (11,1) con onda, FORMAZIONE / SALVATA si ricompongono (11,2/11,4) con scossa, onda d'oro; 12,7 il telefono cade |
| 13,0–15,0 | **nuova:** SFIDA I TUOI AMICI — due pannelli obliqui (blu e azzurro), due giocatori dell'app faccia a faccia, VS che sbatte con lampo e onda (13,25), i due si avvicinano, il VS batte sul tempo; 14,75 la scena ci viene addosso |
| 15,0–20,0 | lampo; la corona vola al centro; raggi che girano; FANTATITANO si ricompone e atterra (15,58); quattro giocatori salgono dietro la corona e ondeggiano; GIOCA GRATIS SU (16,0); pastiglia del sito (16,25) con onda, riflessi a 16,6/17,6/18,6, pulsa sul battito; freccia che indica il pulsante dell'inserzione (16,7); colpo finale a 19,5 |

Audio v2: la musica ha la pausa che sale 14,0–15,0 e la caduta sul marchio a 15,0, l'accento su "salvata" a 11,1;
gli effetti nuovi (colpo, soffio, pop, scintille, coriandoli) sono clip separate in `index.html`. Il file
consegnato e' normalizzato a -14 LUFS (picco -1 dBTP).

Giocatori: le illustrazioni dell'app (`assets/giocatori`, copiate da `media/avatar`), scelte senza marchi sulle maglie.

I fotogrammi qui sotto sono quelli della v1: impaginazioni e testi valgono ancora, i tempi sono quelli della tabella.

## Costruzione

Un solo file (`index.html`), non una sotto-composizione per scena: la corona, la linea oro e il telefono passano da una scena all'altra con passaggi di testimone, e il timeline di una sotto-composizione non puo' muovere gli elementi di un'altra. Tempi costruiti identici al piano; durata finale 20,0 s. GSAP e' nel progetto (`assets/vendor`), niente rete al rendering.

## Locked

Bozzetti v1 confermati da Alex il 9/10: impaginazione, gerarchia e testi delle 6 scene come in `storyboard.html`. La costruzione veste questi fotogrammi, non li ridisegna.

## Frame 1 — Il taglio

- scene: FANTACALCIO? / SERIE A; una spada attraversa lo schermo e spacca SERIE A lasciando la scia oro, sopra diventa NON SOLO
- duration: 3s
- poster: 2.2
- transition_in: cut
- status: animated
- src: index.html
- type: hook
- blueprint: kinetic-type-beats (Adapt — la parola cambia stato in posizione; firma: il taglio)
- rules: chromatic-glitch (forma slice: due bande che si separano e si assestano), headline-slam (registro: scossa di 3 fotogrammi), coordinate-target-zoom (spinta 108%), ambient-glow-bloom + sine-wave-loop (alone che respira)
- on_screen: 0,0 s gia' visibili "FANTACALCIO?" (occhiello 96px #4FA5DE) e "SERIE A" (display 260px bianco), centrati intorno a y 900; corona 64px in alto a sinistra (x 48, y 270)
- motion: 1,0 s fendente oro da sinistra-basso a destra-alto in 0,2 s (power4.out); SERIE A si divide lungo la linea, meta' sopra y −20, meta' sotto y +20 (0,25 s, power3.out); scossa di 3 fotogrammi ±6px; spinta 100→108% e ritorno in 0,5 s; 1,5 s "FANTACALCIO?" → "NON SOLO" oro (taglio netto di parola, sorpasso 6%); i pezzi a opacita' 0,4 entro 2,5 s
- seam_out: la linea oro scivola e si accorcia fino a diventare la sottolineatura di "FANTACALCIO" nella scena 2 (testimone, verso l'alto)
- audio_cue: 0,8 s sfx-fendente (colpo a 1,0 s); la musica esplode a 1,0 s
- constraint: niente glitch RGB colorato: la fenditura e' pulita, oro, una sola
- why: ribalta l'idea "il fantacalcio e' la Serie A" — e' l'aggancio del messaggio

Il primo fotogramma e' gia' l'aggancio ed e' l'anteprima della storia: nessuna entrata da zero.

## Frame 2 — Il lancio

- scene: ARRIVA IL / FANTACALCIO, poi DEL CAMPIONATO / SAMMARINESE, poi la pastiglia FANTATITANO
- duration: 3s
- poster: 2.6
- transition_in: testimone (linea oro)
- status: animated
- src: index.html
- type: product_intro
- blueprint: kinetic-type-beats (Reproduce — "Introducing…" che si risolve sul nome)
- rules: waterfall-entry (le righe arrivano dal basso), scale-swap-transition (il titolo cede il centro alla pastiglia), spring-pop-entrance (la pastiglia)
- on_screen: 3,0-4,5 s "ARRIVA IL / FANTACALCIO" (titolo 150px), linea oro sotto FANTACALCIO; 4,5-6,0 s "DEL CAMPIONATO / SAMMARINESE"; 5,5 s pastiglia blu #3F6ADD "FANTATITANO" sotto
- motion: righe in 8 fotogrammi dal basso (sorpasso 6%), sul battito; a 4,5 s cambio di righe con taglio netto; a 5,5 s pastiglia spring-pop
- seam_out: il titolo si restringe e svanisce; la pastiglia FANTATITANO sale fino a y ~300 e resta sopra il telefono che arriva dal basso
- audio_cue: nessuno oltre la musica
- constraint: niente terza riga insieme alle due: massimo 3 parole per riga, 2 righe
- why: dice il messaggio con le sue parole e mette il nome FANTATITANO accanto al campionato

## Frame 3 — Il telefono

- scene: il telefono sale con la pagina formazione vera (4-4-2, campo vuoto); tocco sul 4-4-2; SCHIERA / I TUOI 11
- duration: 2s
- poster: 1.5
- transition_in: testimone (pastiglia → sopra il telefono)
- status: animated
- src: index.html
- type: feature_showcase
- blueprint: device-surface-showcase (Adapt — cursorless stepwise-flow dentro il telefono tenuto come eroe)
- registry: device-frame-stage, touch-indicator
- rules: spring-pop-entrance (scritta)
- on_screen: telefono 620px centrato, schermo = assets/app/01-campo-vuoto.png; pastiglia FANTATITANO sopra; "SCHIERA / I TUOI 11" (scritta 120px) sopra o sotto il telefono nella fascia sicura
- motion: 6,0 s il telefono sale dal basso (8 fotogrammi, sorpasso 6%); 7,0 s cerchio di tocco sul chip 4-4-2; la scritta arriva a 6,5 s
- seam_out: taglio netto a 8,0 s dentro lo schermo
- audio_cue: nessuno
- constraint: nessuna scheda con data o giornata: lo schermo parte dal titolo "Modulo"
- why: mostra che e' un'app e che la formazione si fa li' — apre la prova

## Frame 4 — Il campo si riempie

- scene: dentro lo schermo al 170%: tocco sul +, elenco portieri, Venturini; poi gli altri 10 nomi entrano uno ogni mezzo battito
- duration: 4s
- poster: 3.4
- transition_in: cut
- status: animated
- src: index.html
- type: feature_showcase
- blueprint: device-surface-showcase (Adapt — schermi che si susseguono nel flusso vero) + grid-card-assemble (Adapt — 11 posti che si riempiono in cascata)
- registry: touch-indicator
- rules: coordinate-target-zoom (ingresso 170% nello schermo, nomi ~34px), spring-pop-entrance (ogni posto che si riempie: maschera sul posto della cattura 04), sine-wave-loop (alone)
- on_screen: 8,0-9,0 s tagli netti sul battito: 01 (tocco sul + del portiere) → 02 (elenco vero dei portieri, tocco su "Venturini G.") → 03 (portiere in campo); 9,0-11,75 s sulla cattura 03 si aprono uno alla volta i posti della cattura 04: Perazzini, Scarcella, Nigretti, Cucchi, Sami, Semprini, Islamaj, Ciacci, Bernardi, Rufer
- motion: ogni posto si apre con un pop 0→1 (6 fotogrammi, sorpasso 6%) sul suo mezzo battito; l'inquadratura resta ferma al 170% mentre il campo si riempie
- seam_out: a 11,75-12,0 s l'inquadratura esce dallo schermo (170→100%) verso il telefono intero, gia' scorso sul pulsante di conferma
- audio_cue: 11 tick a 9,0 · 9,25 · … · 11,5 s (anche quello del portiere)
- constraint: niente testo sovrapposto: parla il campo; niente zoom oltre il 170% (i personaggi illustrati si sgranano)
- why: e' la svolta — si vede che fare la formazione e' facile

## Frame 5 — Salvata

- scene: il telefono intero sul pulsante vero CONFERMA FORMAZIONE · 11/11; tocco; FORMAZIONE / SALVATA con la spunta oro
- duration: 3s
- poster: 2.2
- transition_in: cut
- status: animated
- src: index.html
- type: benefit_highlight
- blueprint: device-surface-showcase (Adapt — il flusso si chiude sul successo)
- registry: device-frame-stage, touch-indicator
- rules: press-release-spring (il pulsante sotto il tocco), spring-pop-entrance (spunta e scritta), coordinate-target-zoom (spinta 108%)
- on_screen: telefono 620px con assets/app/05-conferma.png; 12,5 s tocco sul pulsante giallo; "FORMAZIONE / SALVATA" (scritta 120px) + spunta oro 140px sopra il telefono; l'avviso dell'app con la giornata (06) mai visibile
- motion: 12,5 s pressione del pulsante (0,1 s giu', molla su), spinta 100→108%; 12,6 s spunta spring-pop, scritta in 8 fotogrammi; ferma fino a 15,0 s
- seam_out: dal 14,5 s il telefono si allontana e rimpicciolisce verso il basso mentre la corona piccola dell'angolo comincia a scendere verso il centro (testimone alla scena 6)
- audio_cue: 12,5 s sfx-conferma; accento della musica a 12,5 s
- constraint: nessuna giornata ne' data a schermo; niente coriandoli (la regia non li ha chiesti)
- why: chiude la prova — sei in gioco

## Frame 6 — Marchio e sito

- scene: la corona grande al centro, FANTATITANO, GIOCA GRATIS SU, la pastiglia oro fantatitano.site; fermo dagli ultimi 3 s
- duration: 5s
- poster: 4.0
- transition_in: testimone (la corona dell'angolo scende al centro)
- status: animated
- src: index.html
- type: cta
- blueprint: logo-assemble-lockup (Adapt — il marchio gia' esistente si assesta al centro e si estende al sito) + titlecard-reveal (la tenuta finale)
- rules: nudge-curve (il viaggio della corona), spring-pop-entrance (pastiglia del sito), waterfall-entry (FANTATITANO, GIOCA GRATIS SU)
- on_screen: corona 360px centrata intorno a y 640; "FANTATITANO" (marchio 150px bianco) sotto; "GIOCA GRATIS SU" (etichetta 54px #4FA5DE); pastiglia oro #FFC94D "fantatitano.site" (#0D1733); tutto fra y 450 e y 1450
- motion: 15,0-15,5 s la corona arriva al centro e cresce (nudge-curve); 15,5 s FANTATITANO; 16,0 s etichetta; 16,5 s pastiglia; da 17,0 s tutto fermo (anche l'alone smette di respirare)
- seam_out: fine — l'ultimo fotogramma e' la locandina
- audio_cue: 15,0 s un battito senza cassa; 19,5 s colpo finale
- constraint: niente movimento dopo 17,0 s; niente elementi sotto y 1580 (pulsante "Scopri di più")
- why: lascia il nome da ricordare e il sito da aprire — l'unica azione chiesta

Totale: 3 + 3 + 2 + 4 + 3 + 5 = 20 s.
