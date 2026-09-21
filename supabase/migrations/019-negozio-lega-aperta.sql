-- =====================================================================
-- 019 — Il negozio della lega aperta: la rosa te la fai da solo
--
-- Da eseguire DOPO la 013 (lega pubblica) e la 012 (calendario dei lock).
-- Si può rieseguire. Dopo questa va caricato il listino: vedi in fondo.
--
-- IL PROBLEMA. In una lega pubblica chiunque può entrare, ma nessuno può
-- farsi la squadra: le rose le scrive solo chi amministra la lega (policy
-- rosters_write), e l'asta è una cosa da lega privata, con un giorno e
-- un'ora. Chi entra in una lega aperta di mercoledì sera si trova dentro
-- senza giocatori e senza un modo per averne.
--
-- COSA CAMBIA. Due funzioni — compra e vendi — che scrivono nella TUA rosa
-- portandosi dentro i controlli. La policy non si tocca: chi scrive è la
-- funzione, e lo fa solo alle condizioni scritte qui.
--
-- PERCHE' IL LISTINO STA NEL DATABASE. Il prezzo di un giocatore, fino a
-- oggi, lo conosceva solo il telefono: il listone è un file dell'app. Una
-- funzione che si fa passare il prezzo da chi compra non è un negozio, è una
-- cassa lasciata aperta — e in una lega con un montepremi qualcuno, prima o
-- poi, ci prova. Qui il prezzo lo legge il database dalla sua tabella, e chi
-- compra può dire soltanto CHI vuole, non quanto costa.
--
-- QUANDO CHIUDE. Alla chiusura delle formazioni della prima giornata utile
-- dopo il tuo ingresso: finché non si gioca puoi cambiare idea, dopo la rosa
-- è quella. Non al congelamento del martedì, che lascerebbe comprare il
-- capocannoniere il lunedì dopo aver visto i risultati.
-- =====================================================================

-- ------------------------------------------------------------- il listino
create table if not exists public.quotazioni (
  player_id text primary key,
  ruolo text not null check (ruolo in ('P', 'D', 'C', 'A')),
  quotazione int not null check (quotazione > 0),
  nome text,
  club text
);

alter table public.quotazioni enable row level security;

-- Lo leggono tutti quelli che hanno fatto l'accesso: e' il listone, lo stesso
-- che l'app gia' porta con se'. Scriverlo non puo' nessuno: nessuna policy di
-- scrittura, quindi passa solo dal SQL Editor o dal service role. Un listino
-- modificabile da chi gioca sarebbe un listino inutile.
drop policy if exists quotazioni_lettura on public.quotazioni;
create policy quotazioni_lettura on public.quotazioni
  for select to authenticated using (true);

revoke all on public.quotazioni from anon;
grant select on public.quotazioni to authenticated;

-- --------------------------------------------------------- quando si compra
--
-- La tua prima giornata e' la prima che si chiude DOPO che sei entrato: se
-- entri di mercoledi', e' quella di sabato. Finche' quel lock non e' passato
-- il mercato e' aperto.
create or replace function public.mercato_aperto(p_league uuid)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare io text; entrato timestamptz; prima int; chiude timestamptz; pubblica boolean;
begin
  io := public.current_user_id();
  if io is null then return false; end if;
  select l.pubblica into pubblica from public.leagues l where l.id = p_league;
  if not coalesce(pubblica, false) then return false; end if;
  select m.created_at into entrato from public.league_members m
   where m.league_id = p_league and m.user_id = io;
  if entrato is null then return false; end if;
  select min(k.matchday) into prima from public.matchday_locks k where k.lock_at > entrato;
  -- Nessuna giornata davanti: campionato finito, non c'e' piu' niente da
  -- comprare. Meglio chiuso che aperto per sempre.
  if prima is null then return false; end if;
  select k.lock_at into chiude from public.matchday_locks k where k.matchday = prima;
  return chiude > now();
end $$;

