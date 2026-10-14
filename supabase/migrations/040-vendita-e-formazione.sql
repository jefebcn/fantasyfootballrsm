-- =====================================================================
-- 040 — Chi vende un giocatore schierato riconferma la formazione
--
-- Da eseguire DOPO la 038 (e la 039, se c'è). Si può rieseguire.
--
-- IL BUCO. Col negozio aperto (finestra della prima giornata, ripartenza
-- del 14/10, mercato di riparazione) si poteva salvare la formazione della
-- prossima giornata e POI vendere un giocatore che c'è dentro: la
-- formazione restava salvata con un giocatore che non è più tuo, e i suoi
-- punti contavano. Il controllo della 028 guarda la rosa solo quando la
-- formazione si scrive, non quando la rosa cambia dopo.
--
-- LA CORREZIONE. Vendendo un giocatore si tolgono le TUE formazioni delle
-- giornate non ancora chiuse che lo contengono: vanno riconfermate con la
-- rosa nuova. Quelle delle giornate già cominciate non si toccano.
-- La risposta dice quante ne ha tolte, e l'app lo fa sapere.
-- =====================================================================

create or replace function public.vendi_giocatore(p_league uuid, p_player text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare io text; mio uuid; pagato int; tolte int;
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

  -- le formazioni ancora da giocare che lo contengono vanno riconfermate
  delete from public.lineups l
   where l.league_id = p_league and l.member_id = mio
     and (coalesce(l.lineup -> 'starters', '[]'::jsonb) ? p_player
          or coalesce(l.lineup -> 'bench', '[]'::jsonb) ? p_player)
     and not exists (select 1 from public.matchday_locks k
                      where k.matchday = l.matchday and k.lock_at <= now());
  get diagnostics tolte = row_count;

  return jsonb_build_object('player_id', p_player, 'reso', pagato,
    'crediti', (select credits from public.league_members where id = mio),
    'formazioni_tolte', tolte);
end $$;

revoke execute on function public.vendi_giocatore(uuid, text) from public, anon;
grant execute on function public.vendi_giocatore(uuid, text) to authenticated;

-- Controllo: formazioni ancora da giocare con giocatori che non sono in rosa
-- (deve essere 0).
select count(*) as formazioni_con_ceduti
  from public.lineups l
 where not exists (select 1 from public.matchday_locks k where k.matchday = l.matchday and k.lock_at <= now())
   and exists (select 1 from jsonb_array_elements_text(coalesce(l.lineup->'starters','[]') || coalesce(l.lineup->'bench','[]')) x
                where nullif(x, '') is not null
                  and not exists (select 1 from public.rosters r where r.member_id = l.member_id and r.player_id = x and r.released_at is null));
