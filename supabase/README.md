# Supabase — account e leghe multiple

## Migrazione 007 — mercato degli svincolati

`migrations/007-mercato-svincolati.sql` aggiunge la tabella `offerte` e le
funzioni `offri`, `ritira_offerta`, `risolvi_offerte`, `e_svincolato`.

La prima offerta su un giocatore apre una finestra di **24 ore**. Dentro la
finestra si rilancia, e la finestra **non si allunga**: alla scadenza vince
l'offerta più alta, a parità la prima arrivata.

**Chi chiude le finestre.** Nessuno, ed è voluto: le chiude `risolvi_offerte`,
che l'app chiama a ogni caricamento quando vede qualcosa di scaduto. Non serve
nessun processo che gira di notte, la funzione è ripetibile, e due partecipanti
che aprono l'app nello stesso istante non assegnano due volte (le righe si
bloccano con `for update`).

**Cosa controlla il database e cosa no.** Qui stanno le regole che riguardano
gli altri: che due persone non vincano lo stesso giocatore, che i crediti
bastino (contando anche le offerte già aperte), che la rosa non passi i 25. I
limiti di reparto (3-8-8-6) restano nell'app, dov'erano già per l'asta: il
database non conosce i ruoli, che stanno nel listone, e sforare il proprio
reparto danneggia solo sé stessi ed è visibile subito.

Se i crediti non bastano più al momento della chiusura, quell'offerta si
chiude persa e si passa alla successiva, invece di mandare una rosa in
negativo.

## Migrazione 006 — scambi fra squadre

`migrations/006-scambi.sql` aggiunge la tabella `trades` e quattro funzioni:
`proponi_scambio`, `accetta_scambio`, `rifiuta_scambio`, `annulla_scambio`.

Uno scambio muove lo stesso numero di giocatori per parte più eventuali
crediti, e diventa effettivo solo quando l'altra squadra accetta. La
fattibilità si controlla **due volte**, alla proposta e all'accettazione: fra
i due momenti può essere passato un altro scambio, e una proposta nata valida
può non esserlo più. Accettando, le proposte aperte che toccano gli stessi
giocatori si chiudono da sole.

Nessuna policy di scrittura sulla tabella: si passa solo dalle funzioni, che
controllano le regole. Finché la migrazione non è applicata l'app se ne
accorge e nasconde la scheda Scambi, invece di andare in errore.

## Ordine di installazione (provato per davvero)

Su un progetto nuovo, nell'SQL Editor, in quest'ordine:

1. `schema.sql` — una volta sola, è il punto di partenza. Non va rieseguito dopo
   le migrazioni: definisce le policy su `auth.uid()`, che la 001 sostituisce.
2. `migrations/001-identita-esterna.sql`
3. `migrations/002-squadra-e-lega.sql`
4. `migrations/003-abbandona-lega.sql`
5. `migrations/004-lock-dal-calendario.sql`
6. `migrations/005-notifiche-push.sql`
7. `migrations/006-scambi.sql`
8. `migrations/007-mercato-svincolati.sql`
9. `migrations/008-chiudi-giornata.sql`
10. `migrations/009-promemoria-una-volta-sola.sql`
11. `migrations/010-elimina-profilo.sql`
12. `migrations/011-permessi-per-ruolo.sql` — **questa non è opzionale**: fino
    alla 010 compresa, ogni funzione del database resta eseguibile dal ruolo
    anonimo, cioè da chiunque abbia la chiave pubblicabile che sta nel
    frontend. Una fa danno davvero: `da_avvisare()` restituisce `endpoint`,
    `p256dh` e `auth` di ogni iscrizione al push, che è quanto basta per
    spedire una notifica al telefono di qualcuno.
13. `migrations/012-calendario-lock.sql` — le 30 date di chiusura delle
    formazioni, **generate** dal calendario dell'app con
    `node scripts/genera-lock.mjs`. Prima arrivavano al server solo quando un
    Giudice Dati apriva l'app: senza giudice la tabella restava vuota e le
    formazioni degli avversari non si vedevano mai. Non si modifica a mano;
    se il calendario cambia, l'import la rigenera e avvisa di ricaricarla.

14. `migrations/013-lega-pubblica.sql` — la lega aperta a tutti: rose non
    esclusive, classifica a punti, premi in palio.

15. `migrations/014-console-admin.sql` — il ruolo di chi amministra l'app e le
    funzioni della console. **Contiene anche una correzione di sicurezza**:
    vedi sotto.

