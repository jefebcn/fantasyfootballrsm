-- =====================================================================
-- 035 — Una giornata si chiude dal martedì alle 20:00
--
-- Da eseguire DOPO la 034. Si può rieseguire.
--
-- Il 13/10 si è visto che la 5ª era stata chiusa domenica 11/10 alle
-- 20:18, tre ore dopo l'ultima partita, e la 4ª il lunedì mattina. La FSGC
-- completa i referti dopo il fischio — cambi, cartellini, giocatori nuovi —
-- e una giornata chiusa non si aggiorna più: in lega era rimasta la versione
-- a metà. Adesso chiudere si può dal martedì alle 20:00 (ora di San Marino)
-- dopo il calcio d'inizio della giornata, quando il referto è completo.
-- Solo il proprietario dell'app (033) può chiudere prima, per i casi
-- eccezionali.
-- =====================================================================

-- Il martedì alle 20:00 dopo la chiusura delle formazioni della giornata.
-- Senza un lock in tabella non si sa quando: nessun limite (null).
create or replace function public.chiusura_giornata(n int) returns timestamptz
language sql stable security definer set search_path = public as $$
  select case when l is null then null else
    (date_trunc('day', l) + make_interval(days => ((9 - extract(isodow from l)::int) % 7))
       + case when ((9 - extract(isodow from l)::int) % 7) = 0 and extract(hour from l) >= 20
              then interval '7 days' else interval '0' end
       + interval '20 hours') at time zone 'Europe/Rome'
  end
  from (select public.matchday_lock_at(n) at time zone 'Europe/Rome' as l) x
$$;
revoke all on function public.chiusura_giornata(int) from public, anon;
grant execute on function public.chiusura_giornata(int) to authenticated;

create or replace function public.chiudi_giornata(p_matchday int)
returns void
language plpgsql security definer set search_path = public as $$
declare
  con_eventi int; con_presenze int; da timestamptz := public.chiusura_giornata(p_matchday);
begin
  if public.current_user_id() is null then
    raise exception 'Serve un account per chiudere la giornata';
  end if;
  if not exists (select 1 from public.league_members where user_id = public.current_user_id()) then
    raise exception 'Solo chi è in una lega può chiudere la giornata';
  end if;
  if exists (select 1 from public.matchday_status
              where matchday = p_matchday and status = 'frozen') then
    raise exception 'La giornata % è già chiusa', p_matchday;
  end if;
  if da is not null and now() < da and not public.is_owner() then
    raise exception 'La giornata % si calcola da %: prima la FSGC completa i referti',
      p_matchday, to_char(da at time zone 'Europe/Rome', 'DD/MM "alle" HH24:MI');
  end if;

  select count(distinct match_id) into con_eventi
    from public.match_events
   where substring(match_id from '^md([0-9]+)_m') = p_matchday::text;
  if con_eventi = 0 then
    raise exception 'La giornata % non ha ancora nessun evento: non c''è niente da chiudere', p_matchday;
  end if;
  if not (public.is_judge() or public.is_admin()) then
    select count(distinct match_id) into con_presenze
      from public.match_appearances
     where substring(match_id from '^md([0-9]+)_m') = p_matchday::text;
    if con_presenze < 8 then
      raise exception 'La giornata % non è ancora completa (% partite su 8): la chiude il Giudice', p_matchday, con_presenze;
    end if;
  end if;

  insert into public.matchday_status (matchday, status, changed_by)
       values (p_matchday, 'frozen', public.current_user_id())
  on conflict (matchday) do update
    set status = 'frozen', changed_at = now(), changed_by = excluded.changed_by;
end $$;
revoke execute on function public.chiudi_giornata(int) from public, anon;
grant execute on function public.chiudi_giornata(int) to authenticated;

-- Anche dalla pagina del Giudice (che scrive matchday_status direttamente):
-- stessa regola, stessa eccezione per il proprietario. Le funzioni del
-- database e l'SQL Editor non passano da qui.
create or replace function public.chiusura_non_prima() returns trigger
language plpgsql as $$
declare da timestamptz;
begin
  if current_user in ('anon', 'authenticated') and new.status = 'frozen' and not public.is_owner() then
    da := public.chiusura_giornata(new.matchday);
    if da is not null and now() < da then
      raise exception 'La giornata % si calcola da %: prima la FSGC completa i referti',
        new.matchday, to_char(da at time zone 'Europe/Rome', 'DD/MM "alle" HH24:MI');
    end if;
  end if;
  return new;
end $$;
drop trigger if exists chiusura_non_prima on public.matchday_status;
create trigger chiusura_non_prima before insert or update on public.matchday_status
  for each row execute function public.chiusura_non_prima();
