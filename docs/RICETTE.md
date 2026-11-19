# Ricette (lavori che si ripetono)

COSA | comando o script | trappole | la prossima volta
---|---|---|---
Import referti futsal + quotazioni | `python3 scripts/importa-futsal.py` → rigenera `src/futsal-dati.js` e `supabase/migrations/futsal-05-quotazioni.sql`; applica l'SQL con Supabase `execute_sql` (progetto nskgzpbcssnpfuxmbepa) | referti FSGC 15-22 h dopo la gara; `V.QUOTATI` è una funzione | controlla prima che tutti i referti della giornata ci siano: il mercato apre solo a giornata conclusa
Post/storia Instagram futsal | HTML → Playwright (1080x1350 post, 1080x1920 storia; Teko/Lato in base64; palette #F2F0E9 #111 #FF4B2B) → Higgsfield `media_upload` + PUT `Content-Type: image/jpeg` + `media_confirm` → URL pubblico | il credito «© FSGC / Fotografo» si prende dalla didascalia della news FSGC | tieni la mappa dei fotografi nello script e riusala in ogni grafica
Programmare su Buffer | GraphQL `https://api.buffer.com` (chiave messa dal proxy), `createPost` con `schedulingType:'automatic'`, `mode:'customScheduled'`, `dueAt` in UTC, `metadata.instagram {type, shouldShareToFeed, isAiGenerated:true}` | max 10 in coda nel piano gratuito; storie senza testo | canale fantatitano.futsal 6afc2100ece6dfde5ff5006f
Modifica a main mentre si lavora su `futsal` | worktree a parte da `origin/main` su un ramo `claude/...`, PR, test verdi | il push su main pubblica: serve l'ok esplicito di Alex | mai portare file futsal dell'app in quel ramo
