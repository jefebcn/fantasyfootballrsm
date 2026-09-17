#!/usr/bin/env bash
# Le prove col browser, tutte di fila.
#
# Quelle in tests/ girano senza browser e controllano sintassi, motore di
# calcolo e un paio di regole CSS. Queste aprono l'app davvero e guardano cosa
# si vede: contrasti e testi che sbordano su venticinque schermate, le righe
# del campo in ventotto combinazioni, le icone al posto giusto, le schermate
# che si erano rotte una volta e non devono rirompersi.
#
#   ./prove/tutte.sh              avvia da sé un server sulla 4173
#   BASE=http://... ./prove/tutte.sh   usa quello che gli dici
#
# Gli screenshot finiscono in $USCITA (default /tmp): servono a guardare, non
# a decidere. A decidere è il codice d'uscita di ogni prova.
set -uo pipefail
cd "$(dirname "$0")/.."
PORTA=${PORTA:-4173}
export USCITA=${USCITA:-$(mktemp -d)}

rosso() { printf '\033[31m%s\033[0m\n' "$*"; }
verde() { printf '\033[32m%s\033[0m\n' "$*"; }

if [ -z "${BASE:-}" ]; then
  python3 -m http.server "$PORTA" >/dev/null 2>&1 &
  SERVER=$!
  trap 'kill $SERVER 2>/dev/null' EXIT
  export BASE="http://localhost:$PORTA"
  for _ in $(seq 1 40); do
    curl -sf -o /dev/null "$BASE/index.html" && break
    sleep 0.25
  done
fi
echo "server: $BASE   screenshot in: $USCITA"
echo

# SALTA="audit-ux altra" per lasciarne fuori qualcuna. Serve su CI: l'audit
# gira su venticinque schermate per due larghezze e due temi, e da solo vale
# quanto tutte le altre insieme. A ogni push si fanno le veloci, di notte
# tutte.
salta=" ${SALTA:-} "
falliti=(); fatte=0
for f in prove/*.cjs; do
  nome=$(basename "$f" .cjs)
  case "$salta" in *" $nome "*) printf '%-22s saltata\n' "$nome"; continue ;; esac
  printf '%-22s ' "$nome"
  fatte=$((fatte + 1))
  uscita=$(timeout 300 node "$f" 2>&1)
  if [ $? -eq 0 ]; then
    verde "ok   $(echo "$uscita" | grep -iE 'ok|nessun|totale' | tail -1 | cut -c1-60)"
  else
    rosso "FALLITA"
    echo "$uscita" | tail -12 | sed 's/^/    /'
    falliti+=("$nome")
  fi
done

echo
# Un verde che non ha provato niente e' peggio di un rosso: un SALTA scritto
# troppo larga farebbe passare qualunque cosa senza aprire il browser.
if [ "$fatte" -eq 0 ]; then rosso "nessuna prova eseguita: controlla SALTA"; exit 1; fi
if [ ${#falliti[@]} -eq 0 ]; then verde "$fatte prove col browser, tutte passate"; exit 0; fi
rosso "fallite: ${falliti[*]} (su $fatte)"; exit 1
