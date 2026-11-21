#!/usr/bin/env bash
# Il futsal dentro l'import automatico (dati-fsgc.yml → importa-in-giro.sh).
#
# Prima del lancio i referti del futsal li importava qualcuno a mano. Dal
# lancio (01/12/2026) tocca all'importatore, come per il calcio, a ogni giro:
#
#   1. importa-futsal.py: calendario e referti dalla FSGC → src/futsal-dati.js,
#      più i due SQL generati: futsal-02-dati.sql (listone e orari di
#      chiusura) e futsal-05-quotazioni.sql (le quotazioni di ogni giornata).
#   2. GUARDIA: se i referti sono meno di prima, non si pubblica. Succede se
#      l'archivio data/futsal-tabellini.json è andato perso e la FSGC non
#      risponde a metà riscaricamento: le partite non riprese sparirebbero
#      dall'app.
#   3. Se gli SQL sono cambiati, si caricano sul database PRIMA che l'app
#      esca: senza le quotazioni nuove il server rifiuta le rose («Mercato
#      chiuso»), senza gli orari nuovi rifiuta le formazioni delle giornate
#      appena fissate dalla FSGC. Se il database non risponde, il futsal di
#      questo giro si butta e si riprova al giro dopo.
#
# Esce sempre con 0: il futsal non ferma mai l'import del calcio.
#
#   SUPABASE_DB_URL   la stringa di connessione (lo stesso secret del salvataggio)
#   IMPORTA_FS        per le prove: al posto di importa-futsal.py
#   CARICA_FS         per le prove: al posto di psql
set -uo pipefail
SQL_FS="supabase/migrations/futsal-02-dati.sql supabase/migrations/futsal-05-quotazioni.sql"
FILE_FS="src/futsal-dati.js $SQL_FS"
IMPORTA_FS=${IMPORTA_FS:-"python3 scripts/importa-futsal.py"}

annulla() { git checkout -q -- $FILE_FS 2>/dev/null; echo "::warning::futsal: $1"; exit 0; }
conta() { node --input-type=module -e "import('$(pwd)/src/futsal-dati.js').then((m) => console.log(m.REFERTI.length))"; }

prima=$(conta) || prima=0
bash -c "$IMPORTA_FS" || annulla "l'import non è andato, riprovo al giro dopo"
dopo=$(conta) || annulla "src/futsal-dati.js non si legge dopo l'import"
[ "$dopo" -ge "$prima" ] || annulla "i referti sono scesi da $prima a $dopo: non pubblico (archivio perso o FSGC a metà?)"

if git diff --quiet -- $SQL_FS; then
  git diff --quiet -- src/futsal-dati.js || echo "futsal: referti $prima → $dopo"
  exit 0
fi

if [ -n "${CARICA_FS:-}" ]; then
  bash -c "$CARICA_FS" || annulla "il database non ha preso quotazioni e orari, riprovo al giro dopo"
else
  # spazi e a capo intorno a un secret non si vedono (salvataggio.yml)
  url=$(printf '%s' "${SUPABASE_DB_URL:-}" | tr -d '[:space:]')
  [ -n "$url" ] || annulla "SUPABASE_DB_URL non impostato: quotazioni e orari non arriverebbero al database, non pubblico"
  # tutto in una transazione: o entrano listone, orari e quotazioni, o niente
  psql "$url" -v ON_ERROR_STOP=1 -q -1 -f supabase/migrations/futsal-02-dati.sql -f supabase/migrations/futsal-05-quotazioni.sql >/dev/null \
    || annulla "il database non ha preso quotazioni e orari, riprovo al giro dopo"
fi
echo "futsal: referti $prima → $dopo, quotazioni e orari caricati sul database"
exit 0
