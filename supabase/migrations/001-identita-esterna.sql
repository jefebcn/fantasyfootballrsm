-- =====================================================================
-- 001 — Identità indipendente dal fornitore (Clerk oppure Supabase Auth)
--
-- Perché: le policy usavano auth.uid(), che esiste solo con Supabase Auth.
-- Con Clerk l'identità arriva nel claim "sub" del token, ed è una stringa
-- (user_2abc…), non un uuid. Dopo questa migrazione l'identità è sempre
-- `current_user_id()` e funziona con entrambi, senza altre modifiche.
--
-- Conserva i dati esistenti: converte i tipi, non ricrea le tabelle.
-- Eseguire nell'SQL Editor dopo schema.sql.
-- =====================================================================

-- 0. via le policy che citano le colonne da convertire.
--    Postgres rifiuta di cambiare il tipo di una colonna nominata da una
--    policy ("cannot alter type of a column used in a policy definition"):
--    finché queste tre restavano in piedi, il punto 2 qui sotto si fermava
--    all'errore e la migrazione non passava su un'installazione nuova.
--    Sono esattamente le tre che il punto 8 ricrea su current_user_id(), e
--    l'elenco è scritto a mano di proposito: buttarne giù una qualsiasi con
--    un ciclo toglierebbe in silenzio regole di sicurezza che nessuno rimette.
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists members_update      on public.league_members;
drop policy if exists members_delete      on public.league_members;

-- 1. via i vincoli verso auth.users e le chiavi esterne che bloccano il cambio tipo
alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.league_members drop constraint if exists league_members_user_id_fkey;
alter table public.leagues drop constraint if exists leagues_created_by_fkey;
alter table public.match_overrides drop constraint if exists match_overrides_updated_by_fkey;
alter table public.match_events drop constraint if exists match_events_created_by_fkey;
alter table public.matchday_status drop constraint if exists matchday_status_changed_by_fkey;
alter table public.change_log drop constraint if exists change_log_by_user_fkey;
-- matchday_locks nasce in schema.sql ma è arrivata dopo che questa migrazione
-- era già scritta: senza convertirla anche lei, la chiave esterna del punto 3
-- puntava da un uuid a un text e il database la rifiutava.
do $$ begin
  if to_regclass('public.matchday_locks') is not null then
    alter table public.matchday_locks drop constraint if exists matchday_locks_updated_by_fkey;
  end if;
end $$;
-- push_subscriptions nasce nella 005, cioè DOPO questa migrazione. Chi ha un
-- database dove la 005 è già passata nella sua prima versione si ritrova
-- user_id uuid agganciato a profiles(id), e la conversione qui sotto sbatteva
-- contro quel vincolo: "user_id e id sono di tipi incompatibili".
do $$ begin
  if to_regclass('public.push_subscriptions') is not null then
    alter table public.push_subscriptions drop constraint if exists push_subscriptions_user_id_fkey;
  end if;
end $$;

-- 2. uuid → text
--    Ogni conversione è preceduta dal controllo del tipo attuale: rieseguire
--    questa migrazione su un database già convertito non deve fallire. Senza
--    il controllo ci riprovava lo stesso e Postgres si impuntava sulle policy
--    che nel frattempo aveva creato la 002.
do $$
declare
  t text; c record;
begin
  for c in
    select * from (values
      ('profiles',        'id'),
      ('league_members',  'user_id'),
      ('leagues',         'created_by'),
      ('match_overrides', 'updated_by'),
      ('match_events',    'created_by'),
      ('matchday_status', 'changed_by'),
      ('change_log',      'by_user'),
      ('matchday_locks',  'updated_by'),
      ('push_subscriptions', 'user_id')
    ) as v(tab, col)
  loop
    if to_regclass('public.' || c.tab) is null then continue; end if;
    select data_type into t from information_schema.columns
     where table_schema = 'public' and table_name = c.tab and column_name = c.col;
    if t = 'uuid' then
      execute format('alter table public.%I alter column %I type text using %I::text', c.tab, c.col, c.col);
    end if;
  end loop;
end $$;

