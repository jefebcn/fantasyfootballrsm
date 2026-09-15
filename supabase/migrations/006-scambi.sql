-- =====================================================================
-- 006 — Scambi fra squadre
--
-- Da eseguire DOPO schema.sql e le migrazioni 001-005. Si può rieseguire.
--
-- Uno scambio è una proposta: una squadra offre giocatori (e, se vuole,
-- crediti) e ne chiede altri. Diventa effettivo solo quando l'altra accetta,
-- e in quel momento rose e crediti si muovono in un colpo solo.
--
-- La fattibilità si controlla DUE volte, alla proposta e all'accettazione.
-- Fra i due momenti può essere passata un'altra cosa — un altro scambio, un
-- acquisto — e una proposta nata valida può non esserlo più. Controllarla
-- solo alla proposta lascerebbe passare rose fuori regola.
-- =====================================================================

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  -- chi propone e chi riceve, per riga di partecipante (non per utente: la
  -- squadra è la riga, e un allenatore in seconda agisce sulla stessa)
  da_member uuid not null references public.league_members(id) on delete cascade,
  a_member  uuid not null references public.league_members(id) on delete cascade,
  -- elenchi di player_id (text, come in rosters)
  offre   jsonb not null default '[]'::jsonb,
  chiede  jsonb not null default '[]'::jsonb,
  -- crediti che si muovono DA chi propone A chi riceve: negativo = al contrario
  crediti int not null default 0,
  stato text not null default 'proposta'
    check (stato in ('proposta', 'accettata', 'rifiutata', 'annullata')),
  nota text,
  creato_at timestamptz not null default now(),
  deciso_at timestamptz,
  deciso_da text references public.profiles(id),
  check (da_member <> a_member)
);
create index if not exists trades_per_lega on public.trades (league_id, stato);
create index if not exists trades_per_squadra on public.trades (a_member, stato);

alter table public.trades enable row level security;

-- Gli scambi si vedono in lega: sapere chi ha proposto cosa a chi è parte del
-- gioco, e tenerli nascosti farebbe solo nascere discussioni su cosa è girato.
drop policy if exists trades_read on public.trades;
create policy trades_read on public.trades for select to authenticated
  using (public.is_league_member(league_id));

-- Scrivere passa solo dalle funzioni qui sotto, che controllano le regole.
-- Nessuna policy di insert/update/delete: senza, la tabella non si tocca da
-- fuori nemmeno per sbaglio.

-- ---------------------------------------------------------------- utilità
-- Il ruolo di un giocatore non sta sul database: il listone è nell'app. Per
-- questo la composizione della rosa si controlla in un modo che non ha
-- bisogno di conoscere i ruoli: chi propone dichiara quanti giocatori per
-- ruolo muove, e la funzione esige che offra e chieda lo stesso numero.
-- Così i reparti restano quelli che erano, qualunque siano.
create or replace function public.trade_conta(p jsonb) returns int
language sql immutable as $$ select coalesce(jsonb_array_length(p), 0) $$;

/**
 * Controlla che uno scambio si possa fare adesso. Solleva un'eccezione col
 * motivo, così il messaggio arriva all'utente invece di un "non è andata".
 */
create or replace function public.trade_verifica(
  p_league uuid, p_da uuid, p_a uuid, p_offre jsonb, p_chiede jsonb, p_crediti int
) returns void language plpgsql security definer set search_path = public as $$
declare
  n_offre int := public.trade_conta(p_offre);
  n_chiede int := public.trade_conta(p_chiede);
  mancante text;
  crediti_da int; crediti_a int;
begin
  if n_offre = 0 and n_chiede = 0 and p_crediti = 0 then
    raise exception 'Uno scambio vuoto non si può proporre';
  end if;
  if n_offre <> n_chiede then
    raise exception 'Lo scambio deve muovere lo stesso numero di giocatori per parte: %, contro %', n_offre, n_chiede;
  end if;

  -- niente doppioni dentro la stessa proposta
  if (select count(distinct x) from jsonb_array_elements_text(p_offre) x) <> n_offre
     or (select count(distinct x) from jsonb_array_elements_text(p_chiede) x) <> n_chiede then
    raise exception 'Lo stesso giocatore compare due volte nella proposta';
  end if;
  if exists (select 1 from jsonb_array_elements_text(p_offre) a
             join jsonb_array_elements_text(p_chiede) b on a.value = b.value) then
    raise exception 'Un giocatore non può stare da entrambe le parti';
  end if;

  -- ogni giocatore offerto deve stare davvero nella rosa di chi propone
  select x.value into mancante
    from jsonb_array_elements_text(p_offre) x
   where not exists (select 1 from public.rosters r
                      where r.league_id = p_league and r.member_id = p_da
                        and r.player_id = x.value and r.released_at is null)
   limit 1;
  if mancante is not null then
    raise exception 'Il giocatore % non è (più) nella tua rosa', mancante;
  end if;

  -- e ogni giocatore chiesto nella rosa dell'altra
  select x.value into mancante
    from jsonb_array_elements_text(p_chiede) x
   where not exists (select 1 from public.rosters r
                      where r.league_id = p_league and r.member_id = p_a
                        and r.player_id = x.value and r.released_at is null)
   limit 1;
  if mancante is not null then
    raise exception 'Il giocatore % non è (più) nella rosa dell''altra squadra', mancante;
  end if;

  -- i crediti non possono andare sotto zero da nessuna delle due parti
  select credits into crediti_da from public.league_members where id = p_da;
  select credits into crediti_a  from public.league_members where id = p_a;
  if crediti_da - p_crediti < 0 then
    raise exception 'Non hai abbastanza crediti: ne hai %, ne servono %', crediti_da, p_crediti;
  end if;
  if crediti_a + p_crediti < 0 then
    raise exception 'L''altra squadra non ha abbastanza crediti: ne ha %, ne servono %', crediti_a, -p_crediti;
  end if;
