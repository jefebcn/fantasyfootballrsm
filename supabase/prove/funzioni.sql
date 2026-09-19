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
-- Attenzione: dalla 009 da_avvisare SCRIVE (segna chi ha avvisato), quindi
-- chiamarla due volte di fila non da' lo stesso risultato. Qui la prima
-- chiamata non trova nessuno, quindi non segna niente e la seconda e' pulita.
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


-- ---------------------------------------------------------------------------
-- Promemoria della formazione: una volta sola, e non dipendente dall'orologio.
--
-- La 009 sposta il "non ripetersi" dalla finestra temporale al database. Qui
-- si controlla proprio quello: che la seconda chiamata non restituisca niente,
-- e che togliere il segno faccia ripartire l'avviso.
--
-- Lo stato di partenza si ricostruisce da zero invece di ereditare quello che
-- hanno lasciato le prove di sopra: li' in mezzo qualcuno ha abbandonato la
-- lega, qualcun altro si e' giocato tutta la rosa al mercato, e un conto
-- scritto a mano su quello stato sarebbe un numero che non dice niente.
-- ---------------------------------------------------------------------------
delete from public.promemoria_inviati;
delete from public.push_subscriptions;
delete from public.lineups where league_id = :'lega';
delete from public.rosters where league_id = :'lega';
insert into public.rosters (league_id, member_id, player_id, price_paid) values
  (:'lega', :'m_alex', 'q1', 10), (:'lega', :'m_bea', 'q2', 10);
-- Cip torna vice di Bea: un avviso va anche all'allenatore in seconda, che e'
-- l'unico altro che puo' consegnare la formazione.
update public.league_members set vice_user_id = 'user_cip' where id = :'m_bea';

-- Alex da telefono e da tablet: due dispositivi, due avvisi. Un'iscrizione e'
-- legata al dispositivo, non alla persona (005).
insert into public.push_subscriptions (endpoint, user_id, p256dh, auth) values
  ('https://push/alex-telefono', 'user_alex', 'k1', 'a1'),
  ('https://push/alex-tablet',   'user_alex', 'k2', 'a2'),
  ('https://push/bea',           'user_bea',  'k3', 'a3'),
  ('https://push/cip',           'user_cip',  'k4', 'a4'),
  ('https://push/morto',         'user_bea',  'k5', 'a5');
update public.push_subscriptions set failed_at = now() where endpoint = 'https://push/morto';

-- Primo giro: i due dispositivi di Alex, quello di Bea e quello del suo vice.
-- Quello morto no.
select count(*)::int as primo from public.da_avvisare(7) \gset
select pg_temp.esige('il primo giro avvisa i quattro dispositivi vivi', :primo = 4);
select pg_temp.esige('l''indirizzo morto non viene avvisato',
  not exists (select 1 from public.promemoria_inviati where matchday = 7 and endpoint = 'https://push/morto'));
select pg_temp.esige('il vice riceve l''avviso della squadra di Bea',
  exists (select 1 from public.promemoria_inviati where matchday = 7 and endpoint = 'https://push/cip'));

-- Secondo giro subito dopo: non deve uscire piu' niente. E' il punto di tutta
-- la migrazione: con la versione vecchia qui uscivano di nuovo tutti e quattro,
-- ed era solo la finestra da 1,2 ore a impedire che succedesse davvero.
select count(*)::int as secondo from public.da_avvisare(7) \gset
select pg_temp.esige('il secondo giro non ripete niente', :secondo = 0);

-- Una giornata diversa e' un avviso diverso.
select count(*)::int as altra from public.da_avvisare(8) \gset
select pg_temp.esige('un''altra giornata riparte da zero', :altra = 4);

