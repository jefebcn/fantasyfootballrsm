-- Chi comanda l'app: un ruolo, e una console per usarlo.
--
-- TRE RUOLI DIVERSI, e tenerli separati e' il punto:
--   is_admin  — chi gestisce l'APP: crea le leghe pubbliche, nomina gli altri,
--               guarda i numeri. Uno o due in tutto.
--   is_judge  — il Giudice Dati: inserisce i referti del campionato e congela
--               le giornate. Riguarda il dato, non le persone.
--   role='admin' su league_members — chi amministra UNA lega. Non ha nessun
--               potere fuori da quella.
--
-- Prima chiunque poteva aprire una lega pubblica, cioe' una lega visibile a
-- tutti gli iscritti dell'app con dei premi in palio. Non e' una cosa da
-- lasciare a chi passa.
--
-- IL PRIMO AMMINISTRATORE SI NOMINA A MANO, come il Giudice Dati:
--   update public.profiles set is_admin = true
--    where id = (select id::text from auth.users where lower(email) = lower('tua@email'));
-- Dall'app non si puo', e non e' una mancanza: se si potesse, il primo che
-- passa si darebbe i poteri da solo.

alter table public.profiles add column if not exists is_admin boolean not null default false;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = public.current_user_id()), false)
$$;

-- La lega pubblica la apre solo chi amministra l'app.
create or replace function public.crea_lega_pubblica(
  p_name text, p_short text, p_team text, p_color text, p_initials text,
  p_budget int, p_max int, p_premi jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare lid uuid; uid text; b int; m int;
begin
  uid := public.current_user_id();
  if uid is null then raise exception 'non autenticato'; end if;
  if not public.is_admin() then
    raise exception 'Le leghe pubbliche le apre chi amministra l''app';
  end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Serve un nome per la lega'; end if;
  if coalesce(trim(p_team), '') = '' then raise exception 'Serve un nome per la tua squadra'; end if;
  b := coalesce(p_budget, 500);
  m := coalesce(p_max, 200);
  if b < 50 or b > 5000 then raise exception 'I crediti vanno da 50 a 5000'; end if;
  if m < 2 or m > 1000 then raise exception 'I partecipanti vanno da 2 a 1000'; end if;

  insert into public.leagues (name, short_name, created_by, pubblica, classifica, max_membri, premi, rules)
  values (trim(p_name), coalesce(nullif(trim(p_short), ''), trim(p_name)), uid, true, 'punti', m,
          public.premi_validi(p_premi), jsonb_build_object('budget', b))
  returning id into lid;

  insert into public.league_members (league_id, user_id, role, team_name, owner_name, color, initials, credits)
  values (lid, uid, 'admin', trim(p_team), (select display_name from public.profiles where id = uid),
          coalesce(p_color, '#1B84C6'), p_initials, b);
  return lid;
end $$;

-- ---------------------------------------------------------------- la console
--
-- Tutto SECURITY DEFINER con il controllo dentro: queste funzioni leggono
-- cose che la RLS, giustamente, non fa vedere a nessuno — le leghe altrui, e
-- da auth.users l'e-mail e l'ultimo accesso. Il controllo non e' nella
-- policy, e' la prima riga del corpo.

create or replace function public.admin_riepilogo()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Serve essere amministratore dell''app'; end if;
  return jsonb_build_object(
    'utenti', (select count(*) from public.profiles),
    'giudici', (select count(*) from public.profiles where is_judge),
    'amministratori', (select count(*) from public.profiles where is_admin),
    'leghe', (select count(*) from public.leagues),
    'leghe_pubbliche', (select count(*) from public.leagues where pubblica),
    'squadre', (select count(*) from public.league_members),
    'rose_complete', (select count(*) from (
        select member_id from public.rosters where released_at is null
         group by member_id having count(*) >= 25) q),
    'formazioni', (select count(*) from public.lineups),
    'telefoni_push', (select count(*) from public.push_subscriptions where failed_at is null),
    'contestazioni_aperte', (select count(*) from public.contestazioni where status = 'open'),
    'giornate_congelate', (select count(*) from public.matchday_status where status = 'frozen'),
    'iscritti_7_giorni', (select count(*) from public.profiles where created_at > now() - interval '7 days')
  );
end $$;

-- Le persone: chi e' iscritto, quando e' entrato l'ultima volta, che poteri
-- ha. L'e-mail serve per rispondere a "non riesco a entrare": senza, chi
-- amministra non puo' collegare una richiesta d'aiuto a un account.
create or replace function public.admin_utenti(p_cerca text default null, p_limite int default 50)
returns table (id text, nome text, email text, is_judge boolean, is_admin boolean,
               iscritto timestamptz, ultimo_accesso timestamptz, email_confermata timestamptz,
               leghe int, squadre int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Serve essere amministratore dell''app'; end if;
  return query
    select p.id, p.display_name, u.email::text, p.is_judge, p.is_admin,
           p.created_at, u.last_sign_in_at, u.email_confirmed_at,
           (select count(distinct m.league_id)::int from public.league_members m where m.user_id = p.id),
           (select count(*)::int from public.league_members m where m.user_id = p.id)
      from public.profiles p
      left join auth.users u on u.id::text = p.id
     where p_cerca is null or trim(p_cerca) = ''
        or p.display_name ilike '%' || trim(p_cerca) || '%'
        or u.email ilike '%' || trim(p_cerca) || '%'
     order by p.created_at desc
     limit greatest(1, least(coalesce(p_limite, 50), 200));
end $$;

-- Le leghe, tutte: quante squadre, chi l'ha creata, se e' partita.
create or replace function public.admin_leghe(p_limite int default 50)
returns table (id uuid, nome text, pubblica boolean, membri int, max_membri int,
               budget int, premi jsonb, started boolean, creata timestamptz, creatore text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Serve essere amministratore dell''app'; end if;
  return query
    select l.id, l.name, l.pubblica,
           (select count(*)::int from public.league_members m where m.league_id = l.id),
           l.max_membri, coalesce((l.rules->>'budget')::int, 500), l.premi, l.started, l.created_at,
           (select p.display_name from public.profiles p where p.id = l.created_by)
      from public.leagues l
     order by l.pubblica desc, l.created_at desc
     limit greatest(1, least(coalesce(p_limite, 50), 200));
end $$;

-- Dare e togliere i poteri.
create or replace function public.admin_imposta_ruolo(p_user text, p_ruolo text, p_on boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare io text := public.current_user_id();
begin
  if not public.is_admin() then raise exception 'Serve essere amministratore dell''app'; end if;
  if p_ruolo not in ('is_judge', 'is_admin') then raise exception 'Ruolo sconosciuto: %', p_ruolo; end if;
  if not exists (select 1 from public.profiles where id = p_user) then raise exception 'Utente non trovato'; end if;
  -- Non si toglie il potere a se stessi: sarebbe l'unico modo di restare
  -- chiusi fuori dalla console senza poterci rientrare, e si rimedierebbe
  -- solo con una riga di SQL a mano.
  if p_user = io and p_ruolo = 'is_admin' and not p_on then
    raise exception 'Non puoi togliere a te stesso l''amministrazione: fallo fare a un altro amministratore';
  end if;
  if p_ruolo = 'is_judge' then update public.profiles set is_judge = p_on where id = p_user;
  else update public.profiles set is_admin = p_on where id = p_user; end if;
  return true;
end $$;

-- I permessi per ruolo, come vuole la 011.
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
revoke execute on function public.admin_riepilogo() from public, anon;
grant execute on function public.admin_riepilogo() to authenticated;
revoke execute on function public.admin_utenti(text, int) from public, anon;
grant execute on function public.admin_utenti(text, int) to authenticated;
revoke execute on function public.admin_leghe(int) from public, anon;
grant execute on function public.admin_leghe(int) to authenticated;
revoke execute on function public.admin_imposta_ruolo(text, text, boolean) from public, anon;
grant execute on function public.admin_imposta_ruolo(text, text, boolean) to authenticated;
revoke execute on function public.crea_lega_pubblica(text, text, text, text, text, int, int, jsonb) from public, anon;
grant execute on function public.crea_lega_pubblica(text, text, text, text, text, int, int, jsonb) to authenticated;

-- ---------------------------------------------------------------- IL BUCO
--
-- La policy che impedisce di promuoversi da soli conosceva SOLO is_judge:
--
--   with check (id = current_user_id() and is_judge = (select is_judge ...))
--
-- Su una colonna nuova non si applica da se'. Senza questa riga, chiunque con
-- la chiave pubblicabile che sta nel frontend poteva scrivere
--   update profiles set is_admin = true where id = <se stesso>
-- e darsi i poteri sull'app: aprire leghe pubbliche, leggere le e-mail di
-- tutti, nominare altri amministratori. Il tipo di buco che una colonna
-- aggiunta in fretta porta con se' senza fare rumore.
--
-- La policy adesso pretende che ENTRAMBI i campi restino quelli che sono:
-- si cambiano solo dalle funzioni qui sopra, che controllano chi chiama.
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = public.current_user_id())
  with check (
    id = public.current_user_id()
    and is_judge = (select p.is_judge from public.profiles p where p.id = public.current_user_id())
    and is_admin = (select p.is_admin from public.profiles p where p.id = public.current_user_id())
  );
