-- Un'e-mail all'organizzatore per ogni nuovo iscritto.
--
-- PERCHE'. Alex, 10/10: «ogni volta che un nuovo utente si iscrive mi arriva
-- un'e-mail». Chi si iscrive non lo diceva nessuno: si scopriva aprendo la
-- console admin.
--
-- QUANDO PARTE. Quando l'iscritto CONFERMA l'indirizzo, non quando compila il
-- modulo: chi si registra e non conferma non e' ancora un giocatore, e ogni
-- prova o errore di battitura sarebbe un'e-mail. Se un giorno la conferma via
-- e-mail si spegne, l'account nasce gia' confermato e l'avviso parte subito.
--
-- COME. Un trigger su auth.users chiama con pg_net l'API di Resend, lo
-- stesso servizio che spedisce gia' le e-mail di conferma. Niente Edge
-- Function, niente GitHub: parte dal database nel momento stesso della
-- conferma. Se Resend non risponde l'iscrizione va avanti lo stesso: l'avviso
-- non deve MAI far fallire un'iscrizione.
--
-- COME SI USA. Ci sono DUE righe da riempire, qui sotto. Poi si lancia tutto
-- il file nel SQL Editor di Supabase. Se le righe non sono riempite il file
-- si ferma e lo dice, senza creare niente. La chiave e l'indirizzo restano
-- nel database, in uno schema che l'API non espone: non vanno nel
-- repository, che e' pubblico, ne' in chat.
--
-- SI PUO' RILANCIARE quando vuoi: e' anche il modo di cambiare chiave o
-- indirizzo.
--
-- DOPO, per vedere com'e' andata:
--   select * from interno.avvisi_iscritti_ultimi;
-- Per spegnerlo:
--   drop trigger if exists avvisa_nuovo_iscritto on auth.users;


-- ===================== LE DUE RIGHE DA RIEMPIRE =====================
-- Sono le due righe subito sotto «declare»: si cambia solo il testo fra
-- apici, gli apici restano.
-- 1. La chiave API di Resend: resend.com -> API Keys -> Create API Key,
--    permesso «Sending access», dominio fantatitano.site. Comincia con re_.
--    ATTENZIONE: Resend la mostra UNA volta sola, appena creata. Nella lista
--    delle chiavi ci sono solo il nome e l'ID, che non funzionano: se non
--    l'hai copiata in quel momento, creane una nuova.
-- 2. L'indirizzo a cui arrivano gli avvisi: il tuo.
--
-- Prima le due righe stavano in due set_config separati da questo blocco: se
-- il SQL Editor esegue i comandi su connessioni diverse, il blocco non le
-- vedeva e diceva «manca la chiave» anche a chi l'aveva scritta (Alex,
-- 10/10). Ora valori, controlli e salvataggio stanno nello stesso comando.
do $$
declare
  chiave    text := 'INCOLLA_QUI_LA_CHIAVE_DI_RESEND';
  indirizzo text := 'INCOLLA_QUI_IL_TUO_INDIRIZZO';
  -- copiando da una pagina si portano dietro spazi, a capo e virgolette
  k text := btrim(coalesce(chiave, ''), E' \t\r\n"');
  a text := lower(btrim(coalesce(indirizzo, ''), E' \t\r\n"<>'));
begin
  -- I due testi di esempio compaiono UNA volta sola in tutto il file, nelle
  -- due righe qui sopra. Prima comparivano anche nei controlli: chi usava
  -- «sostituisci» o «sostituisci tutto» cambiava anche il controllo, che
  -- confrontava la chiave con se stessa e diceva «manca la chiave» (Alex,
  -- 10/10, due volte). Per questo qui sotto si guarda solo l'inizio.
  if k = '' or k like 'INCOLLA\_QUI%' then
    raise exception 'Manca la chiave di Resend: nella riga «chiave text := ...», subito sotto declare, c''e'' ancora il testo di esempio. Al suo posto, fra gli apici, va la chiave API (comincia con re_).';
  end if;
  if k not like 're\_%' then
    raise exception 'La chiave scritta non e'' una chiave API di Resend: comincia con «%» invece che con re_ (e'' lunga % caratteri). Forse e'' l''ID della chiave: su Resend il valore si vede solo appena la crei. Creane una nuova e copia quello.', left(k, 3), length(k);
  end if;
  if length(k) < 20 or k ~ '\s' then
    raise exception 'La chiave di Resend sembra incompleta o spezzata: e'' lunga % caratteri%. Ricopiala intera, senza a capo in mezzo.', length(k), case when k ~ '\s' then ' e contiene spazi' else '' end;
  end if;
  if a !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Manca il tuo indirizzo: nella riga «indirizzo text := ...», subito sotto quella della chiave, al posto del testo di esempio va l''e-mail a cui mandare gli avvisi.';
  end if;

  create schema if not exists interno;
  revoke all on schema interno from public;

  -- La configurazione: una riga sola, leggibile solo dal proprietario.
  create table if not exists interno.avviso_iscritti_config (
    id       int primary key default 1 check (id = 1),
    chiave   text not null,
    a        text not null,
    da       text not null default 'Fantatitano <no-reply@fantatitano.site>',
    scritta_at timestamptz not null default now()
  );
  alter table interno.avviso_iscritti_config enable row level security;
  revoke all on table interno.avviso_iscritti_config from public;

  insert into interno.avviso_iscritti_config (id, chiave, a)
  values (1, k, a)
  on conflict (id) do update
    set chiave = excluded.chiave, a = excluded.a, scritta_at = now();
