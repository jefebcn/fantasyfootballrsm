-- =====================================================================
-- FUTSAL 12 — Risultati provvisori inseriti a mano (Alex, 23/11/2026)
--
-- Si può rieseguire. La FSGC pubblica risultato e referto del futsal il
-- giorno dopo; le società mettono il finale sui social la sera stessa. Un
-- amministratore lo scrive qui, l'app lo mostra con «voti in arrivo».
-- Solo da vedere: punti, classifiche e giornata giocata aspettano il referto
-- FSGC, e quando il referto c'è il risultato a mano non si mostra più.
--
-- fonte: 'admin' a mano; 'instagram' per un eventuale lettore automatico dei
-- post delle società (che scriverà con una funzione sua, non da qui).
-- =====================================================================

create table if not exists public.futsal_risultati_provvisori (
  giornata int not null check (giornata between 1 and 40),
  casa text not null,
  ospite text not null,
  gc int not null check (gc between 0 and 99),
  go int not null check (go between 0 and 99),
  fonte text not null default 'admin' check (fonte in ('admin', 'instagram')),
  link text check (link is null or link ~ '^https://'),
  aggiornato_da text default public.current_user_id(),
  aggiornato_at timestamptz not null default now(),
  primary key (giornata, casa)
);

alter table public.futsal_risultati_provvisori enable row level security;

drop policy if exists futsal_risultati_provvisori_leggi on public.futsal_risultati_provvisori;
create policy futsal_risultati_provvisori_leggi on public.futsal_risultati_provvisori
  for select to authenticated using (true);

drop policy if exists futsal_risultati_provvisori_scrivi on public.futsal_risultati_provvisori;
create policy futsal_risultati_provvisori_scrivi on public.futsal_risultati_provvisori
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.futsal_risultati_provvisori from public, anon;
grant select, insert, update, delete on public.futsal_risultati_provvisori to authenticated;