-- Spedizione fallita per un motivo passeggero: il segno si toglie e la corsa
-- dopo riprova. Senza questo, un servizio push che non risponde per un minuto
-- escluderebbe quella persona da quella giornata per sempre.
select public.promemoria_da_rifare(7, array['https://push/bea']) as tolti \gset
select pg_temp.esige('il segno di chi non ha ricevuto si toglie', :tolti = 1);
select count(*)::int as riprova from public.da_avvisare(7) \gset
select pg_temp.esige('e la corsa dopo riprova solo con lui', :riprova = 1);

-- Chi consegna la formazione esce dalla lista: restano i due di Bea.
insert into public.lineups (league_id, member_id, matchday, lineup)
  values (:'lega', :'m_alex', 9, '{}'::jsonb);
select count(*)::int as dopo from public.da_avvisare(9) \gset
select pg_temp.esige('chi ha consegnato non viene avvisato', :dopo = 2);

-- Chi non ha la rosa non viene avvisato: non e' colpa sua se non puo' schierare.
delete from public.rosters where league_id = :'lega' and member_id = :'m_bea';
select count(*)::int as senza from public.da_avvisare(10) \gset
select pg_temp.esige('senza rosa non si avvisa', :senza = 2);


-- ---------------------------------------------------------------------------
-- Cancellare il proprio profilo.
--
-- Due cose da provare, e la prima conta quanto la seconda: che si RIFIUTI
-- quando cancellare lascerebbe una lega senza amministratore.
-- ---------------------------------------------------------------------------
insert into public.profiles (id, display_name) values ('user_dino','Dino'), ('user_eva','Eva')
  on conflict (id) do nothing;

-- Dino crea una lega sua e ci resta da solo
select pg_temp.entra('user_dino');
select public.create_league('Lega di Dino','LDD','Dino FC','#333','DFC') as lega_dino \gset

-- Eva entra nella lega di Alex: Alex diventa un amministratore con gente dentro
select pg_temp.entra('user_eva');
select public.join_league((select invite_code from public.leagues where id = :'lega'), 'Eva FC', '#888', 'EFC');

-- Alex non può sparire: lascerebbe la sua lega senza amministratore
select pg_temp.entra('user_alex');
do $$
begin
  begin
    perform public.elimina_profilo();
    raise exception 'FALLITA: ha cancellato un amministratore con gente in lega';
  exception when others then
    if sqlerrm like 'FALLITA:%' then raise; end if;
    raise notice 'ok  un amministratore con gente in lega non si cancella (%)', sqlerrm;
  end;
end $$;
select pg_temp.esige('e infatti Alex c''è ancora', exists (select 1 from public.profiles where id='user_alex'));

-- Dino invece è solo: se ne va lui e se ne va la sua lega
select pg_temp.entra('user_dino');
insert into public.push_subscriptions (endpoint, user_id, p256dh, auth)
  values ('https://push/dino','user_dino','k','a');
select public.elimina_profilo() as esito_dino \gset
select pg_temp.esige('il profilo di Dino non c''è più', not exists (select 1 from public.profiles where id='user_dino'));
select pg_temp.esige('la sua lega è sparita con lui', not exists (select 1 from public.leagues where id = :'lega_dino'));
select pg_temp.esige('la sua squadra è sparita', not exists (select 1 from public.league_members where user_id='user_dino'));
select pg_temp.esige('e le sue iscrizioni alle notifiche', not exists (select 1 from public.push_subscriptions where user_id='user_dino'));
select pg_temp.esige('la lega di Alex non è stata toccata', exists (select 1 from public.leagues where id = :'lega'));

-- Eva è dentro la lega di Alex ma non ne è amministratore: può andarsene
select pg_temp.entra('user_eva');
select public.elimina_profilo();
select pg_temp.esige('anche Eva se ne va', not exists (select 1 from public.profiles where id='user_eva'));
select pg_temp.esige('e la lega di Alex resta in piedi', exists (select 1 from public.leagues where id = :'lega'));

