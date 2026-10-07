# 06 — Le Sfide di Tito

Scheda di progetto, ottobre 2026. **Non ancora costruito.** Si decide dopo il
2 novembre (la soglia di MONETIZZAZIONE.md §4b: metà delle squadre che
consegnano la formazione per tre giornate di fila); se si fa, si costruisce a
novembre–dicembre e parte con la 16ª giornata, la prima del girone di ritorno.

Prima versione di questa scheda: un Survivor copiato da Skillbol
(skillbol.com). Scartato il 7 ottobre: chi veniva eliminato restava senza
niente da fare per settimane, all'inizio era troppo facile e alla fine era
fortuna, e non usava niente di nostro. Da Skillbol si tiene l'idea (un gioco
veloce, ogni settimana, anche senza amici); la forma è rifatta sul nostro
campionato e sul Voto Titano, e la conduce TITO.

---

## 1. Perché

Il fantacalcio chiede tanto: asta, rosa da 25, formazione ogni settimana. Chi
segue il campionato ma non vuole quell'impegno, o arriva dallo Store senza
amici con cui fare una lega, oggi non ha niente da fare nell'app.

Le Sfide di Tito si giocano **in meno di un minuto a settimana**, da soli o con
gli amici, e nessuno viene eliminato. Servono a:

- **portare dentro gente nuova**, che poi magari passa al fantacalcio;
- **dare un motivo per aprire l'app ogni settimana** a chi non ha una lega;
- **vendere**: «Le Sfide di Tito del Bar X», «del Club Y», «il premio della
  settimana offerto da…» (MONETIZZAZIONE.md, §3b e §3c);
- **dare un volto all'app**: TITO.

Il fantacalcio resta «la stagione»; le Sfide sono l'appuntamento veloce della
settimana. Stessi dati, stessa chiusura, stessi promemoria.

## 2. Le regole

Da scrivere così, articolo per articolo, nel regolamento dell'app.

**T.1 — Due sfide a giornata.** A ogni giornata ogni giocatore fa due scelte:

| Sfida | Cosa scegli | Punti |
|---|---|---|
| **La squadra** | una squadra del campionato | vince **+3**, pareggia **+1**, perde **0** |
| **Il migliore in campo** | un giocatore del campionato | il suo voto meno 6: un 8,0 vale **+2**, un 13,5 vale **+7,5**. Mai sotto **−2**. Se non entra in campo, **0** |

Il voto è quello che l'app mostra già nella schermata Voti, calcolato dai
referti FSGC: niente da inventare. Il «migliore in campo» è la sfida che solo
Fantatitano può fare.

**T.2 — Una scelta non si ripete troppo.** In un girone ogni squadra si può
scegliere **al massimo 2 volte** e ogni giocatore **una volta sola**. Le
squadre forti finiscono, i campioni pure: la strategia sta nel quando usarli.

**T.3 — I jolly di Tito.** Tre per girone, da usare quando si vuole, uno per
giornata al massimo:

- **Raddoppio** (2 per girone): i punti di una sfida contano doppio, anche se
  sono negativi. È una scommessa sulla propria scelta, non una rete di
  sicurezza.
- **Scudo** (1 per girone): se la squadra perde conta come un pareggio (+1);
  se il giocatore va sotto il 6, quella sfida vale 0.

**T.4 — Quando si chiude.** Le scelte si chiudono **insieme alla formazione**:
alle 15:00 del giorno della prima partita della giornata, o al calcio d'inizio
se viene prima. Fino ad allora si cambiano. Chi non sceglie prende 0 in quella
sfida.

**T.5 — Le partite che non finiscono.**

| Stato | La squadra | Il giocatore |
|---|---|---|
| Giocata | vale il risultato | vale il voto |
| A tavolino | vale il risultato assegnato | 0 (S.V. del regolamento) |
| Rinviata o sospesa | 0, e la scelta non conta nel limite T.2 | 0, e il giocatore torna disponibile |

**T.6 — Il congelamento.** Le Sfide si congelano con la giornata, il martedì
alle 20:00 (art. 9.2): da lì il punteggio non cambia più, anche se la FSGC
corregge un risultato dopo. Prima del congelamento si aggiornano da sole,
come i voti.

**T.7 — Le classifiche.**

