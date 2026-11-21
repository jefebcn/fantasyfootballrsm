-- =====================================================================
-- 056 — Lo shop: gli ordini del top Fantatitano
--
-- Si può rieseguire.
--
-- PERCHÉ (Alex, 12/11: «vorrei implementare una sezione shop, al momento per
-- le cose di abbigliamento»). Nell'app non c'è un sistema di pagamento, e
-- Alex ha scelto l'ordine in app: chi compra sceglie taglia e consegna e
-- lascia nome e recapito; l'ordine si salva qui e lo si vede nella console
-- admin. Il pagamento si concorda dopo (al ritiro, bonifico, PayPal).
--
--  1. shop_ordini: una riga per ordine. Nessuno la legge direttamente: si
--     passa solo dalle funzioni qui sotto.
--  2. shop_ordina(): l'ordine di chi è dentro. Il PREZZO LO DECIDE IL
--     DATABASE (catalogo qui sotto), non il telefono: un totale mandato
--     dall'app si potrebbe cambiare. Al massimo 5 ordini al giorno a testa.
--  3. shop_miei_ordini(): i propri ordini, senza i dati di consegna.
--  4. admin_shop_ordini() e admin_shop_stato(): per l'admin, tutti gli ordini
--     e il cambio di stato (nuovo → pagato → spedito/consegnato, o annullato).
--  5. Un'e-mail ad Alex per ogni ordine nuovo, con lo stesso servizio e la
--     stessa configurazione dell'avviso dei nuovi iscritti
--     (supabase/avviso-nuovi-iscritti.sql). Se quella configurazione non c'è,
--     niente e-mail: l'ordine si salva lo stesso, e non deve MAI fallire per
--     colpa dell'avviso.
--  6. Chi cancella l'account si porta via anche i suoi ordini.
-- =====================================================================

create table if not exists public.shop_ordini (
  id              bigint generated always as identity primary key,
  creato_at       timestamptz not null default now(),
  aggiornato_at   timestamptz not null default now(),
  user_id         text not null,
  articolo        text not null,
  taglia          text not null check (taglia in ('S', 'M', 'L', 'XL')),
  quantita        smallint not null check (quantita between 1 and 5),
  consegna        text not null check (consegna in ('spedizione', 'ritiro')),
  nome            text not null check (char_length(nome) between 2 and 80),
  contatto        text not null check (char_length(contatto) between 3 and 120),
  indirizzo       text check (indirizzo is null or char_length(indirizzo) <= 300),
  note            text check (note is null or char_length(note) <= 300),
  prezzo_cent     int not null,
  spedizione_cent int not null,
  totale_cent     int not null,
  stato           text not null default 'nuovo'
                  check (stato in ('nuovo', 'pagato', 'spedito', 'consegnato', 'annullato')),
  check (consegna = 'ritiro' or indirizzo is not null)
);
create index if not exists shop_ordini_user on public.shop_ordini (user_id, creato_at desc);
alter table public.shop_ordini enable row level security;
revoke all on table public.shop_ordini from public, anon, authenticated;

-- Il catalogo: un articolo per riga. Prezzi in centesimi. Lo stesso elenco sta
-- in src/shop.js per mostrarlo; qui decide quanto si paga.
create or replace function public.shop_prezzo(p_articolo text) returns int
language sql immutable set search_path = '' as $$
  select case p_articolo
    when 'top-fantatitano' then 1800
    else null end
$$;
create or replace function public.shop_spedizione() returns int
language sql immutable set search_path = '' as $$ select 200 $$;

create or replace function public.shop_ordina(
  p_articolo text, p_taglia text, p_quantita int, p_consegna text,
  p_nome text, p_contatto text, p_indirizzo text default null, p_note text default null)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  chi text := public.current_user_id();
  prezzo int := public.shop_prezzo(p_articolo);
  q int := coalesce(p_quantita, 1);
  sped int;
  nuovo bigint;
  ind text := nullif(btrim(coalesce(p_indirizzo, '')), '');
begin
  if chi is null then
    raise exception 'Per ordinare devi aver fatto l''accesso.' using errcode = '42501';
  end if;
  if prezzo is null then
    raise exception 'Articolo non disponibile.' using errcode = '22023';
  end if;
  if p_taglia not in ('S', 'M', 'L', 'XL') or q not between 1 and 5
     or p_consegna not in ('spedizione', 'ritiro') then
    raise exception 'Ordine non valido.' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_nome, ''))) < 2 or char_length(btrim(coalesce(p_contatto, ''))) < 3 then
    raise exception 'Mancano il nome o il recapito.' using errcode = '22023';
  end if;
  if p_consegna = 'spedizione' and (ind is null or char_length(ind) < 8) then
    raise exception 'Per la spedizione serve l''indirizzo.' using errcode = '22023';
  end if;
  if (select count(*) from public.shop_ordini
       where user_id = chi and creato_at > now() - interval '1 day') >= 5 then
    raise exception 'Hai già fatto 5 ordini oggi: per altri scrivici.' using errcode = '54000';
  end if;
  sped := case when p_consegna = 'spedizione' then public.shop_spedizione() else 0 end;
  insert into public.shop_ordini (user_id, articolo, taglia, quantita, consegna, nome, contatto,
                                  indirizzo, note, prezzo_cent, spedizione_cent, totale_cent)
  values (chi, p_articolo, p_taglia, q, p_consegna, left(btrim(p_nome), 80), left(btrim(p_contatto), 120),
          case when p_consegna = 'spedizione' then left(ind, 300) end,
          nullif(left(btrim(coalesce(p_note, '')), 300), ''),
          prezzo, sped, prezzo * q + sped)
  returning id into nuovo;
  return nuovo;
