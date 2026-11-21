-- =====================================================================
-- 060 — Le colonne delicate di una lega non si toccano dall'app (21/11/2026)
--
-- Si può rieseguire. La policy leagues_update lascia scrivere chi amministra
-- la lega, e senza un muro su colonne e righe l'admin di una lega PRIVATA
-- poteva, con una chiamata diretta all'API:
--  - renderla pubblica (pubblica, classifica 'punti', max_membri 1000) e
--    farla comparire a tutti in leghe_pubbliche(), saltando la regola per
--    cui le leghe pubbliche le apre solo un amministratore dell'app (014);
--  - scriverci premi a piacere, senza passare da premi_validi();
--  - mettersi in created_by e poi cancellarla (leagues_delete), con rose e
--    formazioni di tutti.
-- Come membri_protetti (033): per anon e authenticated quei campi restano
-- com'erano; le funzioni dell'app (crea_lega_pubblica, imposta_premi...)
-- girano col loro proprietario e non sono toccate.
-- =====================================================================

create or replace function public.leghe_protette() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('anon', 'authenticated') then
    new.id := old.id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.season_id := old.season_id;
    new.pubblica := old.pubblica;
    new.classifica := old.classifica;
    new.max_membri := old.max_membri;
    new.premi := old.premi;
  end if;
  return new;
end $$;
revoke execute on function public.leghe_protette() from public, anon;

drop trigger if exists leghe_protette on public.leagues;
create trigger leghe_protette before update on public.leagues
  for each row execute function public.leghe_protette();
