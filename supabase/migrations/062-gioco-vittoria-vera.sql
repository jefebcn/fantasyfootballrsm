-- =====================================================================
-- 062 — «Chi è?»: una vittoria vale solo con almeno un tentativo (21/11/2026)
--
-- Si può rieseguire. Il risultato lo manda il telefono: con 0 tentativi e
-- vinto = true la classifica (049: 7 meno i tentativi) dava 7 punti, più del
-- massimo vero (6, indovinato al primo). Il premio «Re del Titano» esce su
-- Instagram. Ora una vittoria con meno di un tentativo si ignora. Resta un
-- risultato dichiarato dal telefono: questo toglie solo l'impossibile.
-- Al 21/11 nessuna partita salvata era così.
-- =====================================================================

create or replace function public.salva_partita_gioco(p_giorno date, p_tentativi int, p_vinto boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  chi text := public.current_user_id();
  oggi date := (now() at time zone 'Europe/Rome')::date;
begin
  if chi is null or p_giorno is null or p_giorno not between oggi - 1 and oggi + 1
     or p_tentativi is null or p_tentativi not between 0 and 6
     or (coalesce(p_vinto, false) and p_tentativi < 1) then
    return;
  end if;
  insert into public.gioco_partite (user_id, giorno, tentativi, vinto)
  values (chi, p_giorno, p_tentativi, coalesce(p_vinto, false))
  on conflict (user_id, giorno) do update
    set tentativi = greatest(gioco_partite.tentativi, excluded.tentativi),
        vinto = gioco_partite.vinto or excluded.vinto,
        aggiornato_at = now()
    where excluded.tentativi >= gioco_partite.tentativi;
end $$;
