-- =====================================================================
-- 049 — «Chi è?»: classifica del mese e serie
--
-- Si può rieseguire.
--
-- PERCHÉ (Alex, 27/10: «bisogna spiegargli che cosa si vince tenendo la
-- serie o anche una classifica, per fargli capire perché continuare a
-- giocare oltre al divertimento»). Due cose che il telefono da solo non sa:
--
--  1. classifica_gioco(): i punti del mese. Un giocatore indovinato vale
--     7 meno i tentativi (6 al primo, 1 al sesto), uno sbagliato 0. Prima
--     chi ha piu' punti, a pari punti chi ne ha indovinati di piu'. Con una
--     lega, solo chi e' in quella lega e col nome della squadra; senza, tutti
--     col nome del profilo. I primi 20 e la propria riga. Il primo del mese
--     prima e' il «Re del Titano»: lo si chiede col mese passato.
--  2. mio_gioco(): la serie di oggi (giorni di fila indovinati), la piu'
--     lunga di sempre, quante vinte e giocate. Dal database e non dal
--     telefono, cosi' cambiare telefono non azzera le medaglie.
--
-- Nessuna delle due mostra i nomi scritti nei tentativi: solo i conti.
-- =====================================================================

create or replace function public.classifica_gioco(p_mese date default null, p_lega uuid default null)
returns table (posizione int, nome text, punti int, vinte int, giocate int, io boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  chi text := public.current_user_id();
  inizio date := date_trunc('month', coalesce(p_mese, (now() at time zone 'Europe/Rome')::date))::date;
  fine date := (date_trunc('month', coalesce(p_mese, (now() at time zone 'Europe/Rome')::date)) + interval '1 month')::date;
begin
  if chi is null then
    return;
  end if;
  if p_lega is not null and not exists (select 1 from public.league_members m where m.league_id = p_lega and m.user_id = chi) then
    return;                                     -- la classifica di una lega la vede solo chi c'e'
  end if;
  return query
    with t as (
      select g.user_id,
             sum(case when g.vinto then 7 - g.tentativi else 0 end)::int as pt,
             (count(*) filter (where g.vinto))::int as vi,
             count(*)::int as gi
        from public.gioco_partite g
        join public.profiles p on p.id = g.user_id and not coalesce(p.sospeso, false)
       where g.giorno >= inizio and g.giorno < fine
         and (p_lega is null or exists (select 1 from public.league_members m where m.league_id = p_lega and m.user_id = g.user_id))
       group by g.user_id
    ), r as (
      select t.*, (rank() over (order by t.pt desc, t.vi desc))::int as pos from t
    )
    select r.pos,
           left(coalesce(
             case when p_lega is not null then (select nullif(btrim(m.team_name), '') from public.league_members m where m.league_id = p_lega and m.user_id = r.user_id limit 1) end,
             nullif(btrim(p.display_name), ''), 'Giocatore'), 40),
           r.pt, r.vi, r.gi, r.user_id = chi
      from r join public.profiles p on p.id = r.user_id
     where r.pos <= 20 or r.user_id = chi
     order by r.pos, r.pt desc;
end $$;
revoke all on function public.classifica_gioco(date, uuid) from public, anon;
grant execute on function public.classifica_gioco(date, uuid) to authenticated;

create or replace function public.mio_gioco()
returns table (serie int, serie_max int, vinte int, giocate int)
language plpgsql stable security definer set search_path = public as $$
declare
  chi text := public.current_user_id();
  oggi date := (now() at time zone 'Europe/Rome')::date;
begin
  if chi is null then
    return;
  end if;
  return query
    with v as (
      select g.giorno from public.gioco_partite g where g.user_id = chi and g.vinto
    ), isole as (
      select v.giorno, v.giorno - (row_number() over (order by v.giorno))::int as gruppo from v
    ), gr as (
      select count(*)::int as n, max(isole.giorno) as ultimo from isole group by isole.gruppo
    )
    select
      case when exists (select 1 from public.gioco_partite g where g.user_id = chi and g.giorno = oggi and not g.vinto and g.tentativi >= 6)
           then 0
           else coalesce((select gr.n from gr where gr.ultimo >= oggi - 1 order by gr.ultimo desc limit 1), 0) end,
      coalesce((select max(gr.n) from gr), 0),
      (select count(*)::int from public.gioco_partite g where g.user_id = chi and g.vinto),
      (select count(*)::int from public.gioco_partite g where g.user_id = chi);
end $$;
revoke all on function public.mio_gioco() from public, anon;
grant execute on function public.mio_gioco() to authenticated;
