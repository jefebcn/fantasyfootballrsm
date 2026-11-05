-- =====================================================================
-- 053 — Le doppie ammonizioni contate come rossi diretti, e i cognomi
--        con la particella nel listino
--
-- Tutto in UN blocco, come la 034 e la 043: tutto-o-niente, e si può
-- rieseguire (la seconda volta non trova più niente da correggere).
--
-- COSA ERA SUCCESSO (5/11, segnalato da un utente su Instagram). Il referto
-- della FSGC scrive ogni espulsione allo stesso modo, «Espulsione»: l'import
-- la prendeva sempre per rosso diretto (-2). Umberto De Lucia (Virtus, 7a)
-- era espulso per doppio giallo: dal regolamento -0,5 e -1, non -0,5 e -2.
-- La 4.2.263 corregge l'import e src/eventi-dati.js, ma i voti delle leghe
-- si fanno sugli eventi salvati qui, in match_events: lì c'erano ancora gli
-- otto rossi diretti. Le giornate 2, 4, 5 e 7 sono chiuse (art. 9.2), quindi
-- nessuno poteva più correggerle dall'app.
--
-- COSA FA, decisione di Alex del 5/11 («correggi tutto quello che ti ha detto»):
--   1. riapre per un momento le giornate chiuse e le richiude alla fine,
--      identiche;
--   2. l'espulsione di chi era già ammonito nella stessa partita diventa
--      second_yellow: i voti, i punti delle squadre e le classifiche si
--      ricalcolano da soli (non sono salvati da nessuna parte);
--   3. nel listino i nomi con la particella: «De Lucia U.», non «Lucia U.».
-- Ogni modifica a match_events finisce nel registro (art. 9.3), come sempre.
-- =====================================================================

do $correzione$
begin
  drop table if exists chiuse;

  -- 1. le giornate chiuse si riaprono per il tempo di questa correzione
  create temp table chiuse on commit drop as
    select * from public.matchday_status where status = 'frozen';
  delete from public.matchday_status where status = 'frozen';

  -- 2. espulso dopo un giallo nella stessa partita = doppia ammonizione
  update public.match_events e set type = 'second_yellow'
   where e.type = 'red_direct'
     and exists (select 1 from public.match_events y
                  where y.match_id = e.match_id and y.player_id = e.player_id
                    and y.type = 'yellow' and y.minute <= e.minute);

  -- 3. i nomi nel listino (quotazioni.nome), come li scrive l'app dalla 4.2.263
  update public.quotazioni q set nome = v.nome
    from (values
      ('cailungo_5', 'De Paoli F.'), ('cosmos_16', 'Di Rienzo T.'), ('faetano_8', 'Di Palma C.'),
      ('fiorentino_9', 'Del Frari J.'), ('folgore_1', 'De Angelis M.'), ('folgore_15', 'De Nicolò G.'),
      ('juvenes_3', 'Di Noto S.'), ('juvenes_9', 'Della Valle N.'), ('juvenes_20', 'Di Addario F.'),
      ('lafiorita_3', 'Di Giuli E.'), ('libertas_4', 'De Biagi M.'), ('libertas_5', 'De Biagi A.'),
      ('murata_19', 'Di Mauro S.'), ('pennarossa_3', 'La Mantia S.'), ('pennarossa_19', 'De Boni L.'),
      ('trefiori_26', 'van Nek J.'), ('virtus_5', 'De Lucia U.'), ('trefiori_27', 'Van Nek T.')
    ) as v(player_id, nome)
   where q.player_id = v.player_id and q.nome is distinct from v.nome;

  -- le giornate chiuse tornano chiuse, come prima
  insert into public.matchday_status select * from chiuse
  on conflict (matchday) do update set status = excluded.status;
end $correzione$;

-- quanto e' rimasto da correggere: rossi_dopo_giallo deve essere zero,
-- doppie_ammonizioni 8 (o di piu' con le giornate nuove), giornate_chiuse come prima (7)
select
  (select count(*) from public.match_events e where e.type = 'red_direct'
     and exists (select 1 from public.match_events y where y.match_id = e.match_id and y.player_id = e.player_id
                   and y.type = 'yellow' and y.minute <= e.minute)) as rossi_dopo_giallo,
  (select count(*) from public.match_events where type = 'second_yellow') as doppie_ammonizioni,
  (select nome from public.quotazioni where player_id = 'virtus_5') as de_lucia,
  (select count(*) from public.matchday_status where status = 'frozen') as giornate_chiuse;
