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

-- 1-3. uuid → text, portandosi dietro tutte le chiavi che puntano a profiles
--
--    Questo pezzo e' stato riscritto dopo essere saltato tre volte, sempre
--    allo stesso modo. Prima l'elenco delle chiavi esterne da sciogliere era
--    scritto a mano, e ogni migrazione successiva ne aggiungeva una che qui
--    non c'era: matchday_locks da schema.sql, push_subscriptions dalla 005,
--    vice_user_id dalla 002. Ogni volta la conversione sbatteva contro il
--    vincolo rimasto in piedi — "sono di tipi incompatibili" — e ogni volta
--    si rattoppava aggiungendo una riga, in attesa della prossima.
--
--    Adesso le chiavi se le trova da sola nel catalogo: qualunque tabella
--    punti a profiles(id), oggi o in futuro, viene sciolta, convertita e
--    riagganciata con la SUA definizione originale, cascade compresi. Tutto
--    dentro un blocco solo, quindi o riesce tutto o non cambia niente: un
--    errore a meta' non lascia il database senza vincoli.
alter table public.profiles drop constraint if exists profiles_id_fkey;

do $$
declare
  c record;
  tabelle  text[] := '{}';   -- public.league_members, per le ALTER
  nomi_tab text[] := '{}';   -- league_members, per information_schema
  nomi     text[] := '{}';
  defs    text[] := '{}';
  colonne text[] := '{}';
  t text;
  i int;
begin
  -- 1. chi punta a profiles(id): me lo dice il catalogo, non un elenco
  for c in
    select con.conrelid::regclass::text as tab,   -- già qualificato e citato al bisogno
           cls.relname                  as nome_tab,
           con.conname                  as nome,
           pg_get_constraintdef(con.oid) as def,
           att.attname                  as col
      from pg_constraint con
      join pg_class cls on cls.oid = con.conrelid
      join pg_attribute att
        on att.attrelid = con.conrelid and att.attnum = con.conkey[1]
     where con.contype = 'f'
       and con.confrelid = 'public.profiles'::regclass
  loop
    tabelle := tabelle || c.tab;  nomi_tab := nomi_tab || c.nome_tab;
    nomi := nomi || c.nome;       defs := defs || c.def;
    colonne := colonne || c.col;
    execute format('alter table %s drop constraint %I', c.tab, c.nome);
  end loop;

  -- 2. la conversione vera, sull'id e su tutto cio' che lo referenzia
  select data_type into t from information_schema.columns
   where table_schema = 'public' and table_name = 'profiles' and column_name = 'id';
  if t = 'uuid' then
    alter table public.profiles alter column id type text using id::text;
  end if;
  for i in 1 .. coalesce(array_length(tabelle, 1), 0) loop
    select data_type into t from information_schema.columns
     where table_schema = 'public' and table_name = nomi_tab[i] and column_name = colonne[i];
    if t = 'uuid' then
      execute format('alter table %s alter column %I type text using %I::text',
                     tabelle[i], colonne[i], colonne[i]);
    end if;
  end loop;

  -- 3. e si riaggancia tutto com'era
  for i in 1 .. coalesce(array_length(tabelle, 1), 0) loop
    execute format('alter table %s add constraint %I %s', tabelle[i], nomi[i], defs[i]);
  end loop;
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
