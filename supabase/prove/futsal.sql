-- Il FantaFutsal sul server (futsal-01..05), con le policy che contano:
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

-- Una rosa valida presa dal listone (futsal-04): la Porta del cailungo, poi
-- 4 difensori e 4 attaccanti di otto squadre diverse, i meno cari della
-- giornata; in campo quanti ne vuole lo schema, il sesto uomo e' il primo
-- che resta fuori.
create or replace function pg_temp.formazione(schema text, n int default 29) returns jsonb language plpgsql as $$
declare usati text[] := array['cailungo']; d text[] := '{}'; a text[] := '{}'; r text; g record; tit text[]; fuori text[]; nd int;
begin
  foreach r in array array['D', 'D', 'D', 'D', 'A', 'A', 'A', 'A'] loop
    select x.id, x.club into g from public.futsal_giocatori x join public.futsal_quotazioni q on q.id = x.id and q.giornata = n
     where x.ruolo = r and not x.club = any(usati) order by q.valore, x.id limit 1;
    if r = 'D' then d := d || g.id; else a := a || g.id; end if;
    usati := usati || g.club;
  end loop;
  nd := split_part(schema, '-', 1)::int;
  tit := d[1:nd] || a[1:4 - nd];
  fuori := array(select x from unnest(d || a) x where not x = any(tit));
  return jsonb_build_object('schema', schema, 'porta', 'cailungo', 'D', to_jsonb(d), 'A', to_jsonb(a), 'titolari', to_jsonb(tit),
                            'sesto', fuori[1], 'capitano', tit[1], 'vice', tit[2]);
end $$;

select pg_temp.esige('il listone del futsal e'' nel database', (select count(*) from public.futsal_giocatori) > 150);
-- la FSGC ha messo le date solo alle prime giornate: le altre arrivano con
-- le importazioni successive, e fino ad allora la giornata risulta chiusa
select pg_temp.esige('ci sono le chiusure delle giornate gia'' in calendario', (select count(*) from public.futsal_lock) >= 12);
select pg_temp.esige('una giornata senza data risulta chiusa', public.futsal_chiusa(30));

