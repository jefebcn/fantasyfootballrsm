-- =====================================================================
-- 059 — Nomi senza caratteri da pagina web (21/11/2026)
--
-- Si può rieseguire. Il nome di una squadra, di una lega o di una persona
-- finisce nelle pagine degli altri: se contiene < > " ` può diventare
-- codice (un «XSS» salvato nel database). L'app protegge già i nomi quando
-- li mostra; questo è il secondo muro, sul database, per chi scrive
-- direttamente all'API. Prima di applicarlo nessun nome li conteneva.
-- =====================================================================

create or replace function public.nomi_sicuri() returns trigger
language plpgsql set search_path = '' as $$
declare
  c text;
begin
  foreach c in array tg_argv loop
    if (to_jsonb(new) ->> c) ~ '[<>"`]' then
      raise exception 'Il nome non può contenere i caratteri < > " `' using errcode = '22023';
    end if;
  end loop;
  return new;
end $$;
revoke execute on function public.nomi_sicuri() from public, anon;

drop trigger if exists nomi_sicuri on public.league_members;
create trigger nomi_sicuri before insert or update of team_name, owner_name on public.league_members
  for each row execute function public.nomi_sicuri('team_name', 'owner_name');

drop trigger if exists nomi_sicuri on public.leagues;
create trigger nomi_sicuri before insert or update of name, short_name on public.leagues
  for each row execute function public.nomi_sicuri('name', 'short_name');

drop trigger if exists nomi_sicuri on public.profiles;
create trigger nomi_sicuri before insert or update of display_name on public.profiles
  for each row execute function public.nomi_sicuri('display_name');

-- le tabelle del futsal: futsal-08-nomi-sicuri.sql
