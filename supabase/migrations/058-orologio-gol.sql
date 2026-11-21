-- 058 · L'orologio delle storie dei gol (Alex, 20/11: «quasi istantaneo»).
--
-- pg_cron chiama ogni 2 minuti la funzione orologio-gol
-- (supabase/functions/orologio-gol): se c'e' una partita fra meno di 30
-- minuti o in corso e nessun turno delle storie dei gol sta girando, la
-- funzione fa partire subito il lavoro .github/workflows/storie-gol.yml con
-- workflow_dispatch, che GitHub serve in pochi secondi (le corse pianificate
-- di GitHub invece arrivano con ore di ritardo).
--
-- Qui non c'e' nessun token: quello di GitHub sta nei secret delle Edge
-- Functions (GITHUB_TOKEN_OROLOGIO). La funzione e' pubblica e innocua: fa
-- partire al massimo un turno, e solo se serve.
--
-- Si puo' rilanciare: ripianifica senza duplicare.
-- Per vedere com'e' andata:
--   select status_code, content, created from net._http_response order by id desc limit 10;

-- Dove pg_cron non c'e' (il Postgres delle prove in CI) il file non fa niente
-- e lo dice: l'orologio serve solo sul progetto Supabase vero.
do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron')
     or not exists (select 1 from pg_available_extensions where name = 'pg_net') then
    raise notice 'orologio-gol: pg_cron o pg_net non disponibili qui, salto';
    return;
  end if;
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then create extension pg_cron; end if;
  if not exists (select 1 from pg_extension where extname = 'pg_net') then create extension pg_net; end if;

  execute $q$select cron.unschedule(jobid) from cron.job where jobname = 'orologio-gol'$q$;
  execute $q$select cron.schedule(
    'orologio-gol',
    '*/2 * * * *',
    $c$select net.http_post(
        url := 'https://nskgzpbcssnpfuxmbepa.supabase.co/functions/v1/orologio-gol',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := '{}'::jsonb,
        timeout_milliseconds := 20000)$c$
  )$q$;
end $$;