16. `migrations/015-moderazione.sql` — gli strumenti per moderare quello che
    si vede: rinominare una squadra altrui, e sospendere chi scrive nomi che
    non vanno. Serve prima di aprire l'app al pubblico: nome squadra e nome
    fantallenatore li scrive chi gioca e li leggono gli altri, e fino alla 014
    l'unico rimedio a un nome offensivo era chiedere per favore. **Contiene
    anche la solita correzione di sicurezza**: la policy `profiles_update_own`
    ora pinta anche la colonna nuova, se no uno si togliva la sospensione da
    solo — è la stessa lezione della 014, e vale ogni volta che si aggiunge
    una colonna a `profiles`.

17. `promemoria-pianificato.sql` — **facoltativo ma consigliato**, e non è una
    migrazione: si riempie **una riga** (il token del promemoria) e si lancia
    a mano. Sposta l'orologio dell'avviso
    della formazione da GitHub — che accoda e salta le corse pianificate, fino
    a cinque ore e mezza misurate — a `pg_cron`, dentro il database. Vedi
    `functions/promemoria/README.md`, passo 3b.

Le migrazioni dalla 001 in poi si possono rieseguire quante volte si vuole.

### Moderare: rinominare prima, sospendere poi

Sono due strumenti diversi e l'ordine conta. **Rinominare** (console → Squadre
→ Rinomina) toglie subito il nome da tutte le schermate — classifica, scontro,
scheda condivisibile — e chi l'ha scritto continua a giocare: risolve il danno.
**Sospendere** (console → Persone o Squadre → Sospendi) risolve la persona: chi
è sospeso non schiera, non apre contestazioni e non entra in altre leghe, e lo
impedisce il database, non l'app. Le squadre e i punti restano, e la
sospensione si toglie.

Un sospeso trova una schermata che glielo dice, con l'indirizzo a cui
rispondere, e **le impostazioni restano aperte**: da lì scarica i propri dati e
cancella l'account. Sono diritti, non premi, e non si sospendono insieme al
resto.

Quello che la console non fa, e non per dimenticanza: cancellare un account o
cambiarne la password. Servirebbe la chiave di servizio nel frontend — vedi
sotto.

### Tre ruoli, e non vanno confusi

| Chi | Dove | Cosa può |
|---|---|---|
| **Amministratore dell'app** (`profiles.is_admin`) | tutto il servizio | apre le leghe pubbliche, nomina gli altri, legge la console (persone, leghe, numeri) |
| **Giudice Dati** (`profiles.is_judge`) | il dato del campionato | inserisce referti, calcola le giornate, allinea i lock |
| **Admin di lega** (`league_members.role`) | una lega sola | gestisce quella lega e nient'altro |

Il **primo amministratore si nomina a mano**, come il Giudice Dati:

```sql
update public.profiles set is_admin = true
 where id = (select id::text from auth.users where lower(email) = lower('tua@email'));
```

Dall'app non si può, e non è una mancanza: se si potesse, il primo che passa
si darebbe i poteri da solo.

### Una colonna nuova non è protetta da sola

La policy che impedisce di promuoversi (`profiles_update_own`) confrontava
solo `is_judge` col valore già presente. Aggiungendo `is_admin` la policy non
lo sapeva, quindi chiunque — con la chiave pubblicabile che sta nel frontend —
poteva scrivere `update profiles set is_admin = true` su di sé e prendersi
l'app: aprire leghe pubbliche, leggere le e-mail di tutti, nominare altri
amministratori.

La 014 riscrive la policy pretendendo che **entrambi** i campi restino quelli
che sono: si cambiano solo dalle funzioni, che controllano chi chiama. La
prova sta in `prove/funzioni.sql` e gira col ruolo `authenticated`, non come
`postgres`: da superutente la RLS non si applica e la prima stesura passava
l'aggiornamento dicendo che il buco c'era.

### Cosa la console non può fare

Leggere o cambiare la password di qualcuno. Servirebbe la chiave di servizio
di Supabase nel frontend, cioè le chiavi del database su ogni telefono. Si
manda alla persona il link per reimpostarla da sé — che è anche l'unico modo
in cui la password resta sua.

### Lega pubblica: cosa cambia nel database

Una lega privata e una pubblica sono due giochi diversi, e la differenza sta
in tre colonne di `leagues`: `pubblica`, `classifica` (`scontri` o `punti`) e
`premi`. Un vincolo tiene insieme le prime due, perché una lega pubblica con
il calendario a scontri diretti fra duecento squadre non vuol dire niente.

