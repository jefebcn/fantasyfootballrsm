-- =====================================================================
-- FUTSAL 01 — Il FantaFutsal sul server (FUTSAL.md)
--
-- Solo sul ramo `futsal`. Si può rieseguire. Non tocca niente del calcio:
-- tabelle e funzioni nuove, tutte con il prefisso futsal_.
--
-- COSA C'E'.
--   futsal_iscritti   chi gioca al FantaFutsal (un account, una squadra)
--   futsal_lock       quando si chiudono le formazioni di ogni giornata
--   futsal_giocatori  il listone, per controllare ruoli e squadre
--   futsal_formazioni una formazione per iscritto per giornata
--   futsal_leghe      i gruppi di amici (classifica a somma o testa a testa)
--   futsal_membri     chi sta in quale gruppo
--
-- I PUNTEGGI NON STANNO QUI. Come nel calcio li calcolano i telefoni, dai
-- referti FSGC che l'app porta con se' (src/futsal-dati.js) e dalle
-- formazioni lette da qui. Il database garantisce le due cose che i telefoni
-- non possono garantire: che una formazione non cambi dopo la chiusura, e che
-- rispetti le regole (§§ 3-4, 8).
-- =====================================================================

-- ---------------------------------------------------------------- iscritti
create table if not exists public.futsal_iscritti (
  user_id text primary key references public.profiles(id) on delete cascade,
  squadra text not null check (length(trim(squadra)) between 2 and 30),
  colore text not null default '#2B4C7E' check (colore ~ '^#[0-9A-Fa-f]{6}$'),
  iniziali text not null default '' check (length(iniziali) <= 3),
  created_at timestamptz not null default now()
);
alter table public.futsal_iscritti enable row level security;
drop policy if exists futsal_iscritti_read on public.futsal_iscritti;
create policy futsal_iscritti_read on public.futsal_iscritti for select to authenticated using (true);
drop policy if exists futsal_iscritti_insert on public.futsal_iscritti;
create policy futsal_iscritti_insert on public.futsal_iscritti for insert to authenticated
  with check (user_id = public.current_user_id());
drop policy if exists futsal_iscritti_update on public.futsal_iscritti;
create policy futsal_iscritti_update on public.futsal_iscritti for update to authenticated
  using (user_id = public.current_user_id()) with check (user_id = public.current_user_id());
drop policy if exists futsal_iscritti_delete on public.futsal_iscritti;
create policy futsal_iscritti_delete on public.futsal_iscritti for delete to authenticated
  using (user_id = public.current_user_id());

