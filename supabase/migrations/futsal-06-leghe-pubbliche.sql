-- =====================================================================
-- FUTSAL 06 — Leghe pubbliche, punti dalla nascita della lega, accenti
--
-- Solo sul ramo `futsal`. Si può rieseguire. Tre cose (Alex, 21/11/2026):
--
-- 1. LA LEGA PUBBLICA, come nel calcio (013, 014): la apre solo chi
--    amministra l'app, ci entra chiunque dall'elenco senza codice, ha un
--    massimo di partecipanti e dei premi scritti da chi l'ha aperta. Va a
--    somma di punti: con cento squadre il testa a testa non vuol dire niente.
--    Nel futsal la rosa è già di ognuno (70 crediti per tutti, giocatori non
--    esclusivi), quindi non servono crediti né negozio di lega.
--
-- 2. LA LEGA A SOMMA CONTA DALLA SUA PRIMA GIORNATA. Prima sommava tutte le
--    giornate giocate dalla 1ª: chi entrava in una lega appena creata si
--    trovava davanti chi aveva giocato da settembre. Ora ogni lega ricorda
--    dalla_giornata (la prima giornata ancora da chiudere quando nasce) e la
--    classifica parte da lì. Le leghe nate prima restano senza: contano
--    dalla 1ª, come prima.
--
-- 3. Gli accenti nei messaggi che leggono gli utenti (era «e' gia'»).
-- =====================================================================

alter table public.futsal_leghe
  add column if not exists pubblica boolean not null default false,
  add column if not exists max_membri int not null default 50,
  add column if not exists premi jsonb not null default '[]'::jsonb,
  add column if not exists dalla_giornata int;

alter table public.futsal_leghe drop constraint if exists futsal_leghe_max_ck;
alter table public.futsal_leghe add constraint futsal_leghe_max_ck check (max_membri between 2 and 1000);
-- una lega pubblica va a somma: il calendario fisso fra cento squadre non regge
alter table public.futsal_leghe drop constraint if exists futsal_leghe_pubblica_somma_ck;
alter table public.futsal_leghe add constraint futsal_leghe_pubblica_somma_ck check (not pubblica or tipo = 'somma');

-- La prima giornata le cui formazioni non sono ancora chiuse.
create or replace function public.futsal_prossima_giornata() returns int
language sql stable security definer set search_path = public as $$
  select min(giornata) from public.futsal_lock where lock_at > now()
$$;

-- ---------------------------------------------------------------- leghe fra amici
create or replace function public.futsal_crea_lega(p_nome text, p_tipo text) returns public.futsal_leghe
language plpgsql security definer set search_path = public as $$
declare uid text := public.current_user_id(); l public.futsal_leghe; c text;
begin
  if not exists (select 1 from public.futsal_iscritti where user_id = uid) then raise exception 'Prima iscriviti al FantaFutsal'; end if;
  loop
    c := 'F' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 5));
    exit when not exists (select 1 from public.futsal_leghe where codice = c);
  end loop;
  insert into public.futsal_leghe (nome, tipo, codice, creata_da, dalla_giornata)
  values (trim(p_nome), coalesce(p_tipo, 'somma'), c, uid, public.futsal_prossima_giornata()) returning * into l;
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
  if exists (select 1 from public.futsal_membri where lega_id = l.id and user_id = uid) then return l.id; end if;
  if l.avvio_giornata is not null then raise exception 'La lega è già partita: il calendario degli scontri è fissato'; end if;
  if (select count(*) from public.futsal_membri where lega_id = l.id) >= l.max_membri then raise exception 'Lega al completo'; end if;
  insert into public.futsal_membri (lega_id, user_id) values (l.id, uid) on conflict do nothing;
  return l.id;
end $$;

create or replace function public.futsal_avvia_lega(p_lega uuid) returns int
language plpgsql security definer set search_path = public as $$
declare uid text := public.current_user_id(); l public.futsal_leghe; g int;
begin
  select * into l from public.futsal_leghe where id = p_lega for update;
  if l.id is null or l.creata_da <> uid then raise exception 'Solo chi ha creato la lega la può avviare'; end if;
  if l.avvio_giornata is not null then return l.avvio_giornata; end if;
  if (select count(*) from public.futsal_membri where lega_id = l.id) < 2 then raise exception 'Servono almeno due squadre'; end if;
  g := public.futsal_prossima_giornata();
  if g is null then raise exception 'Non ci sono più giornate da giocare'; end if;
  update public.futsal_leghe set avvio_giornata = g,
    membri_avvio = array(select user_id from public.futsal_membri where lega_id = l.id order by entrato_at, user_id)
   where id = l.id;
  return g;