Il pezzo delicato è **l'esclusività dei giocatori**. Nelle leghe private un
giocatore sta in una rosa sola, e lo garantiva un indice unico su
`(league_id, player_id)`. Un indice non può guardare un'altra tabella per
sapere se quella lega è pubblica, e un trigger non è un vincolo: due
inserimenti nello stesso istante lo passano entrambi. Quindi `rosters` ha una
colonna `lega_esclusiva` che porta il `league_id` solo per le leghe private e
`null` per le pubbliche, con l'indice unico su quella: nelle private
garantisce davvero, anche sotto corsa, e nelle pubbliche non vincola niente,
perché più `null` non sono un duplicato.

### Un permesso che non si revocava

Le migrazioni fino alla 010 scrivono `revoke all on function ... from public`,
e non revocavano niente. Il progetto Supabase nasce con

```sql
alter default privileges in schema public grant all on functions
  to postgres, anon, authenticated, service_role;
```

quindi ogni funzione creata dopo **nasce eseguibile da `anon`**, per un
permesso dato al ruolo. `PUBLIC` e `anon` sono due cose diverse: revocare al
primo lascia intatto il secondo.

Le prove non potevano accorgersene, ed è la parte che conta: il Postgres di
`prova.sh` creava i ruoli ma non i permessi predefiniti, quindi era più severo
del sistema vero — là un `revoke` da `PUBLIC` bastava per davvero. Ora
`prove/ambiente.sql` li riproduce, e `prove/permessi.sh` tiene il conto di chi
può chiamare cosa: gira in CI a ogni push e diventa rosso se una migrazione
nuova si dimentica di chiudere una funzione.

Perciò ogni funzione nuova va revocata **a `public` e ad `anon`** e concessa a
`authenticated` a mano. La forma globale
`alter default privileges revoke execute on functions from public` funzionerebbe
(provata), ma vale per ogni schema e per ogni funzione creata dal ruolo
`postgres`, comprese quelle di un'estensione installata dal pannello: si
romperebbero mesi dopo, in un posto che non c'entra.

`./supabase/prove/prova.sh` fa tutto questo su un Postgres vuoto, due volte di
fila, e poi chiama le funzioni una per una. Prima non passava: la 001 converte
le colonne dell'identità da `uuid` a `text`, e le migrazioni successive erano
rimaste a `uuid`. Metà fallivano subito; l'altra metà stava dentro corpi
`plpgsql`, che Postgres non controlla finché non li esegui, e sarebbe scoppiata
in faccia al primo che provava a uscire da una lega.

Per sapere cosa c'è già su un progetto, `verifica.sql` lo dice riga per riga.


## Cosa manca a questo progetto? Chiedilo al database

