# Stato – Fantatitano Futsal

Aggiornato: 2026-11-23 · temi: risultato provvisorio («voti in arrivo») dalla FSGC o a mano, pallone e maglia nuovi, copertine in evidenza

## Dove siamo
- Futsal su main e su fantatitano.site dal 21/11 (PR #126): lo vede solo il proprietario (`profiles.is_owner`) finché `APERTO_A_TUTTI = false` in `src/views/futsal.js`. Gioco a rosa e crediti (§ 13 di `FUTSAL.md`).
- Import automatico: i referti futsal li importa «Dati FSGC» (`dati-fsgc.yml` → `importa-in-giro.sh` → `scripts/importa-futsal-giro.sh`); quotazioni e orari vanno sul database con il secret SUPABASE_DB_URL. Primo giro 21/11 ok (referti aggiornati, database non ancora toccato: nulla di nuovo).
- Database: futsal-06 (leghe pubbliche) e futsal-07 (funzioni chiuse agli anonimi) applicate. Date FSGC fissate fino alla 12ª (3/12).
- 21/11: barra «Aggiorna» tolta, maglie nelle liste, icona di Regole, niente citazioni di altre app (PR #129-#133). Lancio: la 13ª è la prima giornata giocabile (chiusura provvisoria, `futsal_lock` 13 a mano). Coppa dalla 14ª alla 30ª (`COPPA` in `src/futsal-gare.js`). Nuove: nome e colore della squadra (nomi unici, futsal-10), «Primo in panchina», formazioni degli avversari, avviso «mercato aperto» (futsal-11 + funzione `promemoria-`), albo d'oro.
- Coppa con 100 squadre simulata (`prove/coppa-simulata/`): «La tua coppa», linea di chi passa, preliminari ridotti ai primi 16, sfide del turno, ✓ su chi passa (PR #141). A stagione finita la home dice «Stagione finita». 22/11: nella scheda «Compra» le colonne hanno l'intestazione «Media punti» e «Prezzo» (PR #151).
- 23/11 (PR #157): risultato provvisorio. L'import salva in `PROVVISORI` le partite «Concluse» sulla FSGC senza distinte; l'amministratore scrive il finale dal Calendario («Scrivi il risultato a mano», tabella `futsal_risultati_provvisori`, futsal-12 applicata). Tutti vedono «voti in arrivo»; punti e classifiche aspettano il referto. PR #155: pallone ridisegnato e 5 centrato nella maglia.
- Velocità: la FSGC non aggiorna il futsal in diretta (7ª: 0-0 segnaposto fino al referto, 15-22 h dopo); i siti di notizie escono il mattino dopo, non prima. Il finale la sera c'è solo sui social delle società.
- Instagram @fantatitano.futsal via Buffer: coda fino al 4/12. Foto: archivio Flickr FSGC su Drive, catalogo `catalogo-futsal.csv` (Drive id 1cxmXJ3_xL3Ghku4pCXWhIPXJq2KRit0X).

## Aperto / in corso
- Alex prova il futsal dal suo account: iscrizione, mercato dell'11ª (chiude lun 23/11 20:05), lega pubblica da Leghe → Admin.
- Lun 23/11 sera Alex scrive a mano i risultati dell'11ª. Mar 24/11 18:30 (trig_01UtzL2kKz21n95LRYPwn9Zy): rapporto su referto FSGC, provvisorio FSGC e risultato a mano, partita per partita (anche se un risultato a mano non coincide col referto).
- Proposta in attesa del via di Alex: link personale per ogni società («corrispondenti»), che scrive solo il risultato delle sue partite nella stessa tabella. In alternativa chiedere alla FSGC di pubblicare il referto la sera.
- Ogni giorno 9:47 (trig_019gaxf1eECjzEK6qMnLV9NA): con ≥4 posti liberi su Buffer crea contenuti con foto dall'archivio Drive e avvisa Alex; altrimenti silenzio.
- `.github/workflows/futsal-prova.yml` si è spento da solo: da cancellare dopo il lancio.
- Questionario di confronto per chi conosce bene un gioco simile (PDF dato ad Alex il 22/11, 7 temi: prima volta, rosa e schemi, mercato, giornata, classifiche, cosa fa tornare, cosa cambiare): con le risposte, proporre i ritocchi prima del lancio.
- Storie da mettere in evidenza a mano da Alex (gli highlight non hanno API). Raccolte: Regole, Giornate, Classifica, Squadre, App, Amici, Coppa; copertine finali del 23/11 (fondo nero, icona arancio, pallone nuovo).
- Album Flickr nuovi (11ª in poi): aggiungere l'indirizzo in `scripts/foto-flickr-futsal.ps1` e mandare ad Alex il comando completo.

## Prossimo passo consigliato
- Lancio del 01/12, al via di Alex: `APERTO_A_TUTTI = true`, PR su main, poi cancellare `futsal-prova.yml`.
- Quando Google Play è pubblico: «Disponibile su Google Play» nelle grafiche e storia del lancio con i due store.

## Decisioni recenti di Alex ancora valide
- Fino al lancio il futsal lo vede solo lui; gli altri admin e gli utenti no.
- Mai citare le app a cui ci ispiriamo (app, social, codice, documenti).
- Niente scritta «Aggiorna» in app: l'aggiornamento entra da solo.
- Coda Buffer: con 4 o più posti liberi si creano subito nuovi contenuti.
- Ogni foto si usa UNA SOLA VOLTA. Già usate (notizie FSGC, id articolo): 2406 2409 2411 2413 2422 2427 2431 2435 2441 2447 2451 2452 2459 2462 2464 2473 2477 2482 2485. Dall'archivio Flickr: 55656783462 55656783487 (23/11, post dell'1 e del 3/12).
- Instagram: credito «© FSGC / Fotografo»; niente nomi di giocatori; solo stemmi Fantatitano («di fantasia, non ufficiali»); CTA solo Salvalo / Swipe / Link in bio; isAiGenerated true; storie senza testo.
- Lancio 01/12 su App Store e Google Play.
- Risultati la sera: niente lettura automatica di Instagram (serve un account Facebook che Alex non può aprire, e lo scraping è vietato e fragile). Solo FSGC, a mano o, se Alex dice sì, link alle società.

## Attenzione
- Chiusura PROVVISORIA (`F.chiusura`): la prima giornata senza date FSGC chiude una settimana dopo la precedente, stessa ora; finisce anche in `futsal_lock`. Se il file SQL è già aggiornato nel commit, l'import non ricarica: la riga va messa a mano sul database.
- Comandi per il PC di Alex (Windows, PowerShell): sempre completi, mai segnaposto; la cartella è `$env:USERPROFILE\Desktop\FOTO FSGC`.
- Dal cloud Flickr risponde 429 alle immagini: si scarica dal PC di Alex.
- Buffer gratuito: max 10 in coda per canale. Referti FSGC 15-22 ore dopo la partita.
- Prove browser in cloud: `prove/strumenti/servi-da-disco.cjs` (vedi docs/STATO.md); per il service worker serve https://app.local.