-- ------------------------------------------------------- lega pubblica (013)
--
-- Le due cose che la distinguono da una lega fra amici: ci si entra senza
-- codice, e i giocatori NON sono esclusivi. La seconda e' quella che regge
-- tutto il resto: con l'esclusivita' addosso, dal ventesimo iscritto non ci
-- sarebbero piu' portieri.
insert into public.profiles (id, display_name) values
  ('user_pub1', 'Primo'), ('user_pub2', 'Secondo'), ('user_pub3', 'Terzo')
on conflict (id) do nothing;

-- La lega pubblica la apre solo chi amministra l'app (014): il primo
-- amministratore si nomina a mano, come il Giudice Dati, e qui si fa cosi'.
select pg_temp.entra('user_pub1');
do $$ begin
  perform public.crea_lega_pubblica('Prima del potere','X','Sq','#1B84C6','SQ', 300, 3, '[]'::jsonb);
  raise exception 'FALLITA: senza is_admin non si doveva poter aprire una lega pubblica';
exception when others then
  if sqlerrm like 'FALLITA%' then raise; end if;
  raise notice 'ok  senza poteri non si apre una lega pubblica (%)', sqlerrm;
end $$;
update public.profiles set is_admin = true where id = 'user_pub1';
select public.crea_lega_pubblica('Titano Open','OPEN','Squadra Uno','#1B84C6','SU', 300, 3,
  '[{"posto":1,"premio":"Una cena"},{"posto":2,"premio":"Un caffe"}]'::jsonb) as lp \gset
select pg_temp.esige('si crea una lega pubblica', :'lp' is not null);
select pg_temp.esige('nasce pubblica e a punti',
  (select pubblica and classifica = 'punti' from public.leagues where id = :'lp'));
select pg_temp.esige('i crediti finiscono nelle regole e nella squadra',
  (select (rules->>'budget')::int = 300 from public.leagues where id = :'lp')
  and (select credits = 300 from public.league_members where league_id = :'lp' and user_id = 'user_pub1'));
select pg_temp.esige('i premi sono due, normalizzati',
  (select jsonb_array_length(premi) = 2 and premi->0->>'premio' = 'Una cena'
     and (premi->0->>'posto')::int = 1 from public.leagues where id = :'lp'));

-- si entra senza codice
select pg_temp.entra('user_pub2');
select public.entra_lega_pubblica(:'lp', 'Squadra Due', '#27ae60', 'SD');
select pg_temp.esige('si entra senza codice invito',
  (select count(*) from public.league_members where league_id = :'lp') = 2);
select pg_temp.esige('e con i crediti della lega, non con 500 d''ufficio',
  (select credits = 300 from public.league_members where league_id = :'lp' and user_id = 'user_pub2'));
-- rientrare non e' un errore e non crea un doppione
select public.entra_lega_pubblica(:'lp', 'Squadra Due', '#27ae60', 'SD');
select pg_temp.esige('rientrare non fa un doppione',
  (select count(*) from public.league_members where league_id = :'lp') = 2);

-- LO STESSO GIOCATORE in due rose: qui si deve poter fare
select pg_temp.entra('user_pub1');
insert into public.rosters (league_id, member_id, player_id, price_paid)
  values (:'lp', (select id from public.league_members where league_id = :'lp' and user_id='user_pub1'), 'giocatore-uno', 10);
insert into public.rosters (league_id, member_id, player_id, price_paid)
  values (:'lp', (select id from public.league_members where league_id = :'lp' and user_id='user_pub2'), 'giocatore-uno', 12);
select pg_temp.esige('nella lega pubblica lo stesso giocatore sta in due rose',
  (select count(*) from public.rosters where league_id = :'lp' and player_id = 'giocatore-uno' and released_at is null) = 2);
select pg_temp.esige('e la colonna dell''esclusivita'' resta nulla',
  (select count(*) from public.rosters where league_id = :'lp' and lega_esclusiva is not null) = 0);

-- ...mentre nella lega privata di Alex no, e il vincolo e' un indice unico
insert into public.rosters (league_id, member_id, player_id, price_paid)
  values (:'lega', (select id from public.league_members where league_id = :'lega' and user_id='user_alex'), 'giocatore-due', 10);
