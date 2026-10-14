-- =====================================================================
-- 039 — Lega pubblica: il mercato di riparazione
--
-- Da eseguire DOPO la 038. Si può rieseguire.
--
-- LA REGOLA (Alex, 14/10). Come negli altri fantacalcio, nella pausa
-- invernale si riapre il mercato: per qualche giorno tutti, nella lega
-- pubblica, possono togliere e comprare giocatori. Fuori da quella
-- finestra la rosa resta quella (019, 037, 038).
--
-- PERCHE' UNA TABELLA E NON DELLE DATE NEL CODICE. Il calendario della
-- FSGC dopo la 6ª giornata non è ancora uscito: la pausa la si conosce
-- solo più avanti. Le date le scrive il proprietario, quando le sa:
--
--   insert into public.finestre_mercato (nome, inizio, fine) values
--     ('Mercato di riparazione', '2026-12-21 09:00+01', '2027-01-08 15:00+01');
--
-- Durante la finestra valgono le solite regole: quote per ruolo, riserva
-- crediti, chi toglie un giocatore riprende quello che l'aveva pagato.
-- =====================================================================

create table if not exists public.finestre_mercato (
  id     bigserial primary key,
  nome   text not null default 'Mercato di riparazione',
  inizio timestamptz not null,
  fine   timestamptz not null,
  check (fine > inizio)
);
alter table public.finestre_mercato enable row level security;
revoke all on table public.finestre_mercato from public, anon;
grant select on table public.finestre_mercato to authenticated;
drop policy if exists finestre_leggibili on public.finestre_mercato;
create policy finestre_leggibili on public.finestre_mercato for select to authenticated using (true);
-- Scrive solo il proprietario dell'app (033), anche dall'app se un giorno servirà.
drop policy if exists finestre_proprietario on public.finestre_mercato;
create policy finestre_proprietario on public.finestre_mercato for all to authenticated
  using (public.is_owner()) with check (public.is_owner());
grant insert, update, delete on table public.finestre_mercato to authenticated;
grant usage, select on sequence public.finestre_mercato_id_seq to authenticated;


-- Il mercato della lega pubblica: la finestra della tua prima giornata (019)
-- OPPURE una finestra di riparazione aperta adesso.
create or replace function public.mercato_aperto(p_league uuid)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare io text; entrato timestamptz; prima int; chiude timestamptz; pubblica boolean;
begin
  io := public.current_user_id();
  if io is null then return false; end if;
  select l.pubblica into pubblica from public.leagues l where l.id = p_league;
  if not coalesce(pubblica, false) then return false; end if;
  select m.created_at into entrato from public.league_members m
   where m.league_id = p_league and m.user_id = io;
  if entrato is null then return false; end if;
  if exists (select 1 from public.finestre_mercato f where now() between f.inizio and f.fine) then
    return true;
  end if;
  select min(k.matchday) into prima from public.matchday_locks k where k.lock_at > entrato;
  if prima is null then return false; end if;
  select k.lock_at into chiude from public.matchday_locks k where k.matchday = prima;
  return chiude > now();
end $$;

revoke execute on function public.mercato_aperto(uuid) from public, anon;
grant execute on function public.mercato_aperto(uuid) to authenticated;

-- Controllo: le finestre scritte (all'inizio nessuna).
select id, nome, inizio, fine, now() between inizio and fine as aperta_adesso
  from public.finestre_mercato order by inizio;
