-- =====================================================================
-- 021 — Lo sponsor di UNA lega, non per forza di tutta l'app
--
-- Da eseguire dopo la 017 e la 018. Si può rieseguire.
--
-- PERCHÉ. MONETIZZAZIONE.md §3b: la lega brandizzata. Un bar, una
-- concessionaria, una banca comprano *la loro lega* — nome, logo, premio
-- loro, da girare a clienti o dipendenti — e pagano più di quanto paghino
-- per un logo in mezzo agli altri, perché non comprano uno spazio: comprano
-- un posto dove i loro clienti tornano ogni domenica per tre mesi. Ma la
-- tabella `sponsor` valeva per tutta l'app: l'unico modo di dare a
-- quell'azienda il suo spazio era darlo a tutti.
--
-- COSA CAMBIA: una colonna. `lega_id` vuota vuol dire «tutta l'app», ed è il
-- comportamento di prima — le righe che ci sono già restano quello che erano
-- senza che nessuno le tocchi. Piena vuol dire «solo dentro quella lega».
--
-- CHI LO VEDE. La policy di lettura aggiunge una sola condizione: uno
-- sponsor di lega lo vede solo chi è in quella lega. Non è una cortesia
-- all'azienda, è quello che ha comprato: se comparisse anche altrove non
-- sarebbe più il suo posto, sarebbe un banner. E chi non è iscritto a niente
-- (il ruolo anonimo) continua a vedere solo quelli di tutta l'app.
--
-- ANCHE IL CONTATORE. conta_sponsor() è la sola porta di scrittura dei
-- numeri (018) e gira come il proprietario del database: senza lo stesso
-- controllo, chiunque conoscesse l'identificativo di uno sponsor di lega
-- potrebbe gonfiargli le viste da fuori. Il rendiconto che si porta a chi
-- paga deve reggere il suo controllo, quindi la finestra non basta più:
-- serve anche essere dentro la lega.
-- =====================================================================

alter table public.sponsor
  add column if not exists lega_id uuid references public.leagues(id) on delete cascade;

comment on column public.sponsor.lega_id is
  'Vuota: sponsor di tutta l''app. Piena: lo vede solo chi è in quella lega (MONETIZZAZIONE.md §3b).';

create index if not exists sponsor_lega on public.sponsor (lega_id) where lega_id is not null;

-- Lettura: la finestra come prima, più la lega quando c'è.
drop policy if exists sponsor_in_corso on public.sponsor;
create policy sponsor_in_corso on public.sponsor
  for select to anon, authenticated
  using (
    attivo and dal <= current_date and (al is null or al >= current_date)
    and (lega_id is null or public.is_league_member(lega_id))
  );

-- Il contatore: stessa regola, se no il numero da mostrare a chi paga lo
-- può muovere chiunque.
create or replace function public.conta_sponsor(p_sponsor uuid, p_tipo text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_lega uuid;
begin
  if p_tipo not in ('vista', 'tocco') then
    raise exception 'tipo sconosciuto: %', p_tipo;
  end if;
  select s.lega_id into v_lega
    from public.sponsor s
   where s.id = p_sponsor and s.attivo
     and s.dal <= current_date
     and (s.al is null or s.al >= current_date);
  if not found then
    return;                                   -- fuori finestra, spento, o inesistente
  end if;
  if v_lega is not null and not public.is_league_member(v_lega) then
    return;                                   -- non è la tua lega: non conti
  end if;
  insert into public.sponsor_conteggi as c (sponsor_id, giorno, viste, tocchi)
  values (p_sponsor, current_date,
          case when p_tipo = 'vista' then 1 else 0 end,
          case when p_tipo = 'tocco' then 1 else 0 end)
  on conflict (sponsor_id, giorno) do update
    set viste = c.viste + excluded.viste,
        tocchi = c.tocchi + excluded.tocchi;
end;
$$;
revoke all on function public.conta_sponsor(uuid, text) from public;
grant execute on function public.conta_sponsor(uuid, text) to anon, authenticated;
