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

-- ---------------------------------------------------------------- scambi
-- Bea e' uscita dalla lega qui sopra: per gli scambi serve una seconda
-- squadra, quindi rientra.
select pg_temp.entra('user_bea');
select public.join_league((select invite_code from public.leagues where id = :'lega'), 'Borgo FC', '#27ae60', 'BFC');

select id into temporary tmp_alex from public.league_members where league_id = :'lega' and user_id = 'user_alex';
select id into temporary tmp_bea  from public.league_members where league_id = :'lega' and user_id = 'user_bea';
select (select id from tmp_alex) as m_alex \gset
select (select id from tmp_bea)  as m_bea  \gset

delete from public.rosters where league_id = :'lega';
insert into public.rosters (league_id, member_id, player_id, price_paid) values
  (:'lega', :'m_alex', 'p1', 40), (:'lega', :'m_alex', 'p2', 25),
  (:'lega', :'m_bea',  'p3', 30), (:'lega', :'m_bea',  'p4', 15);
update public.league_members set credits = 60 where id = :'m_alex';
update public.league_members set credits = 10 where id = :'m_bea';

\echo '--- scambi ---'
select pg_temp.entra('user_alex');

-- numeri diversi per parte: si rifiuta
do $$ begin
  perform public.proponi_scambio((select league_id from public.league_members limit 1), null, '[]'::jsonb, '[]'::jsonb, 0);
  raise exception 'FALLITA: una proposta vuota e passata';
exception when others then
  if sqlerrm like 'FALLITA:%' then raise; end if;
  raise notice 'ok  una proposta senza squadra viene respinta';
end $$;

do $$
declare lega uuid; bea uuid;
begin
  select id into lega from public.leagues order by created_at limit 1;
  select id into bea from public.league_members where league_id = lega and user_id = 'user_bea';
  begin
    perform public.proponi_scambio(lega, bea, '["p1","p2"]'::jsonb, '["p3"]'::jsonb, 0);
    raise exception 'FALLITA: due contro uno e passato';
  exception when others then
    if sqlerrm like 'FALLITA:%' then raise; end if;
    raise notice 'ok  due giocatori contro uno vengono respinti (%)', sqlerrm;
  end;
  begin
    perform public.proponi_scambio(lega, bea, '["p3"]'::jsonb, '["p4"]'::jsonb, 0);
    raise exception 'FALLITA: ha offerto un giocatore che non e suo';
  exception when others then
    if sqlerrm like 'FALLITA:%' then raise; end if;
    raise notice 'ok  non si offre un giocatore che non e proprio (%)', sqlerrm;
  end;
  begin
    perform public.proponi_scambio(lega, bea, '["p1"]'::jsonb, '["p3"]'::jsonb, 999);
    raise exception 'FALLITA: ha promesso crediti che non ha';
  exception when others then
    if sqlerrm like 'FALLITA:%' then raise; end if;
    raise notice 'ok  non si promettono crediti che non si hanno (%)', sqlerrm;
  end;
end $$;

-- una proposta buona
select public.proponi_scambio(:'lega', :'m_bea', '["p1"]'::jsonb, '["p3"]'::jsonb, 20, 'ti do p1 piu 20') as scambio \gset
select pg_temp.esige('la proposta buona passa', :'scambio' is not null);

-- doppia proposta verso la stessa squadra: no
do $$
declare lega uuid; bea uuid;
begin
  select id into lega from public.leagues order by created_at limit 1;
  select id into bea from public.league_members where league_id = lega and user_id = 'user_bea';
  begin
    perform public.proponi_scambio(lega, bea, '["p2"]'::jsonb, '["p4"]'::jsonb, 0);
    raise exception 'FALLITA: seconda proposta aperta verso la stessa squadra';
  exception when others then
    if sqlerrm like 'FALLITA:%' then raise; end if;
    raise notice 'ok  una sola proposta aperta per squadra (%)', sqlerrm;
  end;
end $$;

-- chi propone non puo accettare da solo
do $$
declare s uuid;
begin
  select id into s from public.trades where stato = 'proposta' limit 1;
  begin
    perform public.accetta_scambio(s);
    raise exception 'FALLITA: chi propone ha accettato da solo';
  exception when others then
    if sqlerrm like 'FALLITA:%' then raise; end if;
    raise notice 'ok  chi propone non puo accettare da solo (%)', sqlerrm;
  end;
end $$;

-- l'altra accetta: rose e crediti si muovono
select pg_temp.entra('user_bea');
select public.accetta_scambio(:'scambio');
select pg_temp.esige('p1 e passato a Bea',
  (select member_id from public.rosters where league_id = :'lega' and player_id = 'p1') = :'m_bea');
