-- =====================================================================
-- 020 — Quante formazioni si consegnano OGNI GIORNATA
--
-- Da eseguire dopo la 014. Si può rieseguire.
--
-- PERCHÉ. MONETIZZAZIONE.md §7 dice che il numero da guardare non sono gli
-- iscritti ma quanti consegnano la formazione ogni settimana, e che è quello
-- che convince uno sponsor a rinnovare. Ma la console mostrava
-- «Formazioni consegnate» come UN TOTALE CHE SALE E BASTA: dopo dieci
-- giornate dice 900 sia che stiano giocando in novanta ogni domenica, sia
-- che fossero trecento alla prima e trenta all'ultima. I due casi sono
-- l'opposto l'uno dell'altro, e il numero che li distingue è esattamente
-- quello che uno sponsor compra. Il totale non è sbagliato: è cieco.
--
-- COSA CONTA UNA GIORNATA. Solo le giornate col lock passato: finché la
-- finestra è aperta il numero cresce ancora e confrontarlo con quelle chiuse
-- direbbe un calo che non c'è.
--
-- IL DENOMINATORE. Le squadre che esistevano QUANDO quella giornata si è
-- chiusa, non quelle di oggi: altrimenti chi si è iscritto a dicembre
-- farebbe sembrare deserte le giornate di settembre, e la curva direbbe una
-- crescita al contrario.
--
-- NON SI REGISTRA NESSUNO. Due numeri per giornata, nessun nome: serve a
-- dire se l'app è viva, non chi gioca.
-- =====================================================================

create or replace function public.admin_consegne(p_quante int default 10)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not public.is_admin() then raise exception 'Serve essere amministratore dell''app'; end if;
  with chiuse as (
    select matchday, lock_at
      from public.matchday_locks
     where lock_at <= now()
     order by matchday desc
     limit greatest(1, least(coalesce(p_quante, 10), 30))
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'giornata', c.matchday,
           'consegne', (select count(*) from public.lineups l where l.matchday = c.matchday),
           'squadre',  (select count(*) from public.league_members m where m.created_at <= c.lock_at)
         ) order by c.matchday), '[]'::jsonb)
    into v
    from chiuse c;
  return v;
end $$;

-- Il riepilogo: le stesse voci di prima piu' la serie. La voce «formazioni»
-- resta, perche' il totale ha ancora senso come misura di quanto c'e'
-- dentro il database — ma adesso non e' piu' l'unica cosa che si vede.
create or replace function public.admin_riepilogo()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Serve essere amministratore dell''app'; end if;
  return jsonb_build_object(
    'utenti', (select count(*) from public.profiles),
    'giudici', (select count(*) from public.profiles where is_judge),
    'amministratori', (select count(*) from public.profiles where is_admin),
    'leghe', (select count(*) from public.leagues),
    'leghe_pubbliche', (select count(*) from public.leagues where pubblica),
    'squadre', (select count(*) from public.league_members),
    'rose_complete', (select count(*) from (
        select member_id from public.rosters where released_at is null
         group by member_id having count(*) >= 25) q),
    'formazioni', (select count(*) from public.lineups),
    'telefoni_push', (select count(*) from public.push_subscriptions where failed_at is null),
    'contestazioni_aperte', (select count(*) from public.contestazioni where status = 'open'),
    'giornate_congelate', (select count(*) from public.matchday_status where status = 'frozen'),
    'iscritti_7_giorni', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'consegne', public.admin_consegne(10)
  );
end $$;

revoke execute on function public.admin_consegne(int) from public, anon;
grant execute on function public.admin_consegne(int) to authenticated;
revoke execute on function public.admin_riepilogo() from public, anon;
grant execute on function public.admin_riepilogo() to authenticated;
