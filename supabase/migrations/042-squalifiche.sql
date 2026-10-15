-- =====================================================================
-- 042 — Le squalifiche: il bollino «squalificato» in rosa e in formazione
--
-- Da eseguire DOPO lo schema (is_judge) e la 014 (is_admin).
-- Si può rieseguire.
--
-- PERCHÉ (Alex, 15/10, su domanda di un utente). Probabili formazioni
-- ufficiali per il Campionato Sammarinese non ne esistono: chi fa la
-- formazione non sa chi è squalificato e schiera un giocatore che prende
-- S.V. Le squalifiche le pubblica la FSGC nei comunicati del giudice
-- sportivo; qui le scrive il Giudice Dati.
--
-- COME FUNZIONA.
-- - Chi è espulso (rosso diretto o doppio giallo) in una giornata è
--   squalificato nella giornata dopo: questo lo calcola l'app dagli eventi,
--   senza che nessuno scriva niente.
-- - Tutto il resto (più giornate, somma di gialli) lo scrive il Giudice Dati
--   in questa tabella, giornata per giornata.
-- - Una riga con squalificato = false toglie il bollino automatico (per
--   esempio se la FSGC ha annullato l'espulsione).
-- =====================================================================

create table if not exists public.squalifiche (
  player_id    text not null,
  matchday     int  not null check (matchday between 1 and 60),
  squalificato boolean not null default true,
  nota         text check (char_length(nota) <= 200),
  created_at   timestamptz not null default now(),
  created_by   text references public.profiles(id) on delete set null,
  primary key (player_id, matchday)
);
alter table public.squalifiche enable row level security;
revoke all on table public.squalifiche from public, anon, authenticated;
-- è un'informazione pubblica: la vede chiunque apre l'app
grant select on table public.squalifiche to anon, authenticated;
grant insert, update, delete on table public.squalifiche to authenticated;
drop policy if exists squalifiche_lettura on public.squalifiche;
create policy squalifiche_lettura on public.squalifiche for select to anon, authenticated using (true);
drop policy if exists squalifiche_giudice on public.squalifiche;
create policy squalifiche_giudice on public.squalifiche for all to authenticated
  using (public.is_judge() or public.is_admin())
  with check (public.is_judge() or public.is_admin());

-- Controllo: la tabella c'è (all'inizio vuota: le squalifiche da espulsione
-- le calcola l'app da sola).
select count(*) as squalifiche_scritte from public.squalifiche;
