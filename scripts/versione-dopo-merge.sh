#!/usr/bin/env bash
# Dopo ogni aggiornamento di main: se l'app e' cambiata e la versione no,
# la alza e pubblica (scripts/versione-unica.py spiega perche').
#
# Se intanto qualcuno ha pubblicato — di solito l'import, che gira ogni 20
# minuti nei giorni di partita — si riparte dalla sua versione di main: se ha
# gia' alzato lui la versione basta quella, il telefono riscarica tutto.
#
#   bash scripts/versione-dopo-merge.sh PRIMA     # PRIMA: main prima del push
set -uo pipefail
PRIMA=$1
RAMO=${RAMO:-main}
for tentativo in 1 2 3 4; do
  git fetch -q origin "$RAMO" && git reset -q --hard "origin/$RAMO" || { sleep 10; continue; }
  if [ "$(python3 scripts/versione-unica.py "$PRIMA" HEAD)" != "si" ]; then
    echo "versione a posto"
    exit 0
  fi
  python3 scripts/bump-sw.py
  git add sw.js src/versione.js
  git commit -q -m "versione: $(grep -o "fcs-v[0-9.]*" sw.js), l'app era cambiata e la versione no"
  if git push -q origin "HEAD:$RAMO"; then
    echo "pubblicata $(grep -o "fcs-v[0-9.]*" sw.js)"
    exit 0
  fi
  echo "::warning::push non riuscito (tentativo $tentativo), riprovo da capo"
  sleep $((tentativo * 15))
done
echo "::error::non sono riuscito ad alzare la versione: lanciare a mano python3 scripts/bump-sw.py"
exit 1
