-- Il lock delle formazioni veniva calcolato in due posti con due calendari.
--
-- Il server aveva una formula fissa:
--     '2026-09-05 15:00 Europe/Rome' + (n-1) * 7 giorni
-- mentre l'app usa il calendario vero della FSGC. Otto giorni di scarto su
-- tutte e 30 le giornate (giornata 1: 28 agosto contro 5 settembre; giornata
-- 30: 19 marzo contro 27 marzo). Due conseguenze, entrambe brutte:
--
--   1. la formazione restava scrivibile per otto giorni DOPO che la partita
--      era finita. L'app la bloccava, ma la protezione che conta e' questa, e
--      chi sa usare le API poteva rifare la formazione sapendo i risultati;
--   2. lineups_read non lasciava leggere le formazioni degli avversari fino a
--      otto giorni dopo la partita, quindi nella sfida l'avversario compariva
--      con l'undici d'ufficio invece del suo.
--
-- Qui il calendario diventa un dato, non una formula: una riga per giornata,
-- scritta dal Giudice Dati a partire dallo stesso calendario che usa l'app.

create table if not exists public.matchday_locks (
  matchday int primary key check (matchday between 1 and 30),
  lock_at timestamptz not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

alter table public.matchday_locks enable row level security;
drop policy if exists locks_read on public.matchday_locks;
create policy locks_read on public.matchday_locks for select to authenticated using (true);
drop policy if exists locks_write on public.matchday_locks;
create policy locks_write on public.matchday_locks for all to authenticated
  using (public.is_judge()) with check (public.is_judge());

-- Legge la riga. NULL quando la giornata non c'e' ancora: sono le policy a
-- decidere come interpretarlo, perche' la direzione prudente e' opposta nei
-- due casi (vedi sotto).
create or replace function public.matchday_lock_at(n int) returns timestamptz
language sql stable security definer set search_path = public as $$
  select lock_at from public.matchday_locks where matchday = n
$$;

-- Finche' la tabella e' vuota si sbaglia nella direzione che non fa danno:
--   scrittura -> lock a 'infinity', cioe' sempre aperta: nessuno resta chiuso
--                fuori dalla propria formazione per una tabella non compilata;
--   lettura   -> lock a 'infinity', cioe' mai: nessuno puo' sbirciare le
--                formazioni altrui prima del tempo.
-- Sono due coalesce diverse sulla stessa funzione, non una svista.
drop policy if exists lineups_read on public.lineups;
create policy lineups_read on public.lineups for select to authenticated
  using (
    public.is_league_member(league_id)
    and (
      member_id = public.my_member_id(league_id)
      or now() >= coalesce(public.matchday_lock_at(matchday), 'infinity'::timestamptz)
    )
  );

drop policy if exists lineups_write on public.lineups;
create policy lineups_write on public.lineups for all to authenticated
  using (
    member_id = public.my_member_id(league_id)
    and now() < coalesce(public.matchday_lock_at(matchday), 'infinity'::timestamptz)
  )
  with check (
    member_id = public.my_member_id(league_id)
    and now() < coalesce(public.matchday_lock_at(matchday), 'infinity'::timestamptz)
  );

-- Scrive tutte le giornate in un colpo. L'app la chiama col calendario che ha
-- gia' in mano, quindi le due date non possono piu' divergere: sono la stessa.
-- [{"matchday": 1, "lock_at": "2026-08-28T15:00:00+02:00"}, ...]
create or replace function public.sync_matchday_locks(p jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare scritte int;
begin
  if not public.is_judge() then
    raise exception 'solo il Giudice Dati puo aggiornare il calendario dei lock';
  end if;
  insert into public.matchday_locks (matchday, lock_at, updated_at, updated_by)
  select (e->>'matchday')::int, (e->>'lock_at')::timestamptz, now(), public.current_user_id()
    from jsonb_array_elements(p) e
   where (e->>'matchday')::int between 1 and 30
  on conflict (matchday) do update
    set lock_at = excluded.lock_at, updated_at = now(), updated_by = excluded.updated_by
    where public.matchday_locks.lock_at <> excluded.lock_at;
  get diagnostics scritte = row_count;
  return scritte;
end $$;

revoke all on function public.sync_matchday_locks(jsonb) from public;
grant execute on function public.sync_matchday_locks(jsonb) to authenticated;

do $$ begin
  begin
    alter publication supabase_realtime add table public.matchday_locks;
  -- duplicate_object: la tabella c'è già dentro. undefined_object: non è un
  -- progetto Supabase e quella publication non esiste — il realtime è un di
  -- più, non deve far fallire la migrazione.
  exception when duplicate_object then null;
            when undefined_object then null; end;
end $$;
