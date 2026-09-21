# Mettere in piedi fantatitano.site — la scaletta

Ordine studiato per non restare mai a metà: prima si spegne quello che
occupa il dominio, poi si accendono i record, poi si allineano i pannelli.
Il DNS resta a **GoDaddy**: si cambiano solo i record, non i nameserver —
spostare i nameserver a Vercel vorrebbe dire portare anche la posta, ed è
esattamente il modo di restare senza e-mail per una giornata.

**Una decisione da prendere prima di tutto:** l'indirizzo dell'app è
`https://fantatitano.site` (senza www), e `www` ci rimanda sopra. Deve valere
ovunque — Play, Supabase, assetlinks — perché per Android il collegamento
sito/app vale su **un** host, e i redirect non li segue.

---

## 0. Cosa c'è adesso nel pannello (letto il 21/09)

Sette record. Tre si toccano, quattro si lasciano stare.

| Tipo | Nome | Valore di adesso | Cosa farne |
|---|---|---|---|
| A | `@` | *WebsiteBuilder Site* | **cambiare**: è il "coming soon". Prima scollega il prodotto, se no GoDaddy lo rimette |
| CNAME | `www` | `fantatitano.site.` | **cambiare** col valore unico del progetto Vercel |
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; …` | **guardare**: vedi sotto, con `p=quarantine` le e-mail di Resend rischiano la quarantena finché SPF e DKIM non ci sono |
| NS | `@` | `ns55/ns56.domaincontrol.com` | lasciare: il DNS resta a GoDaddy |
| SOA | `@` | `ns55.domaincontrol.com` | lasciare (non si tocca) |
| CNAME | `_domainconnect` | `_domainconnect.gd.domaincontrol.com` | lasciare: serve ai pannelli guidati di GoDaddy |

Il dominio nudo oggi risponde `76.223.105.230` e `13.248.243.5`, che sono gli
indirizzi del sito GoDaddy: è la conferma che il record `A @` è ancora il loro.

Sul `_dmarc`: quel record dice "se una e-mail dice di venire da
fantatitano.site ma non è autenticata, mettila in quarantena". È giusto
tenerlo, ma **prima** devono esserci SPF e DKIM di Resend (passo 4), se no le
e-mail dell'app finiscono in spam. Mentre configuri, se qualcosa non torna,
abbassalo a `p=none` e rimettilo a `quarantine` quando Resend dice *Verified*.

## 1. GoDaddy: togli di mezzo il "coming soon"

Oggi il dominio risponde con la pagina del **Website Builder** di GoDaddy.
Finché quel sito è attivo, il pannello rimette i suoi record.

- GoDaddy → il sito/prodotto collegato a `fantatitano.site` → **disattiva o
  scollega** il dominio
- DNS → cancella gli eventuali record di parcheggio o inoltro: `A @` verso un
  IP GoDaddy, `CNAME www` verso `*.godaddysites.com`, voci "Forwarding" o
  "Parked"

## 2. Vercel: aggiungi i due domini al progetto

- Progetto → **Settings → Domains → Add Domain**
- Aggiungi `fantatitano.site` **e** `www.fantatitano.site`
- Imposta `www` come **redirect** verso `fantatitano.site`
- Vercel ti mostra i valori da mettere nel DNS: **copiali da lì**. L'A record
  del dominio nudo di solito è `76.76.21.21`, ma il CNAME del `www` è **unico
  per progetto** (tipo `d1d4fc829fe7bc7c.vercel-dns-017.com`): quello generico
  che si legge in giro non vale.

## 3. GoDaddy → DNS: i record del sito

| Tipo | Nome | Valore | Note |
|---|---|---|---|
| A | `@` | quello che mostra Vercel (di norma `76.76.21.21`) | uno solo: cancella gli altri A/AAAA su `@` |
| CNAME | `www` | il valore **del tuo progetto** che mostra Vercel | non `cname.vercel-dns.com` a caso |

TTL: se te lo fa scegliere, mettilo basso (600 secondi) finché stai lavorando.

## 4. GoDaddy → DNS: i record della posta (Resend)

I valori esatti li dà **Resend** quando aggiungi il dominio. Di norma sono tre,
tutti su un **sottodominio** `send`, e per questo non litigano con la posta in
arrivo:

| Tipo | Nome | Valore |
|---|---|---|
| MX | `send` | `feedback-smtp.<regione>.amazonses.com`, priorità 10 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` |
| TXT | `resend._domainkey` | la chiave DKIM lunga che ti dà Resend |
| TXT (consigliato) | `_dmarc` | `v=DMARC1; p=none;` |

## 5. Ricevere su support@fantatitano.site

Resend **spedisce soltanto**. Per ricevere serve un inoltro:

- GoDaddy → **Email forwarding** (o un servizio come ImprovMX): inoltra
  `support@fantatitano.site` alla tua Gmail
- Aggiunge record **MX sul dominio nudo** (`@`): sono quelli della posta in
  arrivo e non c'entrano con i `send` di Resend
- Serve davvero: quell'indirizzo è scritto nell'app, nell'informativa e nella
  schermata di chi viene sospeso

## 6. Quando il DNS è propagato (10 minuti – 2 ore)

- **Vercel → Domains**: i due domini devono diventare *Valid Configuration*,
  col lucchetto
- **Supabase → Authentication → URL Configuration**
  - *Site URL*: `https://fantatitano.site`
  - *Redirect URLs*: `https://fantatitano.site/**`, `https://www.fantatitano.site/**`
    e — finché fai prove — anche `https://fantasyfootballrsm.vercel.app/**`
- **Resend**: quando dice *Verified*, vai su **Supabase → Authentication →
  Emails → SMTP** e metti le credenziali, mittente `no-reply@fantatitano.site`
- **GitHub → Settings → Secrets → Actions**: `INDIRIZZO_APP` =
  `https://fantatitano.site`, così la sentinella guarda il sito vero

## 7. I controlli, in quest'ordine

```sh
curl -sI https://fantatitano.site/ | head -1                       # 200
curl -sI https://www.fantatitano.site/ | head -1                   # 301 verso il dominio nudo
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' \
  https://fantatitano.site/.well-known/assetlinks.json             # 200 application/json
curl -s -o /dev/null -w '%{http_code}\n' https://fantatitano.site/privacy.html   # 200
```

Poi, dall'app: **Impostazioni → Impostazioni avanzate → Diagnostica accessi**
deve dire e-mail attiva, registrazioni aperte, e gli indirizzi di ritorno
giusti. E una registrazione di prova con un indirizzo mai usato, per vedere
che l'e-mail arrivi davvero.

## 8. Due cose da ricordare dopo

- L'app installata sulla schermata Home viene dall'indirizzo `.vercel.app`:
  quello nuovo è **un'altra origine**. Rimuovi l'app e reinstallala dal dominio
  nuovo, se no ti ritrovi due app con due iscrizioni al push diverse.
- Il file `.well-known/assetlinks.json` deve rispondere **200 diretto**, non un
  redirect: Android non li segue, e l'app su Play si aprirebbe con la barra
  del browser in cima.
