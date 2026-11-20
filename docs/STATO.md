# Stato – Fantatitano Futsal (ramo `futsal`)

Aggiornato: 2026-11-20 · tema: coda Buffer fino al 30/11, controllo giornaliero, archivio foto Flickr su Drive

## Dove siamo
- Sezione futsal (modello Dunkest, § 13 di `FUTSAL.md`) solo sul ramo `futsal`, nascosta (`?futsal=1`, anteprima admin). NON su main né su fantatitano.site.
- Dati: referti fino alla 10ª giornata (`src/futsal-dati.js`), quotazioni fino alla 10ª su Supabase. Stemmi Fantatitano nell'app.
- Link in bio (main, PR #118): card «Fantatitano Futsal · Dal 01/12», online.
- Instagram @fantatitano.futsal via Buffer: coda 9/10 fino al 30/11 (vigilia del lancio). Grafiche: `scratchpad/ig/sett3.mjs` (stile da copiare).
- Foto: archivio Flickr FSGC su Drive, cartelle «Futsal - Giornata 01/02/09/10» (Desktop\FOTO FSGC\flickr\FSGC _ official\Albums, sincronizzata da Drive), catalogo `catalogo-futsal.csv` (Drive id 1cxmXJ3_xL3Ghku4pCXWhIPXJq2KRit0X): 5.304 foto, 27 partite, fotografo per ogni foto.

## Aperto / in corso
- Oggi 14:00 (trig_015frfsmeqfqUtRCACKJzkg2): import referti, storia «Classifica» su Buffer (usa l'ultimo posto), quotazioni 11ª, push.
- Ogni giorno 9:47 (trig_019gaxf1eECjzEK6qMnLV9NA): se su Buffer ci sono ≥4 posti liberi crea contenuti con foto dall'archivio Drive e avvisa Alex; altrimenti silenzio.
- Storie da mettere in evidenza a mano da Alex (21/11 App, 23/11 Giornate, 25/11 schemi): gli highlight non hanno API.
- Album Flickr nuovi (11ª giornata in poi): aggiungere l'indirizzo in `scripts/foto-flickr-futsal.ps1` e mandare ad Alex il comando completo; poi lui rilancia scaricamento, rinomina e catalogo.
- `prove/futsal.cjs`: 1 errore vecchio (giornata 8 scritta a mano), non regressione.

## Prossimo passo consigliato
- Lancio del 01/12: quando Alex dà il via, merge di main in `futsal`, poi `futsal` in main (conflitto su `docs/STATO.md` = riscrivere).
- Quando Google Play è pubblico: «Disponibile su Google Play» nelle grafiche e storia del lancio con i due store.

## Decisioni recenti di Alex ancora valide
- Lavorare solo su `futsal`; niente merge in main né pubblicazione finché non lo dice lui.
- Coda Buffer: con 4 o più posti liberi si creano subito nuovi contenuti.
- Ogni foto si usa UNA SOLA VOLTA. Già usate (notizie FSGC, id articolo): 2406 2409 2411 2413 2422 2427 2431 2435 2441 2447 2451 2452 2459 2462 2464 2473 2477 2482 2485. Dall'archivio Flickr: nessuna ancora (segnare qui l'id flickr).
- Instagram: credito «© FSGC / Fotografo»; niente nomi di giocatori; solo stemmi Fantatitano («di fantasia, non ufficiali»); CTA solo Salvalo / Swipe / Link in bio; isAiGenerated true; storie senza testo.
- Lancio 01/12 su App Store e Google Play.

## Attenzione
- Comandi per il PC di Alex (Windows, PowerShell): sempre completi da copiare e incollare, mai segnaposto tipo `<percorso>`; la cartella è `$env:USERPROFILE\Desktop\FOTO FSGC`.
- Dal cloud Flickr risponde 429 alle immagini: si scarica dal PC di Alex. Le cartelle Drive del backup del computer non si possono rinominare via API: si rinominano sul PC.
- Buffer gratuito: max 10 in coda per canale. Referti FSGC 15-22 ore dopo la partita.
