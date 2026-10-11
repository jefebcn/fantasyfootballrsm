-- =====================================================================
-- 027 — I crediti non se li scrive nessuno da solo
--
-- Da eseguire SUBITO, dopo la 002. Si può rieseguire. L'app non cambia.
--
-- IL BUCO. La policy members_update (002) lascia a chi gioca aggiornare la
-- PROPRIA riga di league_members, e protegge solo il ruolo. Quindi un
-- giocatore qualunque, con una richiesta all'API e la chiave pubblicabile
-- del frontend, poteva scriversi i crediti che voleva. Provato su un
-- database identico: «update league_members set credits = 99999 where
-- user_id = <io>» passava per un fantallenatore senza nessun ruolo. Nella
-- lega pubblica, con un premio in palio, vuol dire comprarsi i migliori
-- venticinque senza limiti di budget.
--
-- LA CORREZIONE. Un trigger, come per i Reclutatori (023) e i ruoli (025):
-- quando a scrivere è un client,
--  - di chi è la squadra, in che lega sta e quando è entrata non cambiano
--    MAI, nemmeno per l'amministratore della lega;
--  - crediti, ruolo e allenatore in seconda li cambia solo l'amministratore
--    della lega (l'asta, la gestione delle rose, «Fai admin»);
--  - il giocatore cambia quello che l'app gli fa cambiare: nome della
--    squadra, colori, stemma, maglia, il nome con cui compare.
-- Gli acquisti e le vendite del negozio, il mercato e gli scambi passano da
-- funzioni che girano come proprietario, e continuano a muovere i crediti.
-- =====================================================================

create or replace function public.membri_protetti() returns trigger
language plpgsql as $$
begin
  if current_user in ('anon', 'authenticated') then
    new.league_id := old.league_id;
    new.user_id := old.user_id;
    new.created_at := old.created_at;
    if not public.is_league_admin(old.league_id) then
      new.credits := old.credits;
      new.role := old.role;
      new.vice_user_id := old.vice_user_id;
      new.vice_code := old.vice_code;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists membri_protetti on public.league_members;
create trigger membri_protetti before update on public.league_members
  for each row execute function public.membri_protetti();
