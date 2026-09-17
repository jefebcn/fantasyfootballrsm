-- Il minimo che Supabase mette a disposizione e che un Postgres nudo non ha.
-- Serve solo alle prove: sul progetto vero queste cose ci sono già.
create schema if not exists auth;
-- Le colonne che la console amministrativa legge davvero: l'ultimo accesso e
-- la conferma dell'e-mail servono a rispondere a "non riesco a entrare", e su
-- Supabase ci sono. Tenerle fuori dallo stub voleva dire scoprire la
-- differenza solo sul database vero.
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz
);
alter table auth.users add column if not exists created_at timestamptz default now();
alter table auth.users add column if not exists last_sign_in_at timestamptz;
alter table auth.users add column if not exists email_confirmed_at timestamptz;
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
-- E l'accesso allo schema auth, che su Supabase i tre ruoli hanno.
--
-- Senza, una prova che diventa "authenticated" per verificare una policy si
-- ferma su "permission denied for schema auth" — perche' current_user_id()
-- passa da auth.uid() — e il rifiuto SEMBRA la policy che funziona mentre e'
-- l'ambiente che manca. E' successo provando che nessuno si promuove
-- amministratore da solo: la prova diceva ok per il motivo sbagliato.
grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to anon, authenticated, service_role;

alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
