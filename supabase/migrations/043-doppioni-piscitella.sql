-- =====================================================================
-- 043 — Altri tre doppioni (Piscitella, Montali, Caverzan) e sei giocatori
--        che mancavano dal listino del negozio
--
-- Tutto in UN blocco, come la 034: l'SQL Editor esegue i comandi su
-- connessioni diverse e una tabella temporanea non sopravvive al comando dopo.
-- Un blocco DO e' anche tutto-o-niente: se qualcosa va storto non cambia nulla.
--
-- Da eseguire DOPO aver pubblicato la versione dell'app che la accompagna
-- (4.2.201 o successiva). Si può rieseguire: la seconda volta non trova più
-- niente da correggere.
--
-- COSA ERA SUCCESSO (17/10, segnalato da un utente su Instagram). Nella Virtus
-- c'erano «Piscitella G.» centrocampista da 23 e «Gianmario P.» attaccante
-- da 6: la stessa persona. Transfermarkt lo scrive «Giammario», la FSGC
-- «Gianmario»: con una lettera diversa l'import della 034 non li aveva
-- riconosciuti. I voti (e il gol della 5ª) andavano al doppione; chi aveva
-- pagato 23 il Piscitella del listone non ha mai preso niente.
-- Cercando altri casi: Montali (Academy) e Caverzan (San Giovanni) erano
-- entrati due volte dai tabellini, una «nome cognome» e una «cognome nome».
--
-- COSA FA, decisione di Alex del 17/10:
--   1. riapre per un momento le giornate chiuse e le richiude alla fine;
--   2. presenze, eventi e contestazioni del doppione passano al giocatore
--      vero: i voti delle giornate 1-5 si ricalcolano da soli;
--   3. Piscitella resta uno solo, ATTACCANTE (come lo scrive la FSGC e come
--      lo avevano 9 delle 14 squadre che lo hanno in rosa), al prezzo del
--      listone; Montali resta uno solo, DIFENSORE (l'unico che lo ha in
--      rosa lo ha preso così);
--   4. nelle rose e nelle formazioni il doppione diventa il giocatore vero.
--      Chi li aveva tutti e due tiene quello vero: il doppione si svincola e
--      i crediti spesi per lui TORNANO, così può ricomprare un giocatore;
--   5. il doppione esce dal listino; i sei giocatori dei tabellini che nel
--      listino non c'erano ancora ci entrano (prima comprarli dava
--      «Giocatore sconosciuto»).
-- =====================================================================

do $correzione$
begin
  drop table if exists doppi; drop table if exists chiuse; drop table if exists rimborsi;
  create temp table doppi (extra text primary key, vero text not null) on commit drop;
  insert into doppi (extra, vero) values
    ('virtus_25', 'virtus_14'),          -- Piscitella
    ('academy_27', 'academy_24'),        -- Montali
    ('sangiovanni_27', 'sangiovanni_26');-- Caverzan

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

  -- 4. rose. Chi ha gia' anche quello vero, o (lega privata) quello vero e'
  -- di un altro: il doppione si svincola e i crediti spesi tornano.
  create temp table rimborsi on commit drop as
    select r.id, r.member_id, r.price_paid from public.rosters r join doppi d on d.extra = r.player_id
     where r.released_at is null
       and exists (select 1 from public.rosters r2 where r2.player_id = d.vero and r2.released_at is null
                     and (r2.member_id = r.member_id
                          or (r.lega_esclusiva is not null and r2.lega_esclusiva = r.lega_esclusiva)));
  update public.rosters set released_at = now() where id in (select id from rimborsi);
  update public.league_members m set credits = m.credits + x.tot
    from (select member_id, sum(price_paid) tot from rimborsi group by member_id) x
   where m.id = x.member_id;
  -- tutti gli altri: il doppione diventa il giocatore vero (anche nello
  -- storico delle rose, che non ha vincoli)
  update public.rosters r set player_id = d.vero from doppi d
   where r.player_id = d.extra
     and (r.released_at is not null
          or not exists (select 1 from public.rosters r2 where r2.player_id = d.vero and r2.released_at is null
                           and (r2.member_id = r.member_id
                                or (r2.lega_esclusiva is not null and r2.lega_esclusiva = r.lega_esclusiva))));

  -- formazioni: dove c'e' gia' quello vero il doppione diventa un posto vuoto
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

  -- 5. il listino: via i doppioni, i ruoli giusti, i sei che mancavano
  update public.offerte o set stato = 'ritirata', chiusa_at = now()
    from doppi d where o.player_id = d.extra and o.stato = 'aperta';
  delete from public.quotazioni q using doppi d where q.player_id = d.extra;
  insert into public.quotazioni (player_id, ruolo, quotazione, nome, club) values
    ('virtus_14', 'A', 23, 'Piscitella G.', 'Virtus'),
    ('academy_24', 'D', 5, 'Montali G.', 'SM Academy U22'),
    ('murata_7', 'D', 10, 'Ceccaroni Giac.', 'Murata'),
    ('virtus_20', 'C', 8, 'Borioni Ni.', 'Virtus'),
    ('murata_28', 'C', 5, 'Ceccaroni Gian.', 'Murata'),
    ('academy_29', 'C', 5, 'Mattei L.', 'SM Academy U22'),
    ('academy_30', 'C', 5, 'Zavoli M.', 'SM Academy U22'),
    ('virtus_26', 'C', 5, 'Borioni Na.', 'Virtus'),
    ('juvenes_24', 'D', 5, 'Yuriy B.', 'Juvenes/Dogana'),
    ('folgore_27', 'C', 5, 'Mathias S.', 'Folgore')
  on conflict (player_id) do update
    set ruolo = excluded.ruolo, quotazione = excluded.quotazione,
        nome = excluded.nome, club = excluded.club;

  -- le giornate chiuse tornano chiuse, come prima
  insert into public.matchday_status select * from chiuse
  on conflict (matchday) do update set status = excluded.status;
end $correzione$;

-- quanto e' rimasto da correggere: i primi cinque devono essere zero,
-- piscitella_attaccante deve dire A e il listino 412 giocatori
with doppi(extra, vero) as (values
  ('virtus_25', 'virtus_14'), ('academy_27', 'academy_24'), ('sangiovanni_27', 'sangiovanni_26'))
select
  (select count(*) from public.match_appearances a join doppi d on d.extra = a.player_id) as presenze_doppioni,
  (select count(*) from public.match_events e join doppi d on d.extra = e.player_id) as eventi_doppioni,
  (select count(*) from public.rosters r join doppi d on d.extra = r.player_id where r.released_at is null) as rose_doppioni,
  (select count(*) from public.lineups l, doppi d where l.lineup::text like '%"' || d.extra || '"%') as formazioni_doppioni,
  (select count(*) from public.quotazioni q join doppi d on d.extra = q.player_id) as listino_doppioni,
  (select ruolo from public.quotazioni where player_id = 'virtus_14') as piscitella_attaccante,
  (select count(*) from public.quotazioni) as listino,
  (select count(*) from public.matchday_status where status = 'frozen') as giornate_chiuse;