do $$
declare mid uuid;
begin
  select id into mid from public.league_members where league_id = (select id from public.leagues where name='Lega di prova') and user_id='user_bea';
  begin
    insert into public.rosters (league_id, member_id, player_id, price_paid)
      values ((select id from public.leagues where name='Lega di prova'), mid, 'giocatore-due', 10);
    raise exception 'FALLITA: nella lega privata il giocatore doveva restare esclusivo';
  exception when unique_violation then raise notice 'ok  nella lega privata il giocatore resta esclusivo';
  end;
end $$;

-- la lega al completo
select pg_temp.entra('user_pub3');
select public.entra_lega_pubblica(:'lp', 'Squadra Tre', '#8e44ad', 'ST');
select pg_temp.esige('il terzo entra e la lega e'' al completo (max 3)',
  (select count(*) from public.league_members where league_id = :'lp') = 3);
insert into public.profiles (id, display_name) values ('user_pub4', 'Quarto') on conflict (id) do nothing;
select pg_temp.entra('user_pub4');
do $$ begin
  perform public.entra_lega_pubblica((select id from public.leagues where name='Titano Open'), 'Squadra Quattro', '#c0392b', 'SQ');
  raise exception 'FALLITA: il quarto non doveva entrare in una lega da tre';
exception when others then
  if sqlerrm like 'FALLITA%' then raise; end if;
  raise notice 'ok  il quarto trova la lega al completo (%)', sqlerrm;
end $$;

-- una lega privata non si apre senza codice
do $$ begin
  perform public.entra_lega_pubblica((select id from public.leagues where name='Lega di prova'), 'Intrusa', '#000000', 'IN');
  raise exception 'FALLITA: nella lega privata si doveva entrare solo col codice';
exception when others then
  if sqlerrm like 'FALLITA%' then raise; end if;
  raise notice 'ok  la lega privata non si apre senza codice (%)', sqlerrm;
end $$;

-- l'elenco: numeri e nomi di lega, e dice se ci sei dentro
select pg_temp.entra('user_pub4');
select pg_temp.esige('l''elenco delle pubbliche mostra la lega con i suoi iscritti',
  (select membri = 3 and max_membri = 3 and budget = 300 and not dentro
     from public.leghe_pubbliche() where name = 'Titano Open'));
select pg_temp.esige('e non ci mette dentro le leghe private',
  not exists (select 1 from public.leghe_pubbliche() where name = 'Lega di prova'));
select pg_temp.entra('user_pub1');
select pg_temp.esige('a chi e'' dentro lo dice',
  (select dentro from public.leghe_pubbliche() where name = 'Titano Open'));

-- i premi: li cambia solo chi amministra, e la forma si controlla
select pg_temp.entra('user_pub2');
do $$ begin
  perform public.imposta_premi((select id from public.leagues where name='Titano Open'), '[]'::jsonb);
  raise exception 'FALLITA: un partecipante non doveva poter cambiare i premi';
exception when others then
  if sqlerrm like 'FALLITA%' then raise; end if;
  raise notice 'ok  i premi non li cambia un partecipante (%)', sqlerrm;
end $$;
select pg_temp.entra('user_pub1');
select public.imposta_premi((select id from public.leagues where name='Titano Open'),
  '[{"posto":"1","premio":"  Coppa del Titano  "}]'::jsonb);
select pg_temp.esige('l''amministratore li cambia, e la descrizione arriva ripulita',
  (select premi->0->>'premio' = 'Coppa del Titano' from public.leagues where name='Titano Open'));
do $$ begin
  perform public.imposta_premi((select id from public.leagues where name='Titano Open'), '[{"posto":0,"premio":"x"}]'::jsonb);
  raise exception 'FALLITA: il posto 0 non doveva passare';
exception when others then
  if sqlerrm like 'FALLITA%' then raise; end if;
  raise notice 'ok  un posto fuori scala non passa (%)', sqlerrm;
