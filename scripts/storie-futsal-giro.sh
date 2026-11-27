#!/usr/bin/env bash
# Le storie del futsal dentro l'import (importa-in-giro.sh, dopo un push con
# referti futsal nuovi). Il Chromium per fotografarle si scarica solo qui,
# la prima volta che serve nel turno: gli altri giri non lo pagano.
# Esce sempre con 0: una storia che non esce non ferma l'import.
set -uo pipefail
if [ "${STORIE_FUTSAL:-on}" = off ]; then echo "storie futsal spente (STORIE_FUTSAL=off)"; exit 0; fi
if [ ! -x /opt/pw-browsers/chromium ] && [ -z "${CHROMIUM_PRONTO:-}" ]; then
  npx playwright install --with-deps chromium >/dev/null 2>&1 || { echo "::warning::Chromium non installato: niente storie del futsal"; exit 0; }
fi
node scripts/storie-futsal.mjs || echo "::warning::storie del futsal: errore nello script"
exit 0
