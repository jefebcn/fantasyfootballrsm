# Stato – Fantatitano Futsal

Aggiornato: 2026-11-21 (sera) · tema: futsal pronto al lancio, funzioni nuove, Coppa provata con 100 squadre

## Dove siamo
- Futsal su main e su fantatitano.site dal 21/11 (PR #126): lo vede solo il proprietario (`profiles.is_owner`) finché `APERTO_A_TUTTI = false` in `src/views/futsal.js`. Gioco a rosa e crediti (§ 13 di `FUTSAL.md`).
- Import automatico: i referti futsal li importa «Dati FSGC» (`dati-fsgc.yml` → `importa-in-giro.sh` → `scripts/importa-futsal-giro.sh`); quotazioni e orari vanno sul database con il secret SUPABASE_DB_URL. Primo giro 21/11 ok (referti aggiornati, database non ancora toccato: nulla di nuovo).
- Database: futsal-06 (leghe pubbliche) e futsal-07 (funzioni chiuse agli anonimi) applicate. Date FSGC fissate fino alla 12ª (3/12).
- 21/11: barra «Aggiorna» tolta, maglie nelle liste, icona di Regole, niente citazioni di altre app (PR #129-#133). Lancio: la 13ª è la prima giornata giocabile (chiusura provvisoria, `futsal_lock` 13 a mano). Coppa dalla 14ª alla 30ª (`COPPA` in `src/futsal-gare.js`). Nuove: nome e colore della squadra (nomi unici, futsal-10), «Primo in panchina», formazioni degli avversari, avviso «mercato aperto» (futsal-11 + funzione `promemoria-`), albo d'oro.
- Coppa con 100 squadre simulata (`prove/coppa-simulata/`): «La tua coppa», linea di chi passa, preliminari ridotti ai primi 16, sfide del turno, ✓ su chi passa (PR #141). A stagione finita la home dice «Stagione finita».
- Instagram @fantatitano.futsal via Buffer: coda fino al 30/11. Foto: archivio Flickr FSGC su Drive, catalogo `catalogo-futsal.csv` (Drive id 1cxmXJ3_xL3Ghku4pCXWhIPXJq2KRit0X).

## Aperto / in corso
- Alex prova il futsal dal suo account: iscrizione, mercato dell'11ª (chiude lun 23/11 20:05), lega pubblica da Leghe → Admin.
- Rapporto sulla velocità dei referti dell'11ª: mar 24/11 18:30 (trig_01UtzL2kKz21n95LRYPwn9Zy), controlla anche la prima scrittura su database.
- Ogni giorno 9:47 (trig_019gaxf1eECjzEK6qMnLV9NA): con ≥4 posti liberi su Buffer crea contenuti con foto dall'archivio Drive e avvisa Alex; altrimenti silenzio.
- `.github/workflows/futsal-prova.yml` si è spento da solo: da cancellare dopo il lancio.
- Storie da mettere in evidenza a mano da Alex (gli highlight non hanno API).
- Album Flickr nuovi (11ª in poi): aggiungere l'indirizzo in `scripts/foto-flickr-futsal.ps1` e mandare ad Alex il comando completo.

## Prossimo passo consigliato
- Lancio del 01/12, al via di Alex: `APERTO_A_TUTTI = true`, PR su main, poi cancellare `futsal-prova.yml`.
- Quando Google Play è pubblico: «Disponibile su Google Play» nelle grafiche e storia del lancio con i due store.

## Decisioni recenti di Alex ancora valide
- Fino al lancio il futsal lo vede solo lui; gli altri admin e gli utenti no.
- Mai citare le app a cui ci ispiriamo (app, social, codice, documenti).
- Niente scritta «Aggiorna» in app: l'aggiornamento entra da solo.
- Coda Buffer: con 4 o più posti liberi si creano subito nuovi contenuti.
- Ogni foto si usa UNA SOLA VOLTA. Già usate (notizie FSGC, id articolo): 2406 2409 2411 2413 2422 2427 2431 2435 2441 2447 2451 2452 2459 2462 2464 2473 2477 2482 2485. Dall'archivio Flickr: nessuna ancora (segnare qui l'id flickr).
- Instagram: credito «© FSGC / Fotografo»; niente nomi di giocatori; solo stemmi Fantatitano («di fantasia, non ufficiali»); CTA solo Salvalo / Swipe / Link in bio; isAiGenerated true; storie senza testo.
- Lancio 01/12 su App Store e Google Play.

## Attenzione
- Chiusura PROVVISORIA (`F.chiusura`): la prima giornata senza date FSGC chiude una settimana dopo la precedente, stessa ora; finisce anche in `futsal_lock`. Se il file SQL è già aggiornato nel commit, l'import non ricarica: la riga va messa a mano sul database.
- Comandi per il PC di Alex (Windows, PowerShell): sempre completi, mai segnaposto; la cartella è `$env:USERPROFILE\Desktop\FOTO FSGC`.
- Dal cloud Flickr risponde 429 alle immagini: si scarica dal PC di Alex.
- Buffer gratuito: max 10 in coda per canale. Referti FSGC 15-22 ore dopo la partita.
- Prove browser in cloud: `prove/strumenti/servi-da-disco.cjs` (vedi docs/STATO.md); per il service worker serve https://app.local.