end $$;
do $$ begin
  perform public.imposta_premi((select id from public.leagues where name='Titano Open'), '[{"posto":1}]'::jsonb);
  raise exception 'FALLITA: un premio senza descrizione non doveva passare';
exception when others then
  if sqlerrm like 'FALLITA%' then raise; end if;
  raise notice 'ok  un premio senza descrizione non passa (%)', sqlerrm;
end $$;

-- e una lega pubblica non puo' finire a scontri diretti
do $$ begin
  update public.leagues set classifica = 'scontri' where name = 'Titano Open';
  raise exception 'FALLITA: pubblica + scontri diretti non doveva passare';
exception when check_violation then raise notice 'ok  una lega pubblica non puo'' andare a scontri diretti';
end $$;

-- ------------------------------------------------------- console admin (014)
--
-- Il pezzo che conta e' l'ultimo: che non si possa diventare amministratori
-- da soli. Prima della 014 la policy su profiles guardava solo is_judge,
-- quindi una colonna nuova non era protetta e chiunque poteva promuoversi.
select pg_temp.entra('user_pub2');
do $$ begin
  perform public.admin_riepilogo();
  raise exception 'FALLITA: un utente normale non doveva leggere il riepilogo';
exception when others then
  if sqlerrm like 'FALLITA%' then raise; end if;
  raise notice 'ok  il riepilogo e'' chiuso a chi non amministra (%)', sqlerrm;
end $$;
do $$ begin
  perform public.admin_utenti(null, 10);
  raise exception 'FALLITA: un utente normale non doveva leggere l''elenco delle persone';
exception when others then
  if sqlerrm like 'FALLITA%' then raise; end if;
  raise notice 'ok  l''elenco delle persone e'' chiuso (%)', sqlerrm;
end $$;
do $$ begin
  perform public.admin_imposta_ruolo('user_pub2', 'is_admin', true);
  raise exception 'FALLITA: non si doveva poter nominare nessuno';
exception when others then
  if sqlerrm like 'FALLITA%' then raise; end if;
  raise notice 'ok  i ruoli non li cambia chi non amministra (%)', sqlerrm;
end $$;
-- ...e nemmeno scrivendo direttamente sul proprio profilo.
--
-- QUESTO PEZZO VA FATTO COL RUOLO VERO. Il resto del file gira come
-- postgres, che e' superutente: la RLS non gli si applica, e il primo
-- tentativo di questa prova passava l'aggiornamento e diceva che il buco
-- c'era. Con "set role authenticated" si diventa il ruolo che usa PostgREST
-- per chi ha fatto l'accesso, e le policy contano.
set role authenticated;
do $$ begin
  begin
    update public.profiles set is_admin = true where id = 'user_pub2';
    raise notice 'ATTENZIONE: l''aggiornamento e'' passato';
  exception when others then raise notice 'ok  promuoversi amministratore viene rifiutato (%)', sqlerrm;
  end;
  begin
    update public.profiles set is_judge = true where id = 'user_pub2';
    raise notice 'ATTENZIONE: l''aggiornamento e'' passato';
  exception when others then raise notice 'ok  nominarsi Giudice Dati viene rifiutato (%)', sqlerrm;
  end;
  -- ma il nome se lo cambia, che e' roba sua: se cadesse anche questo, la
  -- policy sarebbe troppo stretta e non si capirebbe dalle altre due
  update public.profiles set display_name = 'Secondo detto Cip' where id = 'user_pub2';
end $$;
reset role;
select pg_temp.esige('nessuno si promuove amministratore da solo',
  not (select is_admin from public.profiles where id = 'user_pub2'));
select pg_temp.esige('ne'' si nomina Giudice Dati da solo',
  not (select is_judge from public.profiles where id = 'user_pub2'));
select pg_temp.esige('il proprio nome invece si cambia',
  (select display_name from public.profiles where id = 'user_pub2') = 'Secondo detto Cip');

