-- =====================================================================
-- 025 — Nessuno si dà da solo un ruolo
--
-- Da eseguire SUBITO, dopo la 015 (usa le colonne is_admin e sospeso).
-- Si può rieseguire. L'app non cambia: quando crea il profilo manda solo
-- id e nome.
--
-- IL BUCO. Il profilo lo crea il client al primo accesso (001), e la policy
-- profiles_insert_own controllava solo che fosse il PROPRIO profilo, non
-- cosa c'era dentro. Quindi chiunque si iscrive poteva creare il suo profilo
-- già con is_admin = true e is_judge = true, con una sola richiesta all'API
-- e la chiave pubblicabile che sta nel frontend. Provato su un database
-- identico: «insert into profiles (id, display_name, is_admin, is_judge)
-- values (<io>, 'Furbo', true, true)» passava. Amministratore dell'app vuol
-- dire la Console (persone, sospensioni, ruoli, sponsor); Giudice Dati vuol
-- dire scrivere eventi e voti che contano in tutte le leghe.
--
-- Valeva anche per chi un profilo l'aveva già: elimina_profilo() e poi un
-- profilo nuovo, con i ruoli.
--
-- La policy di aggiornamento invece era già a posto (014, 015): un profilo
-- esistente non si promuove da solo.
--
-- LA CORREZIONE, in due modi, perché qui ha ceduto il fidarsi di un
-- controllo solo:
--  1. la policy d'inserimento rifiuta un profilo nuovo con un ruolo o con la
--     sospensione già tolta;
--  2. un trigger, come per i Reclutatori (023): quando a scrivere è un
--     client, in inserimento i tre campi partono da falso e in
--     aggiornamento restano quelli di prima. Lo cambiano solo le funzioni
--     della console (admin_imposta_ruolo, admin_sospendi), che girano come
--     proprietario, e chi lavora dall'SQL Editor.
--
-- DOPO: controllare chi ha un ruolo oggi, nel caso qualcuno l'abbia già
-- usato. Nel SQL Editor:
--   select id, display_name, is_admin, is_judge, created_at
--     from public.profiles where is_admin or is_judge order by created_at;
-- Devono esserci solo le persone che li hanno avuti apposta.
-- =====================================================================

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert to authenticated
  with check (id = public.current_user_id() and not is_admin and not is_judge and not sospeso);

create or replace function public.ruoli_protetti() returns trigger
language plpgsql as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.is_admin := false; new.is_judge := false; new.sospeso := false;
    else
      new.is_admin := old.is_admin; new.is_judge := old.is_judge; new.sospeso := old.sospeso;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists ruoli_protetti on public.profiles;
create trigger ruoli_protetti before insert or update on public.profiles
  for each row execute function public.ruoli_protetti();