Invece di ricordare quali file sono stati eseguiti, incolla
[`verifica.sql`](verifica.sql) nell'SQL Editor: non scrive niente, elenca cosa
c'è e cosa manca, riga per riga. Le migrazioni sono tutte ripetibili (`if not
exists`, `create or replace`, `drop policy if exists`), quindi rieseguirne una
già fatta non rompe nulla.

## Migrazione 004 — il lock delle formazioni dal calendario vero

**Da eseguire: `migrations/004-lock-dal-calendario.sql` nell'SQL Editor.**

Il lock era calcolato in due posti con due calendari diversi: il server con una
formula fissa (`'2026-09-05 15:00 Europe/Rome' + (n-1) × 7 giorni`), l'app col
calendario vero della FSGC. **Otto giorni di scarto su tutte e 30 le giornate**
(giornata 1: 28 agosto contro 5 settembre; giornata 30: 19 marzo contro 27 marzo),
e le policy applicavano quella del server. Quindi:

1. la formazione restava scrivibile per otto giorni **dopo** che la partita era
   finita. L'app la bloccava, ma la protezione che conta è quella del database:
   chi sa usare le API poteva rifare la formazione sapendo i risultati;
2. `lineups_read` non lasciava leggere le formazioni degli avversari fino a otto
   giorni dopo la partita, quindi nella sfida l'avversario compariva con l'undici
   d'ufficio invece del suo.

La migrazione aggiunge `matchday_locks` (una riga per giornata), fa leggere
`matchday_lock_at()` da lì e aggiunge `sync_matchday_locks()`, che il Giudice Dati
usa per scriverci il calendario che l'app ha già in mano. Finché la tabella è vuota
le policy sbagliano nella direzione prudente: scrittura aperta (nessuno resta chiuso
fuori dalla propria formazione), lettura chiusa (nessuno sbircia le altrui).

Dopo averla eseguita non serve fare altro: **l'app allinea la tabella da sola** al
primo accesso del Giudice Dati, e la schermata «Congela giornata» mostra se è
allineata, con un tasto per rifarlo a mano.

## Migrazione 003 — uscire da una lega

Esegui `migrations/003-abbandona-lega.sql` nell'SQL Editor. Aggiunge la funzione
`abbandona_lega`: la policy `members_delete` permette solo all'admin di togliere
GLI ALTRI, quindi chi era entrato con un codice non poteva piu' uscire da solo.
L'ultimo admin deve prima passare il ruolo, oppure eliminare la lega.

Chi ha creato una lega la elimina dal tasto col cestino in "Le mie leghe".

## Migrazione 002 — eliminare la lega, stemma, maglia, allenatore in seconda

Dopo `schema.sql` e `migrations/001-identita-esterna.sql`, esegui
`migrations/002-squadra-e-lega.sql` nell'SQL Editor. Aggiunge:

- **eliminazione della lega** riservata a chi l'ha creata (policy `leagues_delete`);
- **stemma** (`crest_url`) e **maglia** (`kit`) sulla riga del partecipante;
- **allenatore in seconda** (`vice_user_id`, `vice_code`) con le funzioni
  `rigenera_codice_vice`, `entra_come_vice` e `togli_vice`.

Il file si puo' rieseguire senza danni.

Lo stemma viene salvato come data URL: l'app riduce la foto a 192px e la
ricomprime finche' non sta sotto i 60 KB, quindi in tabella finiscono ~15 KB a
squadra e non serve configurare lo Storage.

## Progetto collegato

`https://nskgzpbcssnpfuxmbepa.supabase.co` — URL e publishable key sono in `src/config.js`
(valori pubblici: la sicurezza sta nelle policy RLS). Schema applicato; verificato che le
scritture anonime siano rifiutate (`42501`), che `create_league` richieda l'autenticazione e
che `matchday_lock_at(3)` restituisca sabato 19/09/2026 15:00 Europe/Rome, allineato a
`SEASON_START` in `src/data.js`.


## Stato attuale (misurato il 14/09/2026)

Letto da `/auth/v1/settings` e dalle API REST del progetto:

| Voce | Stato | Serve fare |
|---|---|---|
| Tabelle dello schema | 11 su 11 presenti | niente |
| Accesso con e-mail | attivo | niente |
| Nuove registrazioni | aperte | niente |
| **Conferma e-mail** | **accesa** (`mailer_autoconfirm: false`) | spegnerla, vedi §1 |
| **Google** | **spento** | configurarlo, vedi §3 |
| **Apple** | **spento** | configurarlo, vedi §3 — voluto, serve l'Apple Developer Program (99 $/anno) |
| Indirizzi di ritorno | non leggibili via API | verificarli a mano, vedi §2 |
| Giudice Dati | nessuno nominato | [`nomina-giudice.sql`](nomina-giudice.sql) dopo la registrazione |

App in produzione: <https://fantasyfootballrsm.vercel.app>

Questi interruttori stanno nel pannello Supabase e **non si cambiano dal codice**: la
publishable key serve solo a leggere e scrivere i dati entro le policy RLS, non a
riconfigurare il progetto. Per cambiarli servono il pannello oppure un token della
Management API.

Dentro l'app, **Impostazioni → Diagnostica accessi** rilegge questa stessa tabella dal
progetto vero e dice cosa manca ancora: dopo ogni modifica nel pannello, è lì che si
controlla se ha preso.

## Autenticazione — configurazione in uso

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
<h2>Entra in Fantatitano</h2>
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
   Quell'identificatore tiene il nome vecchio apposta: se è già stato creato su Apple
   non si rinomina, e cambiarlo qui vorrebbe dire scrivere una cosa che là non esiste.
   Chi parte adesso può usare `com.fantatitano.web`.
   Attiva *Sign In with Apple* → *Configure*:
   - *Primary App ID*: quello del punto 2
   - *Domains and Subdomains*: `nskgzpbcssnpfuxmbepa.supabase.co`
   - *Return URLs*: l'indirizzo di callback qui sopra
4. *Keys* → nuova chiave con *Sign In with Apple* → scarica il file **.p8** (si scarica una
   volta sola) e annota il **Key ID**.
5. Annota il **Team ID** (in alto a destra nel portale).
6. Supabase → *Authentication → Sign In / Providers → Apple*: inserisci Services ID, Team ID,
   Key ID e il contenuto del file .p8. Supabase genera da sé il segreto e lo rinnova.

##### Le tre cose che fanno perdere tempo

