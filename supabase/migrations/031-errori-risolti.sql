-- =====================================================================
-- 031 — Gli errori risolti si tolgono dalla Console
--
-- Da eseguire dopo la 022 (e la 015, per is_admin). Si può rieseguire.
--
-- Alex, 12/10: «quando poi verranno risolti eliminali da questa
-- dashboard». La tabella errori_app (022) la legge solo l'amministratore e
-- nessuno la scrive direttamente: si pulisce da sola dopo 30 giorni, e fino
-- ad allora un errore gia' corretto restava in cima alla lista.
--
-- admin_risolvi_errore(id): toglie quell'errore e tutte le sue righe uguali
-- (stesso messaggio, in ogni giorno, versione e schermata). Se il difetto
-- torna, la riga ricompare da sola al primo telefono che lo incontra: e'
-- proprio il segnale che non era risolto.
-- =====================================================================

create or replace function public.admin_risolvi_errore(p_id bigint)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  m text; n integer;
begin
  if not public.is_admin() then raise exception 'Serve essere amministratore dell''app'; end if;
  select messaggio into m from public.errori_app where id = p_id;
  if m is null then return 0; end if;
  delete from public.errori_app where md5(messaggio) = md5(m);
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.admin_risolvi_errore(bigint) from public, anon;
grant execute on function public.admin_risolvi_errore(bigint) to authenticated;
