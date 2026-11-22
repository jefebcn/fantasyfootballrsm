# Fantatitano

Fantacalcio gratuito sul Campionato Sammarinese (fantatitano.site), PWA statica + Supabase, app iPhone/Android con Capacitor. Proprietario: Alex Conti. Scrivi e rispondi sempre in italiano.

## Dove guardare (leggere solo quello che serve al lavoro di oggi)

| Lavoro | File |
|---|---|
| Mappa del codice (motore, stato, backend, viste, stili) | `README.md`, sezione «Struttura» |
| Regole di gioco, giornate, ruoli, viste | `README.md` (sezioni omonime) e `src/engine.js` |
| Database, RLS, funzioni, migrazioni | `supabase/README.md`, `supabase/migrations/` |
| App Store / Play Store | `IOS.md`, `PLAY.md`, `store/` |
| Dominio e DNS | `DNS.md` |
| Monetizzazione | `MONETIZZAZIONE.md` |
| Controlli e avvisi automatici | `MONITORAGGIO.md`, `.github/workflows/` |
| Storie e gol per i social | `social/`, `scripts/storie-gol.mjs`, `scripts/pubblica-storia.mjs` |
| FantaTitano Futsal (gioco, import, Instagram @fantatitano.futsal) | `docs/futsal/STATO.md`, `docs/futsal/RICETTE.md`, `FUTSAL.md`; prima del lancio lo vede solo il proprietario (`APERTO_A_TUTTI` in `src/views/futsal.js`) |
| Instagram automatico (post e storie su Buffer) | kit social fuori dal repo (`kit/STATO.md`, `kit/PLAYBOOK.md`); controllo della coda lun/mer/ven che riempie i 10 posti (regole nei giri lunedì e giovedì, spenti); ricette in `docs/RICETTE.md` |
| Video (HyperFrames) | `/regia-hyperframes` o la skill `hyperframes` (porta d'ingresso); progetti in `videos/` e `regia/`. Le altre 20 skill video sono nascoste (`disable-model-invocation: true`) per non pagarle in ogni sessione: quando un passo dice `/nome`, leggi `.claude/skills/<nome>/SKILL.md`. Se `npx hyperframes skills update` toglie quella riga, rimettila. |

I documenti grandi (`IOS.md` e `PLAY.md` 23 KB, `MONETIZZAZIONE.md` 17 KB) si leggono solo per quel lavoro, cercando con grep la sezione giusta.

## Regole

- Prima del push: `npm test` (lint + prove). Il deploy su Vercel parte solo se le prove sono verdi (`scripts/vercel-controlla.sh`).
- Le modifiche al database vanno salvate anche in `supabase/migrations/`.
- Brand: il logo originale (corona viola disegnata a mano) non si modifica. Font: Anton per i titoli grandi, Bebas Neue per i titoli alternativi, Montserrat per sottotitoli e testi. La mascotte è Tito, draghetto viola streetwear (felpa nera, cargo viola), senza corona.
- Social: niente inviti tipo «scrivetelo nei commenti». Le partite si giocano sabato e domenica.
- Mai citare le app a cui ci ispiriamo (app, social, codice, documenti): il gioco si presenta da solo.
- Buffer: al massimo una chiamata per pubblicazione, mai controlli in continuo (20/11: blocco di 24 ore). Le storie uscite si leggono dalla funzione `storie-oggi`.
- Non inventare dati del campionato: le fonti sono il referto FSGC e gli script `scripts/importa-*.py`.
- Questo file resta corto: i dettagli vanno nei documenti indicati sopra, non qui.

## Ripartenza: sapere a che punto siamo (pochi token)

All'inizio di ogni sessione (o quando Alex scrive «RIPRENDI <progetto>»), prima di qualsiasi altro file:
1. Questo CLAUDE.md è già caricato: non rileggerlo.
2. Leggi `docs/STATO.md` (corto: dove siamo, cosa è aperto, prossimo passo, decisioni recenti di Alex).
3. Controlla cosa è successo dopo la data di STATO.md, che è la fonte più precisa: `git log --oneline -15` e `git status -s` (altre chat, PR unite, automazioni). Se git e STATO non coincidono, vale git, e lo dici in una riga.
4. Se Alex ha già detto il lavoro di oggi, grep della parola chiave in `docs/RICETTE.md`, poi apri solo i documenti di quell'area. Se non l'ha detto, riassumi in 3 righe dove siamo e chiedi soltanto cosa fare oggi e se è cambiato qualcosa fuori dal repo (pannelli, store, social).
5. Non esplorare il repo e non aprire documenti grandi prima di sapere il lavoro.

## Fine lavoro: salvare il punto e imparare senza appesantire

Quando Alex scrive «SESSIONE FINITA» (o un lavoro si chiude), prima della risposta finale:
1. **Riscrivi `docs/STATO.md`** (al massimo ~40 righe, si sostituisce, non si accoda), con le sezioni: data e tema della sessione; Dove siamo (3-6 righe); Aperto / in corso (con file o PR); Prossimo passo consigliato; Decisioni recenti di Alex ancora valide; Attenzione (trappole attive). Le cose chiuse escono dallo STATO: restano in git.
2. Ripensa alla sessione senza rileggere file: cosa è costato più tentativi o letture, cosa ha funzionato al primo colpo, cosa si ripeterà.
3. Salva solo ciò che fa risparmiare la volta dopo, nel posto giusto:
   - regola valida per tutto il progetto (comando, trappola, scelta di Alex) → una riga in questo CLAUDE.md;
   - dettaglio di un'area (come funziona un modulo, un servizio, un deploy) → il documento di quell'area già indicato sopra;
   - lavoro che si ripete (pubblicare, importare, rigenerare, rilasciare) → una riga in `docs/RICETTE.md` (crealo se manca): `COSA | comando o script | trappole | la prossima volta: …`.
4. Limiti di peso, perché questo file si carica in ogni sessione: CLAUDE.md al massimo ~8 KB; righe corte; se una riga nuova sostituisce una vecchia, togli la vecchia; niente diario («fatto il …»), niente elenchi di commit, niente stato del giorno qui (va in STATO.md).
5. Commit di STATO, RICETTE e CLAUDE.md insieme al lavoro (stesso ramo o stessa PR).
6. Nella risposta finale, una riga: cosa hai salvato e dove.
