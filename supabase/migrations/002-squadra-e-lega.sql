-- =====================================================================
-- 002 — Eliminare la lega, personalizzare la squadra, allenatore in seconda
--
-- Da eseguire nell'SQL Editor di Supabase DOPO schema.sql e 001.
-- È scritto per poter essere rieseguito senza danni.
-- =====================================================================

-- ---------------------------------------------------------------- 1. eliminare la lega
-- Solo chi l'ha creata. Le righe collegate (membri, rose, formazioni,
-- contestazioni) hanno già "on delete cascade": spariscono con la lega.
drop policy if exists leagues_delete on public.leagues;
-- current_user_id() e non auth.uid(): dopo la 001 created_by e' text, mentre
-- auth.uid() torna un uuid. Il confronto non compilava ("operator does not
-- exist: text = uuid") e la policy non nasceva affatto — cioe' nessuno poteva
-- cancellare la propria lega, senza che niente lo dicesse.
create policy leagues_delete on public.leagues for delete to authenticated
  using (created_by = public.current_user_id());

-- ---------------------------------------------------------------- 2. stemma e maglia
-- crest_url tiene una data URL: la foto viene ridotta dal client a 192px e
-- ricompressa, quindi sono ~15 KB a squadra. Con dodici squadre è poca roba e
-- non serve configurare lo Storage; se un giorno servono immagini grandi, qui
-- va messo l'URL del bucket invece della data URL, senza altri cambi.
alter table public.league_members add column if not exists crest_url text;
alter table public.league_members add column if not exists kit jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------- 3. allenatore in seconda
-- Una seconda persona sulla STESSA squadra: non è un altro partecipante, non
-- ha una rosa sua e non occupa un posto in classifica. Entra col link.
-- text e non uuid: dopo la 001 profiles.id e' text. Con uuid la colonna non
-- nasceva e con lei se ne andava tutto il resto di questa migrazione.
alter table public.league_members add column if not exists vice_user_id text references public.profiles(id) on delete set null;
do $$ begin
  if (select data_type from information_schema.columns
      where table_schema='public' and table_name='league_members' and column_name='vice_user_id') = 'uuid' then
    alter table public.league_members drop constraint if exists league_members_vice_user_id_fkey;
    alter table public.league_members alter column vice_user_id type text using vice_user_id::text;
    alter table public.league_members add constraint league_members_vice_user_id_fkey
      foreign key (vice_user_id) references public.profiles(id) on delete set null;
  end if;
end $$;
alter table public.league_members add column if not exists vice_code text;
create unique index if not exists members_vice_code on public.league_members (vice_code) where vice_code is not null;
-- Nessuno può fare il vice di due squadre nella stessa lega, né essere vice
-- della squadra di cui è già titolare.
create unique index if not exists members_vice_unico on public.league_members (league_id, vice_user_id) where vice_user_id is not null;
alter table public.league_members drop constraint if exists members_vice_non_titolare;
alter table public.league_members add constraint members_vice_non_titolare check (vice_user_id is null or vice_user_id <> user_id);

-- Le funzioni di appartenenza devono riconoscere anche il vice, se no il
-- secondo allenatore non vedrebbe nemmeno la lega.
create or replace function public.is_league_member(lid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.league_members
    where league_id = lid and (user_id = public.current_user_id() or vice_user_id = public.current_user_id())
  )
$$;

-- Il vice NON è admin: quello resta di chi ha il ruolo sulla propria riga.
create or replace function public.is_league_admin(lid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.league_members
    where league_id = lid and user_id = public.current_user_id() and role = 'admin'
  )
$$;

-- Il vice schiera la formazione della squadra di cui è vice: my_member_id gli
-- restituisce quella. Chi è titolare ha sempre la precedenza sulla propria.
create or replace function public.my_member_id(lid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.league_members
  where league_id = lid and (user_id = public.current_user_id() or vice_user_id = public.current_user_id())
  order by (user_id = public.current_user_id()) desc
  limit 1
$$;

-- Il titolare modifica la propria riga; il vice può toccare solo stemma,
-- maglia e nomi, non il ruolo, i crediti o il proprio stesso invito.
drop policy if exists members_update on public.league_members;
create policy members_update on public.league_members for update to authenticated
  using (public.is_league_admin(league_id) or user_id = public.current_user_id() or vice_user_id = public.current_user_id())
  with check (
    public.is_league_admin(league_id)
    or (user_id = public.current_user_id() and role = (select role from public.league_members m where m.id = league_members.id))
    or (vice_user_id = public.current_user_id()
        and role = (select role from public.league_members m where m.id = league_members.id)
        and credits = (select credits from public.league_members m where m.id = league_members.id)
        and user_id = (select user_id from public.league_members m where m.id = league_members.id)
        and vice_user_id = (select vice_user_id from public.league_members m where m.id = league_members.id))
  );

-- Genera (o rigenera) il codice d'invito per il secondo allenatore.
-- Rigenerarlo invalida il link precedente: è il modo per revocare un invito
-- che non si vuole più far usare.
create or replace function public.rigenera_codice_vice(p_member uuid) returns text
language plpgsql security definer set search_path = public as $$
declare codice text;
begin
  if not exists (select 1 from public.league_members where id = p_member and user_id = public.current_user_id()) then
    raise exception 'Solo chi possiede la squadra può invitare un allenatore in seconda';
  end if;
  codice := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 8));
  update public.league_members set vice_code = codice where id = p_member;
  return codice;
end $$;

-- Entra come allenatore in seconda usando il codice del link.
create or replace function public.entra_come_vice(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare riga public.league_members;
begin
  select * into riga from public.league_members where vice_code = upper(trim(p_code));
  if riga.id is null then raise exception 'Invito non valido o già usato'; end if;
  if riga.user_id = public.current_user_id() then raise exception 'Questa squadra è già tua'; end if;
  if riga.vice_user_id is not null then raise exception 'Questa squadra ha già un allenatore in seconda'; end if;
  if exists (select 1 from public.league_members
             where league_id = riga.league_id and (user_id = public.current_user_id() or vice_user_id = public.current_user_id())) then
    raise exception 'Sei già in questa lega con una squadra tua';
  end if;
  -- Il codice si consuma: il link vale una volta sola.
  update public.league_members set vice_user_id = public.current_user_id(), vice_code = null where id = riga.id;
  return riga.league_id;
end $$;

-- Toglie l'allenatore in seconda. Lo può fare il titolare, o il vice stesso.
create or replace function public.togli_vice(p_member uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.league_members
                 where id = p_member and (user_id = public.current_user_id() or vice_user_id = public.current_user_id())) then
    raise exception 'Non puoi togliere l''allenatore in seconda di questa squadra';
  end if;
  update public.league_members set vice_user_id = null where id = p_member;
end $$;

grant execute on function public.rigenera_codice_vice(uuid) to authenticated;
grant execute on function public.entra_come_vice(text) to authenticated;
grant execute on function public.togli_vice(uuid) to authenticated;
