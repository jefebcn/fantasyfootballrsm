-- 046: formazioni preparate ma non confermate, e la conferma da amministratore.
--
-- Alex, 23/10: «da admin vedere se la gente ha messo la formazione, se l'ha
-- confermata, e in caso confermargliela io». Fino a qui la formazione in
-- preparazione viveva solo nel telefono: finche' non si toccava «Conferma
-- formazione» il server non ne sapeva niente, e chi si dimenticava il tasto
-- perdeva 0-3 a tavolino con la squadra pronta sullo schermo.
--
-- 1. formazioni_bozze: l'app ci salva da sola la formazione mentre la si
--    prepara. Ognuno vede e scrive solo le sue (anche il vice della squadra).
-- 2. admin_formazioni(giornata): per chi amministra l'app, squadra per
--    squadra, consegnata / solo bozza / niente.
-- 3. admin_conferma_formazione: consegna la bozza (o, se non c'e', la stessa
--    formazione dell'ultima giornata consegnata) a nome della squadra. Solo
--    PRIMA della chiusura: dopo, il risultato della giornata non si tocca.
--    Passa dagli stessi controlli di una consegna normale (028) e resta nel
--    registro degli amministratori (033).

create table if not exists public.formazioni_bozze (
  league_id  uuid not null references public.leagues(id) on delete cascade,
  member_id  uuid not null references public.league_members(id) on delete cascade,
  matchday   int  not null,
  lineup     jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (league_id, member_id, matchday)
);

alter table public.formazioni_bozze enable row level security;
drop policy if exists bozze_proprie on public.formazioni_bozze;
create policy bozze_proprie on public.formazioni_bozze for all to authenticated
  using (exists (select 1 from public.league_members m
                  where m.id = member_id and m.league_id = formazioni_bozze.league_id
                    and (m.user_id = public.current_user_id() or m.vice_user_id = public.current_user_id())))
  with check (exists (select 1 from public.league_members m
                  where m.id = member_id and m.league_id = formazioni_bozze.league_id
                    and (m.user_id = public.current_user_id() or m.vice_user_id = public.current_user_id())));
-- Su Supabase le tabelle nuove danno tutto anche al ruolo anonimo: la policy
-- qui sopra lo lascerebbe comunque a mani vuote, ma meglio non averlo affatto.
revoke all on public.formazioni_bozze from public, anon;
grant select, insert, update, delete on public.formazioni_bozze to authenticated;

-- I controlli della 028 si saltavano per chi non e' anon/authenticated, cioe'
-- per le funzioni del database: e' giusto per gli import, ma la conferma
-- dell'amministratore deve passarci come una consegna qualunque. La funzione
-- che conferma accende «fcs.valida_formazione» per la sola transazione.
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
  if current_user not in ('anon', 'authenticated')
     and coalesce(current_setting('fcs.valida_formazione', true), '') <> 'si' then return new; end if;

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

-- Squadra per squadra, per una giornata. Solo le squadre con una rosa: chi
-- non ha giocatori non puo' schierare e non c'e' niente da guardare.
create or replace function public.admin_formazioni(p_matchday int)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not public.is_admin() then raise exception 'Serve essere amministratore dell''app'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'lega_id', l.id, 'lega', l.name, 'pubblica', l.pubblica,
           'squadra_id', m.id, 'squadra', m.team_name, 'allenatore', coalesce(m.owner_name, p.display_name),
           'consegnata_at', li.submitted_at,
           'bozza_at', b.updated_at,
           'ultima', (select max(x.matchday) from public.lineups x where x.member_id = m.id and x.matchday < p_matchday)
         ) order by l.name, m.team_name), '[]'::jsonb)
    into v
    from public.league_members m
    join public.leagues l on l.id = m.league_id
    left join public.profiles p on p.id = m.user_id
    left join public.lineups li on li.member_id = m.id and li.league_id = m.league_id and li.matchday = p_matchday
    left join public.formazioni_bozze b on b.member_id = m.id and b.league_id = m.league_id and b.matchday = p_matchday
   where exists (select 1 from public.rosters r where r.member_id = m.id and r.released_at is null);
  return jsonb_build_object('giornata', p_matchday, 'chiusura', public.matchday_lock_at(p_matchday), 'squadre', v);
end $$;

-- Consegna a nome della squadra. p_da: 'bozza' (quella preparata) oppure
-- 'ultima' (la stessa dell'ultima giornata consegnata). Risponde da dove ha
-- preso la formazione.
create or replace function public.admin_conferma_formazione(p_league uuid, p_member uuid, p_matchday int, p_da text default 'bozza')
returns jsonb language plpgsql security definer set search_path = public as $$
declare f jsonb; da int; chiude timestamptz := public.matchday_lock_at(p_matchday);
begin
  if not public.is_admin() then raise exception 'Serve essere amministratore dell''app'; end if;
  if not exists (select 1 from public.league_members where id = p_member and league_id = p_league) then
    raise exception 'Squadra non trovata in questa lega';
  end if;
  if chiude is not null and now() >= chiude then
    raise exception 'La % giornata è già chiusa: dopo la chiusura la formazione non si consegna più', p_matchday || 'ª';
  end if;
  if p_da = 'bozza' then
    select lineup into f from public.formazioni_bozze where member_id = p_member and league_id = p_league and matchday = p_matchday;
    if f is null then raise exception 'Questa squadra non ha una formazione preparata per la % giornata', p_matchday || 'ª'; end if;
  elsif p_da = 'ultima' then
    select x.matchday, x.lineup into da, f from public.lineups x
     where x.member_id = p_member and x.league_id = p_league and x.matchday < p_matchday
     order by x.matchday desc limit 1;
    if f is null then raise exception 'Questa squadra non ha mai consegnato una formazione da ripetere'; end if;
  else
    raise exception 'Da dove prendere la formazione: bozza o ultima';
  end if;
  perform set_config('fcs.valida_formazione', 'si', true);
  insert into public.lineups (league_id, member_id, matchday, lineup, submitted_at)
  values (p_league, p_member, p_matchday, f, now())
  on conflict (league_id, member_id, matchday) do update set lineup = excluded.lineup, submitted_at = excluded.submitted_at;
  perform set_config('fcs.valida_formazione', '', true);
  perform public.registra_admin('conferma_formazione', p_member::text,
    jsonb_build_object('lega', p_league, 'giornata', p_matchday, 'da', p_da, 'dalla_giornata', da));
  return jsonb_build_object('da', p_da, 'dalla_giornata', da);
end $$;

revoke execute on function public.admin_formazioni(int) from public, anon;
grant execute on function public.admin_formazioni(int) to authenticated;
revoke execute on function public.admin_conferma_formazione(uuid, uuid, int, text) from public, anon;
grant execute on function public.admin_conferma_formazione(uuid, uuid, int, text) to authenticated;
