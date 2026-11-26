-- I personaggi somiglianti (072): consenso v2 con la casella, maggiorenni,
-- approvazione del disegno, ritiro automatico, niente per chi non amministra.
\set ON_ERROR_STOP on

create or replace function pg_temp.entra(p text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', case when p is null then '' else json_build_object('sub', p)::text end, false); end $$;
create or replace function pg_temp.esige(descrizione text, condizione boolean) returns void language plpgsql as $$
begin
  if condizione then raise notice 'ok  %', descrizione;
  else raise exception 'FALLITA: %', descrizione; end if;
end $$;
-- verifica una richiesta come farebbe chi amministra: screenshot e giocatore
create or replace function pg_temp.verifica(p_codice text, p_player text) returns void language plpgsql as $$
declare pid bigint;
begin
  insert into public.prove_consenso (adesione_id, tipo, dati)
    select id, 'image/png', 'data:image/png;base64,iVBORw0KGgo=' || p_codice from public.adesioni_giocatori where codice = p_codice
    returning id into pid;
  update public.adesioni_giocatori set stato = 'verificato', verificato_come = 'instagram', player_id = p_player,
    prova = pid::text, verificato_at = now() where codice = p_codice;
end $$;

insert into public.profiles (id, display_name, is_admin) values ('per_admin', 'Admin', true), ('per_tizio', 'Tizio', false)
on conflict (id) do update set is_admin = excluded.is_admin;
update public.app_interruttori set acceso = false where chiave = 'nomi_brevi';

select pg_temp.esige('il testo v2 c''e'', con la sua impronta e la casella del personaggio',
  (select impronta = encode(sha256(convert_to(testo, 'UTF8')), 'hex') and testo like '%Voglio il mio personaggio%'
          and testo like '%30 giorni%' and testo like '%Google Gemini%' and position(E'\r' in testo) = 0
     from public.consensi_testi where versione = 'v2 · 26/11/2026'));

-- il calciatore chiede il personaggio dalla pagina, senza account
select pg_temp.entra(null);
select set_config('request.headers', '{"x-forwarded-for":"203.0.113.9","user-agent":"Prova/2.0"}', false);
set role anon;
insert into public.adesioni_giocatori (nome, squadra, scelta, sponsor, personaggio, maggiorenne, instagram, codice, versione)
  values ('Gino Bianchi', 'Folgore', 'aderisco', false, true, true, '@gino', 'FT-PG01', 'v2 · 26/11/2026');
do $$ begin
  insert into public.adesioni_giocatori (nome, scelta, personaggio, maggiorenne, genitore, codice, versione)
    values ('Ragazzo', 'aderisco', true, false, 'Mamma Rossi', 'FT-PG09', 'v2 · 26/11/2026');
  raise exception 'FALLITA: un minorenne chiede il personaggio';
exception when check_violation then raise notice 'ok  sotto i 18 anni niente personaggio, nemmeno col genitore';
end $$;
do $$ begin
  insert into public.adesioni_giocatori (nome, scelta, personaggio, maggiorenne, codice) values ('No', 'escludimi', true, true, 'FT-PG08');
  raise exception 'FALLITA: il personaggio senza il «Ci sto»';
exception when check_violation then raise notice 'ok  il personaggio solo per chi dice «Ci sto»';
end $$;
select pg_temp.esige('le foto si caricano nella cartella del proprio codice', public.selfie_ammesso('FT-PG01/fronte.jpg')
  and public.selfie_ammesso('FT-PG01/tre-quarti.webp'));
select pg_temp.esige('e solo con quei nomi, e solo per una richiesta col personaggio',
  not public.selfie_ammesso('FT-PG01/altro.png') and not public.selfie_ammesso('FT-ZZ00/fronte.jpg')
  and not public.selfie_ammesso('../FT-PG01/fronte.jpg'));
select pg_temp.esige('nessun personaggio attivo per ora', (select count(*) from public.personaggi_attivi()) = 0);
reset role;

-- prima della verifica non si disegna
select pg_temp.entra('per_admin');
set role authenticated;
do $$ begin
  insert into public.personaggi (player_id, adesione_id) select 'folgore_9', id from public.adesioni_giocatori where codice = 'FT-PG01';
  raise exception 'FALLITA: un personaggio prima della verifica';
exception when others then
  if sqlerrm like 'FALLITA%' then raise; end if;
  raise notice 'ok  prima della verifica niente personaggio (%)', sqlerrm;
end $$;
reset role;
select pg_temp.verifica('FT-PG01', 'folgore_9');
set role authenticated;
do $$ begin
  update public.adesioni_giocatori set personaggio = false where codice = 'FT-PG01';
  raise exception 'FALLITA: la casella del personaggio si e'' cambiata dopo l''invio';
exception when others then
  if sqlerrm like 'FALLITA%' then raise; end if;
  raise notice 'ok  la casella del personaggio non si ritocca (%)', sqlerrm;
end $$;
do $$ begin
  insert into public.personaggi (player_id, adesione_id) select 'virtus_1', id from public.adesioni_giocatori where codice = 'FT-PG01';
  raise exception 'FALLITA: un consenso usato per un altro giocatore';
exception when others then
  if sqlerrm like 'FALLITA%' then raise; end if;
  raise notice 'ok  il consenso vale solo per il giocatore verificato (%)', sqlerrm;
end $$;
insert into public.personaggi (player_id, adesione_id, stato) select 'folgore_9', id, 'approvato' from public.adesioni_giocatori where codice = 'FT-PG01';
select pg_temp.esige('un personaggio nuovo parte in lavorazione, anche se chi lo crea scrive «approvato»',
  (select stato = 'lavorazione' from public.personaggi where player_id = 'folgore_9'));
update public.personaggi set file = 'folgore_9-0123456789abcdef' where player_id = 'folgore_9';
select pg_temp.esige('caricato il disegno, aspetta il giocatore', (select stato = 'da_approvare' from public.personaggi where player_id = 'folgore_9'));
do $$ begin
  update public.personaggi set file = 'virtus_1-0123456789abcdef' where player_id = 'folgore_9';
  raise exception 'FALLITA: il file di un altro giocatore';
exception when check_violation then raise notice 'ok  il nome del file comincia con l''id del giocatore';
end $$;
do $$ begin
  update public.personaggi set stato = 'approvato' where player_id = 'folgore_9';
  raise exception 'FALLITA: approvato senza dire come';
exception when others then
  if sqlerrm like 'FALLITA%' then raise; end if;
  raise notice 'ok  si approva dicendo come l''ha approvato il giocatore (%)', sqlerrm;
end $$;
reset role;

-- il calciatore vede il disegno col suo codice e lo approva
select pg_temp.entra(null);
set role anon;
select pg_temp.esige('col codice il calciatore vede il disegno da approvare',
  (select file = 'folgore_9-0123456789abcdef' and stato = 'da_approvare' from public.personaggio_bozza('ft-pg01 ')));
select pg_temp.esige('con un codice sbagliato non vede niente', (select count(*) from public.personaggio_bozza('FT-ZZ00')) = 0);
do $$ begin
  perform public.personaggio_rispondi('FT-ZZ00', 'si');
  raise exception 'FALLITA: un codice sbagliato approva';
exception when others then
  if sqlerrm like 'FALLITA%' then raise; end if;
  raise notice 'ok  un codice sbagliato non approva (%)', sqlerrm;
end $$;
do $$ begin
  perform 1 from public.personaggi;
  raise exception 'FALLITA: chi passa legge la tabella dei personaggi';
exception when insufficient_privilege then raise notice 'ok  chi passa non legge la tabella dei personaggi';
end $$;
select pg_temp.esige('lui risponde «si»', public.personaggio_rispondi('FT-PG01', 'si') = 'approvato');
select pg_temp.esige('e il personaggio compare per tutti, anche senza account',
  exists (select 1 from public.personaggi_attivi() where player_id = 'folgore_9' and file = 'folgore_9-0123456789abcdef'));
reset role;
select pg_temp.esige('come e quando l''ha approvato lo scrive il database',
  (select approvato_come = 'pagina' and approvato_at > now() - interval '1 minute' from public.personaggi where player_id = 'folgore_9'));

-- chi non amministra non tocca niente
select set_config('prova.pg01', id::text, false) from public.adesioni_giocatori where codice = 'FT-PG01';
select pg_temp.entra('per_tizio');
set role authenticated;
select pg_temp.esige('un giocatore qualunque non legge la tabella', (select count(*) from public.personaggi) = 0);
do $$ begin
  -- l'id lo prende da fuori: lui le richieste non le legge
  insert into public.personaggi (player_id, adesione_id) values ('virtus_2', current_setting('prova.pg01')::bigint);
  raise exception 'FALLITA: un giocatore qualunque crea un personaggio';
exception when others then
  if sqlerrm like 'FALLITA%' then raise; end if;
  raise notice 'ok  un giocatore qualunque non crea personaggi (%)', sqlerrm;
end $$;
reset role;

select pg_temp.entra('per_tizio');
set role authenticated;
update public.personaggi set stato = 'ritirato' where player_id = 'folgore_9';
reset role;
select pg_temp.esige('e non ritocca quelli che ci sono', (select stato = 'approvato' from public.personaggi where player_id = 'folgore_9'));

-- modalita' dei nomi brevi: niente personaggi
update public.app_interruttori set acceso = true where chiave = 'nomi_brevi';
select pg_temp.esige('coi nomi brevi accesi i personaggi spariscono', (select count(*) from public.personaggi_attivi()) = 0);
update public.app_interruttori set acceso = false where chiave = 'nomi_brevi';

-- un disegno nuovo si riapprova
select pg_temp.entra('per_admin');
set role authenticated;
update public.personaggi set file = 'folgore_9-fedcba9876543210' where player_id = 'folgore_9';
select pg_temp.esige('un disegno nuovo torna da approvare e sparisce finche'' non lo approva',
  (select stato = 'da_approvare' and approvato_at is null from public.personaggi where player_id = 'folgore_9')
  and not exists (select 1 from public.personaggi_attivi() where player_id = 'folgore_9'));
update public.personaggi set stato = 'approvato', approvato_come = 'instagram' where player_id = 'folgore_9';
select pg_temp.esige('approvato in privato su Instagram, torna', exists (select 1 from public.personaggi_attivi() where player_id = 'folgore_9'));
reset role;

-- il calciatore cambia idea: «Non voglio comparire», verificato
select pg_temp.entra(null);
set role anon;
insert into public.adesioni_giocatori (nome, squadra, scelta, maggiorenne, codice, versione)
  values ('Gino Bianchi', 'Folgore', 'escludimi', true, 'FT-PG02', 'v2 · 26/11/2026');
reset role;
select pg_temp.entra('per_admin');
select pg_temp.verifica('FT-PG02', 'folgore_9');
select pg_temp.esige('il ritiro mette il personaggio in «ritirato», da solo',
  (select stato = 'ritirato' and ritirato_at is not null from public.personaggi where player_id = 'folgore_9'));
select pg_temp.esige('e non compare piu''', not exists (select 1 from public.personaggi_attivi() where player_id = 'folgore_9'));
set role authenticated;
select pg_temp.esige('il file e'' nella lista da cancellare', exists (select 1 from public.personaggi_da_cancellare() where player_id = 'folgore_9'));
select pg_temp.esige('e le foto pure', exists (select 1 from public.selfie_da_cancellare() where codice = 'FT-PG01'));
do $$ begin
  update public.personaggi set stato = 'approvato', approvato_come = 'instagram' where player_id = 'folgore_9';
  raise exception 'FALLITA: un personaggio ritirato torna senza un consenso nuovo';
exception when others then
  if sqlerrm like 'FALLITA%' then raise; end if;
  raise notice 'ok  un personaggio ritirato torna solo con un consenso nuovo (%)', sqlerrm;
end $$;
update public.personaggi set file = null where player_id = 'folgore_9';
update public.adesioni_giocatori set selfie_cancellate_at = now() where codice = 'FT-PG01';
select pg_temp.esige('cancellato il file, la lista si svuota',
  not exists (select 1 from public.personaggi_da_cancellare()) and not exists (select 1 from public.selfie_da_cancellare() where codice = 'FT-PG01'));
reset role;

-- un altro: approvato, poi escluso (041) da chi amministra
select pg_temp.entra(null);
set role anon;
insert into public.adesioni_giocatori (nome, squadra, scelta, personaggio, maggiorenne, codice, versione)
  values ('Vito Verdi', 'Virtus', 'aderisco', true, true, 'FT-PG03', 'v2 · 26/11/2026');
reset role;
select pg_temp.entra('per_admin');
select pg_temp.verifica('FT-PG03', 'virtus_7');
set role authenticated;
insert into public.personaggi (player_id, adesione_id, file) select 'virtus_7', id, 'virtus_7-00000000000000aa' from public.adesioni_giocatori where codice = 'FT-PG03';
reset role;
select pg_temp.entra(null);
set role anon;
select pg_temp.esige('«rifatelo» lo rimanda in lavorazione', public.personaggio_rispondi('FT-PG03', 'rifare') = 'lavorazione');
reset role;
select pg_temp.entra('per_admin');
set role authenticated;
update public.personaggi set file = 'virtus_7-00000000000000bb' where player_id = 'virtus_7';
reset role;
select pg_temp.entra(null);
set role anon;
select pg_temp.esige('il secondo disegno gli va bene', public.personaggio_rispondi('FT-PG03', 'si') = 'approvato');
reset role;
select pg_temp.entra('per_admin');
set role authenticated;
insert into public.giocatori_esclusi (player_id, nota) values ('virtus_7', 'prova');
select pg_temp.esige('l''esclusione ritira il personaggio', (select stato = 'ritirato' from public.personaggi where player_id = 'virtus_7')
  and not exists (select 1 from public.personaggi_attivi() where player_id = 'virtus_7'));
select pg_temp.esige('ogni passaggio e'' nel registro dei consensi',
  (select count(*) from public.consensi_registro where evento like 'personaggio_%') >= 10);
select pg_temp.esige('e la catena del registro e'' ancora intera', (select integro from public.verifica_registro()));
reset role;
delete from public.giocatori_esclusi where player_id = 'virtus_7';
