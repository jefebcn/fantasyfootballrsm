-- =====================================================================
-- 033 — Il proprietario dell'app, e quello che il controllo del 13/10 ha
--       trovato da chiudere
--
-- Da eseguire DOPO le migrazioni fino alla 032. Si può rieseguire.
-- La 026 (ancora da eseguire) è stata aggiornata per non disfare questa.
--
-- IL PROPRIETARIO. Fino a qui un amministratore poteva togliere i poteri a
-- qualunque altro amministratore — anche ad Alex, che l'app l'ha fatta — e
-- nominarne di nuovi. Gli amministratori sono più d'uno: bastava uno solo
-- per chiudere fuori tutti gli altri. Adesso sopra gli amministratori c'è il
-- proprietario, uno solo, che si nomina SOLO da qui (SQL Editor), mai
-- dall'app. Solo lui:
--   - nomina e toglie gli amministratori;
--   - accende e spegne la modalità prudente (032);
--   - gestisce gli sponsor (gli altri li vedono e basta);
--   - vede le e-mail per intero (agli altri arrivano mascherate);
--   - sospende o rinomina un amministratore.
-- E nessuno, da nessuna parte, può togliere qualcosa al proprietario.
-- Ogni gesto da amministratore finisce in un registro che legge solo lui.
--
-- IL RESTO DEL CONTROLLO:
--   - colore, maglia e foto della squadra: solo valori validi (un testo a
--     caso finiva dentro le schermate di tutta la lega);
--   - il creatore di una lega non può essere declassato né tolto da un
--     altro amministratore della stessa lega;
--   - chiudere una giornata per tutti: chi non è Giudice o amministratore
--     può farlo solo quando in lega ci sono tutte le otto partite;
--   - la data d'iscrizione del proprio profilo non si riscrive.
-- =====================================================================

-- ---------------------------------------------------------------- 1. il proprietario
alter table public.profiles add column if not exists is_owner boolean not null default false;
-- uno solo
create unique index if not exists profiles_un_proprietario on public.profiles ((true)) where is_owner;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_owner from public.profiles where id = public.current_user_id()), false)
$$;
revoke all on function public.is_owner() from public, anon;
grant execute on function public.is_owner() to authenticated;

-- Nessuno si da' (o si toglie) ruoli da solo: ora anche il proprietario e la
-- data d'iscrizione. Le funzioni qui sotto girano come proprietario del
-- database e non passano da questo controllo.
create or replace function public.ruoli_protetti() returns trigger
language plpgsql as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.is_admin := false; new.is_judge := false; new.sospeso := false; new.is_owner := false;
    else
      new.is_admin := old.is_admin; new.is_judge := old.is_judge; new.sospeso := old.sospeso;
      new.is_owner := old.is_owner; new.created_at := old.created_at;
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------- 2. il registro
create table if not exists public.registro_admin (
  id bigserial primary key,
  at timestamptz not null default now(),
  chi text,
  azione text not null,
  bersaglio text,
  dettagli jsonb
);
alter table public.registro_admin enable row level security;
revoke all on public.registro_admin from anon, authenticated;
grant select on public.registro_admin to authenticated;
drop policy if exists registro_proprietario on public.registro_admin;
create policy registro_proprietario on public.registro_admin for select to authenticated
  using (public.is_owner());
-- niente policy di scrittura: ci scrivono solo le funzioni qui sotto

create or replace function public.registra_admin(p_azione text, p_bersaglio text, p_dettagli jsonb default null)
returns void language sql security definer set search_path = public as $$
  insert into public.registro_admin (chi, azione, bersaglio, dettagli)
  values (public.current_user_id(), p_azione, p_bersaglio, p_dettagli)
