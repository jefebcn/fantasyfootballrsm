-- I permessi delle funzioni vanno tolti AI RUOLI, non a PUBLIC.
--
-- COSA HO TROVATO, il 17 settembre, subito dopo aver caricato la 010. Da
-- fuori, con la sola chiave pubblicabile che sta nel frontend, ho chiamato
-- elimina_profilo(): si e' fermata da sola («Serve un account per
-- cancellarlo»), ma il corpo era partito. Cioe' il ruolo anonimo il permesso
-- di eseguirla ce l'aveva.
--
-- PERCHE'. Il progetto Supabase nasce con
--   alter default privileges in schema public grant all on functions
--     to postgres, anon, authenticated, service_role;
-- quindi ogni funzione creata dopo NASCE eseguibile da anon, per un permesso
-- dato al ruolo. Un «revoke all on function ... from public» non glielo
-- toglie: PUBLIC e anon sono due cose diverse. Tutte le migrazioni da qui
-- indietro revocano da PUBLIC, e quindi non hanno mai revocato niente.
--
-- QUANTO COSTAVA. Una sola funzione fa danno per davvero: da_avvisare()
-- restituisce endpoint, p256dh e auth di ogni iscrizione al push — le tre
-- cose che servono per spedire una notifica al telefono di qualcuno — e non
-- controlla chi la chiama, perche' doveva essere raggiungibile solo dal
-- service role. Provato su un database locale reso identico a Supabase:
-- «set role anon; select * from da_avvisare(1)» tira fuori chiave e segreto
-- in chiaro, piu' nome squadra e nome lega.
--
-- Nessun dato e' uscito: push_subscriptions e' vuota, non si e' ancora
-- iscritto nessuno. Questa migrazione va caricata PRIMA che si iscriva il
-- primo telefono.
--
-- Le altre funzioni controllano tutte chi chiama e ad anon rispondono no o
-- niente. Restano comunque revocate: quello che ha ceduto qui e' stato
-- proprio il fidarsi di un controllo solo.
--
-- E si revoca DA TUTTI E DUE, public e anon, perche' i due permessi convivono
-- e basta che ne resti uno. La prima stesura di questa migrazione revocava
-- solo da anon: cinque funzioni si sono chiuse (quelle a cui una migrazione
-- vecchia aveva gia' revocato PUBLIC) e ventidue sono rimaste aperte esatte
-- come prima. Se non avessi riletto i permessi dopo averla applicata, avrei
-- creduto di aver risolto.
--
-- Per ognuna si rimette anche il grant a authenticated: quattro funzioni
-- (create_league, join_league, entra_come_vice, trade_verifica) stavano in
-- piedi SOLO per il permesso di PUBLIC, e togliere quello senza rimettere
-- niente avrebbe spento l'iscrizione alle leghe. Verificato rileggendo i
-- permessi, non a mente.

-- 1. Le due del service role: via da tutti quanti, nominati uno per uno.
revoke execute on function public.da_avvisare(int) from public, anon, authenticated;
revoke execute on function public.promemoria_da_rifare(int, text[]) from public, anon, authenticated;

-- 2. Le funzioni che l'app chiama da dentro: le usa chi ha fatto l'accesso.
revoke execute on function public.abbandona_lega(uuid) from public, anon;
grant execute on function public.abbandona_lega(uuid) to authenticated;
revoke execute on function public.accetta_scambio(uuid) from public, anon;
grant execute on function public.accetta_scambio(uuid) to authenticated;
revoke execute on function public.annulla_scambio(uuid) from public, anon;
grant execute on function public.annulla_scambio(uuid) to authenticated;
revoke execute on function public.chiudi_giornata(int) from public, anon;
grant execute on function public.chiudi_giornata(int) to authenticated;
revoke execute on function public.create_league(text, text, text, text, text) from public, anon;
grant execute on function public.create_league(text, text, text, text, text) to authenticated;
revoke execute on function public.e_svincolato(uuid, text) from public, anon;
grant execute on function public.e_svincolato(uuid, text) to authenticated;
revoke execute on function public.elimina_profilo() from public, anon;
grant execute on function public.elimina_profilo() to authenticated;
revoke execute on function public.entra_come_vice(text) from public, anon;
grant execute on function public.entra_come_vice(text) to authenticated;
revoke execute on function public.join_league(text, text, text, text) from public, anon;
grant execute on function public.join_league(text, text, text, text) to authenticated;
revoke execute on function public.offri(uuid, text, int) from public, anon;
grant execute on function public.offri(uuid, text, int) to authenticated;
revoke execute on function public.proponi_scambio(uuid, uuid, jsonb, jsonb, int, text) from public, anon;
grant execute on function public.proponi_scambio(uuid, uuid, jsonb, jsonb, int, text) to authenticated;
revoke execute on function public.rifiuta_scambio(uuid) from public, anon;
grant execute on function public.rifiuta_scambio(uuid) to authenticated;
revoke execute on function public.rigenera_codice_vice(uuid) from public, anon;
grant execute on function public.rigenera_codice_vice(uuid) to authenticated;
revoke execute on function public.risolvi_offerte(uuid) from public, anon;
grant execute on function public.risolvi_offerte(uuid) to authenticated;
revoke execute on function public.ritira_offerta(uuid) from public, anon;
grant execute on function public.ritira_offerta(uuid) to authenticated;
revoke execute on function public.sync_matchday_locks(jsonb) from public, anon;
grant execute on function public.sync_matchday_locks(jsonb) to authenticated;
revoke execute on function public.togli_vice(uuid) from public, anon;
grant execute on function public.togli_vice(uuid) to authenticated;
revoke execute on function public.trade_verifica(uuid, uuid, uuid, jsonb, jsonb, int) from public, anon;
grant execute on function public.trade_verifica(uuid, uuid, uuid, jsonb, jsonb, int) to authenticated;

-- 3. Le prossime.
--
-- Restano fuori di proposito le funzioni che vivono DENTRO le policy RLS e i
-- trigger — is_league_member, is_league_admin, current_user_id,
-- matchday_is_frozen, log_change e compagnia. Non tirano fuori niente: ad
-- anon rispondono falso o vuoto. Ma vengono valutate col ruolo di chi
-- interroga, e togliergliele trasformerebbe un «non vedi niente» in un
-- «permission denied for function»: un errore al posto di una lista vuota,
-- che e' un peggioramento travestito da irrigidimento.
--
-- Questa riga toglie ad anon il permesso predefinito sulle funzioni nuove.
-- NON BASTA DA SOLA, e va detto: su una funzione appena creata il permesso
-- arriva anche da PUBLIC, che e' un valore predefinito di Postgres e non di
-- Supabase. Provato: dopo questa riga una funzione nuova resta eseguibile da
-- anon, perche' eredita PUBLIC.
alter default privileges in schema public revoke execute on functions from anon;

-- Quel PUBLIC si toglierebbe solo con la forma GLOBALE, senza «in schema»:
--   alter default privileges revoke execute on functions from public;
-- Funziona (provato), ma vale per ogni schema e per ogni funzione creata dal
-- ruolo postgres — comprese quelle che arriverebbero con un'estensione
-- installata dal pannello, che si troverebbe senza permessi e smetterebbe di
-- funzionare per motivi impossibili da collegare a questa riga. Un rimedio
-- che si fa sentire mesi dopo, in un posto che non c'entra, e' peggio del
-- male.
--
-- Percio' ogni funzione nuova si revoca e si concede a mano, come qui sopra,
-- e a controllare che nessuno se ne dimentichi ci pensa supabase/prove/
-- permessi.sh, che gira in CI a ogni push. Una regola ricordata da una
-- persona si dimentica; una regola provata a ogni push no.
