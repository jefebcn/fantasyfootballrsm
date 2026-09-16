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

-- 1-3. uuid → text, portandosi dietro tutto quello che ci si appoggia
--
--    Questo pezzo e' stato riscritto quattro volte, e ogni riscrittura ha
--    imparato una cosa. Vale la pena averle scritte, perche' ognuna sembrava
--    la fine del problema e non lo era.
--
--    1) L'elenco delle chiavi esterne da sciogliere era scritto a mano, e ogni
--       migrazione successiva ne aggiungeva una che qui non c'era:
--       matchday_locks da schema.sql, push_subscriptions dalla 005,
--       vice_user_id dalla 002.
--    2) Stessa storia per le policy: Postgres non cambia il tipo di una
--       colonna nominata da una policy, e la 002 crea leagues_delete su
--       created_by.
--    3) Chiavi e policy trovate dal catalogo non bastano su un database
--       MEZZO migrato. La vecchia 001 scioglieva le chiavi come istruzioni
--       separate — nell'SQL Editor ognuna fa storia a se' — e poi moriva piu'
--       avanti: user_id, created_by e le altre restano uuid e senza chiave,
--       quindi invisibili a chi le cerca dal catalogo. Per quelle serve
--       l'elenco: non come meccanismo, ma come rete di sicurezza.
--    4) Il vincolo "check (vice_user_id is null or vice_user_id <> user_id)"
--       della 002 tiene insieme due colonne: convertendone una alla volta,
--       dopo la prima si ritrova text da un lato e uuid dall'altro.
--
--    Quindi: l'elenco noto UNITO a quello che dice il catalogo; si sciolgono
--    chiavi e vincoli check che toccano quelle colonne, e le policy che le
--    nominano; si converte una tabella alla volta ma tutte le sue colonne
--    nella stessa istruzione; si riaggancia tutto con la definizione
--    originale. Dentro un blocco solo, cioe' una transazione: o riesce tutto
--    o non cambia niente.
alter table public.profiles drop constraint if exists profiles_id_fkey;

do $$
declare
  c record;
  nomi_tab text[] := '{}';   -- league_members, per information_schema
  colonne  text[] := '{}';
  vincoli  text[] := '{}';   -- tabella, nome e definizione da rimettere
  v_nomi   text[] := '{}';
  v_defs   text[] := '{}';
  t text;
