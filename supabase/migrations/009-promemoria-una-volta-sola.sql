-- Il promemoria arriva una volta sola, e non dipende piu' dall'orologio.
--
-- COME ERA. La funzione che spedisce guardava se il lock cadeva fra 22,8 e 24
-- ore da adesso: una finestra di 1,2 ore, tagliata su misura per un'azione
-- pianificata che passa ogni ora. La finestra stretta era l'unica cosa che
-- impediva di spedire lo stesso avviso a ogni giro, perche' da_avvisare
-- chiedeva solo chi non aveva consegnato la formazione, non chi era gia' stato
-- avvisato.
--
-- PERCHE' NON FUNZIONAVA. Le corse pianificate di GitHub non passano ogni ora.
-- Misurate sul repository vero, sulle prime quattro corse: 3,2 ore, 6,3 ore,
-- 5,8 ore. GitHub le ritarda e le salta quando la piattaforma e' carica, e il
-- workflow resta "active" mentre succede. Con un giro ogni cinque ore la
-- probabilita' di cascare in una finestra da 1,2 ore e' circa una su quattro:
-- tre giornate su quattro non avrebbero ricevuto niente, e il workflow sarebbe
-- stato verde lo stesso, perche' avrebbe fatto il suo dovere rispondendo "non
-- e' il momento".
--
-- COME E' ADESSO. Si segna chi e' stato avvisato, e la finestra si allarga a
-- tutte le 24 ore prima del lock. Qualunque corsa capiti in quel giorno
-- consegna l'avviso, e lo consegna una volta sola. Il cron puo' passare ogni
-- venti minuti o ogni sei ore: non cambia niente.

-- Un avviso e' per DISPOSITIVO (l'endpoint), non per persona: chi ha telefono
-- e tablet li riceve su tutti e due, che e' la stessa scelta gia' fatta in 005.
-- E' per squadra (member_id) e non per utente, perche' chi gioca in due leghe
-- ha due formazioni da consegnare e due avvisi da ricevere.
create table if not exists public.promemoria_inviati (
  matchday int not null check (matchday between 1 and 30),
  league_id uuid not null references public.leagues(id) on delete cascade,
  member_id uuid not null references public.league_members(id) on delete cascade,
  endpoint text not null,
  inviato_at timestamptz not null default now(),
  primary key (matchday, member_id, endpoint)
);

alter table public.promemoria_inviati enable row level security;
-- Nessuna policy: ci scrive e ci legge solo la funzione che spedisce, che gira
-- col service_role. Con RLS accesa e zero policy, per chiunque altro e' vuota.

-- da_avvisare ora fa due cose in un colpo solo: dice chi avvisare e segna che
-- l'avviso parte. Un'unica istruzione, quindi due corse sovrapposte non
-- possono spedire lo stesso avviso due volte: la seconda trova il conflitto e
-- si ritrova la lista vuota.
--
-- Resta "language sql" e non plpgsql: dentro plpgsql i nomi delle colonne di
-- ritorno (user_id, endpoint...) sono anche parametri di uscita, e ogni
-- riferimento diventa ambiguo. In SQL puro la INSERT ... RETURNING dentro una
-- CTE funziona e il problema non si pone.
--
-- Il tipo di ritorno non cambia, ma la volatilita' si': era "stable", e una
-- funzione stable non puo' scrivere. CREATE OR REPLACE non basta a cambiarla
-- quando la vecchia esiste gia'.
drop function if exists public.da_avvisare(int);
create function public.da_avvisare(p_matchday int)
returns table (user_id text, endpoint text, p256dh text, auth text, league_name text, team_name text)
language sql volatile security definer set search_path = public as $$
  with candidati as (
    select distinct s.user_id, s.endpoint, s.p256dh, s.auth,
           l.name as league_name, m.team_name, m.league_id, m.id as member_id
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
  ), nuovi as (
    insert into public.promemoria_inviati (matchday, league_id, member_id, endpoint)
    select p_matchday, c.league_id, c.member_id, c.endpoint from candidati c
    on conflict (matchday, member_id, endpoint) do nothing
    returning member_id, endpoint
  )
  select c.user_id, c.endpoint, c.p256dh, c.auth, c.league_name, c.team_name
    from candidati c
    join nuovi n on n.member_id = c.member_id and n.endpoint = c.endpoint
$$;

revoke all on function public.da_avvisare(int) from public, authenticated;

-- Il segno si mette PRIMA di spedire, se no due corse ravvicinate spedirebbero
-- entrambe. Ma se la spedizione fallisce per un motivo passeggero — il servizio
-- push che non risponde, la rete che cade a meta' — quel segno terrebbe fuori
-- la persona per sempre, ed e' l'opposto di quello che stiamo sistemando.
-- Chi spedisce lo toglie, e la corsa dopo riprova.
-- Non si tolgono i segni di chi ha l'indirizzo morto (404 e 410): quelli non
-- vanno riprovati, e 005 li marca gia' con failed_at.
drop function if exists public.promemoria_da_rifare(int, text[]);
create function public.promemoria_da_rifare(p_matchday int, p_endpoints text[])
returns int
language sql volatile security definer set search_path = public as $$
  with tolti as (
    delete from public.promemoria_inviati
     where matchday = p_matchday and endpoint = any(p_endpoints)
    returning 1
  ) select count(*)::int from tolti
$$;

revoke all on function public.promemoria_da_rifare(int, text[]) from public, authenticated;
