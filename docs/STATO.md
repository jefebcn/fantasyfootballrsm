# Stato – Fantatitano

Aggiornato: 2026-11-26 sera · temi: ritocchi di home e pronostici, personaggi somiglianti (in disparte), lancio futsal automatico, stemmi negli highlights

## Dove siamo
- App online su fantatitano.site e su iPhone; le app aprono il sito, quindi ogni deploy arriva anche lì. Versione su main 4.2.374. Migrazioni applicate fino alla 071 (pronostici).
- Unite oggi: PR #178 (home e pronostici più puliti), #180 (ombra corta del personaggio in copertina), #181 (torre del Titano libera dalla targa, personaggio 230 senza marchio, futsal automatico, prove pronte per il lancio), #182 (stato), #183 (futsal a giornata in corso, da un'altra chat), #184 (highlights con gli stemmi nuovi dei club al posto delle maglie).
- Futsal: si apre a tutti da solo il 01/12 alle 8:00 (`futsalPerTutti` in `src/lancio-futsal.js`), corona del lancio alla stessa ora fino al 14/12. Niente da caricare sugli store.
- Personaggi somiglianti: tutto sul ramo `claude/personaggi-prova` (072 NON applicata, `docs/PERSONAGGI.md` con scheda di stile e prompt per Gemini Pro). PR #179 chiusa senza unirla.
- Pronostici: classifica «Tutti» e «La tua lega», dalla giornata 10 (chiude sab 28/11 alle 13:50).

## Aperto / in corso
- Personaggi: Alex prova lo stile in una chat di Claude in Chrome con Gemini Pro (prompt dato in chat il 26/11) e manda qui immagini e prompt; testo v2 del consenso (nella 072 sul ramo) da far leggere a Elisa.
- Legale sui premi: 7 domande in `legale/premi-regolamento-bozza.md` (date ad Alex il 26/11 in chiaro).
- Ven 27/11: coda Buffer 9:23 e referto Virtus–Tre Penne futsal (Alex: ok come al solito).
- Dopo il lancio futsal: cancellare `.github/workflows/futsal-prova.yml`.
- Coppa: `coppa_turni` per semifinali e finale quando la FSGC le pubblica; recupero di Domagnano–Tre Fiori.
- Da scegliere: piano B dei dati FSGC oppure eventi automatici in bacheca + rosa lampo + classifica tra leghe (`docs/PIANO-LAVORI.md`).
- Per Alex, dal pannello: password rubate su Supabase Auth; backup fuori da GitHub; seconda chiave Buffer.

## Prossimo passo consigliato
- Alla ripresa (Alex, 26/11 sera): un post Instagram su un paio di novità recenti dell'app, venerdì 27/11 o lunedì 30/11. Candidate: pronostici della giornata con classifica «Tutti» e «La tua lega» (la 10 chiude sab 28/11 alle 13:50, quindi venerdì è il giorno giusto); highlights con gli stemmi nuovi; home più pulita. Non citare personaggi né premi.
- Poi scegliere il prossimo lavoro grosso; intanto confrontare le prove dei personaggi appena arrivano.

## Decisioni recenti di Alex ancora valide
- Personaggi in silenzio: non in main, non annunciati, finché lo stile non convince. Stile = figure intere dei 101-230 (non mezzibusti, non vettoriale, non 3D). Foto vere di calciatori solo col consenso e via API.
- Futsal aperto il 01/12 alle 8, corona alla stessa ora.
- Premi in natura o buoni, mai denaro né sorteggi; niente annunci prima del legale. Gin: mai bottiglia né marchio.
- Niente marchi sportivi nei disegni (maglie e scarpe).
- Instagram: almeno 5 post e 4-5 storie a settimana; mai «fantatitano.site» nelle grafiche.
- Merge solo dopo il suo «ok merge».

## Attenzione
- Prima di cambiare una variabile CSS della copertina leggi il commento «Alex, data» sopra: il 26/11 `--cielo` a 14px aveva rifatto il taglio della torre del 20/11 (ora lo controlla `prove/dash-tre.cjs`).
- Il merge via MCP vuole lo SHA completo da 40 caratteri. Dopo un merge con squash, unire main nel ramo di lavoro.
- `bump-sw.py` cambia anche `src/versione.js`: metterlo nel commit.
- Stemmi grandi dei club: `media/stemmi/<id>.webp` (il `-mini` solo per le liste); le maglie disegnate restano per le squadre fanta.
- Higgsfield ha ~0 crediti; le immagini di prova escono da Figma (`generate_image`, modello Gemini, solo testo).
- Dopo `update_trigger` verificare con `get_trigger`.
