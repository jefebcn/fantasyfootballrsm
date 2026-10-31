-- =====================================================================
-- 050 — Lega pubblica: la formazione consegnata vale anche per le giornate dopo
--
-- Si può rieseguire.
--
-- PERCHÉ (Alex, 30/10): «nella lega pubblica le formazioni che sono state
-- consegnate una volta vadano bene sempre, quindi non ci sia mai bisogno di
-- riconfermare, così chi si scorda di rientrare ha sempre la formazione
-- confermata, e solo se cambi personaggi allora c'è bisogno di riconfermarla».
--
-- COME. La formazione resta una riga per giornata, come prima: punteggi,
-- classifica, «le formazioni degli altri», promemoria e conteggi dell'admin
-- leggono tutti la riga della giornata e non cambiano. Cambia solo che nella
-- lega pubblica, quando si scrive la riga di una giornata, la stessa
-- formazione si scrive anche in tutte le giornate dopo che non sono ancora
-- chiuse. Cambiarla la riscrive da quella giornata in avanti; le giornate
-- gia' chiuse restano com'erano.
--
-- «Solo se cambi personaggi»: vendere un giocatore schierato toglieva gia'
-- le formazioni ancora da giocare che lo contengono (040), quindi le toglie
-- tutte e va riconfermata. Comprarne uno non tocca niente: la formazione
-- consegnata resta buona.
--
-- Le leghe fra amici non cambiano: li' ogni giornata si consegna.
-- =====================================================================

create or replace function public.formazione_in_avanti() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- le copie scritte qui sotto ripassano da questo trigger: si fermano li'
  if pg_trigger_depth() > 1 then return null; end if;
  -- il recupero qui sotto scrive gia' tutte le giornate da se'
  if current_setting('fantatitano.senza_avanti', true) = 'on' then return null; end if;
  if not exists (select 1 from public.leagues l where l.id = new.league_id and l.pubblica) then return null; end if;
  -- una correzione a una giornata gia' chiusa (la fa solo l'admin) resta li'
  if exists (select 1 from public.matchday_locks k where k.matchday = new.matchday and k.lock_at <= now()) then return null; end if;
  insert into public.lineups (league_id, member_id, matchday, lineup, submitted_at)
  select new.league_id, new.member_id, k.matchday, new.lineup, new.submitted_at
    from public.matchday_locks k
   where k.matchday > new.matchday and k.lock_at > now()
  on conflict (league_id, member_id, matchday)
    do update set lineup = excluded.lineup, submitted_at = excluded.submitted_at;
  return null;
end $$;

revoke all on function public.formazione_in_avanti() from public, anon, authenticated;

drop trigger if exists formazione_in_avanti on public.lineups;
create trigger formazione_in_avanti after insert or update of lineup on public.lineups
  for each row execute function public.formazione_in_avanti();


-- ------------------------------------------- chi l'ha gia' consegnata
-- Chi nella lega pubblica ha gia' una formazione la ritrova nelle giornate
-- ancora aperte: si riparte dall'ultima consegnata, se e' ancora buona — i
-- giocatori tutti in rosa e la rosa completa, le stesse regole della
-- consegna (028, 037). Si riempiono solo le giornate vuote: chi ha gia'
-- consegnato una giornata aperta non perde niente, l'ultima e' quella.
-- Vale gia' dalla 7a (Alex, 31/10), cominciata col lock del 30/10: chi
-- aveva consegnato la 6a e non la 7a la ritrova anche li'.
select set_config('fantatitano.senza_avanti', 'on', false);
with ultime as (
  select distinct on (li.league_id, li.member_id) li.league_id, li.member_id, li.matchday, li.lineup, li.submitted_at
    from public.lineups li
    join public.leagues l on l.id = li.league_id and l.pubblica
   order by li.league_id, li.member_id, li.matchday desc
), buone as (
  select u.* from ultime u
   where public.rosa_attuale(u.member_id) >= public.rosa_richiesta(u.league_id)
     and not exists (
       select 1 from jsonb_array_elements_text(coalesce(u.lineup -> 'starters', '[]') || coalesce(u.lineup -> 'bench', '[]')) x
        where nullif(x, '') is not null
          and not exists (select 1 from public.rosters r
                           where r.member_id = u.member_id and r.player_id = x and r.released_at is null))
)
insert into public.lineups (league_id, member_id, matchday, lineup, submitted_at)
select b.league_id, b.member_id, k.matchday, b.lineup, b.submitted_at
  from buone b join public.matchday_locks k
    on k.matchday > b.matchday and (k.lock_at > now() or k.matchday >= 7)
on conflict (league_id, member_id, matchday) do nothing;
select set_config('fantatitano.senza_avanti', '', false);
