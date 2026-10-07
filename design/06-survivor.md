# 06 — Survivor del Titano

Scheda di progetto, ottobre 2026. **Non ancora costruito**: si costruisce a
novembre–dicembre e parte con la prima giornata del girone di ritorno (la 16ª,
data non ancora pubblicata dalla FSGC).

L'idea viene da Skillbol (skillbol.com), che ha tre modalità sui campionati
maggiori. Qui se ne prende una sola, la più semplice, e la si adatta al
campionato sammarinese.

---

## 1. Perché

Il fantacalcio chiede tanto: asta, rosa da 25, formazione ogni settimana. Chi
segue il campionato ma non vuole quell'impegno oggi non ha niente da fare
nell'app. Il Survivor si gioca in dieci secondi a settimana: **scegli una
squadra che vince**.

Serve a tre cose:

- **porta dentro gente nuova**, che poi magari passa al fantacalcio;
- **si vende bene**: «il Survivor del bar», «il Survivor del club» sono facili
  da spiegare e si aggiungono ai pacchetti per club e aziende
  (MONETIZZAZIONE.md, §3b e §3c);
- **tiene vivo il lunedì** di chi è già nel fantacalcio, con una scelta in più.

Prima di costruirlo deve reggere il fantacalcio: la soglia di MONETIZZAZIONE.md
§4b (metà delle squadre che consegnano per tre giornate di fila) si verifica
entro il 2 novembre. Se non regge, il Survivor aspetta.

## 2. Le regole

Da scrivere così, art. per art., nel regolamento dell'app.

**S.1 — La scelta.** A ogni giornata ogni partecipante sceglie **una squadra**
del campionato. Se quella squadra vince, il partecipante passa il turno. Se
pareggia o perde, **perde una vita**.

**S.2 — Le vite.** Si parte con le vite decise dall'admin della lega: **1, 2 o
3**, di base **2**. Con una sola vita, nel campionato sammarinese, dove i
pareggi sono frequenti, il gioco finirebbe dopo poche giornate. Chi resta a
zero vite è eliminato; le sue scelte passate restano visibili.

**S.3 — Una volta per girone.** Ogni squadra si può scegliere **una sola volta
per girone**. Il campionato ha 16 squadre e 15 giornate per girone: 15 scelte
fra 16 squadre, e ne avanza una. Nel girone di ritorno si riparte da capo.
Le squadre forti finiscono presto: è questo che rende il gioco difficile.

**S.4 — Le edizioni.** Un Survivor dura **un girone**: andata (giornate 1–15)
o ritorno (16–30). Due edizioni a stagione, con due vincitori. Una lega che
attiva il Survivor a girone iniziato parte dalla giornata dopo, con meno scelte
ma la stessa regola S.3.

**S.5 — Quando si chiude.** La scelta si chiude **insieme alla formazione**:
alle 15:00 del giorno della prima partita della giornata, o al calcio d'inizio
se viene prima (lo stesso lock di oggi, applicato dal server). Fino ad allora
la si può cambiare.

**S.6 — Chi non sceglie.** Perde una vita. Il giorno prima della chiusura
arriva il promemoria, insieme a quello della formazione.

**S.7 — Le partite che non finiscono.**

| Stato della partita | Effetto |
|---|---|
| Giocata | vale il risultato |
| A tavolino | vale il risultato assegnato |
| Rinviata | **si passa il turno** senza perdere vite; la squadra conta come usata |
| Sospesa | come rinviata, finché la FSGC non dà un risultato |

Si passa il turno perché non è colpa di nessuno. La squadra resta usata, se no
basterebbe sperare in un rinvio per riaverla.

**S.8 — Chi vince.**

1. L'ultimo partecipante con almeno una vita.
2. Se gli ultimi rimasti escono **tutti nella stessa giornata**, vincono tutti
   insieme: nessuno resta fuori per sfortuna.
3. Se a fine girone sono vivi in più di uno, vince chi ha **più vite**; a
   parità, la **differenza reti totale** delle squadre scelte; a parità ancora,
   vincono insieme.

**S.9 — Premi.** Il Survivor è gratis come il resto dell'app. Un premio in
palio segue le stesse regole del montepremi (`legale/montepremi-bozza.md`):
in una lega aziendale il premio e il regolamento sono dell'azienda. Mai far
pagare per partecipare.

**Parole da usare.** «Scegli», «passa il turno», «vite», «eliminato». Mai
«pronostico», «scommessa», «puntata»: è un gioco di conoscenza del campionato,
e l'app ha iscritti dai 14 anni.

## 3. Le schermate

Stessa grammatica del resto dell'app: badge di stato sempre visibile, partite
scritte come `Squadra A — Squadra B` senza casa e trasferta
(design/README, decisione 3).

**A · In home (dashboard).** Una riga nella zona «Giornata corrente»:

- prima della chiusura: «Survivor · scegli entro ven 15:00», in ambra se non
  hai ancora scelto;
- dopo: «Hai scelto Tre Penne · 2 vite»;
- a risultato: «Passi il turno» oppure «Perdi una vita · ne resta 1»;
- eliminato: «Fuori alla 19ª · guarda chi resta».

**B · Scegli (#/survivor).** In testa le vite (cuori pieni e vuoti) e la
chiusura. Sotto le 8 partite della giornata, una riga per partita con le due
squadre come pulsanti. Una squadra già usata nel girone è spenta e dice «usata
alla 17ª». La scelta fatta ha il bordo oro. Un tocco sceglie, un altro tocco
su un'altra squadra cambia; niente pulsante «conferma», si salva da sola, come
la formazione.

**C · Chi resta (#/survivor/classifica).** Due blocchi:

- **Vivi**, con le vite;
- **Eliminati**, con la giornata di uscita.

Sotto, la **griglia delle scelte**: una riga per partecipante, una colonna
per giornata, lo stemma della squadra scelta colorato in verde (passato), rosso
(vita persa) o grigio (rinviata). Le scelte degli altri compaiono **solo dopo
la chiusura**, come le formazioni.

**D · Impostazioni della lega (admin).** «Survivor: acceso / spento», «Vite:
1 · 2 · 3». Le vite non si cambiano a edizione iniziata.

**E · Regolamento.** Gli articoli S.1–S.9 in una sezione propria.

## 4. Il database

Una migrazione, la **023-survivor.sql**, sullo schema delle formazioni.

```sql
create table public.survivor_scelte (
  league_id  uuid not null references public.leagues(id) on delete cascade,
  member_id  uuid not null references public.league_members(id) on delete cascade,
  matchday   int  not null check (matchday between 1 and 30),
  girone     int  generated always as ((matchday - 1) / 15) stored,
  club_id    text not null,
  updated_at timestamptz not null default now(),
  primary key (league_id, member_id, matchday),
  -- S.3: una squadra una volta sola per girone, garantito dal database
  unique (league_id, member_id, girone, club_id)
);
```

- **Leggere**: le proprie sempre; quelle degli altri membri della lega solo
  dopo il lock (`now() >= matchday_lock_at(matchday)`), come `lineups_read`.
- **Scrivere, cambiare, togliere**: solo le proprie e solo prima del lock,
  come `lineups_write`.
- `club_id` controllato contro l'elenco delle 16 società (vincolo `check`).
- Le impostazioni (acceso, vite) stanno nelle regole della lega
  (`leagues.rules`), come le altre opzioni: niente tabella nuova.
- Vite, eliminazioni e vincitori **non si salvano**: si calcolano dalle
  scelte e dai risultati, come i voti. Una sola fonte di verità, e una
  correzione della FSGC si propaga da sola.

## 5. Il codice

- `src/survivor.js` — il motore, una funzione pura:
  `survivor(scelte, partite, { vite, girone })` → per ogni partecipante: vite
  rimaste, giornata di uscita, esito di ogni scelta, vincitori.
- `src/views/survivor.js` — le schermate B e C.
- `dashboard.js` — la riga A. `regolamento.js` — la sezione E.
- `supabase/functions/promemoria` — il promemoria della scelta (S.6), insieme a
  quello della formazione.

## 6. Le prove

Come per il resto, ogni prova va fatta fallire una volta apposta:

- `tests/survivor.test.js` — il motore: vittoria, pareggio, sconfitta, rinvio,
  tavolino, mancata scelta, uscita di tutti nella stessa giornata, spareggi
  S.8, cambio di girone;
- `supabase/prove/` — le regole del database: scelta dopo il lock rifiutata,
  stessa squadra due volte nel girone rifiutata, scelte altrui invisibili
  prima del lock e visibili dopo, scelta in una lega non propria rifiutata;
- `prove/survivor.cjs` — col browser: scegliere, cambiare, squadra usata
  spenta, griglia dopo la chiusura, riga in home.

## 7. In due tempi

**Fase 1 — dentro le leghe che ci sono** (circa 3 giorni). L'admin lo accende
e la lega gioca fantacalcio e Survivor insieme. Si prova il gioco con chi c'è
già.

**Fase 2 — leghe solo Survivor** (circa 2 giorni in più). Una lega senza
asta, rosa e formazione: si nasconde tutto quello che lì non serve, come già
succede nelle leghe aperte. È la versione da vendere ai bar e ai club, e il
«Survivor del Titano» pubblico per chi arriva dallo Store senza amici.

Le altre due modalità di Skillbol restano fuori: SkillBattle si sovrappone al
Survivor; Strike (scegliere chi segna) sarebbe facile con i dati che abbiamo,
ma è una terza cosa da spiegare. Se ne riparla con i numeri del Survivor.