end $$;
-- ====================================================================


create extension if not exists pg_net;


-- Il registro: chi ha fatto partire quale richiesta. La risposta di Resend la
-- scrive pg_net poco dopo, e la vista in fondo le mette insieme.
create table if not exists interno.avvisi_iscritti (
  id         bigserial primary key,
  quando     timestamptz not null default now(),
  utente     uuid,
  request_id bigint
);
alter table interno.avvisi_iscritti enable row level security;
revoke all on table interno.avvisi_iscritti from public;


-- Toglie dal nome quello che in un'e-mail HTML diventerebbe codice: il nome
-- lo sceglie chi si iscrive.
create or replace function interno.html_sicuro(t text) returns text
language sql immutable as $$
  select replace(replace(replace(replace(replace(coalesce(t, ''),
    '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), '''', '&#39;')
$$;


create or replace function interno.avvisa_nuovo_iscritto()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  c      record;
  sch    text;
  rid    bigint;
  nome   text;
  totale bigint;
begin
  -- solo il passaggio da "non confermato" a "confermato", o un account che
  -- nasce gia' confermato
  if new.email_confirmed_at is null then return new; end if;
  if tg_op = 'UPDATE' and old.email_confirmed_at is not null then return new; end if;

  begin
    select * into c from interno.avviso_iscritti_config where id = 1;
    if not found then return new; end if;

    select n.nspname into sch
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where p.proname = 'http_post' and n.nspname in ('net', 'extensions', 'public')
     order by case n.nspname when 'net' then 1 when 'extensions' then 2 else 3 end
     limit 1;
    if sch is null then return new; end if;

    nome := nullif(trim(coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'name', '')), '');
    select count(*) into totale from auth.users where email_confirmed_at is not null;

    execute format(
      'select %I.http_post(url := $1, headers := $2, body := $3, timeout_milliseconds := $4)', sch)
      into rid
      using 'https://api.resend.com/emails',
            jsonb_build_object('Authorization', 'Bearer ' || c.chiave, 'Content-Type', 'application/json'),
            jsonb_build_object(
              'from', c.da,
              'to', jsonb_build_array(c.a),
              'subject', 'Nuovo iscritto su Fantatitano: ' || coalesce(nome, new.email) || ' (' || totale || ')',
              'html',
                '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5">'
                || '<p><b>' || interno.html_sicuro(coalesce(nome, 'Senza nome')) || '</b> ha appena confermato l''iscrizione a Fantatitano.</p>'
                || '<p>E-mail: ' || interno.html_sicuro(new.email) || '<br>'
                || 'Quando: ' || to_char(new.email_confirmed_at at time zone 'Europe/Rome', 'DD/MM/YYYY HH24:MI') || '</p>'
                || '<p>Iscritti confermati in tutto: <b>' || totale || '</b></p></div>'),
            10000;

    insert into interno.avvisi_iscritti (utente, request_id) values (new.id, rid);
  exception when others then
    -- l'iscrizione conta piu' dell'avviso: qualunque cosa vada storta qui,
    -- si segna e si va avanti
    begin
      insert into interno.avvisi_iscritti (utente, request_id) values (new.id, null);
    exception when others then null;
    end;
  end;
  return new;
end $$;

revoke all on function interno.avvisa_nuovo_iscritto() from public;

drop trigger if exists avvisa_nuovo_iscritto on auth.users;
create trigger avvisa_nuovo_iscritto
  after insert or update of email_confirmed_at on auth.users
  for each row execute function interno.avvisa_nuovo_iscritto();


-- Com'e' andata: le ultime richieste con la risposta di Resend.
do $$
declare sch text;
begin
  select n.nspname into sch
    from pg_class t join pg_namespace n on n.oid = t.relnamespace
   where t.relname = '_http_response' and n.nspname in ('net', 'extensions', 'public')
   limit 1;
  if sch is null then
    execute 'create or replace view interno.avvisi_iscritti_ultimi as
      select a.quando, a.utente, a.request_id, null::int as stato, null::text as risposta
        from interno.avvisi_iscritti a order by a.id desc limit 20';
  else
    execute format('create or replace view interno.avvisi_iscritti_ultimi as
      select a.quando, a.utente, a.request_id, r.status_code as stato,
             coalesce(left(r.content, 200), r.error_msg) as risposta
        from interno.avvisi_iscritti a left join %I._http_response r on r.id = a.request_id
       order by a.id desc limit 20', sch);
  end if;
end $$;
revoke all on interno.avvisi_iscritti_ultimi from public;
