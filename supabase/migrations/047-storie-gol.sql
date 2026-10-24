-- =====================================================================
-- 047 — Le storie Instagram dei gol
--
-- Si può rieseguire.
--
-- PERCHÉ (Alex, 24/10). A ogni gol vero una storia su Instagram, entro un
-- paio di minuti (scripts/gol-in-diretta.py, scripts/pubblica-storia.mjs).
-- Il lavoro gira su GitHub con la chiave service_role: qui solo quello che
-- gli serve, e niente che si veda da fuori.
--
--  1. il secchio «storie»: pubblico in lettura, perché Instagram va a
--     prendere l'immagine da un indirizzo. Ci scrive solo la service_role.
--  2. storie_pubblicate: cosa è già uscito, così un lavoro ripartito a metà
--     partita non pubblica due volte lo stesso gol, e il tetto al giorno.
--  3. social_token: il token di Instagram dura 60 giorni e lo script lo
--     rinnova da solo; il nuovo va tenuto da qualche parte che non sia il
--     repository. Nessuno lo legge tranne la service_role.
--  4. possesso_giocatori(): in quante squadre di Fantatitano è ogni
--     giocatore. Solo numeri, nessun nome di chi gioca; e comunque solo per
--     la service_role.
-- =====================================================================

-- Su Supabase lo schema storage c'e'; nel Postgres nudo delle prove no.
do $$ begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public) values ('storie', 'storie', true)
    on conflict (id) do update set public = true;
  end if;
end $$;

create table if not exists public.storie_pubblicate (
  id            text primary key,          -- giornata-casa-ospite-minuto-giocatore
  media_id      text,
  url           text,
  pubblicata_at timestamptz not null default now()
);
alter table public.storie_pubblicate enable row level security;
revoke all on table public.storie_pubblicate from public, anon, authenticated;

create table if not exists public.social_token (
  rete        text primary key,              -- 'instagram'
  token       text not null,
  scade_at    timestamptz,
  aggiornato_at timestamptz not null default now()
);
alter table public.social_token enable row level security;
revoke all on table public.social_token from public, anon, authenticated;

create or replace function public.possesso_giocatori() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'squadre', (select count(distinct member_id) from public.rosters where released_at is null),
    'possesso', coalesce((select json_object_agg(player_id, n) from (
       select player_id, count(distinct member_id) n from public.rosters
        where released_at is null group by player_id) x), '{}'::json))
$$;
revoke all on function public.possesso_giocatori() from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.possesso_giocatori() to service_role;
  end if;
end $$;

select (select count(*) from public.storie_pubblicate) as storie_pubblicate;
