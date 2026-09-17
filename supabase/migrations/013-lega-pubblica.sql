-- La lega pubblica: aperta a tutti, ognuno la sua rosa, classifica a punti.
--
-- COS'E' DIVERSO da una lega fra amici. Nella lega privata si entra con un
-- codice, i giocatori sono esclusivi (se Tizio ha preso il portiere, agli
-- altri non resta) e ogni giornata e' uno scontro diretto: il fantapunteggio
-- diventa gol e i gol diventano tre punti in classifica.
--
-- In una lega pubblica non c'e' niente di tutto questo, e non per
-- semplificare: con duecento iscritti non puo' esserci. I giocatori non sono
-- esclusivi — altrimenti dal ventesimo iscritto non ci sarebbero piu'
-- portieri — e la classifica e' la somma dei fantapunti, chi ne fa piu' sale.
-- Nessun calendario, nessun avversario: si gioca contro tutti insieme.
--
-- L'amministratore puo' mettere in palio dei premi, che restano una promessa
-- fra persone: l'app li scrive e li mostra, non li gestisce e non li paga.

alter table public.leagues
  add column if not exists pubblica boolean not null default false,
  add column if not exists classifica text not null default 'scontri',
  add column if not exists premi jsonb not null default '[]'::jsonb,
  add column if not exists max_membri int not null default 12;

-- I vincoli si rifanno ogni volta: "add constraint" non ha un "if not
-- exists", quindi si toglie e si rimette, e la migrazione resta ripetibile.
alter table public.leagues drop constraint if exists leagues_classifica_ck;
alter table public.leagues add constraint leagues_classifica_ck
  check (classifica in ('scontri', 'punti'));
alter table public.leagues drop constraint if exists leagues_max_membri_ck;
alter table public.leagues add constraint leagues_max_membri_ck
  check (max_membri between 2 and 1000);
-- Una lega pubblica va a punti e una privata agli scontri: sono due cose che
-- devono restare insieme, perche' una lega pubblica col calendario a scontri
-- diretti fra duecento squadre non vuol dire niente.
alter table public.leagues drop constraint if exists leagues_modo_coerente_ck;
alter table public.leagues add constraint leagues_modo_coerente_ck
  check ((pubblica and classifica = 'punti') or (not pubblica and classifica = 'scontri'));

-- ---------------------------------------------------------------- esclusivita'
--
-- Un giocatore sta in una rosa sola, ma SOLO nelle leghe private. Il vincolo
-- c'era come indice unico su (league_id, player_id), e un indice non puo'
-- guardare una colonna di un'altra tabella per sapere se quella lega e'
-- pubblica.
--
-- Si potrebbe controllare in un trigger, ma un trigger non e' un vincolo:
-- due inserimenti nello stesso istante lo passano entrambi e il giocatore
-- finisce in due rose. Invece qui la colonna porta il league_id solo quando
-- la lega e' privata, e nulla quando e' pubblica: l'indice unico resta un
-- indice unico (nelle private garantisce davvero, anche sotto corsa) e nelle
-- pubbliche non vincola niente, perche' piu' NULL non sono un duplicato.
alter table public.rosters add column if not exists lega_esclusiva uuid;

create or replace function public.rosters_esclusiva() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.lega_esclusiva := case
    when (select pubblica from public.leagues where id = new.league_id) then null
    else new.league_id end;
  return new;
end $$;

drop trigger if exists rosters_esclusiva on public.rosters;
create trigger rosters_esclusiva before insert or update of league_id on public.rosters
  for each row execute function public.rosters_esclusiva();

update public.rosters r set lega_esclusiva = r.league_id
 where r.lega_esclusiva is null
   and exists (select 1 from public.leagues l where l.id = r.league_id and not l.pubblica);

drop index if exists rosters_active_player;
create unique index if not exists rosters_giocatore_esclusivo
  on public.rosters (lega_esclusiva, player_id) where released_at is null;

-- ---------------------------------------------------------------- funzioni
--
-- I premi: un elenco di {posto, premio}. Si controlla la forma qui, una volta,
-- invece di fidarsi di chi scrive: arrivano dal frontend e finiscono davanti
-- agli occhi di tutti gli iscritti.
create or replace function public.premi_validi(p jsonb) returns jsonb
language plpgsql immutable set search_path = public as $$
declare v jsonb; out jsonb := '[]'::jsonb; n int := 0;
begin
  if p is null or p = 'null'::jsonb then return '[]'::jsonb; end if;
  if jsonb_typeof(p) <> 'array' then raise exception 'I premi sono un elenco'; end if;
  if jsonb_array_length(p) > 10 then raise exception 'Al massimo dieci premi'; end if;
  for v in select * from jsonb_array_elements(p) loop
    n := n + 1;
    if jsonb_typeof(v) <> 'object' then raise exception 'Premio %: forma non valida', n; end if;
    if (v->>'posto') is null or (v->>'posto') !~ '^[1-9][0-9]?$' then
      raise exception 'Premio %: il posto e'' un numero da 1 a 99', n;
    end if;
    if coalesce(trim(v->>'premio'), '') = '' then raise exception 'Premio %: manca la descrizione', n; end if;
    if length(v->>'premio') > 120 then raise exception 'Premio %: descrizione troppo lunga (max 120)', n; end if;
    out := out || jsonb_build_array(jsonb_build_object(
      'posto', (v->>'posto')::int, 'premio', trim(v->>'premio')));
  end loop;
  return out;
