-- =====================================================================
-- 044 — Il consenso dei calciatori, con le prove
--
-- Da eseguire DOPO la 041 (adesioni_giocatori). Si può rieseguire.
--
-- PERCHÉ (Alex, 17/10). La pagina #/giocatori della 041 raccoglieva un «ci
-- sto» o un «toglietemi» senza sapere se a scrivere era davvero il
-- calciatore, e con un'unica scelta per tutto. E un consenso vale quanto la
-- prova che lo accompagna: se un giorno un ente chiede «chi ve l'ha dato,
-- quando, su quale testo, come sapete che era lui», la risposta deve stare
-- qui, completa, e non deve potersi ritoccare dopo.
--
-- COSA C'È.
--  1. Il modulo: «si'» agli sponsor separato e facoltativo, il genitore sotto
--     i 18 anni, la versione del testo letto, un codice di verifica.
--  2. consensi_testi: ogni versione del testo, parola per parola, con la sua
--     impronta SHA-256. Chi ha aderito alla v1 ha letto esattamente quello.
--  3. Data, ora, indirizzo IP e dispositivo dell'invio li scrive il database
--     (non il telefono, che potrebbe mentire).
--  4. La verifica: chi amministra sceglie il giocatore, dice come l'ha
--     verificato (DM Instagram o societa') e allega lo screenshot del
--     messaggio, in un contenitore privato. Chi ha verificato lo scrive il
--     database.
--  5. Il consenso non si modifica: nome, scelte, codice, testo, data, IP non
--     cambiano piu' dopo l'invio, e nessuno cancella una richiesta. Un
--     cambio d'idea e' una richiesta nuova, o un ritiro (con la sua data).
--  6. consensi_registro: ogni passaggio (inviata, verificata, respinta,
--     ritirata) in un registro dove si aggiunge e basta. Ogni riga porta
--     l'impronta della precedente: se qualcuno ne toccasse una, la catena
--     non tornerebbe piu' e verifica_registro() lo direbbe.
--  7. giocatori_aderenti(): i giocatori col bollino «Ha aderito», per tutti.
-- =====================================================================

-- ------------------------------------------------------------ 2. i testi
create table if not exists public.consensi_testi (
  versione  text primary key,
  testo     text not null,
  impronta  text not null,
  dal       timestamptz not null default now()
);
alter table public.consensi_testi enable row level security;
revoke all on table public.consensi_testi from public, anon, authenticated;
grant select on table public.consensi_testi to anon, authenticated;
drop policy if exists consensi_testi_lettura on public.consensi_testi;
create policy consensi_testi_lettura on public.consensi_testi for select to anon, authenticated using (true);

-- La v1 non si riscrive: se il testo cambia, si fa la v2.
insert into public.consensi_testi (versione, testo, impronta, dal)
select 'v1 · 17/10/2026', t, encode(sha256(convert_to(t, 'UTF8')), 'hex'), '2026-10-17 12:00+02'
  from (select $testo$Le frasi che si spuntano
[scelta] Ci sto. Il mio nome e le mie statistiche di gara possono comparire in Fantatitano: nel gioco, nelle classifiche e nei post dei social di Fantatitano.
[facoltativa, solo con «Ci sto»] Anche con sponsor e premi (facoltativo). Il mio nome può comparire anche in iniziative con uno sponsor o con premi. Foto, video e voce no: per quelli mi chiederete a parte, per iscritto.
[scelta] Non voglio comparire. Mostratemi solo come «Giocatore», con ruolo e squadra. Formazioni e punteggi degli altri non cambiano.
[sotto i 18 anni] Sono il genitore o il tutore e sono d'accordo con la scelta qui sopra.
[obbligatoria] Dichiaro di essere la persona indicata (o il suo genitore) e di aver letto cosa vuol dire.
Cosa comprende il «Ci sto»
Il tuo nome, ruolo, squadra e statistiche di gara (presenze, minuti, gol, assist, cartellini) nel gioco: listone, rose, formazioni, voti e classifiche.
Lo stesso nei post e nelle storie dei social di Fantatitano, per esempio «i migliori della giornata».
Solo se spunti anche la casella sponsor: le stesse informazioni in iniziative con uno sponsor o con premi.
Cosa non comprende
Foto, video, voce e ogni altro uso della tua immagine: per quelli ti scriviamo a parte e serve un tuo accordo scritto, caso per caso.
Dati diversi da quelli di gara: età, contatti e residenza non compaiono mai nell'app.
Se sei minorenne
Sotto i 18 anni il consenso lo dà anche un genitore o chi ne fa le veci, indicato nel modulo.
Come verifichiamo che sei tu
Dopo l'invio ricevi un codice. Ce lo mandi in privato dal tuo profilo Instagram a @fantatitano, oppure ce lo conferma il dirigente della tua squadra. Finché non è verificato il consenso non vale e nell'app non cambia niente.
Se cambi idea
Puoi ritirare il consenso quando vuoi, da questa pagina o scrivendo a support@fantatitano.site. Entro 7 giorni nell'app compari come «Giocatore», con ruolo e squadra. Se ce lo chiedi togliamo il tuo nome anche dai post già pubblicati. Ritirarlo non costa niente e non ha conseguenze.
Cosa conserviamo
La tua scelta, il nome, la squadra, il profilo Instagram se lo hai dato, se sei maggiorenne (e il nome del genitore), data e ora, l'indirizzo IP e il tipo di dispositivo da cui hai inviato, la versione di questo testo e come abbiamo verificato che sei tu, compreso lo screenshot del messaggio di verifica. Lo legge solo chi gestisce l'app. Lo teniamo finché il consenso vale e per 2 anni dopo un ritiro, come prova di cosa avevi scelto.$testo$::text as t) x
on conflict (versione) do nothing;

-- ------------------------------------------------- 1, 3, 4. le colonne
alter table public.adesioni_giocatori
  add column if not exists sponsor         boolean not null default false,
  add column if not exists maggiorenne     boolean,
  add column if not exists genitore        text check (char_length(genitore) <= 80),
  add column if not exists instagram       text check (char_length(instagram) <= 60),
  add column if not exists codice          text check (codice ~ '^FT-[A-Z0-9]{4}$'),
  add column if not exists versione        text references public.consensi_testi(versione),
  add column if not exists ip              text,
  add column if not exists dispositivo     text,
  add column if not exists stato           text not null default 'attesa',
  add column if not exists verificato_come text,
  add column if not exists verificato_at   timestamptz,
  add column if not exists verificato_da   text,
  add column if not exists prova           text,
  add column if not exists player_id       text,
  add column if not exists ritirato_at     timestamptz;

alter table public.adesioni_giocatori drop constraint if exists adesioni_stato;
alter table public.adesioni_giocatori add constraint adesioni_stato
  check (stato in ('attesa', 'verificato', 'respinto'));
alter table public.adesioni_giocatori drop constraint if exists adesioni_come;
alter table public.adesioni_giocatori add constraint adesioni_come
  check (verificato_come is null or verificato_come in ('instagram', 'societa'));
alter table public.adesioni_giocatori drop constraint if exists adesioni_sponsor;
alter table public.adesioni_giocatori add constraint adesioni_sponsor
  check (not sponsor or scelta = 'aderisco');
alter table public.adesioni_giocatori drop constraint if exists adesioni_genitore;
alter table public.adesioni_giocatori add constraint adesioni_genitore
  check (maggiorenne is not false or scelta = 'escludimi' or char_length(btrim(coalesce(genitore, ''))) >= 3);
-- verificato vuol dire: con chi, come, quando e con la prova
alter table public.adesioni_giocatori drop constraint if exists adesioni_verificata;
alter table public.adesioni_giocatori add constraint adesioni_verificata
  check (stato <> 'verificato' or (player_id is not null and verificato_come is not null
                                   and verificato_at is not null and prova is not null));

create unique index if not exists adesioni_codice on public.adesioni_giocatori (codice) where codice is not null;

-- ------------------------------------------- 5. scritto una volta e basta
create or replace function public.adesioni_sigillo() returns trigger
language plpgsql security definer set search_path = public as $$
declare h json := nullif(current_setting('request.headers', true), '')::json;
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.ip := coalesce(split_part(h ->> 'x-forwarded-for', ',', 1), h ->> 'cf-connecting-ip', h ->> 'x-real-ip');
    new.dispositivo := left(h ->> 'user-agent', 300);
    new.verificato_da := null;
    return new;
  end if;
  if (new.nome, new.squadra, new.scelta, new.sponsor, new.maggiorenne, new.genitore, new.instagram,
      new.codice, new.versione, new.created_at, new.ip, new.dispositivo, new.contatto, new.nota)
     is distinct from
     (old.nome, old.squadra, old.scelta, old.sponsor, old.maggiorenne, old.genitore, old.instagram,
      old.codice, old.versione, old.created_at, old.ip, old.dispositivo, old.contatto, old.nota) then
    raise exception 'Il consenso non si modifica: un cambio d''idea è una richiesta nuova';
  end if;
  if old.stato = 'verificato' and (new.stato, new.player_id, new.verificato_come, new.verificato_at, new.prova)
       is distinct from (old.stato, old.player_id, old.verificato_come, old.verificato_at, old.prova) then
    raise exception 'Una verifica fatta non si cambia: se era sbagliata, si ritira';
  end if;
  if old.ritirato_at is not null and new.ritirato_at is distinct from old.ritirato_at then
    raise exception 'Il ritiro ha già la sua data';
  end if;
  if new.stato = 'verificato' and old.stato <> 'verificato' then
    new.verificato_at := now();
    new.verificato_da := public.current_user_id();
  end if;
  return new;
end $$;
revoke execute on function public.adesioni_sigillo() from public, anon, authenticated;
drop trigger if exists adesioni_sigillo on public.adesioni_giocatori;
create trigger adesioni_sigillo before insert or update on public.adesioni_giocatori
  for each row execute function public.adesioni_sigillo();

-- Chi passa scrive una richiesta nuova e basta; chi amministra legge e
-- verifica, ma non cancella.
revoke all on table public.adesioni_giocatori from public, anon, authenticated;
grant insert on table public.adesioni_giocatori to anon, authenticated;
grant select, update on table public.adesioni_giocatori to authenticated;
grant usage on sequence public.adesioni_giocatori_id_seq to anon, authenticated;
drop policy if exists adesioni_scrive_chiunque on public.adesioni_giocatori;
create policy adesioni_scrive_chiunque on public.adesioni_giocatori for insert to anon, authenticated
  with check (letta = false and stato = 'attesa' and verificato_come is null and verificato_at is null
              and player_id is null and prova is null and ritirato_at is null);

-- --------------------------------------------------------- 6. il registro
create table if not exists public.consensi_registro (
  id            bigserial primary key,
  adesione_id   bigint not null,
  evento        text not null,
  chi           text,
  quando        timestamptz not null default clock_timestamp(),
  dati          jsonb not null,
  impronta_prec text,
  impronta      text not null
);
alter table public.consensi_registro enable row level security;
revoke all on table public.consensi_registro from public, anon, authenticated;
grant select on table public.consensi_registro to authenticated;
drop policy if exists consensi_registro_admin on public.consensi_registro;
create policy consensi_registro_admin on public.consensi_registro for select to authenticated
  using (public.is_admin());

-- L'impronta di una riga: quella prima, piu' tutto quello che dice questa.
create or replace function public.impronta_registro(prec text, adesione bigint, evento text, chi text, quando timestamptz, dati jsonb)
returns text language sql immutable set search_path = public as $$
  select encode(sha256(convert_to(concat_ws('|', coalesce(prec, ''), adesione::text, evento, coalesce(chi, ''),
    to_char(quando at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), dati::text), 'UTF8')), 'hex')
$$;
revoke execute on function public.impronta_registro(text, bigint, text, text, timestamptz, jsonb) from public, anon, authenticated;

create or replace function public.adesioni_registra() returns trigger
language plpgsql security definer set search_path = public as $$
declare ev text; prec text; q timestamptz := clock_timestamp(); d jsonb; c text := public.current_user_id();
begin
  ev := case
    when tg_op = 'INSERT' then 'inviata'
    when new.ritirato_at is not null and old.ritirato_at is null then 'ritirata'
    when new.stato = 'verificato' and old.stato <> 'verificato' then 'verificata'
    when new.stato = 'respinto' and old.stato <> 'respinto' then 'respinta'
    else null end;
  if ev is null then return new; end if;   -- «letta» e simili non sono passaggi del consenso
  d := to_jsonb(new) - 'letta';
  perform pg_advisory_xact_lock(4404404);  -- uno alla volta: la catena non si biforca
  select r.impronta into prec from public.consensi_registro r order by r.id desc limit 1;
  insert into public.consensi_registro (adesione_id, evento, chi, quando, dati, impronta_prec, impronta)
  values (new.id, ev, c, q, d, prec, public.impronta_registro(prec, new.id, ev, c, q, d));
  return new;
end $$;
revoke execute on function public.adesioni_registra() from public, anon, authenticated;
drop trigger if exists adesioni_registra on public.adesioni_giocatori;
create trigger adesioni_registra after insert or update on public.adesioni_giocatori
  for each row execute function public.adesioni_registra();

-- Il registro non si tocca: nemmeno chi amministra, nemmeno dall'SQL Editor
-- senza prima togliere questa regola (e la catena lo racconterebbe).
create or replace function public.registro_intoccabile() returns trigger
language plpgsql set search_path = public as $$
begin raise exception 'Il registro dei consensi non si modifica e non si cancella'; end $$;
revoke execute on function public.registro_intoccabile() from public, anon, authenticated;
drop trigger if exists registro_intoccabile on public.consensi_registro;
create trigger registro_intoccabile before update or delete on public.consensi_registro
  for each row execute function public.registro_intoccabile();
drop trigger if exists registro_intoccabile_tutto on public.consensi_registro;
create trigger registro_intoccabile_tutto before truncate on public.consensi_registro
  for each statement execute function public.registro_intoccabile();

-- La catena e' intera? Ricalcola tutte le impronte. Solo chi amministra.
create or replace function public.verifica_registro(out righe bigint, out integro boolean, out prima_rotta bigint)
language plpgsql stable security definer set search_path = public as $$
declare r record; prec text := null;
begin
  if not public.is_admin() then raise exception 'Solo chi amministra'; end if;
  righe := 0; integro := true; prima_rotta := null;
  for r in select * from public.consensi_registro order by id loop
    righe := righe + 1;
    if integro and (r.impronta_prec is distinct from prec
        or r.impronta <> public.impronta_registro(prec, r.adesione_id, r.evento, r.chi, r.quando, r.dati)) then
      integro := false; prima_rotta := r.id;
    end if;
    prec := r.impronta;
  end loop;
end $$;
revoke all on function public.verifica_registro() from public, anon;
grant execute on function public.verifica_registro() to authenticated;

-- --------------------------------------------- 4. lo screenshot, privato
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('prove-consenso', 'prove-consenso', false, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/heic'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists prove_consenso_leggi on storage.objects;
create policy prove_consenso_leggi on storage.objects for select to authenticated
  using (bucket_id = 'prove-consenso' and public.is_admin());
drop policy if exists prove_consenso_carica on storage.objects;
create policy prove_consenso_carica on storage.objects for insert to authenticated
  with check (bucket_id = 'prove-consenso' and public.is_admin());
-- niente update ne' delete: una prova caricata resta

-- ------------------------------------------------- 7. il bollino per tutti
create or replace function public.giocatori_aderenti() returns setof text
language sql stable security definer set search_path = public as $$
  select x.player_id from (
    select distinct on (a.player_id) a.player_id, a.scelta, a.ritirato_at
      from public.adesioni_giocatori a
     where a.stato = 'verificato' and a.player_id is not null
     order by a.player_id, a.verificato_at desc nulls last, a.id desc
  ) x where x.scelta = 'aderisco' and x.ritirato_at is null
$$;
revoke all on function public.giocatori_aderenti() from public;
grant execute on function public.giocatori_aderenti() to anon, authenticated;

-- Controllo: tutto c'e', il testo v1 ha la sua impronta, il registro e' integro.
select (select count(*) from public.adesioni_giocatori) as richieste,
       (select left(impronta, 16) from public.consensi_testi where versione = 'v1 · 17/10/2026') as impronta_testo_v1,
       (select count(*) from public.consensi_registro) as righe_registro,
       (select public from storage.buckets where id = 'prove-consenso') as prove_pubbliche;
