-- =====================================================================
-- 057 — La Partita: la carriera del gioco salvata sull'account
--
-- Si può rieseguire. Già applicata in produzione il 18/11 (nell'elenco delle
-- migrazioni di Supabase si chiama «lapartita_carriere»): qui è la copia di
-- riferimento. L'originale vive nel repository del gioco
-- (jefebcn/fantatitano-gioco, supabase/001-lapartita-carriere.sql): se si
-- cambia, va cambiata in tutti e due. Usa current_user_id() della 001.
--
-- PERCHÉ (Alex, 18/11: «ci serve che una persona sia salvato il suo profilo
-- quando gioca così che possa procedere con la storia e che sia tutto
-- salvato»). Il gioco tiene la carriera sul telefono; con l'accesso la
-- copia anche qui, così cambiare telefono o svuotare il browser non la perde.
--
--  1. lapartita_carriere: una riga per persona. Nessuno la legge o la
--     scrive direttamente: passa tutto dalle tre funzioni qui sotto.
--  2. lapartita_carica(): la propria carriera, se c'è.
--  3. lapartita_salva(dati, base): la scrive chi gioca, solo per sé. «base»
--     è la data dell'ultima copia che il telefono conosce: se nel frattempo
--     un altro dispositivo ne ha salvata una più nuova, non sovrascrive e
--     risponde ok = false, così il gioco può scegliere quale tenere.
--  4. lapartita_cancella(): «ricomincia da capo» cancella anche la copia qui.
--
-- Il contenuto è quello che il gioco sa già (squadra, risultati, monete,
-- sfide): niente dati personali oltre all'identificativo dell'account.
-- =====================================================================

create table if not exists public.lapartita_carriere (
  user_id       text primary key,
  dati          jsonb not null check (jsonb_typeof(dati) = 'object'),
  aggiornato_at timestamptz not null default now()
);
alter table public.lapartita_carriere enable row level security;
revoke all on table public.lapartita_carriere from public, anon, authenticated;

create or replace function public.lapartita_carica()
returns table (dati jsonb, aggiornato_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.dati, c.aggiornato_at from public.lapartita_carriere c
   where c.user_id = public.current_user_id();
$$;

create or replace function public.lapartita_salva(p_dati jsonb, p_base timestamptz default null)
returns table (ok boolean, aggiornato_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  chi text := public.current_user_id();
  ora timestamptz := now();
  attuale timestamptz;
begin
  if chi is null or p_dati is null or jsonb_typeof(p_dati) <> 'object' or pg_column_size(p_dati) > 262144 then
    return query select false, null::timestamptz;
    return;
  end if;
  select c.aggiornato_at into attuale from public.lapartita_carriere c where c.user_id = chi for update;
  if attuale is not null and p_base is not null and attuale > p_base + interval '1 second' then
    return query select false, attuale;            -- un altro dispositivo ha salvato dopo: non si sovrascrive
    return;
  end if;
  insert into public.lapartita_carriere as c (user_id, dati, aggiornato_at) values (chi, p_dati, ora)
  on conflict (user_id) do update set dati = excluded.dati, aggiornato_at = excluded.aggiornato_at;
  return query select true, ora;
end $$;

create or replace function public.lapartita_cancella()
returns void
language sql security definer set search_path = public as $$
  delete from public.lapartita_carriere where user_id = public.current_user_id();
$$;

revoke all on function public.lapartita_carica() from public, anon;
revoke all on function public.lapartita_salva(jsonb, timestamptz) from public, anon;
revoke all on function public.lapartita_cancella() from public, anon;
grant execute on function public.lapartita_carica() to authenticated;
grant execute on function public.lapartita_salva(jsonb, timestamptz) to authenticated;
grant execute on function public.lapartita_cancella() to authenticated;
