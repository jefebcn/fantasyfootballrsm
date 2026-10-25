-- Il FantaFutsal sul server (futsal-01, futsal-02), con le policy che contano:
-- si gioca come «authenticated», il ruolo che PostgREST usa per chi ha fatto
-- l'accesso.
\set ON_ERROR_STOP on

insert into public.profiles (id, display_name) values ('fut_alex', 'Alex'), ('fut_bea', 'Bea'), ('fut_cip', 'Cip')
on conflict (id) do nothing;

create or replace function pg_temp.entra(p text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', json_build_object('sub', p)::text, false); end $$;
create or replace function pg_temp.esige(descrizione text, condizione boolean) returns void language plpgsql as $$
begin
  if condizione then raise notice 'ok  %', descrizione;
  else raise exception 'FALLITA: %', descrizione; end if;
end $$;

-- Una formazione valida presa dal listone: porta del club X, poi D e A di
-- quattro squadre diverse, panchina di altre due.
create or replace function pg_temp.formazione(modulo text) returns jsonb language plpgsql as $$
declare usati text[] := array['cailungo']; tit text[] := '{}'; pan text[] := '{}'; r text; g record; n int;
begin
  foreach r in array array['D', 'D', 'A', 'A'] loop
    select id, club into g from public.futsal_giocatori where ruolo = r and not club = any(usati) order by id limit 1;
    tit := tit || g.id; usati := usati || g.club;
  end loop;
  if modulo = '3-1' then
    select id, club into g from public.futsal_giocatori where ruolo = 'D' and not club = any(usati) order by id limit 1;
    usati := array_remove(usati, (select club from public.futsal_giocatori where id = tit[4]));
    tit[4] := g.id; usati := usati || g.club;
  end if;
  foreach r in array array['D', 'A'] loop
    select id, club into g from public.futsal_giocatori where ruolo = r and not club = any(usati) order by id limit 1;
    pan := pan || g.id; usati := usati || g.club;
  end loop;
  return jsonb_build_object('modulo', modulo, 'porta', 'cailungo', 'titolari', to_jsonb(tit), 'panchina', to_jsonb(pan),
                            'capitano', tit[1], 'vice', tit[2]);
end $$;

select pg_temp.esige('il listone del futsal e'' nel database', (select count(*) from public.futsal_giocatori) > 150);
-- la FSGC ha messo le date solo alle prime giornate: le altre arrivano con
-- le importazioni successive, e fino ad allora la giornata risulta chiusa
select pg_temp.esige('ci sono le chiusure delle giornate gia'' in calendario', (select count(*) from public.futsal_lock) >= 12);
select pg_temp.esige('una giornata senza data risulta chiusa', public.futsal_chiusa(30));

-- una giornata aperta (la 29, spostata nel futuro) e una chiusa (la 1)
insert into public.futsal_lock (giornata, lock_at) values (29, now() + interval '3 days') on conflict (giornata) do update set lock_at = excluded.lock_at;
update public.futsal_lock set lock_at = now() - interval '3 days' where giornata = 1;

set role authenticated;

select pg_temp.entra('fut_alex');
insert into public.futsal_iscritti (user_id, squadra, colore, iniziali) values ('fut_alex', 'Titani Futsal', '#1B84C6', 'TF');
select pg_temp.entra('fut_bea');
insert into public.futsal_iscritti (user_id, squadra) values ('fut_bea', 'Borgo C5');
do $$ begin
  insert into public.futsal_iscritti (user_id, squadra) values ('fut_alex', 'Finto');
  raise exception 'FALLITA: si e'' iscritto qualcun altro';
exception when others then
  if sqlerrm like 'FALLITA:%' then raise; end if;
  raise notice 'ok  non si iscrive un altro al suo posto';
end $$;

-- formazioni
select pg_temp.entra('fut_alex');
insert into public.futsal_formazioni (user_id, giornata, formazione) values ('fut_alex', 29, pg_temp.formazione('2-2'));
select pg_temp.esige('una 2-2 valida si consegna', exists (select 1 from public.futsal_formazioni where user_id = 'fut_alex' and giornata = 29));
update public.futsal_formazioni set formazione = pg_temp.formazione('3-1') where user_id = 'fut_alex' and giornata = 29;
select pg_temp.esige('e si cambia in 3-1 prima della chiusura',
  (select formazione ->> 'modulo' from public.futsal_formazioni where user_id = 'fut_alex' and giornata = 29) = '3-1');

do $$ declare f jsonb; begin
  begin
    insert into public.futsal_formazioni (user_id, giornata, formazione) values ('fut_alex', 1, pg_temp.formazione('2-2'));
    raise exception 'FALLITA: consegnata a giornata chiusa';
  exception when others then if sqlerrm like 'FALLITA:%' then raise; end if;
    raise notice 'ok  a giornata chiusa non si consegna';
  end;
  begin
    f := pg_temp.formazione('2-2'); f := jsonb_set(f, '{modulo}', '"3-1"');
    insert into public.futsal_formazioni (user_id, giornata, formazione) values ('fut_alex', 28, f);
    raise exception 'FALLITA: ruoli sbagliati accettati';
  exception when others then if sqlerrm like 'FALLITA:%' then raise; end if;
    raise notice 'ok  ruoli che non tornano col modulo: rifiutata (%)', sqlerrm;
  end;
  begin
    f := pg_temp.formazione('2-2'); f := jsonb_set(f, '{porta}', to_jsonb((select club from public.futsal_giocatori where id = f -> 'titolari' ->> 0)));
    update public.futsal_formazioni set formazione = f where user_id = 'fut_alex' and giornata = 29;
    raise exception 'FALLITA: due della stessa squadra accettati';
  exception when others then if sqlerrm like 'FALLITA:%' then raise; end if;
    raise notice 'ok  Porta della stessa squadra di un titolare: rifiutata (%)', sqlerrm;
  end;
  begin
    f := pg_temp.formazione('2-2'); f := jsonb_set(f, '{vice}', f -> 'capitano');
    update public.futsal_formazioni set formazione = f where user_id = 'fut_alex' and giornata = 29;
    raise exception 'FALLITA: capitano e vice uguali accettati';
  exception when others then if sqlerrm like 'FALLITA:%' then raise; end if;
    raise notice 'ok  capitano e vice uguali: rifiutata';
  end;
end $$;

-- chi vede cosa
select pg_temp.entra('fut_bea');
select pg_temp.esige('Bea non vede la formazione di Alex a giornata aperta',
  not exists (select 1 from public.futsal_formazioni where user_id = 'fut_alex' and giornata = 29));
reset role;
insert into public.futsal_formazioni (user_id, giornata, formazione) values ('fut_alex', 1, pg_temp.formazione('2-2'));
set role authenticated;
select pg_temp.esige('ma la vede a giornata chiusa',
  exists (select 1 from public.futsal_formazioni where user_id = 'fut_alex' and giornata = 1));
do $$ begin
  update public.futsal_formazioni set formazione = formazione where user_id = 'fut_alex' and giornata = 29;
  if found then raise exception 'FALLITA: Bea ha cambiato la formazione di Alex'; end if;
  raise notice 'ok  Bea non tocca la formazione di Alex';
end $$;

-- leghe
select pg_temp.entra('fut_alex');
select (public.futsal_crea_lega('Amici del lunedi', 'testa')).codice as codice \gset
select pg_temp.esige('Alex crea una lega testa a testa', :'codice' like 'F%');
select pg_temp.entra('fut_bea');
select public.futsal_entra_lega(:'codice');
select pg_temp.esige('Bea entra col codice', (select count(*) from public.futsal_membri m join public.futsal_leghe l on l.id = m.lega_id where l.codice = :'codice') = 2);
do $$ begin
  perform public.futsal_avvia_lega((select id from public.futsal_leghe limit 1));
  raise exception 'FALLITA: Bea ha avviato la lega di Alex';
exception when others then if sqlerrm like 'FALLITA:%' then raise; end if;
  raise notice 'ok  solo chi ha creato la lega la avvia';
end $$;
select pg_temp.entra('fut_alex');
select public.futsal_avvia_lega((select id from public.futsal_leghe where codice = :'codice')) as avvio \gset
select pg_temp.esige('avviata dalla prima giornata ancora aperta', :avvio = (select min(giornata) from public.futsal_lock where lock_at > now()));
select pg_temp.esige('con i membri di quel momento, in ordine di arrivo',
  (select membri_avvio from public.futsal_leghe where codice = :'codice') = array['fut_alex', 'fut_bea']);
select pg_temp.entra('fut_cip');
do $$ begin
  perform public.futsal_entra_lega((select codice from public.futsal_leghe limit 1));
  raise exception 'FALLITA: Cip, non iscritto, e'' entrato';
exception when others then if sqlerrm like 'FALLITA:%' then raise; end if;
  raise notice 'ok  chi non e'' iscritto al FantaFutsal non entra in una lega (%)', sqlerrm;
end $$;
select pg_temp.esige('Cip non vede la lega degli altri', not exists (select 1 from public.futsal_leghe));
select pg_temp.entra('fut_bea');
select public.futsal_esci_lega((select id from public.futsal_leghe where codice = :'codice'));
select pg_temp.esige('Bea esce dalla lega', not public.futsal_in_lega((select id from public.futsal_leghe limit 1)));
reset role;
