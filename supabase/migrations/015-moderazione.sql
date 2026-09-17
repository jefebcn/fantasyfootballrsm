-- Moderazione: rinominare quello che si vede, e fermare chi non ci sta.
--
-- PERCHE' ADESSO. Aprendo l'app al pubblico, nome squadra e nome
-- fantallenatore diventano testo scritto da estranei e visibile agli altri —
-- in classifica, sullo scontro, e nella scheda che si condivide fuori
-- dall'app. Finora chi amministra non poteva toccarli: l'unico rimedio a un
-- nome offensivo era chiedere per favore.
--
-- DUE STRUMENTI, e sono diversi di proposito.
--   Rinominare risolve il danno: il nome sparisce subito da tutte le
--   schermate, e chi l'ha scritto resta dentro e puo' giocare.
--   Sospendere risolve la persona: chi torna a scriverne un altro non
--   schiera, non contesta e non entra in nuove leghe.
-- Si comincia sempre dal primo. La sospensione e' una porta chiusa, e una
-- porta chiusa per un nome scritto male e' una risposta sbagliata.
--
-- COSA NON FA. Non cancella l'account e non tocca la password: quelle
-- vogliono la chiave di servizio, che nel frontend non deve stare (vedi la
-- 014). Chi vuole andarsene lo fa da se' dalle impostazioni, come prima.

-- 1. La colonna.
alter table public.profiles add column if not exists sospeso boolean not null default false;

-- 2. E nessuno se la toglie da solo.
--
-- E' la lezione della 014, e vale ogni volta: una policy che pinta solo le
-- colonne che esistevano quando l'hanno scritta non protegge quelle nuove.
-- Senza questa riga, chiunque con la chiave pubblicabile che sta nel frontend
-- potrebbe fare `update profiles set sospeso = false` su di se'.
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = public.current_user_id())
  with check (
    id = public.current_user_id()
    and is_judge = (select p.is_judge from public.profiles p where p.id = public.current_user_id())
    and is_admin = (select p.is_admin from public.profiles p where p.id = public.current_user_id())
    and sospeso  = (select p.sospeso  from public.profiles p where p.id = public.current_user_id())
  );

-- 3. Sono sospeso?
create or replace function public.sono_sospeso()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select sospeso from public.profiles where id = public.current_user_id()), false)
$$;

-- 4. Un sospeso non entra in nuove leghe.
--
-- Un TRIGGER e non un controllo dentro create_league, join_league ed
-- entra_lega_pubblica: quelle sono tre funzioni SECURITY DEFINER, quindi la
-- RLS non le ferma, e ricopiarne il corpo qui per aggiungere una riga vuol
-- dire tenere due versioni della stessa funzione che prima o poi divergono.
-- Il trigger sta sulla tabella e vale per tutte e tre — e anche per la
-- quarta, quella che scrivera' qualcun altro fra sei mesi.
--
-- Il controllo e' sulla riga di CHI STA SCRIVENDO: chi amministra una lega
-- deve poter ancora sistemare le squadre degli altri, sospesi compresi.
create or replace function public.blocca_sospesi()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.user_id = public.current_user_id() and public.sono_sospeso() then
    raise exception 'Account sospeso: non puoi entrare in altre leghe. Scrivi a chi amministra l''app.';
  end if;
  return new;
end $$;
drop trigger if exists blocca_sospesi_ins on public.league_members;
create trigger blocca_sospesi_ins before insert on public.league_members
  for each row execute function public.blocca_sospesi();

-- 5. E non schiera, e non contesta.
--
-- Le due policy si riscrivono per intero — sono quelle della 004 e dello
-- schema, con una condizione in piu' — perche' una policy non si estende: si
-- sostituisce. La lettura resta libera: lineups_read e' un'altra policy, e
-- un sospeso deve poter continuare a vedere la lega di cui fa parte.
drop policy if exists lineups_write on public.lineups;
create policy lineups_write on public.lineups for all to authenticated
  using (
    member_id = public.my_member_id(league_id)
    and now() < coalesce(public.matchday_lock_at(matchday), 'infinity'::timestamptz)
    and not public.sono_sospeso()
  )
  with check (
    member_id = public.my_member_id(league_id)
    and now() < coalesce(public.matchday_lock_at(matchday), 'infinity'::timestamptz)
    and not public.sono_sospeso()
  );

drop policy if exists contest_insert on public.contestazioni;
create policy contest_insert on public.contestazioni for insert to authenticated
  with check (member_id = public.my_member_id(league_id) and status = 'open' and not public.sono_sospeso());

-- ------------------------------------------------- gli strumenti della console

