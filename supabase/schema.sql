-- =====================================================================
-- Fantacampionato Sammarinese — schema Supabase (Postgres + RLS)
-- Esegui questo file nell'SQL Editor del progetto Supabase.
-- Il listone, il calendario e le società restano generati dal client
-- (src/data.js): qui vivono solo account, leghe e i "delta" del dato.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- profili
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  is_judge boolean not null default false,          -- Giudice Dati (globale, art. 9.4)
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------- leghe
create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text,
  invite_code text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 6)),
  rules jsonb not null default '{}'::jsonb,        -- override di DEFAULT_RULES (§6 README)
  season_id text not null default 's2026',
  created_by uuid references public.profiles(id),
  started boolean not null default false,           -- rose assegnate
  created_at timestamptz not null default now()
);

create table if not exists public.league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'fantallenatore' check (role in ('admin', 'fantallenatore')),
  team_name text not null,
  owner_name text,
  color text not null default '#1B84C6',
  initials text,
  credits int not null default 500,
  created_at timestamptz not null default now(),
  unique (league_id, user_id)
);

create table if not exists public.rosters (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  member_id uuid not null references public.league_members(id) on delete cascade,
  player_id text not null,
  price_paid int not null default 1,
  acquired_at timestamptz not null default now(),
  released_at timestamptz
);
create unique index if not exists rosters_active_player on public.rosters (league_id, player_id) where released_at is null;

create table if not exists public.lineups (
  league_id uuid not null references public.leagues(id) on delete cascade,
  member_id uuid not null references public.league_members(id) on delete cascade,
  matchday int not null check (matchday between 1 and 30),
  lineup jsonb not null,
  submitted_at timestamptz not null default now(),
  primary key (league_id, member_id, matchday)
);

