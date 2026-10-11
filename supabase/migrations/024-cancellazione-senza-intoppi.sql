-- =====================================================================
-- 024 — Cancellare l'account funziona anche per chi ha fatto qualcosa
--
-- Da eseguire dopo la 023 (o dopo la 010, se la 023 non c'è ancora).
-- Si può rieseguire.
--
-- IL DIFETTO. elimina_profilo() (010) cancella il profilo e conta sulle
-- chiavi esterne per portarsi dietro squadre, rose e formazioni. Ma otto
-- colonne puntano al profilo SENZA dire cosa fare quando sparisce, e in quel
-- caso Postgres rifiuta la cancellazione:
--   trades.deciso_da            chi ha accettato/rifiutato/ritirato uno scambio
--   leagues.created_by          chi ha creato una lega (e poi l'ha passata)
--   sponsor.creato_da           chi ha inserito uno sponsor
--   match_events.created_by     il Giudice che ha scritto un evento
--   match_overrides.updated_by  il Giudice che ha corretto un voto
--   matchday_status.changed_by  chi ha congelato una giornata
--   matchday_locks.updated_by   chi ha allineato il calendario dei lock
--   change_log.by_user          l'autore di una riga del registro
-- Basta aver deciso UNO scambio e il bottone «Cancella il mio account»
-- risponde con un errore. La 010 scriveva già che questi dati devono
-- restare «senza più un nome attaccato»: qui lo si fa davvero.
--
-- LA CORREZIONE.
--  1. Quelle otto chiavi diventano «on delete set null»: il dato resta,
--     l'autore diventa nessuno.
--  2. Su eventi e correzioni dei voti ci sono due guardie (schema.sql): il
--     congelamento (art. 9.2) rifiuta qualsiasi modifica a una giornata
--     congelata, e il registro (art. 9.3) annota ogni modifica. Anche il
--     «set null» è una modifica, quindi senza toccarle un Giudice che ha
--     scritto voti in una giornata congelata resterebbe incancellabile, e
--     cancellarlo riempirebbe il registro di righe finte.
--     Si lasciano passare, senza annotarla, SOLO la modifica che toglie
--     l'autore di una persona che non esiste più: tutto il resto della riga
--     deve restare identico. Un Giudice vivo non può usarla per ritoccare
--     una giornata congelata, né per togliere la propria firma.
-- =====================================================================

do $$
declare
  c record;
  nome text;
begin
  for c in
    select * from (values
      ('trades', 'deciso_da'),
      ('leagues', 'created_by'),
      ('sponsor', 'creato_da'),
      ('match_events', 'created_by'),
      ('match_overrides', 'updated_by'),
      ('matchday_status', 'changed_by'),
      ('matchday_locks', 'updated_by'),
      ('change_log', 'by_user')
    ) as v(tab, col)
  loop
    if to_regclass('public.' || c.tab) is null then continue; end if;
    -- il nome del vincolo non è lo stesso su tutti i database (alcuni li ha
    -- rimessi la 001, altri sono nati con la tabella): si cerca per colonna
    for nome in
      select k.conname
        from pg_constraint k
        join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
       where k.contype = 'f'
         and k.conrelid = ('public.' || c.tab)::regclass
         and k.confrelid = 'public.profiles'::regclass
         and a.attname = c.col
         and k.confdeltype <> 'n'
    loop
      execute format('alter table public.%I drop constraint %I', c.tab, nome);
    end loop;
    if not exists (
      select 1 from pg_constraint k
        join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
       where k.contype = 'f' and k.conrelid = ('public.' || c.tab)::regclass
         and k.confrelid = 'public.profiles'::regclass and a.attname = c.col
    ) then
      execute format('alter table public.%I add constraint %I foreign key (%I) references public.profiles(id) on delete set null',
                     c.tab, c.tab || '_' || c.col || '_fkey', c.col);
    end if;
  end loop;
end $$;


-- Vero solo quando una riga cambia per un motivo: l'autore era una persona
-- e quella persona non c'è più. Le colonne d'autore di eventi e correzioni
-- sono created_by e updated_by; tutto il resto deve restare com'era.
create or replace function public.solo_autore_cancellato(vecchia jsonb, nuova jsonb) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  col text;
  tolto boolean := false;
begin
  if (vecchia - 'created_by' - 'updated_by') is distinct from (nuova - 'created_by' - 'updated_by') then
    return false;
  end if;
  foreach col in array array['created_by', 'updated_by'] loop
    if vecchia ->> col is distinct from nuova ->> col then
      if nuova ->> col is not null then return false; end if;
      if exists (select 1 from public.profiles where id = vecchia ->> col) then return false; end if;
      tolto := true;
    end if;
  end loop;
  return tolto;
end $$;
-- Resta eseguibile da tutti, come guard_frozen e matchday_is_frozen: la
-- chiamano i trigger col ruolo di chi scrive (un Giudice dall'app), e
-- risponde solo vero o falso.
grant execute on function public.solo_autore_cancellato(jsonb, jsonb) to anon, authenticated;


-- Congelamento (art. 9.2), come in schema.sql, con l'unica eccezione sopra.
create or replace function public.guard_frozen() returns trigger
language plpgsql as $$
declare mid text; n int;
begin
  if tg_op = 'UPDATE' and public.solo_autore_cancellato(to_jsonb(old), to_jsonb(new)) then
    return new;
  end if;
  mid := coalesce(new.match_id, old.match_id);
  n := public.matchday_of(mid);
  if public.matchday_is_frozen(n) then
    raise exception 'Giornata % congelata (art. 9.2)', n;
  end if;
  return coalesce(new, old);
end $$;

-- Registro (art. 9.3), come nella 001, con la stessa eccezione: togliere il
-- nome di chi se n'è andato non è una modifica al voto.
create or replace function public.log_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and public.solo_autore_cancellato(to_jsonb(old), to_jsonb(new)) then
    return new;
  end if;
  insert into public.change_log (by_user, match_id, matchday, what, payload)
  values (public.current_user_id(), coalesce(new.match_id, old.match_id), public.matchday_of(coalesce(new.match_id, old.match_id)),
          tg_table_name || ':' || lower(tg_op), coalesce(to_jsonb(new), to_jsonb(old)));
  return coalesce(new, old);
end $$;