-- una giornata aperta (la 29, spostata nel futuro) e una chiusa (la 1); la
-- 29 ha le sue quotazioni (quelle dell'ultima giornata pronta), la 28 no:
-- li' il mercato e' chiuso
insert into public.futsal_lock (giornata, lock_at) values (29, now() + interval '3 days'), (28, now() + interval '2 days')
on conflict (giornata) do update set lock_at = excluded.lock_at;
update public.futsal_lock set lock_at = now() - interval '3 days' where giornata = 1;
insert into public.futsal_quotazioni (giornata, id, valore)
select 29, id, valore from public.futsal_quotazioni where giornata = (select max(giornata) from public.futsal_quotazioni where giornata < 28)
on conflict do nothing;
select pg_temp.esige('le quotazioni del futsal sono nel database', (select count(*) from public.futsal_quotazioni where giornata = 1) > 150);

set role authenticated;

select pg_temp.entra('fut_alex');
insert into public.futsal_iscritti (user_id, squadra, colore, iniziali, club_cuore) values ('fut_alex', 'Titani Futsal', '#1B84C6', 'TF', 'murata');
select pg_temp.entra('fut_bea');
insert into public.futsal_iscritti (user_id, squadra) values ('fut_bea', 'Borgo C5');
do $$ begin
  insert into public.futsal_iscritti (user_id, squadra) values ('fut_alex', 'Finto');
  raise exception 'FALLITA: si e'' iscritto qualcun altro';
exception when others then
  if sqlerrm like 'FALLITA:%' then raise; end if;
  raise notice 'ok  non si iscrive un altro al suo posto';
end $$;

-- rosa e formazione
select pg_temp.entra('fut_alex');
insert into public.futsal_formazioni (user_id, giornata, formazione) values ('fut_alex', 29, pg_temp.formazione('2-2'));
select pg_temp.esige('una rosa 2-2 valida si consegna', exists (select 1 from public.futsal_formazioni where user_id = 'fut_alex' and giornata = 29));
update public.futsal_formazioni set formazione = pg_temp.formazione('3-1') where user_id = 'fut_alex' and giornata = 29;
select pg_temp.esige('e si passa al 3-1 con la stessa rosa',
  (select formazione ->> 'schema' from public.futsal_formazioni where user_id = 'fut_alex' and giornata = 29) = '3-1');
update public.futsal_formazioni set formazione = pg_temp.formazione('1-3') where user_id = 'fut_alex' and giornata = 29;
select pg_temp.esige('e al 1-3', (select formazione ->> 'schema' from public.futsal_formazioni where user_id = 'fut_alex' and giornata = 29) = '1-3');

do $$ declare f jsonb; begin
  begin
    insert into public.futsal_formazioni (user_id, giornata, formazione) values ('fut_alex', 1, pg_temp.formazione('2-2'));
    raise exception 'FALLITA: consegnata a giornata chiusa';
  exception when others then if sqlerrm like 'FALLITA:%' then raise; end if;
    raise notice 'ok  a giornata chiusa non si consegna';
  end;
  begin
    f := pg_temp.formazione('2-2'); f := jsonb_set(f, '{schema}', '"3-1"');
    update public.futsal_formazioni set formazione = f where user_id = 'fut_alex' and giornata = 29;
    raise exception 'FALLITA: ruoli sbagliati accettati';
  exception when others then if sqlerrm like 'FALLITA:%' then raise; end if;
    raise notice 'ok  ruoli in campo che non tornano con lo schema: rifiutata (%)', sqlerrm;
  end;
  begin
    -- un attaccante del cailungo (la squadra della Porta) messo fra i difensori
    f := pg_temp.formazione('2-2');
    f := jsonb_set(f, '{D,3}', to_jsonb((select id from public.futsal_giocatori where ruolo = 'A' and club = 'cailungo' order by id limit 1)));
    update public.futsal_formazioni set formazione = f where user_id = 'fut_alex' and giornata = 29;
    raise exception 'FALLITA: un attaccante fra i difensori accettato';
  exception when others then if sqlerrm like 'FALLITA:%' then raise; end if;
    raise notice 'ok  un giocatore nel ruolo sbagliato: rifiutata (%)', sqlerrm;
  end;
  begin
    -- Porta del club del primo difensore, e lo stesso club per un attaccante: tre
    f := pg_temp.formazione('2-2');
    f := jsonb_set(f, '{porta}', to_jsonb((select club from public.futsal_giocatori where id = f -> 'D' ->> 0)));
    f := jsonb_set(f, '{A,3}', to_jsonb((select id from public.futsal_giocatori where ruolo = 'A' and club = f ->> 'porta'
      and not id = any(array(select jsonb_array_elements_text(f -> 'A'))) order by id limit 1)));
    update public.futsal_formazioni set formazione = f where user_id = 'fut_alex' and giornata = 29;
    raise exception 'FALLITA: tre della stessa squadra accettati';
  exception when others then if sqlerrm like 'FALLITA:%' then raise; end if;
    raise notice 'ok  tre della stessa squadra: rifiutata (%)', sqlerrm;
  end;
  begin
    f := pg_temp.formazione('2-2'); f := jsonb_set(f, '{vice}', f -> 'capitano');
    update public.futsal_formazioni set formazione = f where user_id = 'fut_alex' and giornata = 29;
    raise exception 'FALLITA: capitano e vice uguali accettati';
  exception when others then if sqlerrm like 'FALLITA:%' then raise; end if;
    raise notice 'ok  capitano e vice uguali: rifiutata';
  end;
  begin
    f := pg_temp.formazione('2-2'); f := jsonb_set(f, '{sesto}', f -> 'titolari' -> 0);
    update public.futsal_formazioni set formazione = f where user_id = 'fut_alex' and giornata = 29;
    raise exception 'FALLITA: sesto uomo in campo accettato';
  exception when others then if sqlerrm like 'FALLITA:%' then raise; end if;
    raise notice 'ok  il sesto uomo non puo'' essere anche in campo';
  end;
end $$;

-- il mercato: Bea compra nella 29 a quotazioni definitive, ma non nella 28
select pg_temp.entra('fut_bea');
do $$ begin
  insert into public.futsal_formazioni (user_id, giornata, formazione) values ('fut_bea', 28, pg_temp.formazione('2-2', 29));
  raise exception 'FALLITA: rosa comprata senza quotazioni';
exception when others then if sqlerrm like 'FALLITA:%' then raise; end if;
  raise notice 'ok  senza le quotazioni della giornata il mercato e'' chiuso (%)', sqlerrm;
end $$;
reset role;
update public.futsal_quotazioni set valore = 15 where giornata = 29 and id not like 'P:%';
set role authenticated;
select pg_temp.entra('fut_bea');
do $$ begin
  insert into public.futsal_formazioni (user_id, giornata, formazione) values ('fut_bea', 29, pg_temp.formazione('2-2'));
  raise exception 'FALLITA: rosa da 120 crediti accettata';
exception when others then if sqlerrm like 'FALLITA:%' then raise; end if;
  raise notice 'ok  una rosa che costa piu'' di 70 crediti: rifiutata (%)', sqlerrm;
end $$;
select pg_temp.entra('fut_alex');
update public.futsal_formazioni set formazione = jsonb_set(formazione, '{capitano}', formazione -> 'vice') || jsonb_build_object('vice', formazione -> 'capitano')
 where user_id = 'fut_alex' and giornata = 29;
select pg_temp.esige('chi non cambia la rosa non paga niente, anche se i prezzi sono saliti',
  (select formazione ->> 'capitano' = formazione -> 'titolari' ->> 1 from public.futsal_formazioni where user_id = 'fut_alex' and giornata = 29));
reset role;
select pg_temp.esige('il patrimonio parte da 70 crediti', public.futsal_patrimonio('fut_alex', 29) = 70);
set role authenticated;

-- chi vede cosa
select pg_temp.entra('fut_bea');
select pg_temp.esige('Bea non vede la formazione di Alex a giornata aperta',
  not exists (select 1 from public.futsal_formazioni where user_id = 'fut_alex' and giornata = 29));
reset role;
insert into public.futsal_formazioni (user_id, giornata, formazione) values ('fut_alex', 1, pg_temp.formazione('2-2', 1));
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

-- promemoria (futsal-03): chi e' iscritto, ha un telefono e non ha consegnato
insert into public.push_subscriptions (endpoint, user_id, p256dh, auth) values
  ('https://push.example/bea', 'fut_bea', 'k', 'a'), ('https://push.example/alex', 'fut_alex', 'k', 'a')
on conflict (endpoint) do nothing;
select pg_temp.esige('il promemoria va a Bea, che non ha ancora una squadra, e non ad Alex',
  (select array_agg(user_id) from public.futsal_da_avvisare(29)) = array['fut_bea']);
select pg_temp.esige('e una volta sola', not exists (select 1 from public.futsal_da_avvisare(29)));
select pg_temp.esige('un invio fallito si rimette in coda', public.futsal_promemoria_da_rifare(29, array['https://push.example/bea']) = 1);
set role authenticated;
select pg_temp.entra('fut_bea');
do $$ begin
  perform public.futsal_da_avvisare(29);
  raise exception 'FALLITA: un utente ha letto chi avvisare';
exception when others then if sqlerrm like 'FALLITA:%' then raise; end if;
  raise notice 'ok  chi avvisare lo legge solo la funzione promemoria (%)', sqlerrm;
end $$;
reset role;
