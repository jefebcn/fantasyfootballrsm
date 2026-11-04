-- =====================================================================
-- 052 — Le notifiche che fanno tornare: il gol di un tuo giocatore e la
--       giornata finita
--
-- Da eseguire DOPO la 051. Si può rieseguire.
--
-- PERCHÉ (Alex, 04/11: «dobbiamo trovare un modo per il quale la gente
-- continui a tornare sull'applicazione»). Fino a oggi l'unica notifica era il
-- promemoria della formazione. Adesso ce ne sono altre due:
--
--  1. GOL IN DIRETTA. Quando la FSGC scrive un gol sulla pagina della partita
--     (scripts/gol-in-diretta.py, lo stesso che fa le storie), chi ha quel
--     giocatore fra i titolari della giornata riceve «Gol di X!». Se e' il suo
--     capitano lo dice. Gli autogol no: non si festeggia un malus.
--  2. GIORNATA FINITA. Quando ci sono tutti i referti della giornata
--     (scripts/avvisi.mjs, dall'azione oraria del promemoria), chi aveva una
--     formazione riceve «Giornata N finita: i punti di <squadra> sono pronti».
--     Senza numeri: i punti li calcola l'app sul telefono, e un numero diverso
--     da quello che poi si vede costerebbe piu' fiducia di quanta ne porta.
--
-- UNA VOLTA SOLA. Come il promemoria (009): la funzione segna l'avviso nello
-- stesso momento in cui dice a chi mandarlo, con un'unica istruzione, quindi
-- due corse sovrapposte non mandano lo stesso avviso due volte. Se la
-- spedizione fallisce per un motivo passeggero, chi spedisce toglie il segno
-- (avvisi_da_rifare) e la corsa dopo riprova.
--
-- Le chiama solo la funzione promemoria col service role: da fuori no.
-- =====================================================================

create table if not exists public.avvisi_inviati (
  tag        text not null,
  endpoint   text not null,
  inviato_at timestamptz not null default now(),
  primary key (tag, endpoint)
);
alter table public.avvisi_inviati enable row level security;
revoke all on table public.avvisi_inviati from public, anon, authenticated;

-- Il gol: p_tag e' la chiave stabile del gol (partita, squadra, n-esimo gol),
-- la stessa delle storie, cosi' una correzione del minuto non e' un gol nuovo.
-- Un telefono riceve un solo avviso per gol anche se il giocatore e' in
-- formazione in piu' leghe: si sceglie la lega dove e' capitano, se c'e'.
drop function if exists public.avvisi_gol(text, text, int);
create function public.avvisi_gol(p_tag text, p_giocatore text, p_giornata int)
returns table (endpoint text, p256dh text, auth text, team_name text, league_name text,
               capitano boolean, nome text, club text)
language sql volatile security definer set search_path = public as $$
  with chi as (
    select distinct on (s.endpoint)
           s.endpoint, s.p256dh, s.auth, m.team_name, l.name as league_name,
           coalesce(li.lineup ->> 'captainId' = p_giocatore, false) as capitano
      from public.lineups li
      join public.league_members m on m.id = li.member_id and m.league_id = li.league_id
      join public.leagues l on l.id = li.league_id
      join public.push_subscriptions s on s.user_id = m.user_id or s.user_id = m.vice_user_id
     where li.matchday = p_giornata
       and li.lineup -> 'starters' ? p_giocatore
       and s.failed_at is null
       and p_tag is not null and p_giocatore is not null
     order by s.endpoint, (li.lineup ->> 'captainId' = p_giocatore) desc nulls last, l.name
  ), nuovi as (
    insert into public.avvisi_inviati (tag, endpoint)
    select p_tag, c.endpoint from chi c
    on conflict (tag, endpoint) do nothing
    returning endpoint
  )
  select c.endpoint, c.p256dh, c.auth, c.team_name, c.league_name, c.capitano,
         coalesce(q.nome, p_giocatore), q.club
    from chi c
    join nuovi n on n.endpoint = c.endpoint
    left join public.quotazioni q on q.player_id = p_giocatore
$$;
revoke execute on function public.avvisi_gol(text, text, int) from public, anon, authenticated;

-- La giornata finita: chi aveva una formazione per quella giornata. Un
-- telefono, un avviso: se si gioca in piu' leghe si nomina la prima.
drop function if exists public.avvisi_fine_giornata(int);
create function public.avvisi_fine_giornata(p_giornata int)
returns table (endpoint text, p256dh text, auth text, team_name text, league_name text, leghe int)
language sql volatile security definer set search_path = public as $$
  with tutte as (
    select s.endpoint, s.p256dh, s.auth, m.team_name, l.name as league_name, l.pubblica
      from public.lineups li
      join public.league_members m on m.id = li.member_id and m.league_id = li.league_id
      join public.leagues l on l.id = li.league_id
      join public.push_subscriptions s on s.user_id = m.user_id or s.user_id = m.vice_user_id
     where li.matchday = p_giornata and s.failed_at is null
  ), chi as (
    select distinct on (t.endpoint) t.endpoint, t.p256dh, t.auth, t.team_name, t.league_name,
           (select count(*)::int from tutte x where x.endpoint = t.endpoint) as leghe
      from tutte t
     order by t.endpoint, t.pubblica desc nulls last, t.league_name
  ), nuovi as (
    insert into public.avvisi_inviati (tag, endpoint)
    select 'giornata-' || p_giornata, c.endpoint from chi c
    on conflict (tag, endpoint) do nothing
    returning endpoint
  )
  select c.endpoint, c.p256dh, c.auth, c.team_name, c.league_name, c.leghe
    from chi c join nuovi n on n.endpoint = c.endpoint
$$;
revoke execute on function public.avvisi_fine_giornata(int) from public, anon, authenticated;

-- Spedizione fallita per un motivo passeggero: si toglie il segno e la corsa
-- dopo riprova. Gli indirizzi morti (404, 410) no: li marca failed_at.
drop function if exists public.avvisi_da_rifare(text, text[]);
create function public.avvisi_da_rifare(p_tag text, p_endpoints text[])
returns int
language sql volatile security definer set search_path = public as $$
  with tolti as (
    delete from public.avvisi_inviati where tag = p_tag and endpoint = any(p_endpoints)
    returning 1
  ) select count(*)::int from tolti
$$;
revoke execute on function public.avvisi_da_rifare(text, text[]) from public, anon, authenticated;

-- Controllo: la tabella c'e' (vuota: si comincia da adesso).
select count(*) as avvisi_segnati from public.avvisi_inviati;