$$;
revoke all on function public.registra_admin(text, text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------- 3. i poteri
create or replace function public.admin_imposta_ruolo(p_user text, p_ruolo text, p_on boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare io text := public.current_user_id();
begin
  if not public.is_admin() then raise exception 'Serve essere amministratore dell''app'; end if;
  if p_ruolo not in ('is_judge', 'is_admin') then raise exception 'Ruolo sconosciuto: %', p_ruolo; end if;
  if not exists (select 1 from public.profiles where id = p_user) then raise exception 'Utente non trovato'; end if;
  if (select is_owner from public.profiles where id = p_user) then
    raise exception 'È il proprietario dell''app: i suoi poteri non si toccano';
  end if;
  if p_ruolo = 'is_admin' and not public.is_owner() then
    raise exception 'Solo il proprietario dell''app nomina o toglie gli amministratori';
  end if;
  if p_user = io and p_ruolo = 'is_admin' and not p_on then
    raise exception 'Non puoi togliere a te stesso l''amministrazione';
  end if;
  if p_ruolo = 'is_judge' then update public.profiles set is_judge = p_on where id = p_user;
  else update public.profiles set is_admin = p_on where id = p_user; end if;
  perform public.registra_admin(case when p_on then 'dà ' else 'toglie ' end || p_ruolo, p_user);
  return true;
end $$;
revoke execute on function public.admin_imposta_ruolo(text, text, boolean) from public, anon;
grant execute on function public.admin_imposta_ruolo(text, text, boolean) to authenticated;

create or replace function public.admin_sospendi(p_user text, p_on boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare io text := public.current_user_id();
begin
  if not public.is_admin() then raise exception 'Serve essere amministratore dell''app'; end if;
  if not exists (select 1 from public.profiles where id = p_user) then raise exception 'Utente non trovato'; end if;
  if (select is_owner from public.profiles where id = p_user) then
    raise exception 'È il proprietario dell''app: non si sospende';
  end if;
  if p_user = io and p_on then raise exception 'Non puoi sospendere te stesso'; end if;
  if p_on and (select is_admin from public.profiles where id = p_user) then
    raise exception 'E'' un amministratore: prima togligli l''amministrazione, poi sospendilo';
  end if;
  update public.profiles set sospeso = p_on where id = p_user;
  perform public.registra_admin(case when p_on then 'sospende' else 'riattiva' end, p_user);
  return true;
end $$;
revoke execute on function public.admin_sospendi(text, boolean) from public, anon;
grant execute on function public.admin_sospendi(text, boolean) to authenticated;

create or replace function public.admin_rinomina(p_member uuid, p_squadra text, p_fantallenatore text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare nome text := nullif(btrim(coalesce(p_squadra, '')), ''); ini text; di text;
begin
  if not public.is_admin() then raise exception 'Serve essere amministratore dell''app'; end if;
  if nome is null then raise exception 'La squadra ha bisogno di un nome'; end if;
  if length(nome) > 28 then raise exception 'Nome squadra troppo lungo (max 28)'; end if;
  select user_id into di from public.league_members where id = p_member;
  if di is null then raise exception 'Squadra non trovata'; end if;
  -- la squadra di un amministratore (o del proprietario) la rinomina solo il proprietario
  if not public.is_owner() and exists (select 1 from public.profiles where id = di and (is_admin or is_owner)) then
    raise exception 'È la squadra di un amministratore: la rinomina solo il proprietario dell''app';
  end if;
  select coalesce(nullif(upper(substring(string_agg(left(w, 1), '') for 3)), ''), 'FC')
    into ini
    from regexp_split_to_table(regexp_replace(nome, '[^A-Za-zÀ-ÿ0-9 ]', '', 'g'), '\s+') w
   where w <> '';
  update public.league_members
     set team_name = nome,
         initials = ini,
         owner_name = coalesce(nullif(btrim(coalesce(p_fantallenatore, '')), ''), owner_name)
   where id = p_member;
  perform public.registra_admin('rinomina squadra', di, jsonb_build_object('squadra', p_member, 'nome', nome));
  return true;
end $$;
revoke execute on function public.admin_rinomina(uuid, text, text) from public, anon;
grant execute on function public.admin_rinomina(uuid, text, text) to authenticated;

-- Le e-mail per intero le vede solo il proprietario. Agli altri amministratori
-- arriva «co•••@gmail.com»: basta a riconoscere una persona, non a scriverle.
-- E per e-mail cerca solo il proprietario: cercando a pezzi si ricostruirebbe.
create or replace function public.maschera_email(e text) returns text
language sql immutable set search_path = public as $$
  select case when e is null or position('@' in e) = 0 then e
              else left(split_part(e, '@', 1), 2) || '•••@' || split_part(e, '@', 2) end
$$;
revoke all on function public.maschera_email(text) from public, anon, authenticated;

-- Stesse colonne della 015 (cambiarle impedirebbe di rieseguire la 015): chi
-- e' il proprietario lo dice proprietario_app() qui sotto.
create or replace function public.admin_persone(p_cerca text default null, p_limite int default 50)
returns table (id text, nome text, email text, is_judge boolean, is_admin boolean, sospeso boolean,
               iscritto timestamptz, ultimo_accesso timestamptz, email_confermata timestamptz,
               leghe int, squadre int)
language plpgsql stable security definer set search_path = public as $$
declare tutto boolean := public.is_owner();
begin
  if not public.is_admin() then raise exception 'Serve essere amministratore dell''app'; end if;
  return query
    select p.id, p.display_name,
           case when tutto then u.email::text else public.maschera_email(u.email::text) end,
           p.is_judge, p.is_admin, p.sospeso,
           p.created_at, u.last_sign_in_at, u.email_confirmed_at,
           (select count(distinct m.league_id)::int from public.league_members m where m.user_id = p.id),
           (select count(*)::int from public.league_members m where m.user_id = p.id)
      from public.profiles p
      left join auth.users u on u.id::text = p.id
     where p_cerca is null or trim(p_cerca) = ''
        or p.display_name ilike '%' || trim(p_cerca) || '%'
        or (tutto and u.email ilike '%' || trim(p_cerca) || '%')
     order by p.created_at desc
     limit greatest(1, least(coalesce(p_limite, 50), 200));
end $$;
revoke execute on function public.admin_persone(text, int) from public, anon;
grant execute on function public.admin_persone(text, int) to authenticated;

-- Chi e' il proprietario: alla console serve per non mostrare, sulla sua
-- riga, tasti che il database rifiuterebbe.
create or replace function public.proprietario_app() returns text
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Serve essere amministratore dell''app'; end if;
  return (select id from public.profiles where is_owner limit 1);
end $$;
revoke execute on function public.proprietario_app() from public, anon;
grant execute on function public.proprietario_app() to authenticated;

-- admin_utenti (014) l'app non la usa piu' (c'e' admin_persone) e dava le
-- e-mail in chiaro: chiusa.
revoke execute on function public.admin_utenti(text, int) from public, anon, authenticated;

-- Sponsor: li vedono gli amministratori, li gestisce il proprietario.
drop policy if exists sponsor_admin on public.sponsor;
create policy sponsor_admin on public.sponsor for select to authenticated
  using (public.is_admin());
drop policy if exists sponsor_proprietario on public.sponsor;
create policy sponsor_proprietario on public.sponsor for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- Modalità prudente (032): la accende e la spegne solo il proprietario.
drop policy if exists interruttori_admin on public.app_interruttori;
drop policy if exists interruttori_proprietario on public.app_interruttori;
create policy interruttori_proprietario on public.app_interruttori for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- ---------------------------------------------------------------- 4. colore, maglia e foto
-- Prima si ripuliscono i valori che non passerebbero il controllo, se no la
-- prossima modifica di quella riga (anche dei crediti) verrebbe rifiutata.
update public.league_members set color = '#1B84C6'
 where color is not null and color !~ '^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$';
update public.league_members set crest_url = null
 where crest_url is not null
   and (crest_url !~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$' or length(crest_url) > 400000);
update public.league_members set kit = kit - 'c1'
 where kit ? 'c1' and coalesce(kit->>'c1', '') !~ '^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$';
update public.league_members set kit = kit - 'finitura'
 where kit ? 'finitura' and coalesce(kit->>'finitura', '') not in ('', 'titano', 'oro');

create or replace function public.squadra_valida() returns trigger
language plpgsql as $$
begin
  if new.color is not null and new.color !~ '^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$' then
    raise exception 'Colore della squadra non valido';
  end if;
  if new.crest_url is not null
     and (new.crest_url !~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$' or length(new.crest_url) > 400000) then
    raise exception 'Foto dello stemma non valida';
  end if;
  if new.kit is not null then
    if jsonb_typeof(new.kit) <> 'object' then raise exception 'Maglia non valida'; end if;
    if new.kit ? 'c1' and coalesce(new.kit->>'c1', '#000') !~ '^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$' then
      raise exception 'Colore della maglia non valido';
    end if;
    if coalesce(new.kit->>'finitura', '') not in ('', 'titano', 'oro') then raise exception 'Maglia non valida'; end if;
    if length(coalesce(new.kit->>'nome', '')) > 30 then raise exception 'Nome sulla maglia troppo lungo'; end if;
    if exists (select 1 from jsonb_each_text(new.kit) where value ~ '[<>"`]') then
      raise exception 'Maglia non valida';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists squadra_valida on public.league_members;
create trigger squadra_valida before insert or update on public.league_members
  for each row execute function public.squadra_valida();

-- ---------------------------------------------------------------- 5. il creatore della lega
create or replace function public.membri_protetti() returns trigger
language plpgsql as $$
begin
  if current_user in ('anon', 'authenticated') then
    new.league_id := old.league_id;
    new.user_id := old.user_id;
    new.created_at := old.created_at;
    if not public.is_league_admin(old.league_id) then
      new.credits := old.credits;
      new.role := old.role;
      new.vice_user_id := old.vice_user_id;
      new.vice_code := old.vice_code;
    end if;
    -- il ruolo di chi ha creato la lega lo cambia solo lui
    if old.user_id is distinct from public.current_user_id()
       and old.user_id = (select l.created_by::text from public.leagues l where l.id = old.league_id) then
      new.role := old.role;
    end if;
  end if;
  return new;
end $$;

create or replace function public.creatore_resta() returns trigger
language plpgsql as $$
begin
  if current_user in ('anon', 'authenticated')
     and old.user_id is distinct from public.current_user_id()
     and old.user_id = (select l.created_by::text from public.leagues l where l.id = old.league_id) then
    raise exception 'Chi ha creato la lega non si toglie dalla lega';
  end if;
  return old;
end $$;
drop trigger if exists creatore_resta on public.league_members;
create trigger creatore_resta before delete on public.league_members
  for each row execute function public.creatore_resta();

-- ---------------------------------------------------------------- 6. chiudere una giornata
create or replace function public.chiudi_giornata(p_matchday int)
returns void
language plpgsql security definer set search_path = public as $$
declare
  con_eventi int; con_presenze int;
begin
  if public.current_user_id() is null then
    raise exception 'Serve un account per chiudere la giornata';
  end if;
  if not exists (select 1 from public.league_members where user_id = public.current_user_id()) then
    raise exception 'Solo chi è in una lega può chiudere la giornata';
  end if;
  if exists (select 1 from public.matchday_status
              where matchday = p_matchday and status = 'frozen') then
    raise exception 'La giornata % è già chiusa', p_matchday;
  end if;

  select count(distinct match_id) into con_eventi
    from public.match_events
   where substring(match_id from '^md([0-9]+)_m') = p_matchday::text;
  if con_eventi = 0 then
    raise exception 'La giornata % non ha ancora nessun evento: non c''è niente da chiudere', p_matchday;
  end if;
  -- La chiusura vale per tutta l'app e non si riapre dall'app: chi non e'
  -- Giudice o amministratore la puo' chiudere solo quando in lega ci sono
  -- tutte le otto partite (16 squadre). Una partita rinviata la chiude il Giudice.
  if not (public.is_judge() or public.is_admin()) then
    select count(distinct match_id) into con_presenze
      from public.match_appearances
     where substring(match_id from '^md([0-9]+)_m') = p_matchday::text;
    if con_presenze < 8 then
      raise exception 'La giornata % non è ancora completa (% partite su 8): la chiude il Giudice', p_matchday, con_presenze;
    end if;
  end if;

  insert into public.matchday_status (matchday, status, changed_by)
       values (p_matchday, 'frozen', public.current_user_id())
  on conflict (matchday) do update
    set status = 'frozen', changed_at = now(), changed_by = excluded.changed_by;
end $$;
revoke execute on function public.chiudi_giornata(int) from public, anon;
grant execute on function public.chiudi_giornata(int) to authenticated;
