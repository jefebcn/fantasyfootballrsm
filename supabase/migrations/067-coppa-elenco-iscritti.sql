-- 067: chi è iscritto alla Coppa Fantatitano, prima della chiusura (Alex, 22/11:
-- «vorrei vedere man mano che la gente si iscrive i tabelloni che si vanno a creare»).
--
-- Prima della chiusura dei quarti le formazioni degli altri non si vedono
-- (066, se no si copierebbero). Qui si dà solo chi c'è e con che squadra:
-- niente giocatori. Con questo elenco ogni telefono rifà il sorteggio
-- provvisorio (src/coppa-fanta.js, coppaFantatitano): stessi id e stesso seme,
-- quindi alla chiusura i gironi provvisori diventano quelli veri.
-- Solo a chi ha fatto l'accesso (supabase/prove/permessi.sh).

create or replace function public.coppa_iscritti_elenco()
returns table (user_id text, squadra text, colore text, iniziali text)
language sql stable security definer set search_path = public as $$
  select f.user_id, f.squadra, f.colore, f.iniziali
    from public.coppa_formazioni f
   where f.turno = 1
   order by f.user_id
$$;
revoke all on function public.coppa_iscritti_elenco() from public, anon;
grant execute on function public.coppa_iscritti_elenco() to authenticated;