create table if not exists public.contestazioni (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  member_id uuid not null references public.league_members(id) on delete cascade,
  match_id text not null,
  player_id text,
  minute int,
  text text not null,
  status text not null default 'open' check (status in ('open', 'accolta', 'respinta')),
  note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- ---------------------------------------------------------------- dato del campionato (globale)
create table if not exists public.match_overrides (
  match_id text primary key,                         -- es. md12_m3 (calendario generato)
  status text not null default 'played' check (status in ('scheduled','played','postponed','suspended_before_45','suspended_after_45','awarded')),
  home_goals int,
  away_goals int,
  video_url text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create table if not exists public.match_events (
  id uuid primary key default gen_random_uuid(),
  match_id text not null,
  player_id text not null,
  club_id text not null,
  minute int not null check (minute between 0 and 120),
  type text not null check (type in ('goal','assist','own_goal','yellow','red_direct','second_yellow','pen_missed','pen_saved','pen_won','pen_conceded')),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);
create index if not exists match_events_match on public.match_events (match_id);

create table if not exists public.match_appearances (
  match_id text not null,
  player_id text not null,
  club_id text not null,
  started boolean not null default true,
  minutes_played int not null default 90 check (minutes_played between 0 and 120),
  entered_at int not null default 0,
  primary key (match_id, player_id)
);

create table if not exists public.matchday_status (
  matchday int primary key check (matchday between 1 and 30),
  status text not null check (status in ('provisional', 'frozen')),
  changed_at timestamptz not null default now(),
  changed_by uuid references public.profiles(id)
);

create table if not exists public.matchday_locks (
  matchday int primary key check (matchday between 1 and 30),
  lock_at timestamptz not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create table if not exists public.change_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  by_user uuid references public.profiles(id),
  match_id text,
  matchday int,
  what text not null,
  payload jsonb
);

-- ---------------------------------------------------------------- funzioni di supporto
create or replace function public.is_judge() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_judge from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_league_member(lid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.league_members where league_id = lid and user_id = auth.uid())
$$;

create or replace function public.is_league_admin(lid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.league_members where league_id = lid and user_id = auth.uid() and role = 'admin')
$$;

create or replace function public.my_member_id(lid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.league_members where league_id = lid and user_id = auth.uid()
$$;

-- Lock formazioni (art. 8.3): sabato 15:00 Europe/Rome della giornata n. Allineato a SEASON_START in src/data.js.
-- Il lock e' un DATO, non una formula: viene dal calendario vero della FSGC,
-- lo stesso che usa l'app. Prima era '2026-09-05 15:00' + (n-1)*7 giorni, con
-- otto giorni di scarto su tutte e 30 le giornate rispetto al calendario: la
-- formazione restava scrivibile per otto giorni dopo la partita e le
-- formazioni altrui non si potevano leggere fino a otto giorni dopo.
-- NULL quando la giornata non e' ancora stata sincronizzata: le policy lo
-- interpretano ciascuna nella propria direzione prudente.
create or replace function public.matchday_lock_at(n int) returns timestamptz
language sql stable security definer set search_path = public as $$
  select lock_at from public.matchday_locks where matchday = n
$$;

/** Riscrive il calendario dei lock. La chiama l'app col calendario che ha in
 *  mano, cosi' le due date non possono divergere: sono la stessa.
 *  [{"matchday": 1, "lock_at": "2026-08-28T15:00:00+02:00"}, ...] */
create or replace function public.sync_matchday_locks(p jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare scritte int;
begin
  if not public.is_judge() then
    raise exception 'solo il Giudice Dati puo aggiornare il calendario dei lock';
  end if;
  insert into public.matchday_locks (matchday, lock_at, updated_at, updated_by)
  select (e->>'matchday')::int, (e->>'lock_at')::timestamptz, now(), auth.uid()
    from jsonb_array_elements(p) e
   where (e->>'matchday')::int between 1 and 30
  on conflict (matchday) do update
    set lock_at = excluded.lock_at, updated_at = now(), updated_by = excluded.updated_by
    where public.matchday_locks.lock_at <> excluded.lock_at;
  get diagnostics scritte = row_count;
  return scritte;
end $$;

create or replace function public.matchday_of(mid text) returns int
language sql immutable as $$
  select nullif(regexp_replace(split_part(mid, '_', 1), '\D', '', 'g'), '')::int
$$;

create or replace function public.matchday_is_frozen(n int) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.matchday_status where matchday = n and status = 'frozen')
$$;

-- Congelamento (art. 9.2): blocca ogni scrittura sul dato di una giornata congelata.
create or replace function public.guard_frozen() returns trigger
language plpgsql as $$
declare mid text; n int;
begin
  mid := coalesce(new.match_id, old.match_id);
  n := public.matchday_of(mid);
  if public.matchday_is_frozen(n) then
    raise exception 'Giornata % congelata (art. 9.2)', n;
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists guard_frozen_events on public.match_events;
create trigger guard_frozen_events before insert or update or delete on public.match_events for each row execute procedure public.guard_frozen();
drop trigger if exists guard_frozen_appearances on public.match_appearances;
create trigger guard_frozen_appearances before insert or update or delete on public.match_appearances for each row execute procedure public.guard_frozen();
drop trigger if exists guard_frozen_overrides on public.match_overrides;
create trigger guard_frozen_overrides before insert or update or delete on public.match_overrides for each row execute procedure public.guard_frozen();

-- Registro modifiche automatico (art. 9.3): chi, quando, cosa.
create or replace function public.log_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.change_log (by_user, match_id, matchday, what, payload)
  values (auth.uid(), coalesce(new.match_id, old.match_id), public.matchday_of(coalesce(new.match_id, old.match_id)),
          tg_table_name || ':' || lower(tg_op), coalesce(to_jsonb(new), to_jsonb(old)));
  return coalesce(new, old);
end $$;
drop trigger if exists log_events on public.match_events;
create trigger log_events after insert or update or delete on public.match_events for each row execute procedure public.log_change();
drop trigger if exists log_overrides on public.match_overrides;
create trigger log_overrides after insert or update or delete on public.match_overrides for each row execute procedure public.log_change();

-- Crea una lega e iscrive il creatore come admin.
create or replace function public.create_league(p_name text, p_short text, p_team text, p_color text, p_initials text)
returns uuid language plpgsql security definer set search_path = public as $$
declare lid uuid;
begin
  if auth.uid() is null then raise exception 'non autenticato'; end if;
  insert into public.leagues (name, short_name, created_by) values (p_name, coalesce(p_short, p_name), auth.uid()) returning id into lid;
  insert into public.league_members (league_id, user_id, role, team_name, owner_name, color, initials)
  values (lid, auth.uid(), 'admin', p_team, (select display_name from public.profiles where id = auth.uid()), coalesce(p_color, '#1B84C6'), p_initials);
  return lid;
end $$;

-- Entra in una lega con il codice invito.
create or replace function public.join_league(p_code text, p_team text, p_color text, p_initials text)
returns uuid language plpgsql security definer set search_path = public as $$
declare lid uuid; n int;
begin
  if auth.uid() is null then raise exception 'non autenticato'; end if;
  select id into lid from public.leagues where invite_code = upper(trim(p_code));
  if lid is null then raise exception 'Codice invito non valido'; end if;
  select count(*) into n from public.league_members where league_id = lid;
  if n >= 12 then raise exception 'Lega al completo (max 12, art. 1.1)'; end if;
  insert into public.league_members (league_id, user_id, team_name, owner_name, color, initials)
  values (lid, auth.uid(), p_team, (select display_name from public.profiles where id = auth.uid()), coalesce(p_color, '#1B84C6'), p_initials)
  on conflict (league_id, user_id) do nothing;
  return lid;
end $$;

-- ---------------------------------------------------------------- RLS
alter table public.profiles enable row level security;
alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.rosters enable row level security;
alter table public.lineups enable row level security;
alter table public.contestazioni enable row level security;
alter table public.match_overrides enable row level security;
alter table public.match_events enable row level security;
alter table public.match_appearances enable row level security;
alter table public.matchday_status enable row level security;
alter table public.change_log enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (true);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and is_judge = (select is_judge from public.profiles p where p.id = auth.uid()));

drop policy if exists leagues_read on public.leagues;
create policy leagues_read on public.leagues for select to authenticated using (public.is_league_member(id));
drop policy if exists leagues_update on public.leagues;
create policy leagues_update on public.leagues for update to authenticated using (public.is_league_admin(id)) with check (public.is_league_admin(id));

drop policy if exists members_read on public.league_members;
create policy members_read on public.league_members for select to authenticated using (public.is_league_member(league_id));
drop policy if exists members_update on public.league_members;
create policy members_update on public.league_members for update to authenticated
  using (public.is_league_admin(league_id) or user_id = auth.uid())
  with check (public.is_league_admin(league_id) or (user_id = auth.uid() and role = (select role from public.league_members m where m.id = league_members.id)));
drop policy if exists members_delete on public.league_members;
create policy members_delete on public.league_members for delete to authenticated using (public.is_league_admin(league_id) and user_id <> auth.uid());

drop policy if exists rosters_read on public.rosters;
create policy rosters_read on public.rosters for select to authenticated using (public.is_league_member(league_id));
drop policy if exists rosters_write on public.rosters;
create policy rosters_write on public.rosters for all to authenticated using (public.is_league_admin(league_id)) with check (public.is_league_admin(league_id));

-- Con la tabella dei lock ancora vuota si sbaglia nella direzione che non fa
-- danno: la scrittura resta aperta (nessuno chiuso fuori dalla propria
-- formazione) e la lettura resta chiusa (nessuno sbircia le altrui). Le due
-- coalesce sono diverse di proposito.
drop policy if exists lineups_read on public.lineups;
create policy lineups_read on public.lineups for select to authenticated
  using (public.is_league_member(league_id) and (member_id = public.my_member_id(league_id) or now() >= coalesce(public.matchday_lock_at(matchday), 'infinity'::timestamptz)));
drop policy if exists lineups_write on public.lineups;
create policy lineups_write on public.lineups for all to authenticated
  using (member_id = public.my_member_id(league_id) and now() < coalesce(public.matchday_lock_at(matchday), 'infinity'::timestamptz))
  with check (member_id = public.my_member_id(league_id) and now() < coalesce(public.matchday_lock_at(matchday), 'infinity'::timestamptz));

drop policy if exists contest_read on public.contestazioni;
create policy contest_read on public.contestazioni for select to authenticated using (public.is_league_member(league_id) or public.is_judge());
drop policy if exists contest_insert on public.contestazioni;
create policy contest_insert on public.contestazioni for insert to authenticated with check (member_id = public.my_member_id(league_id) and status = 'open');
drop policy if exists contest_update on public.contestazioni;
create policy contest_update on public.contestazioni for update to authenticated using (public.is_judge()) with check (public.is_judge());

drop policy if exists global_read_overrides on public.match_overrides;
create policy global_read_overrides on public.match_overrides for select to authenticated using (true);
drop policy if exists global_write_overrides on public.match_overrides;
create policy global_write_overrides on public.match_overrides for all to authenticated using (public.is_judge()) with check (public.is_judge());
drop policy if exists global_read_events on public.match_events;
create policy global_read_events on public.match_events for select to authenticated using (true);
drop policy if exists global_write_events on public.match_events;
create policy global_write_events on public.match_events for all to authenticated using (public.is_judge()) with check (public.is_judge());
drop policy if exists global_read_app on public.match_appearances;
create policy global_read_app on public.match_appearances for select to authenticated using (true);
drop policy if exists global_write_app on public.match_appearances;
create policy global_write_app on public.match_appearances for all to authenticated using (public.is_judge()) with check (public.is_judge());
drop policy if exists global_read_status on public.matchday_status;
create policy global_read_status on public.matchday_status for select to authenticated using (true);
drop policy if exists global_write_status on public.matchday_status;
create policy global_write_status on public.matchday_status for all to authenticated using (public.is_judge()) with check (public.is_judge());

alter table public.matchday_locks enable row level security;
drop policy if exists locks_read on public.matchday_locks;
create policy locks_read on public.matchday_locks for select to authenticated using (true);
drop policy if exists locks_write on public.matchday_locks;
create policy locks_write on public.matchday_locks for all to authenticated using (public.is_judge()) with check (public.is_judge());
revoke all on function public.sync_matchday_locks(jsonb) from public;
grant execute on function public.sync_matchday_locks(jsonb) to authenticated;
drop policy if exists log_read on public.change_log;
create policy log_read on public.change_log for select to authenticated using (public.is_judge());
drop policy if exists log_insert on public.change_log;
create policy log_insert on public.change_log for insert to authenticated with check (public.is_judge());

-- ---------------------------------------------------------------- realtime
do $$ begin
  alter publication supabase_realtime add table public.lineups, public.rosters, public.league_members, public.contestazioni,
    public.match_overrides, public.match_events, public.match_appearances, public.matchday_status, public.matchday_locks;
exception when others then null; end $$;

-- Per nominare il Giudice Dati (una volta, dall'SQL Editor):
--   update public.profiles set is_judge = true where id = (select id from auth.users where email = 'giudice@esempio.it');
