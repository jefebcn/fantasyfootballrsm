-- =====================================================================
-- FUTSAL 09 — Regole del server rifinite prima del lancio (21/11/2026)
--
-- Si può rieseguire.
--  1. futsal_iscritti: data d'iscrizione e squadra del cuore non si
--     riscrivono dall'app. Prima ci si poteva retrodatare (ed entrare in
--     coppa) o saltare da un campionato Tifosi all'altro quando si voleva.
--  2. Chi crea una lega testa a testa ed esce prima di avviarla passa la
--     lega al membro entrato prima: se no nessuno la poteva più avviare.
--  3. Entrare in una lega (col codice o pubblica) blocca la riga della
--     lega: con molti ingressi insieme si superava max_membri.
--  4. futsal_formazione_valida: accenti veri («è») e crediti con la virgola
--     (71,5 e non 71.5) nei messaggi che arrivano all'utente. Le regole sono
--     quelle della futsal-04, invariate.
-- =====================================================================

-- 1 ------------------------------------------------------------------
create or replace function public.futsal_iscritti_protetti() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.created_at := now();
    else
      new.user_id := old.user_id;
      new.created_at := old.created_at;
      if old.club_cuore is not null then new.club_cuore := old.club_cuore; end if;
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.futsal_iscritti_protetti() from public, anon;
drop trigger if exists futsal_iscritti_protetti on public.futsal_iscritti;
create trigger futsal_iscritti_protetti before insert or update on public.futsal_iscritti
  for each row execute function public.futsal_iscritti_protetti();

