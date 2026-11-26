-- 071 · Pronostici della giornata (docs/PIANO-LAVORI.md, punto 5).
--
-- Un gioco piccolo accanto al fantacalcio, senza rosa e senza lega: per ogni
-- partita della giornata 1, X o 2 e, se vuoi, il risultato esatto. Si chiude
-- insieme alle formazioni (matchday_locks, 004) e il blocco lo fa il database,
-- non l'app: dopo la chiusura un pronostico non si scrive, non si cambia e non
-- si cancella.
--
-- Punti: 1 il segno giusto, 3 il risultato esatto (1 + 2). Nessun premio
-- finche' il legale non dice (legale/premi-regolamento-bozza.md).
--
-- I risultati non stanno nel database (arrivano con l'app, dal referto FSGC):
-- la classifica li riceve da chi la chiede e conta solo le giornate chiuse,
-- cosi' nessuno vede i pronostici degli altri prima della chiusura. Chi
-- passasse risultati falsi cambierebbe solo la classifica che vede lui.
-- Una partita rimandata resta senza risultato: il pronostico, fatto prima
-- della chiusura della giornata, conta quando arriva il risultato del recupero.
--
-- Regole veloci (docs/DATABASE-VELOCE.md): funzioni in (select ...), una
-- regola per azione, niente FOR ALL accanto alla lettura.

create table if not exists public.pronostici (
  user_id text not null default public.current_user_id() references public.profiles(id) on delete cascade,
  matchday int not null check (matchday between 1 and 30),
  casa text not null check (length(casa) between 1 and 40),
  ospite text not null check (length(ospite) between 1 and 40 and ospite <> casa),
  segno text not null check (segno in ('1', 'X', '2')),
  gol_casa smallint check (gol_casa between 0 and 20),
  gol_ospite smallint check (gol_ospite between 0 and 20),
  updated_at timestamptz not null default now(),
  primary key (user_id, matchday, casa, ospite),
  -- il risultato esatto c'e' tutto o non c'e', e dice lo stesso del segno
  constraint pronostici_esatto check (
    (gol_casa is null and gol_ospite is null)
    or (gol_casa is not null and gol_ospite is not null and segno =
        case when gol_casa > gol_ospite then '1' when gol_casa < gol_ospite then '2' else 'X' end))
);
create index if not exists pronostici_giornata on public.pronostici (matchday, casa, ospite);

alter table public.pronostici enable row level security;

-- I propri si leggono sempre; quelli degli altri mai riga per riga (si vedono
-- solo come classifica e percentuali, dalle funzioni qui sotto).
drop policy if exists pronostici_read on public.pronostici;
create policy pronostici_read on public.pronostici for select to authenticated
  using (user_id = (select public.current_user_id()));

drop policy if exists pronostici_insert on public.pronostici;
drop policy if exists pronostici_update on public.pronostici;
drop policy if exists pronostici_delete on public.pronostici;
create policy pronostici_insert on public.pronostici for insert to authenticated with check (
  user_id = (select public.current_user_id())
  and matchday not in (select public.giornate_chiuse())
  and not (select public.sono_sospeso())
);
create policy pronostici_update on public.pronostici for update to authenticated using (
  user_id = (select public.current_user_id())
  and matchday not in (select public.giornate_chiuse())
) with check (
  user_id = (select public.current_user_id())
  and matchday not in (select public.giornate_chiuse())
  and not (select public.sono_sospeso())
);
create policy pronostici_delete on public.pronostici for delete to authenticated using (
  user_id = (select public.current_user_id())
  and matchday not in (select public.giornate_chiuse())
);

grant select, insert, update, delete on public.pronostici to authenticated;

-- La classifica. p_risultati: [{"g": 9, "c": "cosmos", "o": "folgore", "gc": 1, "go": 0}, ...]
-- p_lega: solo chi e' in quella lega (e solo se ci sei anche tu).
-- Restituisce i primi p_limite e, se sei piu' giu', anche la tua riga.
create or replace function public.pronostici_classifica(p_risultati jsonb, p_lega uuid default null, p_limite int default 50)
returns table (user_id text, nome text, punti int, segni int, esatti int, giocate int, posto int, mio boolean)
language sql stable security definer set search_path = public as $$
  with ris as (
    select (e->>'g')::int as g, e->>'c' as c, e->>'o' as o, (e->>'gc')::int as gc, (e->>'go')::int as go
      from jsonb_array_elements(case when jsonb_typeof(p_risultati) = 'array' then p_risultati else '[]'::jsonb end) e
     where (e->>'g') ~ '^\d+$' and (e->>'gc') ~ '^\d+$' and (e->>'go') ~ '^\d+$'
       and (e->>'g')::int in (select public.giornate_chiuse())
  ), chi as (
    select lm.user_id from public.league_members lm
     where lm.league_id = p_lega and p_lega in (select public.mie_leghe())
  ), conti as (
    select p.user_id,
           count(*) filter (where p.segno = case when r.gc > r.go then '1' when r.gc < r.go then '2' else 'X' end) as segni,
           count(*) filter (where p.gol_casa = r.gc and p.gol_ospite = r.go) as esatti,
           count(*) as giocate
      from public.pronostici p
      join ris r on r.g = p.matchday and r.c = p.casa and r.o = p.ospite
     where p_lega is null or p.user_id in (select chi.user_id from chi)
     group by p.user_id
  ), punti as (
    select c.*, (c.segni + 2 * c.esatti)::int as pt,
           rank() over (order by c.segni + 2 * c.esatti desc, c.esatti desc) as pos
      from conti c
  )
  select x.user_id, coalesce(nullif(trim(pr.display_name), ''), 'Giocatore'), x.pt, x.segni::int, x.esatti::int, x.giocate::int, x.pos::int,
         x.user_id = public.current_user_id()
    from punti x left join public.profiles pr on pr.id = x.user_id
   where x.pos <= greatest(1, least(coalesce(p_limite, 50), 200)) or x.user_id = public.current_user_id()
   order by x.pos, pr.display_name
$$;

-- Come hanno pronosticato tutti, partita per partita: solo a giornata chiusa.
create or replace function public.pronostici_percentuali(p_giornata int)
returns table (casa text, ospite text, uno int, ics int, due int, totale int)
language sql stable security definer set search_path = public as $$
  select p.casa, p.ospite,
         count(*) filter (where p.segno = '1')::int, count(*) filter (where p.segno = 'X')::int,
         count(*) filter (where p.segno = '2')::int, count(*)::int
    from public.pronostici p
   where p.matchday = p_giornata and p_giornata in (select public.giornate_chiuse())
   group by p.casa, p.ospite
$$;

revoke all on function public.pronostici_classifica(jsonb, uuid, int), public.pronostici_percentuali(int) from public, anon;
grant execute on function public.pronostici_classifica(jsonb, uuid, int), public.pronostici_percentuali(int) to authenticated;