select pg_temp.entra('user_pub1');
select pg_temp.esige('l''amministratore legge il riepilogo',
  (public.admin_riepilogo()->>'utenti')::int >= 3);
select pg_temp.esige('e ci trova le leghe pubbliche contate',
  (public.admin_riepilogo()->>'leghe_pubbliche')::int >= 1);
select pg_temp.esige('l''elenco delle persone porta l''e-mail e l''ultimo accesso',
  exists (select 1 from public.admin_utenti(null, 100) where id = 'user_pub1'));
select pg_temp.esige('la ricerca per nome funziona',
  exists (select 1 from public.admin_utenti('Secondo', 50) where id = 'user_pub2'));
select pg_temp.esige('l''elenco delle leghe vede anche quelle di cui non fa parte',
  (select count(*) from public.admin_leghe(200)) >= 2);
select public.admin_imposta_ruolo('user_pub3', 'is_judge', true);
select pg_temp.esige('l''amministratore nomina un Giudice Dati',
  (select is_judge from public.profiles where id = 'user_pub3'));
select public.admin_imposta_ruolo('user_pub3', 'is_judge', false);
select pg_temp.esige('e glielo toglie',
  not (select is_judge from public.profiles where id = 'user_pub3'));
do $$ begin
  perform public.admin_imposta_ruolo('user_pub1', 'is_admin', false);
  raise exception 'FALLITA: non doveva potersi togliere l''amministrazione da solo';
exception when others then
  if sqlerrm like 'FALLITA%' then raise; end if;
  raise notice 'ok  non si toglie l''amministrazione a se stessi (%)', sqlerrm;
end $$;
do $$ begin
  perform public.admin_imposta_ruolo('user_pub1', 'is_padrone', true);
  raise exception 'FALLITA: un ruolo inventato non doveva passare';
exception when others then
  if sqlerrm like 'FALLITA%' then raise; end if;
  raise notice 'ok  un ruolo che non esiste non passa (%)', sqlerrm;
end $$;

-- ------------------------------------------------------ moderazione (015)
--
-- Due strumenti diversi: rinominare quello che si vede, e fermare chi lo
-- scrive. Si prova tutto e due le volte — che chi amministra possa, e che chi
-- non amministra NON possa — perche' una funzione SECURITY DEFINER senza il
-- controllo dentro e' una porta aperta con l'insegna chiusa.
--
-- E si prova anche il caso NORMALE: che prima della sospensione la formazione
-- si salvi e la contestazione si scriva. Se la condizione nuova nelle due
-- policy fosse storta, il gioco si fermerebbe per tutti e nessuna prova sulla
-- sospensione lo vedrebbe: passerebbero tutte, dicendo che il sospeso non
-- scrive.
--
-- NOTA SU psql: dentro un blocco dollar-quoted ($$ ... $$) le variabili di
-- psql NON vengono sostituite — il ":" arriva al server e si becca un errore
-- di sintassi. I valori che servono dentro i blocchi passano da set_config,
-- che e' di sessione e si legge anche dopo "set role".
select matchday from public.matchday_locks where lock_at > now() order by matchday limit 1 \gset aperta_
select id from public.league_members where league_id = :'lega' and user_id = 'user_bea' \gset m_bea_
select set_config('prova.lega', :'lega', false),
       set_config('prova.membro', :'m_bea_id', false),
       set_config('prova.giornata', :aperta_matchday::text, false);

select pg_temp.entra('user_bea');
set role authenticated;
insert into public.lineups (league_id, member_id, matchday, lineup)
  values (:'lega', :'m_bea_id', :aperta_matchday, '{"modulo":"4-4-2"}'::jsonb);
insert into public.contestazioni (league_id, member_id, match_id, text)
  values (:'lega', :'m_bea_id', 'md1_prova', 'il gol non era suo');
reset role;
select pg_temp.esige('prima della sospensione la formazione si salva',
  exists (select 1 from public.lineups where member_id = :'m_bea_id' and matchday = :aperta_matchday));
