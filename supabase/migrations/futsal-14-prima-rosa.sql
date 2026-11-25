-- =====================================================================
-- FUTSAL 14 — La prima rosa si compra sempre (25/11/2026)
--
-- Si può rieseguire. Il mercato riapre coi referti dell'ultima partita della
-- giornata prima (futsal-05): fra il martedì e il venerdì pomeriggio resta
-- chiuso. Dal lancio (01/12) arriva gente nuova ogni giorno, e chi si iscrive
-- deve poter fare subito la squadra (Alex, 25/11). Quindi:
--  - la PRIMA rosa (nessuna squadra nelle giornate prima) si compra fino
--    alla chiusura della giornata, anche senza le sue quotazioni: valgono
--    quelle dell'ultima giornata pronta, le stesse che vede l'app;
--  - chi ha già una squadra aspetta i referti, come prima: comprare prima
--    del referto a risultati già noti sarebbe un vantaggio.
-- Il resto delle regole è quello della futsal-09, invariato.
-- =====================================================================

create or replace function public.futsal_formazione_valida() returns trigger
language plpgsql set search_path = public as $$
declare
  f jsonb := new.formazione;
  schema text := f ->> 'schema';
  porta text := f ->> 'porta';
  rd text[]; ra text[]; rosa text[]; tit text[];
  sesto text := nullif(f ->> 'sesto', '');
  cap text := nullif(f ->> 'capitano', '');
  vice text := nullif(f ->> 'vice', '');
  noti int; d int; a int; club_max int;
  ora text[]; prima text[]; spesa numeric; mancano int; patrimonio numeric; listino int;
begin
  if current_user not in ('anon', 'authenticated') then return new; end if;
  new.consegnata_at := now();
  if schema is null or schema not in ('1-3', '2-2', '3-1') then raise exception 'Schema non valido: %', schema; end if;
  if porta is null or not exists (select 1 from public.futsal_giocatori where club = porta) then raise exception 'Porta non valida'; end if;
  select coalesce(array_agg(x), '{}') into rd from jsonb_array_elements_text(coalesce(f -> 'D', '[]')) x;
  select coalesce(array_agg(x), '{}') into ra from jsonb_array_elements_text(coalesce(f -> 'A', '[]')) x;
  select coalesce(array_agg(x), '{}') into tit from jsonb_array_elements_text(coalesce(f -> 'titolari', '[]')) x;
  rosa := rd || ra;
  if cardinality(rd) <> 4 or cardinality(ra) <> 4 then raise exception 'In rosa servono 4 difensori e 4 attaccanti'; end if;
  if (select count(distinct x) from unnest(rosa) x) <> 8 then raise exception 'Un giocatore compare due volte'; end if;
  if cardinality(tit) <> 4 or not (tit <@ rosa) or (select count(distinct x) from unnest(tit) x) <> 4 then raise exception 'In campo vanno quattro giocatori della rosa'; end if;
  if sesto is null or not sesto = any(rosa) or sesto = any(tit) then raise exception 'Il sesto uomo va scelto fra chi non è in campo'; end if;
  if cap is null or not cap = any(tit) then raise exception 'Il capitano va scelto fra i quattro in campo'; end if;
  if vice is null or not vice = any(tit) or vice = cap then raise exception 'Il vice va scelto fra i quattro in campo, diverso dal capitano'; end if;
  select count(*) into noti from public.futsal_giocatori where id = any(rosa);
  if noti = 8 then
    if exists (select 1 from public.futsal_giocatori where id = any(rd) and ruolo <> 'D')
       or exists (select 1 from public.futsal_giocatori where id = any(ra) and ruolo <> 'A') then
      raise exception 'Un giocatore è nel ruolo sbagliato';
    end if;
    select count(*) filter (where ruolo = 'D'), count(*) filter (where ruolo = 'A') into d, a
      from public.futsal_giocatori where id = any(tit);
    if (schema = '1-3' and (d, a) <> (1, 3)) or (schema = '2-2' and (d, a) <> (2, 2)) or (schema = '3-1' and (d, a) <> (3, 1)) then
      raise exception 'I ruoli in campo non tornano con lo schema %', schema;
    end if;
    select max(n) into club_max from (select club, count(*) n from
      (select club from public.futsal_giocatori where id = any(rosa) union all select porta) c group by club) x;
    if club_max > 2 then raise exception 'Al massimo 2 giocatori per squadra, Porta compresa'; end if;
  end if;

  -- Il mercato: se la rosa cambia rispetto alla giornata prima (e rispetto a
  -- quella gia' consegnata per questa giornata), servono quotazioni
  -- definitive e crediti a sufficienza. La prima rosa no: si compra ai prezzi
  -- dell'ultima giornata con le quotazioni.
  ora := public.futsal_elementi(f);
  prima := public.futsal_elementi(public.futsal_in_vigore(new.user_id, new.giornata - 1));
  if not (ora <@ prima and prima <@ ora)
     and not (tg_op = 'UPDATE' and ora <@ public.futsal_elementi(old.formazione) and public.futsal_elementi(old.formazione) <@ ora) then
    listino := new.giornata;
    if not exists (select 1 from public.futsal_quotazioni where giornata = new.giornata) then
      -- la prima rosa si compra sempre, ai prezzi dell'ultima giornata pronta
      -- (Alex, 25/11/2026): chi si iscrive mentre la giornata prima si gioca
      -- ancora non deve aspettare i referti. Chi ha gia' una squadra si'.
      if cardinality(prima) = 0 then
        select max(giornata) into listino from public.futsal_quotazioni where giornata < new.giornata;
      else
        listino := null;
      end if;
      if listino is null then
        raise exception 'Mercato chiuso: le quotazioni di questa giornata arrivano con i referti di quella prima';
      end if;
    end if;
    select count(*) - count(q.id), coalesce(sum(q.valore), 0) into mancano, spesa
      from unnest(ora) e(id) left join public.futsal_quotazioni q on q.giornata = listino and q.id = e.id;
    if mancano > 0 then raise exception 'Un giocatore della rosa non ha ancora una quotazione'; end if;
    patrimonio := public.futsal_patrimonio(new.user_id, new.giornata);
    if spesa > patrimonio then raise exception 'Crediti insufficienti: la rosa costa %, ne hai %',
      replace(to_char(spesa, 'FM9990.0'), '.', ','), replace(to_char(patrimonio, 'FM9990.0'), '.', ','); end if;
  end if;
  return new;
end $$;
drop trigger if exists futsal_formazione_valida on public.futsal_formazioni;
create trigger futsal_formazione_valida before insert or update on public.futsal_formazioni
  for each row execute function public.futsal_formazione_valida();
