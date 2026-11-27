# Stato – Fantatitano

Aggiornato: 2026-11-27 · temi: storie automatiche del futsal con la foto, coda Buffer del futsal senza doppioni, squadra futsal (bonus/malus, plusvalenza, nomi uguali)

## Dove siamo
- App online su fantatitano.site e su iPhone; versione su main 4.2.382. Migrazioni applicate fino alla 071.
- Unite oggi: #187 (storie automatiche futsal, risultato e giornata, con la foto FSGC di sfondo), #188 (home futsal, da un'altra chat), #189 (bonus e malus coi numeri, plusvalenza sul campo verde/rossa/grigia, titolare sostituito col suo nome, nomi corti unici `F.nomeBreve`).
- Storie automatiche futsal online: le pubblica l'import (`dati-fsgc.yml` → `scripts/storie-futsal.mjs` → funzione `pubblica-futsal`). Virtus–Tre Penne e «I migliori» dell'11ª, perse, pubblicate a mano il 27/11.
- Futsal: si apre a tutti da solo il 01/12 alle 8:00 (`futsalPerTutti`). Mercato della 12ª aperto.
- Personaggi somiglianti: fermi sul ramo `claude/personaggi-prova` (072 NON applicata).

## Aperto / in corso
- Sab 28/11 9:47: il controllo giornaliero riempie i posti liberi della coda Buffer futsal con contenuti NUOVI (confronto con «Già uscito» in `docs/futsal/STATO.md`), numeri dell'11ª, stile a foto piena.
- Personaggi: Alex prova lo stile con Gemini Pro e manda qui immagini e prompt; consenso v2 da far leggere a Elisa.
- Legale sui premi: 7 domande in `legale/premi-regolamento-bozza.md`.
- Dopo il lancio futsal: cancellare `.github/workflows/futsal-prova.yml`.
- Coppa: `coppa_turni` per semifinali e finale quando la FSGC le pubblica; recupero Domagnano–Tre Fiori.
- Per Alex, dal pannello: password rubate su Supabase Auth; backup fuori da GitHub; seconda chiave Buffer.

## Prossimo passo consigliato
- Post Instagram (@fantatitano) sulle novità dell'app: pronostici con classifica «Tutti» / «La tua lega» (la 10 chiude sab 28/11 alle 13:50), highlights con gli stemmi nuovi. Niente personaggi né premi.
- Al primo import di sabato/domenica guardare nel log del lavoro FSGC le righe STORIA/PUBBLICATA del futsal.

## Decisioni recenti di Alex ancora valide
- Fantavoti e «I migliori» del futsal si mostrano già prima del lancio (27/11), sempre col riquadro «Si gioca dal 01/12»; classifiche complete e quotazioni dopo l'apertura.
- Social futsal: copertina a foto piena spesso; dal 1/12 alternare tecniche; mai ripetere un contenuto già uscito; foto all'aperto ammesse; nomi dei giocatori ammessi.
- Futsal aperto il 01/12 alle 8, corona alla stessa ora.
- Premi in natura o buoni, mai denaro né sorteggi; niente annunci prima del legale.
- Instagram: almeno 5 post e 4-5 storie a settimana; mai «fantatitano.site» nelle grafiche.
- Merge solo dopo il suo «ok merge».

## Attenzione
- La PR può andare in conflitto su `sw.js`/`src/versione.js` mentre aspetta (import automatici): unire main, tenere la versione di main e rilanciare `bump-sw.py`.
- Il merge via MCP vuole lo SHA completo; unire solo con CI verde sull'ultima testa.
- Storia automatica persa: `--anteprima <g>` in locale, Higgsfield, UNA chiamata a Buffer, poi la riga in `storie_pubblicate` (ricetta in `docs/RICETTE.md`).
- I download da Drive via MCP finiscono nel contesto: i download in blocco a un Agent.
- Dopo `update_trigger` verificare con `get_trigger`.
