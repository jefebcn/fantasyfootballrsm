#!/usr/bin/env bash
# La sentinella dell'import (scripts/controlla-import.sh), provata senza
# GitHub: al posto di curl un finto che risponde come l'API delle corse, con
# l'ultima corsa riuscita e quella in corso vecchie quanto si vuole.
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
fa() { date -u -d "-$1 hours" +%Y-%m-%dT%H:%M:%SZ; }
# curl finto: RIUSCITA e IN_CORSO sono "ore fa" (vuoto = nessuna corsa)
cat > "$T/curl" <<'EOF'
#!/usr/bin/env bash
url="${*: -1}"
fa() { date -u -d "-$1 hours" +%Y-%m-%dT%H:%M:%SZ; }
case "$url" in
  *status=success*)     [ -n "${RIUSCITA:-}" ] && { echo "{\"workflow_runs\":[{\"updated_at\":\"$(fa "$RIUSCITA")\"}]}"; exit; } ;;
  *status=in_progress*) [ -n "${IN_CORSO:-}" ] && { echo "{\"workflow_runs\":[{\"run_started_at\":\"$(fa "$IN_CORSO")\",\"created_at\":\"$(fa "$IN_CORSO")\"}]}"; exit; } ;;
esac
echo '{"workflow_runs":[]}'
EOF
chmod +x "$T/curl"
sentinella() { env PATH="$T:$PATH" "$@" bash "$RADICE/scripts/controlla-import.sh" > "$T/uscita" 2>&1; echo $?; }

echo "== l'ultimo import riuscito e' recente =="
[ "$(sentinella RIUSCITA=2)" = 0 ]; et $? "tutto bene"

echo "== l'ultimo import riuscito e' vecchio e non gira niente =="
[ "$(sentinella RIUSCITA=12)" = 1 ]; et $? "suona"
grep -q "risultati sono vecchi" "$T/uscita"; et $? "e dice perche'"

echo "== vecchio, ma un turno lungo del giorno di partita e' in corsa =="
[ "$(sentinella RIUSCITA=10 IN_CORSO=3)" = 0 ]; et $? "non suona: i dati li sta portando lui"
grep -q "in corsa da" "$T/uscita"; et $? "e lo dice"

echo "== vecchio, e il turno in corsa e' piantato da troppo =="
[ "$(sentinella RIUSCITA=12 IN_CORSO=9)" = 1 ]; et $? "suona lo stesso"

echo "== GitHub non risponde =="
[ "$(sentinella)" = 0 ]; et $? "non suona per un guasto che non e' dell'app"

echo
if [ $ko -eq 0 ]; then verde "tutto a posto ($ok controlli)"; else rosso "$ko problemi su $((ok+ko))"; fi
exit $([ $ko -eq 0 ] && echo 0 || echo 1)
