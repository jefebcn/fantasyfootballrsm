# Fantatitano

Fantacalcio sul Campionato Sammarinese di calcio: asta a crediti, rose, formazioni
settimanali, scontro diretto — **senza pagelle**. I voti (Voto Titano) sono calcolati da
eventi oggettivi del referto FSGC.

**App (PWA)** — installabile su iPhone/Android dalla schermata "Aggiungi a Home".
Richiede un account (Supabase: password, link via e-mail, e Google/Apple se attivati), leghe multiple con
codice invito, ruoli (admin di lega, Giudice Dati), rose, formazioni e contestazioni
condivise, dato del campionato inserito una volta per tutte le leghe, aggiornamenti in
tempo reale. Setup in [`supabase/README.md`](supabase/README.md) (schema e policy RLS in
[`supabase/schema.sql`](supabase/schema.sql)); chiavi pubbliche in `src/config.js`.

Anagrafiche e calendario (16 società, ~400 tesserati, 30 giornate) sono generati dal client
in modo deterministico: sono uguali per tutte le leghe e non serve caricarli.

## Struttura

| Percorso | Contenuto |
|---|---|
| `index.html` · `manifest.webmanifest` · `sw.js` · `icons/` | Shell PWA, manifest, service worker, icone |
| `src/engine.js` | **Motore di scoring** puro (artt. 4–8, 10–12): `computeRating`, `computeLineupResult`, `computeStandings`, conversione in gol |
| `src/data.js` | Anagrafiche e calendario generati; eventi di esempio per le prime giornate (usati solo dal Giudice Dati per popolare il database) |
| `src/state.js` | Stato applicativo: anagrafiche generate + dato e leghe da Supabase (`src/backend.js`) |
| `src/backend.js` · `src/config.js` | Adattatore Supabase (leghe, rose, formazioni, dato globale, realtime) e chiavi pubbliche |
| `src/auth-clerk.js` | Identità via Clerk, **disattivata**: si accende valorizzando `CLERK_PUBLISHABLE_KEY` in `src/config.js` |
| `src/views/onboarding.js` · `media/` | Presentazione al primo avvio su sfondo video (`media/intro.mp4`, facoltativo) |
| `supabase/migrations/` | Migrazioni SQL; la 001 rende l'identità indipendente dal fornitore (Clerk o Supabase Auth) |
| `supabase/schema.sql` | Tabelle, funzioni (`create_league`, `join_league`, lock formazioni, congelamento), trigger di log e policy RLS |
| `src/app.js` · `src/ui.js` · `src/views/` | Router hash, shell (app bar, drawer, bottom bar), componenti e le viste |
| `styles/app.css` | CSS dell'app, derivato dal design kit; i token vivono in `design/tokens/tokens.css` |
| `tests/engine.test.js` | Test dei casi limite del regolamento (17 test) |
| `tests/mock-supabase.js` | Mock in memoria di supabase-js per lo smoke test del flusso account/leghe |
| `design/` | Design kit: identità, sistema, architettura informativa, schermate, prototipo (`design/index.html`) |

## Sviluppo

```bash
npm test          # motore di scoring
npm start         # http://localhost:4173 (server statico)
python3 scripts/make-icons.py   # rigenera le icone
```

Deploy: statico su Vercel dal branch `main`; il design kit resta raggiungibile su `/design/`.

**Le prove decidono se il deploy parte.** `vercel.json` passa a Vercel un
`ignoreCommand` (`scripts/vercel-controlla.sh`) che, prima del build, gira lint
e prove senza browser: se qualcosa è rosso il deploy **non parte** e resta
online la versione di prima. Attenzione alla logica, che è rovesciata perché
l'ignoreCommand risponde a «devo ignorare questo commit?»: uscita 0 = ignora
(niente deploy), uscita 1 = procedi. Prima la CI girava in parallelo al deploy,
quindi una versione rotta era online da un pezzo quando il rosso arrivava.
Le prove col browser restano in CI: servono un Chromium, e dieci minuti di
attesa a ogni push non si mettono davanti a una distribuzione.

## Che giornata si gioca

Tre nozioni diverse, e tenerle separate è quello che evita il guasto in cui
l'app annuncia una giornata finita tre settimane prima:

- **`giornataAperta()`** — la prima che si chiude nel futuro. Viene dal
  calendario FSGC e da nient'altro, quindi non si pianta mai.
- **`currentMatchday()`** — la più avanti fra l'ultima col lock passato e
  l'ultima con dei dati inseriti. Era definita solo come la seconda, e senza
  referti caricati restava la prima per sempre.
