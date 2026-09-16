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
