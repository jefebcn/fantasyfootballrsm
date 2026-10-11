-- =====================================================================
-- 028 — Una formazione si schiera con i giocatori che hai
--
-- Da eseguire SUBITO, dopo la 015. Si può rieseguire. L'app non cambia:
-- le formazioni che salva rispettano già tutte queste regole.
--
-- IL BUCO. Il controllo della formazione (engine.js, validateLineup) sta
-- solo nell'app. Il database, con la policy lineups_write, guardava solo che
-- la formazione fosse la propria e che la giornata non fosse chiusa. Quindi
-- con una richiesta all'API si poteva consegnare QUALUNQUE undici: giocatori
-- mai comprati (i migliori del campionato), lo stesso giocatore due volte,
-- un modulo con sei attaccanti. E i punteggi li calcolano i telefoni di
-- tutti dalla formazione salvata: quella truccata valeva per davvero, in
-- classifica e per il premio.
--
-- LA CORREZIONE. Un trigger che, quando a scrivere è un client, rifiuta la
-- formazione se:
--  - i titolari non sono 11, o in panchina ce ne sono più di 7;
--  - un giocatore compare due volte;
--  - un giocatore non è nella rosa di quella squadra (rosters, non ceduto);
--  - il capitano o il vice non sono titolari, o sono la stessa persona;
--  - il modulo non è fra quelli della lega;
--  - i ruoli dei titolari non tornano col modulo (se il listino li conosce
--    tutti: un giocatore entrato a stagione in corso e non ancora nel
--    listino non deve bloccare la consegna).
-- Le stesse regole di validateLineup: chi usa l'app non vede differenze.
-- =====================================================================

create or replace function public.formazione_valida() returns trigger
language plpgsql set search_path = public as $$
declare
  tit text[]; pan text[]; tutti text[]; fuori text;
  modulo text := new.lineup ->> 'formation';
  cap text := nullif(new.lineup ->> 'captainId', '');
  vice text := nullif(new.lineup ->> 'viceCaptainId', '');
  moduli jsonb;
  noti int; d int; c int; a int; p int;
begin
  if current_user not in ('anon', 'authenticated') then return new; end if;

  select coalesce(array_agg(x), '{}') into tit
    from jsonb_array_elements_text(coalesce(new.lineup -> 'starters', '[]'::jsonb)) x where nullif(x, '') is not null;
  select coalesce(array_agg(x), '{}') into pan
    from jsonb_array_elements_text(coalesce(new.lineup -> 'bench', '[]'::jsonb)) x where nullif(x, '') is not null;

  if cardinality(tit) <> 11 then
    raise exception 'La formazione deve avere 11 titolari (ne ha %)', cardinality(tit);
  end if;
  if cardinality(pan) > 7 then
    raise exception 'In panchina vanno al massimo 7 giocatori (ne ha %)', cardinality(pan);
  end if;
  tutti := tit || pan;
  if (select count(distinct x) from unnest(tutti) x) <> cardinality(tutti) then
    raise exception 'Un giocatore compare due volte nella formazione';
  end if;
  select x into fuori from unnest(tutti) x
   where not exists (select 1 from public.rosters r
                      where r.member_id = new.member_id and r.player_id = x and r.released_at is null)
   limit 1;
  if fuori is not null then
    raise exception 'Il giocatore % non è nella tua rosa', fuori;
  end if;
  if cap is not null and not (cap = any (tit)) then raise exception 'Il capitano deve essere titolare'; end if;
  if vice is not null and not (vice = any (tit)) then raise exception 'Il vice deve essere titolare'; end if;
  if cap is not null and cap = vice then raise exception 'Capitano e vice devono essere diversi'; end if;

  moduli := coalesce((select l.rules -> 'modules' from public.leagues l where l.id = new.league_id),
                     '["3-4-3","3-5-2","4-3-3","4-4-2","4-5-1","5-3-2","5-4-1"]'::jsonb);
  if modulo is null or not (moduli ? modulo) then
    raise exception 'Modulo non ammesso: %', coalesce(modulo, 'nessuno');
  end if;

  select count(*), count(*) filter (where q.ruolo = 'P'), count(*) filter (where q.ruolo = 'D'),
         count(*) filter (where q.ruolo = 'C'), count(*) filter (where q.ruolo = 'A')
    into noti, p, d, c, a
    from public.quotazioni q where q.player_id = any (tit);
  if noti = 11 and (p <> 1 or d <> split_part(modulo, '-', 1)::int
                    or c <> split_part(modulo, '-', 2)::int or a <> split_part(modulo, '-', 3)::int) then
    raise exception 'I ruoli dei titolari non tornano col modulo % (P % · D % · C % · A %)', modulo, p, d, c, a;
  end if;
  return new;
end $$;

drop trigger if exists formazione_valida on public.lineups;
create trigger formazione_valida before insert or update on public.lineups
  for each row execute function public.formazione_valida();