end $$;

create or replace function public.crea_lega_pubblica(
  p_name text, p_short text, p_team text, p_color text, p_initials text,
  p_budget int, p_max int, p_premi jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare lid uuid; uid text; b int; m int;
begin
  uid := public.current_user_id();
  if uid is null then raise exception 'non autenticato'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Serve un nome per la lega'; end if;
  if coalesce(trim(p_team), '') = '' then raise exception 'Serve un nome per la tua squadra'; end if;
  b := coalesce(p_budget, 500);
  m := coalesce(p_max, 200);
  if b < 50 or b > 5000 then raise exception 'I crediti vanno da 50 a 5000'; end if;
  if m < 2 or m > 1000 then raise exception 'I partecipanti vanno da 2 a 1000'; end if;

  insert into public.leagues (name, short_name, created_by, pubblica, classifica, max_membri, premi, rules)
  values (trim(p_name), coalesce(nullif(trim(p_short), ''), trim(p_name)), uid, true, 'punti', m,
          public.premi_validi(p_premi), jsonb_build_object('budget', b))
  returning id into lid;

  insert into public.league_members (league_id, user_id, role, team_name, owner_name, color, initials, credits)
  values (lid, uid, 'admin', trim(p_team), (select display_name from public.profiles where id = uid),
          coalesce(p_color, '#1B84C6'), p_initials, b);
  return lid;
end $$;

create or replace function public.entra_lega_pubblica(
  p_league uuid, p_team text, p_color text, p_initials text)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid text; l record; n int;
begin
  uid := public.current_user_id();
  if uid is null then raise exception 'non autenticato'; end if;
  if coalesce(trim(p_team), '') = '' then raise exception 'Serve un nome per la tua squadra'; end if;
  select id, pubblica, max_membri, coalesce((rules->>'budget')::int, 500) as budget
    into l from public.leagues where id = p_league;
  if l.id is null then raise exception 'Lega non trovata'; end if;
  if not l.pubblica then raise exception 'Questa lega non e'' pubblica: serve il codice invito'; end if;
  if exists (select 1 from public.league_members where league_id = l.id and user_id = uid) then
    return l.id;                      -- già dentro: non è un errore, si rientra
  end if;
  select count(*) into n from public.league_members where league_id = l.id;
  if n >= l.max_membri then raise exception 'Lega al completo (% su %)', n, l.max_membri; end if;
  insert into public.league_members (league_id, user_id, team_name, owner_name, color, initials, credits)
  values (l.id, uid, trim(p_team), (select display_name from public.profiles where id = uid),
          coalesce(p_color, '#1B84C6'), p_initials, l.budget)
  on conflict (league_id, user_id) do nothing;
  return l.id;
end $$;

-- L'elenco delle leghe pubbliche. SECURITY DEFINER perche' deve contare gli
-- iscritti di leghe di cui chi guarda non fa parte: la policy su
-- league_members, giustamente, non gliele farebbe vedere. Escono numeri e
-- nomi di lega, non i nomi delle persone.
create or replace function public.leghe_pubbliche()
returns table (id uuid, name text, short_name text, premi jsonb, membri int,
               max_membri int, budget int, creata timestamptz, dentro boolean)
language sql stable security definer set search_path = public as $$
  select l.id, l.name, l.short_name, l.premi,
         (select count(*)::int from public.league_members m where m.league_id = l.id),
         l.max_membri, coalesce((l.rules->>'budget')::int, 500), l.created_at,
         exists (select 1 from public.league_members m
                  where m.league_id = l.id and m.user_id = public.current_user_id())
    from public.leagues l
   where l.pubblica
   order by l.created_at desc
   limit 100
$$;

create or replace function public.imposta_premi(p_league uuid, p_premi jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not public.is_league_admin(p_league) then raise exception 'Solo chi amministra la lega puo'' cambiare i premi'; end if;
  v := public.premi_validi(p_premi);
  update public.leagues set premi = v where id = p_league;
  return v;
end $$;

-- I permessi per ruolo, come vuole la 011: niente a PUBLIC e ad anon, tutto a
-- chi ha fatto l'accesso. leghe_pubbliche resta chiusa ad anon anche se
-- mostra solo numeri: un elenco di tutte le leghe con quanti iscritti hanno
-- e' comunque un ritratto del servizio, e non serve a chi non e' entrato.
revoke execute on function public.premi_validi(jsonb) from public, anon;
grant execute on function public.premi_validi(jsonb) to authenticated;
revoke execute on function public.crea_lega_pubblica(text, text, text, text, text, int, int, jsonb) from public, anon;
grant execute on function public.crea_lega_pubblica(text, text, text, text, text, int, int, jsonb) to authenticated;
revoke execute on function public.entra_lega_pubblica(uuid, text, text, text) from public, anon;
grant execute on function public.entra_lega_pubblica(uuid, text, text, text) to authenticated;
revoke execute on function public.leghe_pubbliche() from public, anon;
grant execute on function public.leghe_pubbliche() to authenticated;
revoke execute on function public.imposta_premi(uuid, jsonb) from public, anon;
grant execute on function public.imposta_premi(uuid, jsonb) to authenticated;
-- Il trigger lo chiama Postgres, non un ruolo: a nessuno serve eseguirla.
revoke execute on function public.rosters_esclusiva() from public, anon, authenticated;
