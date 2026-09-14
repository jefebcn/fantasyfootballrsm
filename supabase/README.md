# Supabase — account e leghe multiple

## Progetto collegato

`https://nskgzpbcssnpfuxmbepa.supabase.co` — URL e publishable key sono in `src/config.js`
(valori pubblici: la sicurezza sta nelle policy RLS). Schema applicato; verificato che le
scritture anonime siano rifiutate (`42501`), che `create_league` richieda l'autenticazione e
che `matchday_lock_at(3)` restituisca sabato 19/09/2026 15:00 Europe/Rome, allineato a
`SEASON_START` in `src/data.js`.

## Impostazioni di autenticazione (le uniche che decidono se il login funziona)

L'app offre quattro strade: **Google**, **Apple**, **password** e **link via e-mail**.
I pulsanti social compaiono solo se il provider è attivo sul progetto.

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


### 3. Google e Apple

I pulsanti compaiono nell'app **solo se il provider è attivo** sul progetto: l'app legge
`/auth/v1/settings` all'avvio. Attivane uno e il pulsante appare da solo, senza rilasci.

Per entrambi l'indirizzo di ritorno da registrare presso il provider è quello di **Supabase**,
non quello dell'app:

```
https://nskgzpbcssnpfuxmbepa.supabase.co/auth/v1/callback
```

#### Google — gratuito, 10 minuti

1. [Google Cloud Console](https://console.cloud.google.com) → nuovo progetto.
2. *APIs & Services → OAuth consent screen*: tipo **External**, nome dell'app, e-mail di
   supporto e dello sviluppatore. Gli ambiti predefiniti (`email`, `profile`, `openid`) bastano.
   Finché l'app è in *Testing* possono entrare solo gli account elencati come test user:
   pubblicala (*Publish app*) quando la lega parte.
3. *Credentials → Create credentials → OAuth client ID → Web application*:
   - *Authorized JavaScript origins*: `https://fantasyfootballrsm.vercel.app`
   - *Authorized redirect URIs*: l'indirizzo di callback qui sopra
4. Copia **Client ID** e **Client secret** in Supabase → *Authentication → Sign In / Providers
   → Google* → attiva e salva.

#### Apple — richiede l'Apple Developer Program (99 $/anno)

Senza iscrizione a pagamento non è possibile: è una condizione di Apple, non dell'app.

1. [developer.apple.com](https://developer.apple.com/account) → *Certificates, Identifiers & Profiles*.
2. *Identifiers* → nuovo **App ID** con la capability **Sign In with Apple** attiva.
3. *Identifiers* → nuovo **Services ID** (es. `com.fantacampionato.web`): è il *client ID*.
   Attiva *Sign In with Apple* → *Configure*:
   - *Primary App ID*: quello del punto 2
   - *Domains and Subdomains*: `nskgzpbcssnpfuxmbepa.supabase.co`
   - *Return URLs*: l'indirizzo di callback qui sopra
4. *Keys* → nuova chiave con *Sign In with Apple* → scarica il file **.p8** (si scarica una
   volta sola) e annota il **Key ID**.
5. Annota il **Team ID** (in alto a destra nel portale).
6. Supabase → *Authentication → Sign In / Providers → Apple*: inserisci Services ID, Team ID,
   Key ID e il contenuto del file .p8. Supabase genera da sé il segreto e lo rinnova.

Due cose da sapere su Apple: chi entra può **nascondere l'e-mail** (riceverai un indirizzo
`@privaterelay.appleid.com`, che funziona lo stesso), e il **nome viene passato solo alla
primissima autorizzazione** — se manca, l'app usa la parte iniziale dell'e-mail e il nome si
cambia da *Impostazioni → Cambia nome*.

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
