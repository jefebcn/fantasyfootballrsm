-- Lo spazio dello sponsor, amministrabile senza toccare il codice.
--
-- Perche' una tabella e non una costante: uno sponsor cambia a stagione, a
-- volte a girone, e chi lo vende non e' chi sa rilasciare. Finche' il banner
-- sta nel codice, cambiare sponsor vuol dire un rilascio — cioe' dipendere da
-- una persona sola, e non poter promettere "dal primo del mese".
--
-- Le date servono a questo: si carica adesso e parte da solo il giorno giusto,
-- e finisce da solo il giorno dopo la scadenza. Nessuno deve ricordarsi di
-- spegnerlo.

create table if not exists public.sponsor (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  claim text,                      -- una riga sotto il nome
  logo_url text,                   -- /media/sponsor/x.png oppure un indirizzo esterno
  link text,                       -- dove porta il tocco
  dal date not null default current_date,
  al date,                         -- null = senza scadenza
  attivo boolean not null default true,
  creato_at timestamptz not null default now(),
  -- text e non uuid: la 001 ha convertito le colonne dell'identita' a text,
  -- e una chiave esterna verso profiles(id) con un tipo diverso non si crea.
  creato_da text references public.profiles(id)
);

alter table public.sponsor enable row level security;

-- CHI LO VEDE: chiunque, ma solo quello in corso. La finestra la applica il
-- database e non la schermata: una regola messa solo nella schermata vale solo
-- per quella schermata, e qui in ballo c'e' un contratto con una data.
drop policy if exists sponsor_in_corso on public.sponsor;
create policy sponsor_in_corso on public.sponsor
  for select to anon, authenticated
  using (attivo and dal <= current_date and (al is null or al >= current_date));

-- CHI LO SCRIVE: solo chi amministra l'app. E vede anche quelli scaduti o
-- spenti, se no non potrebbe programmarne uno per il mese prossimo.
drop policy if exists sponsor_admin on public.sponsor;
create policy sponsor_admin on public.sponsor
  for all to authenticated
  using (exists (select 1 from public.profiles p
                  where p.id = public.current_user_id() and p.is_admin))
  with check (exists (select 1 from public.profiles p
                       where p.id = public.current_user_id() and p.is_admin));

create index if not exists sponsor_finestra on public.sponsor (dal, al) where attivo;
