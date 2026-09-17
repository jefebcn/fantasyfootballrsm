#!/usr/bin/env bash
# Il promemoria pianificato dentro Postgres: prova di supabase/promemoria-pianificato.sql
#
# Quel file si lancia UNA VOLTA a mano nel SQL Editor, e se sbaglia qualcosa
# non lo si scopre da un test che non esiste: lo si scopre il giorno dopo,
# perche' nessuno ha ricevuto l'avviso della formazione. Qui gira per davvero
# su un Postgres vuoto.
#
# pg_cron e pg_net non esistono in questo Postgres, e non si possono
# installare: al loro posto si mettono due estensioni FINTE con lo stesso nome
# e la stessa firma — un file .control e un .sql nella cartella delle
# estensioni. Cosi' il file si esegue parola per parola, comprese le due righe
# "create extension", e le chiamate HTTP finiscono in una tabella dove si
# possono guardare: indirizzo, intestazioni, token.
#
# Quello che questa prova NON dice: che su Supabase quelle due estensioni si
# chiamino cosi' e che pg_net stia nello schema "net". Il nome delle estensioni
# e' quello della documentazione di Supabase, e lo schema la funzione lo cerca
# da sola invece di darlo per scontato.
#
#   ./supabase/prove/pianificato.sh
set -uo pipefail
cd "$(dirname "$0")/../.."
RADICE=$(pwd)
PORTA=${PORTA:-5469}
export PATH=/usr/lib/postgresql/16/bin:/usr/lib/postgresql/15/bin:$PATH

rosso() { printf '\033[31m%s\033[0m\n' "$*"; }
verde() { printf '\033[32m%s\033[0m\n' "$*"; }
ok=0; ko=0
et() { if [ "$1" = 0 ]; then verde "  ok  $2"; ok=$((ok+1)); else rosso "  KO  $2"; ko=$((ko+1)); fi; }

