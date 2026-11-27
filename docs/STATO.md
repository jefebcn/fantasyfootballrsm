# Stato – Fantatitano

Aggiornato: 2026-11-27 · temi: storie automatiche del futsal con la foto, squadra futsal (bonus/malus, plusvalenza, nomi uguali), coda Buffer futsal senza doppioni; in un'altra chat post delle novità e collaborazione con Il Pianello

## Dove siamo
- App online su fantatitano.site e su iPhone; versione su main 4.2.382. Migrazioni applicate fino alla 071.
- Unite il 27/11: #187 (storie automatiche futsal, risultato e giornata, con la foto FSGC di sfondo), #188 (home futsal), #189 (bonus e malus coi numeri, plusvalenza sul campo verde/rossa/grigia, titolare sostituito col suo nome, nomi corti unici `F.nomeBreve`), #190 (Il Pianello).
- Storie automatiche futsal online: le pubblica l'import (`dati-fsgc.yml` → `scripts/storie-futsal.mjs` → funzione `pubblica-futsal`). Virtus–Tre Penne e «I migliori» dell'11ª, perse, pubblicate a mano il 27/11.
- Instagram @fantatitano: carosello «Tre cose nuove nell'app» programmato ven 27/11 alle 11:30 (Buffer 6b08b7066fabe326fab8763d; dettagli in `kit/STATO.md`).
- **Il Pianello** (sito di notizie e pagina Instagram, circa 14 mila follower): pubblica gratis la notizia del FantaFutsal e offre uno spazio fisso per una rubrica. Tutto in `docs/PIANELLO.md` e `social/pianello/`, copia in Drive («Fantatitano – Il Pianello»).
- Futsal: si apre a tutti da solo il 01/12 alle 8:00 (`futsalPerTutti`), corona del lancio fino al 14/12. Mercato della 12ª aperto.
- Personaggi somiglianti: fermi sul ramo `claude/personaggi-prova` (072 NON applicata).

## Aperto / in corso
- Sab 28/11 9:47: il controllo giornaliero riempie i posti liberi della coda Buffer futsal con contenuti NUOVI (confronto con «Già uscito» in `docs/futsal/STATO.md`), numeri dell'11ª, stile a foto piena.
- Il Pianello: si aspetta la loro risposta; le chat su questo tema partono da `docs/PIANELLO.md` (Alex le apre a parte).
- Personaggi: Alex prova lo stile con Gemini Pro; consenso v2 da far leggere a Elisa.
- Legale sui premi: 7 domande in `legale/premi-regolamento-bozza.md`.
- Dopo il lancio futsal: cancellare `.github/workflows/futsal-prova.yml`.
- Coppa: `coppa_turni` per semifinali e finale quando escono; recupero Domagnano–Tre Fiori.
- Per Alex, dal pannello: password rubate su Supabase Auth; backup fuori da GitHub; seconda chiave Buffer.

## Prossimo passo consigliato
- Al primo import di sabato/domenica: nel log del lavoro FSGC, righe STORIA/PUBBLICATA del futsal.
- Mar 1/12: verificare che il futsal si apra alle 8 e che Il Pianello pubblichi la notizia.

## Decisioni recenti di Alex ancora valide
- Fantavoti e «I migliori» del futsal si mostrano già prima del lancio, sempre col riquadro «Si gioca dal 01/12»; classifiche complete e quotazioni dopo l'apertura.
- Social futsal: copertina a foto piena spesso; dal 1/12 alternare tecniche; mai ripetere un contenuto già uscito; foto all'aperto e nomi dei giocatori ammessi.
- Materiale per Il Pianello: mai «FSGC», mai l'orario «alle 8», corona metà viola e metà arancio, «gratuito per tutti», niente immagini IA né nomi di giocatori.
- Personaggi in silenzio finché lo stile non convince. Premi in natura o buoni, mai denaro né sorteggi; niente annunci prima del legale.
- Instagram: almeno 5 post e 4-5 storie a settimana; mai «fantatitano.site» nelle grafiche.
- Merge solo dopo il suo «ok merge».

## Attenzione
- Una PR in attesa va in conflitto su `sw.js`/`src/versione.js` (import automatici) o su STATO/RICETTE (altre chat): unire main; per la versione tenere quella di main e rilanciare `bump-sw.py`.
- Il merge via MCP vuole lo SHA completo; unire solo con CI verde sull'ultima testa.
- Storia automatica persa: ricetta in `docs/RICETTE.md` (anteprima, Higgsfield, UNA chiamata a Buffer, riga in `storie_pubblicate`).
- Commit e push in comandi separati se il controllo dei permessi li blocca insieme.
- Pagine che rispondono vuote alla lettura automatica (Il Pianello): Playwright (`page.goto` + `innerText`).
- Dopo `update_trigger` verificare con `get_trigger`.
