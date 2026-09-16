-- =====================================================================
-- 008 — Chiudere la giornata senza essere il Giudice Dati
--
-- Da eseguire DOPO schema.sql e le migrazioni 001-007. Si può rieseguire.
--
-- Finita la giornata e inseriti gli eventi, i punteggi sono già fatti: manca
-- solo dire che sono definitivi. Finora quel passo lo faceva il solo Giudice
-- Dati, e finché non lo faceva la lega restava in sospeso ad aspettare una
-- persona. Adesso lo può fare chiunque sia in una lega.
--
-- I permessi della tabella NON si toccano: matchday_status resta scrivibile
-- solo dal Giudice. Qui si aggiunge una funzione che fa una cosa sola —
-- chiudere — e porta il controllo dentro di sé. Così chiunque può chiudere,
-- ma nessun altro può riaprire, cambiare stato o scrivere righe a mano.
--
-- Il controllo che conta: non si chiude una giornata senza eventi. Il database
-- lo sa da solo, perché l'id della partita porta la giornata davanti
-- ("md2_m1"), quindi non deve fidarsi di quello che gli dice il telefono.
-- Quante partite abbia una giornata invece non lo sa: quello lo controlla
-- l'app, che ha il calendario, e tiene il tasto spento finché ne manca una.
-- =====================================================================

create or replace function public.chiudi_giornata(p_matchday int)
returns void
language plpgsql security definer set search_path = public as $$
declare
  con_eventi int;
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

  select count(distinct match_id) into con_eventi
    from public.match_events
   where substring(match_id from '^md([0-9]+)_m') = p_matchday::text;
  if con_eventi = 0 then
    raise exception 'La giornata % non ha ancora nessun evento: non c''è niente da chiudere', p_matchday;
  end if;

  insert into public.matchday_status (matchday, status, changed_by)
       values (p_matchday, 'frozen', public.current_user_id())
  on conflict (matchday) do update
    set status = 'frozen', changed_at = now(), changed_by = excluded.changed_by;
end $$;

revoke all on function public.chiudi_giornata(int) from public;
grant execute on function public.chiudi_giornata(int) to authenticated;
