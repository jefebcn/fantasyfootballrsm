-- Il promemoria della formazione parte dal database, non da GitHub.
--
-- PERCHE'. L'avviso lo chiama un'azione pianificata su GitHub, ogni ora al
-- minuto 7. Solo che le corse pianificate di GitHub non passano ogni ora:
-- misurate su questo repository, 3,2 - 6,3 - 5,8 ore fra una e l'altra, e il
-- 17 settembre cinque ore e mezza senza una corsa mentre la finestra
-- dell'avviso era aperta. GitHub le accoda e le salta quando la piattaforma e'
-- carica, e il workflow resta verde mentre succede.
--
-- pg_cron gira dentro Postgres e passa quando dice di passare. La 009 ha gia'
-- reso l'avviso indipendente dall'orologio — si segna chi e' stato avvisato,
-- quindi qualunque corsa dentro le 24 ore consegna, e una volta sola — percio'
-- i due orologi possono convivere: questo al minuto 37, GitHub al minuto 7
-- come riserva. Due corse sovrapposte non spediscono due volte: da_avvisare
-- segna e restituisce in una sola istruzione.
--
-- COSA FA. Crea uno schema privato (interno) che l'API non espone, ci mette
-- indirizzo e token della funzione, una funzione che la chiama con pg_net, un
-- registro delle chiamate e il lavoro pianificato.
--
-- COME SI USA. C'e' UNA riga da riempire, il token, ed e' segnata qui sotto:
-- tutto il resto non si tocca. Poi si lancia tutto il file nel SQL Editor di
-- Supabase. Se il token non c'e' il file si ferma e te lo dice, senza creare
-- niente.
--
-- SI PUO' RILANCIARE quando vuoi: riscrive la configurazione e ripianifica il
-- lavoro senza duplicarlo. E' anche il modo di cambiare il token dopo averlo
-- rifatto.
--
-- DOPO, per vedere com'e' andata:
--   select * from interno.promemoria_ultime;
-- La risposta e' la stessa che si leggeva nel registro di GitHub:
--   {"giornate":[4],"spedite":1,"iscritti":1}


-- ===================== LA RIGA DA RIEMPIRE =====================
-- Il token: lo stesso valore del secret PROMEMORIA_TOKEN fra i secret delle
-- Edge Functions su Supabase (Project Settings -> Edge Functions -> Secrets).
-- Non e' un valore nuovo: e' quello.
--
-- NON E' IL NOME DELLA FUNZIONE. Sono due cose diverse e i nomi si somigliano:
--   PROMEMORIA_FUNZIONE = 'promemoria-'  -> come si chiama la funzione
--                                           nell'indirizzo (lo slug)
--   PROMEMORIA_TOKEN    = una stringa    -> la parola d'ordine che la funzione
--                         lunga e casuale   pretende, perche' e' raggiungibile
--                                           da internet
-- Il token e' lungo di proposito: se qualcuno lo indovina puo' far partire i
-- promemoria a suo piacimento. Per questo qui sotto un valore piu' corto di
-- 16 caratteri viene rifiutato.
--
-- SE NON RIESCI PIU' A RILEGGERLO — succede, i secret si mostrano mascherati —
-- se ne fa uno nuovo. Questa riga, lanciata da sola in una query qualunque, ne
-- stampa uno buono (64 caratteri esadecimali, niente estensioni):
--
--   select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '') as token_nuovo;
--
-- Quel valore va in TRE posti, identico: qui sotto, nel secret
-- PROMEMORIA_TOKEN delle Edge Functions, e nel secret omonimo su GitHub.
-- Poi la funzione va ridistribuita (supabase functions deploy promemoria
-- --no-verify-jwt), perche' il secret nuovo lo prende al deploy.
--
-- L'indirizzo e' gia' scritto: e' il progetto di quest'app, lo stesso che sta
-- in src/config.js e che il browser chiama a ogni schermata. Non e' un
-- segreto, e si cambia solo se il progetto cambia.
select set_config('promemoria.url',   'https://nskgzpbcssnpfuxmbepa.supabase.co/functions/v1', false),
       set_config('promemoria.token', 'IL-TOKEN-DEL-PROMEMORIA', false);
-- ===============================================================


-- Il controllo viene prima di tutto il resto: se il file parte com'e' stato
-- scaricato non deve creare mezzo impianto puntato su un indirizzo finto.
do $$
declare
  u text := coalesce(current_setting('promemoria.url', true), '');
  t text := coalesce(current_setting('promemoria.token', true), '');
begin
  if u not like 'https://%' then
    raise exception 'L''indirizzo non va: deve cominciare con https:// ed e'' la riga set_config(''promemoria.url'') in cima al file.';
  end if;
  if t = 'IL-TOKEN-DEL-PROMEMORIA' or length(t) < 16 then
    raise exception 'Manca il token: nella riga set_config(''promemoria.token'') in cima al file, al posto di IL-TOKEN-DEL-PROMEMORIA, va il valore del secret PROMEMORIA_TOKEN (Supabase -> Project Settings -> Edge Functions -> Secrets). E'' l''unica riga da riempire.';
  end if;
end $$;


-- 1. Le due estensioni. pg_cron e' l'orologio, pg_net fa la chiamata HTTP.
create extension if not exists pg_cron;
create extension if not exists pg_net;
-- i due grant sono quelli della documentazione di Supabase: senza, il
-- proprietario del progetto non vede nemmeno l'elenco dei lavori pianificati
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;


