# Chi si accorge se l'app si ferma

## Perché serve un controllo fuori da GitHub

`.github/workflows/sentinella.yml` è scritta per girare **ogni ora**. Non lo
fa: GitHub accoda le corse programmate e ne salta molte. Misurato il 30
settembre: 6 corse in 29 ore, cioè una ogni **5 ore circa**. Se il sito si
ferma il sabato sera prima del lock, lo si scopre dopo che il lock è passato.

La sentinella resta, perché guarda cose che da fuori non si vedono (per
esempio che l'import dei dati FSGC sia fresco). Il controllo **fitto** lo fa
un servizio esterno che non dipende da GitHub.

## I due controlli

Servizio: **UptimeRobot** (piano gratuito: controllo ogni 5 minuti, avviso
per e-mail e sull'app del telefono). Va bene anche Better Stack: contano gli
indirizzi e le regole qui sotto, non il servizio.

| # | Nome | Tipo | Indirizzo | Va bene se |
|---|---|---|---|---|
| 1 | Fantatitano — sito | **Keyword** | `https://fantatitano.site/` | la pagina **contiene** `Fantatitano` |
| 2 | Fantatitano — database | **HTTP(s)** | `https://nskgzpbcssnpfuxmbepa.supabase.co/rest/v1/sponsor?select=id&limit=1&apikey=sb_publishable_3ji0uoP5OW9LBzGhQ9QDSg_JoSJigHa` | risponde **200** |

Intervallo: **5 minuti** per tutti e due.

**Perché la parola chiave sul sito.** Una pagina d'errore di Vercel risponde
200 anche lei: il solo codice non dice che l'app c'è. Stessa regola della
sentinella.

**Perché quell'indirizzo per il database.** La radice del server risponde 401
anche quando va tutto bene, quindi non distingue "su" da "giù". Questa
richiesta invece fa una lettura vera nel database (la tabella degli sponsor,
che è leggibile da chiunque): 200 vuol dire che Postgres ha risposto; se
Postgres è fermo arriva un 5xx. Misurato il 30 settembre: 200 con la chiave,
401 senza.

**La chiave nell'indirizzo è quella pubblica** (`sb_publishable_…`), la stessa
che sta scritta in `src/config.js` e che ogni telefono scarica. Non è un
segreto. **Mai** mettere in un monitor la chiave `service_role` o una
password: un servizio di monitoraggio le salva e le mostra nei suoi pannelli.

## Cosa vede il servizio

Solo due indirizzi pubblici e la loro risposta. Nessun dato di chi gioca:
la tabella letta è quella degli sponsor, che è già pubblica per costruzione.
Per questo non va dichiarato nell'informativa: non tratta dati personali.

## Quando suona

Avviso sul telefono (app UptimeRobot) e per e-mail. Se suona:

1. apri `https://fantatitano.site/` dal telefono: se non si apre, è il sito
   (Vercel → Deployments);
2. se il sito si apre ma non carica i dati, è il database (Supabase →
   Project → stato del progetto);
3. se è tutto su e l'avviso era di un minuto, era la rete del servizio di
   controllo: lo si vede dal fatto che si chiude da solo.