# ---- le due estensioni finte
EXT=$(ls -d /usr/share/postgresql/*/extension 2>/dev/null | tail -1)
[ -n "$EXT" ] || { rosso "non trovo la cartella delle estensioni di Postgres"; exit 1; }
FINTE=()
metti() { # nome, corpo sql
  local n=$1; shift
  if [ -e "$EXT/$n.control" ]; then rosso "$n esiste per davvero: questa prova lo sostituirebbe"; exit 1; fi
  printf "comment = 'finta, per le prove di Fantatitano'\ndefault_version = '1.0'\nrelocatable = false\n" > "$EXT/$n.control"
  printf '%s\n' "$1" > "$EXT/$n--1.0.sql"
  FINTE+=("$EXT/$n.control" "$EXT/$n--1.0.sql")
}
metti pg_cron "
create schema cron;
create table cron.job (jobid bigserial primary key, jobname text, schedule text, command text);
create function cron.schedule(job_name text, schedule text, command text) returns bigint
  language sql as \$\$ insert into cron.job (jobname, schedule, command) values (job_name, schedule, command) returning jobid \$\$;
create function cron.unschedule(job_id bigint) returns boolean
  language sql as \$\$ delete from cron.job where jobid = job_id returning true \$\$;
"
metti pg_net "
create schema net;
create table net.chiamate (id bigserial primary key, url text, headers jsonb, body jsonb, timeout_ms int);
create table net._http_response (id bigint primary key, status_code int, content text, error_msg text);
create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}',
    headers jsonb default '{\"Content-Type\": \"application/json\"}', timeout_milliseconds int default 5000)
  returns bigint language plpgsql as \$\$
  declare i bigint;
  begin
    insert into net.chiamate (url, headers, body, timeout_ms) values (url, headers, body, timeout_milliseconds) returning id into i;
    -- la risposta che darebbe la funzione vera quando non c'e' niente da spedire
    insert into net._http_response (id, status_code, content)
      values (i, 200, '{\"spedite\":0,\"iscritti\":1,\"motivo\":\"nessun lock nella finestra\"}');
    return i;
  end \$\$;
"

DATI=$(mktemp -d)
PROPRIETARIO=postgres
id -u postgres >/dev/null 2>&1 || PROPRIETARIO=$(id -un)
chown -R "$PROPRIETARIO" "$DATI" 2>/dev/null || true
COME() { if [ "$(id -un)" = "$PROPRIETARIO" ]; then bash -c "$1"; else su "$PROPRIETARIO" -c "$1"; fi; }
pulisci() {
  COME "PATH=$PATH pg_ctl -D $DATI -m immediate stop" >/dev/null 2>&1 || true
  rm -rf "$DATI"; rm -f "${FINTE[@]}"
}
trap pulisci EXIT
COME "PATH=$PATH initdb -D $DATI -U postgres --auth=trust" >/dev/null
COME "PATH=$PATH pg_ctl -D $DATI -o '-p $PORTA -k /tmp' -l $DATI/log start" >/dev/null
for _ in $(seq 1 30); do psql -h /tmp -p "$PORTA" -U postgres -c 'select 1' >/dev/null 2>&1 && break; sleep 0.5; done
psql -h /tmp -p "$PORTA" -U postgres -q -c 'drop database if exists prova' -c 'create database prova'
P=(psql -h /tmp -p "$PORTA" -U postgres -d prova -q -v ON_ERROR_STOP=1)
Q() { psql -h /tmp -p "$PORTA" -U postgres -d prova -t -A -c "$1"; }

"${P[@]}" -f supabase/prove/ambiente.sql >/dev/null 2>&1

echo "== il file com'e' scaricato non deve creare niente =="
USCITA=$("${P[@]}" -f supabase/promemoria-pianificato.sql 2>&1); ESITO=$?
[ $ESITO -ne 0 ]; et $? "col segnaposto del token al suo posto si ferma"
echo "$USCITA" | grep -qi "Manca il token"; et $? "e dice quale riga riempire ($(echo "$USCITA" | grep -oi "nella riga [^.]*" | head -1 | cut -c1-44)...)"
[ "$(Q "select count(*) from pg_namespace where nspname = 'interno'")" = 0 ]; et $? "e non ha creato lo schema interno"
# l'indirizzo e' gia' scritto: che sia quello del progetto di quest'app lo
# dice src/config.js, ed e' l'unico posto dove sta scritto due volte
grep -q "$(sed -n "s/.*SUPABASE_URL = '\(https:[^']*\)'.*/\1/p" src/config.js)" supabase/promemoria-pianificato.sql
et $? "l'indirizzo scritto nel file e' quello di src/config.js"

# il token corto e' l'altro modo di sbagliare: un token vuoto passerebbe il
# controllo dell'indirizzo e la funzione risponderebbe 401 a ogni giro
# si toccano SOLO le due righe del set_config, che sono le due che tocca chi lo
# usa: il segnaposto compare anche nel controllo, e sostituirlo la' dentro
# renderebbe il controllo sempre vero
riempi() { # url, token
  sed -e "/set_config('promemoria.url'/s|'https://[^']*'|'$1'|" \
      -e "/set_config('promemoria.token'/s|IL-TOKEN-DEL-PROMEMORIA|$2|" supabase/promemoria-pianificato.sql
}
riempi 'https://prova.functions.supabase.co' 'corto' > /tmp/corto.sql
USCITA=$("${P[@]}" -f /tmp/corto.sql 2>&1); ESITO=$?
[ $ESITO -ne 0 ] && echo "$USCITA" | grep -qi "token"; et $? "e un token troppo corto lo rifiuta"
# un indirizzo senza https:// e' l'altro modo di sbagliare la riga
riempi 'prova.functions.supabase.co' 'token-di-prova-abcdef123456' > /tmp/nohttps.sql
USCITA=$("${P[@]}" -f /tmp/nohttps.sql 2>&1); ESITO=$?
[ $ESITO -ne 0 ] && echo "$USCITA" | grep -qi "indirizzo"; et $? "e un indirizzo senza https:// lo rifiuta"

echo "== col file riempito =="
TOKEN='token-di-prova-abcdef123456'
# con la barra in fondo all'indirizzo, di proposito: chi lo copia dal pannello
# se la porta dietro, e l'indirizzo finale non deve avere due barre
riempi 'https://prova.functions.supabase.co/' "$TOKEN" > /tmp/pieno.sql
USCITA=$("${P[@]}" -f /tmp/pieno.sql 2>&1); ESITO=$?
[ $ESITO -eq 0 ]; et $? "si esegue senza errori$([ $ESITO -eq 0 ] || echo ": $(echo "$USCITA" | grep -i error | head -1)")"

et "$([ "$(Q "select count(*) from cron.job where jobname = 'promemoria'")" = 1 ] && echo 0 || echo 1)" \
  "il lavoro e' pianificato una volta sola"
et "$([ "$(Q "select schedule from cron.job where jobname = 'promemoria'")" = '37 * * * *' ] && echo 0 || echo 1)" \
  "ogni ora al minuto 37, sfasato da quello di GitHub ($(Q "select schedule from cron.job where jobname = 'promemoria'"))"
Q "select command from cron.job where jobname = 'promemoria'" | grep -q "interno.chiama_promemoria"; et $? "e chiama la funzione giusta"

echo "== la chiamata =="
URL=$(Q "select url from net.chiamate order by id desc limit 1")
[ "$URL" = "https://prova.functions.supabase.co/promemoria-" ]; et $? "l'indirizzo e' quello della funzione, senza doppia barra ($URL)"
[ "$(Q "select headers->>'x-promemoria-token' from net.chiamate order by id desc limit 1")" = "$TOKEN" ]; et $? "e porta il token nell'intestazione"
[ "$(Q "select count(*) from interno.promemoria_corse")" = 1 ]; et $? "la chiamata e' segnata nel registro"
Q "select risposta from interno.promemoria_ultime limit 1" | grep -q "iscritti"; et $? "e la vista dice cosa ha risposto ($(Q "select stato || ' ' || risposta from interno.promemoria_ultime limit 1" | cut -c1-48))"

echo "== il token non lo legge chi non deve =="
for ruolo in anon authenticated service_role; do
  NEG=$(psql -h /tmp -p "$PORTA" -U postgres -d prova -t -A -c "set role $ruolo; select token from interno.promemoria_config" 2>&1)
  echo "$NEG" | grep -qiE "permission denied"; et $? "$ruolo non legge il token ($(echo "$NEG" | grep -i denied | head -1 | sed 's/^ERROR:  //' | cut -c1-40))"
done

echo "== si puo' rilanciare =="
USCITA=$("${P[@]}" -f /tmp/pieno.sql 2>&1); ESITO=$?
[ $ESITO -eq 0 ]; et $? "rieseguito non da' errori$([ $ESITO -eq 0 ] || echo ": $(echo "$USCITA" | grep -i error | head -1)")"
[ "$(Q "select count(*) from cron.job where jobname = 'promemoria'")" = 1 ]; et $? "e il lavoro resta uno, non due"
# cambiare il token e' il motivo vero per rilanciarlo
riempi 'https://prova.functions.supabase.co' 'token-nuovo-abcdef123456' > /tmp/nuovo.sql
"${P[@]}" -f /tmp/nuovo.sql >/dev/null 2>&1
[ "$(Q "select headers->>'x-promemoria-token' from net.chiamate order by id desc limit 1")" = 'token-nuovo-abcdef123456' ]; et $? "e rilanciarlo e' il modo di cambiare il token"

rm -f /tmp/corto.sql /tmp/nohttps.sql /tmp/pieno.sql /tmp/nuovo.sql
echo
if [ $ko -eq 0 ]; then verde "tutto a posto ($ok controlli)"; else rosso "$ko problemi su $((ok+ko))"; fi
exit $([ $ko -eq 0 ] && echo 0 || echo 1)
