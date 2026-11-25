-- =====================================================================
-- 070 · Traguardo inviti: quanti amici portati giocano davvero
--
-- Alex, 25/11 (docs/CRESCITA.md): il traguardo inviti si raggiunge con
-- «3 amici che consegnano almeno 2 formazioni». I Reclutatori (023) contano
-- l'amico quando entra in una lega; qui si conta solo chi poi gioca.
--
-- Un amico e' ATTIVO quando ha confermato lui stesso la formazione in almeno
-- 2 giornate diverse. Le copie che la lega pubblica scrive da sola nelle
-- giornate dopo (050, formazione_in_avanti) hanno lo stesso submitted_at
-- dell'originale: raggruppando per submitted_at e prendendo la giornata piu'
-- bassa, ogni conferma vale una giornata sola. Due leghe confermate nella
-- stessa giornata restano una giornata. Cosi' un account finto non basta:
-- bisogna rientrare dopo il lock e confermare di nuovo.
--
-- Nessuna tabella nuova e nessuna regola RLS: tre funzioni.
-- =====================================================================

-- Le giornate in cui un utente ha confermato la formazione (in qualsiasi lega).
-- Non e' esposta: la usano le due funzioni qui sotto.
create or replace function public.giornate_confermate(p_utente text) returns integer
language sql stable security definer set search_path = public as $$
  select count(distinct g)::integer from (
    select min(li.matchday) as g
      from public.lineups li
      join public.league_members lm on lm.id = li.member_id
     where lm.user_id = p_utente and li.submitted_at is not null
     group by li.submitted_at
  ) x
$$;
revoke all on function public.giornate_confermate(text) from public, anon, authenticated;

-- Il proprio traguardo: amici portati (dal link, 023) e quanti sono attivi.
create or replace function public.traguardo_inviti() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'amici', count(*),
    'attivi', count(*) filter (where public.giornate_confermate(p.id) >= 2),
    'soglia', 3,
    'giornate', 2)
    from public.profiles p
   where p.invitato_da = (select public.current_user_id())
$$;
revoke all on function public.traguardo_inviti() from public, anon;
grant execute on function public.traguardo_inviti() to authenticated;

-- Per la console: chi ha portato almeno un amico attivo, dal piu' avanti.
-- Serve a sapere chi ha raggiunto il traguardo e a chi consegnare il premio.
create or replace function public.traguardo_inviti_elenco()
returns table (utente text, nome text, amici integer, attivi integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Solo per l''amministratore'; end if;
  return query
    select r.id, r.display_name, count(*)::integer,
           (count(*) filter (where public.giornate_confermate(p.id) >= 2))::integer
      from public.profiles p
      join public.profiles r on r.id = p.invitato_da
     group by r.id, r.display_name
     order by 4 desc, 3 desc, 2;
end $$;
revoke all on function public.traguardo_inviti_elenco() from public, anon;
grant execute on function public.traguardo_inviti_elenco() to authenticated;
