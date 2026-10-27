-- =====================================================================
-- 048 — «Chi è?», il giocatore del giorno: quanti ci giocano
--
-- Si può rieseguire.
--
-- PERCHÉ (Alex, 27/10: «in admin voglio tabella con scritto in quanti ci
-- giocano»). La partita si gioca tutta sul telefono (src/gioco.js); qui
-- arriva solo com'è andata: chi, che giorno, quanti tentativi, se ha
-- indovinato. Niente di quello che ha scritto.
--
--  1. gioco_partite: una riga per persona e per giorno. Nessuno la legge
--     direttamente, neanche la propria: serve solo ai conteggi.
--  2. salva_partita_gioco(): la scrive chi gioca, solo per sé e solo per
--     ieri, oggi o domani (i fusi e le mezzanotti dei telefoni), e i
--     tentativi possono solo crescere: una partita persa non si riapre.
--  3. admin_gioco_conteggi(): per l'admin, giorno per giorno quanti hanno
--     giocato, quanti hanno indovinato e in media in quanti tentativi.
-- =====================================================================

create table if not exists public.gioco_partite (
  user_id       text not null,
  giorno        date not null,
  tentativi     smallint not null check (tentativi between 0 and 6),
  vinto         boolean not null default false,
  aggiornato_at timestamptz not null default now(),
  primary key (user_id, giorno)
);
alter table public.gioco_partite enable row level security;
revoke all on table public.gioco_partite from public, anon, authenticated;

create or replace function public.salva_partita_gioco(p_giorno date, p_tentativi int, p_vinto boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  chi text := public.current_user_id();
  oggi date := (now() at time zone 'Europe/Rome')::date;
begin
  if chi is null or p_giorno is null or p_giorno not between oggi - 1 and oggi + 1
     or p_tentativi is null or p_tentativi not between 0 and 6 then
    return;
  end if;
  insert into public.gioco_partite (user_id, giorno, tentativi, vinto)
  values (chi, p_giorno, p_tentativi, coalesce(p_vinto, false))
  on conflict (user_id, giorno) do update
    set tentativi = greatest(gioco_partite.tentativi, excluded.tentativi),
        vinto = gioco_partite.vinto or excluded.vinto,
        aggiornato_at = now()
    where excluded.tentativi >= gioco_partite.tentativi;
end $$;
revoke all on function public.salva_partita_gioco(date, int, boolean) from public, anon;
grant execute on function public.salva_partita_gioco(date, int, boolean) to authenticated;

create or replace function public.admin_gioco_conteggi(p_giorni int default 14)
returns table (giorno date, giocatori int, vinti int, media_tentativi numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'solo admin' using errcode = '42501';
  end if;
  return query
    select g.giorno, count(*)::int, count(*) filter (where g.vinto)::int,
           round(avg(g.tentativi) filter (where g.vinto), 1)
      from public.gioco_partite g
     where g.giorno >= (now() at time zone 'Europe/Rome')::date - greatest(1, least(coalesce(p_giorni, 14), 90)) + 1
     group by g.giorno
     order by g.giorno desc;
end $$;
revoke all on function public.admin_gioco_conteggi(int) from public, anon;
grant execute on function public.admin_gioco_conteggi(int) to authenticated;

select (select count(*) from public.gioco_partite) as partite_salvate;
