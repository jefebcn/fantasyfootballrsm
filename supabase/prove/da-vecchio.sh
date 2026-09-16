#!/usr/bin/env bash
# Parte da un database MEZZO migrato e controlla che la catena attuale lo
# raddrizzi, arrivando esattamente dove arriva un database partito da zero.
#
# Nasce da quattro correzioni di fila che sembravano tutte definitive e non lo
# erano. Il motivo e' sempre stato lo stesso: la prova girava su un database
# vuoto, dove le migrazioni nuove passano per costruzione. I guai stanno nel
# mezzo — colonne rimaste uuid, chiavi gia' sciolte da un tentativo morto a
# meta', policy scritte sulla vecchia identita', una funzione con un tipo di
# ritorno che "create or replace" non puo' sostituire.
#
#   ./supabase/prove/da-vecchio.sh
set -uo pipefail
cd "$(dirname "$0")/../.."
PORTA=${PORTA:-5490}
export PATH=/usr/lib/postgresql/16/bin:/usr/lib/postgresql/15/bin:$PATH
rosso() { printf '\033[31m%s\033[0m\n' "$*"; }
verde() { printf '\033[32m%s\033[0m\n' "$*"; }
GUAI=0
NUOVE="001-identita-esterna 002-squadra-e-lega 003-abbandona-lega 004-lock-dal-calendario 005-notifiche-push 006-scambi 007-mercato-svincolati"

DATI=$(mktemp -d); PROPRIETARIO=postgres
id -u postgres >/dev/null 2>&1 || PROPRIETARIO=$(id -un)
chown -R "$PROPRIETARIO" "$DATI" 2>/dev/null || true
COME() { if [ "$(id -un)" = "$PROPRIETARIO" ]; then bash -c "$1"; else su "$PROPRIETARIO" -c "$1"; fi; }
COME "PATH=$PATH initdb -D $DATI -U postgres --auth=trust" >/dev/null
COME "PATH=$PATH pg_ctl -D $DATI -o '-p $PORTA -k /tmp' -l $DATI/log start" >/dev/null
trap 'COME "PATH=$PATH pg_ctl -D $DATI stop" >/dev/null 2>&1' EXIT
sleep 2

prepara() {  # $1 = nome del database, $2 = "vecchie" per partire dallo stato sbagliato
  psql -h /tmp -p "$PORTA" -U postgres -q -c "create database $1" >/dev/null
  local Q=(psql -h /tmp -p "$PORTA" -U postgres -d "$1" -q)
  "${Q[@]}" -f supabase/prove/ambiente.sql >/dev/null 2>&1
  "${Q[@]}" -f supabase/schema.sql >/dev/null 2>&1
  if [ "${2:-}" = "vecchie" ]; then
    for m in $NUOVE; do
      [ -f "supabase/prove/vecchie/$m.sql" ] && "${Q[@]}" -v ON_ERROR_STOP=1 -f "supabase/prove/vecchie/$m.sql" >/dev/null 2>&1
    done
  fi
}

# --- il riferimento: un database partito da zero
prepara pulito
QP=(psql -h /tmp -p "$PORTA" -U postgres -d pulito -q)
for m in $NUOVE; do "${QP[@]}" -v ON_ERROR_STOP=1 -f "supabase/migrations/$m.sql" >/dev/null 2>&1; done

# --- il caso vero: mezzo migrato, con dentro dei dati
prepara mezzo vecchie
QM=(psql -h /tmp -p "$PORTA" -U postgres -d mezzo -q)
# e i tentativi di correzione morti a meta': prima di fermarsi avevano gia'
# sciolto chiavi e policy come istruzioni separate, che restano sciolte
for x in "alter table public.leagues drop constraint if exists leagues_created_by_fkey" \
         "alter table public.match_events drop constraint if exists match_events_created_by_fkey" \
         "alter table public.matchday_locks drop constraint if exists matchday_locks_updated_by_fkey" \
         "alter table public.push_subscriptions drop constraint if exists push_subscriptions_user_id_fkey" \
         "drop policy if exists profiles_update_own on public.profiles" \
         "drop policy if exists members_update on public.league_members" \
         "drop policy if exists members_delete on public.league_members"; do
  "${QM[@]}" -c "$x" >/dev/null 2>&1
