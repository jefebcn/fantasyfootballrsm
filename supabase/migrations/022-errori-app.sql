-- =====================================================================
-- 022 — Gli errori dei telefoni arrivano a chi gestisce l'app
--
-- Da eseguire dopo la 014. Si può rieseguire.
--
-- PERCHÉ. Fino a qui src/diagnostica.js teneva gli errori SOLO sul telefono
-- dove succedevano, per scelta: sarebbero arrivati a chi gestisce l'app
-- soltanto se qualcuno premeva «copia la segnalazione» e la mandava. Con dodici
-- tester tutti su Android, e chi gestisce l'app senza un Android in mano, un
-- errore del Play Store si sarebbe scoperto solo quando qualcuno si lamentava.
-- Alex ha scelto di cambiare (28 settembre), alle condizioni scritte qui.
--
-- LE CONDIZIONI, che sono i tre motivi per cui prima non si faceva:
--  1. NESSUN FORNITORE NUOVO. La tabella sta nello stesso Supabase che
--     l'informativa già dichiara: niente Sentry, niente servizi di terzi.
--  2. UNA BASE GIURIDICA GIÀ SCRITTA. È un log tecnico, e l'informativa ha già
--     «legittimo interesse: i log tecnici del server, per tenere in piedi il
--     servizio». In più ora lo dice per esteso.
--  3. NIENTE DI CHI. Messaggio, versione, schermata e tipo di telefono
--     («Android · Chrome · app»). Nessun account, nessun identificativo del
--     telefono, nessun indirizzo IP in questa tabella. Gli indirizzi e-mail,
--     se mai finissero dentro un messaggio d'errore, si cancellano qui, nel
--     database — non ci si fida che lo faccia il telefono.
--
-- QUANTO RESTA: trenta giorni, poi si cancella da solo. Gli errori di un mese
-- fa descrivono codice che non c'è più.
--
-- QUANTO PUÒ CRESCERE: lo stesso errore, nello stesso giorno, nella stessa
-- versione e schermata, è UNA riga con un contatore — cento telefoni che
-- sbattono sullo stesso difetto fanno una riga «×100», non cento righe. E al
-- massimo 500 righe al giorno: la porta è aperta anche a chi non ha un account
-- (gli errori succedono anche prima dell'accesso), quindi non deve poter
-- riempire il database.
--
-- CHI LEGGE: solo chi amministra l'app (is_admin), nella console.
-- CHI SCRIVE: nessuno direttamente. Si passa solo da segnala_errore().
-- =====================================================================

create table if not exists public.errori_app (
  id bigserial primary key,
  giorno date not null default current_date,
  primo timestamptz not null default now(),
  ultimo timestamptz not null default now(),
  quante integer not null default 1,
  messaggio text not null,
  dettaglio text not null default '',
  versione text not null default '',
  schermata text not null default '',
  dispositivo text not null default ''
);

-- lo stesso errore nello stesso giorno è una riga sola, col suo contatore
create unique index if not exists errori_app_uno_al_giorno
  on public.errori_app (giorno, md5(messaggio), versione, schermata);

alter table public.errori_app enable row level security;

drop policy if exists errori_app_admin on public.errori_app;
create policy errori_app_admin on public.errori_app
  for select to authenticated
  using (exists (select 1 from public.profiles p
                  where p.id = public.current_user_id() and p.is_admin));

revoke all on public.errori_app from anon, authenticated;
grant select on public.errori_app to authenticated;
revoke all on sequence public.errori_app_id_seq from anon, authenticated;

create or replace function public.segnala_errore(
  p_messaggio text,
  p_versione text default '',
  p_schermata text default '',
  p_dettaglio text default '',
  p_dispositivo text default ''
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  posta constant text := '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}';
  m text;
  d text;
begin
  m := regexp_replace(left(btrim(coalesce(p_messaggio, '')), 300), posta, '[e-mail]', 'g');
  if m = '' then
    return;                                     -- un errore senza messaggio è rumore
  end if;
  d := regexp_replace(left(coalesce(p_dettaglio, ''), 1200), posta, '[e-mail]', 'g');

  -- la pulizia la fa chi scrive: nessuno deve ricordarsi di farla
  delete from public.errori_app where giorno < current_date - 30;

  -- il tetto: oltre, oggi non si scrive più niente (ma si aggiornano i
  -- contatori delle righe che ci sono già: quelle non occupano spazio nuovo)
  if (select count(*) from public.errori_app where giorno = current_date) >= 500
     and not exists (select 1 from public.errori_app
                      where giorno = current_date and md5(messaggio) = md5(m)
                        and versione = left(coalesce(p_versione, ''), 40)
                        and schermata = left(coalesce(p_schermata, ''), 60)) then
    return;
  end if;

  insert into public.errori_app as e (messaggio, dettaglio, versione, schermata, dispositivo)
  values (m, d,
          left(coalesce(p_versione, ''), 40),
          left(coalesce(p_schermata, ''), 60),
          left(coalesce(p_dispositivo, ''), 60))
  on conflict (giorno, md5(messaggio), versione, schermata) do update
    set quante = e.quante + 1,
        ultimo = now();
end;
$$;

revoke all on function public.segnala_errore(text, text, text, text, text) from public;
grant execute on function public.segnala_errore(text, text, text, text, text) to anon, authenticated;
