-- 066: la Coppa Fantatitano (Alex, 21/11).
--
-- Una coppa fantasy che si gioca solo sulle partite della Coppa Titano vera,
-- dai quarti del 25/11 in poi (src/coppa-fanta.js). Una sola coppa per tutti
-- gli iscritti, con una formazione di coppa a parte e gratis: 5 titolari e
-- una riserva fra i giocatori delle squadre ancora in coppa, al massimo 1 per
-- squadra vera ai quarti, 2 in semifinale, 3 in finale.
--
-- 1. coppa_turni: i cinque turni, la chiusura (il calcio d'inizio della prima
--    partita del turno) e le squadre vere in gara. Chiusura nulla = la FSGC
--    non ha ancora messo il turno in calendario: niente consegne.
-- 2. coppa_formazioni: una riga per iscritto e turno. Prima della chiusura la
--    vede solo chi l'ha fatta (se no si copierebbe); dalla chiusura tutti,
--    perché i punteggi di coppa si calcolano sul telefono di ognuno.
-- 3. coppa_formazione_valida: le regole che il server fa rispettare da solo
--    (i ruoli li controlla l'app: il listone non sta nel database).
--
-- Ripetibile: si può rieseguire, aggiorna chiusure e squadre dei turni.

create table if not exists public.coppa_turni (
  turno    int primary key check (turno between 1 and 5),
  chiusura timestamptz,
  squadre  text[] not null default '{}',
  tetto    int not null check (tetto between 1 and 5)
);
alter table public.coppa_turni enable row level security;
drop policy if exists coppa_turni_tutti on public.coppa_turni;
create policy coppa_turni_tutti on public.coppa_turni for select to anon, authenticated using (true);
revoke all on public.coppa_turni from public, anon, authenticated;
grant select on public.coppa_turni to anon, authenticated;

-- Il calendario vero della Coppa Titano 2026/27 (FSGC): quarti mercoledì 25/11
-- e 9/12 alle 20:45. Semifinali e finale non ancora pubblicate.
insert into public.coppa_turni (turno, chiusura, squadre, tetto) values
  (1, '2026-11-25 20:45:00+01', '{domagnano,trefiori,lafiorita,cosmos,trepenne,pennarossa,folgore,virtus}', 1),
  (2, '2026-12-09 20:45:00+01', '{domagnano,trefiori,lafiorita,cosmos,trepenne,pennarossa,folgore,virtus}', 1),
  (3, null, '{}', 2),
  (4, null, '{}', 2),
  (5, null, '{}', 3)
on conflict (turno) do update set chiusura = excluded.chiusura, squadre = excluded.squadre, tetto = excluded.tetto;

create table if not exists public.coppa_formazioni (
  user_id    text not null default public.current_user_id(),
  turno      int  not null references public.coppa_turni(turno),
  squadra    text not null check (char_length(squadra) between 1 and 40),
  colore     text check (colore is null or colore ~ '^#[0-9A-Fa-f]{6}$'),
  iniziali   text check (iniziali is null or char_length(iniziali) <= 3),
  titolari   text[] not null,
  riserva    text not null,
  capitano   text not null,
  aggiornata timestamptz not null default now(),
  primary key (user_id, turno)
);
alter table public.coppa_formazioni enable row level security;

drop policy if exists coppa_formazioni_leggi on public.coppa_formazioni;
create policy coppa_formazioni_leggi on public.coppa_formazioni for select to authenticated
  using (user_id = public.current_user_id()
         or exists (select 1 from public.coppa_turni t where t.turno = coppa_formazioni.turno and t.chiusura <= now()));

drop policy if exists coppa_formazioni_scrivi on public.coppa_formazioni;
create policy coppa_formazioni_scrivi on public.coppa_formazioni for insert to authenticated
  with check (user_id = public.current_user_id()
              and exists (select 1 from public.coppa_turni t where t.turno = coppa_formazioni.turno and t.chiusura > now()));

drop policy if exists coppa_formazioni_cambia on public.coppa_formazioni;
create policy coppa_formazioni_cambia on public.coppa_formazioni for update to authenticated
  using (user_id = public.current_user_id()
         and exists (select 1 from public.coppa_turni t where t.turno = coppa_formazioni.turno and t.chiusura > now()))
  with check (user_id = public.current_user_id()
              and exists (select 1 from public.coppa_turni t where t.turno = coppa_formazioni.turno and t.chiusura > now()));

revoke all on public.coppa_formazioni from public, anon, authenticated;
grant select, insert, update on public.coppa_formazioni to authenticated;

create or replace function public.coppa_formazione_valida() returns trigger
language plpgsql set search_path = public as $$
declare
  t public.coppa_turni;
  tutti text[] := new.titolari || new.riserva;
  troppi text;
begin
  select * into t from public.coppa_turni where turno = new.turno;
  if t.chiusura is null or t.chiusura <= now() then
    raise exception 'Il turno % della coppa è chiuso', new.turno using errcode = 'P0001';
  end if;
  if coalesce(array_length(new.titolari, 1), 0) <> 5 then
    raise exception 'Servono 5 titolari' using errcode = 'P0001';
  end if;
  if (select count(distinct x) from unnest(tutti) x) <> 6 then
    raise exception 'Un giocatore è scelto due volte' using errcode = 'P0001';
  end if;
  if not new.capitano = any(new.titolari) then
    raise exception 'Il capitano è uno dei titolari' using errcode = 'P0001';
  end if;
  if exists (select 1 from unnest(tutti) x where not split_part(x, '_', 1) = any(t.squadre)) then
    raise exception 'C''è un giocatore di una squadra che non gioca questo turno' using errcode = 'P0001';
  end if;
  select split_part(x, '_', 1) into troppi from unnest(tutti) x
   group by 1 having count(*) > t.tetto limit 1;
  if troppi is not null then
    raise exception 'Al massimo % per squadra vera', t.tetto using errcode = 'P0001';
  end if;
  -- dal secondo turno gioca solo chi è entrato in coppa col primo
  if new.turno > 1 and not exists (select 1 from public.coppa_formazioni f where f.user_id = new.user_id and f.turno = 1) then
    raise exception 'Alla coppa si entra col primo turno' using errcode = 'P0001';
  end if;
  new.aggiornata := now();
  return new;
end $$;

drop trigger if exists coppa_formazione_valida on public.coppa_formazioni;
create trigger coppa_formazione_valida before insert or update on public.coppa_formazioni
  for each row execute function public.coppa_formazione_valida();

-- Quanti sono già iscritti (prima della chiusura le formazioni degli altri non
-- si vedono, ma il numero sì: serve a sapere che formato avrà la coppa).
create or replace function public.coppa_iscritti() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.coppa_formazioni where turno = 1
$$;
-- solo a chi ha fatto l'accesso: la pagina della coppa la apre chi gioca
revoke all on function public.coppa_iscritti() from public, anon;
grant execute on function public.coppa_iscritti() to authenticated;
