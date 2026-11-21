-- =====================================================================
-- 064 — La bacheca della lega (21/11/2026)
--
-- Si può rieseguire. Una bacheca per scriversi fra i partecipanti di una
-- lega: messaggi corti (al massimo 280 caratteri), li leggono solo i membri
-- della lega, li scrive ognuno a nome della propria squadra, li cancella chi
-- li ha scritti o un admin della lega. Uno ogni 10 secondi per squadra, per
-- non riempirla di colpo. Il testo l'app lo mostra sempre protetto (esc).
-- =====================================================================

create table if not exists public.lega_messaggi (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  member_id uuid not null references public.league_members(id) on delete cascade,
  testo text not null check (length(trim(testo)) between 1 and 280),
  created_at timestamptz not null default now()
);
create index if not exists lega_messaggi_lega on public.lega_messaggi (league_id, created_at desc);
create index if not exists lega_messaggi_membro on public.lega_messaggi (member_id);
alter table public.lega_messaggi enable row level security;

drop policy if exists lega_messaggi_leggi on public.lega_messaggi;
create policy lega_messaggi_leggi on public.lega_messaggi for select to authenticated
  using (public.is_league_member(league_id));
drop policy if exists lega_messaggi_scrivi on public.lega_messaggi;
create policy lega_messaggi_scrivi on public.lega_messaggi for insert to authenticated
  with check (member_id = public.my_member_id(league_id));
drop policy if exists lega_messaggi_cancella on public.lega_messaggi;
create policy lega_messaggi_cancella on public.lega_messaggi for delete to authenticated
  using (member_id = public.my_member_id(league_id) or public.is_league_admin(league_id));

revoke all on public.lega_messaggi from anon;
grant select, insert, delete on public.lega_messaggi to authenticated;

-- data e ritmo li decide il database, non il telefono
create or replace function public.lega_messaggi_regole() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.created_at := now();
  new.testo := trim(new.testo);
  if exists (select 1 from public.lega_messaggi m where m.member_id = new.member_id and m.created_at > now() - interval '10 seconds') then
    raise exception 'Un messaggio alla volta: riprova fra qualche secondo' using errcode = '22023';
  end if;
  return new;
end $$;
revoke execute on function public.lega_messaggi_regole() from public, anon;
drop trigger if exists lega_messaggi_regole on public.lega_messaggi;
create trigger lega_messaggi_regole before insert on public.lega_messaggi
  for each row execute function public.lega_messaggi_regole();
