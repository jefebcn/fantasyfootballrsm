-- =====================================================================
-- 045 — Quanti vedono il banner dei calciatori, e cosa scelgono
--
-- Da eseguire DOPO la 044. Si può rieseguire.
--
-- PERCHÉ (Alex, 17/10). Una statistica interna: quanti hanno visto il
-- banner «Giochi nel campionato sammarinese?», quanti hanno toccato «Ci
-- gioco», quanti «Non gioco», e quindi quanti l'hanno visto senza scegliere.
-- In piu' quante volte si apre la pagina #/giocatori (anche dal link della
-- storia, senza account).
--
-- SOLO NUMERI. Si conta un giorno per riga, e nient'altro: non chi, non da
-- dove. Ogni telefono conta una volta sola per tipo (lo ricorda il telefono),
-- quindi «visto» vuol dire «telefoni che l'hanno visto». Stesse regole del
-- contatore dello sponsor (018): la tabella non la scrive nessuno, la
-- funzione accetta pochi tipi, non restituisce niente e ha un tetto al
-- giorno; i numeri li legge solo chi amministra.
-- =====================================================================

create table if not exists public.banner_conteggi (
  giorno date not null,
  evento text not null check (evento in ('visto', 'ci_gioco', 'non_gioco', 'pagina')),
  n      integer not null default 0,
  primary key (giorno, evento)
);
alter table public.banner_conteggi enable row level security;
revoke all on table public.banner_conteggi from public, anon, authenticated;
grant select on table public.banner_conteggi to authenticated;
drop policy if exists banner_conteggi_admin on public.banner_conteggi;
create policy banner_conteggi_admin on public.banner_conteggi for select to authenticated
  using (public.is_admin());

create or replace function public.conta_banner(p_evento text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  -- un tipo sconosciuto non e' un errore da mostrare a chi usa l'app
  if p_evento is null or p_evento not in ('visto', 'ci_gioco', 'non_gioco', 'pagina') then return; end if;
  insert into public.banner_conteggi as c (giorno, evento, n)
  values ((now() at time zone 'Europe/Rome')::date, p_evento, 1)
  on conflict (giorno, evento) do update set n = c.n + 1
    where c.n < 20000;   -- un tetto al giorno: chi lo martella non gonfia i numeri all'infinito
end;
$$;
revoke all on function public.conta_banner(text) from public;
grant execute on function public.conta_banner(text) to anon, authenticated;

-- Controllo: la tabella c'e' (vuota: si comincia a contare da adesso).
select count(*) as righe from public.banner_conteggi;
