-- =====================================================================
-- 044 — Il consenso dei calciatori: sponsor a parte, minorenni, verifica
--
-- Da eseguire DOPO la 041 (adesioni_giocatori). Si può rieseguire.
--
-- PERCHÉ (Alex, 17/10). La pagina #/giocatori della 041 raccoglieva un «ci
-- sto» o un «toglietemi», ma senza sapere se a scrivere era davvero il
-- calciatore, e con un'unica scelta per tutto. Per essere un consenso che
-- regge servono quattro cose in più:
--   1. il «sì» agli sponsor separato dal «sì» al gioco, e facoltativo;
--   2. sotto i 18 anni, il genitore che è d'accordo;
--   3. una verifica: un codice che il calciatore manda in DM dal suo
--      Instagram (o che conferma la sua società). Finché non è verificato,
--      il consenso non vale;
--   4. la versione del testo che ha letto, come prova.
--
-- Chi è verificato e ha detto sì ha il bollino «Ha aderito» sulla sua
-- scheda: giocatori_aderenti() dice solo QUALI giocatori, niente altro.
-- =====================================================================

alter table public.adesioni_giocatori
  add column if not exists sponsor         boolean not null default false,
  add column if not exists maggiorenne     boolean,
  add column if not exists genitore        text check (char_length(genitore) <= 80),
  add column if not exists instagram       text check (char_length(instagram) <= 60),
  add column if not exists codice          text check (codice ~ '^FT-[A-Z0-9]{4}$'),
  add column if not exists versione        text check (char_length(versione) <= 20),
  add column if not exists stato           text not null default 'attesa',
  add column if not exists verificato_come text,
  add column if not exists verificato_at   timestamptz,
  add column if not exists player_id       text;

-- i vincoli a parte, con un nome, cosi' la rieseguita non li duplica
alter table public.adesioni_giocatori drop constraint if exists adesioni_stato;
alter table public.adesioni_giocatori add constraint adesioni_stato
  check (stato in ('attesa', 'verificato', 'respinto'));
alter table public.adesioni_giocatori drop constraint if exists adesioni_come;
alter table public.adesioni_giocatori add constraint adesioni_come
  check (verificato_come is null or verificato_come in ('instagram', 'societa'));
-- gli sponsor solo per chi ha detto si'
alter table public.adesioni_giocatori drop constraint if exists adesioni_sponsor;
alter table public.adesioni_giocatori add constraint adesioni_sponsor
  check (not sponsor or scelta = 'aderisco');
-- un minorenne che aderisce ha un genitore indicato
alter table public.adesioni_giocatori drop constraint if exists adesioni_genitore;
alter table public.adesioni_giocatori add constraint adesioni_genitore
  check (maggiorenne is not false or scelta = 'escludimi' or char_length(btrim(coalesce(genitore, ''))) >= 3);

create unique index if not exists adesioni_codice on public.adesioni_giocatori (codice) where codice is not null;

-- Chi passa scrive una richiesta nuova e basta: non si da' da solo lo stato
-- di verificato, ne' si lega a un giocatore. Lo fa chi amministra.
drop policy if exists adesioni_scrive_chiunque on public.adesioni_giocatori;
create policy adesioni_scrive_chiunque on public.adesioni_giocatori for insert to anon, authenticated
  with check (letta = false and stato = 'attesa' and verificato_come is null
              and verificato_at is null and player_id is null);

-- I giocatori col bollino: l'ultima richiesta verificata di ognuno e' un si'.
create or replace function public.giocatori_aderenti() returns setof text
language sql stable security definer set search_path = public as $$
  select x.player_id from (
    select distinct on (a.player_id) a.player_id, a.scelta
      from public.adesioni_giocatori a
     where a.stato = 'verificato' and a.player_id is not null
     order by a.player_id, a.verificato_at desc nulls last, a.id desc
  ) x where x.scelta = 'aderisco'
$$;
revoke all on function public.giocatori_aderenti() from public;
grant execute on function public.giocatori_aderenti() to anon, authenticated;

-- Controllo: le colonne ci sono, nessuno e' gia' verificato.
select count(*) as richieste,
       count(*) filter (where stato = 'verificato') as verificate,
       (select count(*) from public.giocatori_aderenti()) as col_bollino
  from public.adesioni_giocatori;
