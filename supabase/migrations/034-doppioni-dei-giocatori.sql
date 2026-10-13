-- =====================================================================
-- 034 — I doppioni dei giocatori: i voti tornano a chi ce li aveva
--
-- Da eseguire DOPO la 033 e DOPO aver pubblicato la versione dell'app che
-- la accompagna (4.2.184 o successiva). Si può rieseguire: la seconda volta
-- non trova più niente da correggere.
--
-- COSA ERA SUCCESSO. Il 13/10 Manuel Tordella, portiere del Cailungo, ha
-- scritto ad Alex che c'era un errore con lui. La FSGC lo chiama «Manuel
-- Filippo Tordella», il listone «Manuel Tordella»: l'import non li aveva
-- riconosciuti come la stessa persona e ne aveva fatto un giocatore nuovo
-- («Manuel F.»). I voti andavano al doppione; chi aveva in rosa il Tordella
-- del listone non li ha mai presi. Stessa cosa per altri dieci (secondi nomi,
-- nomi girati): Bernardi, Cicarelli, Rinaldi, Parisi, Hirsch, Osayande,
-- Cenni, Cordioli, Ulloa.
--
-- COSA FA, decisione di Alex del 13/10:
--   1. riapre per un momento le giornate chiuse e le richiude alla fine:
--      i voti delle giornate 1-5 si ricalcolano coi giocatori giusti;
--   2. presenze, eventi e contestazioni del doppione passano al giocatore
--      del listone;
--   3. nelle rose e nelle formazioni il doppione diventa il giocatore del
--      listone: e' la stessa persona, nessuno perde il suo giocatore. Chi li
--      aveva tutti e due tiene quello del listone; in una lega privata dove
--      quello del listone e' gia' di un altro, il doppione si svincola e i
--      crediti spesi tornano;
--   4. il doppione esce dal listino del negozio e dalle offerte aperte.
-- I punti non sono salvati da nessuna parte: l'app li ricalcola da presenze,
-- eventi e formazioni, quindi la classifica si aggiorna da sola.
-- =====================================================================

begin;

create temp table doppi (extra text primary key, vero text not null) on commit drop;
insert into doppi (extra, vero) values
  ('cailungo_28', 'cailungo_19'),    -- Hirsch
  ('cailungo_29', 'cailungo_1'),     -- Tordella
  ('cailungo_30', 'cailungo_6'),     -- Parisi
  ('trepenne_28', 'trepenne_25'),    -- Rinaldi
  ('trepenne_32', 'trepenne_25'),    -- Rinaldi
  ('trepenne_29', 'trepenne_21'),    -- Cordioli
  ('trepenne_31', 'trepenne_21'),    -- Cordioli
  ('trepenne_30', 'trepenne_20'),    -- Cenni
  ('cosmos_25', 'cosmos_18'),        -- Ulloa
  ('cosmos_26', 'cosmos_18'),        -- Ulloa
  ('trefiori_28', 'trefiori_23'),    -- Bernardi
  ('lafiorita_25', 'lafiorita_10'),  -- Cicarelli
  ('libertas_23', 'libertas_21');    -- Osayande

-- 1. le giornate chiuse si riaprono per il tempo di questa correzione
create temp table chiuse on commit drop as
  select * from public.matchday_status where status = 'frozen';
delete from public.matchday_status where status = 'frozen';

-- 2. presenze, eventi, contestazioni
delete from public.match_appearances a using doppi d
 where a.player_id = d.extra
   and exists (select 1 from public.match_appearances b where b.match_id = a.match_id and b.player_id = d.vero);
update public.match_appearances a set player_id = d.vero from doppi d where a.player_id = d.extra;
update public.match_events e set player_id = d.vero from doppi d where e.player_id = d.extra;
update public.contestazioni c set player_id = d.vero from doppi d where c.player_id = d.extra;

-- 3. rose
-- chi ha gia' anche quello del listone: il doppione si svincola
update public.rosters r set released_at = now()
  from doppi d
 where r.player_id = d.extra and r.released_at is null
   and exists (select 1 from public.rosters r2 where r2.member_id = r.member_id
                 and r2.player_id = d.vero and r2.released_at is null);
-- lega privata, quello del listone e' di un altro: si svincola e i crediti tornano
create temp table rimborsi on commit drop as
  select r.id, r.member_id, r.price_paid from public.rosters r join doppi d on d.extra = r.player_id
   where r.released_at is null and r.lega_esclusiva is not null
     and exists (select 1 from public.rosters r2 where r2.lega_esclusiva = r.lega_esclusiva
                   and r2.player_id = d.vero and r2.released_at is null);
update public.rosters set released_at = now() where id in (select id from rimborsi);
update public.league_members m set credits = m.credits + x.tot
  from (select member_id, sum(price_paid) tot from rimborsi group by member_id) x
 where m.id = x.member_id;
-- tutti gli altri: il doppione diventa il giocatore del listone (anche nello
-- storico delle rose, che non ha vincoli)
update public.rosters r set player_id = d.vero from doppi d
 where r.player_id = d.extra
   and (r.released_at is not null
        or not exists (select 1 from public.rosters r2 where r2.player_id = d.vero and r2.released_at is null
                         and (r2.member_id = r.member_id
                              or (r2.lega_esclusiva is not null and r2.lega_esclusiva = r.lega_esclusiva))));

-- formazioni: dove c'e' gia' quello del listone il doppione diventa un posto vuoto
update public.lineups l set lineup = replace(l.lineup::text, '"' || d.extra || '"', '""')::jsonb
  from doppi d
 where l.lineup::text like '%"' || d.extra || '"%' and l.lineup::text like '%"' || d.vero || '"%';
update public.lineups l set lineup = replace(l.lineup::text, '"' || d.extra || '"', '"' || d.vero || '"')::jsonb
  from doppi d
 where l.lineup::text like '%"' || d.extra || '"%';

-- scambi ancora aperti che nominano un doppione: il giocatore e' lo stesso
update public.trades t
   set offre = replace(t.offre::text, '"' || d.extra || '"', '"' || d.vero || '"')::jsonb,
       chiede = replace(t.chiede::text, '"' || d.extra || '"', '"' || d.vero || '"')::jsonb
  from doppi d
 where t.stato = 'proposta' and (t.offre::text || t.chiede::text) like '%"' || d.extra || '"%';

-- 4. il doppione non si compra piu'
update public.offerte o set stato = 'ritirata', chiusa_at = now()
  from doppi d where o.player_id = d.extra and o.stato = 'aperta';
delete from public.quotazioni q using doppi d where q.player_id = d.extra;

-- le giornate chiuse tornano chiuse, come prima
insert into public.matchday_status select * from chiuse
on conflict (matchday) do update set status = excluded.status;

-- quanto e' rimasto da correggere: devono essere tutti zero
select
  (select count(*) from public.match_appearances a join doppi d on d.extra = a.player_id) as presenze_doppioni,
  (select count(*) from public.match_events e join doppi d on d.extra = e.player_id) as eventi_doppioni,
  (select count(*) from public.rosters r join doppi d on d.extra = r.player_id where r.released_at is null) as rose_doppioni,
  (select count(*) from public.lineups l, doppi d where l.lineup::text like '%"' || d.extra || '"%') as formazioni_doppioni,
  (select count(*) from rimborsi) as svincolati_con_rimborso,
  (select count(*) from chiuse) as giornate_richiuse;

commit;
