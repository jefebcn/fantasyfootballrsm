-- I pronostici (071) come «authenticated»: chiusura col blocco della
-- giornata, nessuno legge quelli degli altri, classifica e percentuali solo a
-- giornata chiusa.
\set ON_ERROR_STOP on

insert into public.profiles (id, display_name) values ('pro_alex', 'Alex'), ('pro_bea', 'Bea'), ('pro_cip', 'Cip')
on conflict (id) do nothing;

create or replace function pg_temp.entra(p text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', json_build_object('sub', p)::text, false); end $$;
create or replace function pg_temp.esige(descrizione text, condizione boolean) returns void language plpgsql as $$
begin
  if condizione then raise notice 'ok  %', descrizione;
  else raise exception 'FALLITA: %', descrizione; end if;
end $$;

-- la 29 aperta, la 28 chiusa da ieri
insert into public.matchday_locks (matchday, lock_at) values (29, now() + interval '3 days'), (28, now() - interval '1 day')
on conflict (matchday) do update set lock_at = excluded.lock_at;

set role authenticated;

select pg_temp.entra('pro_alex');
insert into public.pronostici (matchday, casa, ospite, segno, gol_casa, gol_ospite) values (29, 'cosmos', 'folgore', '1', 2, 0);
insert into public.pronostici (matchday, casa, ospite, segno) values (29, 'virtus', 'murata', 'X');
update public.pronostici set segno = '2', gol_casa = 0, gol_ospite = 1 where matchday = 29 and casa = 'cosmos';
select pg_temp.esige('alex scrive e cambia i suoi pronostici a giornata aperta', (select count(*) from public.pronostici) = 2);

do $$ begin
  insert into public.pronostici (matchday, casa, ospite, segno) values (28, 'cosmos', 'folgore', '1');
  raise exception 'FALLITA: un pronostico entra a giornata chiusa';
exception when insufficient_privilege then raise notice 'ok  a giornata chiusa non si pronostica';
end $$;
do $$ begin
  insert into public.pronostici (matchday, casa, ospite, segno, gol_casa, gol_ospite) values (29, 'tre-fiori', 'domagnano', '1', 0, 2);
  raise exception 'FALLITA: entra un risultato esatto che contraddice il segno';
exception when check_violation then raise notice 'ok  segno e risultato esatto devono dire lo stesso';
end $$;
do $$ begin
  insert into public.pronostici (user_id, matchday, casa, ospite, segno) values ('pro_bea', 29, 'la-fiorita', 'libertas', '1');
  raise exception 'FALLITA: alex scrive un pronostico a nome di bea';
exception when insufficient_privilege then raise notice 'ok  nessuno pronostica a nome di un altro';
end $$;

select pg_temp.entra('pro_bea');
select pg_temp.esige('bea non legge i pronostici di alex', (select count(*) from public.pronostici) = 0);
insert into public.pronostici (matchday, casa, ospite, segno) values (29, 'cosmos', 'folgore', '1');
select pg_temp.esige('a giornata aperta niente percentuali', (select count(*) from public.pronostici_percentuali(29)) = 0);
select pg_temp.esige('a giornata aperta niente classifica',
  (select count(*) from public.pronostici_classifica('[{"g":29,"c":"cosmos","o":"folgore","gc":0,"go":1}]')) = 0);

-- la giornata si chiude (lo fa il Giudice, qui il proprietario)
reset role;
update public.matchday_locks set lock_at = now() - interval '1 minute' where matchday = 29;
insert into public.pronostici (user_id, matchday, casa, ospite, segno, gol_casa, gol_ospite) values ('pro_cip', 29, 'cosmos', 'folgore', '2', 1, 3);
set role authenticated;

select pg_temp.entra('pro_alex');
do $$ declare n int; begin
  update public.pronostici set segno = '1' where matchday = 29 and casa = 'virtus';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLITA: un pronostico si cambia a giornata chiusa'; end if;
  raise notice 'ok  a giornata chiusa i pronostici non si cambiano';
end $$;
do $$ declare n int; begin
  delete from public.pronostici where matchday = 29;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLITA: un pronostico si cancella a giornata chiusa'; end if;
  raise notice 'ok  a giornata chiusa i pronostici non si cancellano';
end $$;

-- Cosmos-Folgore 0-1, Virtus-Murata da recuperare (nessun risultato)
select pg_temp.esige('alex: risultato esatto, 3 punti',
  (select punti = 3 and esatti = 1 and posto = 1 and mio from public.pronostici_classifica('[{"g":29,"c":"cosmos","o":"folgore","gc":0,"go":1}]') where user_id = 'pro_alex'));
select pg_temp.esige('cip: solo il segno, 1 punto; bea: niente',
  (select string_agg(user_id || ':' || punti, ',' order by user_id) from public.pronostici_classifica('[{"g":29,"c":"cosmos","o":"folgore","gc":0,"go":1}]'))
  = 'pro_alex:3,pro_bea:0,pro_cip:1');
select pg_temp.esige('la partita rimandata non conta finche'' manca il risultato',
  (select giocate = 1 from public.pronostici_classifica('[{"g":29,"c":"cosmos","o":"folgore","gc":0,"go":1}]') where user_id = 'pro_alex'));
select pg_temp.esige('risultati di giornate aperte o storti non contano',
  (select punti = 0 from public.pronostici_classifica('[{"g":30,"c":"cosmos","o":"folgore","gc":0,"go":1},{"g":"x"},5]') where user_id = 'pro_alex') is not false);
select pg_temp.esige('le percentuali dopo la chiusura',
  (select uno = 1 and due = 2 and totale = 3 from public.pronostici_percentuali(29) where casa = 'cosmos'));
select pg_temp.esige('classifica di una lega in cui non sei: vuota',
  (select count(*) from public.pronostici_classifica('[{"g":29,"c":"cosmos","o":"folgore","gc":0,"go":1}]', gen_random_uuid())) = 0);

reset role;
