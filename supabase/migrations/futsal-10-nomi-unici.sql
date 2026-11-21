-- =====================================================================
-- FUTSAL 10 — Due squadre non possono chiamarsi uguali (21/11/2026)
--
-- Si può rieseguire. Nelle classifiche del futsal ci sono tutti gli
-- iscritti insieme: due «Titani» non si distinguerebbero. Il confronto non
-- guarda maiuscole e spazi ai lati. Al 21/11 c'era un solo iscritto.
-- =====================================================================

create unique index if not exists futsal_iscritti_nome_unico
  on public.futsal_iscritti (lower(trim(squadra)));