end $$;

-- ---------------------------------------------------------------- leghe pubbliche
create or replace function public.futsal_crea_lega_pubblica(p_nome text, p_max int, p_premi jsonb) returns public.futsal_leghe
language plpgsql security definer set search_path = public as $$
declare uid text := public.current_user_id(); l public.futsal_leghe; c text; m int := coalesce(p_max, 200);
begin
  if not public.is_admin() then raise exception 'Le leghe pubbliche le apre chi amministra l''app'; end if;
  if not exists (select 1 from public.futsal_iscritti where user_id = uid) then raise exception 'Prima iscriviti al FantaFutsal'; end if;
  if coalesce(length(trim(p_nome)), 0) < 2 then raise exception 'Serve un nome per la lega'; end if;
  if m < 2 or m > 1000 then raise exception 'I partecipanti vanno da 2 a 1000'; end if;
  loop
    c := 'F' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 5));
    exit when not exists (select 1 from public.futsal_leghe where codice = c);
  end loop;
  insert into public.futsal_leghe (nome, tipo, codice, creata_da, pubblica, max_membri, premi, dalla_giornata)
  values (trim(p_nome), 'somma', c, uid, true, m, public.premi_validi(p_premi), public.futsal_prossima_giornata())
  returning * into l;
  insert into public.futsal_membri (lega_id, user_id) values (l.id, uid);
  return l;
end $$;

create or replace function public.futsal_entra_lega_pubblica(p_lega uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid text := public.current_user_id(); l public.futsal_leghe; n int;
begin
  if not exists (select 1 from public.futsal_iscritti where user_id = uid) then raise exception 'Prima iscriviti al FantaFutsal'; end if;
  select * into l from public.futsal_leghe where id = p_lega;
  if l.id is null then raise exception 'Lega non trovata'; end if;
  if not l.pubblica then raise exception 'Questa lega non è pubblica: serve il codice'; end if;
  if exists (select 1 from public.futsal_membri where lega_id = l.id and user_id = uid) then return l.id; end if;
  select count(*) into n from public.futsal_membri where lega_id = l.id;
  if n >= l.max_membri then raise exception 'Lega al completo (% su %)', n, l.max_membri; end if;
  insert into public.futsal_membri (lega_id, user_id) values (l.id, uid) on conflict do nothing;
  return l.id;
end $$;

-- L'elenco: security definer perché conta gli iscritti di leghe di cui chi
-- guarda non fa parte. Escono nomi di lega e numeri, non persone.
create or replace function public.futsal_leghe_pubbliche()
returns table (id uuid, nome text, premi jsonb, membri int, max_membri int, dalla_giornata int, creata timestamptz, dentro boolean)
language sql stable security definer set search_path = public as $$
  select l.id, l.nome, l.premi,
         (select count(*)::int from public.futsal_membri m where m.lega_id = l.id),
         l.max_membri, l.dalla_giornata, l.created_at,
         exists (select 1 from public.futsal_membri m where m.lega_id = l.id and m.user_id = public.current_user_id())
    from public.futsal_leghe l
   where l.pubblica
   order by l.created_at desc
   limit 100
$$;

revoke execute on function public.futsal_prossima_giornata() from public, anon;
grant execute on function public.futsal_prossima_giornata() to authenticated;
revoke execute on function public.futsal_crea_lega_pubblica(text, int, jsonb), public.futsal_entra_lega_pubblica(uuid), public.futsal_leghe_pubbliche() from public, anon;
grant execute on function public.futsal_crea_lega(text, text), public.futsal_entra_lega(text), public.futsal_avvia_lega(uuid),
  public.futsal_crea_lega_pubblica(text, int, jsonb), public.futsal_entra_lega_pubblica(uuid), public.futsal_leghe_pubbliche() to authenticated;