**Il client ID è il Services ID, non l'App ID.** Sono due oggetti diversi nella stessa
schermata *Identifiers* e si somigliano. In Supabase va il **Services ID**.

**Il file .p8 si scarica una volta sola.** Se lo perdi non si recupera: si revoca la chiave
e se ne crea un'altra. Mettilo al sicuro subito, e **non** in questo repository.

**Il dominio da registrare è quello di Supabase, non quello dell'app.** Il ritorno passa da
`nskgzpbcssnpfuxmbepa.supabase.co`, quindi è quello che Apple deve conoscere — anche se agli
utenti l'app si presenta su `fantasyfootballrsm.vercel.app`.
Se Apple chiede di **verificare il dominio** offrendoti un file
`apple-developer-domain-association.txt`: quel file andrebbe servito da
`nskgzpbcssnpfuxmbepa.supabase.co/.well-known/`, che oggi risponde 404 e non è nostro da
riempire. Nel flusso OAuth con redirect (quello che usiamo) la verifica normalmente non viene
imposta: è richiesta per *Sign in with Apple JS* e per l'inoltro delle e-mail. Se ti si
presenta lo sbarramento, dimmelo: il file lo si pubblica sul dominio dell'app in due minuti,
oppure si passa da un dominio personalizzato su Supabase.

##### Nome ed e-mail nascosti — già gestiti dall'app

Chi entra con Apple può **nascondere l'e-mail**: arriva un indirizzo
`@privaterelay.appleid.com`, che funziona normalmente (Apple inoltra).

Il **nome però Apple lo passa solo alla primissima autorizzazione**, e chi nasconde l'e-mail
spesso non lo passa affatto. Prima, in quel caso, l'app ripiegava sulla parte iniziale
dell'indirizzo: in classifica sarebbe comparso `pq7jh9h827`. Ora `nomeDaCompletare()`
riconosce un nome ricavato dall'indirizzo e la schermata della lega — passaggio obbligato per
chiunque — chiede «Come ti chiami» prima di far creare o entrare in una lega. Chi arriva con
un nome vero non vede quel campo.

## Modello

- **Generato dal client** (`src/data.js`): società, listone, calendario. Stabili per stagione.
- **Globale** (una volta per tutte le leghe, scrive solo il Giudice Dati): `match_overrides`,
  `match_events`, `match_appearances`, `matchday_status`, `matchday_locks`, `change_log`
  (automatico via trigger).
- **Per lega**: `leagues`, `league_members` (ruolo `admin` / `fantallenatore`), `rosters`,
  `lineups` (scrivibili solo dal proprietario e solo prima del lock, art. 8.3), `contestazioni`.
- **Il lock delle formazioni** (art. 8.3) viene da `matchday_locks`, una riga per giornata,
  scritta dal Giudice Dati con `sync_matchday_locks()` a partire dal calendario vero della
  FSGC — lo stesso che usa l'app. Prima era una formula (`5 settembre + (n-1) × 7 giorni`)
  e sbagliava di otto giorni su tutte e 30 le giornate: la formazione restava scrivibile per
  otto giorni dopo la partita e le formazioni altrui non si potevano leggere fino a otto
  giorni dopo. L'app allinea la tabella da sola quando entra il Giudice Dati, e la schermata
  «Congela giornata» dice se è allineata. Con la tabella vuota le policy sbagliano nella
  direzione prudente: scrittura aperta (nessuno chiuso fuori), lettura chiusa (nessuno sbircia).
- **Congelamento** (art. 9.2): un trigger rifiuta qualunque scrittura sul dato di una giornata
  con `matchday_status = 'frozen'`, anche per il Giudice Dati.
- Senza un progetto collegato l'app non entra: non esiste più nessuna modalità demo.


## Appendice — Clerk come fornitore d'identità (SPENTO)

> Questa sezione vale **solo** se si riaccende Clerk valorizzando `CLERK_PUBLISHABLE_KEY`
> in `src/config.js`. Oggi quella costante è vuota e l'accesso passa da Supabase Auth,
> descritto qui sopra. Il codice per entrambe le strade resta nel repository.

Con Clerk acceso, l'app userebbe **Clerk** per l'accesso (password, Google, Apple, link o codice via e-mail) e
Supabase solo per i dati. Il token di sessione Clerk viaggia come identità esterna: le
policy RLS leggono l'utente dal claim `sub`, quindi lo schema e le regole restano quelli.

Fu scartato perché l'accesso apriva una finestra separata invece di restare dentro l'app.

### Cosa servirebbe, in ordine

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

