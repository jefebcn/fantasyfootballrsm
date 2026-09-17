#!/usr/bin/env bash
# Prova che il salvataggio sia davvero un salvataggio.
#
# Un dump che esce senza errori non vuol dire niente: quello che conta è che
# si riesca a RIMETTERLO DENTRO e ritrovarci i dati. Qui si fa il giro intero
# su un Postgres vero — schema, migrazioni, dati veri dentro, dump, cifratura,
# decifratura, ripristino su un database vuoto — e poi si contano le righe
# nelle due copie.
#
#   ./supabase/prove/salvataggio.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
PORTA=${PORTA:-5465}
PAROLA='parola-di-prova-non-usarla-davvero'
export PATH=/usr/lib/postgresql/16/bin:/usr/lib/postgresql/15/bin:$PATH

rosso() { printf '\033[31m%s\033[0m\n' "$*"; }
verde() { printf '\033[32m%s\033[0m\n' "$*"; }
ko() { rosso "  KO  $*"; exit 1; }

DATI=$(mktemp -d); LAVORO=$(mktemp -d)
PROPRIETARIO=postgres
id -u postgres >/dev/null 2>&1 || PROPRIETARIO=$(id -un)
chown -R "$PROPRIETARIO" "$DATI" 2>/dev/null || true
COME() { if [ "$(id -un)" = "$PROPRIETARIO" ]; then bash -c "$1"; else su "$PROPRIETARIO" -c "$1"; fi; }
COME "PATH=$PATH initdb -D $DATI -U postgres --auth=trust" >/dev/null
COME "PATH=$PATH pg_ctl -D $DATI -o '-p $PORTA -k /tmp' -l $DATI/log start" >/dev/null
trap 'COME "PATH=$PATH pg_ctl -D $DATI -m immediate stop" >/dev/null 2>&1 || true; rm -rf "$DATI" "$LAVORO"' EXIT
for _ in $(seq 1 30); do psql -h /tmp -p "$PORTA" -U postgres -c 'select 1' >/dev/null 2>&1 && break; sleep 0.5; done

Q() { psql -h /tmp -p "$PORTA" -U postgres -d "$1" -q -v ON_ERROR_STOP=1 "${@:2}"; }
URL="postgresql://postgres@/vivo?host=/tmp&port=$PORTA"

echo "== un database come quello vero =="
psql -h /tmp -p "$PORTA" -U postgres -q -c 'create database vivo' -c 'create database ripristino'
Q vivo -f supabase/prove/ambiente.sql >/dev/null
Q vivo -f supabase/schema.sql >/dev/null 2>&1
for f in supabase/migrations/*.sql; do Q vivo -f "$f" >/dev/null 2>&1; done
# dati veri dentro: una lega, due squadre, rose, una formazione consegnata
Q vivo -c "insert into public.profiles (id, display_name) values ('u_alex','Alex'), ('u_bea','Bea')" \
  -c "insert into public.leagues (id, name) values ('11111111-1111-1111-1111-111111111111','Torneo Titano')" \
  -c "insert into public.league_members (id, league_id, user_id, team_name) values
       ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','u_alex','Hasta El Roxy'),
       ('33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111','u_bea','Borgo FC')" \
  -c "insert into public.rosters (league_id, member_id, player_id, price_paid) values
       ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','p1',40)" \
  -c "insert into public.lineups (league_id, member_id, matchday, lineup) values
       ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222',3,'{\"titolari\":[\"p1\"]}')" >/dev/null
prima=$(Q vivo -tAc "select (select count(*) from profiles)||'/'||(select count(*) from leagues)||'/'||(select count(*) from league_members)||'/'||(select count(*) from rosters)||'/'||(select count(*) from lineups)")
verde "  ok  dati dentro: profili/leghe/squadre/rose/formazioni = $prima"

echo "== dump, come lo fa il lavoro notturno =="
pg_dump "$URL" --schema=public --no-owner --no-acl --format=plain > "$LAVORO/s.sql"
# come nel lavoro notturno: via la creazione dello schema public, che esiste
# gia' dappertutto e al ripristino ferma tutto
sed -i '/^CREATE SCHEMA public;$/d; /^COMMENT ON SCHEMA public/d' "$LAVORO/s.sql"
righe=$(wc -l < "$LAVORO/s.sql")
[ "$righe" -ge 50 ] || ko "dump troppo corto: $righe righe"
grep -q "CREATE TABLE" "$LAVORO/s.sql" || ko "nessuna tabella nel dump"
for t in profiles leagues league_members rosters lineups; do
  grep -q "public\.$t" "$LAVORO/s.sql" || ko "manca la tabella $t"
done
verde "  ok  dump: $righe righe, $(du -h "$LAVORO/s.sql" | cut -f1)"

echo "== cifratura e decifratura =="
printf '%s' "$PAROLA" > "$LAVORO/p"
gpg --batch --yes --symmetric --cipher-algo AES256 --passphrase-file "$LAVORO/p" \
    --output "$LAVORO/s.sql.gpg" "$LAVORO/s.sql"
grep -qa "CREATE TABLE" "$LAVORO/s.sql.gpg" && ko "il file cifrato si legge in chiaro!"
verde "  ok  cifrato, e dentro non si legge niente"
if gpg --batch --yes --decrypt --passphrase 'parola-sbagliata' "$LAVORO/s.sql.gpg" >/dev/null 2>&1; then
  ko "si apre con la parola sbagliata"
fi
verde "  ok  con la parola sbagliata non si apre"
gpg --batch --yes --decrypt --passphrase-file "$LAVORO/p" "$LAVORO/s.sql.gpg" > "$LAVORO/tornato.sql" 2>/dev/null
cmp -s "$LAVORO/s.sql" "$LAVORO/tornato.sql" || ko "il file tornato indietro non è identico"
verde "  ok  decifrato, identico all'originale"

echo "== ripristino su un database vuoto =="
Q ripristino -f supabase/prove/ambiente.sql >/dev/null 2>&1
# Un dump del solo schema public non porta le estensioni: senza pgcrypto il
# ripristino muore su gen_random_bytes, che e' il valore predefinito del
# codice invito. Su Supabase c'e' gia'; qui si mette, come farebbe chi
# ripristina davvero seguendo le istruzioni nel workflow.
Q ripristino -c 'create extension if not exists pgcrypto' >/dev/null 2>&1
Q ripristino -f "$LAVORO/tornato.sql" > "$LAVORO/restore.log" 2>&1 || { rosso "  il ripristino ha dato errore:"; head -20 "$LAVORO/restore.log"; exit 1; }
dopo=$(Q ripristino -tAc "select (select count(*) from profiles)||'/'||(select count(*) from leagues)||'/'||(select count(*) from league_members)||'/'||(select count(*) from rosters)||'/'||(select count(*) from lineups)")
[ "$prima" = "$dopo" ] || ko "i conti non tornano: prima $prima, dopo $dopo"
verde "  ok  stessi conti dopo il ripristino: $dopo"
squadra=$(Q ripristino -tAc "select team_name from league_members where user_id='u_alex'")
[ "$squadra" = "Hasta El Roxy" ] || ko "il nome squadra non è tornato: '$squadra'"
form=$(Q ripristino -tAc "select lineup->>'titolari' from lineups where matchday=3")
[ "$form" = '["p1"]' ] || ko "la formazione non è tornata: '$form'"
verde "  ok  nomi e formazioni sono quelli di prima"
verde "il salvataggio si rilegge"
