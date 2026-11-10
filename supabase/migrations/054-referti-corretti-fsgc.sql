-- =====================================================================
-- 054 — Tre referti corretti dalla FSGC dopo la chiusura delle giornate
--
-- Stesso schema della 053: UN blocco tutto-o-niente, si può rieseguire
-- (la seconda volta non trova più niente da correggere).
--
-- COSA ERA SUCCESSO (controllo del 10/11 chiesto da Alex: «controlla che
-- sull'app i referti siano tutti corretti»). Riscaricando tutti i 64 referti
-- dal sito FSGC, tre partite già chiuse risultano diverse da quelle salvate:
--   4a  Folgore-Academy (md4_m4): al 73' Zavoli (academy_30) entra per
--       Molinari (academy_26). Il cambio mancava: Molinari risultava in campo
--       90', Zavoli non aveva giocato.
--   5a  Pennarossa-Folgore (md5_m1): l'assist del gol al 26' è di Sahud
--       Scutella (folgore_27), non di Fabbri (folgore_7).
--   7a  La Fiorita-Libertas (md7_m5): al 54' entra Moussa Simaha
--       (libertas_17), non Moussa Gueye (libertas_1).
-- src/eventi-dati.js è già allineato al sito FSGC. Le giornate sono chiuse
-- (art. 9.2), quindi dall'app non si potevano più correggere.
--
-- COSA FA: riapre per un momento le giornate chiuse, corregge le tre
-- partite e le richiude identiche. Voti, punti delle squadre e classifiche
-- si ricalcolano da soli. Ogni modifica a match_events finisce nel registro
-- (art. 9.3).
-- =====================================================================

do $correzione$
begin
  drop table if exists chiuse;
  create temp table chiuse on commit drop as
    select * from public.matchday_status where status = 'frozen';
  delete from public.matchday_status where status = 'frozen';

  -- 4a Folgore-Academy: Zavoli entra al 73' per Molinari
  update public.match_appearances set minutes_played = 73
   where match_id = 'md4_m4' and player_id = 'academy_26' and minutes_played = 90;
  insert into public.match_appearances (match_id, player_id, club_id, started, minutes_played, entered_at)
  select 'md4_m4', 'academy_30', 'academy', false, 17, 73
   where not exists (select 1 from public.match_appearances
                      where match_id = 'md4_m4' and player_id = 'academy_30');

  -- 5a Pennarossa-Folgore: l'assist del 26' è di Sahud Scutella
  update public.match_events set player_id = 'folgore_27'
   where match_id = 'md5_m1' and type = 'assist' and minute = 26 and player_id = 'folgore_7';

  -- 7a La Fiorita-Libertas: al 54' entra Simaha, non Gueye
  update public.match_appearances set player_id = 'libertas_17'
   where match_id = 'md7_m5' and player_id = 'libertas_1' and entered_at = 54
     and not exists (select 1 from public.match_appearances
                      where match_id = 'md7_m5' and player_id = 'libertas_17');

  insert into public.matchday_status select * from chiuse
  on conflict (matchday) do update set status = excluded.status;
end $correzione$;

-- controllo: deve uscire 73 / 1 / folgore_27 / 1 / 0 / giornate chiuse come prima
select
  (select minutes_played from public.match_appearances where match_id = 'md4_m4' and player_id = 'academy_26') as molinari_minuti,
  (select count(*) from public.match_appearances where match_id = 'md4_m4' and player_id = 'academy_30') as zavoli_in_campo,
  (select player_id from public.match_events where match_id = 'md5_m1' and type = 'assist' and minute = 26) as assist_26,
  (select count(*) from public.match_appearances where match_id = 'md7_m5' and player_id = 'libertas_17') as simaha_in_campo,
  (select count(*) from public.match_appearances where match_id = 'md7_m5' and player_id = 'libertas_1') as gueye_in_campo,
  (select count(*) from public.matchday_status where status = 'frozen') as giornate_chiuse;
