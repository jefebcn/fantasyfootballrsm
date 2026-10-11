-- =====================================================================
-- 029 — Il link d'invito della lega pubblica porta nella lega pubblica
--
-- Da eseguire SUBITO, dopo la 013. Si può rieseguire.
--
-- IL BUCO. Alex, 11/10: «quando un utente invita una persona nuova nella
-- lega pubblica, a due persone dice "lega piena"». Il link d'invito porta
-- il codice della lega in cui si trova chi lo manda, e chi lo apre finisce
-- in «Entra con codice», cioè in join_league (001). Quella funzione conosce
-- solo le leghe fra amici: massimo 12 squadre (art. 1.1) e niente crediti
-- della lega. La lega pubblica ne ha piu' di venti, quindi: «Lega al
-- completo (max 12, art. 1.1)», sempre, per chiunque arrivi da un link.
--
-- LA CORREZIONE. Se il codice e' di una lega pubblica, join_league fa
-- quello che fa il tasto «Entra» delle pubbliche (entra_lega_pubblica,
-- 013): il suo tetto (max_membri), i suoi crediti, e chi c'e' gia' rientra
-- senza errore. Per le leghe fra amici non cambia niente.
--
-- Vale anche per i link gia' mandati: chi li riapre adesso entra.
-- L'app intanto non mette piu' il codice nei link della lega pubblica.
-- =====================================================================

create or replace function public.join_league(p_code text, p_team text, p_color text, p_initials text)
returns uuid language plpgsql security definer set search_path = public as $$
declare lid uuid; pub boolean; n int; uid text;
begin
  uid := public.current_user_id();
  if uid is null then raise exception 'non autenticato'; end if;
  select id, pubblica into lid, pub from public.leagues where invite_code = upper(trim(p_code));
  if lid is null then raise exception 'Codice invito non valido'; end if;
  if pub then
    return public.entra_lega_pubblica(lid, p_team, p_color, p_initials);
  end if;
  select count(*) into n from public.league_members where league_id = lid;
  if n >= 12 then raise exception 'Lega al completo (max 12, art. 1.1)'; end if;
  insert into public.league_members (league_id, user_id, team_name, owner_name, color, initials)
  values (lid, uid, p_team, (select display_name from public.profiles where id = uid), coalesce(p_color, '#1B84C6'), p_initials)
  on conflict (league_id, user_id) do nothing;
  return lid;
end $$;
