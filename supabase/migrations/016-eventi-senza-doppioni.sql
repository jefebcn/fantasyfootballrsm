-- Un evento due volte non deve poterci stare.
--
-- I tabellini della FSGC entrano in lega da soli: l'app (state.js) porta
-- dentro solo le giornate che in lega sono VUOTE, quindi lo stesso referto non
-- si carica due volte. Quel controllo pero' sta nel browser, e due Giudici che
-- aprono l'app nello stesso momento vedrebbero tutti e due la giornata vuota:
-- il primo scrive, il secondo scrive di nuovo, e ogni gol vale doppio.
--
-- Qui la regola si scrive dove vale davvero. Se il secondo giro arriva, il
-- database lo rifiuta: l'app se ne accorge, ripulisce quella giornata e la
-- rifa' al giro dopo. Meglio un errore visto che punteggi sbagliati in
-- silenzio.
--
-- Perche' queste quattro colonne: partita, giocatore, minuto e tipo sono cio'
-- che identifica un evento in un referto. Lo stesso giocatore che segna due
-- volte nello stesso minuto non esiste; il secondo giallo e' un tipo suo
-- ('second_yellow'), non un doppione del primo.
--
-- ATTENZIONE, si applica su un database che potrebbe gia' avere doppioni: se
-- l'indice non si crea, i doppioni ci sono. La query sotto li mostra, e vanno
-- tolti prima (tenendo la riga piu' vecchia).
--
--   select match_id, player_id, minute, type, count(*)
--     from public.match_events
--    group by 1,2,3,4 having count(*) > 1;

create unique index if not exists match_events_unico
  on public.match_events (match_id, player_id, minute, type);
