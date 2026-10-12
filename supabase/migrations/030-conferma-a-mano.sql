-- =====================================================================
-- 030 — Chi non riceve la mail di conferma, lo conferma l'amministratore
--
-- Da eseguire SUBITO, dopo la 015. Si può rieseguire.
--
-- IL BUCO. Alex, 12/10: «il miglior giocatore del campionato non riesce a
-- entrare: non gli arriva la mail di conferma». La mail parte (Resend, firma
-- DKIM a posto), ma Hotmail, Outlook e iCloud con un dominio giovane a volte
-- la fermano o la buttano nello spam. E chi non conferma resta fuori senza
-- rimedio: il profilo nasce al primo accesso, quindi nella Console non c'era
-- nemmeno. L'unica strada era l'SQL Editor.
--
-- LA CORREZIONE.
--  - admin_da_confermare(): chi si e' iscritto e non ha confermato, con
--    quando e' partita l'ultima mail. Solo per l'amministratore dell'app.
--  - admin_conferma_email(id): conferma l'account a mano e gli manda una
--    mail «il tuo account e' attivo: entra con la tua e-mail e la tua
--    password, non serve crearne un altro». La mail usa la chiave di Resend
--    gia' salvata per l'avviso dei nuovi iscritti
--    (supabase/avviso-nuovi-iscritti.sql): se quella non c'e', l'account si
--    conferma lo stesso e la funzione lo dice. Parte anche l'avviso del
--    nuovo iscritto, come per chi conferma da solo.
--
-- La conferma a mano la fa solo l'amministratore dell'app, e si vede: ogni
-- conferma resta in interno.conferme_a_mano, con chi l'ha fatta.
-- =====================================================================

create schema if not exists interno;
revoke all on schema interno from public;

create table if not exists interno.conferme_a_mano (
  id         bigserial primary key,
  quando     timestamptz not null default now(),
  utente     uuid not null,
  da_chi     text,
  request_id bigint
);
alter table interno.conferme_a_mano enable row level security;
revoke all on table interno.conferme_a_mano from public;

create or replace function public.admin_da_confermare()
returns table (id text, email text, nome text, iscritto timestamptz, mail_inviata timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Serve essere amministratore dell''app'; end if;
  return query
    select u.id::text, u.email::text,
           nullif(trim(coalesce(u.raw_user_meta_data->>'display_name', u.raw_user_meta_data->>'name', '')), ''),
           u.created_at, u.confirmation_sent_at
      from auth.users u
     where u.email_confirmed_at is null
     order by u.created_at desc
     limit 100;
end $$;

create or replace function public.admin_conferma_email(p_user text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  u record; c record; sch text; rid bigint; nome text; avvisato boolean := false;
begin
  if not public.is_admin() then raise exception 'Serve essere amministratore dell''app'; end if;
  select * into u from auth.users where id::text = p_user;
  if not found then raise exception 'Account non trovato'; end if;
  if u.email_confirmed_at is not null then
    return jsonb_build_object('email', u.email, 'gia', true, 'avvisato', false);
  end if;

  update auth.users set email_confirmed_at = now() where id = u.id;

  -- La mail «il tuo account e' attivo». Se qualcosa va storto qui, la
  -- conferma resta: e' quella che conta.
  begin
    if to_regclass('interno.avviso_iscritti_config') is not null then
      execute 'select chiave, da from interno.avviso_iscritti_config where id = 1' into c;
      select n.nspname into sch
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where p.proname = 'http_post' and n.nspname in ('net', 'extensions', 'public')
       order by case n.nspname when 'net' then 1 when 'extensions' then 2 else 3 end
       limit 1;
      if c.chiave is not null and sch is not null then
        nome := nullif(trim(coalesce(u.raw_user_meta_data->>'display_name', u.raw_user_meta_data->>'name', '')), '');
        execute format(
          'select %I.http_post(url := $1, headers := $2, body := $3, timeout_milliseconds := $4)', sch)
          into rid
          using 'https://api.resend.com/emails',
                jsonb_build_object('Authorization', 'Bearer ' || c.chiave, 'Content-Type', 'application/json'),
                jsonb_build_object(
                  'from', c.da,
                  'to', jsonb_build_array(u.email),
                  'subject', 'Il tuo account Fantatitano è attivo',
                  'html',
                    '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#111">'
                    || '<p>Ciao' || coalesce(' <b>' || replace(replace(replace(nome, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</b>', '') || ',</p>'
                    || '<p>la mail di conferma non ti era arrivata: <b>il tuo account l''abbiamo attivato noi</b>.</p>'
                    || '<p><b>Non serve crearne un altro.</b> Entra su <a href="https://fantatitano.site">fantatitano.site</a> '
                    || 'con l''e-mail <b>' || replace(replace(u.email, '<', '&lt;'), '>', '&gt;') || '</b> e la password che hai scelto quando ti sei iscritto.</p>'
                    || '<p>Non ricordi la password? Nella schermata di accesso tocca «Password dimenticata?».</p>'
                    || '<p style="margin-top:22px"><a href="https://fantatitano.site" style="background:#D9F51F;color:#0A0A0C;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:bold">ENTRA IN FANTATITANO</a></p>'
                    || '<p style="color:#666;font-size:13px;margin-top:22px">Se questa mail è finita nello spam, segnala «Non è spam»: le prossime arriveranno nella posta in arrivo.</p></div>'),
                10000;
        avvisato := rid is not null;
      end if;
    end if;
  exception when others then
    avvisato := false;
  end;

  insert into interno.conferme_a_mano (utente, da_chi, request_id) values (u.id, public.current_user_id(), rid);
  return jsonb_build_object('email', u.email, 'gia', false, 'avvisato', avvisato);
end $$;

revoke execute on function public.admin_da_confermare() from public, anon;
grant execute on function public.admin_da_confermare() to authenticated;
revoke execute on function public.admin_conferma_email(text) from public, anon;
grant execute on function public.admin_conferma_email(text) to authenticated;
