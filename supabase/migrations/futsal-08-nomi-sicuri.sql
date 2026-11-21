-- =====================================================================
-- FUTSAL 08 — Nomi di squadre e leghe senza < > " ` (come la 059)
-- Si può rieseguire. Usa public.nomi_sicuri() della 059.
-- =====================================================================

drop trigger if exists nomi_sicuri on public.futsal_leghe;
create trigger nomi_sicuri before insert or update of nome on public.futsal_leghe
  for each row execute function public.nomi_sicuri('nome');

drop trigger if exists nomi_sicuri on public.futsal_iscritti;
create trigger nomi_sicuri before insert or update of squadra on public.futsal_iscritti
  for each row execute function public.nomi_sicuri('squadra');
