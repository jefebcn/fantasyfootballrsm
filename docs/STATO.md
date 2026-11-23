# Stato – Fantatitano

Aggiornato: 2026-11-23 (pomeriggio) · temi: coda Buffer di @fantatitano piena fino a venerdì; regola su personaggi, stemmi e foto; futsal: risultato provvisorio (vedi `docs/futsal/STATO.md`)

## Dove siamo
- App online su fantatitano.site e su iPhone. Migrazioni fino alla 067 applicate.
- Coppa Fantatitano su #/coppa (PR #143–#150, tutte unite): 4 gironi, 8 ai quarti, poi gare secche sulle semifinali andata/ritorno e sulla finale vere. Chiusura del 1° turno mer 25/11 alle 20:45 (quarti di andata veri). Prima della chiusura gironi provvisori coi nomi veri.
- Squadre dell'app (PR #149): portano la coppa a 32 squadre, nomi inventati, formazione automatica dalle quotazioni, calano a ogni iscrizione vera. Nessun segno sulle squadre: lo dice solo una riga nelle regole (scelta di Alex).
- Grafica della coppa (PR #150): testata con conto alla rovescia, gironi a griglia, tabellone ad albero, formazione consegnata in breve.
- Instagram @fantatitano: controllo della coda lun/mer/ven alle 9:23 (trig_018i6UNbSQ1ikokJFoCnnTWS), riempie fino a 10. Il 23/11 coda PIENA: un post (14:00) e una storia (14:15) al giorno da lunedì 23 a venerdì 27 (recap, Top 11, testa a testa, meme, formazione consigliata della 10ª). Dettagli e id nel kit (`kit/STATO.md`).
- Regola di Alex del 23/11 (sostituisce «avatar solo nel campo»): personaggi accanto a ogni nome di giocatore, stemma accanto a ogni squadra, mai foto già uscite (nemmeno del catalogo). Testa a testa e «Chi segna di più?» restano con le foto vere dei due («perfetti così»). Regola nel PLAYBOOK del kit e nel prompt del controllo.
- Storie dei gol 22/11: 15 uscite, 14 giuste. Il 2-2 di Pennarossa–Tre Penne dice «Pastorelli 14'», ma la FSGC poi l'ha corretto in Pieri 13'.

## Aperto / in corso
- Storia di Pastorelli: se Alex la cancella da Instagram, rifare quella di Pieri 13' (gol-in-diretta.py --foto in locale, Higgsfield, UNA chiamata Buffer).
- Mer 25/11 9:23: il controllo riempie sabato e domenica. La formazione consigliata di venerdì è fatta prima dei quarti di Coppa Titano di mercoledì sera: se c'è un espulso o un infortunato fra gli undici, rifarla.
- Quando la FSGC pubblica le squadre di semifinali e finale della Coppa Titano: aggiornare `coppa_turni` (squadre, chiusure).
- Seconda chiave Buffer: la mette Alex nei segreti di Supabase.
- Per Alex, dal pannello: controllo delle password rubate su Supabase Auth; copia del backup fuori da GitHub.

## Prossimo passo consigliato
- Mer 25/11 dopo le 20:45: guardare la coppa sorteggiata (gironi, prime sfide, squadre dell'app con formazione) e i voti dopo il referto dei quarti.

## Decisioni recenti di Alex ancora valide
- Coppa: «8 passano, 4 gironi»; il nome della squadra è sempre quello della lega; squadre dell'app senza segni sulle squadre, solo la riga nelle regole.
- Instagram: almeno 5 post e 4-5 storie a settimana, max 1 post e 1 storia al giorno (14:00 e 14:15); le storie dei gol sono a parte.
- Logo FANTATITANO in alto a sinistra; stemmi di fantasia; avatar solo nel campo; foto vere nelle sfide; mai «fantatitano.site», si scrive «Link in bio».
- Mai ripetere giocatori o argomenti; le storie parlano solo del loro giorno.
- Merge solo dopo il suo «ok merge».

## Attenzione
- La versione: se una PR si unisce dopo un import automatico, la versione può coincidere con main. Dopo il merge di main rilancia `scripts/bump-sw.py`, se no i telefoni non scaricano il codice nuovo.
- Il ramo remoto conserva la storia di prima dello squash: prima della PR `git fetch origin main` e riparti da lì o unisci main.
- Un riavvio della sessione spegne i monitor: il 22/11 la diretta si è persa dalle 15:11. Dopo un riavvio rileggi `storie-oggi` e riaccendi.
- La FSGC corregge marcatore e minuto durante la partita: una storia già uscita non si corregge da sola.
- `apply_migration` chiede conferma ad Alex: avvisarlo prima. Dopo `update_trigger` verificare con `get_trigger`.
