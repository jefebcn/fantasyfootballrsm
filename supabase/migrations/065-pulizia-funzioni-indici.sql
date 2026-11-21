-- =====================================================================
-- 065 — Pulizia del database (21/11/2026)
--
-- Si può rieseguire. Due avvisi del controllo di Supabase, senza cambiare
-- niente di quello che le funzioni fanno:
--
-- 1. Dodici funzioni (trigger e piccole utilità) usavano il search_path di
--    chi le chiama: ora è fisso a public (interno, public per html_sicuro),
--    che è dove stanno le tabelle che leggono. Nessuna è SECURITY DEFINER.
-- 2. Indici sulle colonne delle chiavi esterne che non ne avevano uno:
--    cancellare una lega, un membro o un utente non deve scorrere tabelle
--    intere per controllare i riferimenti.
-- =====================================================================

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as firma, n.nspname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where (n.nspname, p.proname) in (
      ('public', 'matchday_of'), ('public', 'guard_frozen'), ('public', 'membri_protetti'),
      ('public', 'ruoli_protetti'), ('public', 'current_user_id'), ('public', 'trade_conta'),
      ('public', 'reclutati_protetti'), ('public', 'premi_reclutatore'), ('public', 'chiusura_non_prima'),
      ('public', 'squadra_valida'), ('public', 'creatore_resta'), ('interno', 'html_sicuro'))
  loop
    execute format('alter function %s set search_path = %s', f.firma,
      case when f.nspname = 'interno' then 'interno, public' else 'public' end);
  end loop;
end $$;

do $$
declare
  i record;
begin
  for i in select * from (values
    ('adesioni_giocatori', 'versione'), ('app_interruttori', 'cambiato_da'), ('change_log', 'by_user'),
    ('contestazioni', 'league_id'), ('contestazioni', 'member_id'), ('formazioni_bozze', 'member_id'),
    ('futsal_leghe', 'creata_da'), ('futsal_membri', 'user_id'), ('futsal_mercato_avvisati', 'user_id'),
    ('league_members', 'user_id'), ('league_members', 'vice_user_id'), ('leagues', 'created_by'),
    ('lineups', 'member_id'), ('match_events', 'created_by'), ('match_overrides', 'updated_by'),
    ('matchday_locks', 'updated_by'), ('matchday_status', 'changed_by'), ('offerte', 'member_id'),
    ('promemoria_inviati', 'league_id'), ('promemoria_inviati', 'member_id'), ('prove_consenso', 'adesione_id'),
    ('rosters', 'league_id'), ('rosters', 'member_id'), ('sponsor', 'creato_da'),
    ('squalifiche', 'created_by'), ('trades', 'da_member'), ('trades', 'deciso_da')) as t(tabella, colonna)
  loop
    -- solo dove tabella e colonna ci sono (le prove locali partono da zero)
    if exists (select 1 from information_schema.columns c
               where c.table_schema = 'public' and c.table_name = i.tabella and c.column_name = i.colonna) then
      execute format('create index if not exists %I on public.%I (%I)', i.tabella || '_' || i.colonna || '_fk', i.tabella, i.colonna);
    end if;
  end loop;
end $$;