end $$;

-- ---------------------------------------------------------------- proponi
create or replace function public.proponi_scambio(
  p_league uuid, p_a_member uuid, p_offre jsonb, p_chiede jsonb, p_crediti int default 0, p_nota text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare mio uuid; nuovo uuid;
begin
  mio := public.my_member_id(p_league);
  if mio is null then raise exception 'Non fai parte di questa lega'; end if;
  if mio = p_a_member then raise exception 'Non puoi scambiare con te stesso'; end if;
  if not exists (select 1 from public.league_members where id = p_a_member and league_id = p_league) then
    raise exception 'La squadra scelta non è di questa lega';
  end if;
  -- una sola proposta aperta per volta verso la stessa squadra: altrimenti si
  -- accumulano e nessuno sa più quale sta guardando
  if exists (select 1 from public.trades where league_id = p_league and stato = 'proposta'
               and da_member = mio and a_member = p_a_member) then
    raise exception 'Hai già una proposta aperta verso questa squadra';
  end if;

  perform public.trade_verifica(p_league, mio, p_a_member, p_offre, p_chiede, p_crediti);

  insert into public.trades (league_id, da_member, a_member, offre, chiede, crediti, nota)
  values (p_league, mio, p_a_member, p_offre, p_chiede, p_crediti, nullif(trim(p_nota), ''))
  returning id into nuovo;
  return nuovo;
end $$;

-- ---------------------------------------------------------------- accetta
create or replace function public.accetta_scambio(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare t record; mio uuid;
begin
  select * into t from public.trades where id = p_id for update;
  if t is null then raise exception 'Proposta non trovata'; end if;
  if t.stato <> 'proposta' then raise exception 'Questa proposta è già stata %', t.stato; end if;
  mio := public.my_member_id(t.league_id);
  if mio is null or mio <> t.a_member then
    raise exception 'Solo la squadra a cui è rivolta può accettare';
  end if;

  -- il secondo controllo: fra la proposta e adesso può essere cambiato tutto
  perform public.trade_verifica(t.league_id, t.da_member, t.a_member, t.offre, t.chiede, t.crediti);

  -- i giocatori passano di squadra tenendo il prezzo pagato: serve al conto
  -- del valore della rosa e al rimborso se poi uno esce dal campionato
  update public.rosters set member_id = t.a_member
   where league_id = t.league_id and member_id = t.da_member and released_at is null
     and player_id in (select value from jsonb_array_elements_text(t.offre));
  update public.rosters set member_id = t.da_member
   where league_id = t.league_id and member_id = t.a_member and released_at is null
     and player_id in (select value from jsonb_array_elements_text(t.chiede));

  update public.league_members set credits = credits - t.crediti where id = t.da_member;
  update public.league_members set credits = credits + t.crediti where id = t.a_member;

  update public.trades set stato = 'accettata', deciso_at = now(), deciso_da = public.current_user_id()
   where id = p_id;

  -- le altre proposte aperte che toccano gli stessi giocatori non sono più
  -- valide: si chiudono adesso invece di far scoprire dopo che non vanno
  update public.trades set stato = 'annullata', deciso_at = now()
   where league_id = t.league_id and stato = 'proposta' and id <> p_id
     and (exists (select 1 from jsonb_array_elements_text(offre) x
                   where x.value in (select value from jsonb_array_elements_text(t.offre)
                                     union select value from jsonb_array_elements_text(t.chiede)))
       or exists (select 1 from jsonb_array_elements_text(chiede) x
                   where x.value in (select value from jsonb_array_elements_text(t.offre)
                                     union select value from jsonb_array_elements_text(t.chiede))));
end $$;

-- ---------------------------------------------------------------- rifiuta / annulla
create or replace function public.rifiuta_scambio(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare t record; mio uuid;
begin
  select * into t from public.trades where id = p_id for update;
  if t is null then raise exception 'Proposta non trovata'; end if;
  if t.stato <> 'proposta' then raise exception 'Questa proposta è già stata %', t.stato; end if;
  mio := public.my_member_id(t.league_id);
  if mio is null or mio <> t.a_member then raise exception 'Solo la squadra a cui è rivolta può rifiutare'; end if;
  update public.trades set stato = 'rifiutata', deciso_at = now(), deciso_da = public.current_user_id() where id = p_id;
end $$;

create or replace function public.annulla_scambio(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare t record; mio uuid;
begin
  select * into t from public.trades where id = p_id for update;
  if t is null then raise exception 'Proposta non trovata'; end if;
  if t.stato <> 'proposta' then raise exception 'Questa proposta è già stata %', t.stato; end if;
  mio := public.my_member_id(t.league_id);
  if mio is null or mio <> t.da_member then raise exception 'Solo chi ha proposto può ritirare'; end if;
  update public.trades set stato = 'annullata', deciso_at = now(), deciso_da = public.current_user_id() where id = p_id;
end $$;

grant execute on function public.proponi_scambio(uuid, uuid, jsonb, jsonb, int, text) to authenticated;
grant execute on function public.accetta_scambio(uuid) to authenticated;
grant execute on function public.rifiuta_scambio(uuid) to authenticated;
grant execute on function public.annulla_scambio(uuid) to authenticated;

do $$ begin
  begin
    alter publication supabase_realtime add table public.trades;
  exception when duplicate_object then null;
            when undefined_object then null; end;
end $$;
