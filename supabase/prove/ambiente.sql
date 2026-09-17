-- Il minimo che Supabase mette a disposizione e che un Postgres nudo non ha.
-- Serve solo alle prove: sul progetto vero queste cose ci sono già.
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb
);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon')          then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role')  then create role service_role nologin bypassrls; end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- I PERMESSI PREDEFINITI, che sono la parte che mancava.
--
-- Su Supabase il progetto nasce con questo, e non e' un dettaglio:
--   alter default privileges in schema public grant all on functions
--     to postgres, anon, authenticated, service_role;
-- Cioe' ogni funzione creata dopo NASCE eseguibile dal ruolo anonimo, per un
-- permesso dato al ruolo e non a PUBLIC. Quindi un "revoke all ... from
-- public" nelle migrazioni non gli toglie niente: PUBLIC e anon sono due cose
-- diverse.
--
-- Senza queste righe il Postgres delle prove era piu' severo del sistema
-- vero: la' anon non aveva nessun permesso di partenza, un revoke da PUBLIC
-- bastava, e una funzione lasciata aperta agli anonimi restava verde qui e
-- aperta la'. Verificato sul progetto vero: elimina_profilo, appena
-- caricata, si e' fatta eseguire dal ruolo anonimo (si e' fermata da sola,
-- ma il corpo e' partito).
--
-- Le prove devono essere severe come il sistema vero, non di piu' e non di
-- meno: tutte e due le differenze fanno danno, e questa lo faceva nel verso
-- peggiore.
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
