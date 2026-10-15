-- =====================================================================
-- 041 — I giocatori: chi chiede di non comparire, chi aderisce, nomi brevi
--
-- Da eseguire DOPO la 032 (interruttori) e la 033 (proprietario).
-- Si può rieseguire.
--
-- PERCHÉ (Alex, 15/10, prima dell'incontro con la FSGC). Nomi e prestazioni
-- dei calciatori sono dati personali pubblici, usati per descrivere le
-- partite. Tre strumenti pronti, spenti finché non servono:
--
-- 1. giocatori_esclusi: chi chiede di non comparire. Nell'app diventa
--    «Giocatore N», con ruolo e squadra; formazioni e punti restano.
-- 2. adesioni_giocatori: la pagina #/giocatori, aperta a chiunque senza
--    account. Un calciatore può dire «ci sto» oppure «toglietemi».
--    Si scrive soltanto: legge solo chi amministra.
-- 3. l'interruttore nomi_brevi: nomi mostrati come iniziali («G.V.»).
--    Si accende dalla console, come la modalità prudente.
-- =====================================================================

-- ------------------------------------------------- 1. giocatori esclusi
create table if not exists public.giocatori_esclusi (
  player_id  text primary key,
  nota       text check (char_length(nota) <= 300),
  created_at timestamptz not null default now()
);
alter table public.giocatori_esclusi enable row level security;
revoke all on table public.giocatori_esclusi from public, anon, authenticated;
-- tutti devono saperlo, anche senza account: è quello che l'app NON mostra
grant select on table public.giocatori_esclusi to anon, authenticated;
grant insert, update, delete on table public.giocatori_esclusi to authenticated;
drop policy if exists esclusi_lettura on public.giocatori_esclusi;
create policy esclusi_lettura on public.giocatori_esclusi for select to anon, authenticated using (true);
drop policy if exists esclusi_admin on public.giocatori_esclusi;
create policy esclusi_admin on public.giocatori_esclusi for all to authenticated
  using (public.is_admin()) with check (public.is_admin());


-- ---------------------------------------------- 2. adesioni e richieste
create table if not exists public.adesioni_giocatori (
  id         bigserial primary key,
  nome       text not null check (char_length(btrim(nome)) between 2 and 80),
  squadra    text check (char_length(squadra) <= 60),
  scelta     text not null check (scelta in ('aderisco', 'escludimi')),
  contatto   text check (char_length(contatto) <= 120),
  nota       text check (char_length(nota) <= 500),
  letta      boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.adesioni_giocatori enable row level security;
revoke all on table public.adesioni_giocatori from public, anon, authenticated;
grant insert on table public.adesioni_giocatori to anon, authenticated;
grant select, update, delete on table public.adesioni_giocatori to authenticated;
grant usage on sequence public.adesioni_giocatori_id_seq to anon, authenticated;
drop policy if exists adesioni_scrive_chiunque on public.adesioni_giocatori;
create policy adesioni_scrive_chiunque on public.adesioni_giocatori for insert to anon, authenticated
  with check (letta = false);
drop policy if exists adesioni_admin on public.adesioni_giocatori;
create policy adesioni_admin on public.adesioni_giocatori for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Un modulo aperto a tutti si può riempire di spazzatura: oltre 60 invii
-- nell'ultima ora il database dice di riprovare più tardi.
create or replace function public.adesioni_freno() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.adesioni_giocatori where created_at > now() - interval '1 hour') >= 60 then
    raise exception 'Troppe richieste in questo momento: riprova fra un po''';
  end if;
  return new;
end $$;
-- e' un trigger: nessuno la deve poter chiamare a mano
revoke execute on function public.adesioni_freno() from public, anon, authenticated;
drop trigger if exists adesioni_freno on public.adesioni_giocatori;
create trigger adesioni_freno before insert on public.adesioni_giocatori
  for each row execute function public.adesioni_freno();


-- ------------------------------------------------------ 3. nomi brevi
insert into public.app_interruttori (chiave, acceso) values ('nomi_brevi', false)
on conflict (chiave) do nothing;


-- Controllo: tutto c'è e tutto è spento.
select (select count(*) from public.giocatori_esclusi) as esclusi,
       (select count(*) from public.adesioni_giocatori) as adesioni,
       (select acceso from public.app_interruttori where chiave = 'nomi_brevi') as nomi_brevi_acceso;