-- 2 ------------------------------------------------------------------
create or replace function public.futsal_esci_lega(p_lega uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid text := public.current_user_id();
begin
  delete from public.futsal_membri where lega_id = p_lega and user_id = uid;
  -- chi l'aveva creata se ne va prima dell'avvio: la lega passa al membro entrato prima
  update public.futsal_leghe l
     set creata_da = (select m.user_id from public.futsal_membri m where m.lega_id = l.id order by m.entrato_at, m.user_id limit 1)
   where l.id = p_lega and l.creata_da = uid and l.avvio_giornata is null
     and exists (select 1 from public.futsal_membri m where m.lega_id = l.id);
  -- l'ultimo che esce si porta via la lega
  delete from public.futsal_leghe l where l.id = p_lega and not exists (select 1 from public.futsal_membri m where m.lega_id = l.id);
end $$;

-- 3 ------------------------------------------------------------------
create or replace function public.futsal_entra_lega(p_codice text) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid text := public.current_user_id(); l public.futsal_leghe;
begin
  if not exists (select 1 from public.futsal_iscritti where user_id = uid) then raise exception 'Prima iscriviti al FantaFutsal'; end if;
  select * into l from public.futsal_leghe where codice = upper(trim(p_codice)) for update;
  if l.id is null then raise exception 'Codice non trovato'; end if;
  if exists (select 1 from public.futsal_membri where lega_id = l.id and user_id = uid) then return l.id; end if;
  if l.avvio_giornata is not null then raise exception 'La lega è già partita: il calendario degli scontri è fissato'; end if;
  if (select count(*) from public.futsal_membri where lega_id = l.id) >= l.max_membri then raise exception 'Lega al completo'; end if;
  insert into public.futsal_membri (lega_id, user_id) values (l.id, uid) on conflict do nothing;
  return l.id;
end $$;

create or replace function public.futsal_entra_lega_pubblica(p_lega uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid text := public.current_user_id(); l public.futsal_leghe; n int;
begin
  if not exists (select 1 from public.futsal_iscritti where user_id = uid) then raise exception 'Prima iscriviti al FantaFutsal'; end if;
  select * into l from public.futsal_leghe where id = p_lega for update;
  if l.id is null then raise exception 'Lega non trovata'; end if;
  if not l.pubblica then raise exception 'Questa lega non è pubblica: serve il codice'; end if;
  if exists (select 1 from public.futsal_membri where lega_id = l.id and user_id = uid) then return l.id; end if;
  select count(*) into n from public.futsal_membri where lega_id = l.id;
  if n >= l.max_membri then raise exception 'Lega al completo (% su %)', n, l.max_membri; end if;
  insert into public.futsal_membri (lega_id, user_id) values (l.id, uid) on conflict do nothing;
  return l.id;
end $$;

-- 4 ------------------------------------------------------------------
create or replace function public.futsal_formazione_valida() returns trigger
language plpgsql set search_path = public as $$
declare
  f jsonb := new.formazione;
  schema text := f ->> 'schema';
  porta text := f ->> 'porta';
  rd text[]; ra text[]; rosa text[]; tit text[];
  sesto text := nullif(f ->> 'sesto', '');
  cap text := nullif(f ->> 'capitano', '');
  vice text := nullif(f ->> 'vice', '');
  noti int; d int; a int; club_max int;
  ora text[]; prima text[]; spesa numeric; mancano int; patrimonio numeric;
begin
  if current_user not in ('anon', 'authenticated') then return new; end if;
  new.consegnata_at := now();
  if schema is null or schema not in ('1-3', '2-2', '3-1') then raise exception 'Schema non valido: %', schema; end if;
  if porta is null or not exists (select 1 from public.futsal_giocatori where club = porta) then raise exception 'Porta non valida'; end if;
  select coalesce(array_agg(x), '{}') into rd from jsonb_array_elements_text(coalesce(f -> 'D', '[]')) x;
  select coalesce(array_agg(x), '{}') into ra from jsonb_array_elements_text(coalesce(f -> 'A', '[]')) x;
  select coalesce(array_agg(x), '{}') into tit from jsonb_array_elements_text(coalesce(f -> 'titolari', '[]')) x;
  rosa := rd || ra;
  if cardinality(rd) <> 4 or cardinality(ra) <> 4 then raise exception 'In rosa servono 4 difensori e 4 attaccanti'; end if;
  if (select count(distinct x) from unnest(rosa) x) <> 8 then raise exception 'Un giocatore compare due volte'; end if;
  if cardinality(tit) <> 4 or not (tit <@ rosa) or (select count(distinct x) from unnest(tit) x) <> 4 then raise exception 'In campo vanno quattro giocatori della rosa'; end if;
  if sesto is null or not sesto = any(rosa) or sesto = any(tit) then raise exception 'Il sesto uomo va scelto fra chi non è in campo'; end if;
  if cap is null or not cap = any(tit) then raise exception 'Il capitano va scelto fra i quattro in campo'; end if;
  if vice is null or not vice = any(tit) or vice = cap then raise exception 'Il vice va scelto fra i quattro in campo, diverso dal capitano'; end if;
  select count(*) into noti from public.futsal_giocatori where id = any(rosa);
  if noti = 8 then
    if exists (select 1 from public.futsal_giocatori where id = any(rd) and ruolo <> 'D')
       or exists (select 1 from public.futsal_giocatori where id = any(ra) and ruolo <> 'A') then
      raise exception 'Un giocatore è nel ruolo sbagliato';
    end if;
    select count(*) filter (where ruolo = 'D'), count(*) filter (where ruolo = 'A') into d, a
      from public.futsal_giocatori where id = any(tit);
    if (schema = '1-3' and (d, a) <> (1, 3)) or (schema = '2-2' and (d, a) <> (2, 2)) or (schema = '3-1' and (d, a) <> (3, 1)) then
      raise exception 'I ruoli in campo non tornano con lo schema %', schema;
    end if;
    select max(n) into club_max from (select club, count(*) n from
      (select club from public.futsal_giocatori where id = any(rosa) union all select porta) c group by club) x;
    if club_max > 2 then raise exception 'Al massimo 2 giocatori per squadra, Porta compresa'; end if;
  end if;

  -- Il mercato: se la rosa cambia rispetto alla giornata prima (e rispetto a
  -- quella gia' consegnata per questa giornata), servono quotazioni
  -- definitive e crediti a sufficienza.
  ora := public.futsal_elementi(f);
  prima := public.futsal_elementi(public.futsal_in_vigore(new.user_id, new.giornata - 1));
  if not (ora <@ prima and prima <@ ora)
     and not (tg_op = 'UPDATE' and ora <@ public.futsal_elementi(old.formazione) and public.futsal_elementi(old.formazione) <@ ora) then
    if not exists (select 1 from public.futsal_quotazioni where giornata = new.giornata) then
      raise exception 'Mercato chiuso: le quotazioni di questa giornata arrivano con i referti di quella prima';
    end if;
    select count(*) - count(q.id), coalesce(sum(q.valore), 0) into mancano, spesa
      from unnest(ora) e(id) left join public.futsal_quotazioni q on q.giornata = new.giornata and q.id = e.id;
    if mancano > 0 then raise exception 'Un giocatore della rosa non ha ancora una quotazione'; end if;
    patrimonio := public.futsal_patrimonio(new.user_id, new.giornata);
    if spesa > patrimonio then raise exception 'Crediti insufficienti: la rosa costa %, ne hai %',
      replace(to_char(spesa, 'FM9990.0'), '.', ','), replace(to_char(patrimonio, 'FM9990.0'), '.', ','); end if;
  end if;
  return new;
end $$;
drop trigger if exists futsal_formazione_valida on public.futsal_formazioni;
create trigger futsal_formazione_valida before insert or update on public.futsal_formazioni
  for each row execute function public.futsal_formazione_valida();
