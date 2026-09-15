-- =====================================================================
-- 007 — Mercato degli svincolati, con rilancio a 24 ore (art. 3.4)
--
-- Da eseguire DOPO schema.sql e le migrazioni 001-006. Si può rieseguire.
--
-- Chi non è stato assegnato all'asta resta prendibile, e chi esce dal
-- campionato libera un posto (art. 3.3, con rimborso del 50%). La pagina
-- Mercato lo prometteva da sempre — «le offerte arrivano con la Fase 2» —
-- senza che si potesse fare niente.
--
-- Come funziona: la prima offerta su un giocatore apre una finestra di 24 ore.
-- Dentro la finestra gli altri possono rilanciare, e la finestra NON si
-- allunga: alla scadenza vince l'offerta più alta. A parità vince la prima
-- arrivata, perché chi ha rischiato per primo non deve perdere per un pari.
--
-- Chi chiude la finestra? Nessuno ha un server che gira di notte, quindi si
-- chiude da sé: `risolvi_offerte` assegna tutto quello che è scaduto, ed è
-- chiamata da qualunque partecipante apra l'app. È idempotente, e due
-- chiamate in parallelo non assegnano due volte (la riga si blocca).
--
-- Cosa controlla il database e cosa no. Qui si controllano le cose che
-- riguardano gli altri: che due persone non vincano lo stesso giocatore, che
-- i crediti bastino, che la rosa non passi i 25. I limiti di reparto
-- (3-8-8-6) restano dove stanno già per l'asta, cioè nell'app: il database
-- non conosce i ruoli, che stanno nel listone, e sforare il proprio reparto
-- danneggia solo se stessi ed è visibile subito.
-- =====================================================================

create table if not exists public.offerte (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  member_id uuid not null references public.league_members(id) on delete cascade,
  player_id text not null,
  crediti int not null check (crediti >= 1),
  stato text not null default 'aperta' check (stato in ('aperta', 'vinta', 'persa', 'ritirata')),
  creata_at timestamptz not null default now(),
  scade_at timestamptz not null,
  chiusa_at timestamptz
);
create index if not exists offerte_aperte on public.offerte (league_id, player_id, stato);
create index if not exists offerte_scadenza on public.offerte (stato, scade_at);
-- Una sola offerta aperta per persona su un dato giocatore: un rilancio
-- sostituisce la propria, non se ne accumulano.
create unique index if not exists offerte_una_per_persona
  on public.offerte (league_id, player_id, member_id) where stato = 'aperta';

alter table public.offerte enable row level security;

-- Le offerte si vedono in lega: un'asta al buio fra amici finirebbe a
-- discussioni, e sapere a quanto sta il rilancio è metà del gioco.
drop policy if exists offerte_read on public.offerte;
create policy offerte_read on public.offerte for select to authenticated
  using (public.is_league_member(league_id));
-- Si scrive solo dalle funzioni.

/** Chi è libero: nessuno in lega lo ha in rosa. */
create or replace function public.e_svincolato(p_league uuid, p_player text)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from public.rosters
     where league_id = p_league and player_id = p_player and released_at is null)
$$;

-- ---------------------------------------------------------------- offri
create or replace function public.offri(p_league uuid, p_player text, p_crediti int)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  mio uuid; miei_crediti int; in_rosa int; migliore int; finestra timestamptz; nuovo uuid;
begin
  mio := public.my_member_id(p_league);
  if mio is null then raise exception 'Non fai parte di questa lega'; end if;
  if p_crediti < 1 then raise exception 'L''offerta è almeno 1 credito'; end if;
  if not public.e_svincolato(p_league, p_player) then
    raise exception 'Questo giocatore è già in una rosa';
  end if;

  select credits into miei_crediti from public.league_members where id = mio;
  -- Gli impegni già presi contano: chi ha tre offerte aperte non può
  -- promettere gli stessi crediti tre volte.
  if miei_crediti < p_crediti + coalesce((
       select sum(crediti) from public.offerte
        where league_id = p_league and member_id = mio and stato = 'aperta' and player_id <> p_player), 0) then
    raise exception 'Non ti bastano i crediti: ne hai %, contando le offerte già aperte', miei_crediti;
  end if;

  select count(*) into in_rosa from public.rosters
   where league_id = p_league and member_id = mio and released_at is null;
  if in_rosa >= 25 then raise exception 'La tua rosa è già di 25 giocatori'; end if;

  select max(crediti), min(scade_at) into migliore, finestra
    from public.offerte
   where league_id = p_league and player_id = p_player and stato = 'aperta';

  if migliore is not null and p_crediti <= migliore then
    raise exception 'Devi superare l''offerta più alta, che è di % crediti', migliore;
  end if;

  -- la propria offerta precedente viene sostituita, non aggiunta
  update public.offerte set stato = 'ritirata', chiusa_at = now()
   where league_id = p_league and player_id = p_player and member_id = mio and stato = 'aperta';

  insert into public.offerte (league_id, member_id, player_id, crediti, scade_at)
  values (p_league, mio, p_player, p_crediti,
          -- la finestra la apre la prima offerta e non si allunga coi rilanci
          coalesce(finestra, now() + interval '24 hours'))
  returning id into nuovo;
  return nuovo;
