# Promemoria della formazione — i passi che restano

Il codice c'è tutto. Queste tre cose le può fare solo chi ha le chiavi del
progetto, e la chiave privata **non deve passare da una chat né da un commit**.

## 1. Genera la coppia di chiavi VAPID

Non si *trovano* da nessuna parte: si generano, una volta sola, e da quel
momento sono le chiavi di questa app.

**Senza terminale** — apri `strumenti/chiavi-vapid.html`: sul sito è
`/strumenti/chiavi-vapid.html`, oppure scarica il file e aprilo con un doppio
clic. Il browser genera la coppia da solo (`crypto.subtle`, curva P-256) e non
la manda a nessuno: la pagina non ha una sola chiamata di rete. Ti dà anche il
`PROMEMORIA_TOKEN` del passo 2.

**Con un terminale**, lo stesso risultato:

```sh
npx web-push generate-vapid-keys
```

In tutti e due i casi escono due stringhe. La **pubblica** (87 caratteri,
comincia per `B`) va in `src/config.js`, alla voce `VAPID_PUBBLICA`: è pubblica
per costruzione, come la chiave anon di Supabase, e sta nel frontend senza
problemi. La **privata** (43 caratteri) non va da nessuna parte tranne il
passo 2 — né in chat, né in un commit.

## 2. Mettila nei secret di Supabase, insieme a un token per la chiamata

```sh
supabase secrets set VAPID_PUBLIC_KEY='...la pubblica...'
supabase secrets set VAPID_PRIVATE_KEY='...la privata...'
supabase secrets set VAPID_SUBJECT='mailto:tuo@indirizzo'
supabase secrets set PROMEMORIA_TOKEN="$(openssl rand -hex 32)"
```

Senza terminale si fa uguale dal pannello: **Edge Functions → Secrets**, quattro
righe nome/valore.

`PROMEMORIA_TOKEN` serve perché la funzione è raggiungibile da internet: senza,
chiunque potrebbe farla spedire. Tieni da parte il valore, serve al passo 3.

`VAPID_SUBJECT` vuole un URL: `mailto:tuo@indirizzo`, non l'indirizzo nudo. Se
ci metti solo l'e-mail la funzione aggiunge `mailto:` da sé — prima invece
scoppiava con `Vapid subject is not a valid URL` e usciva un `Internal Server
Error` senza spiegazioni.

**Questi secret valgono per il progetto, non per la singola funzione**, e
stanno in *Project Settings → Edge Functions → Secrets*: creare una funzione
nuova non li porta con sé né li sostituisce. Aggiungerne una non è mai il
rimedio a «chiavi VAPID non configurate».

## 3. Deploy, e la pianificazione

```sh
supabase functions deploy promemoria --no-verify-jwt
```

`--no-verify-jwt` perché la chiama un'azione pianificata, non una persona
collegata: l'autorizzazione è il token del passo 2.

Poi su GitHub, in *Settings → Secrets and variables → Actions*, aggiungi:

| Nome | Valore |
|---|---|
| `SUPABASE_FUNCTIONS_URL` | `https://<progetto>.supabase.co/functions/v1` |
| `PROMEMORIA_TOKEN` | lo stesso del passo 2 |
| `PROMEMORIA_FUNZIONE` | solo se lo slug non è `promemoria` — vedi sotto |

**Attenzione a cosa si incolla**, qui come fra i secret di Supabase. Uno
spazio o un ritorno a capo davanti al valore non si vede in nessun posto: nel pannello il secret è mascherato e nel
registro esce come `***`. Ma basta a far morire la chiamata con
`curl: (3) URL rejected: Malformed input to a URL function`, in tre secondi e
senza spiegare perché. È già successo. Ora il workflow gli spazi li toglie da
sé e lo segnala, ma vale la pena incollare pulito.

`<progetto>` è il codice del progetto, quello che si legge nell'indirizzo della
funzione appena creata e in ogni chiamata che il browser già fa a Supabase: è
pubblico, non è un segreto.

Lo slug della funzione Supabase lo fissa **alla creazione** e non si può più
cambiare: il campo *Name* nelle impostazioni avvisa che «your slug and endpoint
URL will remain the same». Se la funzione è nata con un nome storto, invece di
ricrearla basta mettere lo slug vero in `PROMEMORIA_FUNZIONE`. Senza quel
secret si usa `promemoria`.

