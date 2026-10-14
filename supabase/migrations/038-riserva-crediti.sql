-- =====================================================================
-- 038 — Rosa a metà: si vende per liberare crediti, e la riserva crediti
--
-- Da eseguire DOPO la 037. Si può rieseguire.
--
-- IL PROBLEMA (Alex, 14/10, dati veri). Con la 037 la formazione della lega
-- pubblica vuole la rosa completa, e chi è a metà può comprare quelli che
-- mancano. Ma cinque squadre non avevano più i crediti: UAFSlava 24 giocatori
-- e 4 crediti, KOBRAkai 23 e 3, Tigers 23 e 8, Luffy Fc 22 e 8, MILLI POLLI
-- 21 e 15 — e il giocatore meno caro costa 5 o 6. Bloccate per sempre.
--
-- COSA CAMBIA.
-- 1. Finché la rosa non è completa si può anche VENDERE (si riprende quello
--    che si è pagato), per liberare crediti. A rosa completa, dopo la prima
--    giornata, la rosa è quella: né vendite né acquisti (scelta di Alex).
-- 2. RISERVA CREDITI, come nelle aste vere: un acquisto che ti lascerebbe
--    senza i crediti per completare la rosa coi giocatori meno cari viene
--    rifiutato. Così nessuno resta più bloccato.
-- =====================================================================

-- Quanti crediti servono, al minimo, per riempire i posti che restano vuoti
-- dopo aver preso un giocatore del ruolo p_ruolo (null: senza comprarne).
create or replace function public.riserva_crediti(p_league uuid, p_member uuid, p_ruolo text)
returns int
language sql stable security definer set search_path = public as $$
  with quote as (
    select e.k as ruolo, e.v::int as quota
      from public.leagues l,
           jsonb_each_text('{"P":3,"D":8,"C":8,"A":6}'::jsonb || coalesce(l.rules -> 'roster', '{}'::jsonb)) as e(k, v)
     where l.id = p_league
  ), ho as (
    select z.ruolo, count(*)::int as n
      from public.rosters r join public.quotazioni z on z.player_id = r.player_id
     where r.member_id = p_member and r.released_at is null
     group by z.ruolo
  ), minimo as (
    select z.ruolo, min(z.quotazione)::int as prezzo
      from public.quotazioni z
     where not exists (select 1 from public.rosters r
                        where r.member_id = p_member and r.player_id = z.player_id and r.released_at is null)
     group by z.ruolo
  )
  select coalesce(sum(greatest(q.quota - coalesce(h.n, 0) - case when q.ruolo = p_ruolo then 1 else 0 end, 0)
                      * coalesce(m.prezzo, 0)), 0)::int
    from quote q left join ho h on h.ruolo = q.ruolo left join minimo m on m.ruolo = q.ruolo
$$;

revoke execute on function public.riserva_crediti(uuid, uuid, text) from public, anon;
grant execute on function public.riserva_crediti(uuid, uuid, text) to authenticated;


-- ------------------------------------------------------------- si compra
-- Uguale alla 037, più la riserva crediti.
create or replace function public.compra_giocatore(p_league uuid, p_player text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  io text; mio uuid; crediti int; q record; quante int; tetto int;
  quote jsonb; riserva int;
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

  riserva := public.riserva_crediti(p_league, mio, q.ruolo);
  if crediti - q.quotazione < riserva then
    raise exception 'Riserva crediti: dopo questo acquisto te ne resterebbero %, ma ne servono almeno % per completare la rosa coi giocatori meno cari', crediti - q.quotazione, riserva;
  end if;

  insert into public.rosters (league_id, member_id, player_id, price_paid)
  values (p_league, mio, p_player, q.quotazione);
  update public.league_members set credits = credits - q.quotazione where id = mio;

  return jsonb_build_object('player_id', p_player, 'prezzo', q.quotazione,
                            'crediti', crediti - q.quotazione);
end $$;


-- -------------------------------------------------------------- si vende
-- Uguale alla 019, ma a mercato chiuso si vende ancora finché la rosa non è
-- completa: è l'unico modo, per chi ha speso tutto, di liberare crediti.
create or replace function public.vendi_giocatore(p_league uuid, p_player text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare io text; mio uuid; pagato int;
begin
  io := public.current_user_id();
  if io is null then raise exception 'Serve un account'; end if;
  select m.id into mio from public.league_members m
   where m.league_id = p_league and m.user_id = io;
  if mio is null then raise exception 'Non sei in questa lega'; end if;

  if not public.mercato_aperto(p_league)
     and public.rosa_attuale(mio) >= public.rosa_richiesta(p_league) then
    raise exception 'Il mercato è chiuso: la tua prima giornata è già cominciata';
  end if;

  select r.price_paid into pagato from public.rosters r
   where r.league_id = p_league and r.member_id = mio
     and r.player_id = p_player and r.released_at is null;
  if pagato is null then raise exception 'Questo giocatore non è in rosa'; end if;

  delete from public.rosters r
   where r.league_id = p_league and r.member_id = mio
     and r.player_id = p_player and r.released_at is null;
  update public.league_members set credits = credits + pagato where id = mio;

  return jsonb_build_object('player_id', p_player, 'reso', pagato,
    'crediti', (select credits from public.league_members where id = mio));
end $$;

revoke execute on function public.compra_giocatore(uuid, text) from public, anon;
grant execute on function public.compra_giocatore(uuid, text) to authenticated;
revoke execute on function public.vendi_giocatore(uuid, text) from public, anon;
grant execute on function public.vendi_giocatore(uuid, text) to authenticated;


-- Controllo: chi ha la rosa incompleta, con quanti crediti e quanti gliene
-- servono al minimo per completarla (se "bastano" è false, deve vendere).
select m.team_name as squadra, public.rosa_attuale(m.id) as giocatori, m.credits as crediti,
       public.riserva_crediti(l.id, m.id, null) as servono_almeno,
       m.credits >= public.riserva_crediti(l.id, m.id, null) as bastano
  from public.league_members m join public.leagues l on l.id = m.league_id
 where l.pubblica and public.rosa_attuale(m.id) between 1 and public.rosa_richiesta(l.id) - 1
 order by bastano, giocatori desc;
