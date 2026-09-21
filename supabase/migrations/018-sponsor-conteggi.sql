-- =====================================================================
-- 018 — Il rendiconto dello sponsor: quante viste, quanti tocchi
--
-- Da eseguire DOPO la 017. Si può rieseguire.
--
-- Perché serve: il pezzo che rende RINNOVABILE uno sponsor non è il banner,
-- è il rendiconto. Senza un numero, l'anno dopo si ricomincia a trattare da
-- zero e l'unica cosa che si può portare al tavolo è la propria parola.
--
-- COSA SI CONTA, e cosa no. Una riga per sponsor per giorno, due numeri.
-- Nessun identificativo di chi guarda, nessun indirizzo IP, nessuna riga per
-- persona: un registro di comportamento non serve a vendere uno spazio, e
-- sarebbe un dato personale da dichiarare, conservare e cancellare. Qui non
-- c'è niente da cancellare perché non c'è niente di nessuno.
--
-- UNA VISTA PER DISPOSITIVO AL GIORNO. La dashboard si ridisegna a ogni
-- apertura e a ogni ritorno: contare ogni disegno darebbe un numero gonfio e
-- inutile, che al primo controllo di uno sponsor serio si sgonfia. Il
-- «giorno-dispositivo» lo decide l'app (memoria locale del telefono); il
-- tocco invece si conta sempre, perché è un gesto, non un'apparizione.
--
-- CHI PUÒ SCRIVERE: nessuno, direttamente. La tabella non ha nessuna policy
-- di scrittura, quindi né un iscritto né un anonimo possono inserire o
-- correggere righe. Si passa solo da conta_sponsor(), che accetta due soli
-- tipi e solo per uno sponsor IN FINESTRA: non si possono creare conteggi per
-- uno sponsor inesistente, né gonfiare quello scaduto il mese scorso.
--
-- Quello che resta possibile, ed è giusto dirlo: chi ha la chiave pubblica
-- può chiamare la funzione più volte e alzare il contatore dello sponsor in
-- corso. Vale per qualunque contatore web che non schedi chi lo tocca, ed è
-- il prezzo di non tenere un registro delle persone. Il numero che si vende
-- è quello del giorno-dispositivo, non il numero di chiamate.
-- =====================================================================

create table if not exists public.sponsor_conteggi (
  sponsor_id uuid not null references public.sponsor(id) on delete cascade,
  giorno date not null default current_date,
  viste integer not null default 0,
  tocchi integer not null default 0,
  primary key (sponsor_id, giorno)
);

alter table public.sponsor_conteggi enable row level security;

-- CHI LEGGE: solo chi amministra l'app. Non è un segreto, ma è un dato che si
-- porta a una trattativa: non ha motivo di stare sotto gli occhi di tutti.
drop policy if exists sponsor_conteggi_admin on public.sponsor_conteggi;
create policy sponsor_conteggi_admin on public.sponsor_conteggi
  for select to authenticated
  using (exists (select 1 from public.profiles p
                  where p.id = public.current_user_id() and p.is_admin));

-- Nessuna policy di insert/update/delete, di proposito: la sola porta è la
-- funzione qui sotto. E i permessi di tabella seguono la stessa idea.
revoke all on public.sponsor_conteggi from anon;
grant select on public.sponsor_conteggi to authenticated;

-- Il contatore. security definer perché deve poter scrivere in una tabella
-- che non è scrivibile da nessuno: è la funzione a portarsi dentro le regole.
create or replace function public.conta_sponsor(p_sponsor uuid, p_tipo text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_tipo not in ('vista', 'tocco') then
    raise exception 'tipo sconosciuto: %', p_tipo;
  end if;

  -- Fuori finestra non si conta e NON si solleva un errore: uno sponsor
  -- scaduto mentre qualcuno aveva l'app aperta non è un guasto del telefono,
  -- e un errore lì diventerebbe un avviso rosso per una cosa che non è
  -- successa a chi lo legge.
  if not exists (select 1 from public.sponsor s
                  where s.id = p_sponsor and s.attivo
                    and s.dal <= current_date
                    and (s.al is null or s.al >= current_date)) then
    return;
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