begin
  -- a) le colonne d'identita': quelle note piu' quelle che il catalogo trova
  for c in
    select nome_tab, colonna from (
      select * from (values
        ('profiles','id'), ('league_members','user_id'), ('league_members','vice_user_id'),
        ('leagues','created_by'), ('match_overrides','updated_by'), ('match_events','created_by'),
        ('matchday_status','changed_by'), ('change_log','by_user'),
        ('matchday_locks','updated_by'), ('push_subscriptions','user_id')
      ) as noti(nome_tab, colonna)
      union
      select cls.relname, att.attname
        from pg_constraint con
        join pg_class cls on cls.oid = con.conrelid
        join pg_attribute att on att.attrelid = con.conrelid and att.attnum = con.conkey[1]
       where con.contype = 'f' and con.confrelid = 'public.profiles'::regclass
    ) v
     where to_regclass('public.' || nome_tab) is not null
       and exists (select 1 from information_schema.columns
                    where table_schema='public' and table_name = v.nome_tab and column_name = v.colonna)
  loop
    nomi_tab := nomi_tab || c.nome_tab; colonne := colonne || c.colonna;
  end loop;

  -- b) via le policy appese a quelle colonne. Ognuna viene annunciata con la
  --    sua definizione: se una non dovesse tornare, il testo per rimetterla
  --    resta nel registro dell'SQL Editor. Tornano tutte: queste le rifa' il
  --    punto 8, le altre le migrazioni che le hanno create.
  for c in
    select distinct pol.polname as nome, pol.polrelid::regclass::text as tab,
           pg_get_expr(pol.polqual, pol.polrelid) as usando,
           pg_get_expr(pol.polwithcheck, pol.polrelid) as controllo
      from pg_depend d
      join pg_policy pol on pol.oid = d.objid
      join pg_attribute att on att.attrelid = d.refobjid and att.attnum = d.refobjsubid
      join pg_class cls on cls.oid = att.attrelid
      join pg_namespace ns on ns.oid = cls.relnamespace
     where d.classid = 'pg_policy'::regclass and d.refclassid = 'pg_class'::regclass
       and ns.nspname = 'public'
       and (cls.relname, att.attname) in (
             select unnest(nomi_tab), unnest(colonne))
  loop
    raise notice 'tolgo la policy %.% — using (%) with check (%)',
      c.tab, c.nome, coalesce(c.usando,'—'), coalesce(c.controllo,'—');
    execute format('drop policy if exists %I on %s', c.nome, c.tab);
  end loop;

  -- c) via chiavi esterne e vincoli check che toccano quelle colonne, tenendo
  --    da parte la definizione. Primarie e uniche non si toccano: quelle
  --    Postgres le ricostruisce da solo cambiando il tipo.
  for c in
    select distinct con.oid, con.conrelid::regclass::text as tab, con.conname as nome,
           pg_get_constraintdef(con.oid) as def
      from pg_constraint con
      join pg_depend d on d.objid = con.oid and d.classid = 'pg_constraint'::regclass
      join pg_attribute att on att.attrelid = d.refobjid and att.attnum = d.refobjsubid
      join pg_class cls on cls.oid = att.attrelid
      join pg_namespace ns on ns.oid = cls.relnamespace
     where con.contype in ('f','c') and ns.nspname = 'public'
       and (cls.relname, att.attname) in (select unnest(nomi_tab), unnest(colonne))
  loop
    vincoli := vincoli || c.tab; v_nomi := v_nomi || c.nome; v_defs := v_defs || c.def;
    execute format('alter table %s drop constraint %I', c.tab, c.nome);
  end loop;

  -- d) la conversione: una tabella per volta, ma tutte le sue colonne nella
  --    stessa istruzione, se no il check della 002 vede i due tipi disallineati
  for c in
    select nome_tab, array_agg(colonna) as cols from (
      select nomi_tab[k] as nome_tab, colonne[k] as colonna
        from generate_subscripts(nomi_tab, 1) as g(k)
    ) v
     where (select data_type from information_schema.columns
             where table_schema='public' and table_name = v.nome_tab and column_name = v.colonna) = 'uuid'
     group by nome_tab
  loop
    select string_agg(format('alter column %I type text using %I::text', x, x), ', ')
      into t from unnest(c.cols) as x;
    execute format('alter table public.%I %s', c.nome_tab, t);
  end loop;

  -- e) e si riaggancia tutto com'era
  for i in 1 .. coalesce(array_length(vincoli, 1), 0) loop
    execute format('alter table %s add constraint %I %s', vincoli[i], v_nomi[i], v_defs[i]);
  end loop;

  -- f) le chiavi note che MANCANO si rimettono
  --    Su un database mezzo migrato non basta rimettere quelle che si sono
  --    sciolte qui: la vecchia 001 ne aveva gia' sciolte sei come istruzioni
  --    separate, che nell'SQL Editor fanno storia a se', e poi era morta.
  --    Quelle sei non le rimetteva piu' nessuno, e il database restava senza.
  for c in
    select * from (values
      ('league_members','league_members_user_id_fkey','user_id'),
      ('league_members','league_members_vice_user_id_fkey','vice_user_id'),
      ('leagues','leagues_created_by_fkey','created_by'),
      ('match_overrides','match_overrides_updated_by_fkey','updated_by'),
      ('match_events','match_events_created_by_fkey','created_by'),
      ('matchday_status','matchday_status_changed_by_fkey','changed_by'),
      ('change_log','change_log_by_user_fkey','by_user'),
      ('matchday_locks','matchday_locks_updated_by_fkey','updated_by'),
      ('push_subscriptions','push_subscriptions_user_id_fkey','user_id')
    ) as noti(tab, nome, col)
  loop
    -- la tabella puo' non esserci (push_subscriptions arriva con la 005) e la
    -- colonna nemmeno (vice_user_id arriva con la 002): in quel caso la chiave
    -- la mette la migrazione che la crea, non questa
    if to_regclass('public.' || c.tab) is not null
       and exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = c.tab and column_name = c.col)
       and not exists (select 1 from pg_constraint where conname = c.nome
                        and conrelid = ('public.' || c.tab)::regclass) then
      execute format('alter table public.%I add constraint %I foreign key (%I) references public.profiles(id)%s',
                     c.tab, c.nome, c.col,
                     case c.col when 'vice_user_id' then ' on delete set null'
                                when 'user_id'      then ' on delete cascade'
                                else '' end);
    end if;
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
