# Collaborazione con Il Pianello

Il Pianello: sito di notizie e pagina Instagram di Romagna, Italia e San Marino (circa 14 mila follower, profilo verificato). Questo file è il punto di partenza per ogni chat sulla collaborazione, anche fuori da Claude Code.
- Nel repo: `docs/PIANELLO.md`.
- Online: `https://github.com/jefebcn/fantasyfootballrsm/blob/main/docs/PIANELLO.md`.
- Copia in Google Drive: cartella «Fantatitano – Il Pianello» (https://drive.google.com/drive/folders/1iNTOYfv6SSUS9SxuizjtYSnQRJsH7zic, visibile solo ad Alex), con il documento «LEGGIMI – Il Pianello».

## A che punto siamo (27/11/2026, sera)
1. **26/11:** Alex scrive in DM per proporre una collaborazione e chiedere i costi.
2. **27/11, risposta:** se il progetto è gratuito, lo promuovono gratis. Consigliano di presentare una **notizia** («parte il futsal il giorno X», «conta già Y utenti») e non il progetto in sé.
3. **27/11, seconda risposta:** «rimaniamo d'accordo così». In più offrono **uno spazio sul loro sito** per pagelle o valutazioni sul campionato, perché loro lo sport non lo trattano.
4. **27/11:** Alex chiede quale formato preferiscono e si dice disponibile per lo spazio sul sito.
5. **27/11, risposta:** per i loro social vogliono **un post sul feed principale** («è il formato che funziona di più»). Per gli **articoli sul sito ci danno carta bianca**: argomenti scelti da noi.

## Prossimi passi
1. Mandare l'immagine del post (`pianello-post-1080x1350.jpg`) e la didascalia (`social/pianello/didascalia-post.txt`), con la richiesta di pubblicare martedì 1/12 in mattinata, dopo le 8.
2. **Dopo la 10ª giornata del calcio:** primo articolo per il loro sito, la rubrica settimanale (Top 11, migliori, curiosità; un'immagine più un testo breve). Il testo della notizia FantaFutsal (`notizia.txt`) può diventare un articolo anche lui, se lo vogliono.
3. Fissare con loro giorno (proposta: martedì, dopo i referti del weekend), formato e lunghezza della rubrica, e scriverli qui.

## Regole decise da Alex (valgono per tutto il materiale per Il Pianello)
- **Mai scrivere «FSGC»**, né nel testo né nelle immagini (anche nelle schermate dell'app). Al suo posto: «referti ufficiali delle partite».
- **Mai scrivere l'orario di apertura** («alle 8»): solo «dal 1° dicembre» e «da martedì». Solo nel messaggio privato si chiede di pubblicare dopo le 8.
- **Corona del lancio:** metà viola Fantatitano e metà arancio futsal, la stessa dell'app dal 1° al 14/12 (`src/lancio-futsal.js`). È il disegno originale: cambiano solo i colori.
- **Gratuità:** scrivere «gratuito per tutti». Non scrivere «senza scopo di lucro» e non promettere che resterà gratis per sempre.
- **Niente immagini IA e niente nomi di giocatori:** solo schermate vere dell'app, con dati di prova.
- **Non scrivere «il primo fantacalcio»**: non si può dimostrare.
- **Store:** solo «iPhone dall'App Store e dal browser», perché Android non è ancora pubblico.
- **Link nei testi** (27/11): `fantatitano.site/link`, la pagina con tutti i link (la stessa della bio Instagram), non solo `fantatitano.site`.
- **Iscritti:** il numero va preso dal database il giorno stesso (27/11: 283 account, 20 leghe, cioè «quasi 300»).
- Restano valide anche le regole di sempre di `CLAUDE.md`: non citare le app a cui ci ispiriamo, niente parole da scommessa, niente provocazioni.

## Come scrivono loro (modello: articolo su «San Marino Drift & Sun», 25/11/2026)
- Articolo di circa 2 minuti di lettura, con tre intertitoli e un tono leggero, in prima persona.
- Il link al gioco compare due volte nel testo. In fondo c'è un riquadro: «Gioca gratis a… / Dal browser, su computer e telefono / Vai al gioco →».
- Una sola copertina 16:9 (la caricano a 1536×864). Nessuna scritta tipo «sponsorizzato».
- Su Instagram hanno fatto un post e una storia.

## Materiale (in `social/pianello/`)
| File | Cosa |
|---|---|
| `notizia.txt` | testo della notizia FantaFutsal: titolo, sottotitolo, intertitoli, una frase facoltativa di Alex, riquadro finale |
| `messaggio.txt` | prima bozza del messaggio col materiale (superata: hanno chiesto solo il post) |
| `didascalia-post.txt` | didascalia per il loro post sul feed |
| `pianello-post-1080x1350.jpg` | post Instagram |
| `pianello-sito-1200x675.jpg` | copertina dell'articolo (16:9) |
| `pianello-storia-1080x1920.jpg` | storia (testo fuori dalle fasce di 250 px in alto e in basso) |
| `corona-fantatitano-futsal.png` | corona del lancio su fondo trasparente |
| `shot.cjs`, `pallone.cjs`, `pianello.py` | script che rifanno le immagini |
| `top11_169.py` | rubrica settimanale: la Top 11 della giornata a 1920×1080 (campo, personaggi e stemmi del post del kit; niente foto né «FSGC») |

**Per rifare le immagini:**
1. Avvia il server locale: `python3 -m http.server 4173`.
2. Lancia `node social/pianello/shot.cjs <cartella>` e `node social/pianello/pallone.cjs <cartella>/pallone.png`.
3. Lancia `python3 social/pianello/pianello.py <kit> <cartella>`.

**Top 11 per la rubrica:** `AVATAR=1 python3 social/pianello/top11_169.py <kit> <kit>/work/data.json <cartella>` (dati di `ft_data.mjs` del giorno). Non ingrandire il post 1080×1350: viene morbido.

`<kit>` è la cartella del kit social, che sta fuori dal repo (ci servono `brand.py`, i font e `crown_mask.png`). `shot.cjs` toglie «FSGC» dalla schermata prima di fotografarla.

## Stile grafico
- Colori del futsal dell'app: nero `#111111`, grigio `#2A2A2A`, arancio `#FF4B2B`, con tagli in diagonale.
- Font: Anton per i titoli, Montserrat per i testi.
- In ogni immagine: in alto il marchio Fantatitano con la corona del lancio, poi pallone + «FANTA» bianco e «FUTSAL» arancio, la fascia «DAL 1° DICEMBRE» e il telefono con la schermata del benvenuto del futsal.
- Storia (27/11): il marchio Fantatitano parte a circa 190 px dall'alto, subito sotto il nome dell'account, per staccarlo da FANTAFUTSAL. Corretto solo sull'immagine: in `pianello.py` il marchio della storia va alzato di 65 px.
