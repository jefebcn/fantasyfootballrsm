# Stato – Fantatitano

Aggiornato: 2026-11-20 · tema: Instagram automatico (meme, foto vere, stemmi, storie dei gol) e tasto App Store

## Dove siamo
- App online su fantatitano.site e su iPhone. Nell'onboarding del sito c'è il tasto «Scarica l'app dall'App Store» (PR #117, unita); non compare nell'app né su Android.
- Instagram @fantatitano si pubblica da solo con Buffer: un post alle 14:00 e una storia alle 14:15, al massimo uno di ciascuno al giorno. Li prepara il kit social (fuori dal repo), con due attività pianificate: lunedì (dopo la giornata) e giovedì (prima della giornata).
- Il kit ha la sua memoria: `kit/STATO.md` (cosa è programmato) e `kit/PLAYBOOK.md` (tutte le regole di Alex). L'URL del kit è scritto nel prompt delle due attività.
- La 9ª giornata (19–22/11) è già programmata. Il controllo infortuni e squalifiche del 19/11 non ha trovato nessuno fuori.

## Aperto / in corso
- Storie dei gol su Instagram, quasi istantanee (20/11): accese. L'orologio `orologio-gol` (pg_cron ogni 2 minuti) fa partire il turno quando si gioca, e la funzione `pubblica-gol` pubblica subito con Buffer. Prima prova vera: venerdì 20/11 alle 21:15 (La Fiorita–Folgore, Tre Fiori–Juvenes), da verificare nel log del turno.
- FantaTitano Futsal: annunciato nel link in bio per il 1° dicembre (PR #118). Lo stato dello sviluppo è da verificare con Alex.
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
- Si lavora in una chat sola: «termina sessione» o «SESSIONE FINITA» salva il punto, poi la chat si può svuotare.

## Attenzione
- Il deploy parte solo se `npm test` è verde.
- Dopo `update_trigger` verifica con `get_trigger`: due volte l'aggiornamento si è perso con un riavvio.
