# Stato – Fantatitano

Aggiornato: 2026-11-25 notte · temi: piano di crescita (card, traguardo inviti, premi), quarti di Coppa con una partita rimandata

## Dove siamo
- App online su fantatitano.site e su iPhone. Migrazioni fino alla 070 (traguardo inviti, applicata), futsal-14 applicata. Versione su main 4.2.367.
- Crescita (`docs/CRESCITA.md`): card della giornata da condividere fatta (PR #172); contatore del traguardo inviti fatto (PR #173): «3 amici attivi» = amici dal link che confermano la formazione in 2 giornate diverse; il 25/11 27 arrivati, 10 attivi, nessuno a 3.
- Premi decisi (PR #174, `legale/premi-regolamento-bozza.md`): organizza Mediterranean Digital Solutions Ltd, offrono SanderBV e FreshDrops; gin solo ai maggiorenni. BOZZA: niente annunci prima del legale.
- Orologio dei dati FSGC attivo (import ogni 30 min ven-lun, ogni ora mar-gio). Controllo: `select * from interno.fsgc_ultime;`.
- Coppa Fantatitano: quarti di andata mer 25/11, voti importati (0-0, 2-1, 0-1). Domagnano–Tre Fiori RIMANDATA: senza risultato dalla PR #175 (l'import ignora «Rimandato/Sospesa/Annullata» del calendario FSGC); i quarti di andata restano aperti fino al recupero.
- Instagram: controllo della coda lun/mer/ven 9:23 (trig_018i6UNbSQ1ikokJFoCnnTWS); futsal giornaliero (trig_019gaxf1eECjzEK6qMnLV9NA).

## Aperto / in corso
- Recupero di Domagnano–Tre Fiori: quando la FSGC dà la data, i quarti di andata restano aperti fino a lì.
- Legale: far leggere `legale/premi-regolamento-bozza.md` (7 domande). Dopo il via: premi «offerti da» nell'app e premio nel riquadro del traguardo.
- Ven 27/11: orario del referto Virtus–Tre Penne futsal (riapre il mercato della 12ª); coda Buffer 9:23 (formazione del post 6b0402b79c1a68014f61959b: espulsi/infortunati dei quarti).
- Lancio futsal 1/12 solo col via di Alex (`APERTO_A_TUTTI` in `src/views/futsal.js`, poi cancellare `futsal-prova.yml`).
- Semifinali e finale Coppa Titano pubblicate: aggiornare `coppa_turni`. Storia dei quarti di ritorno mer 9/12.
- Per Alex, dal pannello: password rubate su Supabase Auth; backup fuori da GitHub; seconda chiave Buffer.

## Prossimo passo consigliato
- Legale sui premi; poi lancio del traguardo con un post e una storia.

## Decisioni recenti di Alex ancora valide
- Crescita senza provocazioni verso la FSGC; premi in natura o buoni, mai denaro, mai sorteggi (25/11).
- Premi: giornata FreshDrops, mese SanderBV, Coppa box aperitivo con gin (solo 18+), podio entrambi, traguardo SanderBV; FreshDrops sta per attivarsi a San Marino, Sander ha già i gadget.
- Gin: mai bottiglia né marchio nelle grafiche.
- Futsal dal 1/12: la prima rosa si compra subito. Niente ATT per ora.
- Instagram: almeno 5 post e 4-5 storie a settimana, max 1+1 al giorno; mai «fantatitano.site» («Link in bio»).
- Merge solo dopo il suo «ok merge».

## Attenzione
- La FSGC può scrivere «Concluso» su una partita rimandata: vale l'etichetta del calendario (gestito dall'import).
- Il merge via MCP vuole lo SHA completo da 40 caratteri. Il lancio manuale di `dati-fsgc` da qui dà 403: aspettare il giro dell'orologio (mar-gio alle :23 UTC).
- `bump-sw.py` cambia anche `src/versione.js`: metterlo nel commit.
- `npm test` qui vuole prima `npm install --no-save` (manca esbuild).
- Migrazioni: se `apply_migration` scade, file unico `begin; … commit;` nel SQL Editor.
- Dopo `update_trigger` verificare con `get_trigger`.
