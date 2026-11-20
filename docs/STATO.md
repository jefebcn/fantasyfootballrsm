# Stato – Fantatitano Futsal (ramo `futsal`)

Aggiornato: 2026-11-20 · tema: coda Buffer riempita fino al 30/11

## Dove siamo
- Sezione futsal (modello Dunkest, § 13 di `FUTSAL.md`) solo sul ramo `futsal`, nascosta (`?futsal=1`, anteprima admin). NON su main né su fantatitano.site.
- Dati: referti importati fino alla 10ª giornata (`src/futsal-dati.js`), quotazioni fino alla 10ª applicate su Supabase.
- Nell'app futsal ora ci sono gli stemmi Fantatitano (`media/stemmi/*-mini.webp`, test `tests/futsal-stemmi.test.js`).
- Link in bio (main, PR #118 unita): card «Fantatitano Futsal · Dal 01/12» con conto alla rovescia, online.
- Instagram @fantatitano.futsal via Buffer: coda piena (9/10) fino al 30/11, vigilia del lancio; 1 posto per la storia «Classifica» di venerdì.

## Aperto / in corso
- Attività pianificata ven 20/11 14:00 (trig_015frfsmeqfqUtRCACKJzkg2): import referti, storia «Classifica» su Buffer, quotazioni 11ª, push su `futsal`.
- In coda su Buffer: post 20/11 mercato, 22/11 11ª giornata, 24/11 punti, 26/11 capitano, 28/11 «3 giorni»; storie 21/11 App, 23/11 Giornate, 25/11 schemi, 30/11 «domani si parte». Grafiche: `scratchpad/ig/sett3.mjs`.
- Storie da mettere in evidenza a mano (App, Squadre, Giornate, Come si gioca, Classifica): gli highlight non hanno API.
- `prove/futsal.cjs`: 1 errore vecchio (giornata 8 scritta a mano, mercato chiuso all'ora scelta), non regressione.

## Prossimo passo consigliato
- Lancio del 01/12: quando Alex dà il via, unire `futsal` in main (prima merge di main in `futsal`, conflitti su `docs/STATO.md` = riscrivere).
- Quando Google Play è pubblico: grafiche «Disponibile su Google Play» e storia del giorno di lancio con i due store.

## Decisioni recenti di Alex ancora valide
- Coda Buffer: appena i posti liberi sono 4 o più (10 − programmati), creare e programmare subito nuovi contenuti. Il controllo automatico giornaliero non è attivo (permesso negato): controllare a ogni sessione.
- Lavorare solo su `futsal`; niente merge in main né pubblicazione finché non lo dice lui.
- Instagram: foto solo FSGC con «© FSGC / Fotografo»; niente nomi di giocatori; niente stemmi ufficiali (quelli Fantatitano sì, «stemmi di fantasia, non ufficiali»); CTA solo Salvalo / Swipe / Link in bio; isAiGenerated true; storie senza testo di caption.
- Lancio annunciato per il 01/12 su App Store e Google Play.

## Attenzione
- Ogni foto FSGC si usa una sola volta (regola di Alex del 20/11). Già usate: 2406 2409 2411 2413 2422 2427 2431 2435 2441 2447 2451 2452 2459 2462 2464 2473 2477 2482 2485. Libere: 2399 2402 2438 (nomi sulle maglie in primo piano); poi servono foto nuove dalle notizie FSGC.
- Buffer gratuito: max 10 elementi in coda per canale.
- I referti FSGC arrivano 15-22 ore dopo la partita (quelli del lunedì il mattino dopo).
