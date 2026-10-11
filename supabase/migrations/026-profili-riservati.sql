-- =====================================================================
-- 025 — Dei profili degli altri si vede solo quello che serve
--
-- Da eseguire dopo la 025 (e quindi dopo la 023). Si può rieseguire.
-- MEGLIO ASPETTARE QUALCHE GIORNO dopo aver pubblicato la versione 4.2.149
-- dell'app: quella sa leggere il proprio profilo con mio_profilo(); una
-- versione più vecchia, rimasta in cache su un telefono, chiederebbe il
-- profilo con select('*') e da qui in poi riceverebbe un rifiuto.
--
-- IL DIFETTO. La policy profiles_read (schema.sql) lascia leggere a
-- qualunque utente registrato TUTTE le righe e TUTTE le colonne dei profili.
-- L'app non lo mostra, ma chiunque si iscriva e interroghi l'API con la
-- chiave pubblicabile che sta nel frontend legge, di ognuno:
--   - invitato_da / invito_contato_at: chi ha invitato chi. La 023 e
--     l'informativa promettono che «resta nel database e NON si mostra a
--     nessuno»;
--   - sospeso: chi è stato sospeso dalla moderazione (015);
--   - is_admin, is_judge, created_at: chi amministra, chi fa il Giudice, e
--     quando si è iscritto ognuno.
--
-- LA CORREZIONE.
--  1. Degli altri si leggono solo id, display_name e reclutati: il nome in
--     lega e il badge dei Reclutatori. È tutto quello che l'app usa.
--  2. Il proprio profilo intero arriva da mio_profilo(), che gira come
--     proprietario e restituisce SOLO la riga di chi chiama.
--  3. La policy di aggiornamento confrontava is_judge, is_admin e sospeso
--     rileggendo la tabella con i permessi di chi scrive: senza permesso su
--     quelle colonne si romperebbe il cambio del nome. Ora li confronta con
--     is_judge(), is_admin() e sono_sospeso(), che girano come proprietario.
--     Il controllo resta lo stesso: nessuno si promuove e nessuno si toglie
--     la sospensione da solo.
--  4. Per la stessa ragione le altre letture dei profili «con i permessi di
--     chi scrive» passano da funzioni che girano come proprietario:
--     - sponsor, conteggi degli sponsor ed errori dell'app guardavano
--       p.is_admin: ora is_admin();
--     - premi_reclutatore (023) leggeva reclutati e invitato_da di chi
--       cambia la maglia: ora stato_reclutatore(), che restituisce solo il
--       numero di amici e SE è arrivato da un invito, non da chi.
--       premi_reclutatore resta invece com'è (non proprietario): il suo
--       «se a scrivere è un client» guarda proprio current_user.
-- =====================================================================

create or replace function public.mio_profilo() returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(p) from public.profiles p where p.id = public.current_user_id()
$$;
revoke all on function public.mio_profilo() from public, anon;
grant execute on function public.mio_profilo() to authenticated;

create or replace function public.stato_reclutatore(p_user text, out n integer, out invitato boolean)
language sql stable security definer set search_path = public as $$
  select coalesce(p.reclutati, 0), p.invitato_da is not null from public.profiles p where p.id = p_user
$$;
revoke all on function public.stato_reclutatore(text) from public, anon;
grant execute on function public.stato_reclutatore(text) to authenticated;

create or replace function public.premi_reclutatore() returns trigger
language plpgsql as $$
declare
  n integer; invitato boolean;
begin
  if current_user not in ('anon', 'authenticated') then return new; end if;
  select s.n, s.invitato into n, invitato from public.stato_reclutatore(new.user_id) s;
  n := coalesce(n, 0); invitato := coalesce(invitato, false);
  if new.kit ->> 'finitura' = 'oro' and n < 1 then new.kit := new.kit - 'finitura'; end if;
  if new.kit ->> 'finitura' = 'titano' and not (invitato or n >= 1) then new.kit := new.kit - 'finitura'; end if;
  if new.kit ->> 'finitura' is not null and new.kit ->> 'finitura' not in ('oro', 'titano') then new.kit := new.kit - 'finitura'; end if;
  if new.kit ->> 'personaggio' = '31' and n < 3 then new.kit := new.kit - 'personaggio'; end if;
  return new;
end $$;

drop policy if exists sponsor_admin on public.sponsor;
create policy sponsor_admin on public.sponsor for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists sponsor_conteggi_admin on public.sponsor_conteggi;
create policy sponsor_conteggi_admin on public.sponsor_conteggi for select to authenticated
  using (public.is_admin());
drop policy if exists errori_app_admin on public.errori_app;
create policy errori_app_admin on public.errori_app for select to authenticated
  using (public.is_admin());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = public.current_user_id())
  with check (
    id = public.current_user_id()
    and is_judge = public.is_judge()
    and is_admin = public.is_admin()
    and sospeso  = public.sono_sospeso()
  );

-- Le colonne: via il permesso sulla tabella intera, poi solo le tre che
-- servono. Inserire e aggiornare il proprio profilo restano come prima (le
-- policy decidono quali righe), ma senza leggere le colonne riservate.
revoke select on public.profiles from anon, authenticated;
grant select (id, display_name, reclutati) on public.profiles to authenticated;
