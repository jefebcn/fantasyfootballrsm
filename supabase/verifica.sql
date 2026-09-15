-- Cosa e' gia' stato applicato a questo progetto, e cosa manca.
--
-- Da incollare nell'SQL Editor di Supabase: non scrive niente, guarda e
-- riferisce. Serve per non dover ricordare quali file sono stati eseguiti,
-- ne' fidarsi di quello che c'e' scritto in una chat.
--
-- Le migrazioni sono tutte ripetibili (if not exists, create or replace,
-- drop policy if exists): rieseguirne una gia' fatta non rompe nulla.

select 'schema.sql'                        as da_eseguire,
       'tabella leagues'                   as cosa,
       case when to_regclass('public.leagues') is not null
            then 'fatto' else 'DA FARE' end as stato
union all
select '001-identita-esterna.sql', 'funzione create_league',
       case when to_regprocedure('public.create_league(text,text,text,text,text)') is not null
            then 'fatto' else 'DA FARE' end
union all
select '002-squadra-e-lega.sql', 'colonna vice_user_id su league_members',
       case when exists (select 1 from information_schema.columns
                          where table_schema = 'public' and table_name = 'league_members'
                            and column_name = 'vice_user_id')
            then 'fatto' else 'DA FARE' end
union all
select '003-abbandona-lega.sql', 'funzione abbandona_lega',
       case when to_regprocedure('public.abbandona_lega(uuid)') is not null
            then 'fatto' else 'DA FARE' end
union all
select '004-lock-dal-calendario.sql', 'tabella matchday_locks (il lock delle formazioni)',
       case when to_regclass('public.matchday_locks') is not null
            then 'fatto' else 'DA FARE' end
union all
select '004-lock-dal-calendario.sql', 'funzione sync_matchday_locks',
       case when to_regprocedure('public.sync_matchday_locks(jsonb)') is not null
            then 'fatto' else 'DA FARE' end
union all
select '005-notifiche-push.sql', 'tabella push_subscriptions',
       case when to_regclass('public.push_subscriptions') is not null
            then 'fatto' else 'DA FARE' end
union all
select '005-notifiche-push.sql', 'funzione da_avvisare',
       case when to_regprocedure('public.da_avvisare(integer)') is not null
            then 'fatto' else 'DA FARE' end
union all
select '006-scambi.sql', 'tabella trades (scambi fra squadre)',
       case when to_regclass('public.trades') is not null
            then 'fatto' else 'DA FARE' end
union all
select '006-scambi.sql', 'funzione accetta_scambio',
       case when to_regprocedure('public.accetta_scambio(uuid)') is not null
            then 'fatto' else 'DA FARE' end
union all
select '007-mercato-svincolati.sql', 'tabella offerte (mercato svincolati)',
       case when to_regclass('public.offerte') is not null
            then 'fatto' else 'DA FARE' end
union all
select '007-mercato-svincolati.sql', 'funzione risolvi_offerte',
       case when to_regprocedure('public.risolvi_offerte(uuid)') is not null
            then 'fatto' else 'DA FARE' end
order by 1, 2;
