# Promemoria della formazione — i passi che restano

Il codice c'è tutto. Queste tre cose le può fare solo chi ha le chiavi del
progetto, e la chiave privata **non deve passare da una chat né da un commit**.

## 1. Genera la coppia di chiavi VAPID

```sh
npx web-push generate-vapid-keys
```

Stampa due stringhe. La **pubblica** va in `src/config.js`, alla voce
`VAPID_PUBBLICA`: è pubblica per costruzione, come la chiave anon di Supabase,
e sta nel frontend senza problemi. La **privata** non va da nessuna parte
tranne il passo 2.

## 2. Mettila nei secret di Supabase, insieme a un token per la chiamata

```sh
supabase secrets set VAPID_PUBLIC_KEY='...la pubblica...'
supabase secrets set VAPID_PRIVATE_KEY='...la privata...'
supabase secrets set VAPID_SUBJECT='mailto:tuo@indirizzo'
supabase secrets set PROMEMORIA_TOKEN="$(openssl rand -hex 32)"
```

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

L'azione `.github/workflows/promemoria.yml` gira ogni ora e chiama la funzione.

## Come si controlla che funzioni

Prima del deploy, a mano:

```sh
curl -s -H "x-promemoria-token: $PROMEMORIA_TOKEN" \
  "https://<progetto>.supabase.co/functions/v1/promemoria"
```

Risponde `{"spedite":0,"motivo":"nessun lock nella finestra"}` quando non è il
momento — che è la risposta giusta per ventitré ore su ventiquattro.

## Cosa NON serve

Non serve che tu tenga accesa la funzione né che ricordi di lanciarla: la
pianificazione se ne occupa. E non serve nessun servizio a pagamento: il push
lo consegnano i browser, gratis.
