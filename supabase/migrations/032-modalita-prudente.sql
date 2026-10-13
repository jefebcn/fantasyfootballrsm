-- =====================================================================
-- 032 — Modalità prudente: un interruttore per mettersi in regola subito
--
-- Da eseguire DOPO le migrazioni fino alla 031. Si può rieseguire.
--
-- Alex, 13/10: in federazione stanno guardando l'app, e il punto aperto sono
-- i nomi e i dati degli atleti presi dal sito FSGC senza un accordo. Se
-- arrivasse una richiesta di toglierli, serve poterlo fare in un minuto e
-- dal telefono, senza un rilascio e senza chiudere l'app.
--
-- Con l'interruttore acceso:
--   - l'import automatico dal sito FSGC si ferma (scripts/importa-fsgc.py
--     legge questa riga prima di cominciare): i dati li mette il Giudice;
--   - gli highlights non si aprono più dentro l'app, solo su YouTube;
--   - lo spazio sponsor sparisce.
-- Le leghe, le squadre e i punti restano dove sono.
--
-- Una tabella di interruttori e non una colonna da qualche parte: il
-- prossimo che servirà non avrà bisogno di un'altra migrazione.
-- =====================================================================

create table if not exists public.app_interruttori (
  chiave text primary key,
  acceso boolean not null default false,
  cambiato_at timestamptz not null default now(),
  -- text e non uuid: la 001 ha convertito le colonne dell'identita' a text
  cambiato_da text references public.profiles(id)
);

alter table public.app_interruttori enable row level security;

-- CHI LO LEGGE: chiunque, anche senza account. Lo leggono l'app prima del
-- login e l'import su GitHub con la chiave pubblica: non c'e' niente di
-- riservato, e' un si' o un no.
drop policy if exists interruttori_lettura on public.app_interruttori;
create policy interruttori_lettura on public.app_interruttori
  for select to anon, authenticated using (true);

-- CHI LO CAMBIA: solo chi amministra l'app.
drop policy if exists interruttori_admin on public.app_interruttori;
create policy interruttori_admin on public.app_interruttori
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

insert into public.app_interruttori (chiave, acceso) values ('prudente', false)
on conflict (chiave) do nothing;