-- 3. chiavi esterne verso profiles (non più verso auth.users)
alter table public.league_members add constraint league_members_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;
alter table public.leagues        add constraint leagues_created_by_fkey        foreign key (created_by) references public.profiles(id);
alter table public.match_overrides add constraint match_overrides_updated_by_fkey foreign key (updated_by) references public.profiles(id);
alter table public.match_events   add constraint match_events_created_by_fkey    foreign key (created_by) references public.profiles(id);
alter table public.matchday_status add constraint matchday_status_changed_by_fkey foreign key (changed_by) references public.profiles(id);
alter table public.change_log     add constraint change_log_by_user_fkey         foreign key (by_user)   references public.profiles(id);
do $$ begin
  if to_regclass('public.matchday_locks') is not null then
    alter table public.matchday_locks add constraint matchday_locks_updated_by_fkey
      foreign key (updated_by) references public.profiles(id);
  end if;
  if to_regclass('public.push_subscriptions') is not null then
    alter table public.push_subscriptions add constraint push_subscriptions_user_id_fkey
      foreign key (user_id) references public.profiles(id) on delete cascade;
  end if;
end $$;

-- 4. l'identità corrente, qualunque sia il fornitore
--    Supabase Auth: "sub" è l'uuid dell'utente. Clerk: "sub" è l'id Clerk.
create or replace function public.current_user_id() returns text
language sql stable as $$ select nullif(auth.jwt() ->> 'sub', '') $$;

-- 5. il profilo lo crea il client al primo accesso (vale per entrambi i fornitori)
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

-- 6. funzioni di supporto riscritte su current_user_id()
create or replace function public.is_judge() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_judge from public.profiles where id = public.current_user_id()), false)
$$;
create or replace function public.is_league_member(lid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.league_members where league_id = lid and user_id = public.current_user_id())
$$;
create or replace function public.is_league_admin(lid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.league_members where league_id = lid and user_id = public.current_user_id() and role = 'admin')
$$;
create or replace function public.my_member_id(lid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.league_members where league_id = lid and user_id = public.current_user_id()
$$;

create or replace function public.create_league(p_name text, p_short text, p_team text, p_color text, p_initials text)
returns uuid language plpgsql security definer set search_path = public as $$
declare lid uuid; uid text;
begin
  uid := public.current_user_id();
  if uid is null then raise exception 'non autenticato'; end if;
  if not exists (select 1 from public.profiles where id = uid) then raise exception 'profilo mancante'; end if;
  insert into public.leagues (name, short_name, created_by) values (p_name, coalesce(p_short, p_name), uid) returning id into lid;
  insert into public.league_members (league_id, user_id, role, team_name, owner_name, color, initials)
  values (lid, uid, 'admin', p_team, (select display_name from public.profiles where id = uid), coalesce(p_color, '#1B84C6'), p_initials);
  return lid;
end $$;

create or replace function public.join_league(p_code text, p_team text, p_color text, p_initials text)
returns uuid language plpgsql security definer set search_path = public as $$
declare lid uuid; n int; uid text;
begin
  uid := public.current_user_id();
  if uid is null then raise exception 'non autenticato'; end if;
  select id into lid from public.leagues where invite_code = upper(trim(p_code));
  if lid is null then raise exception 'Codice invito non valido'; end if;
  select count(*) into n from public.league_members where league_id = lid;
  if n >= 12 then raise exception 'Lega al completo (max 12, art. 1.1)'; end if;
  insert into public.league_members (league_id, user_id, team_name, owner_name, color, initials)
  values (lid, uid, p_team, (select display_name from public.profiles where id = uid), coalesce(p_color, '#1B84C6'), p_initials)
  on conflict (league_id, user_id) do nothing;
  return lid;
end $$;

-- 7. il registro modifiche usa la stessa identità
create or replace function public.log_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.change_log (by_user, match_id, matchday, what, payload)
  values (public.current_user_id(), coalesce(new.match_id, old.match_id), public.matchday_of(coalesce(new.match_id, old.match_id)),
          tg_table_name || ':' || lower(tg_op), coalesce(to_jsonb(new), to_jsonb(old)));
  return coalesce(new, old);
end $$;

-- 8. policy che citavano auth.uid()
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert to authenticated
  with check (id = public.current_user_id());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = public.current_user_id())
  with check (id = public.current_user_id() and is_judge = (select is_judge from public.profiles p where p.id = public.current_user_id()));

drop policy if exists members_update on public.league_members;
create policy members_update on public.league_members for update to authenticated
  using (public.is_league_admin(league_id) or user_id = public.current_user_id())
  with check (public.is_league_admin(league_id) or (user_id = public.current_user_id() and role = (select role from public.league_members m where m.id = league_members.id)));
drop policy if exists members_delete on public.league_members;
create policy members_delete on public.league_members for delete to authenticated
  using (public.is_league_admin(league_id) and user_id <> public.current_user_id());
