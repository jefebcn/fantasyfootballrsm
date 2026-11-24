-- futsal-13 · Come la 069 per il calcio: la regola di scrittura «per tutto»
-- (FOR ALL) dei risultati provvisori valeva anche in lettura. Diventa
-- insert/update/delete con is_admin() calcolata una volta per richiesta.
-- Chi puo' fare cosa non cambia. Regole: docs/DATABASE-VELOCE.md.

drop policy if exists futsal_risultati_provvisori_scrivi on public.futsal_risultati_provvisori;
drop policy if exists futsal_risultati_provvisori_insert on public.futsal_risultati_provvisori;
drop policy if exists futsal_risultati_provvisori_update on public.futsal_risultati_provvisori;
drop policy if exists futsal_risultati_provvisori_delete on public.futsal_risultati_provvisori;
create policy futsal_risultati_provvisori_insert on public.futsal_risultati_provvisori
  for insert to authenticated with check ((select public.is_admin()));
create policy futsal_risultati_provvisori_update on public.futsal_risultati_provvisori
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy futsal_risultati_provvisori_delete on public.futsal_risultati_provvisori
  for delete to authenticated using ((select public.is_admin()));
