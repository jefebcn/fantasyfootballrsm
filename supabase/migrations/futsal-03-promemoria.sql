-- =====================================================================
-- FUTSAL 03 — Il promemoria della formazione futsal (FUTSAL.md, punto 17
-- del giro «utente nuovo» del 26/10)
--
-- Come il calcio (009): la funzione promemoria, il giorno prima della
-- chiusura, chiede al database chi avvisare. Qui sono gli iscritti al
-- FantaFutsal senza formazione per quella giornata, con un telefono iscritto
-- alle notifiche. Ognuno una volta sola per giornata e telefono: il segno lo
-- mette questa funzione nella stessa istruzione che restituisce l'elenco, cosi'
-- due corse sovrapposte non spediscono due volte.
--
-- Si può rieseguire. La usa solo la funzione promemoria (service_role).
-- =====================================================================

create table if not exists public.futsal_promemoria_inviati (
  giornata int not null check (giornata between 1 and 40),
  user_id text not null references public.futsal_iscritti(user_id) on delete cascade,
  endpoint text not null,
  inviato_at timestamptz not null default now(),
  primary key (giornata, user_id, endpoint)
);
alter table public.futsal_promemoria_inviati enable row level security;

create or replace function public.futsal_da_avvisare(p_giornata int)
returns table (user_id text, endpoint text, p256dh text, auth text, squadra text)
language sql volatile security definer set search_path = public as $$
  with candidati as (
    select distinct s.user_id, s.endpoint, s.p256dh, s.auth, i.squadra
      from public.futsal_iscritti i
      join public.push_subscriptions s on s.user_id = i.user_id
     where s.failed_at is null
       and not exists (select 1 from public.futsal_formazioni f where f.user_id = i.user_id and f.giornata = p_giornata)
  ), nuovi as (
    insert into public.futsal_promemoria_inviati (giornata, user_id, endpoint)
    select p_giornata, c.user_id, c.endpoint from candidati c
    on conflict (giornata, user_id, endpoint) do nothing
    returning user_id, endpoint
  )
  select c.user_id, c.endpoint, c.p256dh, c.auth, c.squadra
    from candidati c join nuovi n on n.user_id = c.user_id and n.endpoint = c.endpoint
$$;
revoke all on function public.futsal_da_avvisare(int) from public, anon, authenticated;

-- Un invio non riuscito per un guasto passeggero: si toglie il segno, cosi' la
-- corsa dopo ci riprova (come promemoria_da_rifare per il calcio).
create or replace function public.futsal_promemoria_da_rifare(p_giornata int, p_endpoints text[])
returns int
language sql volatile security definer set search_path = public as $$
  with tolti as (
    delete from public.futsal_promemoria_inviati
     where giornata = p_giornata and endpoint = any(p_endpoints)
    returning 1
  ) select count(*)::int from tolti
$$;
revoke all on function public.futsal_promemoria_da_rifare(int, text[]) from public, anon, authenticated;
