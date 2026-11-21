-- =====================================================================
-- 063 — Il turno infrasettimanale si chiude due giorni dopo (21/11/2026)
--
-- Si può rieseguire. Con la 035 una giornata si chiude dal martedì alle
-- 20:00 dopo le formazioni: per un turno di martedì sera voleva dire il
-- martedì DOPO (l'11ª del 1/12 si sarebbe chiusa l'8/12, insieme alla 12ª),
-- e per un martedì pomeriggio la sera stessa, a referto non finito. Ora, se
-- le formazioni chiudono da lunedì a giovedì, la giornata si chiude due
-- giorni dopo alle 20:00; il fine settimana resta com'era. La stessa regola
-- sta in src/chiusura.js (tests/chiusura-giornata.test.js).
-- =====================================================================

create or replace function public.chiusura_giornata(n int) returns timestamptz
language sql stable security definer set search_path = public as $$
  select case when l is null then null
    when extract(isodow from l)::int between 1 and 4 then
      (date_trunc('day', l) + interval '2 days' + interval '20 hours') at time zone 'Europe/Rome'
    else
      (date_trunc('day', l) + make_interval(days => ((9 - extract(isodow from l)::int) % 7))
         + case when ((9 - extract(isodow from l)::int) % 7) = 0 and extract(hour from l) >= 20
                then interval '7 days' else interval '0' end
         + interval '20 hours') at time zone 'Europe/Rome'
  end
  from (select public.matchday_lock_at(n) at time zone 'Europe/Rome' as l) x
$$;
