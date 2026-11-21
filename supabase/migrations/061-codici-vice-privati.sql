-- =====================================================================
-- 061 — Il codice per l'allenatore in seconda lo vede solo il titolare
--
-- Si può rieseguire. Il codice stava in league_members.vice_code, e la
-- policy members_read fa leggere le righe della lega a tutti i membri:
-- chiunque nella lega leggeva il codice delle altre squadre e, con un
-- secondo account fuori dalla lega, entrava come vice della squadra di un
-- altro (con scrittura su formazione e rosa). Ora il codice sta in una
-- tabella sua, che legge solo chi possiede la squadra; entra_come_vice lo
-- cerca lì. La colonna vecchia resta, sempre vuota.
-- =====================================================================

create table if not exists public.codici_vice (
  member_id uuid primary key references public.league_members(id) on delete cascade,
  codice text not null unique,
  created_at timestamptz not null default now()
);
alter table public.codici_vice enable row level security;
drop policy if exists codici_vice_miei on public.codici_vice;
create policy codici_vice_miei on public.codici_vice for select to authenticated
  using (exists (select 1 from public.league_members m where m.id = member_id and m.user_id = public.current_user_id()));
revoke all on public.codici_vice from anon;
grant select on public.codici_vice to authenticated;

-- i codici già dati passano nella tabella nuova, e la colonna vecchia si svuota
insert into public.codici_vice (member_id, codice)
  select id, vice_code from public.league_members where vice_code is not null
on conflict (member_id) do update set codice = excluded.codice;
update public.league_members set vice_code = null where vice_code is not null;

create or replace function public.rigenera_codice_vice(p_member uuid) returns text
language plpgsql security definer set search_path = public as $$
declare codice text;
begin
  if not exists (select 1 from public.league_members where id = p_member and user_id = public.current_user_id()) then
    raise exception 'Solo chi possiede la squadra può invitare un allenatore in seconda';
  end if;
  codice := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 8));
  insert into public.codici_vice (member_id, codice) values (p_member, codice)
  on conflict (member_id) do update set codice = excluded.codice, created_at = now();
  return codice;
end $$;

create or replace function public.entra_come_vice(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare riga public.league_members;
begin
  select m.* into riga from public.codici_vice c join public.league_members m on m.id = c.member_id
   where c.codice = upper(trim(p_code));
  if riga.id is null then raise exception 'Invito non valido o già usato'; end if;
  if riga.user_id = public.current_user_id() then raise exception 'Questa squadra è già tua'; end if;
  if riga.vice_user_id is not null then raise exception 'Questa squadra ha già un allenatore in seconda'; end if;
  if exists (select 1 from public.league_members
             where league_id = riga.league_id and (user_id = public.current_user_id() or vice_user_id = public.current_user_id())) then
    raise exception 'Sei già in questa lega con una squadra tua';
  end if;
  -- il codice si consuma: il link vale una volta sola
  update public.league_members set vice_user_id = public.current_user_id() where id = riga.id;
  delete from public.codici_vice where member_id = riga.id;
  return riga.league_id;
end $$;
