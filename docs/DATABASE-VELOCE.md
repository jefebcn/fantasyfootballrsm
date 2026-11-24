# Database veloce: regole per non rallentare l'app

Sullo stesso Supabase girano il calcio (Fantatitano), il futsal e presto un
altro gioco. Il database è uno solo: una tabella scritta male rallenta
**tutti**, non solo il gioco che la usa. Queste regole valgono per ogni
tabella, regola di accesso (RLS) e richiesta nuova.

## Cosa è successo (22/11)

Domenica sera, dopo le partite, quattro telefoni hanno avuto «canceling
statement due to statement timeout» (listone, negozio, squadra, gioco). La
richiesta era sempre la stessa: le formazioni della lega pubblica, circa
1.900 righe. Le righe erano poche. Il problema erano le **regole di accesso
ricalcolate a ogni riga**: circa 930 ms a pagina con il database tranquillo,
oltre gli 8 secondi concessi quando tanta gente apriva l'app insieme.
Corretto con le migrazioni 068, 069 e futsal-13.

## Le regole

### 1. Regole RLS: le funzioni si calcolano una volta, non a ogni riga

È la causa numero uno di lentezza su Supabase, prima degli indici.

- **Mai** una funzione con la colonna come argomento confrontata riga per
  riga, come `is_league_member(league_id)` o `my_member_id(league_id)`:
  Postgres la esegue per ogni riga.
- **Sì** al confronto con un elenco calcolato una volta:
  `league_id in (select public.mie_leghe())`,
  `member_id in (select public.mie_squadre())`,
  `matchday in (select public.giornate_chiuse())`.
- Le funzioni senza argomenti si mettono **dentro una select**:
  `(select public.is_admin())`, non `is_admin()`. Così Postgres le calcola
  una volta per richiesta (InitPlan).
- Lo stesso vale per `auth.uid()` e `current_user_id()` scritti direttamente
  nella regola: `user_id = (select public.current_user_id())`.

### 2. Mai `FOR ALL` accanto a una regola di lettura

Una regola `FOR ALL` («per tutto») vale **anche in lettura**. Se la tabella
ha già la sua regola di lettura, ogni select le valuta tutte e due.

- Scrittura = tre regole: `for insert`, `for update`, `for delete`.
- **Una sola regola permissiva per azione e per ruolo.** Se servono due
  condizioni (es. «tutti vedono quelli in corso, l'admin vede tutto»), si
  uniscono in OR dentro la stessa regola.
- Modello pronto: `pg_temp.dividi(...)` in
  `supabase/migrations/069-regole-veloci-tabelle-globali.sql`.

### 3. Indici

- Ogni colonna usata per filtrare o unire (`where`, join, chiavi esterne,
  colonne usate nelle regole RLS) ha un indice. La chiave primaria conta come
  indice solo per la sua **prima** colonna.
- Non aggiungere indici «per sicurezza»: ognuno rallenta le scritture.

### 4. Leggere solo quello che serve

- Niente `select('*')` su tabelle grandi o con colonne pesanti (JSON, testi
  lunghi): elencare le colonne. Su tabelle piccole è tollerato.
- Le tabelle grandi si leggono a pagine da 1000 con `tutte()`
  (`src/backend.js`), ordinate su colonne con indice.
- Filtrare sul server (`.eq`, `.gte`…), non scaricare tutto e filtrare nel
  telefono.

### 5. Niente richieste in fila

- Mai una richiesta per ogni elemento di un elenco (il problema «N+1»): una
  sola richiesta con `.in('id', ids)` o una join.
- Richieste indipendenti partono insieme con `Promise.all` e `insieme()`.
  Un `await` dentro l'elenco le mette in fila (vedi il commento di
  `insieme()` in `src/backend.js`).

### 6. Cose che NON servono a noi

- `CLUSTER` (riordinare la tabella sul disco): con migliaia di righe non
  cambia niente e blocca la tabella mentre lavora.
- Pubblicità, cache esterne, database separati: non a questi volumi.

## Come controllare

1. **Controllo di Supabase**: nel pannello, Advisors → Performance (o
   `get_advisors` con tipo `performance`). Da guardare dopo ogni migrazione
   che tocca regole o tabelle:
   - `multiple_permissive_policies` → regola 2;
   - `auth_rls_initplan` → regola 1;
   - `unindexed_foreign_keys` → regola 3.

   `unused_index` è solo un'informazione: non va inseguita.
2. **Misurare una richiesta** come la vede un utente vero, dentro una
   transazione annullata:

   ```sql
   begin;
   select set_config('request.jwt.claims', '{"sub":"<id utente>","role":"authenticated"}', true);
   set local role authenticated;
   explain (analyze, buffers) select ... ;
   rollback;
   ```

   Se compare `Seq Scan` su una tabella grande, o un `Filter:` con funzioni
   e migliaia di «Rows Removed», è lì il problema.
3. **Console dell'app** (Amministrazione → Numeri → Errori sui telefoni):
   «statement timeout» vuol dire una richiesta oltre gli 8 secondi. Lo
   stack indica la funzione di `src/backend.js` che l'ha fatta.

## Prima di unire una migrazione nuova

- [ ] Nessuna regola `FOR ALL` su una tabella che ha anche una regola di lettura.
- [ ] Funzioni nelle regole dentro `(select ...)` o come elenco `in (select ...)`.
- [ ] Indici sulle colonne filtrate e sulle chiavi esterne.
- [ ] La migrazione si può rieseguire: `drop policy if exists` per **ogni**
  regola che crea, anche quelle nuove. `supabase/prove/prova.sh` la esegue
  due volte.
- [ ] Le migrazioni girano in ordine alfabetico: una migrazione `0xx` non può
  toccare tabelle che nascono in `futsal-*` (e viceversa).
- [ ] Dopo l'applicazione: Advisors → Performance senza avvisi nuovi.