select pg_temp.esige('p3 e passato ad Alex',
  (select member_id from public.rosters where league_id = :'lega' and player_id = 'p3') = :'m_alex');
select pg_temp.esige('p1 ha tenuto il prezzo pagato',
  (select price_paid from public.rosters where league_id = :'lega' and player_id = 'p1') = 40);
select pg_temp.esige('Alex ha 20 crediti in meno', (select credits from public.league_members where id = :'m_alex') = 40);
select pg_temp.esige('Bea ha 20 crediti in piu', (select credits from public.league_members where id = :'m_bea') = 30);
select pg_temp.esige('lo scambio risulta accettato',
  (select stato from public.trades where id = :'scambio') = 'accettata');

-- accettarlo due volte: no
do $$
declare s uuid;
begin
  select id into s from public.trades where stato = 'accettata' limit 1;
  begin
    perform public.accetta_scambio(s);
    raise exception 'FALLITA: accettato due volte';
  exception when others then
    if sqlerrm like 'FALLITA:%' then raise; end if;
    raise notice 'ok  non si accetta due volte (%)', sqlerrm;
  end;
end $$;

-- il secondo controllo: una proposta nata valida non lo e piu'
select pg_temp.entra('user_alex');
select public.proponi_scambio(:'lega', :'m_bea', '["p3"]'::jsonb, '["p1"]'::jsonb, 0) as rimasta \gset
-- nel frattempo p3 esce dalla rosa di Alex per un'altra strada
update public.rosters set released_at = now() where league_id = :'lega' and player_id = 'p3';
select pg_temp.entra('user_bea');
do $$
declare s uuid;
begin
  select id into s from public.trades where stato = 'proposta' order by creato_at desc limit 1;
  begin
    perform public.accetta_scambio(s);
    raise exception 'FALLITA: accettata una proposta non piu valida';
  exception when others then
    if sqlerrm like 'FALLITA:%' then raise; end if;
    raise notice 'ok  la fattibilita si ricontrolla all accettazione (%)', sqlerrm;
  end;
end $$;

-- rifiutare e ritirare
select pg_temp.entra('user_bea');
select public.rifiuta_scambio(:'rimasta');
select pg_temp.esige('la proposta si puo rifiutare',
  (select stato from public.trades where id = :'rimasta') = 'rifiutata');

update public.rosters set released_at = null where league_id = :'lega' and player_id = 'p3';
select pg_temp.entra('user_alex');
select public.proponi_scambio(:'lega', :'m_bea', '["p3"]'::jsonb, '["p1"]'::jsonb, 0) as terza \gset
select public.annulla_scambio(:'terza');
select pg_temp.esige('chi propone puo ritirare',
  (select stato from public.trades where id = :'terza') = 'annullata');

-- ---------------------------------------------------------- mercato svincolati
\echo '--- mercato svincolati ---'
delete from public.offerte where league_id = :'lega';
delete from public.rosters where league_id = :'lega';
update public.league_members set credits = 100 where id = :'m_alex';
update public.league_members set credits = 100 where id = :'m_bea';

select pg_temp.entra('user_alex');
select pg_temp.esige('un giocatore mai preso e svincolato', public.e_svincolato(:'lega', 'libero1'));

-- offerta sotto 1 credito
do $$
declare lega uuid;
begin
  select id into lega from public.leagues order by created_at limit 1;
  begin
    perform public.offri(lega, 'libero1', 0);
    raise exception 'FALLITA: offerta da zero crediti passata';
  exception when others then
    if sqlerrm like 'FALLITA:%' then raise; end if;
    raise notice 'ok  un''offerta sotto un credito viene respinta (%)', sqlerrm;
  end;
end $$;

select public.offri(:'lega', 'libero1', 30) as off1 \gset
select pg_temp.esige('Alex offre 30', (select crediti from public.offerte where id = :'off1') = 30);
select pg_temp.esige('la finestra e di 24 ore',
  (select scade_at - creata_at from public.offerte where id = :'off1') = interval '24 hours');

-- rilancio che non supera
select pg_temp.entra('user_bea');
do $$
declare lega uuid;
begin
  select id into lega from public.leagues order by created_at limit 1;
  begin
    perform public.offri(lega, 'libero1', 30);
    raise exception 'FALLITA: rilancio pari accettato';
  exception when others then
    if sqlerrm like 'FALLITA:%' then raise; end if;
    raise notice 'ok  bisogna superare l''offerta piu alta (%)', sqlerrm;
  end;
end $$;