-- Sospendere e riattivare.
create or replace function public.admin_sospendi(p_user text, p_on boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare io text := public.current_user_id();
begin
  if not public.is_admin() then raise exception 'Serve essere amministratore dell''app'; end if;
  if not exists (select 1 from public.profiles where id = p_user) then raise exception 'Utente non trovato'; end if;
  -- Come per i poteri nella 014: su se stessi no. Sospendersi da soli e'
  -- l'unico modo di chiudersi fuori senza poter rientrare.
  if p_user = io and p_on then raise exception 'Non puoi sospendere te stesso'; end if;
  -- E un amministratore non si sospende da un altro amministratore: prima gli
  -- si toglie l'amministrazione, che e' una decisione diversa e va presa
  -- guardandola in faccia.
  if p_on and (select is_admin from public.profiles where id = p_user) then
    raise exception 'E'' un amministratore: prima togligli l''amministrazione, poi sospendilo';
  end if;
  update public.profiles set sospeso = p_on where id = p_user;
  return true;
end $$;

-- Le squadre, per trovare quella da rinominare.
--
-- La console aveva le persone e le leghe, ma il nome che si vede in giro sta
-- su league_members: senza un elenco delle squadre, per arrivare a un nome
-- offensivo bisognava indovinare in quale lega stesse.
create or replace function public.admin_squadre(p_cerca text default null, p_limite int default 50)
returns table (member_id uuid, squadra text, fantallenatore text, iniziali text,
               lega text, league_id uuid, user_id text, sospeso boolean, creata timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Serve essere amministratore dell''app'; end if;
  return query
    select m.id, m.team_name, coalesce(m.owner_name, p.display_name), m.initials,
           l.name, l.id, m.user_id, coalesce(p.sospeso, false), m.created_at
      from public.league_members m
      join public.leagues l on l.id = m.league_id
      left join public.profiles p on p.id = m.user_id
     where p_cerca is null or trim(p_cerca) = ''
        or m.team_name ilike '%' || trim(p_cerca) || '%'
        or m.owner_name ilike '%' || trim(p_cerca) || '%'
        or p.display_name ilike '%' || trim(p_cerca) || '%'
        or l.name ilike '%' || trim(p_cerca) || '%'
     order by m.created_at desc
     limit greatest(1, least(coalesce(p_limite, 50), 200));
end $$;

-- Rinominare una squadra.
--
-- Le iniziali si ricalcolano qui e non si chiedono a chi modera: sono quelle
-- che finiscono nello stemma, e un nome nuovo con le iniziali vecchie e' un
-- lavoro fatto a meta'. Stessa regola dell'app (iniziali() in state.js).
create or replace function public.admin_rinomina(p_member uuid, p_squadra text, p_fantallenatore text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare nome text := nullif(btrim(coalesce(p_squadra, '')), ''); ini text;
begin
  if not public.is_admin() then raise exception 'Serve essere amministratore dell''app'; end if;
  if nome is null then raise exception 'La squadra ha bisogno di un nome'; end if;
  if length(nome) > 28 then raise exception 'Nome squadra troppo lungo (max 28)'; end if;
  if not exists (select 1 from public.league_members where id = p_member) then raise exception 'Squadra non trovata'; end if;
  select coalesce(nullif(upper(substring(string_agg(left(w, 1), '') for 3)), ''), 'FC')
    into ini
    from regexp_split_to_table(regexp_replace(nome, '[^A-Za-zÀ-ÿ0-9 ]', '', 'g'), '\s+') w
   where w <> '';
  update public.league_members
     set team_name = nome,
         initials = ini,
         owner_name = coalesce(nullif(btrim(coalesce(p_fantallenatore, '')), ''), owner_name)
   where id = p_member;
  return true;
end $$;

-- L'elenco delle persone dice anche chi e' sospeso.
--
-- SI CHIAMA IN UN ALTRO MODO, e non e' un vezzo: aggiungere una colonna al
-- ritorno vuol dire cambiare il tipo, e un tipo non si cambia con "create or
-- replace" — si dovrebbe droppare la funzione. Ma la 014 la crea con "create
-- or replace" e il suo tipo vecchio: se questa la droppasse e la ricreasse,
-- rieseguire la 014 dopo la 015 morirebbe con "cannot change return type", e
-- le migrazioni di questo progetto si devono poter rieseguire in qualunque
-- ordine (la prova le passa due volte di fila proprio per questo).
-- admin_utenti resta dov'e', non la chiama piu' nessuno.
create or replace function public.admin_persone(p_cerca text default null, p_limite int default 50)
returns table (id text, nome text, email text, is_judge boolean, is_admin boolean, sospeso boolean,
               iscritto timestamptz, ultimo_accesso timestamptz, email_confermata timestamptz,
               leghe int, squadre int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Serve essere amministratore dell''app'; end if;
  return query
    select p.id, p.display_name, u.email::text, p.is_judge, p.is_admin, p.sospeso,
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

-- I permessi per ruolo, come vuole la 011: niente resta aperto ad anon.
--
-- blocca_sospesi() e' la funzione del trigger e non la chiama nessuno da
-- fuori: Postgres controlla l'EXECUTE quando il trigger si crea, non a ogni
-- inserimento. Quindi la si chiude a tutti — e questa riga non l'ho scritta
-- da me: l'ha chiesta prove/permessi.sh, che ha visto la funzione nuova
-- eseguibile dal ruolo anonimo.
revoke execute on function public.blocca_sospesi() from public, anon, authenticated;
revoke execute on function public.sono_sospeso() from public, anon;
grant execute on function public.sono_sospeso() to authenticated;
revoke execute on function public.admin_sospendi(text, boolean) from public, anon;
grant execute on function public.admin_sospendi(text, boolean) to authenticated;
revoke execute on function public.admin_squadre(text, int) from public, anon;
grant execute on function public.admin_squadre(text, int) to authenticated;
revoke execute on function public.admin_rinomina(uuid, text, text) from public, anon;
grant execute on function public.admin_rinomina(uuid, text, text) to authenticated;
revoke execute on function public.admin_persone(text, int) from public, anon;
grant execute on function public.admin_persone(text, int) to authenticated;