select pg_temp.esige('e la contestazione si scrive',
  exists (select 1 from public.contestazioni where member_id = :'m_bea_id'));

-- l'elenco delle squadre, per arrivare al nome da cambiare
select pg_temp.entra('user_pub1');
select pg_temp.esige('l''elenco delle squadre trova per nome squadra',
  exists (select 1 from public.admin_squadre('Borgo', 50)));
select pg_temp.esige('e per nome lega',
  exists (select 1 from public.admin_squadre('Lega di prova', 50)));
select public.admin_rinomina(:'m_bea_id', 'Nome Pulito FC');
select pg_temp.esige('chi amministra l''app rinomina una squadra altrui',
  (select team_name from public.league_members where id = :'m_bea_id') = 'Nome Pulito FC');
select pg_temp.esige('e le iniziali si ricalcolano da se''',
  (select initials from public.league_members where id = :'m_bea_id') = 'NPF');
do $$ begin
  perform public.admin_rinomina(current_setting('prova.membro')::uuid, '   ');
  raise exception 'FALLITA: un nome vuoto non doveva passare';
exception when others then
  if sqlerrm like 'FALLITA%' then raise; end if;
  raise notice 'ok  un nome vuoto non passa (%)', sqlerrm;
end $$;

-- chi non amministra non tocca niente
select pg_temp.entra('user_bea');
do $$ begin
  perform public.admin_rinomina(current_setting('prova.membro')::uuid, 'Me la rinomino io');
  raise exception 'FALLITA: un utente normale non doveva poter rinominare';
exception when others then
  if sqlerrm like 'FALLITA%' then raise; end if;
  raise notice 'ok  un utente normale non rinomina le squadre (%)', sqlerrm;
end $$;
do $$ begin
  perform public.admin_sospendi('user_cip', true);
  raise exception 'FALLITA: un utente normale non doveva poter sospendere';
exception when others then
  if sqlerrm like 'FALLITA%' then raise; end if;
  raise notice 'ok  ne'' sospende nessuno (%)', sqlerrm;
end $$;
do $$ declare n int; begin
  select count(*) into n from public.admin_squadre(null, 50);
  raise exception 'FALLITA: un utente normale non doveva vedere le squadre di tutti (%)', n;
exception when others then
  if sqlerrm like 'FALLITA%' then raise; end if;
  raise notice 'ok  e non vede l''elenco delle squadre di tutti (%)', sqlerrm;
end $$;

-- sospendere
select pg_temp.entra('user_pub1');
do $$ begin
  perform public.admin_sospendi('user_pub1', true);
  raise exception 'FALLITA: non doveva potersi sospendere da solo';
exception when others then
  if sqlerrm like 'FALLITA%' then raise; end if;
  raise notice 'ok  non si sospende se stessi (%)', sqlerrm;
end $$;
select public.admin_imposta_ruolo('user_pub3', 'is_admin', true);
do $$ begin
  perform public.admin_sospendi('user_pub3', true);
  raise exception 'FALLITA: un amministratore non doveva potersi sospendere cosi''';
exception when others then
  if sqlerrm like 'FALLITA%' then raise; end if;
  raise notice 'ok  un amministratore prima si spoglia e poi si sospende (%)', sqlerrm;
end $$;
select public.admin_imposta_ruolo('user_pub3', 'is_admin', false);
select public.admin_sospendi('user_bea', true);
select pg_temp.esige('l''amministratore sospende', (select sospeso from public.profiles where id = 'user_bea'));
select pg_temp.esige('e l''elenco delle persone lo dice',
  (select sospeso from public.admin_persone(null, 200) where id = 'user_bea'));

-- e il sospeso non gioca piu'
select pg_temp.entra('user_bea');
select pg_temp.esige('il sospeso sa di esserlo', public.sono_sospeso());
do $$ begin
  perform public.join_league((select invite_code from public.leagues where pubblica limit 1), 'Ancora io', '#123456', 'AI');
  raise exception 'FALLITA: un sospeso non doveva poter entrare in un''altra lega';
