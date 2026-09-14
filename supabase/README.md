# Supabase — account e leghe multiple

## Progetto collegato

`https://nskgzpbcssnpfuxmbepa.supabase.co` — URL e publishable key sono in `src/config.js`
(valori pubblici: la sicurezza sta nelle policy RLS). Schema applicato; verificato che le
scritture anonime siano rifiutate (`42501`), che `create_league` richieda l'autenticazione e
che `matchday_lock_at(3)` restituisca sabato 19/09/2026 15:00 Europe/Rome, allineato a
`SEASON_START` in `src/data.js`.

## Setup da zero

1. Crea un progetto su [supabase.com](https://supabase.com) (regione EU).
2. **SQL Editor** → incolla ed esegui `schema.sql`.
3. **Authentication → Providers → Email**: lascia attivo "Email", abilita *magic link / OTP*
   (nessuna password). In **URL Configuration** aggiungi l'URL Vercel dell'app fra i
   *Redirect URLs* (es. `https://fantasyfootballrsm.vercel.app/`).
4. **Settings → API**: copia *Project URL* e *anon public key* in `src/config.js`
   (oppure inseriscili dall'app in Impostazioni → «Connetti Supabase», salvati solo sul dispositivo).
5. Nomina il Giudice Dati **dopo il primo accesso** di quella persona (il profilo nasce al
   primo login): nell'SQL Editor
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
