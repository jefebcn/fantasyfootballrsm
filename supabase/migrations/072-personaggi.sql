-- =====================================================================
-- 072 — Il personaggio somigliante dei calciatori, con il loro consenso
--
-- Da eseguire DOPO la 041 e la 044 (consensi). Si può rieseguire.
--
-- PERCHÉ (Alex, 26/11). Gli avatar di oggi (src/avatar.js) «non provano a
-- somigliare a nessuno», apposta: una caricatura riconoscibile e' immagine
-- della persona (art. 10 c.c., artt. 96-97 L. 633/1941) e l'app ha sponsor e
-- shop. Il testo v1 della 044 lo diceva gia': per «ogni altro uso della tua
-- immagine» serve un accordo scritto a parte. Questo e' quell'accordo, e vale
-- solo se:
--   - il calciatore ha il «Ci sto» verificato e non ritirato (un volto
--     somigliante accanto a «Giocatore N» annullerebbe l'esclusione);
--   - e' maggiorenne (per ora niente personaggi sotto i 18 anni, nemmeno col
--     genitore);
--   - ha spuntato la casella del personaggio (nuova, facoltativa, testo v2);
--   - ha approvato QUEL disegno. Ogni disegno nuovo si riapprova.
--
-- COSA C'È.
--  1. consensi_testi: il testo v2 (bozza da far leggere al legale: finche'
--     nessuno ci aderisce, rieseguire questa migrazione lo aggiorna).
--  2. adesioni_giocatori.personaggio: la casella, che dopo l'invio non si
--     cambia come le altre scelte (il sigillo della 044 la include).
--  3. personaggi: un disegno per giocatore, con il suo stato
--     (lavorazione → da_approvare → approvato, oppure rifiutato o ritirato).
--     Ogni passaggio finisce nel registro dei consensi della 044.
--  4. personaggi_attivi(): quelli da mostrare, per tutti. Il controllo del
--     consenso sta QUI, non nell'app: se il consenso cade, il personaggio
--     sparisce al caricamento successivo, senza aspettare nessuno.
--  5. Il ritiro automatico: un consenso ritirato, un «Non voglio comparire»
--     verificato, un «Ci sto» senza personaggio o un'esclusione (041)
--     mettono il personaggio in «ritirato», e il file va cancellato.
--  6. Il calciatore risponde da solo: con il suo codice vede il disegno e
--     dice «va bene», «rifatelo» o «no grazie».
--  7. Storage: «personaggi» pubblico (i disegni approvati, un nome per ogni
--     versione: un ritiro o un rifacimento cambia indirizzo) e «selfie»
--     privato (le due foto, caricate col codice, lette solo da chi
--     amministra, cancellate entro 30 giorni).
-- =====================================================================

