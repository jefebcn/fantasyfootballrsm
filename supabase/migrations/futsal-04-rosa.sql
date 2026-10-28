-- =====================================================================
-- FUTSAL 04 — Rosa, crediti e mercato in stile Dunkest (FUTSAL.md § 13)
--
-- Solo sul ramo `futsal`. Si può rieseguire. Cambia il FantaFutsal da
-- «ogni settimana cinque giocatori scelti fra tutti» a una rosa vera:
--   la Porta di una squadra e otto giocatori di movimento (4 D e 4 A),
--   comprati con 70 crediti, al massimo 2 della stessa squadra;
--   ogni giornata quattro in campo secondo lo schema (1-3, 2-2, 3-1),
--   un sesto uomo e tre in panchina; capitano e vice fra i quattro.
--
-- La formazione resta una riga per giornata (futsal_formazioni), ma la
-- squadra non sparisce: alla giornata dopo vale l'ultima consegnata. Per
-- questo il database deve sapere quanto costano i giocatori, giornata per
-- giornata: futsal_quotazioni, riempita da futsal-02-dati.sql (generato).
--
-- Il database controlla le cose che il telefono non puo' garantire:
--   la rosa e la formazione rispettano le regole (come prima);
--   chi cambia la rosa ha i crediti per farlo;
--   la rosa si cambia solo a quotazioni definitive (mercato aperto).
-- I punti, come sempre, li calcolano i telefoni dai referti.
-- =====================================================================

alter table public.futsal_iscritti add column if not exists club_cuore text;

create table if not exists public.futsal_quotazioni (
  giornata int not null check (giornata between 1 and 41),
  id text not null,            -- id del giocatore FSGC, o 'P:<club>' per una Porta
  valore numeric(4,1) not null check (valore > 0),
  primary key (giornata, id)
);
alter table public.futsal_quotazioni enable row level security;
drop policy if exists futsal_quotazioni_read on public.futsal_quotazioni;
create policy futsal_quotazioni_read on public.futsal_quotazioni for select to authenticated using (true);

-- Gli elementi comprati: la Porta e gli otto della rosa.
create or replace function public.futsal_elementi(f jsonb) returns text[]
language sql immutable set search_path = public as $$
  select case when f is null then '{}'::text[] else
    array(select 'P:' || (f ->> 'porta')
          union all select x from jsonb_array_elements_text(coalesce(f -> 'D', '[]')) x
          union all select x from jsonb_array_elements_text(coalesce(f -> 'A', '[]')) x)
  end
$$;

-- La formazione in vigore alla giornata n: l'ultima consegnata fino a n.
create or replace function public.futsal_in_vigore(u text, n int) returns jsonb
language sql stable security definer set search_path = public as $$
  select formazione from public.futsal_formazioni where user_id = u and giornata <= n order by giornata desc limit 1
$$;

-- Il bilancio, come bilancio() in src/futsal-valori.js: budget (70) piu' le
-- plusvalenze dei giocatori avuti in rosa, dalla prima giornata con una
-- squadra fino alla n esclusa.
create or replace function public.futsal_patrimonio(u text, n int) returns numeric
language plpgsql stable security definer set search_path = public as $$
declare primo int; k int; p numeric := 70; d numeric;
begin
  select min(giornata) into primo from public.futsal_formazioni where user_id = u and giornata < n;
  if primo is null then return p; end if;
  for k in primo .. n - 1 loop
    select coalesce(sum(b.valore - a.valore), 0) into d
      from unnest(public.futsal_elementi(public.futsal_in_vigore(u, k))) e(id)
      join public.futsal_quotazioni a on a.giornata = k and a.id = e.id
      join public.futsal_quotazioni b on b.giornata = k + 1 and b.id = e.id;
    p := p + d;
  end loop;
  return p;
end $$;

-- Le regole, le stesse di controllaFormazione in src/futsal-engine.js. Un
-- giocatore che il listone del server non conosce ancora non blocca la
-- consegna dei ruoli; i crediti invece si contano sempre: senza quotazione
-- non si compra.
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
  if sesto is null or not sesto = any(rosa) or sesto = any(tit) then raise exception 'Il sesto uomo va scelto fra chi non e'' in campo'; end if;
  if cap is null or not cap = any(tit) then raise exception 'Il capitano va scelto fra i quattro in campo'; end if;
  if vice is null or not vice = any(tit) or vice = cap then raise exception 'Il vice va scelto fra i quattro in campo, diverso dal capitano'; end if;
  select count(*) into noti from public.futsal_giocatori where id = any(rosa);
  if noti = 8 then
    if exists (select 1 from public.futsal_giocatori where id = any(rd) and ruolo <> 'D')
       or exists (select 1 from public.futsal_giocatori where id = any(ra) and ruolo <> 'A') then
      raise exception 'Un giocatore e'' nel ruolo sbagliato';
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
    if spesa > patrimonio then raise exception 'Crediti insufficienti: la rosa costa %, ne hai %', spesa, patrimonio; end if;
  end if;
  return new;
end $$;
drop trigger if exists futsal_formazione_valida on public.futsal_formazioni;
create trigger futsal_formazione_valida before insert or update on public.futsal_formazioni
  for each row execute function public.futsal_formazione_valida();
