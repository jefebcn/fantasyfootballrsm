# Stato – Fantatitano Futsal

Aggiornato: 2026-11-25 · temi: prima rosa sempre comprabile (futsal-14), nuova home, tempi dei referti FSGC, orologio dell'import

## Dove siamo
- Futsal su main e su fantatitano.site dal 21/11 (PR #126): lo vede solo il proprietario (`profiles.is_owner`) finché `APERTO_A_TUTTI = false` in `src/views/futsal.js`. Gioco a rosa e crediti (§ 13 di `FUTSAL.md`).
- Import automatico: i referti futsal li importa «Dati FSGC» (`dati-fsgc.yml` → `importa-in-giro.sh` → `scripts/importa-futsal-giro.sh`); quotazioni e orari vanno sul database con il secret SUPABASE_DB_URL. Primo giro 21/11 ok (referti aggiornati, database non ancora toccato: nulla di nuovo).
- Database: futsal-06 (leghe pubbliche) e futsal-07 (funzioni chiuse agli anonimi) applicate. Date FSGC fissate fino alla 12ª (3/12).
- 21/11: barra «Aggiorna» tolta, maglie nelle liste, icona di Regole, niente citazioni di altre app (PR #129-#133). Lancio: la 13ª è la prima giornata giocabile (chiusura provvisoria, `futsal_lock` 13 a mano). Coppa dalla 14ª alla 30ª (`COPPA` in `src/futsal-gare.js`). Nuove: nome e colore della squadra (nomi unici, futsal-10), «Primo in panchina», formazioni degli avversari, avviso «mercato aperto» (futsal-11 + funzione `promemoria-`), albo d'oro.
- Coppa con 100 squadre simulata (`prove/coppa-simulata/`): «La tua coppa», linea di chi passa, preliminari ridotti ai primi 16, sfide del turno, ✓ su chi passa (PR #141). A stagione finita la home dice «Stagione finita». 22/11: nella scheda «Compra» le colonne hanno l'intestazione «Media punti» e «Prezzo» (PR #151).
- 23/11 (PR #157): risultato provvisorio. L'import salva in `PROVVISORI` le partite «Concluse» sulla FSGC senza distinte; l'amministratore scrive il finale dal Calendario («Scrivi il risultato a mano», tabella `futsal_risultati_provvisori`, futsal-12 applicata). Tutti vedono «voti in arrivo»; punti e classifiche aspettano il referto. PR #155: pallone ridisegnato e 5 centrato nella maglia.
- Mercato e referti (25/11): il mercato riapre coi referti dell'ultima partita della giornata, il pomeriggio del giorno dopo, 11-22 h dopo la gara (Juvenes–Folgore 18 h); l'import parte ogni ora dall'orologio del database e ogni 20 min da 12 a 24 h dopo (PR #170). Per chi non ha ancora una squadra il mercato è sempre aperto, ai prezzi dell'ultima giornata pronta (futsal-14, PR #168, applicata il 25/11): al lancio la 12ª finisce giovedì 3/12 e chi si iscrive dal 1/12 compra subito per la 13ª.
- Home (PR #169, provata da Alex): in alto la squadra (stemma, nome, posizione), poi «Ultima giornata» (punti, migliore, capitano) e «Prossima giornata» (chiusura, crediti, dove giocano i tuoi); «Nome e colore» in fondo.
- Velocità: la FSGC non aggiorna il futsal in diretta (7ª: 0-0 segnaposto fino al referto, 11-22 h dopo); i siti di notizie escono il mattino dopo, non prima. Il finale la sera c'è solo sui social delle società.
- Instagram @fantatitano.futsal via Buffer: coda piena (10) fino al 4/12. Foto: archivio Flickr FSGC su Drive, catalogo `catalogo-futsal.csv` (Drive id 1cxmXJ3_xL3Ghku4pCXWhIPXJq2KRit0X).

## Aperto / in corso
- Alex prova il futsal dal suo account: iscrizione, mercato dell'11ª (chiude lun 23/11 20:05), lega pubblica da Leghe → Admin.
- Lun 23/11 sera Alex scrive a mano i risultati dell'11ª. Mar 24/11 18:30 (trig_01UtzL2kKz21n95LRYPwn9Zy): rapporto su referto FSGC, provvisorio FSGC e risultato a mano, partita per partita (anche se un risultato a mano non coincide col referto).
- Proposta in attesa del via di Alex: link personale per ogni società («corrispondenti»), che scrive solo il risultato delle sue partite nella stessa tabella. In alternativa chiedere alla FSGC di pubblicare il referto la sera.
- Ogni giorno 9:47 (trig_019gaxf1eECjzEK6qMnLV9NA): con ≥1 posto libero su Buffer riempie fino a 10 crea contenuti con foto dall'archivio Drive e avvisa Alex; altrimenti silenzio.
- `.github/workflows/futsal-prova.yml` si è spento da solo: da cancellare dopo il lancio.
- Questionario di confronto per chi conosce bene un gioco simile (PDF dato ad Alex il 22/11, 7 temi: prima volta, rosa e schemi, mercato, giornata, classifiche, cosa fa tornare, cosa cambiare): con le risposte, proporre i ritocchi prima del lancio.
- Storie da mettere in evidenza a mano da Alex (gli highlight non hanno API). Raccolte: Regole, Giornate, Classifica, Squadre, App, Amici, Coppa; copertine finali del 23/11 (fondo nero, icona arancio, pallone nuovo).
- Album Flickr nuovi (11ª in poi): aggiungere l'indirizzo in `scripts/foto-flickr-futsal.ps1` e mandare ad Alex il comando completo.

## Prossimo passo consigliato
- Lancio del 01/12 alle 8 (via di Alex del 26/11): si apre da solo (`futsalPerTutti` in `src/lancio-futsal.js`, stessa ora della corona), niente aggiornamento sugli store; dopo il lancio cancellare `futsal-prova.yml`.
- Quando Google Play è pubblico: «Disponibile su Google Play» nelle grafiche e storia del lancio con i due store.

## Decisioni recenti di Alex ancora valide
- Fino al lancio il futsal lo vede solo lui; gli altri admin e gli utenti no.
- Mai citare le app a cui ci ispiriamo (app, social, codice, documenti).
- Niente scritta «Aggiorna» in app: l'aggiornamento entra da solo.
- Coda Buffer: con 4 o più posti liberi si creano subito nuovi contenuti.
- Ogni foto si usa UNA SOLA VOLTA. Già usate (notizie FSGC, id articolo): 2406 2409 2411 2413 2422 2427 2431 2435 2441 2447 2451 2452 2459 2462 2464 2473 2477 2482 2485. Dall'archivio Flickr: 55656783462 55656783487 (23/11, post dell'1 e del 3/12; etichetta FSGC «Domagnano - Cosmos» sbagliata, ma sono futsal), 55660469071 55657947754 55649211147 55646266181 (27/11: i 4 post fatti con queste sono stati tolti perché doppioni, le foto restano libere); 55549911664 55545877319 55529414601 55657899313 (28/11, coda: bomber, difensori, 57 sempre in distinta, programma 13ª).
- Già uscito su @fantatitano.futsal (niente doppioni, Alex 27/11). Post: Sta arrivando (2/11), Come si gioca in 4 slide: rosa, schemi, punti, sfida (4/11), Risultati 10ª lunedì (17/11), Le porte migliori (18/11), I numeri del campionato (19/11), Il mercato in 3 slide: quotazioni, crediti, cambi (20/11), Programma 11ª (22/11), Quanto vale ogni evento (24/11), Chi conta: capitano, sesto, panchina (26/11). Storie: risultati 10ª, 10ª giornata, porte, la rosa, app/uscita 01/12, numeri, 15 squadre, mercato, classifica dopo la 10ª, app presto, 11ª giornata, gli schemi con bonus difesa, chi conta, risultato Virtus–Tre Penne 11ª e I migliori 11ª (27/11, a mano). Da qui le storie dei risultati e de «I migliori» escono da sole con l'import. In coda: 3 giorni al via (28/11), Domani si parte (30/11), Oggi si parte (1/12), La tua lega (2/12), I bomber dopo 11 giornate (post 29/11), La 13ª la prima che conta (3/12), Coppa Titano (storia 4/12); dal giro del 28/11: 57 sempre in distinta (storia 1/12), 10 gol da difensore (post 2/12), La 13ª: il programma (post 4/12).
- Stile (Alex 27/11): la copertina a foto piena (giocatori a tutta immagine, titolo grande sotto) piace molto: usarla spesso; dal 1/12 alternare tecniche, non schede «foto + tabella» una dopo l'altra.
- Il futsal si gioca anche all'aperto, sul campetto vicino al campo da calcio (Alex, 27/11): le foto all'aperto vanno bene. Le etichette del catalogo possono sbagliare: la partita va cercata nel calendario futsal.
- Storie automatiche: sfondo da `social/futsal/foto-partite.json` (26 foto, una per partita, tutte le 15 squadre); per aggiungerne, foto in `social/futsal/foto/` + una riga nel JSON. Quelle 26 non si usano per i post di Buffer.
- Instagram: credito «© FSGC / Fotografo»; nomi dei giocatori ammessi (Alex, 27/11); solo stemmi Fantatitano («di fantasia, non ufficiali»); CTA solo Salvalo / Swipe / Link in bio; isAiGenerated true; storie senza testo.
- Lancio 01/12 su App Store e Google Play.
- Risultati la sera: niente lettura automatica di Instagram (serve un account Facebook che Alex non può aprire, e lo scraping è vietato e fragile). Solo FSGC, a mano o, se Alex dice sì, link alle società.

## Attenzione
- Chiusura PROVVISORIA (`F.chiusura`): la prima giornata senza date FSGC chiude una settimana dopo la precedente, stessa ora; finisce anche in `futsal_lock`. Se il file SQL è già aggiornato nel commit, l'import non ricarica: la riga va messa a mano sul database.
- Comandi per il PC di Alex (Windows, PowerShell): sempre completi, mai segnaposto; la cartella è `$env:USERPROFILE\Desktop\FOTO FSGC`.
- Dal cloud Flickr risponde 429 alle immagini: si scarica dal PC di Alex.
- Buffer gratuito: max 10 in coda per canale. Referti FSGC 11-22 ore dopo la partita, di solito il pomeriggio dopo.
- Prove browser in cloud: `prove/strumenti/servi-da-disco.cjs` (vedi docs/STATO.md); per il service worker serve https://app.local.
