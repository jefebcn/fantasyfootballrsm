---
workflow: general-video
flow: automation
storyboard: yes
message: "Arriva il fantacalcio del campionato sammarinese."
destination: instagram-stories-ad
aspect: 1080x1920
language: it
audience: "chi gioca gia' al fantacalcio di Serie A, fra San Marino e la Romagna"
length: 20s
---

## Intent

Un'inserzione di 20 secondi per le storie di Instagram che lancia Fantatitano, il fantacalcio
del campionato sammarinese, e lo prova facendo vedere l'inserimento della formazione nell'app
vera. Risponde alla domanda di chi guarda: "Esiste un fantacalcio sul campionato di San
Marino?". L'aggancio ribalta una convinzione diffusa: "Fantacalcio? Non solo Serie A."

Chi guarda gioca gia' al fantacalcio sulla Serie A, fra San Marino e la Romagna: sa cos'e' il
gioco, non sa che esiste anche sul campionato sammarinese. Dopo il video deve fare una cosa
sola: aprire `fantatitano.site` e registrarsi (funziona su iPhone e Android; l'app sul Play
Store e' in attesa di approvazione e non si nomina). Tono: energia da pre-partita, sportivo,
deciso; deve funzionare anche a volume spento.

## Assets

- assets/app/01-campo-vuoto.png — la pagina formazione vera (1170×2532, tema scuro) dal titolo "Modulo" in giu': moduli con 4-4-2 attivo, campo vuoto. Scena 3.
- assets/app/02-elenco-portieri.png — il foglio "Scegli portieri" aperto sopra il campo, con i portieri veri (Venturini G., Angelis M., Zavoli M.). Scena 4, il primo tocco.
- assets/app/03-campo-portiere.png — il campo con il solo portiere (Venturini) schierato. Scena 4.
- assets/app/04-campo-pieno.png — il campo pieno, 4-4-2 con 11 nomi veri: Venturini; Perazzini, Scarcella, Nigretti, Cucchi; Sami, Semprini, Islamaj, Ciacci; Bernardi, Rufer. Scena 4 (svolta) e base della scena 5.
- assets/app/05-conferma.png — la parte bassa della pagina con il pulsante giallo vero "CONFERMA FORMAZIONE · 11/11". Scena 5, il tocco.
- assets/app/06-salvata-toast.png — dopo il tocco: l'avviso dell'app "Formazione salvata · giornata 6". NON mostrare l'avviso (dice la giornata): usarla solo sotto la scritta FORMAZIONE SALVATA, coprendolo.
- assets/app/07-dopo-salvata.png, assets/app/00-formazione-pagina.png — di riserva (la seconda contiene la scheda con giornata e data: non mostrarla).
- assets/brand/corona-bianca.png — la corona di Fantatitano, bianca su trasparente (763×662): cornice piccola e marchio finale.
- assets/brand/corona-oro.png — la stessa corona in oro, se serve un accento.
- assets/font/lato-*.woff2 — Lato 400, 700, 900 e 900 corsivo: il carattere dell'app, da incorporare con @font-face (vedi frame.md).
- assets/audio/musica.wav — la musica, 20,0 s, 120 BPM, composta per questo video (nessun diritto da verificare), a -14,9 LUFS: parte a 0,0 s e dura tutto il video. Esplosione a 1,0 s, accento a 12,5 s, un battito senza cassa a 15,0 s, colpo finale a 19,5 s.
- assets/audio/sfx-fendente.wav — soffio + colpo basso (0,8 s); il colpo e' a 0,2 s del file: farlo partire a 0,8 s del video, cosi' il colpo cade a 1,0 s sul taglio.
- assets/audio/sfx-tick.wav — clic breve (30 ms) per ogni giocatore che entra in campo nella scena 4.
- assets/audio/sfx-conferma.wav — due note che salgono (0,25 s) a 12,5 s, su "salvata".

## Customizations

- **Voce:** nessuna. Parlano solo le scritte.
- **Testo a schermo:** parole-ancora, al massimo 3 parole per riga e 2 righe insieme.
- **Nomi, sempre uguali:** FANTATITANO (il gioco), campionato sammarinese (mai "Serie A sammarinese" ne' "campionato di San Marino"), formazione (mai "squadra" o "line-up"), fantatitano.site (sempre minuscolo).
- **Musica:** assets/audio/musica.wav da 0,0 a 20,0 s, volume pieno (gia' normalizzata); nessuna altra musica.
- **Effetti sonori:** fendente a 0,8 s (colpo a 1,0 s); 11 tick a 9,0 · 9,25 · 9,5 · 9,75 · 10,0 · 10,25 · 10,5 · 10,75 · 11,0 · 11,25 · 11,5 s, uno per ogni nome che entra; conferma a 12,5 s. Volume degli effetti un po' sopra la musica.
- **Sottotitoli:** no (non c'e' voce).

## Notes

**Arco** (decisione 4.1, ritoccata con C.2): 0-3 s aggancio · 3-6 s lancio · 6-15 s prova · 15-20 s invito.

### Scene

Scene, ordine, durate e consegne sono confermate, lo storyboard le sviluppa.

Fondo di tutte le scene: #0D1733 con l'alone #21397F che respira. La corona piccola resta in alto a sinistra (x 48, y 270, 64px, bianca all'85%) da 0,0 a 15,0 s.

1. **Il taglio** — 0,0-3,0 s. *Idea:* il fantacalcio non e' solo la Serie A. *Protagonista:* "SERIE A" enorme (display 260px), bianco nero corsivo, gia' visibile dal primo fotogramma; sopra l'occhiello "FANTACALCIO?" in #4FA5DE. A 1,0 s il fendente oro taglia "SERIE A" in 0,2 s: la parola si spacca (metà sopra +20px su, metà sotto 20px giu'), lo schermo trema 0,15 s, spinta al 108%; suono: fendente con impatto, esplode la musica. A 1,5 s "FANTACALCIO?" diventa "NON SOLO" in oro; i pezzi di SERIE A si spengono al 40%. *Testo:* FANTACALCIO? / SERIE A → NON SOLO / SERIE A. *Uscita:* i pezzi spariscono e la linea oro del taglio scorre fino a diventare la sottolineatura del titolo della scena 2. *Dopo questa scena chi guarda sa dire:* "C'e' un fantacalcio che non e' la Serie A."
2. **Il lancio** — 3,0-6,0 s. *Idea:* e' arrivato quello del campionato sammarinese. *Protagonista:* il titolo in due battute (titolo 150px): a 3,0 s "ARRIVA IL / FANTACALCIO" con la linea oro sotto; a 4,5 s "DEL CAMPIONATO / SAMMARINESE"; a 5,5 s la pastiglia blu #3F6ADD "FANTATITANO". *Uscita:* il titolo si stringe e se ne va, la pastiglia FANTATITANO resta e sale sopra il telefono che arriva. *Dopo:* "Si chiama Fantatitano ed e' sul campionato sammarinese."
3. **Il telefono** — 6,0-8,0 s. *Idea:* e' un'app, e la formazione si fa li'. *Protagonista:* il telefono (620px) sale dal basso con assets/app/01-campo-vuoto.png (moduli e campo vuoto; nessuna data). A 7,0 s il cerchio di tocco sul modulo "4-4-2". *Testo:* SCHIERA / I TUOI 11. *Uscita:* taglio netto sul campo. *Dopo:* "La formazione si fa dal telefono."
4. **Il campo si riempie** — 8,0-12,0 s. *Idea:* e' facile (la svolta). *Protagonista:* il campo, con l'inquadratura che entra nello schermo fino al 170% (nomi leggibili, ~34px; il telefono esce di quadro). 8,0-9,0 s un giocatore per intero, tagli netti sul battito: tocco sul + del portiere (01) → elenco vero (02) → tocco su "Venturini G." → portiere in campo (03). 9,0-11,75 s gli altri posti si riempiono uno ogni mezzo battito fino al campo pieno (04), nomi veri, nessuna foto; un tick per nome. *Testo:* nessuno, parla il campo. *Uscita:* a campo pieno si torna fuori dallo schermo verso il pulsante di conferma (05). *Dopo:* "Bastano pochi tocchi per fare la formazione."
5. **Salvata** — 12,0-15,0 s. *Idea:* fatto, sei in gioco. *Protagonista:* il telefono di nuovo intero; a 12,5 s il tocco sul pulsante vero "CONFERMA FORMAZIONE · 11/11" (05) e sopra entra la scritta grande con la spunta oro, spinta al 108%; suono: conferma + accento della musica. L'avviso dell'app con la giornata non si vede. *Testo:* FORMAZIONE / SALVATA, ferma fino a 15,0 s. *Uscita:* il telefono si allontana e si rimpicciolisce mentre la corona piccola dell'angolo scende al centro. *Dopo:* "Ho fatto la mia formazione."
6. **Marchio e sito** — 15,0-20,0 s. *Idea:* ricordati il nome, apri il sito. *Protagonista:* la corona grande al centro (360px); sotto "FANTATITANO" (marchio 150px, bianco); sotto "GIOCA GRATIS SU" (etichetta #4FA5DE) e "fantatitano.site" nella pastiglia oro #FFC94D con testo #0D1733. Tutto fermo da 17,0 s. La musica: un battito di respiro a 15,0 s, poi riparte e chiude con il colpo a 19,5 s. *Testo:* FANTATITANO · GIOCA GRATIS SU · fantatitano.site. *Uscita:* fine (sotto c'e' il pulsante "Scopri di più" di Instagram). *Dopo:* "Si chiama Fantatitano, si gioca su fantatitano.site."

Totale: 3 + 3 + 2 + 4 + 3 + 5 = 20 s. Se Instagram divide la storia intorno ai 15 s, la seconda scheda e' la scena 6 intera.

**Modifiche dopo la prima anteprima (Alex, 9/10):** (1) i giocatori della scena 4 si vedono interi, testa compresa (le finestre dei posti erano tagliate sul riquadro del posto); (2) il fendente diventa una **spada** che attraversa lo schermo e taglia SERIE A, con lampo all'impatto e la scia oro che resta.

**Riferimento** (3.3): SkillBol — se ne prendono la tipografia nero corsivo maiuscolo, le schede scure e le pastiglie piene; e' lo stile che l'app Fantatitano ha gia' adottato. Niente loro parole, colori o personaggi.

**Tagli** (fatti veri che restano fuori): Voto Titano e referti, lega pubblica e montepremi, asta e mercato, la guida e la mascotte TITO, il Play Store.

**Effetti esclusi:** nessuno per nome (decisione 5.4 C): li sceglie il workflow, dentro le regole di frame.md.

**Decisioni delegate** (riempite dalla regia, confermate nel foglio): la composizione della musica (D.1) e degli effetti (D.2), generate con regia/lancio-formazione/suono/genera-suono.py; la corona piccola bianca all'85%, 64px, x 48 y 270 (D.3); il Lato corsivo 900 incorporato dai file dell'app (D.4); le schermate catturate dall'app vera con il tema scuro, senza giornata ne' data (D.5).

**Registro della regia:** regia/lancio-formazione/direzioni.html (le tre direzioni, vince la A) e regia/lancio-formazione/taglio.html (il taglio, vince la B).
