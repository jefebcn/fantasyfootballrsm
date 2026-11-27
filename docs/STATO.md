# Stato – Fantatitano

Aggiornato: 2026-11-27 (fine sessione) · temi: post delle novità, collaborazione con Il Pianello, piccola correzione del futsal

## Dove siamo
- App online su fantatitano.site e su iPhone; le app aprono il sito, quindi ogni deploy arriva anche lì. Versione su main 4.2.383. Migrazioni applicate fino alla 071 (pronostici).
- Unite: PR #186 (stato), #188 (home del futsal: «manca 1 partita» al singolare) e #190 (Il Pianello: documento, materiale, stato).
- Instagram: carosello «Tre cose nuove nell'app» (pronostici, highlights, card della giornata, più la slide FantaFutsal «in arrivo») programmato per ven 27/11 alle 11:30 (Buffer 6b08b7066fabe326fab8763d); dettagli nel kit (`kit/STATO.md`).
- **Il Pianello** (sito di notizie e pagina Instagram, circa 14 mila follower): pubblica gratis la notizia del FantaFutsal e offre uno spazio fisso sul suo sito per una rubrica sul campionato. Tutto in `docs/PIANELLO.md` e `social/pianello/`, con una copia in Google Drive (cartella «Fantatitano – Il Pianello»).
- Futsal: si apre a tutti da solo il 01/12 alle 8:00 (`futsalPerTutti` in `src/lancio-futsal.js`), con la corona del lancio fino al 14/12.
- Personaggi somiglianti: tutto sul ramo `claude/personaggi-prova` (072 NON applicata, `docs/PERSONAGGI.md`).

## Aperto / in corso
- Il Pianello: Alex ha mandato materiale e messaggio il 27/11; si aspetta la risposta su come organizzarsi. Le prossime chat su questo tema partono da `docs/PIANELLO.md` (Alex le apre a parte).
- Personaggi: Alex prova lo stile con Gemini Pro e manda qui immagini e prompt; testo v2 del consenso da far leggere a Elisa.
- Legale sui premi: 7 domande in `legale/premi-regolamento-bozza.md`.
- Dopo il lancio futsal: cancellare `.github/workflows/futsal-prova.yml`.
- Coppa: `coppa_turni` per semifinali e finale quando escono; recupero di Domagnano–Tre Fiori.
- Da scegliere: piano B dei dati FSGC oppure eventi in bacheca + rosa lampo + classifica tra leghe (`docs/PIANO-LAVORI.md`).
- Per Alex, dal pannello: password rubate su Supabase Auth; backup fuori da GitHub; seconda chiave Buffer.

## Prossimo passo consigliato
- Mar 1/12: verificare che il futsal si apra alle 8 e che Il Pianello pubblichi la notizia (in mattinata, dopo le 8).
- Dopo i referti della 10ª: preparare un esempio della rubrica settimanale per Il Pianello, solo se loro sono d'accordo (`docs/PIANELLO.md`, «Prossimi passi»).

## Decisioni recenti di Alex ancora valide
- Materiale per Il Pianello: mai «FSGC», mai l'orario «alle 8», corona del lancio metà viola e metà arancio, «gratuito per tutti» (senza promesse), niente immagini IA né nomi di giocatori.
- Personaggi in silenzio: non in main, non annunciati, finché lo stile non convince. Foto vere di calciatori solo col consenso e via API.
- Premi in natura o buoni, mai denaro né sorteggi; niente annunci prima del legale. Gin: mai bottiglia né marchio.
- Niente marchi sportivi nei disegni. Instagram: almeno 5 post e 4-5 storie a settimana; mai «fantatitano.site» nelle grafiche.
- Merge solo dopo il suo «ok merge».

## Attenzione
- Il merge via MCP vuole lo SHA completo da 40 caratteri. Dopo un merge con squash, unire main nel ramo di lavoro.
- Commit e push vanno in comandi separati (insieme li blocca il controllo automatico dei permessi).
- `bump-sw.py` cambia anche `src/versione.js`: metterlo nel commit.
- Pagine web che rispondono vuote alla lettura automatica (Il Pianello): aprirle con Playwright (`page.goto` + `innerText`).
- Dopo `update_trigger` verificare con `get_trigger`.