-- ---------------------------------------------------------------- chiusure
-- Le righe arrivano da futsal-02-dati.sql (generato dal calendario FSGC) e,
-- se la FSGC sposta una partita, da futsal_allinea_lock chiamata da chi
-- amministra l'app.
create table if not exists public.futsal_lock (
  giornata int primary key check (giornata between 1 and 40),
  lock_at timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.futsal_lock enable row level security;
drop policy if exists futsal_lock_read on public.futsal_lock;
create policy futsal_lock_read on public.futsal_lock for select to authenticated using (true);

create or replace function public.futsal_chiusa(n int) returns boolean
language sql stable security definer set search_path = public as $$
  -- senza una riga per la giornata la si considera chiusa: meglio una
  -- formazione rifiutata che una consegnata a partite gia' giocate
  select coalesce((select lock_at <= now() from public.futsal_lock where giornata = n), true)
$$;

create or replace function public.futsal_allinea_lock(p jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  if not (public.is_admin() or public.is_judge()) then raise exception 'Solo chi amministra'; end if;
  for r in select (x ->> 'giornata')::int g, (x ->> 'lock_at')::timestamptz t from jsonb_array_elements(p) x loop
    insert into public.futsal_lock (giornata, lock_at) values (r.g, r.t)
      on conflict (giornata) do update set lock_at = excluded.lock_at, updated_at = now()
      where futsal_lock.lock_at is distinct from excluded.lock_at;
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------- listone
create table if not exists public.futsal_giocatori (
  id text primary key,
  club text not null,
  ruolo text not null check (ruolo in ('P', 'D', 'A'))
);
alter table public.futsal_giocatori enable row level security;
drop policy if exists futsal_giocatori_read on public.futsal_giocatori;
create policy futsal_giocatori_read on public.futsal_giocatori for select to authenticated using (true);

-- ---------------------------------------------------------------- formazioni
-- formazione: { modulo, porta, titolari: [id], panchina: [idD, idA], capitano, vice }
create table if not exists public.futsal_formazioni (
  user_id text not null references public.futsal_iscritti(user_id) on delete cascade,
  giornata int not null check (giornata between 1 and 40),
  formazione jsonb not null,
  consegnata_at timestamptz not null default now(),
  primary key (user_id, giornata)
);
alter table public.futsal_formazioni enable row level security;

-- La propria si vede sempre; quelle degli altri solo a giornata chiusa, come
-- nel calcio: prima sarebbe copiare.
drop policy if exists futsal_formazioni_read on public.futsal_formazioni;
create policy futsal_formazioni_read on public.futsal_formazioni for select to authenticated
  using (user_id = public.current_user_id() or public.futsal_chiusa(giornata));
drop policy if exists futsal_formazioni_write on public.futsal_formazioni;
create policy futsal_formazioni_write on public.futsal_formazioni for insert to authenticated
  with check (user_id = public.current_user_id() and not public.futsal_chiusa(giornata));
drop policy if exists futsal_formazioni_update on public.futsal_formazioni;
create policy futsal_formazioni_update on public.futsal_formazioni for update to authenticated
  using (user_id = public.current_user_id() and not public.futsal_chiusa(giornata))
  with check (user_id = public.current_user_id() and not public.futsal_chiusa(giornata));
drop policy if exists futsal_formazioni_delete on public.futsal_formazioni;
create policy futsal_formazioni_delete on public.futsal_formazioni for delete to authenticated
  using (user_id = public.current_user_id() and not public.futsal_chiusa(giornata));

-- Le regole della formazione (FUTSAL.md §§ 3-4, 8), le stesse di
-- controllaFormazione in src/futsal-engine.js. Un giocatore che il listone
-- del server non conosce ancora (entrato a stagione in corso) non blocca la
-- consegna: si controlla solo cio' che si sa.
create or replace function public.futsal_formazione_valida() returns trigger
language plpgsql set search_path = public as $$
declare
  f jsonb := new.formazione;
  modulo text := f ->> 'modulo';
  porta text := f ->> 'porta';
  tit text[]; pan text[]; tutti text[];
  cap text := nullif(f ->> 'capitano', '');
  vice text := nullif(f ->> 'vice', '');
  noti int; d int; a int; pd int; pa int; club_doppi int;
begin
  if current_user not in ('anon', 'authenticated') then return new; end if;
  new.consegnata_at := now();
  if modulo not in ('2-2', '3-1') then raise exception 'Modulo non valido: %', modulo; end if;
  if porta is null or not exists (select 1 from public.futsal_giocatori where club = porta) then
    raise exception 'Porta non valida';
  end if;
  select coalesce(array_agg(x), '{}') into tit from jsonb_array_elements_text(coalesce(f -> 'titolari', '[]')) x;
  select coalesce(array_agg(x), '{}') into pan from jsonb_array_elements_text(coalesce(f -> 'panchina', '[]')) x;
  tutti := tit || pan;
  if cardinality(tit) <> 4 then raise exception 'Servono quattro titolari di movimento'; end if;
  if cardinality(pan) <> 2 then raise exception 'In panchina servono due giocatori'; end if;
  if (select count(distinct x) from unnest(tutti) x) <> cardinality(tutti) then raise exception 'Un giocatore compare due volte'; end if;
  if cap is null or not cap = any(tit) then raise exception 'Il capitano va scelto fra i titolari'; end if;
  if vice is null or not vice = any(tit) or vice = cap then raise exception 'Il vice va scelto fra i titolari, diverso dal capitano'; end if;
  select count(*) into noti from public.futsal_giocatori where id = any(tutti);
  if noti = cardinality(tutti) then
    select count(*) filter (where ruolo = 'D'), count(*) filter (where ruolo = 'A') into d, a
      from public.futsal_giocatori where id = any(tit);
    if (modulo = '2-2' and (d, a) <> (2, 2)) or (modulo = '3-1' and (d, a) <> (3, 1)) then
      raise exception 'I ruoli non tornano col modulo %', modulo;
    end if;
    select count(*) filter (where ruolo = 'D'), count(*) filter (where ruolo = 'A') into pd, pa
      from public.futsal_giocatori where id = any(pan);
    if (pd, pa) <> (1, 1) then raise exception 'In panchina servono un difensore e un attaccante'; end if;
    select count(*) - count(distinct club) into club_doppi
      from (select club from public.futsal_giocatori where id = any(tutti) union all select porta) c;
    if club_doppi > 0 then raise exception 'Al massimo un giocatore per squadra, Porta e panchina comprese'; end if;
  end if;
  return new;
end $$;
drop trigger if exists futsal_formazione_valida on public.futsal_formazioni;
create trigger futsal_formazione_valida before insert or update on public.futsal_formazioni
  for each row execute function public.futsal_formazione_valida();

-- ---------------------------------------------------------------- leghe
-- Un gruppo di amici sulle stesse formazioni (FUTSAL.md § 10.2-bis). Niente
-- rose: chi crea sceglie solo come si fa la classifica. Il testa a testa ha
-- bisogno di un calendario fisso: lo si fissa con futsal_avvia_lega, che
-- congela l'elenco dei membri e la giornata da cui si parte.
create table if not exists public.futsal_leghe (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 2 and 40),
  tipo text not null default 'somma' check (tipo in ('somma', 'testa')),
  codice text not null unique,
  creata_da text not null references public.profiles(id) on delete cascade,
  avvio_giornata int,
  membri_avvio text[],
  created_at timestamptz not null default now()
);
create table if not exists public.futsal_membri (
  lega_id uuid not null references public.futsal_leghe(id) on delete cascade,
  user_id text not null references public.futsal_iscritti(user_id) on delete cascade,
  entrato_at timestamptz not null default now(),
  primary key (lega_id, user_id)
);
alter table public.futsal_leghe enable row level security;
alter table public.futsal_membri enable row level security;

create or replace function public.futsal_in_lega(l uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.futsal_membri where lega_id = l and user_id = public.current_user_id())
$$;
drop policy if exists futsal_leghe_read on public.futsal_leghe;
create policy futsal_leghe_read on public.futsal_leghe for select to authenticated using (public.futsal_in_lega(id));
drop policy if exists futsal_membri_read on public.futsal_membri;
create policy futsal_membri_read on public.futsal_membri for select to authenticated using (public.futsal_in_lega(lega_id));
-- si scrive solo dalle funzioni qui sotto

create or replace function public.futsal_crea_lega(p_nome text, p_tipo text) returns public.futsal_leghe
language plpgsql security definer set search_path = public as $$
declare uid text := public.current_user_id(); l public.futsal_leghe; c text;
begin
  if not exists (select 1 from public.futsal_iscritti where user_id = uid) then raise exception 'Prima iscriviti al FantaFutsal'; end if;
  loop
    -- md5 e random() sono di Postgres: gen_random_bytes su Supabase sta nello
    -- schema extensions, fuori dal search_path di questa funzione
    c := 'F' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 5));
    exit when not exists (select 1 from public.futsal_leghe where codice = c);
  end loop;
  insert into public.futsal_leghe (nome, tipo, codice, creata_da) values (trim(p_nome), coalesce(p_tipo, 'somma'), c, uid) returning * into l;
  insert into public.futsal_membri (lega_id, user_id) values (l.id, uid);
  return l;