-- ------------------------------------------------------------- si compra
create or replace function public.compra_giocatore(p_league uuid, p_player text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  io text; mio uuid; crediti int; q record; quante int; tetto int;
  quote jsonb; budget int;
begin
  io := public.current_user_id();
  if io is null then raise exception 'Serve un account'; end if;

  select m.id, m.credits into mio, crediti from public.league_members m
   where m.league_id = p_league and m.user_id = io;
  if mio is null then raise exception 'Non sei in questa lega'; end if;

  if not exists (select 1 from public.leagues l where l.id = p_league and l.pubblica) then
    raise exception 'In questa lega la rosa si fa con l''asta, non dal negozio';
  end if;

  if not public.mercato_aperto(p_league) then
    raise exception 'Il mercato è chiuso: la tua prima giornata è già cominciata';
  end if;

  select * into q from public.quotazioni where player_id = p_player;
  if q.player_id is null then
    raise exception 'Giocatore sconosciuto (%): se il listino non è stato caricato, vedi supabase/seed-quotazioni.sql', p_player;
  end if;

  if exists (select 1 from public.rosters r
              where r.league_id = p_league and r.member_id = mio
                and r.player_id = p_player and r.released_at is null) then
    raise exception 'Ce l''hai già in rosa';
  end if;

  -- Le quote per ruolo: quelle della lega se le ha scritte, se no 3/8/8/6 —
  -- gli stessi numeri di DEFAULT_RULES.roster in src/engine.js.
  select coalesce(l.rules->'roster', '{"P":3,"D":8,"C":8,"A":6}'::jsonb)
    into quote from public.leagues l where l.id = p_league;
  tetto := (quote->>q.ruolo)::int;
  select count(*) into quante from public.rosters r
    join public.quotazioni z on z.player_id = r.player_id
   where r.league_id = p_league and r.member_id = mio and r.released_at is null
     and z.ruolo = q.ruolo;
  if quante >= tetto then
    raise exception 'Hai già % giocatori in quel ruolo: è il massimo', tetto;
  end if;

  if crediti < q.quotazione then
    raise exception 'Ti restano % crediti e ne servono %', crediti, q.quotazione;
  end if;

  insert into public.rosters (league_id, member_id, player_id, price_paid)
  values (p_league, mio, p_player, q.quotazione);
  update public.league_members set credits = credits - q.quotazione where id = mio;

  return jsonb_build_object('player_id', p_player, 'prezzo', q.quotazione,
                            'crediti', crediti - q.quotazione);
end $$;

-- -------------------------------------------------------------- si vende
--
-- Si rende indietro esattamente quello che si e' pagato: finche' non si gioca
-- non e' un mercato, e' un carrello, e da un carrello si toglie senza perdite.
create or replace function public.vendi_giocatore(p_league uuid, p_player text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare io text; mio uuid; pagato int;
begin
  io := public.current_user_id();
  if io is null then raise exception 'Serve un account'; end if;
  select m.id into mio from public.league_members m
   where m.league_id = p_league and m.user_id = io;
  if mio is null then raise exception 'Non sei in questa lega'; end if;

  if not public.mercato_aperto(p_league) then
    raise exception 'Il mercato è chiuso: la tua prima giornata è già cominciata';
  end if;

  select r.price_paid into pagato from public.rosters r
   where r.league_id = p_league and r.member_id = mio
     and r.player_id = p_player and r.released_at is null;
  if pagato is null then raise exception 'Questo giocatore non è in rosa'; end if;

  delete from public.rosters r
   where r.league_id = p_league and r.member_id = mio
     and r.player_id = p_player and r.released_at is null;
  update public.league_members set credits = credits + pagato where id = mio;

  return jsonb_build_object('player_id', p_player, 'reso', pagato,
    'crediti', (select credits from public.league_members where id = mio));
end $$;

-- ------------------------------------------------------------- permessi
revoke execute on function public.mercato_aperto(uuid) from public, anon;
grant execute on function public.mercato_aperto(uuid) to authenticated;
revoke execute on function public.compra_giocatore(uuid, text) from public, anon;
grant execute on function public.compra_giocatore(uuid, text) to authenticated;
revoke execute on function public.vendi_giocatore(uuid, text) from public, anon;
grant execute on function public.vendi_giocatore(uuid, text) to authenticated;

-- =====================================================================
-- DOPO QUESTA: carica il listino, o il negozio non vende niente.
--
--   node scripts/genera-quotazioni.mjs     scrive supabase/seed-quotazioni.sql
--
-- e quel file si incolla nel SQL Editor. Lo si rigenera ogni volta che cambia
-- il listone (scripts/importa-listone.py): prezzi e identificativi vengono
-- dalla stessa sorgente dell'app, non da una seconda copia scritta a mano.
-- =====================================================================
