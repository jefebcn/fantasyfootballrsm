#!/usr/bin/env bash
# L'orologio dei dati FSGC dentro Postgres: prova di supabase/dati-fsgc-pianificato.sql
#
# Stesso banco di prova di pianificato.sh (il promemoria): un Postgres vuoto
# con pg_cron e pg_net FINTI, che registrano le chiamate invece di farle. Il
# file si esegue parola per parola, e si guarda cosa avrebbe chiesto a GitHub:
# indirizzo, intestazioni, corpo. Se sbaglia, non lo si scopre da un avviso:
# lo si scopre la domenica sera, coi voti che non arrivano.
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
#   ./supabase/prove/fsgc-pianificato.sh
set -uo pipefail
cd "$(dirname "$0")/../.."
RADICE=$(pwd)
PORTA=${PORTA:-5471}
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
    -- la risposta di GitHub quando accetta la partenza: 204, niente corpo
    insert into net._http_response (id, status_code, content) values (i, 204, '');
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
USCITA=$("${P[@]}" -f supabase/dati-fsgc-pianificato.sql 2>&1); ESITO=$?
[ $ESITO -ne 0 ]; et $? "col segnaposto del token al suo posto si ferma"
echo "$USCITA" | grep -qi "Manca il token"; et $? "e dice quale riga riempire"
[ "$(Q "select count(*) from pg_namespace where nspname = 'interno'")" = 0 ]; et $? "e non ha creato niente"

riempi() { sed -e "/set_config('fsgc.token'/s|IL-TOKEN-DI-GITHUB|$1|" supabase/dati-fsgc-pianificato.sql; }
riempi 'ghp_0123456789abcdefghijklmnopqrstuvwxyzAB' > /tmp/classico.sql
USCITA=$("${P[@]}" -f /tmp/classico.sql 2>&1); ESITO=$?
[ $ESITO -ne 0 ] && echo "$USCITA" | grep -qi "classic"; et $? "un token classic (ghp_, vale per tutti i repository) lo rifiuta e dice perche'"
riempi 'github_pat_corto' > /tmp/corto.sql
USCITA=$("${P[@]}" -f /tmp/corto.sql 2>&1); ESITO=$?
[ $ESITO -ne 0 ]; et $? "un token troncato (copiato a meta') lo rifiuta"

echo "== col file riempito =="
TOKEN='github_pat_11ABCDEFG0123456789_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWX0123456789ab'
riempi "$TOKEN" > /tmp/pieno.sql
USCITA=$("${P[@]}" -f /tmp/pieno.sql 2>&1); ESITO=$?
[ $ESITO -eq 0 ]; et $? "si esegue senza errori$([ $ESITO -eq 0 ] || echo ": $(echo "$USCITA" | grep -i error | head -1)")"
[ "$(Q "select schedule from cron.job where jobname = 'fsgc-weekend'")" = '*/30 * * * 0,1,5,6' ]; et $? "ogni 30 minuti da venerdi' a lunedi' ($(Q "select schedule from cron.job where jobname = 'fsgc-weekend'"))"
[ "$(Q "select schedule from cron.job where jobname = 'fsgc-settimana'")" = '23 * * * 2,3,4' ]; et $? "ogni ora gli altri giorni ($(Q "select schedule from cron.job where jobname = 'fsgc-settimana'"))"
[ "$(Q "select count(*) from cron.job where command like '%chiama_import_fsgc%'")" = 2 ]; et $? "e tutti e due chiamano la funzione giusta"

echo "== la chiamata a GitHub =="
URL=$(Q "select url from net.chiamate order by id desc limit 1")
[ "$URL" = "https://api.github.com/repos/jefebcn/fantasyfootballrsm/actions/workflows/dati-fsgc.yml/dispatches" ]; et $? "l'indirizzo e' quello del lavoro dati-fsgc.yml ($URL)"
[ "$(Q "select headers->>'Authorization' from net.chiamate order by id desc limit 1")" = "Bearer $TOKEN" ]; et $? "porta il token"
[ -n "$(Q "select headers->>'User-Agent' from net.chiamate order by id desc limit 1")" ]; et $? "porta un User-Agent: senza, GitHub risponde 403"
[ "$(Q "select headers->>'X-GitHub-Api-Version' from net.chiamate order by id desc limit 1")" = "2022-11-28" ]; et $? "e la versione dell'API"
[ "$(Q "select body->>'ref' from net.chiamate order by id desc limit 1")" = "main" ]; et $? "e chiede di partire dal ramo main"
Q "select cosa_vuol_dire from interno.fsgc_ultime limit 1" | grep -q "partito"; et $? "la vista dice com'e' andata ($(Q "select stato || ' ' || cosa_vuol_dire from interno.fsgc_ultime limit 1"))"

# il lavoro che si chiama deve esistere e accettare la partenza a comando:
# se un giorno il file si rinomina o perde workflow_dispatch, GitHub
# risponderebbe 404/422 a ogni giro e l'orologio girerebbe a vuoto
[ -f .github/workflows/dati-fsgc.yml ] && grep -q "workflow_dispatch" .github/workflows/dati-fsgc.yml
et $? "il lavoro .github/workflows/dati-fsgc.yml esiste e si puo' far partire a comando"

echo "== il token non lo legge chi non deve =="
for ruolo in anon authenticated service_role; do
  NEG=$(psql -h /tmp -p "$PORTA" -U postgres -d prova -t -A -c "set role $ruolo; select token from interno.fsgc_config" 2>&1)
  echo "$NEG" | grep -qiE "permission denied"; et $? "$ruolo non legge il token"
done

echo "== si puo' rilanciare, anche insieme al promemoria =="
USCITA=$("${P[@]}" -f /tmp/pieno.sql 2>&1); ESITO=$?
[ $ESITO -eq 0 ]; et $? "rieseguito non da' errori"
[ "$(Q "select count(*) from cron.job where jobname like 'fsgc-%'")" = 2 ]; et $? "e i lavori restano due, non quattro"
NUOVO='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zy'
riempi "$NUOVO" > /tmp/nuovo.sql; "${P[@]}" -f /tmp/nuovo.sql >/dev/null 2>&1
[ "$(Q "select headers->>'Authorization' from net.chiamate order by id desc limit 1")" = "Bearer $NUOVO" ]; et $? "rilanciarlo e' il modo di cambiare il token quando scade"
# il promemoria usa le stesse estensioni e lo stesso schema: caricati tutti e
# due, nessuno dei due deve cancellare i lavori dell'altro
sed -e "/set_config('promemoria.token'/s|IL-TOKEN-DEL-PROMEMORIA|token-di-prova-abcdef123456|" supabase/promemoria-pianificato.sql > /tmp/prom.sql
"${P[@]}" -f /tmp/prom.sql >/dev/null 2>&1
[ "$(Q "select count(*) from cron.job where jobname in ('promemoria','fsgc-weekend','fsgc-settimana')")" = 3 ]; et $? "col promemoria caricato dopo, i lavori sono tre e nessuno ha cancellato l'altro"

rm -f /tmp/classico.sql /tmp/corto.sql /tmp/pieno.sql /tmp/nuovo.sql /tmp/prom.sql
echo
if [ $ko -eq 0 ]; then verde "tutto a posto ($ok controlli)"; else rosso "$ko problemi su $((ok+ko))"; fi
exit $([ $ko -eq 0 ] && echo 0 || echo 1)
