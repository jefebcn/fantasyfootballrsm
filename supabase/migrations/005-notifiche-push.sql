-- Notifiche a telefono chiuso: dove si tengono le iscrizioni.
--
-- Il foglio delle impostazioni promette da sempre "un avviso quando manca poco
-- al lock e non hai ancora schierato". Ad app aperta ora c'e' (lo fa il
-- browser). A telefono chiuso serve il push, e il push vuole tre cose: una
-- chiave VAPID, un posto dove tenere le iscrizioni, e qualcuno che spedisca.
-- Questa e' la seconda.
--
-- Un'iscrizione e' legata al dispositivo, non alla persona: chi apre l'app su
-- telefono e su tablet ne ha due, ed e' giusto che le riceva su entrambi.

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  -- quando l'ultima spedizione e' fallita: un endpoint morto si cancella
  failed_at timestamptz
);
create index if not exists push_per_utente on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
-- Ognuno vede e gestisce solo le proprie: un'iscrizione e' un indirizzo a cui
-- si puo' spedire, quindi non e' roba da far leggere agli altri.
drop policy if exists push_proprie on public.push_subscriptions;
create policy push_proprie on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Chi non ha consegnato la formazione di una giornata, con l'indirizzo a cui
-- scrivergli. La usa la funzione che spedisce, che gira col service_role e
-- quindi salta le policy: per questo filtra lei sulla giornata richiesta.
create or replace function public.da_avvisare(p_matchday int)
returns table (user_id uuid, endpoint text, p256dh text, auth text, league_name text, team_name text)
language sql stable security definer set search_path = public as $$
  select distinct s.user_id, s.endpoint, s.p256dh, s.auth, l.name, m.team_name
    from public.league_members m
    join public.leagues l on l.id = m.league_id
    join public.push_subscriptions s
      on s.user_id = m.user_id or s.user_id = m.vice_user_id
   where s.failed_at is null
     and not exists (
       select 1 from public.lineups li
        where li.league_id = m.league_id and li.member_id = m.id and li.matchday = p_matchday
     )
     and exists (select 1 from public.rosters r where r.league_id = m.league_id and r.member_id = m.id)
$$;

revoke all on function public.da_avvisare(int) from public, authenticated;
