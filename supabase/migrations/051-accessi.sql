-- =====================================================================
-- 051 — Chi apre l'app: un giorno per persona, per sapere se la gente torna
--
-- Si può rieseguire.
--
-- PERCHÉ (Alex, 04/11: «dobbiamo trovare un modo per il quale la gente
-- continui a tornare sull'applicazione»). Fino a oggi si sapeva solo chi
-- rifaceva il login, e chi resta collegato non lo rifà mai: 16 login in una
-- settimana non dicevano quanti avevano aperto l'app. Senza questo numero non
-- si capisce se notifiche e gioco quotidiano funzionano.
--
-- SOLO IL GIORNO. Una riga per persona e per giorno in cui ha aperto l'app:
-- niente ora, niente schermate, niente telefono, niente indirizzo IP. Si
-- tiene al massimo 400 giorni e se ne va con l'account.
--
--  1. accessi: (persona, giorno). Nessuno la legge direttamente.
--  2. segna_accesso(): la chiama l'app all'apertura, al massimo una volta al
--     giorno per telefono; scrive solo per chi chiama e solo per oggi.
--  3. admin_accessi(): per l'admin, quanti hanno aperto l'app oggi, negli
--     ultimi 7 e 30 giorni, giorno per giorno, e quanti di quelli della
--     settimana prima sono tornati questa settimana.
--  4. cancellando il profilo (elimina_profilo) se ne vanno anche i suoi giorni.
-- =====================================================================

create table if not exists public.accessi (
  user_id text not null,
  giorno  date not null,
  primary key (user_id, giorno)
);
create index if not exists accessi_giorno on public.accessi (giorno);
alter table public.accessi enable row level security;
revoke all on table public.accessi from public, anon, authenticated;

create or replace function public.segna_accesso()
returns void
language plpgsql security definer set search_path = public as $$
declare
  chi text := public.current_user_id();
  oggi date := (now() at time zone 'Europe/Rome')::date;
begin
  if chi is null then return; end if;
  insert into public.accessi (user_id, giorno) values (chi, oggi)
  on conflict (user_id, giorno) do nothing;
  -- i propri giorni troppo vecchi se ne vanno da soli: la tabella non cresce
  -- per sempre e nessuno deve ricordarsi di pulirla
  delete from public.accessi where user_id = chi and giorno < oggi - 400;
end $$;
revoke all on function public.segna_accesso() from public, anon;
grant execute on function public.segna_accesso() to authenticated;

create or replace function public.admin_accessi(p_giorni int default 14)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  oggi date := (now() at time zone 'Europe/Rome')::date;
  n int := greatest(1, least(coalesce(p_giorni, 14), 90));
  ris jsonb;
begin
  if not public.is_admin() then
    raise exception 'solo admin' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'oggi',   (select count(*) from public.accessi where giorno = oggi),
    'sette',  (select count(distinct user_id) from public.accessi where giorno > oggi - 7),
    'trenta', (select count(distinct user_id) from public.accessi where giorno > oggi - 30),
    -- la settimana prima (8-14 giorni fa) e quanti di loro sono tornati negli
    -- ultimi 7: e' il numero che dice se la gente torna
    'prima',  (select count(distinct user_id) from public.accessi where giorno between oggi - 13 and oggi - 7),
    'tornati', (select count(distinct a.user_id) from public.accessi a
                 where a.giorno between oggi - 13 and oggi - 7
                   and exists (select 1 from public.accessi b where b.user_id = a.user_id and b.giorno > oggi - 7)),
    'dal',    (select min(giorno) from public.accessi),
    'giorni', coalesce((
      select jsonb_agg(jsonb_build_object('giorno', g.giorno, 'persone', g.persone) order by g.giorno desc)
        from (select d::date as giorno,
                     (select count(*) from public.accessi a where a.giorno = d::date) as persone
                from generate_series(oggi - n + 1, oggi, interval '1 day') d) g
    ), '[]'::jsonb)
  ) into ris;
  return ris;
end $$;
revoke all on function public.admin_accessi(int) from public, anon;
grant execute on function public.admin_accessi(int) to authenticated;

-- Il profilo cancellato si porta via i suoi giorni. elimina_profilo() (010,
-- 024) cancella la riga di profiles: basta guardare quella.
create or replace function public.accessi_via_col_profilo()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.accessi where user_id = old.id;
  return old;
end $$;
revoke all on function public.accessi_via_col_profilo() from public, anon, authenticated;
drop trigger if exists accessi_via_col_profilo on public.profiles;
create trigger accessi_via_col_profilo after delete on public.profiles
  for each row execute function public.accessi_via_col_profilo();

-- Controllo: la tabella c'e' (vuota: si comincia a contare da adesso).
select count(*) as giorni_salvati from public.accessi;