select public.offri(:'lega', 'libero1', 40) as off2 \gset
select pg_temp.esige('Bea rilancia a 40', (select crediti from public.offerte where id = :'off2') = 40);
select pg_temp.esige('la finestra NON si allunga col rilancio',
  (select scade_at from public.offerte where id = :'off2') = (select scade_at from public.offerte where id = :'off1'));

-- gli impegni aperti contano
do $$
declare lega uuid;
begin
  select id into lega from public.leagues order by created_at limit 1;
  begin
    perform public.offri(lega, 'libero2', 70);
    raise exception 'FALLITA: ha promesso piu crediti di quelli che ha';
  exception when others then
    if sqlerrm like 'FALLITA:%' then raise; end if;
    raise notice 'ok  le offerte gia aperte contano sui crediti (%)', sqlerrm;
  end;
end $$;

-- il proprio rilancio sostituisce, non si somma
select public.offri(:'lega', 'libero1', 45) as off3 \gset
select pg_temp.esige('un solo impegno aperto per persona su un giocatore',
  (select count(*) from public.offerte where league_id = :'lega' and player_id = 'libero1' and member_id = :'m_bea' and stato = 'aperta') = 1);

-- niente si assegna prima della scadenza
select pg_temp.esige('prima della scadenza non si assegna niente', public.risolvi_offerte(:'lega') = 0);

-- scadenza raggiunta
update public.offerte set scade_at = now() - interval '1 minute' where league_id = :'lega';
select pg_temp.esige('alla scadenza si assegna un giocatore', public.risolvi_offerte(:'lega') = 1);
select pg_temp.esige('ha vinto l''offerta piu alta (Bea a 45)',
  (select member_id from public.rosters where league_id = :'lega' and player_id = 'libero1') = :'m_bea');
select pg_temp.esige('pagato quanto offerto',
  (select price_paid from public.rosters where league_id = :'lega' and player_id = 'libero1') = 45);
select pg_temp.esige('i crediti di Bea sono scesi', (select credits from public.league_members where id = :'m_bea') = 55);
select pg_temp.esige('l''offerta di Alex risulta persa', (select stato from public.offerte where id = :'off1') = 'persa');
select pg_temp.esige('richiamarla non riassegna niente', public.risolvi_offerte(:'lega') = 0);
select pg_temp.esige('ora non e piu svincolato', not public.e_svincolato(:'lega', 'libero1'));

-- chi non ha piu i crediti al momento della chiusura non vince
select pg_temp.entra('user_alex');
select public.offri(:'lega', 'libero3', 90) as off4 \gset
update public.league_members set credits = 5 where id = :'m_alex';
update public.offerte set scade_at = now() - interval '1 minute' where id = :'off4';
select pg_temp.esige('senza piu i crediti non gli viene assegnato', public.risolvi_offerte(:'lega') = 0);
select pg_temp.esige('e l''offerta risulta persa', (select stato from public.offerte where id = :'off4') = 'persa');
select pg_temp.esige('il giocatore resta libero', public.e_svincolato(:'lega', 'libero3'));

-- se nel frattempo lo prende qualcun altro, l'offerta si chiude persa
update public.league_members set credits = 100 where id = :'m_alex';
select public.offri(:'lega', 'libero4', 10) as off5 \gset
insert into public.rosters (league_id, member_id, player_id, price_paid) values (:'lega', :'m_bea', 'libero4', 1);
update public.offerte set scade_at = now() - interval '1 minute' where id = :'off5';
select pg_temp.esige('un giocatore preso altrove non si assegna di nuovo', public.risolvi_offerte(:'lega') = 0);
select pg_temp.esige('e quell''offerta risulta persa', (select stato from public.offerte where id = :'off5') = 'persa');

-- ritirare la propria
select public.offri(:'lega', 'libero5', 12) as off6 \gset
select public.ritira_offerta(:'off6');
select pg_temp.esige('la propria offerta si ritira', (select stato from public.offerte where id = :'off6') = 'ritirata');
select pg_temp.entra('user_bea');
select public.offri(:'lega', 'libero6', 12) as off7 \gset
select pg_temp.entra('user_alex');
do $$
declare o uuid;
begin
  select id into o from public.offerte where stato = 'aperta' and player_id = 'libero6';
  begin
    perform public.ritira_offerta(o);
    raise exception 'FALLITA: ha ritirato l''offerta di un altro';
  exception when others then
    if sqlerrm like 'FALLITA:%' then raise; end if;
    raise notice 'ok  non si ritira l''offerta di un altro (%)', sqlerrm;
  end;
end $$;

select 'tutte le prove sulle funzioni sono passate' as esito;
