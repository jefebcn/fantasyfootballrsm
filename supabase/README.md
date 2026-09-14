# Supabase — account e leghe multiple

## Progetto collegato

`https://nskgzpbcssnpfuxmbepa.supabase.co` — URL e publishable key sono in `src/config.js`
(valori pubblici: la sicurezza sta nelle policy RLS). Schema applicato; verificato che le
scritture anonime siano rifiutate (`42501`), che `create_league` richieda l'autenticazione e
che `matchday_lock_at(3)` restituisca sabato 19/09/2026 15:00 Europe/Rome, allineato a
`SEASON_START` in `src/data.js`.

## Impostazioni di autenticazione (le uniche che decidono se il login funziona)

L'app offre due strade. Configurale entrambe: la prima non dipende dall'e-mail.

### 1. Password — consigliata per il pilota
**Authentication → Sign In / Providers → Email**
- *Enable Email provider*: acceso
- **"Confirm email": SPENTO**

Con la conferma spenta, chi crea l'account entra subito, senza ricevere nessuna e-mail.
È la strada che evita ogni problema di recapito. Per una lega chiusa va bene: per entrare
serve comunque il codice invito.

### 2. Link o codice via e-mail
**Authentication → URL Configuration**
- *Site URL*: `https://fantasyfootballrsm.vercel.app`
- *Redirect URLs*: `https://fantasyfootballrsm.vercel.app/**` (e `https://*.vercel.app/**` per le preview)

Senza questo, il link ricevuto via e-mail non riporta dentro l'app.

Il modello di e-mail predefinito contiene **solo il link**, nessun codice. Per avere anche il
codice a 6 cifre — utile quando l'e-mail si apre in un browser diverso da quello dell'app —
in **Authentication → Emails → Magic Link** aggiungi una riga con `{{ .Token }}`:

```html
<h2>Entra nel Fantacampionato</h2>
<p><a href="{{ .ConfirmationURL }}">Tocca qui per entrare</a></p>
<p>Oppure inserisci questo codice nell'app: <strong>{{ .Token }}</strong></p>
```

Lo stesso vale per il modello *Confirm signup* se tieni la conferma e-mail accesa.

## Setup da zero
## Modello

- **Generato dal client** (`src/data.js`): società, listone, calendario. Stabili per stagione.
- **Globale** (una volta per tutte le leghe, scrive solo il Giudice Dati): `match_overrides`,
  `match_events`, `match_appearances`, `matchday_status`, `change_log` (automatico via trigger).
- **Per lega**: `leagues`, `league_members` (ruolo `admin` / `fantallenatore`), `rosters`,
  `lineups` (scrivibili solo dal proprietario e solo prima del lock, art. 8.3), `contestazioni`.
- **Congelamento** (art. 9.2): un trigger rifiuta qualunque scrittura sul dato di una giornata
  con `matchday_status = 'frozen'`, anche per il Giudice Dati.
- Senza configurazione l'app resta in **modalità locale** (demo con dati generati).
