-- 036 — Formazioni senza posti vuoti
-- La 034 ha lasciato "" al posto del doppione nelle formazioni che avevano
-- anche il giocatore vero, e l'app si bloccava. Qui si tolgono.
-- Si può rieseguire.

-- 1. quante sono (prima)
select count(*) as formazioni_con_buchi from public.lineups where lineup::text like '%""%';

-- 2. via i posti vuoti, capitano e vice vuoti diventano null
update public.lineups set lineup =
  jsonb_set(jsonb_set(lineup,
    '{starters}', coalesce((select jsonb_agg(x) from jsonb_array_elements(lineup->'starters') x where x <> '""'::jsonb), '[]'::jsonb)),
    '{bench}', coalesce((select jsonb_agg(x) from jsonb_array_elements(lineup->'bench') x where x <> '""'::jsonb), '[]'::jsonb))
  - (case when lineup->>'captainId' = '' then 'captainId' else '' end)
  - (case when lineup->>'viceCaptainId' = '' then 'viceCaptainId' else '' end)
 where lineup::text like '%""%';

-- 3. controllo (dopo): deve essere 0
select count(*) as formazioni_con_buchi from public.lineups where lineup::text like '%""%';
