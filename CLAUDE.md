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
| Video (HyperFrames) | `/regia-hyperframes`, poi le skill in `.claude/skills/`; progetti in `videos/` e `regia/` |

I documenti grandi (`IOS.md` e `PLAY.md` 23 KB, `MONETIZZAZIONE.md` 17 KB) si leggono solo per quel lavoro, cercando con grep la sezione giusta.

## Regole

- Prima del push: `npm test` (lint + prove). Il deploy su Vercel parte solo se le prove sono verdi (`scripts/vercel-controlla.sh`).
- Le modifiche al database vanno salvate anche in `supabase/migrations/`.
- Brand: il logo originale (corona viola disegnata a mano) non si modifica. Font: Anton per i titoli grandi, Bebas Neue per i titoli alternativi, Montserrat per sottotitoli e testi. La mascotte è Tito, draghetto viola streetwear (felpa nera, cargo viola), senza corona.
- Social: niente inviti tipo «scrivetelo nei commenti». Le partite si giocano sabato e domenica.
- Non inventare dati del campionato: le fonti sono il referto FSGC e gli script `scripts/importa-*.py`.
- Questo file resta corto: i dettagli vanno nei documenti indicati sopra, non qui.

## Fine lavoro: imparare senza appesantire

Quando Alex scrive «SESSIONE FINITA» (o un lavoro si chiude), prima della risposta finale:
1. Ripensa alla sessione senza rileggere file: cosa è costato più tentativi o letture, cosa ha funzionato al primo colpo, cosa si ripeterà.
2. Salva solo ciò che fa risparmiare la volta dopo, nel posto giusto:
   - regola valida per tutto il progetto (comando, trappola, scelta di Alex) → una riga in questo CLAUDE.md;
   - dettaglio di un'area (come funziona un modulo, un servizio, un deploy) → il documento di quell'area già indicato sopra;
   - lavoro che si ripete (pubblicare, importare, rigenerare, rilasciare) → una riga in `docs/RICETTE.md` (crealo se manca): `COSA | comando o script | trappole | la prossima volta: …`.
3. Limiti di peso, perché questo file si carica in ogni sessione: CLAUDE.md al massimo ~8 KB; righe corte; se una riga nuova sostituisce una vecchia, togli la vecchia; niente diario («fatto il …»), niente elenchi di commit, niente stato temporaneo: quelli stanno in git.
4. Nella risposta finale, una riga: cosa hai salvato e dove.

A inizio lavoro: se il lavoro somiglia a uno già fatto, cerca con grep in `docs/RICETTE.md` prima di ripartire da zero.
