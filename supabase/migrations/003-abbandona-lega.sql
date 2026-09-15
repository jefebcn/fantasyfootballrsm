-- =====================================================================
-- 003 — Uscire da una lega
--
-- La policy members_delete permette solo all'admin di togliere GLI ALTRI
-- (user_id <> auth.uid()): nessuno poteva quindi uscire da solo da una lega in
-- cui era entrato. Chi ha creato la lega la elimina (migrazione 002); chi si e'
-- unito con un codice, fino a ora, restava dentro per sempre.
--
-- Da eseguire nell'SQL Editor. Rieseguibile senza danni.
-- =====================================================================

create or replace function public.abbandona_lega(p_league uuid) returns void
language plpgsql security definer set search_path = public as $$
declare mio uuid; altri_admin int;
begin
  select id into mio from public.league_members
  where league_id = p_league and user_id = public.current_user_id();
  if mio is null then raise exception 'Non fai parte di questa lega'; end if;

  -- Una lega senza amministratori non la puo' piu' gestire nessuno: l'ultimo
  -- admin deve prima passare il ruolo, oppure eliminare la lega.
  select count(*) into altri_admin from public.league_members
  where league_id = p_league and role = 'admin' and user_id <> public.current_user_id();
  if altri_admin = 0
     and exists (select 1 from public.league_members
                 where id = mio and role = 'admin')
     and (select count(*) from public.league_members where league_id = p_league) > 1
  then
    raise exception 'Sei l''unico admin: passa il ruolo a qualcun altro prima di uscire';
  end if;

  -- Rosa e formazioni se ne vanno con la riga (on delete cascade).
  delete from public.league_members where id = mio;
end $$;

grant execute on function public.abbandona_lega(uuid) to authenticated;
