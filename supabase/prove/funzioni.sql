-- Le funzioni chiamate davvero, non solo create.
--
-- Il corpo di una funzione plpgsql non viene controllato quando la si crea:
-- un `user_id = auth.uid()` che confronta text con uuid passa la creazione e
-- scoppia il giorno che qualcuno prova a uscire da una lega. Qui si eseguono,
-- con un'identità in stile fornitore esterno (una stringa, non un uuid), che è
-- il caso che la migrazione 001 doveva rendere possibile.
\set ON_ERROR_STOP on

insert into public.profiles (id, display_name, is_judge) values
  ('user_alex', 'Alex', true), ('user_bea', 'Bea', false), ('user_cip', 'Cip', false)
on conflict (id) do nothing;

create or replace function pg_temp.entra(p text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', json_build_object('sub', p)::text, false); end $$;

create or replace function pg_temp.esige(descrizione text, condizione boolean) returns void language plpgsql as $$
begin
  if condizione then raise notice 'ok  %', descrizione;
  else raise exception 'FALLITA: %', descrizione; end if;
end $$;

-- lega
select pg_temp.entra('user_alex');
select public.create_league('Lega di prova','LDP','Hasta El Chapo FC','#1B84C6','HEC') as lega \gset
select pg_temp.esige('Alex crea la lega', :'lega' is not null);

select pg_temp.entra('user_bea');
select public.join_league((select invite_code from public.leagues where id = :'lega'), 'Borgo FC', '#27ae60', 'BFC');
select pg_temp.esige('Bea entra col codice', (select count(*) from public.league_members where league_id = :'lega') = 2);

-- allenatore in seconda
select pg_temp.entra('user_bea');
select public.rigenera_codice_vice((select id from public.league_members where league_id = :'lega' and user_id='user_bea')) as codice \gset
select pg_temp.entra('user_cip');
select public.entra_come_vice(:'codice');
select pg_temp.esige('Cip diventa vice di Bea',
  (select vice_user_id from public.league_members where league_id = :'lega' and user_id='user_bea') = 'user_cip');
select pg_temp.esige('il vice risulta membro', public.is_league_member(:'lega'));
select pg_temp.esige('ma il vice non e amministratore', not public.is_league_admin(:'lega'));

select pg_temp.entra('user_alex');
select pg_temp.esige('chi crea la lega ne e amministratore', public.is_league_admin(:'lega'));

select pg_temp.entra('user_bea');
select public.togli_vice((select id from public.league_members where league_id = :'lega' and user_id='user_bea'));
select pg_temp.esige('il vice si toglie',
  (select vice_user_id from public.league_members where league_id = :'lega' and user_id='user_bea') is null);

-- calendario dei lock
select pg_temp.entra('user_alex');
select public.sync_matchday_locks(jsonb_build_array(
  jsonb_build_object('matchday',1,'lock_at','2026-09-05T13:00:00Z'),
  jsonb_build_object('matchday',2,'lock_at','2026-09-12T13:00:00Z'))) as scritte \gset
select pg_temp.esige('il Giudice Dati allinea due giornate', :'scritte'::int = 2);
select pg_temp.esige('e la data letta e quella scritta',
  public.matchday_lock_at(1) = '2026-09-05T13:00:00Z'::timestamptz);
select public.sync_matchday_locks(jsonb_build_array(
  jsonb_build_object('matchday',1,'lock_at','2026-09-05T13:00:00Z'),
  jsonb_build_object('matchday',2,'lock_at','2026-09-12T13:00:00Z'))) as riscritte \gset
select pg_temp.esige('rimandare le stesse date non riscrive niente', :'riscritte'::int = 0);

select pg_temp.entra('user_bea');
do $$ begin
  perform public.sync_matchday_locks('[]'::jsonb);
  raise exception 'FALLITA: chi non e Giudice Dati ha potuto scrivere il calendario';
exception when others then
  if sqlerrm like 'FALLITA:%' then raise; end if;
  raise notice 'ok  chi non e Giudice Dati viene respinto (%)', sqlerrm;
end $$;

-- promemoria
insert into public.push_subscriptions (endpoint, user_id, p256dh, auth)
values ('https://push/1','user_bea','k','a') on conflict (endpoint) do nothing;
select pg_temp.esige('senza rosa non si avvisa nessuno', (select count(*) from public.da_avvisare(1)) = 0);
insert into public.rosters (league_id, member_id, player_id, price_paid)
select :'lega'::uuid, id, 1, 10 from public.league_members where league_id = :'lega' and user_id='user_bea';
select pg_temp.esige('con la rosa e senza formazione si avvisa', (select count(*) from public.da_avvisare(1)) = 1);

-- uscire dalla lega
select pg_temp.entra('user_bea');
select public.abbandona_lega(:'lega');
select pg_temp.esige('Bea esce dalla lega',
  (select count(*) from public.league_members where league_id = :'lega') = 1);

select 'tutte le prove sulle funzioni sono passate' as esito;
