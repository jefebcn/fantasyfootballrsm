-- =====================================================================
-- FUTSAL 11 — L'avviso «mercato aperto» (21/11/2026)
--
-- Si può rieseguire. Il mercato di una giornata apre quando arrivano le sue
-- quotazioni, cioè coi referti della giornata prima (futsal-05): un momento
-- che nessuno sa prevedere. La funzione promemoria (ogni ora) chiede a
-- questa chi avvisare: gli iscritti con un telefono registrato, una volta
-- sola per giornata e per telefono, solo se le quotazioni ci sono e la
-- giornata non è ancora chiusa. La chiama solo il service role.
-- =====================================================================

create table if not exists public.futsal_mercato_avvisati (
  giornata int not null check (giornata between 1 and 40),
  user_id text not null references public.futsal_iscritti(user_id) on delete cascade,
  endpoint text not null,
  inviato_at timestamptz not null default now(),
  primary key (giornata, user_id, endpoint)
);
alter table public.futsal_mercato_avvisati enable row level security;

create or replace function public.futsal_mercato_da_avvisare(p_giornata int)
returns table (user_id text, endpoint text, p256dh text, auth text, squadra text)
language sql volatile security definer set search_path = public as $$
  with candidati as (
    select distinct s.user_id, s.endpoint, s.p256dh, s.auth, i.squadra
      from public.futsal_iscritti i
      join public.push_subscriptions s on s.user_id = i.user_id
     where s.failed_at is null
       and exists (select 1 from public.futsal_quotazioni q where q.giornata = p_giornata)
       and exists (select 1 from public.futsal_lock l where l.giornata = p_giornata and l.lock_at > now())
  ), nuovi as (
    insert into public.futsal_mercato_avvisati (giornata, user_id, endpoint)
    select p_giornata, c.user_id, c.endpoint from candidati c
    on conflict (giornata, user_id, endpoint) do nothing
    returning user_id, endpoint
  )
  select c.user_id, c.endpoint, c.p256dh, c.auth, c.squadra
    from candidati c join nuovi n on n.user_id = c.user_id and n.endpoint = c.endpoint
$$;
revoke all on function public.futsal_mercato_da_avvisare(int) from public, anon, authenticated;