- **Il Titano della settimana**: chi fa più punti nella giornata. Ogni
  settimana c'è un vincitore, anche per chi è indietro nel girone.
- **La classifica del girone**: la somma delle giornate. Un'edizione dura un
  girone (andata 1–15, ritorno 16–30): due vincitori a stagione.
- A parità: più «Titano della settimana» vinti, poi più punti nella sfida
  del migliore in campo, poi a pari merito.

**T.8 — Dove si gioca.**

- **La classifica di tutti**: chi si iscrive ci entra da solo, senza codici.
- **Le leghe**: ogni lega del fantacalcio ha anche la sua classifica delle
  Sfide, con gli stessi punti.
- **Le leghe solo Sfide** (fase 2): senza asta né rosa. È la versione per bar,
  club e aziende.

**T.9 — Premi.** Si gioca gratis. All'inizio i premi sono solo trofei e
distintivi di TITO dentro l'app. Indovinare risultati con un premio vero in
palio si avvicina ai concorsi pronostici, che in Italia sono regolati dallo
Stato: premi veri solo dopo un parere legale, e in una lega aziendale il
premio e il regolamento sono dell'azienda (`legale/montepremi-bozza.md`).

**Parole da usare.** «Scegli», «sfida», «punti», «jolly». Mai «pronostico»,
«scommessa», «puntata», «quota»: è un gioco di conoscenza del campionato, e
l'app ha iscritti dai 14 anni.

## 3. TITO

Il draghetto viola di Fantatitano conduce le Sfide. File in `media/tito/`,
originali in `media/tito-sorgenti/`.

| Momento | Posa | Cosa dice (esempi) |
|---|---|---|
| Prima volta nelle Sfide | `nasce` | «Eccomi! Due scelte a settimana e sei in gara.» |
| Mancano le scelte | `indica` | «Ehi, mancano le tue scelte. Si chiude ven alle 15.» |
| Scelte fatte | `saluta` | «Fatto. Ci vediamo coi risultati.» |
| Chiuso, in attesa | `braccia` | «Adesso parla il campo.» |
| Giornata andata bene | `saluta` | «+5,5! Sei il terzo della settimana.» |
| Giornata andata male | `braccia` | «Zero punti. Tranquillo, si rifà la prossima.» |
| Edizione che deve cominciare | `uovo` | «Si schiude con la 16ª giornata.» |
| Titano della settimana | `uovo` dorato come trofeo | — |

TITO parla in prima persona, breve, mai più di una riga, mai sarcastico con
chi perde. Non compare dove c'è da leggere un dato serio (voti, contestazioni,
classifica del fantacalcio): lì l'app resta asciutta.

**Da sistemare prima di pubblicarlo** (vedi §8): chi ha i diritti sul disegno,
e la somiglianza con Spyro.

## 4. Le schermate

Stessa grammatica del resto dell'app: badge di stato sempre visibile, partite
scritte come `Squadra A — Squadra B` senza casa e trasferta (design/README,
decisione 3).

**A · In home.** Sotto la giornata corrente, una riga con TITO piccolo:
«Sfide di Tito · scegli entro ven 15:00» (in ambra se manca qualcosa),
«Scelte fatte: Tre Penne e Prandelli», «+5,5 punti · 3° della settimana».