-- 2. Uno schema che l'API non espone.
--
-- PostgREST pubblica public (e graphql_public): quello che sta qui dentro non
-- e' raggiungibile dalla rete, ne' con la chiave pubblica ne' con quella di
-- servizio. E' il posto giusto per un token.
create schema if not exists interno;
revoke all on schema interno from public;


-- 3. Indirizzo, token e nome della funzione: una riga sola.
--
-- Lo slug e' 'promemoria-', col trattino in fondo: non e' un errore di
-- battitura, e' come si chiama la funzione su questo progetto — misurato
-- chiamandola (senza trattino risponde 404 NOT_FOUND). E' lo stesso valore
-- che sta nel secret PROMEMORIA_FUNZIONE su GitHub. Se un giorno la funzione
-- si ridistribuisce con un altro slug:
--   update interno.promemoria_config set funzione = 'promemoria' where id = 1;
create table if not exists interno.promemoria_config (
  id       int primary key default 1 check (id = 1),
  url      text not null check (url like 'https://%'),
  token    text not null check (length(token) >= 16),
  funzione text not null default 'promemoria-',
  scritta_at timestamptz not null default now()
);
-- Cintura e bretelle: lo schema non e' esposto, la tabella non ha permessi per
-- nessuno, e con RLS accesa e zero policy resta vuota anche per il
-- service_role. Ci arriva solo il proprietario del database.
alter table interno.promemoria_config enable row level security;
revoke all on table interno.promemoria_config from public;

insert into interno.promemoria_config (id, url, token)
values (1, rtrim(current_setting('promemoria.url'), '/'), current_setting('promemoria.token'))
on conflict (id) do update
  set url = excluded.url, token = excluded.token, scritta_at = now();


-- 4. Il registro delle chiamate.
--
-- Serve a rispondere alla domanda che prima si leggeva nel registro di GitHub:
-- e' partita? cosa ha risposto? pg_net e' asincrono — mette la richiesta in
-- coda e la spedisce un attimo dopo — quindi qui si segna il numero della
-- richiesta e la risposta si va a leggere dov'e' arrivata.
create table if not exists interno.promemoria_corse (
  id         bigserial primary key,
  quando     timestamptz not null default now(),
  request_id bigint not null
);
alter table interno.promemoria_corse enable row level security;
revoke all on table interno.promemoria_corse from public;


-- 5. La funzione che chiama.
--
-- Lo schema di pg_net si cerca invece di darlo per scontato: su Supabase le
-- sue funzioni stanno in "net", ma le estensioni si possono installare
-- altrove, e un "net.http_post" scritto a mano si rompe senza dire perche'.
create or replace function interno.chiama_promemoria()
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  c   record;
  sch text;
  rid bigint;
begin
  select * into c from interno.promemoria_config where id = 1;
  if not found then
    raise exception 'promemoria: manca la configurazione (interno.promemoria_config)';
  end if;

  select n.nspname into sch
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where p.proname = 'http_post' and n.nspname in ('net', 'extensions', 'public')
   order by case n.nspname when 'net' then 1 when 'extensions' then 2 else 3 end
   limit 1;
  if sch is null then
    raise exception 'promemoria: pg_net non e'' installato (create extension pg_net)';
  end if;

  execute format(
    'select %I.http_post(url := $1, headers := $2, body := $3, timeout_milliseconds := $4)', sch)
    into rid
    using c.url || '/' || c.funzione,
          jsonb_build_object('x-promemoria-token', c.token, 'Content-Type', 'application/json'),
          '{}'::jsonb,
          20000;

  insert into interno.promemoria_corse (request_id) values (rid);
  return rid;
end $$;

revoke all on function interno.chiama_promemoria() from public;


-- 6. Com'e' andata.
--
-- La vista si crea con format perche' anche qui lo schema di pg_net si cerca.
-- Le risposte di pg_net non restano per sempre (le ripulisce lui): qui si
-- vedono le ultime, ed e' quello che serve — "l'ultima corsa cosa ha detto".
do $$
declare sch text;
begin
  select n.nspname into sch
    from pg_class t join pg_namespace n on n.oid = t.relnamespace
   where t.relname = '_http_response' limit 1;
  if sch is null then
    raise notice 'pg_net non ha (ancora) la tabella delle risposte: la vista interno.promemoria_ultime non viene creata';
    return;
  end if;
  execute format($v$
    create or replace view interno.promemoria_ultime as
      select c.quando,
             r.status_code as stato,
             r.content     as risposta,
             r.error_msg   as errore
        from interno.promemoria_corse c
        left join %I._http_response r on r.id = c.request_id
       order by c.quando desc
       limit 20
  $v$, sch);
  execute 'revoke all on interno.promemoria_ultime from public';
end $$;


-- 7. Il lavoro pianificato.
--
-- Al minuto 37 e non al 7: quello e' di GitHub, e tenerli sfasati fa due
-- passaggi all'ora invece di due nello stesso istante.
select cron.unschedule(jobid) from cron.job where jobname = 'promemoria';
select cron.schedule('promemoria', '37 * * * *', 'select interno.chiama_promemoria();');


-- 8. Una chiamata subito, per non aspettare il minuto 37.
select interno.chiama_promemoria() as richiesta_in_coda;