exception when others then
  if sqlerrm like 'FALLITA%' then raise; end if;
  raise notice 'ok  un sospeso non entra in altre leghe (%)', sqlerrm;
end $$;
set role authenticated;
do $$ begin
  update public.lineups set lineup = '{"modulo":"3-5-2"}'::jsonb
   where member_id = current_setting('prova.membro')::uuid
     and matchday = current_setting('prova.giornata')::int;
  if found then raise exception 'FALLITA: un sospeso non doveva poter cambiare la formazione'; end if;
  raise notice 'ok  un sospeso non cambia la formazione (nessuna riga scritta)';
end $$;
do $$ begin
  insert into public.contestazioni (league_id, member_id, match_id, text)
    values (current_setting('prova.lega')::uuid, current_setting('prova.membro')::uuid, 'md2_prova', 'ci riprovo');
  raise exception 'FALLITA: un sospeso non doveva poter contestare';
exception when others then
  if sqlerrm like 'FALLITA%' then raise; end if;
  raise notice 'ok  un sospeso non contesta (%)', sqlerrm;
end $$;
do $$ begin
  update public.profiles set sospeso = false where id = 'user_bea';
exception when others then null;
end $$;
reset role;
select pg_temp.esige('e non si riattiva da solo', (select sospeso from public.profiles where id = 'user_bea'));

-- riattivare
select pg_temp.entra('user_pub1');
select public.admin_sospendi('user_bea', false);
select pg_temp.esige('l''amministratore riattiva', not (select sospeso from public.profiles where id = 'user_bea'));
select pg_temp.entra('user_bea');
set role authenticated;
update public.lineups set lineup = '{"modulo":"3-5-2"}'::jsonb
 where member_id = :'m_bea_id' and matchday = :aperta_matchday;
reset role;
select pg_temp.esige('e riattivato torna a schierare',
  (select lineup->>'modulo' from public.lineups where member_id = :'m_bea_id' and matchday = :aperta_matchday) = '3-5-2');

-- ---------------------------------------------------------------- 016: doppioni
-- I referti entrano in lega da soli, e l'app carica solo le giornate vuote.
-- Quel controllo sta nel browser: due Giudici che aprono l'app insieme
-- vedrebbero la stessa giornata vuota e la scriverebbero tutti e due. Qui si
-- controlla che il database dica di no.
select pg_temp.esige('l''indice unico sugli eventi c''e''',
  exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'match_events_unico'));
select pg_temp.entra('user_alex');   -- il Giudice Dati delle prove
set role authenticated;
insert into public.match_events (match_id, player_id, club_id, minute, type)
  values ('md9_m1', 'tale_10', 'tale', 55, 'goal');
do $$ begin
  insert into public.match_events (match_id, player_id, club_id, minute, type)
    values ('md9_m1', 'tale_10', 'tale', 55, 'goal');
  perform set_config('prova.doppione', 'passato', false);
exception when unique_violation then
  perform set_config('prova.doppione', 'rifiutato', false);
end $$;
select pg_temp.esige('lo stesso evento due volte viene rifiutato',
  current_setting('prova.doppione', true) = 'rifiutato');
select pg_temp.esige('e resta una riga sola',
  (select count(*) from public.match_events where match_id = 'md9_m1') = 1);
-- un evento diverso nello stesso minuto ci sta: l'ammonizione non e' il gol
insert into public.match_events (match_id, player_id, club_id, minute, type)
  values ('md9_m1', 'tale_10', 'tale', 55, 'yellow');
select pg_temp.esige('un altro tipo di evento nello stesso minuto passa',
  (select count(*) from public.match_events where match_id = 'md9_m1') = 2);
delete from public.match_events where match_id = 'md9_m1';
reset role;

select 'tutte le prove sulle funzioni sono passate' as esito;
