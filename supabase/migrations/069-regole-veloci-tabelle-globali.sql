-- 069 · Le regole di scrittura non pesano piu' sulla lettura.
--
-- Il controllo «performance» di Supabase segnalava 14 tabelle con piu' regole
-- permissive per la stessa azione. Il caso tipico: una regola di lettura
-- «tutti» (using true) e una di scrittura «per tutto» (FOR ALL) per il
-- Giudice o il proprietario. FOR ALL vale anche in lettura, quindi ogni
-- lettura valutava anche is_judge()/is_owner(). Postgres le unisce in OR e
-- le funzioni chiamate cosi' si calcolano riga per riga.
--
-- Qui ogni FOR ALL diventa tre regole (insert, update, delete), con la
-- funzione dentro (select ...): Postgres la calcola una volta per richiesta
-- (InitPlan) invece che a ogni riga. Chi puo' fare cosa NON cambia.
--
-- Le cinque tabelle globali (partite, eventi, presenze, chiusure, stato delle
-- giornate) si leggono a ogni apertura dell'app: sono quelle che contano.
-- La tabella del futsal sta in futsal-13 (le migrazioni girano in ordine
-- alfabetico e futsal_risultati_provvisori nasce in futsal-12).
--
-- Regole da seguire per le tabelle nuove: docs/DATABASE-VELOCE.md.

-- Divide una regola FOR ALL in insert/update/delete con la stessa condizione.
create or replace function pg_temp.dividi(tabella text, vecchia text, prefisso text, cond text)
returns void language plpgsql as $$
begin
  execute format('drop policy if exists %I on public.%I', vecchia, tabella);
  execute format('drop policy if exists %I on public.%I', prefisso || '_insert', tabella);
  execute format('drop policy if exists %I on public.%I', prefisso || '_update', tabella);
  execute format('drop policy if exists %I on public.%I', prefisso || '_delete', tabella);
  execute format('create policy %I on public.%I for insert to authenticated with check (%s)', prefisso || '_insert', tabella, cond);
  execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)', prefisso || '_update', tabella, cond, cond);
  execute format('create policy %I on public.%I for delete to authenticated using (%s)', prefisso || '_delete', tabella, cond);
end $$;

-- ------------------------------------------- dati delle partite (Giudice Dati)
select pg_temp.dividi('match_appearances', 'global_write_app', 'global_app', '(select public.is_judge())');
select pg_temp.dividi('match_events', 'global_write_events', 'global_events', '(select public.is_judge())');
select pg_temp.dividi('match_overrides', 'global_write_overrides', 'global_overrides', '(select public.is_judge())');
select pg_temp.dividi('matchday_locks', 'locks_write', 'locks', '(select public.is_judge())');
select pg_temp.dividi('matchday_status', 'global_write_status', 'global_status', '(select public.is_judge())');
select pg_temp.dividi('squalifiche', 'squalifiche_giudice', 'squalifiche_giudice', '(select public.is_judge()) or (select public.is_admin())');

-- ------------------------------------------------- impostazioni del proprietario
select pg_temp.dividi('app_interruttori', 'interruttori_proprietario', 'interruttori', '(select public.is_owner())');
select pg_temp.dividi('finestre_mercato', 'finestre_proprietario', 'finestre', '(select public.is_owner())');

-- ------------------------------------------------- giocatori (amministratori)
select pg_temp.dividi('giocatori_esclusi', 'esclusi_admin', 'esclusi', '(select public.is_admin())');

-- --------------------------------------------- adesioni dei calciatori (044)
-- Gli amministratori leggono, correggono e cancellano. Inserire: chiunque,
-- solo come richiesta nuova (le stesse condizioni di prima); un
-- amministratore anche senza condizioni. Prima erano due regole di insert
-- per authenticated: ora una per ruolo.
drop policy if exists adesioni_admin on public.adesioni_giocatori;
drop policy if exists adesioni_scrive_chiunque on public.adesioni_giocatori;
drop policy if exists adesioni_admin_leggi on public.adesioni_giocatori;
drop policy if exists adesioni_admin_update on public.adesioni_giocatori;
drop policy if exists adesioni_admin_delete on public.adesioni_giocatori;
drop policy if exists adesioni_inserisci_anon on public.adesioni_giocatori;
drop policy if exists adesioni_inserisci on public.adesioni_giocatori;
create policy adesioni_admin_leggi on public.adesioni_giocatori for select to authenticated using ((select public.is_admin()));
create policy adesioni_admin_update on public.adesioni_giocatori for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy adesioni_admin_delete on public.adesioni_giocatori for delete to authenticated using ((select public.is_admin()));
create policy adesioni_inserisci_anon on public.adesioni_giocatori for insert to anon with check (
  letta = false and stato = 'attesa' and verificato_come is null and verificato_at is null
  and player_id is null and prova is null and ritirato_at is null);
create policy adesioni_inserisci on public.adesioni_giocatori for insert to authenticated with check (
  (select public.is_admin()) or (
    letta = false and stato = 'attesa' and verificato_come is null and verificato_at is null
    and player_id is null and prova is null and ritirato_at is null));

-- ------------------------------------------------------------ sponsor (017/021)
-- Lettura: gli sponsor in corso (quelli di lega solo ai membri), e tutti per
-- amministratori e proprietario. Prima erano tre regole di lettura per
-- authenticated: ora una per ruolo. Scrive solo il proprietario.
drop policy if exists sponsor_admin on public.sponsor;
drop policy if exists sponsor_in_corso on public.sponsor;
drop policy if exists sponsor_lettura_anon on public.sponsor;
drop policy if exists sponsor_lettura on public.sponsor;
create policy sponsor_lettura_anon on public.sponsor for select to anon using (
  attivo and dal <= current_date and (al is null or al >= current_date) and lega_id is null);
create policy sponsor_lettura on public.sponsor for select to authenticated using (
  (attivo and dal <= current_date and (al is null or al >= current_date)
    and (lega_id is null or lega_id in (select public.mie_leghe())))
  or (select public.is_admin()) or (select public.is_owner()));
select pg_temp.dividi('sponsor', 'sponsor_proprietario', 'sponsor_proprietario', '(select public.is_owner())');

-- ------------------------------------------------------- coppa (066), indice
-- La chiave esterna sul turno non aveva un indice: le regole della coppa
-- cercano per turno.
create index if not exists coppa_formazioni_turno on public.coppa_formazioni (turno);
