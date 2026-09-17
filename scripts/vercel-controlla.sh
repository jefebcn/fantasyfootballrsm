#!/usr/bin/env bash
# Le prove decidono se il deploy parte. Gira su Vercel, prima del build.
#
# PERCHE'. Vercel distribuisce ogni push su main, e la CI di GitHub gira in
# parallelo: se una prova era rossa, la versione rotta era comunque online da
# un pezzo quando il rosso arrivava. Finche' gli utenti erano due andava bene.
# Con gente vera, un push sbagliato di domenica mattina e' la formazione di
# qualcuno che non si salva.
#
# ATTENZIONE ALLA LOGICA, che e' rovesciata e non per scelta mia: questo file
# e' l'"ignoreCommand" di Vercel, cioe' risponde alla domanda "devo IGNORARE
# questo commit?".
#   uscita 0  ->  ignora: il deploy NON parte, resta online la versione di prima
#   uscita 1  ->  procedi: il deploy parte
# Quindi le prove passate valgono 1 e le prove rotte valgono 0. Per non
# sbagliarsi ci sono due funzioni con il nome di quello che fanno.
#
# Gira solo le prove SENZA browser (lint, sintassi, motore di calcolo,
# formato del video, tavolozza, funzione del promemoria): sono dieci secondi.
# Quelle col browser servono un Chromium e stanno in CI, dove il rosso arriva
# comunque — ma almeno un file JS con un errore di sintassi, o un motore di
# calcolo rotto, non arrivano piu' in produzione.
#
# Si prova da qui:  ./scripts/vercel-controlla.sh ; echo $?
set -uo pipefail
cd "$(dirname "$0")/.."

procedi() { echo "==> prove passate: il deploy puo' partire"; exit 1; }
ferma()   { echo "::error::$1"; echo "==> IL DEPLOY NON PARTE: resta online la versione di prima"; exit 0; }

# Su Vercel l'ignoreCommand gira prima dell'installazione: le dipendenze qui
# non ci sono ancora. PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD perche' i browser
# servono alle prove col browser, che qui non girano: sono 150 MB per niente.
if [ ! -d node_modules/eslint ]; then
  echo "==> installo le dipendenze per le prove"
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci --no-audit --no-fund --silent \
    || PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-audit --no-fund --silent \
    || ferma "non riesco a installare le dipendenze: non posso provare niente, e senza prove non distribuisco"
fi

echo "==> lint"
npx --no-install eslint . || ferma "il lint non passa"

echo "==> prove senza browser"
node --test tests/*.test.js || ferma "le prove non passano"

procedi