end $$;

create or replace function public.ritira_offerta(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare o record; mio uuid;
begin
  select * into o from public.offerte where id = p_id for update;
  if o is null then raise exception 'Offerta non trovata'; end if;
  if o.stato <> 'aperta' then raise exception 'Questa offerta è già %', o.stato; end if;
  mio := public.my_member_id(o.league_id);
  if mio is null or mio <> o.member_id then raise exception 'Non è la tua offerta'; end if;
  update public.offerte set stato = 'ritirata', chiusa_at = now() where id = p_id;
end $$;

-- ---------------------------------------------------------------- risolvi
/**
 * Assegna tutto quello che è scaduto. La chiama qualunque partecipante
 * aprendo l'app: non serve nessun processo che gira di notte.
 * @returns quanti giocatori sono stati assegnati
 */
create or replace function public.risolvi_offerte(p_league uuid)
returns int language plpgsql security definer set search_path = public as $$
declare g record; v record; n int := 0;
begin
  if public.my_member_id(p_league) is null then
    raise exception 'Non fai parte di questa lega';
  end if;

  for g in
    select distinct player_id from public.offerte
     where league_id = p_league and stato = 'aperta' and scade_at <= now()
  loop
    -- Si blocca l'insieme delle offerte su questo giocatore: due persone che
    -- aprono l'app nello stesso istante non lo assegnano due volte.
    perform 1 from public.offerte
      where league_id = p_league and player_id = g.player_id and stato = 'aperta'
      for update;

    -- Nel frattempo potrebbe averlo preso qualcun altro (uno scambio, l'asta):
    -- in quel caso le offerte si chiudono tutte perse, senza assegnare niente.
    if not public.e_svincolato(p_league, g.player_id) then
      update public.offerte set stato = 'persa', chiusa_at = now()
       where league_id = p_league and player_id = g.player_id and stato = 'aperta';
      continue;
    end if;

    -- la più alta; a parità la prima arrivata
    select o.* into v from public.offerte o
     where o.league_id = p_league and o.player_id = g.player_id and o.stato = 'aperta'
     order by o.crediti desc, o.creata_at asc limit 1;

    -- i crediti possono essere cambiati da quando ha offerto: se non bastano
    -- piu', passa al prossimo invece di mandare la rosa in negativo
    if (select credits from public.league_members where id = v.member_id) < v.crediti then
      update public.offerte set stato = 'persa', chiusa_at = now() where id = v.id;
      continue;   -- il giro dopo guarda la seconda offerta più alta
    end if;
    if (select count(*) from public.rosters
         where league_id = p_league and member_id = v.member_id and released_at is null) >= 25 then
      update public.offerte set stato = 'persa', chiusa_at = now() where id = v.id;
      continue;
    end if;

    insert into public.rosters (league_id, member_id, player_id, price_paid)
    values (p_league, v.member_id, v.player_id, v.crediti);
    update public.league_members set credits = credits - v.crediti where id = v.member_id;
    update public.offerte set stato = 'vinta', chiusa_at = now() where id = v.id;
    update public.offerte set stato = 'persa', chiusa_at = now()
     where league_id = p_league and player_id = g.player_id and stato = 'aperta';
    n := n + 1;
  end loop;
  return n;
end $$;

grant execute on function public.offri(uuid, text, int) to authenticated;
grant execute on function public.ritira_offerta(uuid) to authenticated;
grant execute on function public.risolvi_offerte(uuid) to authenticated;
grant execute on function public.e_svincolato(uuid, text) to authenticated;

do $$ begin
  begin
    alter publication supabase_realtime add table public.offerte;
  exception when duplicate_object then null;
            when undefined_object then null; end;
end $$;
