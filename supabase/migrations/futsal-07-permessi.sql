-- =====================================================================
-- FUTSAL 07 — Le funzioni del futsal chiuse al ruolo anonimo (come la 011)
--
-- Si può rieseguire. Postgres dà EXECUTE a PUBLIC su ogni funzione nuova:
-- senza un revoke, chi non ha fatto l'accesso poteva chiamarle (le prove di
-- supabase/prove/permessi.sh lo hanno visto alla PR del futsal su main).
-- Restano a chi ha fatto l'accesso, che è chi le usa: l'app (leghe), le
-- policy (futsal_in_lega) e il controllo delle formazioni.
-- =====================================================================

revoke execute on function
  public.futsal_allinea_lock(jsonb),
  public.futsal_chiusa(int),
  public.futsal_in_lega(uuid),
  public.futsal_crea_lega(text, text),
  public.futsal_entra_lega(text),
  public.futsal_esci_lega(uuid),
  public.futsal_avvia_lega(uuid),
  public.futsal_in_vigore(text, int),
  public.futsal_patrimonio(text, int)
from public, anon;

grant execute on function
  public.futsal_allinea_lock(jsonb),
  public.futsal_chiusa(int),
  public.futsal_in_lega(uuid),
  public.futsal_crea_lega(text, text),
  public.futsal_entra_lega(text),
  public.futsal_esci_lega(uuid),
  public.futsal_avvia_lega(uuid),
  public.futsal_in_vigore(text, int),
  public.futsal_patrimonio(text, int)
to authenticated;
