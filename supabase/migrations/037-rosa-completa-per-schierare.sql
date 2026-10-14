-- =====================================================================
-- 037 — Lega pubblica: la formazione si consegna con la rosa completa
--
-- Da eseguire DOPO la 019 (negozio) e la 028 (formazioni valide).
-- Si può rieseguire.
--
-- LA REGOLA (Alex, 14/10). Nella lega pubblica la formazione si salva solo
-- con la rosa intera: 25 giocatori (o la somma delle quote della lega, se
-- ne ha di sue). Prima bastavano 11 titolari, e c'era chi giocava tutta la
-- stagione con mezza rosa.
--
-- IL BUCO CHE APRIVA. Il negozio chiude alla prima giornata dopo l'ingresso
-- (019, mercato_aperto). Chi era rimasto a metà, da quel momento, non poteva
-- più comprare: con la regola nuova non avrebbe più potuto schierare niente,
-- per sempre. Allora chi ha la rosa incompleta può sempre COMPRARE, solo
-- fino a completarla. VENDERE no: resta legato alla finestra della 019, se
-- no con 24 giocatori si avrebbe un mercato aperto tutto l'anno (vendi il
-- peggiore, compra il capocannoniere).
-- =====================================================================

-- Quanti giocatori servono in questa lega: la somma delle quote per ruolo
-- (quelle della lega sopra le 3/8/8/6 di DEFAULT_RULES.roster, come nell'app).
create or replace function public.rosa_richiesta(p_league uuid)
returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select sum(v::int)::int
                     from public.leagues l, jsonb_each_text('{"P":3,"D":8,"C":8,"A":6}'::jsonb || coalesce(l.rules -> 'roster', '{}'::jsonb)) as e(k, v)
                    where l.id = p_league), 25)
$$;

-- Quanti giocatori ha in rosa un iscritto (ceduti esclusi).
create or replace function public.rosa_attuale(p_member uuid)
returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.rosters r where r.member_id = p_member and r.released_at is null
$$;

revoke execute on function public.rosa_richiesta(uuid) from public, anon;
revoke execute on function public.rosa_attuale(uuid) from public, anon;
grant execute on function public.rosa_richiesta(uuid) to authenticated;
grant execute on function public.rosa_attuale(uuid) to authenticated;


-- ------------------------------------------------- la formazione aspetta
create or replace function public.rosa_completa_per_schierare() returns trigger
language plpgsql set search_path = public as $$
declare serve int; ha int;
begin
  if current_user not in ('anon', 'authenticated') then return new; end if;
  if not exists (select 1 from public.leagues l where l.id = new.league_id and l.pubblica) then return new; end if;
  serve := public.rosa_richiesta(new.league_id);
  ha := public.rosa_attuale(new.member_id);
  if ha < serve then
    raise exception 'Nella lega pubblica la formazione si consegna con la rosa completa: hai % giocatori su %. Completala dal Negozio.', ha, serve;
  end if;
  return new;
end $$;

-- Il nome viene prima di formazione_valida (028) in ordine alfabetico, e i
-- trigger partono in quell'ordine: a chi ha mezza rosa si dice questo, non
-- "servono 11 titolari".
drop trigger if exists completa_la_rosa on public.lineups;
create trigger completa_la_rosa before insert or update on public.lineups
  for each row execute function public.rosa_completa_per_schierare();


-- ------------------------------------- chi è a metà può sempre completarla
-- Uguale alla 019, tranne il controllo del mercato: aperto nella finestra
-- della prima giornata, OPPURE finché la rosa non è completa.
create or replace function public.compra_giocatore(p_league uuid, p_player text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  io text; mio uuid; crediti int; q record; quante int; tetto int;
  quote jsonb; budget int;
begin
  io := public.current_user_id();
  if io is null then raise exception 'Serve un account'; end if;

  select m.id, m.credits into mio, crediti from public.league_members m
   where m.league_id = p_league and m.user_id = io;
  if mio is null then raise exception 'Non sei in questa lega'; end if;

  if not exists (select 1 from public.leagues l where l.id = p_league and l.pubblica) then
    raise exception 'In questa lega la rosa si fa con l''asta, non dal negozio';
  end if;

  if not public.mercato_aperto(p_league)
     and public.rosa_attuale(mio) >= public.rosa_richiesta(p_league) then
    raise exception 'Il mercato è chiuso: la tua prima giornata è già cominciata';
  end if;

  select * into q from public.quotazioni where player_id = p_player;
  if q.player_id is null then
    raise exception 'Giocatore sconosciuto (%): se il listino non è stato caricato, vedi supabase/seed-quotazioni.sql', p_player;
  end if;

  if exists (select 1 from public.rosters r
              where r.league_id = p_league and r.member_id = mio
                and r.player_id = p_player and r.released_at is null) then
    raise exception 'Ce l''hai già in rosa';
  end if;

  select coalesce(l.rules->'roster', '{"P":3,"D":8,"C":8,"A":6}'::jsonb)
    into quote from public.leagues l where l.id = p_league;
  tetto := (quote->>q.ruolo)::int;
  select count(*) into quante from public.rosters r
    join public.quotazioni z on z.player_id = r.player_id
   where r.league_id = p_league and r.member_id = mio and r.released_at is null
     and z.ruolo = q.ruolo;
  if quante >= tetto then
    raise exception 'Hai già % giocatori in quel ruolo: è il massimo', tetto;
  end if;

  if crediti < q.quotazione then
    raise exception 'Ti restano % crediti e ne servono %', crediti, q.quotazione;
  end if;

  insert into public.rosters (league_id, member_id, player_id, price_paid)
  values (p_league, mio, p_player, q.quotazione);
  update public.league_members set credits = credits - q.quotazione where id = mio;

  return jsonb_build_object('player_id', p_player, 'prezzo', q.quotazione,
                            'crediti', crediti - q.quotazione);
end $$;

revoke execute on function public.compra_giocatore(uuid, text) from public, anon;
grant execute on function public.compra_giocatore(uuid, text) to authenticated;


-- Controllo: chi, nelle leghe pubbliche, oggi ha la rosa incompleta.
select l.name as lega, m.team_name as squadra,
       public.rosa_attuale(m.id) as giocatori, public.rosa_richiesta(l.id) as servono
  from public.league_members m join public.leagues l on l.id = m.league_id
 where l.pubblica and public.rosa_attuale(m.id) < public.rosa_richiesta(l.id)
 order by l.name, giocatori;
