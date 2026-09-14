# Supabase — account e leghe multiple

1. Crea un progetto su [supabase.com](https://supabase.com) (regione EU).
2. **SQL Editor** → incolla ed esegui `schema.sql`.
3. **Authentication → Providers → Email**: lascia attivo "Email", abilita *magic link / OTP*
   (nessuna password). In **URL Configuration** aggiungi l'URL Vercel dell'app fra i
   *Redirect URLs* (es. `https://fantasyfootballrsm.vercel.app/`).
4. **Settings → API**: copia *Project URL* e *anon public key* in `src/config.js`
   (oppure inseriscili dall'app in Impostazioni → «Connetti Supabase», salvati solo sul dispositivo).
5. Nomina il Giudice Dati: nell'SQL Editor
   `update public.profiles set is_judge = true where id = (select id from auth.users where email = '…');`
6. Nell'app: accedi con l'e-mail → crea la lega → condividi il codice invito → quando i
   partecipanti sono dentro, l'admin genera le rose (draft automatico o inserimento manuale).

## Modello

- **Generato dal client** (`src/data.js`): società, listone, calendario. Stabili per stagione.
- **Globale** (una volta per tutte le leghe, scrive solo il Giudice Dati): `match_overrides`,
  `match_events`, `match_appearances`, `matchday_status`, `change_log` (automatico via trigger).
- **Per lega**: `leagues`, `league_members` (ruolo `admin` / `fantallenatore`), `rosters`,
  `lineups` (scrivibili solo dal proprietario e solo prima del lock, art. 8.3), `contestazioni`.
- **Congelamento** (art. 9.2): un trigger rifiuta qualunque scrittura sul dato di una giornata
  con `matchday_status = 'frozen'`, anche per il Giudice Dati.
- Senza configurazione l'app resta in **modalità locale** (demo con dati generati).
