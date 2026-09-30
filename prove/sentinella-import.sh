#!/usr/bin/env bash
# La sentinella dell'import (scripts/controlla-import.sh), provata senza
# GitHub: al posto di curl un finto che risponde come l'elenco delle corse,
# con corse riuscite, fallite e in corsa vecchie quanto si vuole.
#
#   ./prove/sentinella-import.sh
set -uo pipefail
cd "$(dirname "$0")/.."
RADICE=$(pwd)
rosso() { printf '\033[31m%s\033[0m\n' "$*"; }
verde() { printf '\033[32m%s\033[0m\n' "$*"; }
ok=0; ko=0
et() { if [ "$1" = 0 ]; then verde "  ok  $2"; ok=$((ok+1)); else rosso "  KO  $2"; ko=$((ko+1)); fi; }

T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
# curl finto. IN_CORSO, FALLITA, RIUSCITA e VECCHIA (una riuscita piu'
# vecchia) sono "ore fa", vuoto = nessuna corsa di quel tipo. Le mette come
# GitHub, la piu' recente per prima. GUASTO fa rispondere una pagina d'errore.
# Se la sentinella chiede l'elenco filtrato (?status=...) risponde la verita'
# di quel giorno: una riuscita di 16 ore fa.
cat > "$T/curl" <<'FINTO'
#!/usr/bin/env bash
url="${*: -1}"
fa() { date -u -d "-$1 hours" +%Y-%m-%dT%H:%M:%SZ; }
corsa() { echo "{\"status\":\"$1\",\"conclusion\":$2,\"run_started_at\":\"$(fa "$3")\",\"created_at\":\"$(fa "$3")\",\"updated_at\":\"$(fa "$4")\"}"; }
[ -n "${GUASTO:-}" ] && { echo '<html>Bad Gateway</html>'; exit 0; }
case "$url" in *status=*) echo "{\"workflow_runs\":[$(corsa completed '"success"' 16 16)]}"; exit 0 ;; esac
corse=()
[ -n "${IN_CORSO:-}" ] && corse+=("$(corsa in_progress null "$IN_CORSO" 0)")
[ -n "${FALLITA:-}" ]  && corse+=("$(corsa completed '"failure"' "$FALLITA" "$FALLITA")")
[ -n "${RIUSCITA:-}" ] && corse+=("$(corsa completed '"success"' "$RIUSCITA" "$RIUSCITA")")
[ -n "${VECCHIA:-}" ]  && corse+=("$(corsa completed '"success"' "$VECCHIA" "$VECCHIA")")
( IFS=,; echo "{\"workflow_runs\":[${corse[*]}]}" )
FINTO
chmod +x "$T/curl"
sentinella() { env PATH="$T:$PATH" "$@" bash "$RADICE/scripts/controlla-import.sh" > "$T/uscita" 2>&1; echo $?; }

echo "== l'ultimo import riuscito e' recente =="
[ "$(sentinella RIUSCITA=2 VECCHIA=20)" = 0 ]; et $? "tutto bene"
grep -q "sono freschi" "$T/uscita"; et $? "e lo dice"

echo "== l'elenco filtrato di GitHub e' indietro di ore (30 settembre) =="
[ "$(sentinella RIUSCITA=2)" = 0 ]; et $? "non ci casca: legge l'elenco vero"

echo "== l'ultima corsa e' fallita, ma quella prima e' riuscita da poco =="
[ "$(sentinella FALLITA=1 RIUSCITA=3 VECCHIA=20)" = 0 ]; et $? "conta la riuscita piu' recente, non l'ultima corsa"

echo "== l'ultimo import riuscito e' vecchio e non gira niente =="
[ "$(sentinella FALLITA=1 RIUSCITA=12)" = 1 ]; et $? "suona"
grep -q "risultati sono vecchi" "$T/uscita"; et $? "e dice perche'"

echo "== nessuna riuscita in tutto l'elenco =="
[ "$(sentinella FALLITA=1)" = 1 ]; et $? "suona: non e' un 'non so', e' il guasto"

echo "== vecchio, ma un turno lungo del giorno di partita e' in corsa =="
[ "$(sentinella IN_CORSO=3 RIUSCITA=10)" = 0 ]; et $? "non suona: i dati li sta portando lui"
grep -q "in corsa da" "$T/uscita"; et $? "e lo dice"

echo "== vecchio, e il turno in corsa e' piantato da troppo =="
[ "$(sentinella IN_CORSO=9 RIUSCITA=12)" = 1 ]; et $? "suona lo stesso"

echo "== GitHub non risponde =="
[ "$(sentinella GUASTO=1)" = 0 ]; et $? "non suona per un guasto che non e' dell'app"
grep -q "controllo saltato" "$T/uscita"; et $? "ma lo segnala"
[ "$(sentinella)" = 0 ]; et $? "e nemmeno se l'elenco e' vuoto"

echo
if [ $ko -eq 0 ]; then verde "tutto a posto ($ok controlli)"; else rosso "$ko problemi su $((ok+ko))"; fi
exit $([ $ko -eq 0 ] && echo 0 || echo 1)
