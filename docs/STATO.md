# Stato – Fantatitano

Aggiornato: 2026-11-21 · tema: storie dei gol live (prima serata 20/11) e limite di Buffer

## Dove siamo
- App online su fantatitano.site e su iPhone. Nell'onboarding del sito c'è il tasto «Scarica l'app dall'App Store» (PR #117, unita); non compare nell'app né su Android.
- Instagram @fantatitano si pubblica da solo con Buffer: un post alle 14:00 e una storia alle 14:15, al massimo uno di ciascuno al giorno. Li prepara il kit social (fuori dal repo), con due attività pianificate: lunedì (dopo la giornata) e giovedì (prima della giornata).
- Il kit ha la sua memoria: `kit/STATO.md` (cosa è programmato) e `kit/PLAYBOOK.md` (tutte le regole di Alex). L'URL del kit è scritto nel prompt delle due attività.
- La 9ª giornata (19–22/11) è già programmata. Il controllo infortuni e squalifiche del 19/11 non ha trovato nessuno fuori.

## Aperto / in corso
- Storie dei gol: funzionano. Venerdì 20/11 sono uscite 7 storie su 7, tutte con la foto, 2-4 minuti dopo il gol. Le prime due erano nere (foto con percorso relativo, PR #122): rifatte, e le nere le ha cancellate Alex. Ora la storia esce solo se tutte le immagini si sono caricate. Il referto si legge ogni 15 s (PR #123).
- Il 20/11 alle 23:10 Buffer ha bloccato la chiave per 24 ore a causa del controllo della chat ogni 8 s. Il 21/11 alle 10 era già sbloccata. Alex darà una seconda chiave: una per le storie automatiche (secret `BUFFER_TOKEN` su Supabase), una per la chat e il kit.
- La PR del 21/11 aggiunge la funzione `storie-oggi` (sola lettura, per seguire le storie senza Buffer), il canale scritto in `pubblica-gol` (una chiamata per gol), niente minuto ripetuto e marchio più in basso nelle storie.
- FantaTitano Futsal: annunciato nel link in bio per il 1° dicembre (PR #118). Lo stato dello sviluppo è da verificare con Alex.
- Lancio Futsal (21/11): corona metà viola e metà nera su fondo arancio (versione A scelta da Alex). Sul sito si accende da sola dal 1° al 14/12 (`src/lancio-futsal.js`). Le foto profilo di @fantatitano e @fantatitano.futsal le cambia Alex a mano il 1/12 e le rimette il 15/12. La versione B (fondo nero) è per le grafiche grandi del lancio. Le icone degli store non cambiano.
- Migrazione 057 (carriera di La Partita sull'account), 18/11: da verificare se è applicata su Supabase.

## Prossimo passo consigliato
- Lunedì 23/11 l'attività del lunedì fa il recap della 9ª giornata. Dopo, controllare che le grafiche rispettino le regole qui sotto.

## Decisioni recenti di Alex ancora valide
- Sull'iPhone tutto porta all'app, non al sito. Niente riga «non affiliato» nel link in bio: resta nei Termini.
- Social: avatar solo nei campi delle formazioni. Nelle sfide e nella figurina vanno foto vere del giocatore nominato, ben visibile e centrato.
- Logo FANTATITANO sempre in alto a sinistra. In ogni grafica con squadre ci sono i loro stemmi di fantasia.
- Due meme a settimana, con dipinti in pubblico dominio: nell'immagine solo il titolo del quadro, autore e licenza in didascalia.
- Mai ripetere giocatori o argomenti: prima di usare un nome, cercarlo in tutte le didascalie recenti.
- Le storie parlano solo del loro giorno: niente scadenze già passate.
- Le storie dei gol sono un'eccezione al limite di una storia al giorno: una per ogni gol della giornata in corso (20/11).
- Storie dei gol: lo sfondo è sempre la foto del marcatore o, se manca, della sua squadra; stemmi di fantasia; mai «fantatitano.site», si scrive «Link in bio» (20/11).
- Si lavora in una chat sola: «termina sessione» o «SESSIONE FINITA» salva il punto, poi la chat si può svuotare.

## Attenzione
- Il deploy parte solo se `npm test` è verde.
- Dopo `update_trigger` verifica con `get_trigger`: due volte l'aggiornamento si è perso con un riavvio.
- Un turno delle storie già partito non prende le correzioni: va fermato (lo fa Alex da GitHub, da qui 403) e l'orologio ne fa partire uno nuovo entro 2 minuti.
- La FSGC corregge il referto durante la partita (marcatore cambiato, gol inserito due volte): una storia già uscita non si corregge da sola.