L'azione `.github/workflows/promemoria.yml` gira ogni ora e chiama la funzione.

## Come si controlla che funzioni

Prima del deploy, a mano:

```sh
curl -s -H "x-promemoria-token: $PROMEMORIA_TOKEN" \
  "https://<progetto>.supabase.co/functions/v1/promemoria"
```

Risponde `{"spedite":0,"motivo":"nessun lock nella finestra"}` quando non è il
momento — che è la risposta giusta quasi sempre.

E senza chiamare niente, con `npm test`: undici prove prendono il **vero**
`index.ts`, gli togliono i tipi con esbuild, sostituiscono i due import
`npm:` e l'oggetto `Deno` con degli stub e lo eseguono in node. Coprono le
risposte a configurazione storta — token mancante, token sbagliato, una
chiave VAPID assente, tutte e due, scambiate fra loro, incollate con un
ritorno a capo — perché è l'unica cosa che finora è andata storta. Non
coprono database e spedizione: per quelli serve Supabase vero.

## Se l'azione pianificata fallisce

Il registro della corsa dice adesso `HTTP <codice>` e stampa la risposta della
funzione. Cosa vuol dire ciascuna:

| Codice | Cosa è successo | Cosa si fa |
|---|---|---|
| `2xx` | tutto a posto | niente |
| `401` `token non valido` | la funzione c'è e ha rifiutato il token | `PROMEMORIA_TOKEN` su GitHub e quello fra i secret di Supabase devono essere **lo stesso identico valore**; dopo averlo cambiato su Supabase la funzione va **ridistribuita** |
| `500` `PROMEMORIA_TOKEN non è fra i secret` | su Supabase quel secret manca | passo 2, poi deploy |
| `500` `manca fra i secret: VAPID_...` | dice **quale** delle due chiavi non c'è | passo 2: i nomi sono `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY`, maiuscole e underscore compresi |
| `404` `NOT_FOUND` | nessuna funzione con quello slug | lo slug è quello **nell'indirizzo**, non il campo *Name*: mettilo in `PROMEMORIA_FUNZIONE` |
| `500` `le chiavi VAPID ci sono ma web-push le rifiuta` | le legge e non le accetta: il `dettaglio` dice perché e i `caratteri` quanto sono lunghe — **87** è la pubblica, **43** la privata, se escono al contrario le hai scambiate | rimettile nel verso giusto |
| `500` `eccezione non prevista` | qualcosa si è rotto dove non era previsto | il `dettaglio` è il messaggio vero; la pila completa sta nei log della funzione su Supabase |
| `500` con un messaggio del database | la funzione è partita e si è rotta dentro | il messaggio dice dove |
| nessuna risposta | indirizzo sbagliato o progetto in pausa | controlla `SUPABASE_FUNCTIONS_URL` |

I due 401 diversi prima erano lo stesso `non autorizzato` e non si distingueva
il secret mancante dal token sbagliato. Peggio: il workflow chiedeva a curl di
fallire e si prendeva la risposta con una sostituzione di comando, così quando
la chiamata andava male la sostituzione moriva e la riga che stampava il
motivo non veniva mai eseguita. Nel registro restava `curl: (22) ... error:
401` e basta. Ora il corpo si stampa sempre, prima di decidere se fermarsi.

## Quando parte l'avviso

Nelle 24 ore prima del lock, alla prima corsa utile, **una volta sola per
squadra e per dispositivo**. A non ripetersi ci pensa il database
(`promemoria_inviati`, migrazione 009), non l'orologio.

Prima era il contrario: si spediva solo se il lock cadeva fra 22,8 e 24 ore,
e la finestra stretta era l'unica cosa che impediva di ripetere l'avviso a
ogni giro. Funzionava se l'azione passava ogni ora. Non passa ogni ora —
misurate sulle corse vere: 3,2, 6,3 e 5,8 ore — e con quel passo la finestra
si mancava tre volte su quattro, restando verde.

Se una spedizione fallisce per un motivo passeggero il segno viene tolto e la
corsa dopo riprova. Gli indirizzi morti (404 e 410) no: quelli si marcano
`failed_at` e non si ritentano.

## Cosa NON serve

Non serve che tu tenga accesa la funzione né che ricordi di lanciarla: la
pianificazione se ne occupa. E non serve nessun servizio a pagamento: il push
lo consegnano i browser, gratis.
