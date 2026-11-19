# Stato – Fantatitano Futsal (ramo `futsal`)

Aggiornato: 2026-11-19 · tema: referti 8ª-10ª, stemmi nell'app, social settimana 2, avviso nel link in bio

## Dove siamo
- Sezione futsal (modello Dunkest, § 13 di `FUTSAL.md`) solo sul ramo `futsal`, nascosta (`?futsal=1`, anteprima admin). NON su main né su fantatitano.site.
- Dati: referti importati fino alla 10ª giornata (`src/futsal-dati.js`), quotazioni fino alla 10ª applicate su Supabase.
- Nell'app futsal ora ci sono gli stemmi Fantatitano (`media/stemmi/*-mini.webp`, test `tests/futsal-stemmi.test.js`).
- Link in bio (main, PR #118 unita): card «Fantatitano Futsal · Dal 01/12» con conto alla rovescia, online.
- Instagram @fantatitano.futsal via Buffer: 4 post + 5 storie in coda fino al 23/11.

## Aperto / in corso
- Attività pianificata ven 20/11 14:00 (trig_015frfsmeqfqUtRCACKJzkg2): import referti, storia «Classifica» su Buffer, quotazioni 11ª, push su `futsal`.
- In coda su Buffer: post 20/11 (mercato), 22/11 (11ª giornata); storie 21/11 (App), 23/11 (Giornate).
- Storie da mettere in evidenza a mano (App, Squadre, Giornate, Come si gioca, Classifica): gli highlight non hanno API.
- `prove/futsal.cjs`: 1 errore vecchio (giornata 8 scritta a mano, mercato chiuso all'ora scelta), non regressione.

## Prossimo passo consigliato
- Lancio del 01/12: quando Alex dà il via, unire `futsal` in main (prima merge di main in `futsal`, conflitti su `docs/STATO.md` = riscrivere).
- Quando Google Play è pubblico: grafiche «Disponibile su Google Play» e storia del giorno di lancio con i due store.

## Decisioni recenti di Alex ancora valide
- Lavorare solo su `futsal`; niente merge in main né pubblicazione finché non lo dice lui.
- Instagram: foto solo FSGC con «© FSGC / Fotografo»; niente nomi di giocatori; niente stemmi ufficiali (quelli Fantatitano sì, «stemmi di fantasia, non ufficiali»); CTA solo Salvalo / Swipe / Link in bio; isAiGenerated true; storie senza testo di caption.
- Lancio annunciato per il 01/12 su App Store e Google Play.

## Attenzione
- Buffer gratuito: max 10 elementi in coda per canale.
- I referti FSGC arrivano 15-22 ore dopo la partita (quelli del lunedì il mattino dopo).