end $$;

create or replace function public.futsal_entra_lega(p_codice text) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid text := public.current_user_id(); l public.futsal_leghe;
begin
  if not exists (select 1 from public.futsal_iscritti where user_id = uid) then raise exception 'Prima iscriviti al FantaFutsal'; end if;
  select * into l from public.futsal_leghe where codice = upper(trim(p_codice));
  if l.id is null then raise exception 'Codice non trovato'; end if;
  if l.avvio_giornata is not null then raise exception 'La lega e'' gia'' partita: il calendario degli scontri e'' fissato'; end if;
  if (select count(*) from public.futsal_membri where lega_id = l.id) >= 50 then raise exception 'Lega piena'; end if;
  insert into public.futsal_membri (lega_id, user_id) values (l.id, uid) on conflict do nothing;
  return l.id;
end $$;

create or replace function public.futsal_esci_lega(p_lega uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid text := public.current_user_id();
begin
  delete from public.futsal_membri where lega_id = p_lega and user_id = uid;
  -- l'ultimo che esce si porta via la lega
  delete from public.futsal_leghe l where l.id = p_lega and not exists (select 1 from public.futsal_membri m where m.lega_id = l.id);
end $$;

-- Fissa il calendario del testa a testa: chi c'e' adesso, dalla prossima
-- giornata non ancora chiusa. Solo chi l'ha creata, una volta sola.
create or replace function public.futsal_avvia_lega(p_lega uuid) returns int
language plpgsql security definer set search_path = public as $$
declare uid text := public.current_user_id(); l public.futsal_leghe; g int;
begin
  select * into l from public.futsal_leghe where id = p_lega for update;
  if l.id is null or l.creata_da <> uid then raise exception 'Solo chi ha creato la lega la puo'' avviare'; end if;
  if l.avvio_giornata is not null then return l.avvio_giornata; end if;
  if (select count(*) from public.futsal_membri where lega_id = l.id) < 2 then raise exception 'Servono almeno due squadre'; end if;
  select min(giornata) into g from public.futsal_lock where lock_at > now();
  if g is null then raise exception 'Non ci sono piu'' giornate da giocare'; end if;
  update public.futsal_leghe set avvio_giornata = g,
    membri_avvio = array(select user_id from public.futsal_membri where lega_id = l.id order by entrato_at, user_id)
   where id = l.id;
  return g;
end $$;

grant execute on function public.futsal_crea_lega(text, text), public.futsal_entra_lega(text),
  public.futsal_esci_lega(uuid), public.futsal_avvia_lega(uuid), public.futsal_allinea_lock(jsonb)
  to authenticated;
