-- Cancellare il proprio account, dall'app.
--
-- L'informativa dice che puoi chiedere la cancellazione dei tuoi dati, e i
-- termini rimandavano a "scrivi a chi amministra la lega". Una promessa
-- mantenuta a mano e' mantenuta quando qualcuno ha tempo: qui diventa un
-- bottone.
--
-- COSA VA VIA. Il profilo, e con lui — per catena di chiavi esterne — le
-- squadre in ogni lega, le rose, le formazioni consegnate e le contestazioni.
-- Il legame di allenatore in seconda si scioglie: chi ti aveva nominato resta,
-- senza vice.
--
-- COSA RESTA, e non e' una dimenticanza. Il registro delle modifiche ai voti
-- (change_log) e chi ha congelato una giornata (matchday_status.changed_by):
-- sono la prova di come e' venuto fuori un punteggio, e servono a tutti gli
-- altri della lega, non a te. Restano col riferimento spezzato, cioe' senza
-- piu' un nome attaccato. L'informativa lo dice gia': "in forma anonima
-- rispetto a chi non ne fa piu' parte".
--
-- COSA NON FA. Se sei l'amministratore di una lega dove gioca anche qualcun
-- altro, si ferma e te lo dice: cancellarti lascerebbe una lega senza nessuno
-- che la governa. Prima passi la lega a un altro o la elimini. Meglio un
-- rifiuto spiegato che una lega orfana.

drop function if exists public.elimina_profilo();
create function public.elimina_profilo()
returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  io text := public.current_user_id();
  bloccanti int;
  leghe_mie int;
begin
  if io is null then
    raise exception 'Serve un account per cancellarlo';
  end if;

  -- amministratore di una lega con altri dentro: non si puo' sparire e basta
  select count(*) into bloccanti
    from public.league_members m
   where m.user_id = io and m.role = 'admin'
     and exists (select 1 from public.league_members a
                  where a.league_id = m.league_id and a.user_id <> io);
  if bloccanti > 0 then
    raise exception 'Sei amministratore di % lega/leghe dove gioca anche qualcun altro: passa la lega a un altro o eliminala prima di cancellare il profilo', bloccanti;
  end if;

  -- le leghe dove sei rimasto solo se ne vanno con te: senza di te sarebbero
  -- vuote, e una lega vuota non la riapre nessuno
  delete from public.leagues l
   where exists (select 1 from public.league_members m
                  where m.league_id = l.id and m.user_id = io and m.role = 'admin')
     and not exists (select 1 from public.league_members a
                      where a.league_id = l.id and a.user_id <> io);
  get diagnostics leghe_mie = row_count;

  -- il legame di vice si scioglie: chi ti aveva nominato resta senza vice
  update public.league_members set vice_user_id = null where vice_user_id = io;

  -- gli indirizzi a cui spedire le notifiche
  delete from public.push_subscriptions where user_id = io;

  -- e il profilo, che si porta dietro squadre, rose, formazioni e
  -- contestazioni per catena di chiavi esterne
  delete from public.profiles where id = io;

  return format('profilo cancellato, %s lega/leghe eliminate', leghe_mie);
end $$;

revoke all on function public.elimina_profilo() from public;
grant execute on function public.elimina_profilo() to authenticated;
