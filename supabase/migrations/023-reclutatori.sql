-- =====================================================================
-- 023 — I Reclutatori: chi porta un amico si vede
--
-- Da eseguire dopo la 022. Si può rieseguire.
--
-- PERCHÉ. Alex, 10/10: serve un motivo per invitare gli amici. Il montepremi
-- non lo convinceva e la sfida 1 contro 1 non la voleva. La scelta: chi porta
-- un amico diventa «Reclutatore», col badge accanto alla sua squadra, e chi
-- ne porta di più nella settimana finisce nella storia di Fantatitano su
-- Instagram. Niente soldi in palio: visibilità.
--
-- COME SI CONTA. Il link che l'app condivide porta l'identità di chi lo manda
-- (?da=…). Chi lo apre e si iscrive se lo porta dietro, e al primo accesso
-- l'app chiama registra_invito(): da lì il profilo nuovo sa chi l'ha
-- invitato. L'amico CONTA solo quando entra in una lega (creata o con un
-- codice, privata o pubblica): un account aperto e lasciato lì non è un
-- giocatore. Si conta una volta sola, anche se poi esce e rientra.
--
-- COSA NON SI PUÒ FARE:
--  - invitare se stessi;
--  - farsi attribuire a qualcuno con un account vecchio: vale solo per i
--    profili nati da meno di 7 giorni, cioè per chi arriva davvero dal link;
--  - cambiare chi ti ha invitato, una volta segnato;
--  - scriversi da soli il contatore: le policy lasciano aggiornare il proprio
--    profilo (il nome), e senza il trigger qui sotto chiunque potrebbe
--    mettersi «reclutati = 99». Lo cambiano solo le funzioni di questo file.
--
-- COSA SI VEDE, E A CHI:
--  - nel profilo di ognuno il numero di amici portati, e quindi il badge;
--    chi ha invitato chi resta nel database e NON si mostra a nessuno;
--  - reclutatori_settimana(): la classifica della settimana per la storia,
--    leggibile anche senza account. Dà solo il NOME DELLA SQUADRA e il
--    numero: niente nomi di persona, niente identificativi.
-- =====================================================================

alter table public.profiles
  add column if not exists invitato_da text references public.profiles(id) on delete set null,
  add column if not exists reclutati integer not null default 0,
  add column if not exists invito_contato_at timestamptz;

create index if not exists profiles_invitato_da on public.profiles (invitato_da) where invitato_da is not null;
create index if not exists profiles_invito_contato_at on public.profiles (invito_contato_at) where invito_contato_at is not null;


-- I tre campi li scrivono solo le funzioni qui sotto (che girano come
-- proprietario). Da un client, in inserimento o in aggiornamento, si tengono
-- i valori di prima: niente errore, perché l'app aggiorna il profilo anche
-- per altri motivi e non deve rompersi.
create or replace function public.reclutati_protetti() returns trigger
language plpgsql as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.invitato_da := null; new.reclutati := 0; new.invito_contato_at := null;
    else
      new.invitato_da := old.invitato_da; new.reclutati := old.reclutati;
      new.invito_contato_at := old.invito_contato_at;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists reclutati_protetti on public.profiles;
create trigger reclutati_protetti before insert or update on public.profiles
  for each row execute function public.reclutati_protetti();


-- Conta l'amico, se c'è da contarlo: ha chi l'ha invitato, gioca in almeno
-- una lega, e non è già stato contato. Ripetibile: la seconda volta non fa
-- niente.
create or replace function public.conta_reclutato(p_utente text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  chi text;
begin
  update public.profiles set invito_contato_at = now()
   where id = p_utente
     and invitato_da is not null
     and invito_contato_at is null
     and exists (select 1 from public.league_members m where m.user_id = p_utente)
  returning invitato_da into chi;
  if chi is null then return false; end if;
  update public.profiles set reclutati = reclutati + 1 where id = chi;
  return true;
end $$;
revoke all on function public.conta_reclutato(text) from public, anon, authenticated;


-- Chi entra in una lega: se è arrivato da un invito, chi l'ha invitato
-- guadagna un amico.
create or replace function public.reclutato_entra() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.conta_reclutato(new.user_id);
  return new;
end $$;
revoke all on function public.reclutato_entra() from public, anon, authenticated;

drop trigger if exists reclutato_entra on public.league_members;
create trigger reclutato_entra after insert on public.league_members
  for each row execute function public.reclutato_entra();


-- La chiama l'app al primo accesso di chi è arrivato da un link con ?da=.
-- Risponde con una parola, così l'app sa se tenere il «da» o lasciarlo:
--   'ok'          segnato (e, se gioca già in una lega, già contato)
--   'gia'         questo profilo ha già chi l'ha invitato
--   'tardi'       il profilo ha più di 7 giorni: non è arrivato dal link
--   'se-stesso'   il link era il proprio
--   'sconosciuto' chi ha mandato il link non c'è (o non c'è più)
--   'anonimo'     nessun account
create or replace function public.registra_invito(p_da text) returns text
language plpgsql security definer set search_path = public as $$
declare
  me text := public.current_user_id();
  p record;
begin
  if me is null then return 'anonimo'; end if;
  p_da := nullif(btrim(coalesce(p_da, '')), '');
  if p_da is null or not exists (select 1 from public.profiles where id = p_da) then return 'sconosciuto'; end if;
  if p_da = me then return 'se-stesso'; end if;
  select * into p from public.profiles where id = me for update;
  if not found then return 'sconosciuto'; end if;
  if p.invitato_da is not null then return 'gia'; end if;
  if p.created_at < now() - interval '7 days' then return 'tardi'; end if;
  update public.profiles set invitato_da = p_da where id = me;
  perform public.conta_reclutato(me);
  return 'ok';
end $$;
revoke all on function public.registra_invito(text) from public, anon;
grant execute on function public.registra_invito(text) to authenticated;


-- La classifica della settimana, per la storia su Instagram. Solo il nome
-- della squadra (quella della lega pubblica, se ci gioca; se no la più
-- recente) e quanti amici sono entrati negli ultimi p_giorni.
create or replace function public.reclutatori_settimana(p_giorni integer default 7)
returns table (squadra text, amici integer)
language sql stable security definer set search_path = public as $$
  with entrati as (
    select r.invitato_da as chi, count(*)::int as n, max(r.invito_contato_at) as ultimo
      from public.profiles r
     where r.invito_contato_at > now() - make_interval(days => least(greatest(coalesce(p_giorni, 7), 1), 31))
     group by r.invitato_da
  )
  select s.squadra, s.amici from (
    select (select m.team_name
              from public.league_members m join public.leagues l on l.id = m.league_id
             where m.user_id = e.chi
             order by l.pubblica desc, m.created_at desc
             limit 1) as squadra,
           e.n as amici, e.ultimo
      from entrati e
  ) s
   where s.squadra is not null   -- chi ha invitato ma non gioca: niente da mostrare
   order by s.amici desc, s.ultimo asc
   limit 5
$$;
revoke all on function public.reclutatori_settimana(integer) from public;
grant execute on function public.reclutatori_settimana(integer) to anon, authenticated;