- **`primaGiornata()`** — la prima giornata *di questa lega*: quella ancora
  aperta quando la lega è stata creata. Una lega nata a metà settembre non ha
  una prima, una seconda e una terza giornata, e non deve chiederne i voti.
  Si ricava dalla data di creazione, non da una colonna: così vale anche per
  le leghe che esistono già.

Da qui derivano il calendario degli scontri (niente prima di `primaGiornata`),
la classifica, la formazione da schierare e la scheda "Da calcolare" in home.

`prove/giornata-corrente.cjs` sposta l'orologio in tre momenti della stagione
e controlla cosa dice l'app, compreso che la data di chiusura mostrata non sia
mai nel passato.


## Dal campo alla lega: due binari, non uno

Il **risultato di campionato** e i **voti della lega** si muovono in momenti
diversi, e confonderli e' stato il guasto di sabato 19 settembre: tre partite
giocate il venerdi' sera, e nell'app niente.

- Il risultato, gli stadi e i tabellini arrivano dall'import della FSGC
  (`scripts/importa-fsgc.py`, workflow `Dati FSGC`) dentro
  `src/calendario-dati.js` e `src/eventi-dati.js`. Sono file del repository:
  entrano in produzione con un deploy. Il lavoro si propone **ogni due ore**,
  perche' GitHub le corse pianificate le accoda — il cron delle 05:30 e'
  partito alle 09:55, alle 10:09, alle 10:06.
- I voti dei singoli invece nascono dagli **eventi nel database**
  (`match_events`, `match_appearances`): finche' quelli mancano, una gara
  finita in lega non ha voti, e la schermata Voti lo dice ("Voti in arrivo").

Il secondo passo era un bottone da premere a mano, e UNA VOLTA SOLA: gli
eventi si inseriscono e non si aggiornano, quindi la seconda premuta avrebbe
contato ogni gol due volte. Adesso succede da solo, all'apertura del Giudice
Dati (`state.js`, accanto al calendario dei lock), con due regole:

- si caricano solo le giornate che in lega sono **vuote** — una che ha gia'
  anche un solo evento e' roba del Giudice e non si tocca;
- una giornata per volta, e se si rompe a meta' si ripulisce: mezza giornata
  dentro non verrebbe mai piu' completata.

`migrations/016-eventi-senza-doppioni.sql` mette la stessa regola nel
database, dove vale anche se due Giudici aprono l'app insieme.
`prove/referti-lega.cjs` misura tutto: entrano da soli, riaprire non duplica,
una giornata svuotata rientra, una toccata a mano resta com'e'.
## Ruoli

| Ruolo | Come si ottiene | Cosa può fare |
|---|---|---|
| Fantallenatore | entra in una lega con il codice | formazione, contestazioni, tutto in lettura |
| Admin di lega | crea la lega (o nominato da un admin) | partecipanti e ruoli, rose (draft automatico o a mano), invito |
| Giudice Dati | `profiles.is_judge = true` dal database | eventi, risultati, presenze, contestazioni, congelamento — per tutte le leghe |

## Viste

Dashboard · Rosa · Formazione (moduli, capitano/vice, panchina ordinata, lock) · Calendario
(scontri di lega + partite reali con campo e Titani.TV) · Classifica · Voti (breakdown di ogni
fantavoto, segnalazione errori) · Live (campo lungo, panchina, totali) · Listone · Giocatore ·
Mercato libero · Regolamento · Scheda condivisibile · Impostazioni · Accesso · Le mie leghe · Gestione lega.

L'app ha sei stati d'ingresso, ciascuno con la sua schermata: server non configurato,
server irraggiungibile (con riprova), primo avvio (presentazione), non autenticato,
nessuna lega, pronta. La presentazione appare una sola volta per dispositivo. Non esiste
una modalità con dati finti: senza dati inseriti le viste lo dicono invece di inventare
risultati.

Giudice Dati: giornata (8 partite, avanzamento) · inserimento partita in 4 passi (risultato e
stato, chi ha giocato, eventi con tastiera, anteprima voti) · contestazioni · congelamento con
conferma digitata · registro modifiche.

## Chi lo fa

Progetto di **Alex Conti**, che lo cura e ne decide le scelte. Gestito da
Mediterranean Digital Solutions Ltd (Malta), che è il titolare del trattamento:
i dati completi stanno in `src/config.js` ed escono nelle pagine legali dell'app.

## Riferimenti

- Regolamento: *Regolamento Fantatitano — Sistema a Voto Titano* (bozza v1.0)
- README di prodotto: *Fantatitano* (contesto, priorità, modello dati, motore)
