# Supabase — account e leghe multiple

## Progetto collegato

`https://nskgzpbcssnpfuxmbepa.supabase.co` — URL e publishable key sono in `src/config.js`
(valori pubblici: la sicurezza sta nelle policy RLS). Schema applicato; verificato che le
scritture anonime siano rifiutate (`42501`), che `create_league` richieda l'autenticazione e
che `matchday_lock_at(3)` restituisca sabato 19/09/2026 15:00 Europe/Rome, allineato a
`SEASON_START` in `src/data.js`.


## Clerk come fornitore d'identità (configurazione attuale)

L'app usa **Clerk** per l'accesso (password, Google, Apple, link o codice via e-mail) e
Supabase solo per i dati. Il token di sessione Clerk viaggia come identità esterna: le
policy RLS leggono l'utente dal claim `sub`, quindi lo schema e le regole restano quelli.

Per tornare a Supabase Auth basta svuotare `CLERK_PUBLISHABLE_KEY` in `src/config.js`:
entrambi i percorsi restano nel codice.

### Cosa serve, in ordine

1. **Migrazione obbligatoria.** Nell'SQL Editor esegui
   [`migrations/001-identita-esterna.sql`](migrations/001-identita-esterna.sql): converte gli
   identificativi utente da `uuid` a `text` (gli id Clerk sono `user_2abc…`) e riscrive
   funzioni e policy su `current_user_id()`. Conserva i dati esistenti.
   Senza questo passo il primo accesso fallisce con «Il database non è pronto per Clerk».
2. **Supabase → Authentication → Third-Party Auth → Add provider → Clerk**: inserisci il
   dominio dell'istanza, `decent-raven-4327.clerk.accounts.dev`. Supabase verificherà le
   firme tramite le sue chiavi pubbliche (`/.well-known/jwks.json`).
3. **Clerk → Configure → Integrations → Supabase**: attiva l'integrazione. Aggiunge al token
   di sessione il claim `role: "authenticated"`, che è ciò che le policy `to authenticated`
   richiedono. Senza, ogni lettura torna vuota e ogni scrittura viene rifiutata.
4. **Clerk → Domains**: aggiungi l'indirizzo dell'app (`fantasyfootballrsm.vercel.app`).

### Istanza di sviluppo e istanza di produzione

La chiave in uso è una `pk_test_`, cioè un'**istanza di sviluppo**: Google e Apple funzionano
subito perché Clerk presta le proprie credenziali OAuth, e per provare va benissimo.

Quando la lega parte davvero serve un'**istanza di produzione**, e lì Clerk chiede le *tue*
credenziali Google (progetto su Google Cloud) e la *tua* configurazione Apple (Services ID,
chiave .p8, Apple Developer Program a 99 $/anno). È lo stesso lavoro che servirebbe con
Supabase Auth: cambia il momento in cui lo fai, non se lo fai.

### La chiave segreta

`CLERK_SECRET_KEY` non compare da nessuna parte in questo repository e non deve comparirci:
è la chiave delle API backend di Clerk e chi la possiede può creare o cancellare utenti.
L'app è interamente frontend e non ne ha bisogno.

## Autenticazione di Supabase (percorso alternativo)

Valgono se `CLERK_PUBLISHABLE_KEY` è vuota.

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
