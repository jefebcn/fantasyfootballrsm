-- =====================================================================
-- 055 — Sei tesserati aggiunti dalla FSGC con nome e cognome invertiti
--
-- COSA ERA SUCCESSO. Chi gioca ma non e' nelle rose di Transfermarkt viene
-- preso dall'indirizzo della sua pagina FSGC, che a volte e' «cognome-nome»
-- («molinari-nicola», «sahud-scutella-mathias»): l'import prendeva l'ultima
-- parola per cognome, e nell'app comparivano «Nicola M.», «Mathias S.».
-- Dalla 4.2.278 nome e cognome giusti stanno in data/extra.json e l'import
-- li rispetta. Qui il nome nel listino (quotazioni.nome), come lo scrive l'app.
-- Si puo' rieseguire: la seconda volta non cambia niente. Gli id non cambiano.
-- (Van Nek T., trefiori_27, era gia' giusto dalla 053.)
-- =====================================================================

update public.quotazioni q set nome = v.nome
  from (values
    ('academy_25', 'Grandoni G.'), ('academy_26', 'Molinari N.'), ('academy_28', 'Mularoni A.'),
    ('murata_27', 'Raimondi A.'), ('juvenes_24', 'Bakalyar Y.'), ('folgore_27', 'Sahud Scutella M.')
  ) as v(player_id, nome)
 where q.player_id = v.player_id and q.nome is distinct from v.nome;

-- controllo: sei righe coi cognomi davanti
select player_id, nome from public.quotazioni
 where player_id in ('academy_25','academy_26','academy_28','murata_27','juvenes_24','folgore_27','trefiori_27')
 order by player_id;
