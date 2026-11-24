# Stato – Fantatitano

Aggiornato: 2026-11-24 · temi: database più veloce (068, 069, futsal-13 applicate), guardia FSGC ristretta, minuti di GitHub Actions

## Dove siamo
- App online su fantatitano.site e su iPhone. Migrazioni fino alla 069 e futsal-13 applicate (24/11, Alex dal SQL Editor): lettura formazioni da 930 a ~100 ms, Advisors senza regole doppie né regole ricalcolate a ogni riga. Errori di timeout del 22/11 tolti dalla console.
- Regole per tabelle e regole nuove (calcio, futsal, altri giochi): `docs/DATABASE-VELOCE.md`.
- Guardia di Dati FSGC (PR #163): accesa solo nelle ore in cui escono i dati (partita −1h/+6h, futsal +3h; referti +15h/+30h, futsal +23h), mai dall'1 alle 7.
- GitHub Actions: i 2.000 minuti del mese sono finiti il 24/11 per colpa di fantatitano-gioco (privato). Alex l'ha reso pubblico (minuti gratis; storia controllata: solo la chiave pubblicabile di Supabase). Prove del gioco solo sulle PR (gioco PR #167). Email GitHub di Alex privata, commit dal sito con l'indirizzo noreply.
- Coppa Fantatitano su #/coppa: chiusura del 1° turno mer 25/11 alle 20:45 (quarti di andata veri). Squadre dell'app fino a 32.
- Instagram @fantatitano: controllo della coda lun/mer/ven alle 9:23 (trig_018i6UNbSQ1ikokJFoCnnTWS); coda piena fino a venerdì 27 (dettagli in `kit/STATO.md`).

## Aperto / in corso
- Mer 25/11 9:23: il controllo riempie sabato e domenica. La formazione consigliata di venerdì è fatta prima dei quarti di Coppa Titano: con un espulso o un infortunato fra gli undici, rifarla.
- Storia di Pastorelli: se Alex la cancella, rifare quella di Pieri 13' (gol-in-diretta.py --foto, Higgsfield, UNA chiamata Buffer).
- Semifinali e finale della Coppa Titano pubblicate dalla FSGC: aggiornare `coppa_turni`.
- Seconda chiave Buffer: la mette Alex nei segreti di Supabase.
- Per Alex, dal pannello: controllo delle password rubate su Supabase Auth; copia del backup fuori da GitHub.
- Fino al 1/12: budget Actions a 0 $ consigliato per gli altri repository privati (ribasso, esempiosanmarino, dasopizzeria).

## Prossimo passo consigliato
- Mer 25/11 dopo le 20:45: guardare la coppa sorteggiata e i voti dopo il referto dei quarti. Sab-dom: verificare che la guardia ristretta importi i referti (log di Dati FSGC).

## Decisioni recenti di Alex ancora valide
- Niente annunci personalizzati (ATT) per ora: «stiamo senza per ora» (24/11).
- Coppa: «8 passano, 4 gironi»; nome squadra = quello della lega; squadre dell'app senza segni, solo la riga nelle regole.
- Instagram: almeno 5 post e 4-5 storie a settimana, max 1+1 al giorno (14:00 e 14:15); storie dei gol a parte. Personaggi accanto ai nomi, stemmi accanto alle squadre, mai foto già uscite (testa a testa e «Chi segna di più?» con le foto vere). Mai «fantatitano.site»: «Link in bio».
- Mai ripetere giocatori o argomenti; le storie parlano solo del loro giorno.
- Merge solo dopo il suo «ok merge».

## Attenzione
- Migrazioni: `apply_migration`/DDL via MCP scade in attesa di conferma. Più rapido: un file unico `begin; … commit;` che Alex incolla nel SQL Editor.
- Versione: dopo il merge di main, se coincide con main rilancia `scripts/bump-sw.py` (solo se cambia l'app).
- Il ramo remoto conserva la storia di prima dello squash: prima della PR `git fetch origin main` e riparti da lì.
- Un riavvio della sessione spegne i monitor: rileggi `storie-oggi` e riaccendi.
- La FSGC corregge marcatore e minuto durante la partita: una storia già uscita non si corregge da sola.
- Dopo `update_trigger` verificare con `get_trigger`.