done

U=$("${QM[@]}" -t -c "insert into auth.users(id) values (gen_random_uuid()) returning id" | xargs)
V=$("${QM[@]}" -t -c "insert into auth.users(id) values (gen_random_uuid()) returning id" | xargs)
"${QM[@]}" -c "insert into public.profiles(id,display_name) values ('$U','Alex'),('$V','Vice')" >/dev/null 2>&1
L=$("${QM[@]}" -t -c "insert into public.leagues(name,created_by,invite_code) values ('Titano','$U','ABC123') returning id" | xargs)
"${QM[@]}" -c "insert into public.league_members(league_id,user_id,vice_user_id,team_name) values ('$L','$U','$V','Hasta El Roxy')" >/dev/null 2>&1
"${QM[@]}" -c "insert into public.push_subscriptions(endpoint,user_id,p256dh,auth) values ('e1','$U','p','a')" >/dev/null 2>&1

echo "--- la catena attuale su un database mezzo migrato ---"
for giro in 1 2; do
  for m in $NUOVE; do
    ERR=$("${QM[@]}" -v ON_ERROR_STOP=1 -f "supabase/migrations/$m.sql" 2>&1 | grep -E "^psql.*ERROR" | head -1)
    if [ -n "$ERR" ]; then rosso "  KO  giro $giro, $m: ${ERR#*ERROR:  }"; GUAI=$((GUAI+1)); fi
  done
  echo "  ok  giro $giro: tutte e sette passano"
done

confronta() {  # $1 = descrizione, $2 = query
  local a b
  a=$("${QP[@]}" -t -c "$2" | xargs); b=$("${QM[@]}" -t -c "$2" | xargs)
  if [ "$a" = "$b" ]; then echo "  ok  $1 ($b)"; else rosso "  KO  $1: da zero «$a», mezzo migrato «$b»"; GUAI=$((GUAI+1)); fi
}
confronta "stesse policy" "select string_agg(tablename||'.'||policyname, ',' order by tablename,policyname) from pg_policies where schemaname='public'"
confronta "nessuna policy sulla vecchia identita'" "select count(*) from pg_policies where schemaname='public' and (qual like '%auth.uid()%' or with_check like '%auth.uid()%')"
confronta "stesse colonne d'identita' in text" "select string_agg(table_name||'.'||column_name, ',' order by table_name,column_name) from information_schema.columns where table_schema='public' and data_type='text' and column_name in ('id','user_id','vice_user_id','created_by','updated_by','changed_by','by_user') and table_name in ('profiles','league_members','leagues','match_overrides','match_events','matchday_status','change_log','matchday_locks','push_subscriptions')"
confronta "stesse chiavi verso profiles" "select count(*) from pg_constraint where contype='f' and confrelid='public.profiles'::regclass"
confronta "stesso vincolo sul vice" "select pg_get_constraintdef(oid) from pg_constraint where conname='members_vice_non_titolare'"
confronta "stesse tabelle" "select string_agg(table_name, ',' order by table_name) from information_schema.tables where table_schema='public'"
confronta "da_avvisare torna gli stessi tipi" "select pg_get_function_result(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='da_avvisare'"

echo "--- i dati sono ancora li' ---"
for coppia in "profiles:2" "league_members:1" "push_subscriptions:1" "leagues:1"; do
  tab=${coppia%%:*}; atteso=${coppia##*:}
  n=$("${QM[@]}" -t -c "select count(*) from public.$tab" | xargs)
  if [ "$n" = "$atteso" ]; then echo "  ok  $tab: $n"; else rosso "  KO  $tab: $n invece di $atteso"; GUAI=$((GUAI+1)); fi
done
n=$("${QM[@]}" -t -c "select count(*) from public.league_members where vice_user_id is not null" | xargs)
if [ "$n" = "1" ]; then echo "  ok  il vice e' ancora agganciato"; else rosso "  KO  il vice si e' perso"; GUAI=$((GUAI+1)); fi

echo
[ "$GUAI" -eq 0 ] && verde "tutto a posto" || { rosso "$GUAI problemi"; exit 1; }
