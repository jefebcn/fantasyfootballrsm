# Stato – Fantatitano

Aggiornato: 2026-11-25 · temi: orologio FSGC acceso, tempi dei referti, futsal (prima rosa sempre comprabile, nuova home, finestra 12-24 h)

## Dove siamo
- App online su fantatitano.site e su iPhone. Migrazioni fino alla 069, futsal-13 e futsal-14 applicate.
- Orologio dei dati FSGC attivo dal 24/11 (`supabase/dati-fsgc-pianificato.sql`, token fine-grained senza scadenza): import dal database ogni 30 min ven-lun, ogni ora mar-gio. Controllo: `select * from interno.fsgc_ultime;` (204 = partito). Il cron di GitHub resta come riserva.
- Referti FSGC: il pomeriggio del giorno dopo, 11-22 h dopo la gara (Juvenes–Folgore di mar 24/11 22:00 entrato mer 25/11 fra 15:45 e 16:05, ~18 h). Finestra futsal della guardia: 12-24 h (PR #170).
- Futsal: la prima rosa si compra sempre, ai prezzi dell'ultima giornata pronta (futsal-14, PR #168); chi ha già una squadra aspetta i referti. Home rifatta (PR #169, provata da Alex). Dettagli in `docs/futsal/STATO.md`.
- Coppa Fantatitano su #/coppa: chiusura del 1° turno mer 25/11 alle 20:45. Squadre dell'app fino a 32.
- Instagram @fantatitano: controllo della coda lun/mer/ven alle 9:23 (trig_018i6UNbSQ1ikokJFoCnnTWS); dettagli in `kit/STATO.md`. Futsal: controllo Buffer giornaliero (trig_019gaxf1eECjzEK6qMnLV9NA); il 25/11 8 in coda, 2 liberi.

## Aperto / in corso
- Ven 27/11 pomeriggio: misurare a che ora entra il referto di Virtus–Tre Penne (gio 26/11 22:00); è quello che riapre il mercato futsal della 12ª. Promemoria programmato per le 19:30.
- Lancio futsal 1/12 solo col via di Alex: `APERTO_A_TUTTI = true` in `src/views/futsal.js`, poi cancellare `futsal-prova.yml`.
- Proposta «corrispondenti» (risultati la sera dai social delle società): aspetta il via di Alex.
- Semifinali e finale della Coppa Titano pubblicate dalla FSGC: aggiornare `coppa_turni`.
- Seconda chiave Buffer: la mette Alex nei segreti di Supabase.
- Per Alex, dal pannello: controllo delle password rubate su Supabase Auth; copia del backup fuori da GitHub; fino al 1/12 budget Actions a 0 $ per gli altri repository privati.

## Prossimo passo consigliato
- Mer 25/11 dopo le 20:45: guardare la coppa sorteggiata. Ven 27/11: orario del referto Virtus–Tre Penne e mercato della 12ª riaperto. Sab-dom: log di Dati FSGC sui referti del calcio.

## Decisioni recenti di Alex ancora valide
- Futsal dal 1/12: chi si iscrive deve poter comprare subito la prima rosa (25/11).
- Niente annunci personalizzati (ATT) per ora: «stiamo senza per ora» (24/11).
- Coppa: «8 passano, 4 gironi»; nome squadra = quello della lega; squadre dell'app senza segni, solo la riga nelle regole.
- Instagram: almeno 5 post e 4-5 storie a settimana, max 1+1 al giorno (14:00 e 14:15); storie dei gol a parte. Personaggi accanto ai nomi, stemmi accanto alle squadre, mai foto già uscite. Mai «fantatitano.site»: «Link in bio».
- Mai ripetere giocatori o argomenti; le storie parlano solo del loro giorno.
- Merge solo dopo il suo «ok merge».

## Attenzione
- Migrazioni: `apply_migration` via MCP il 25/11 è andata (futsal-14); se scade in attesa di conferma, file unico `begin; … commit;` da incollare nel SQL Editor. Prima: `bash supabase/prove/prova.sh`.
- `npm test` qui vuole prima `npm install --no-save` (manca esbuild).
- Versione: dopo il merge di main, se coincide con main rilancia `scripts/bump-sw.py` (solo se cambia l'app).
- Il ramo remoto conserva la storia di prima dello squash: prima della PR `git fetch origin main` e riparti da lì.
- Un riavvio della sessione spegne i monitor: rileggi `storie-oggi` e riaccendi.
- La FSGC corregge marcatore e minuto durante la partita: una storia già uscita non si corregge da sola.
- Dopo `update_trigger` verificare con `get_trigger`.
