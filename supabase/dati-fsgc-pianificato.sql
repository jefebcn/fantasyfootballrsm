-- L'import dei dati FSGC parte dall'orologio del database, non da GitHub.
--
-- PERCHE'. I dati del campionato (calendario, risultati, referti) li legge
-- scripts/importa-fsgc.py, dentro il lavoro .github/workflows/dati-fsgc.yml,
-- e li scrive nell'app. Quel lavoro e' pianificato "ogni due ore", ma GitHub
-- le corse pianificate le accoda e le salta: misurate il 29-30 settembre, una
-- ogni 5-6 ore. La domenica sera vuol dire voti che arrivano ore dopo il
-- referto.
--
-- Il database non puo' far girare Python. Puo' fare da OROLOGIO: pg_cron
-- passa quando dice di passare, e con pg_net chiede a GitHub di far partire
-- quel lavoro subito. Una partenza chiesta cosi' (workflow_dispatch) GitHub
-- la serve in pochi secondi — e' la coda delle corse PIANIFICATE che salta,
-- non quella delle corse chieste. E' lo stesso schema del promemoria
-- (supabase/promemoria-pianificato.sql).
--
-- QUANDO. Ogni 30 minuti da venerdi' a lunedi' — si gioca venerdi', sabato e
-- domenica, e i referti possono uscire il lunedi' — e ogni ora gli altri
-- giorni. L'orologio di pg_cron e' in UTC: il confine dei giorni e' spostato
-- di un'ora o due, e non cambia niente. Girare a vuoto non costa: se la FSGC
-- non ha pubblicato niente il lavoro non committa, e su un repository
-- pubblico i minuti di Actions non si pagano.
--
-- LA RISERVA. La corsa pianificata di GitHub resta dov'e': se un giorno
-- questo orologio si ferma (token scaduto, per esempio) si torna com'era
-- prima, non a niente. E due partenze vicine non si pestano i piedi: il
-- lavoro ha un gruppo di concorrenza, la seconda aspetta la prima.
--
-- COME SI USA. C'e' UNA riga da riempire, il token, ed e' segnata qui sotto.
-- Poi si lancia tutto il file nel SQL Editor di Supabase. Se il token non c'e'
-- (o non e' del tipo giusto) il file si ferma e te lo dice, senza creare
-- niente. SI PUO' RILANCIARE: riscrive la configurazione e ripianifica senza
-- duplicare. E' anche il modo di cambiare il token quando scade.
--
-- DOPO, per vedere com'e' andata:
--   select * from interno.fsgc_ultime;
-- stato 204 = GitHub ha accettato e il lavoro e' partito.
-- stato 401 = token scaduto o sbagliato: se ne fa uno nuovo e si rilancia.
-- stato 403/404 = il token non ha il permesso su QUESTO repository.


-- ===================== LA RIGA DA RIEMPIRE =====================
-- Un token di GitHub "fine-grained", fatto apposta e capace di UNA cosa sola:
--
--   GitHub -> Settings -> Developer settings -> Personal access tokens
--          -> Fine-grained tokens -> Generate new token
--     Token name:          fantatitano-orologio-fsgc
--     Expiration:          la piu' lunga che propone (segnati la data)
--     Repository access:   Only select repositories -> fantasyfootballrsm
--     Permissions:         Repository permissions -> Actions -> Read and write
--                          (e nient'altro: "Metadata: read" lo mette da solo)
--
-- Comincia con github_pat_. I token "classic" (ghp_...) vengono rifiutati di
-- proposito: valgono per TUTTI i tuoi repository e con permessi larghi, e un
-- token che sta scritto dentro un database deve poter fare il meno possibile.
-- Questo, se qualcuno lo leggesse, potrebbe solo far partire i lavori di
-- questo repository.
--
-- Il token si incolla QUI, nell'SQL Editor. Non in una chat, non in un
-- commit, non in un file del repository.
select set_config('fsgc.token', 'IL-TOKEN-DI-GITHUB', false);
-- ===============================================================


do $$
declare
  t text := coalesce(current_setting('fsgc.token', true), '');
begin
  if t = 'IL-TOKEN-DI-GITHUB' or t = '' then
    raise exception 'Manca il token: nella riga set_config(''fsgc.token'') in cima al file, al posto di IL-TOKEN-DI-GITHUB, va un token fine-grained di GitHub (comincia con github_pat_). E'' l''unica riga da riempire; come si fa e'' scritto sopra.';
  end if;
  if t like 'ghp\_%' or t like 'gho\_%' then
    raise exception 'Questo e'' un token "classic" di GitHub (comincia con ghp_): vale per tutti i tuoi repository. Serve uno fine-grained (github_pat_...) limitato a fantasyfootballrsm con il solo permesso Actions: read and write.';
  end if;
  if t not like 'github\_pat\_%' or length(t) < 40 then
    raise exception 'Il token non sembra un token fine-grained di GitHub: deve cominciare con github_pat_ ed essere lungo (una novantina di caratteri). Controlla di averlo copiato tutto.';
  end if;
end $$;


-- 1. Le due estensioni. pg_cron e' l'orologio, pg_net fa la chiamata HTTP.
--    Sono le stesse del promemoria: se quello e' gia' stato caricato, qui non
--    cambia niente.
create extension if not exists pg_cron;
create extension if not exists pg_net;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;


-- 2. Lo schema che l'API non espone (lo stesso del promemoria).
create schema if not exists interno;
revoke all on schema interno from public;


-- 3. Il token e dove chiamare: una riga sola.
create table if not exists interno.fsgc_config (
  id         int primary key default 1 check (id = 1),
  token      text not null check (token like 'github\_pat\_%' and length(token) >= 40),
  repository text not null default 'jefebcn/fantasyfootballrsm',
  lavoro     text not null default 'dati-fsgc.yml',
  ramo       text not null default 'main',
  scritta_at timestamptz not null default now()
);
alter table interno.fsgc_config enable row level security;
revoke all on table interno.fsgc_config from public;

insert into interno.fsgc_config (id, token)
values (1, current_setting('fsgc.token'))
on conflict (id) do update set token = excluded.token, scritta_at = now();


-- 4. Il registro delle chiamate: pg_net e' asincrono, qui si segna il numero
--    della richiesta e la risposta si legge dov'e' arrivata.
create table if not exists interno.fsgc_corse (
  id         bigserial primary key,
  quando     timestamptz not null default now(),
  request_id bigint not null
);
alter table interno.fsgc_corse enable row level security;
revoke all on table interno.fsgc_corse from public;
-- il registro non deve crescere per sempre: 48 righe al giorno nel fine
-- settimana, e a leggere servono le ultime
create or replace function interno.fsgc_pulisci() returns void
language sql security definer set search_path = pg_catalog, public as $$
  delete from interno.fsgc_corse where quando < now() - interval '14 days';
$$;
revoke all on function interno.fsgc_pulisci() from public;


-- 5. La funzione che chiede a GitHub di far partire il lavoro.
--
-- GitHub vuole quattro intestazioni: il token, il tipo di risposta, la
-- versione dell'API e un User-Agent — senza User-Agent risponde 403, e il
-- motivo non e' scritto da nessuna parte nella risposta.
create or replace function interno.chiama_import_fsgc()
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
  select * into c from interno.fsgc_config where id = 1;
  if not found then
    raise exception 'import FSGC: manca la configurazione (interno.fsgc_config)';
  end if;

  select n.nspname into sch
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where p.proname = 'http_post' and n.nspname in ('net', 'extensions', 'public')
   order by case n.nspname when 'net' then 1 when 'extensions' then 2 else 3 end
   limit 1;
  if sch is null then
    raise exception 'import FSGC: pg_net non e'' installato (create extension pg_net)';
  end if;

  execute format(
    'select %I.http_post(url := $1, headers := $2, body := $3, timeout_milliseconds := $4)', sch)
    into rid
    using format('https://api.github.com/repos/%s/actions/workflows/%s/dispatches', c.repository, c.lavoro),
          jsonb_build_object(
            'Authorization', 'Bearer ' || c.token,
            'Accept', 'application/vnd.github+json',
            'X-GitHub-Api-Version', '2022-11-28',
            'User-Agent', 'fantatitano-orologio-fsgc',
            'Content-Type', 'application/json'),
          jsonb_build_object('ref', c.ramo),
          20000;

  insert into interno.fsgc_corse (request_id) values (rid);
  perform interno.fsgc_pulisci();
  return rid;
end $$;

revoke all on function interno.chiama_import_fsgc() from public;


-- 6. Com'e' andata (204 = partito).
do $$
declare sch text;
begin
  select n.nspname into sch
    from pg_class t join pg_namespace n on n.oid = t.relnamespace
   where t.relname = '_http_response' limit 1;
  if sch is null then
    raise notice 'pg_net non ha (ancora) la tabella delle risposte: la vista interno.fsgc_ultime non viene creata';
    return;
  end if;
  execute format($v$
    create or replace view interno.fsgc_ultime as
      select c.quando,
             r.status_code as stato,
             case r.status_code
               when 204 then 'partito'
               when 401 then 'token scaduto o sbagliato: fanne uno nuovo e rilancia questo file'
               when 403 then 'il token non ha il permesso Actions su questo repository'
               when 404 then 'repository o lavoro non trovati, oppure il token non vede il repository'
               else r.error_msg
             end as cosa_vuol_dire
        from interno.fsgc_corse c
        left join %I._http_response r on r.id = c.request_id
       order by c.quando desc
       limit 20
  $v$, sch);
  execute 'revoke all on interno.fsgc_ultime from public';
end $$;


-- 7. I due orologi: fitto quando si gioca, piu' largo gli altri giorni.
--    Minuti sfasati da quelli del promemoria (37) e di GitHub (7).
select cron.unschedule(jobid) from cron.job where jobname in ('fsgc-weekend', 'fsgc-settimana');
select cron.schedule('fsgc-weekend',   '*/30 * * * 0,1,5,6', 'select interno.chiama_import_fsgc();');
select cron.schedule('fsgc-settimana', '23 * * * 2,3,4',     'select interno.chiama_import_fsgc();');


-- 8. Una chiamata subito, per vedere adesso se il token va.
select interno.chiama_import_fsgc() as richiesta_in_coda;
