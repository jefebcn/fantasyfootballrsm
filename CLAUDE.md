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
- Questo file resta corto (massimo ~5 KB): i dettagli vanno nei documenti indicati sopra, non qui.