-- ------------------------------------------------------- 1. il testo v2
insert into public.consensi_testi (versione, testo, impronta, dal)
select 'v2 · 26/11/2026', t, encode(sha256(convert_to(t, 'UTF8')), 'hex'), '2026-11-26 12:00+01'
  from (select replace($testo$Le frasi che si spuntano
[scelta] Ci sto. Il mio nome e le mie statistiche di gara possono comparire in Fantatitano: nel gioco, nelle classifiche e nei post dei social di Fantatitano.
[facoltativa, solo con «Ci sto»] Anche con sponsor e premi (facoltativo). Il mio nome può comparire anche in iniziative con uno sponsor o con premi. Foto, video e voce no: per quelli mi chiederete a parte, per iscritto.
[facoltativa, solo con «Ci sto», solo maggiorenni] Voglio il mio personaggio (facoltativo). Fantatitano può disegnare un personaggio a fumetto che mi somiglia, partendo da due mie foto che mando io, e usarlo al posto dell'avatar generico nel gioco e nei post e nelle storie dei social di Fantatitano.
[scelta] Non voglio comparire. Mostratemi solo come «Giocatore», con ruolo e squadra. Formazioni e punteggi degli altri non cambiano.
[sotto i 18 anni] Sono il genitore o il tutore e sono d'accordo con la scelta qui sopra.
[obbligatoria] Dichiaro di essere la persona indicata (o il suo genitore) e di aver letto cosa vuol dire.
Cosa comprende il «Ci sto»
Il tuo nome, ruolo, squadra e statistiche di gara (presenze, minuti, gol, assist, cartellini) nel gioco: listone, rose, formazioni, voti e classifiche.
Lo stesso nei post e nelle storie dei social di Fantatitano, per esempio «i migliori della giornata».
Solo se spunti anche la casella sponsor: le stesse informazioni in iniziative con uno sponsor o con premi.
Il personaggio, se spunti la sua casella
Le foto. Due foto del tuo viso, una di fronte e una di tre quarti, le mandi tu da questa pagina. Non usiamo foto prese da altre parti: federazione, giornali, social.
Come lo disegniamo. Con un servizio di intelligenza artificiale (Google Gemini), alle condizioni che non usano le tue foto per addestrarlo; poi lo rifiniamo noi, nello stile delle figurine di Fantatitano, con la maglia nei colori della tua squadra ma senza stemmi o marchi ufficiali.
La tua approvazione. Prima di pubblicarlo ti mostriamo il disegno: compare solo se lo approvi. Puoi chiedere di rifarlo o rinunciare. Ogni versione nuova la riapprovi tu.
Dove compare. Dove compare il tuo nome: listone, rose, formazioni, schede dei giocatori, card da condividere, post e storie dei social di Fantatitano. In iniziative con uno sponsor o con premi solo se hai spuntato anche quella casella.
Cosa non comprende. Prodotti in vendita (magliette, gadget, lo shop), pubblicità a pagamento, l'uso da parte di altri, versioni del disegno che non hai approvato.
Le tue foto. Le teniamo solo finché il disegno non è approvato o rifiutato, e comunque al massimo 30 giorni; poi le cancelliamo, anche dal servizio usato per disegnarlo. Conserviamo solo il disegno approvato e la prova della tua approvazione.
Solo per i maggiorenni. Per ora il personaggio non si fa sotto i 18 anni, nemmeno con il consenso di un genitore.
Cosa non comprende il «Ci sto»
Foto, video, voce e ogni altro uso della tua immagine, salvo il personaggio se spunti la sua casella: per gli altri usi ti scriviamo a parte e serve un tuo accordo scritto, caso per caso.
Dati diversi da quelli di gara: età, contatti e residenza non compaiono mai nell'app.
Se sei minorenne
Sotto i 18 anni il consenso lo dà anche un genitore o chi ne fa le veci, indicato nel modulo.
Come verifichiamo che sei tu
Dopo l'invio ricevi un codice. Ce lo mandi in privato dal tuo profilo Instagram a @fantatitano, oppure ce lo conferma il dirigente della tua squadra. Finché non è verificato il consenso non vale e nell'app non cambia niente; anche il personaggio si disegna solo dopo la verifica.
Se cambi idea
Puoi ritirare il consenso quando vuoi: da questa pagina, scegliendo «Non voglio comparire», oppure scrivendo a support@fantatitano.site. Entro 7 giorni nell'app compari come «Giocatore», con ruolo e squadra. Puoi anche ritirare solo il personaggio e restare col tuo nome: entro 7 giorni torni all'avatar generico. Se ce lo chiedi togliamo il tuo nome e il tuo personaggio anche dai post già pubblicati. Ritirarlo non costa niente e non ha conseguenze.
Cosa conserviamo
La tua scelta, il nome, la squadra, il profilo Instagram se lo hai dato, se sei maggiorenne (e il nome del genitore), data e ora, l'indirizzo IP e il tipo di dispositivo da cui hai inviato, la versione di questo testo e come abbiamo verificato che sei tu, compreso lo screenshot del messaggio di verifica. Se hai chiesto il personaggio, anche le due foto (per il tempo detto sopra), il disegno approvato e come e quando l'hai approvato. Lo legge solo chi gestisce l'app. Lo teniamo finché il consenso vale e per 2 anni dopo un ritiro, come prova di cosa avevi scelto.$testo$, E'\r', '')::text as t) x
on conflict (versione) do update set testo = excluded.testo, impronta = excluded.impronta
  where public.consensi_testi.testo <> excluded.testo
    and not exists (select 1 from public.adesioni_giocatori a where to_jsonb(a) ->> 'versione' = excluded.versione);

-- -------------------------------------------------- 2. la casella
alter table public.adesioni_giocatori
  add column if not exists personaggio          boolean not null default false,
  -- quando chi amministra ha cancellato le due foto dallo storage (al piu'
  -- 30 giorni, testo v2). Non e' una scelta del calciatore: si scrive dopo.
  add column if not exists selfie_cancellate_at timestamptz;
alter table public.adesioni_giocatori drop constraint if exists adesioni_personaggio;
alter table public.adesioni_giocatori add constraint adesioni_personaggio
  check (not personaggio or (scelta = 'aderisco' and maggiorenne is true));

-- Il sigillo della 044, con la casella nuova fra le cose che non si cambiano.
create or replace function public.adesioni_sigillo() returns trigger
language plpgsql security definer set search_path = public as $$
declare h json := nullif(current_setting('request.headers', true), '')::json;
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.ip := coalesce(split_part(h ->> 'x-forwarded-for', ',', 1), h ->> 'cf-connecting-ip', h ->> 'x-real-ip');
    new.dispositivo := left(h ->> 'user-agent', 300);
    -- una richiesta nasce in attesa, anche se la scrive chi amministra
    new.stato := 'attesa'; new.verificato_come := null; new.verificato_at := null; new.verificato_da := null;
    new.prova := null; new.player_id := null; new.ritirato_at := null; new.selfie_cancellate_at := null;
    return new;
  end if;
  if (new.nome, new.squadra, new.scelta, new.sponsor, new.personaggio, new.maggiorenne, new.genitore, new.instagram,
      new.codice, new.versione, new.created_at, new.ip, new.dispositivo, new.contatto, new.nota)
     is distinct from
     (old.nome, old.squadra, old.scelta, old.sponsor, old.personaggio, old.maggiorenne, old.genitore, old.instagram,
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
  if old.selfie_cancellate_at is not null and new.selfie_cancellate_at is distinct from old.selfie_cancellate_at then
    raise exception 'La cancellazione delle foto ha già la sua data';
  end if;
  if new.stato = 'verificato' and old.stato <> 'verificato' then
    if not exists (select 1 from public.prove_consenso pc where pc.id::text = new.prova and pc.adesione_id = new.id) then
      raise exception 'La verifica vuole lo screenshot del messaggio, caricato per questa richiesta';
    end if;
    new.verificato_at := now();
    new.verificato_da := public.current_user_id();
  end if;
  return new;
end $$;
revoke execute on function public.adesioni_sigillo() from public, anon, authenticated;

-- Una riga nel registro della 044 (stessa catena, stesse impronte) per i
-- passaggi del personaggio, che non sono update di adesioni_giocatori.
create or replace function public.registra_consenso(p_adesione bigint, p_evento text, p_dati jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare prec text; q timestamptz := clock_timestamp(); c text := public.current_user_id();
begin
  perform pg_advisory_xact_lock(4404404);  -- lo stesso lucchetto della 044: la catena non si biforca
  select r.impronta into prec from public.consensi_registro r order by r.id desc limit 1;
  insert into public.consensi_registro (adesione_id, evento, chi, quando, dati, impronta_prec, impronta)
  values (p_adesione, p_evento, c, q, p_dati, prec, public.impronta_registro(prec, p_adesione, p_evento, c, q, p_dati));
end $$;
revoke execute on function public.registra_consenso(bigint, text, jsonb) from public, anon, authenticated;

-- Il consenso al personaggio vale adesso? Conta l'ultima richiesta verificata
-- del giocatore (come per il bollino della 044), e l'esclusione vince su tutto.
create or replace function public.consenso_personaggio(p_player text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select x.scelta = 'aderisco' and x.ritirato_at is null and x.personaggio and x.maggiorenne is true
      from public.adesioni_giocatori x
     where x.stato = 'verificato' and x.player_id = p_player
     order by x.verificato_at desc nulls last, x.id desc
     limit 1), false)
    and not exists (select 1 from public.giocatori_esclusi e where e.player_id = p_player)
$$;
revoke execute on function public.consenso_personaggio(text) from public, anon, authenticated;

-- ------------------------------------------------- 3. i personaggi
create table if not exists public.personaggi (
  player_id      text primary key,
  -- il consenso su cui si regge: verificato, con la casella, maggiorenne
  adesione_id    bigint not null references public.adesioni_giocatori(id),
  stato          text not null default 'lavorazione',
  -- il nome nel bucket «personaggi», senza misura ne' estensione: l'app
  -- chiede <file>-256.webp e <file>-512.webp. Comincia con l'id del
  -- giocatore e finisce con 16 cifre a caso: un disegno nuovo e' un nome nuovo.
  file           text,
  approvato_come text,
  approvato_at   timestamptz,
  ritirato_at    timestamptz,
  aggiornato_at  timestamptz not null default now(),
  aggiornato_da  text
);
alter table public.personaggi drop constraint if exists personaggi_stato;
alter table public.personaggi add constraint personaggi_stato
  check (stato in ('lavorazione', 'da_approvare', 'approvato', 'rifiutato', 'ritirato'));
alter table public.personaggi drop constraint if exists personaggi_file;
alter table public.personaggi add constraint personaggi_file
  check (file is null or (file ~ '^[a-z0-9_-]{1,40}-[0-9a-f]{16}$' and left(file, char_length(player_id) + 1) = player_id || '-'));
alter table public.personaggi drop constraint if exists personaggi_come;
alter table public.personaggi add constraint personaggi_come
  check (approvato_come is null or approvato_come in ('instagram', 'societa', 'pagina'));
alter table public.personaggi drop constraint if exists personaggi_approvato;
alter table public.personaggi add constraint personaggi_approvato
  check (stato <> 'approvato' or (file is not null and approvato_come is not null and approvato_at is not null));
create index if not exists personaggi_adesione on public.personaggi (adesione_id);

alter table public.personaggi enable row level security;
revoke all on table public.personaggi from public, anon, authenticated;
grant select, insert, update on table public.personaggi to authenticated;
drop policy if exists personaggi_leggi on public.personaggi;
drop policy if exists personaggi_inserisci on public.personaggi;
drop policy if exists personaggi_aggiorna on public.personaggi;
create policy personaggi_leggi on public.personaggi for select to authenticated using ((select public.is_admin()));
create policy personaggi_inserisci on public.personaggi for insert to authenticated with check ((select public.is_admin()));
create policy personaggi_aggiorna on public.personaggi for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
-- niente delete: un personaggio ritirato resta come prova, senza file

-- Le regole dei passaggi, per chiunque scriva (anche chi amministra).
create or replace function public.personaggi_sigillo() returns trigger
language plpgsql security definer set search_path = public as $$
declare a public.adesioni_giocatori%rowtype; nuovo_consenso boolean;
begin
  nuovo_consenso := tg_op = 'INSERT' or new.adesione_id is distinct from old.adesione_id;
  if nuovo_consenso then
    select * into a from public.adesioni_giocatori where id = new.adesione_id;
    if a.id is null or a.stato <> 'verificato' or a.player_id is distinct from new.player_id
       or a.scelta <> 'aderisco' or a.ritirato_at is not null or not a.personaggio or a.maggiorenne is not true then
      raise exception 'Il personaggio vuole un «Ci sto» verificato di questo giocatore, maggiorenne, con la casella del personaggio';
    end if;
    if not public.consenso_personaggio(new.player_id) then
      raise exception 'Il consenso al personaggio di questo giocatore non vale piu''';
    end if;
    -- un consenso nuovo riparte da capo: il disegno, se c'e', va riapprovato
    new.stato := case when new.file is null then 'lavorazione' else 'da_approvare' end;
    new.approvato_come := null; new.approvato_at := null; new.ritirato_at := null;
  else
    if new.player_id <> old.player_id then raise exception 'Il giocatore di un personaggio non cambia'; end if;
    if old.stato = 'ritirato' and (new.stato <> 'ritirato' or new.file is not null and new.file is distinct from old.file) then
      raise exception 'Un personaggio ritirato torna solo con un consenso nuovo';
    end if;
    if old.stato = 'ritirato' then new.ritirato_at := old.ritirato_at; end if;
    -- un disegno nuovo (o rifatto) si riapprova sempre
    if new.file is not null and new.file is distinct from old.file then
      new.stato := 'da_approvare'; new.approvato_come := null; new.approvato_at := null;
    elsif new.stato = 'approvato' and old.stato <> 'approvato' then
      if old.stato <> 'da_approvare' or new.file is null then
        raise exception 'Si approva solo un disegno caricato e mostrato al giocatore';
      end if;
      if not public.consenso_personaggio(new.player_id) then
        raise exception 'Il consenso al personaggio di questo giocatore non vale piu''';
      end if;
      if new.approvato_come is null then raise exception 'Come ha approvato? instagram, societa o pagina'; end if;
      new.approvato_at := now();
    elsif new.stato = 'approvato' then
      new.approvato_come := old.approvato_come; new.approvato_at := old.approvato_at;
    elsif new.stato <> 'approvato' then
      new.approvato_come := null; new.approvato_at := null;
    end if;
    if new.stato = 'ritirato' and old.stato <> 'ritirato' then new.ritirato_at := now(); end if;
    if new.stato <> 'ritirato' then new.ritirato_at := null; end if;
  end if;
  new.aggiornato_at := now();
  new.aggiornato_da := public.current_user_id();
  return new;
end $$;
revoke execute on function public.personaggi_sigillo() from public, anon, authenticated;
drop trigger if exists personaggi_sigillo on public.personaggi;
create trigger personaggi_sigillo before insert or update on public.personaggi
  for each row execute function public.personaggi_sigillo();

-- Ogni passaggio nel registro dei consensi: stato nuovo, disegno nuovo,
-- file cancellato.
create or replace function public.personaggi_registra() returns trigger
language plpgsql security definer set search_path = public as $$
declare ev text;
begin
  ev := case
    when tg_op = 'INSERT' or new.stato is distinct from old.stato then 'personaggio_' || new.stato
    when new.file is not null and new.file is distinct from old.file then 'personaggio_da_approvare'
    when new.file is null and old.file is not null then 'personaggio_file_cancellato'
    else null end;
  if ev is not null then
    perform public.registra_consenso(new.adesione_id, ev,
      jsonb_build_object('player_id', new.player_id, 'file', new.file, 'stato', new.stato,
                         'approvato_come', new.approvato_come, 'approvato_at', new.approvato_at, 'ritirato_at', new.ritirato_at));
  end if;
  return new;
end $$;
revoke execute on function public.personaggi_registra() from public, anon, authenticated;
drop trigger if exists personaggi_registra on public.personaggi;
create trigger personaggi_registra after insert or update on public.personaggi
  for each row execute function public.personaggi_registra();

-- ------------------------------------------------ 4. quelli da mostrare
-- Per tutti, anche senza account: solo approvati, col consenso che vale
-- adesso, e niente se e' accesa la modalita' dei nomi brevi (041).
create or replace function public.personaggi_attivi() returns table (player_id text, file text)
language sql stable security definer set search_path = public as $$
  select p.player_id, p.file
    from public.personaggi p
   where p.stato = 'approvato' and p.file is not null
     and public.consenso_personaggio(p.player_id)
     and not coalesce((select i.acceso from public.app_interruttori i where i.chiave = 'nomi_brevi'), false)
   order by p.player_id
$$;
revoke all on function public.personaggi_attivi() from public;
grant execute on function public.personaggi_attivi() to anon, authenticated;

-- ------------------------------------------------- 5. il ritiro automatico
create or replace function public.personaggi_riallinea(p_player text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_player is null then return; end if;
  update public.personaggi set stato = 'ritirato'
   where player_id = p_player and stato <> 'ritirato' and not public.consenso_personaggio(p_player);
end $$;
revoke execute on function public.personaggi_riallinea(text) from public, anon, authenticated;

create or replace function public.personaggi_dopo_consenso() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.personaggi_riallinea(new.player_id);
  return new;
end $$;
revoke execute on function public.personaggi_dopo_consenso() from public, anon, authenticated;
drop trigger if exists personaggi_dopo_consenso on public.adesioni_giocatori;
create trigger personaggi_dopo_consenso after update on public.adesioni_giocatori
  for each row execute function public.personaggi_dopo_consenso();
drop trigger if exists personaggi_dopo_esclusione on public.giocatori_esclusi;
create trigger personaggi_dopo_esclusione after insert or update on public.giocatori_esclusi
  for each row execute function public.personaggi_dopo_consenso();

-- I file da togliere dallo storage: personaggi ritirati o rifiutati che
-- hanno ancora un file. Li cancella lo script (o una funzione), che poi
-- mette file = null. Solo chi amministra.
create or replace function public.personaggi_da_cancellare() returns table (player_id text, file text, stato text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Solo chi amministra'; end if;
  return query select p.player_id, p.file, p.stato from public.personaggi p
                where p.stato in ('ritirato', 'rifiutato') and p.file is not null order by p.player_id;
end $$;
revoke all on function public.personaggi_da_cancellare() from public, anon;
grant execute on function public.personaggi_da_cancellare() to authenticated;

-- Le cartelle di foto da cancellare (testo v2: «al massimo 30 giorni»):
-- disegno deciso (approvato, rifiutato, ritirato) o richiesta di piu' di 30
-- giorni fa. Dopo averle tolte si scrive selfie_cancellate_at.
create or replace function public.selfie_da_cancellare() returns table (adesione_id bigint, codice text, entro timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Solo chi amministra'; end if;
  return query
    select a.id, a.codice, a.created_at + interval '30 days'
      from public.adesioni_giocatori a
     where a.personaggio and a.selfie_cancellate_at is null and a.codice is not null
       and (a.created_at < now() - interval '30 days'
            or a.stato = 'respinto' or a.ritirato_at is not null
            or exists (select 1 from public.personaggi p where p.adesione_id = a.id
                        and p.stato in ('approvato', 'rifiutato', 'ritirato')))
     order by a.created_at;
end $$;
revoke all on function public.selfie_da_cancellare() from public, anon;
grant execute on function public.selfie_da_cancellare() to authenticated;

-- ------------------------------------- 6. il calciatore risponde da solo
-- Con il codice della sua richiesta verificata vede il disegno da approvare
-- (o quello approvato) e risponde. Il codice glielo abbiamo dato noi e ce
-- l'ha rimandato dal suo profilo: e' la stessa prova della verifica.
create or replace function public.personaggio_bozza(p_codice text)
returns table (player_id text, file text, stato text)
language sql stable security definer set search_path = public as $$
  select p.player_id, p.file, p.stato
    from public.adesioni_giocatori a join public.personaggi p on p.adesione_id = a.id and p.player_id = a.player_id
   where a.codice = upper(btrim(p_codice)) and a.stato = 'verificato' and a.ritirato_at is null
     and p.stato in ('da_approvare', 'approvato') and p.file is not null
$$;
revoke all on function public.personaggio_bozza(text) from public;
grant execute on function public.personaggio_bozza(text) to anon, authenticated;

-- p_risposta: 'si' (lo approvo), 'rifare' (torna in lavorazione), 'no' (rinuncio)
create or replace function public.personaggio_rispondi(p_codice text, p_risposta text)
returns text language plpgsql security definer set search_path = public as $$
declare a public.adesioni_giocatori%rowtype; p public.personaggi%rowtype;
begin
  if p_risposta not in ('si', 'rifare', 'no') then raise exception 'Risposta: si, rifare o no'; end if;
  select * into a from public.adesioni_giocatori
   where codice = upper(btrim(p_codice)) and stato = 'verificato' and ritirato_at is null;
  if a.id is null then raise exception 'Codice non trovato'; end if;
  select * into p from public.personaggi where adesione_id = a.id and player_id = a.player_id for update;
  if p.player_id is null or p.stato <> 'da_approvare' then raise exception 'Nessun disegno da approvare'; end if;
  update public.personaggi
     set stato = case p_risposta when 'si' then 'approvato' when 'rifare' then 'lavorazione' else 'rifiutato' end,
         approvato_come = case when p_risposta = 'si' then 'pagina' end
   where player_id = p.player_id;
  return case p_risposta when 'si' then 'approvato' when 'rifare' then 'lavorazione' else 'rifiutato' end;
end $$;
revoke all on function public.personaggio_rispondi(text, text) from public;
grant execute on function public.personaggio_rispondi(text, text) to anon, authenticated;

-- ------------------------------------------------------- 7. lo storage
-- Una foto si carica solo nella cartella del proprio codice, se la
-- richiesta chiede il personaggio, e' di un maggiorenne, non e' respinta ne'
-- ritirata e ha meno di 14 giorni: «FT-AB12/fronte.jpg», «FT-AB12/tre-quarti.jpg».
create or replace function public.selfie_ammesso(p_nome text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_nome ~ '^FT-[A-Z0-9]{4}/(fronte|tre-quarti)\.(jpg|webp)$'
     and exists (select 1 from public.adesioni_giocatori a
                  where a.codice = split_part(p_nome, '/', 1) and a.personaggio and a.maggiorenne is true
                    and a.scelta = 'aderisco' and a.stato <> 'respinto' and a.ritirato_at is null
                    and a.selfie_cancellate_at is null and a.created_at > now() - interval '14 days')
$$;
revoke all on function public.selfie_ammesso(text) from public;
grant execute on function public.selfie_ammesso(text) to anon, authenticated;

-- Su Supabase lo schema storage c'e'; nel Postgres nudo delle prove no.
do $$ begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('personaggi', 'personaggi', true, 524288, array['image/webp']),
           ('selfie', 'selfie', false, 5242880, array['image/jpeg', 'image/webp'])
    on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
                                   allowed_mime_types = excluded.allowed_mime_types;
    execute 'drop policy if exists personaggi_admin_leggi on storage.objects';
    execute 'drop policy if exists personaggi_admin_carica on storage.objects';
    execute 'drop policy if exists personaggi_admin_cancella on storage.objects';
    execute 'drop policy if exists selfie_carica on storage.objects';
    execute 'drop policy if exists selfie_admin_leggi on storage.objects';
    execute 'drop policy if exists selfie_admin_cancella on storage.objects';
    -- personaggi: pubblico in lettura (indirizzo diretto), scrive solo chi
    -- amministra, nessuna sovrascrittura (niente update: un disegno nuovo e'
    -- un nome nuovo, cosi' le cache non tengono quello vecchio)
    execute $p$create policy personaggi_admin_leggi on storage.objects for select to authenticated
      using (bucket_id = 'personaggi' and (select public.is_admin()))$p$;
    execute $p$create policy personaggi_admin_carica on storage.objects for insert to authenticated
      with check (bucket_id = 'personaggi' and (select public.is_admin()))$p$;
    execute $p$create policy personaggi_admin_cancella on storage.objects for delete to authenticated
      using (bucket_id = 'personaggi' and (select public.is_admin()))$p$;
    -- selfie: carica il calciatore col codice, legge e cancella solo chi amministra
    execute $p$create policy selfie_carica on storage.objects for insert to anon, authenticated
      with check (bucket_id = 'selfie' and public.selfie_ammesso(name))$p$;
    execute $p$create policy selfie_admin_leggi on storage.objects for select to authenticated
      using (bucket_id = 'selfie' and (select public.is_admin()))$p$;
    execute $p$create policy selfie_admin_cancella on storage.objects for delete to authenticated
      using (bucket_id = 'selfie' and (select public.is_admin()))$p$;
  end if;
end $$;

-- Controllo: il testo v2 c'e' con la sua impronta, nessun personaggio attivo.
select (select left(impronta, 16) from public.consensi_testi where versione = 'v2 · 26/11/2026') as impronta_testo_v2,
       (select count(*) from public.personaggi) as personaggi,
       (select count(*) from public.personaggi_attivi()) as attivi;
