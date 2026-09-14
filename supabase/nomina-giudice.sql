-- Nomina il Giudice Dati (art. 9.4).
--
-- Da eseguire UNA VOLTA, nell'SQL Editor di Supabase, DOPO che la persona
-- si è registrata nell'app: prima di quel momento la riga in profiles non
-- esiste ancora e il comando non trova nessuno.
--
-- Il Giudice Dati è globale, non per lega: è l'unico che può inserire
-- eventi, presenze e congelare le giornate. La policy profiles_update_own
-- impedisce di auto-nominarsi dall'app, quindi si passa di qui.

-- 1. Controlla di avere scritto l'indirizzo giusto: deve tornare una riga.
select id, display_name, is_judge
from public.profiles
where id = (select id from auth.users where lower(email) = lower('contiale2001@gmail.com'));

-- 2. Nomina.
update public.profiles
set is_judge = true
where id = (select id from auth.users where lower(email) = lower('contiale2001@gmail.com'));

-- 3. Verifica: is_judge deve essere true.
select p.display_name, u.email, p.is_judge
from public.profiles p
join auth.users u on u.id = p.id
where p.is_judge;

-- Per revocare:
-- update public.profiles set is_judge = false
-- where id = (select id from auth.users where lower(email) = lower('contiale2001@gmail.com'));
