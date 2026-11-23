-- 068 · Formazioni e rose si leggono senza andare in timeout.
--
-- La console segnalava «canceling statement due to statement timeout» al
-- caricamento della lega (domenica sera 22/11, listone, negozio, squadra,
-- gioco): era la lettura delle formazioni della lega pubblica, ~1900 righe in
-- due pagine da 1000.
--
-- Perche' era lenta: le regole chiamavano is_league_member(), my_member_id()
-- e matchday_lock_at() PER OGNI RIGA (sono funzioni con la colonna come
-- argomento, Postgres non le puo' calcolare una volta sola), e la regola di
-- scrittura era «per tutto» (FOR ALL), quindi valeva anche in lettura e
-- raddoppiava i conti. Misurato: 930 ms a pagina da fermi; con la gente che
-- apre l'app dopo le partite si arrivava agli 8 secondi di authenticated.
--
-- Ora le stesse condizioni si scrivono come «sta nell'elenco»: le mie leghe,
-- le mie squadre, le giornate chiuse. Ogni elenco si calcola UNA volta per
-- richiesta (subplan hashed). La scrittura si divide in insert/update/delete
-- e non tocca piu' la lettura. Le regole dicono le stesse cose di prima.

-- Le leghe in cui sono titolare o vice (come is_league_member).
create or replace function public.mie_leghe() returns setof uuid
language sql stable security definer set search_path = public as $$
  select league_id from public.league_members
  where user_id = public.current_user_id() or vice_user_id = public.current_user_id()
$$;

-- Per ogni lega, la squadra che e' «mia» (come my_member_id: la mia prima
-- di quella di cui sono vice).
create or replace function public.mie_squadre() returns setof uuid
language sql stable security definer set search_path = public as $$
  select distinct on (league_id) id from public.league_members
  where user_id = public.current_user_id() or vice_user_id = public.current_user_id()
  order by league_id, (user_id = public.current_user_id()) desc
$$;

-- Le giornate gia' chiuse (come now() >= coalesce(matchday_lock_at(n), infinity):
-- senza lock la giornata non e' chiusa).
create or replace function public.giornate_chiuse() returns setof integer
language sql stable security definer set search_path = public as $$
  select matchday from public.matchday_locks where lock_at <= now()
$$;

revoke all on function public.mie_leghe(), public.mie_squadre(), public.giornate_chiuse() from public, anon;
grant execute on function public.mie_leghe(), public.mie_squadre(), public.giornate_chiuse() to authenticated;

-- ---------------------------------------------------------------- formazioni
drop policy if exists lineups_read on public.lineups;
create policy lineups_read on public.lineups for select to authenticated using (
  league_id in (select public.mie_leghe())
  and (member_id in (select public.mie_squadre()) or matchday in (select public.giornate_chiuse()))
);

drop policy if exists lineups_write on public.lineups;
create policy lineups_insert on public.lineups for insert to authenticated with check (
  member_id = public.my_member_id(league_id)
  and now() < coalesce(public.matchday_lock_at(matchday), 'infinity'::timestamptz)
  and not public.sono_sospeso()
);
create policy lineups_update on public.lineups for update to authenticated using (
  member_id = public.my_member_id(league_id)
  and now() < coalesce(public.matchday_lock_at(matchday), 'infinity'::timestamptz)
  and not public.sono_sospeso()
) with check (
  member_id = public.my_member_id(league_id)
  and now() < coalesce(public.matchday_lock_at(matchday), 'infinity'::timestamptz)
  and not public.sono_sospeso()
);
create policy lineups_delete on public.lineups for delete to authenticated using (
  member_id = public.my_member_id(league_id)
  and now() < coalesce(public.matchday_lock_at(matchday), 'infinity'::timestamptz)
  and not public.sono_sospeso()
);

-- ---------------------------------------------------------------------- rose
drop policy if exists rosters_read on public.rosters;
create policy rosters_read on public.rosters for select to authenticated using (
  league_id in (select public.mie_leghe())
);

drop policy if exists rosters_write on public.rosters;
create policy rosters_insert on public.rosters for insert to authenticated with check (public.is_league_admin(league_id));
create policy rosters_update on public.rosters for update to authenticated using (public.is_league_admin(league_id)) with check (public.is_league_admin(league_id));
create policy rosters_delete on public.rosters for delete to authenticated using (public.is_league_admin(league_id));
