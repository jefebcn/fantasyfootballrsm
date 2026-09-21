#!/usr/bin/env bash
# Applica schema e migrazioni a un database vuoto e chiama le funzioni.
#
# Nasce da cinque errori veri, tutti dello stesso tipo: la 001 converte le
# colonne dell'identita' da uuid a text, e le migrazioni successive erano
# rimaste a uuid. Una meta' falliva alla creazione, l'altra meta' (i corpi
# plpgsql, che Postgres non controlla finche' non li esegui) sarebbe scoppiata
# in faccia a chi provava a uscire da una lega.
#
#   ./supabase/prove/prova.sh                 usa un Postgres temporaneo
#   PGURL=postgres://... ./…/prova.sh         usa quello che gli dici
set -euo pipefail
cd "$(dirname "$0")/../.."
RADICE=$(pwd)
PORTA=${PORTA:-5455}
export PATH=/usr/lib/postgresql/16/bin:/usr/lib/postgresql/15/bin:$PATH

rosso() { printf '\033[31m%s\033[0m\n' "$*"; }
verde() { printf '\033[32m%s\033[0m\n' "$*"; }

if [ -n "${PGURL:-}" ]; then
  PSQL=(psql "$PGURL")
else
  DATI=$(mktemp -d)
  PROPRIETARIO=postgres
  id -u postgres >/dev/null 2>&1 || PROPRIETARIO=$(id -un)
  chown -R "$PROPRIETARIO" "$DATI" 2>/dev/null || true
  COME() { if [ "$(id -un)" = "$PROPRIETARIO" ]; then bash -c "$1"; else su "$PROPRIETARIO" -c "$1"; fi; }
  COME "PATH=$PATH initdb -D $DATI -U postgres --auth=trust" >/dev/null
  COME "PATH=$PATH pg_ctl -D $DATI -o '-p $PORTA -k /tmp' -l $DATI/log start" >/dev/null
  trap 'COME "PATH=$PATH pg_ctl -D $DATI -m immediate stop" >/dev/null 2>&1 || true; rm -rf "$DATI"' EXIT
  for _ in $(seq 1 30); do psql -h /tmp -p "$PORTA" -U postgres -c 'select 1' >/dev/null 2>&1 && break; sleep 0.5; done
  psql -h /tmp -p "$PORTA" -U postgres -q -c 'drop database if exists prova' -c 'create database prova'
  PSQL=(psql -h /tmp -p "$PORTA" -U postgres -d prova)
fi

"${PSQL[@]}" -q -v ON_ERROR_STOP=1 -f supabase/prove/ambiente.sql >/dev/null
echo "== schema e migrazioni =="
"${PSQL[@]}" -q -v ON_ERROR_STOP=1 -f supabase/schema.sql >/dev/null && verde "  ok  schema.sql"

# due passate: le migrazioni si devono poter rieseguire senza danni
for passata in 1 2; do
  for f in supabase/migrations/*.sql; do
    if "${PSQL[@]}" -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>"$RADICE/.err"; then
      [ "$passata" = 1 ] && verde "  ok  $(basename "$f")" || verde "  ok  $(basename "$f") (rieseguita)"
    else
      rosso "  KO  $(basename "$f") (passata $passata)"; grep -i error "$RADICE/.err" | head -3; rm -f "$RADICE/.err"; exit 1
    fi
  done
done
rm -f "$RADICE/.err"

echo "== il listino del negozio si carica =="
# Il file lo genera scripts/genera-quotazioni.mjs dal listone dell'app: qui si
# applica per davvero, cosi' un errore di sintassi in un file GENERATO non si
# scopre incollandolo nel SQL Editor di produzione.
if "${PSQL[@]}" -q -v ON_ERROR_STOP=1 -f supabase/seed-quotazioni.sql >/dev/null 2>"$RADICE/.err"; then
  QUANTI=$("${PSQL[@]}" -t -A -c "select count(*) from public.quotazioni" | tr -d '[:space:]')
  verde "  ok  $QUANTI giocatori nel listino"
else
  rosso "  KO  seed-quotazioni.sql non si applica"; grep -i error "$RADICE/.err" | head -3; rm -f "$RADICE/.err"; exit 1
fi

echo "== il calendario dei lock c'e' senza che nessuno apra l'app =="
# La 012 lo mette nel database: 30 righe, una per giornata, senza un Giudice
# Dati che debba aprire l'app. Prima la tabella restava vuota e le policy,
# prudenti, non facevano vedere le formazioni degli avversari a nessuno.
QUANTE=$("${PSQL[@]}" -t -A -c "select count(*) from public.matchday_locks" | tr -d '[:space:]')
if [ "$QUANTE" = 30 ]; then verde "  ok  30 giornate in matchday_locks"; else rosso "  KO  matchday_locks ha $QUANTE righe, non 30"; exit 1; fi

echo "== funzioni =="
# Una volta sola: il file cambia lo stato del database (chi entra, chi esce),
# rieseguirlo darebbe per forza esiti diversi.
set +e
USCITA=$("${PSQL[@]}" -q -v ON_ERROR_STOP=1 -f supabase/prove/funzioni.sql 2>&1); ESITO=$?
set -e
echo "$USCITA" | grep -E "ok |FALLITA|ERROR" | sed -E 's/^psql:[^ ]+ NOTICE:  /  /; s/^NOTICE:  /  /'
if [ $ESITO -ne 0 ]; then rosso "  KO  le prove sulle funzioni sono fallite"; exit 1; fi
verde "tutto a posto"