**B · Le Sfide (#/sfide).** In alto TITO con la sua riga e la chiusura. Due
blocchi:

1. **La squadra**: le 8 partite, le due squadre come pulsanti. Una squadra
   usata due volte nel girone è spenta («già usata 2 volte»).
2. **Il migliore in campo**: si apre una partita e si sceglie fra i giocatori
   delle due squadre, ordinati per quotazione, con ruolo e media voto. Un
   giocatore già usato è spento.

Sotto, i jolly rimasti: si toccano per metterli su una sfida.

**C · Classifica (#/sfide/classifica).** Due schede: «Settimana» (con il
Titano della settimana in cima e l'uovo dorato) e «Girone». Il selettore in
alto sceglie fra la classifica di tutti e quelle delle proprie leghe.

**D · Le mie scelte.** Lo storico del girone: per ogni giornata squadra,
giocatore, jolly e punti. Le scelte degli altri si vedono solo dopo la
chiusura.

**E · Regolamento.** Gli articoli T.1–T.9 in una sezione propria.

## 5. Il database

Una migrazione, la **023-sfide.sql**, sullo schema delle formazioni.

```sql
create table public.sfide_scelte (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  matchday   int  not null check (matchday between 1 and 30),
  girone     int  generated always as ((matchday - 1) / 15) stored,
  club_id    text,          -- la squadra
  player_id  text,          -- il migliore in campo
  jolly      text check (jolly in ('raddoppio_squadra','raddoppio_giocatore','scudo')),
  updated_at timestamptz not null default now(),
  primary key (user_id, matchday)
);
```

- **Una riga per persona e giornata**, non per lega: le Sfide si giocano una
  volta e valgono in tutte le classifiche (T.8). Le classifiche delle leghe
  sono la stessa somma, filtrata sui membri.
- **Scrivere, cambiare, togliere**: solo le proprie e solo prima del lock
  (`matchday_lock_at`), come `lineups_write`.
- **Leggere**: le proprie sempre; quelle degli altri solo dopo il lock. Per la
  classifica di tutti serve una vista che esponga solo nome e punti, non chi
  sei né le tue leghe.
- **I limiti T.2 e T.3** (squadra al massimo 2 volte, giocatore 1 volta, jolly
  contati) li controlla una funzione del database prima di salvare, non solo
  l'app: chi apre la console del browser non deve poterli aggirare.
- Punti e classifiche **non si salvano**: si calcolano dalle scelte e dai
  dati FSGC, come i voti. Una sola fonte di verità.

## 6. Il codice

- `src/sfide.js` — il motore, funzione pura:
  `punteggi(scelte, partite, voti)` → punti per sfida, jolly applicati,
  Titano della settimana, classifica del girone.
- `src/views/sfide.js` — le schermate B, C, D.
- `src/tito.js` — chi è TITO in ogni momento: posa e frase, da un posto solo.
- `dashboard.js` — la riga A. `regolamento.js` — la sezione E.
- `supabase/functions/promemoria` — il promemoria delle scelte, insieme a quello
  della formazione.

## 7. Le prove

Ogni prova va fatta fallire una volta apposta:

- `tests/sfide.test.js` — il motore: vittoria, pareggio, sconfitta, voto alto,
  voto sotto il pavimento −2, giocatore non entrato, tavolino, rinvio, i due
  jolly, il congelamento, gli spareggi T.7;
- `supabase/prove/` — le regole: scelta dopo il lock rifiutata, terza volta la
  stessa squadra rifiutata, stesso giocatore due volte rifiutato, quarto jolly
  rifiutato, scelte altrui invisibili prima del lock;
- `prove/sfide.cjs` — col browser: scegliere, cambiare, squadra e giocatore
  usati spenti, jolly, classifica dopo la chiusura, la riga in home con TITO.

## 8. Rischi e cose da decidere

- **Diritti su TITO.** Va messo per iscritto chi l'ha disegnato e che i
  diritti sono di chi pubblica l'app. Se il disegno è stato fatto con
  un'intelligenza artificiale, il diritto d'autore sull'immagine è incerto: la
  protezione vera la dà la **registrazione del marchio** (nome e figura).
- **Somiglianza con Spyro.** Un drago viola con corna e ali richiama Spyro
  (Activision). TITO se ne distingue (felpa, cargo, ali lime, corna nere), ma
  conviene tenerlo lontano dalle pose e dai colori di Spyro, e non usare mai
  «drago» nel nome.
- **Complessità.** Due sfide più tre jolly sono già il massimo per «meno di un
  minuto». La terza sfida (il bomber, alla Strike) si aggiunge solo se i
  numeri dicono che la gente vuole di più.
- **Il fantacalcio prima di tutto.** Se le Sfide tolgono gente alla
  formazione invece di portarne, si vede nella scheda «Chi consegna»: va
  guardata separatamente prima e dopo il lancio.

## 9. In due tempi

**Fase 1** (circa 5 giorni): la classifica di tutti e quella dentro ogni lega,
le due sfide, i jolly, TITO, il promemoria.

**Fase 2** (circa 2–3 giorni in più): le leghe solo Sfide, per bar, club e
aziende, con il banner dello sponsor della lega che c'è già (migrazione 021).

Il prototipo navigabile, giocabile sulle prime quattro giornate vere, è
l'artifact «Le Sfide di Tito».