end $$;
revoke all on function public.shop_ordina(text, text, int, text, text, text, text, text) from public, anon;
grant execute on function public.shop_ordina(text, text, int, text, text, text, text, text) to authenticated;

create or replace function public.shop_miei_ordini()
returns table (id bigint, creato_at timestamptz, articolo text, taglia text, quantita smallint,
               consegna text, totale_cent int, stato text)
language sql stable security definer set search_path = public as $$
  select o.id, o.creato_at, o.articolo, o.taglia, o.quantita, o.consegna, o.totale_cent, o.stato
    from public.shop_ordini o
   where o.user_id = public.current_user_id()
   order by o.creato_at desc
   limit 20
$$;
revoke all on function public.shop_miei_ordini() from public, anon;
grant execute on function public.shop_miei_ordini() to authenticated;

create or replace function public.admin_shop_ordini(p_tutti boolean default false)
returns table (id bigint, creato_at timestamptz, articolo text, taglia text, quantita smallint,
               consegna text, nome text, contatto text, indirizzo text, note text,
               totale_cent int, stato text, email text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'solo admin' using errcode = '42501';
  end if;
  return query
    select o.id, o.creato_at, o.articolo, o.taglia, o.quantita, o.consegna, o.nome, o.contatto,
           o.indirizzo, o.note, o.totale_cent, o.stato,
           -- l'e-mail dell'account intera solo al proprietario, come in admin_persone (033)
           case when public.is_owner() then u.email::text else public.maschera_email(u.email::text) end
      from public.shop_ordini o
      left join auth.users u on u.id::text = o.user_id
     where coalesce(p_tutti, false) or o.stato not in ('consegnato', 'annullato')
     order by o.creato_at desc
     limit 200;
end $$;
revoke all on function public.admin_shop_ordini(boolean) from public, anon;
grant execute on function public.admin_shop_ordini(boolean) to authenticated;

create or replace function public.admin_shop_stato(p_id bigint, p_stato text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'solo admin' using errcode = '42501';
  end if;
  if p_stato not in ('nuovo', 'pagato', 'spedito', 'consegnato', 'annullato') then
    raise exception 'Stato non valido.' using errcode = '22023';
  end if;
  update public.shop_ordini set stato = p_stato, aggiornato_at = now() where id = p_id;
end $$;
revoke all on function public.admin_shop_stato(bigint, text) from public, anon;
grant execute on function public.admin_shop_stato(bigint, text) to authenticated;

-- L'avviso ad Alex: solo se c'è la configurazione dell'avviso iscritti.
create or replace function public.shop_avvisa_ordine()
returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  c record;
  corpo text;
begin
  begin
    if to_regclass('interno.avviso_iscritti_config') is null
       or to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then
      return new;
    end if;
    execute 'select chiave, a, da from interno.avviso_iscritti_config where id = 1' into c;
    if c.chiave is null then return new; end if;
    corpo := format(
      '<p><b>Nuovo ordine nello shop</b> (n. %s)</p><p>%s × top Fantatitano, taglia %s<br>%s<br>Totale %s €</p>'
      || '<p>%s<br>%s%s%s</p><p>Lo trovi nella console admin, scheda Shop.</p>',
      new.id, new.quantita, new.taglia,
      case when new.consegna = 'ritiro' then 'Ritiro allo stadio' else 'Spedizione' end,
      to_char(new.totale_cent / 100.0, 'FM990D00'),
      replace(replace(new.nome, '<', '&lt;'), '>', '&gt;'),
      replace(replace(new.contatto, '<', '&lt;'), '>', '&gt;'),
      case when new.indirizzo is not null then '<br>' || replace(replace(new.indirizzo, '<', '&lt;'), '>', '&gt;') else '' end,
      case when new.note is not null then '<br><i>' || replace(replace(new.note, '<', '&lt;'), '>', '&gt;') || '</i>' else '' end);
    execute 'select net.http_post(url := $1, body := $2, headers := $3)'
      using 'https://api.resend.com/emails',
            jsonb_build_object('from', c.da, 'to', jsonb_build_array(c.a),
                               'subject', format('Shop: nuovo ordine n. %s (%s, taglia %s)', new.id, new.consegna, new.taglia),
                               'html', corpo),
            jsonb_build_object('Authorization', 'Bearer ' || c.chiave, 'Content-Type', 'application/json');
  exception when others then
    -- l'avviso non deve mai far fallire un ordine
    null;
  end;
  return new;
end $$;
revoke all on function public.shop_avvisa_ordine() from public, anon, authenticated;
drop trigger if exists shop_avvisa_ordine on public.shop_ordini;
create trigger shop_avvisa_ordine after insert on public.shop_ordini
  for each row execute function public.shop_avvisa_ordine();

-- Chi cancella il profilo si porta via i suoi ordini (dati di consegna compresi).
create or replace function public.shop_via_col_profilo()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.shop_ordini where user_id = old.id;
  return old;
end $$;
revoke all on function public.shop_via_col_profilo() from public, anon, authenticated;
drop trigger if exists shop_via_col_profilo on public.profiles;
create trigger shop_via_col_profilo after delete on public.profiles
  for each row execute function public.shop_via_col_profilo();

select (select count(*) from public.shop_ordini) as ordini;
