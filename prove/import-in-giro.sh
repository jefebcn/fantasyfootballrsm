#!/usr/bin/env bash
# L'import in giro (scripts/importa-in-giro.sh), provato senza la FSGC e
# senza GitHub: un repository "origine" finto, una copia di lavoro, e al posto
# dell'import vero dei comandi che cambiano un file, falliscono o scrivono a
# meta'. Si guarda cosa arriva sull'origine — cioe' cosa andrebbe online.
#
#   ./prove/import-in-giro.sh
set -uo pipefail
cd "$(dirname "$0")/.."
RADICE=$(pwd)
rosso() { printf '\033[31m%s\033[0m\n' "$*"; }
verde() { printf '\033[32m%s\033[0m\n' "$*"; }
ok=0; ko=0
et() { if [ "$1" = 0 ]; then verde "  ok  $2"; ok=$((ok+1)); else rosso "  KO  $2"; ko=$((ko+1)); fi; }

T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
nuovo() { # un'origine e una copia di lavoro nuove, dall'ultima versione di qui
  rm -rf "$T/o.git" "$T/w"
  # l'origine vera ha "main": qui si parte dal commit attuale, qualunque ramo
  # sia (in CI, su una pull request, non e' nemmeno un ramo), e lo si chiama
  # main — se no lo script cerca main e non lo trova (e' successo)
  git init -q --bare "$T/o.git"
  git -C "$T/o.git" fetch -q --depth 1 "file://$RADICE" "+HEAD:refs/heads/main"
  git -C "$T/o.git" symbolic-ref HEAD refs/heads/main
  git clone -q "$T/o.git" "$T/w"
  git -C "$T/w" config user.name 'importatore FSGC'
  git -C "$T/w" config user.email 'importatore-fsgc@users.noreply.github.com'
}
commit_origine() { git -C "$T/o.git" rev-list --count HEAD; }
# lo script si prende da QUI (la versione che si sta provando), ma gira dentro
# la copia di lavoro, dove ci sono gli altri script che chiama
gira() { (cd "$T/w" && env "$@" bash "$RADICE/scripts/importa-in-giro.sh") > "$T/uscita" 2>&1; echo $?; }
# "l'import" che porta un dato nuovo: sempre lo stesso, quindi al secondo giro
# non c'e' piu' niente di nuovo — come la FSGC quando non ha pubblicato
CAMBIA="sed -i 's/^export const GIORNATE = 30;$/export const GIORNATE = 30; \/\/ nuovo/' src/calendario-dati.js"

echo "== fuori dai giorni di partita: un giro, come prima =="
nuovo; prima=$(commit_origine)
esito=$(gira IMPORTA="$CAMBIA" VIDEO=true PROVE=true FINESTRA="echo no" PAUSA=1 DURATA=60)
[ "$esito" = 0 ]; et $? "finisce bene"
[ "$(grep -c '::group::giro' "$T/uscita")" = 1 ]; et $? "fa un giro solo ($(grep -c '::group::giro' "$T/uscita"))"
[ "$(commit_origine)" = $((prima + 1)) ]; et $? "e pubblica i dati nuovi: un commit sull'origine"
git -C "$T/o.git" log -1 --format=%an | grep -q "importatore FSGC"; et $? "firmato dall'importatore"
git -C "$T/o.git" log -1 --format=%s | grep -q "dati: import automatico"; et $? "col messaggio di sempre"
git -C "$T/o.git" show HEAD --stat | grep -q "sw.js"; et $? "e con la versione nuova del service worker, se no i telefoni tengono i dati vecchi"

echo "== nei giorni di partita resta acceso =="
nuovo; prima=$(commit_origine)
esito=$(gira IMPORTA="$CAMBIA" VIDEO=true PROVE=true FINESTRA="echo si" PAUSA=1 DURATA=4)
giri=$(grep -c '::group::giro' "$T/uscita")
[ "$esito" = 0 ] && [ "$giri" -ge 2 ]; et $? "fa piu' giri ($giri) e finisce bene quando scade il turno"
grep -q "la prossima corsa prende il posto" "$T/uscita"; et $? "e dice perche' si ferma"
[ "$(commit_origine)" = $((prima + 1)) ]; et $? "ma pubblica una volta sola: ai giri dopo non c'e' niente di nuovo"

echo "== la FSGC non risponde al primo giro =="
nuovo; prima=$(commit_origine)
esito=$(gira IMPORTA=false VIDEO=true PROVE=true FINESTRA="echo si" PAUSA=1 DURATA=10)
[ "$esito" = 1 ]; et $? "esce con errore, che si vede"
[ "$(commit_origine)" = "$prima" ]; et $? "e non pubblica niente"

echo "== un giro fallito ogni tanto si riprova, tre di fila no =="
nuovo; prima=$(commit_origine); rm -f "$T/n"
# primo giro buono, poi solo errori
CONTA="n=\$(cat $T/n 2>/dev/null || echo 0); n=\$((n+1)); echo \$n > $T/n; [ \$n -eq 1 ] && $CAMBIA"
esito=$(gira IMPORTA="$CONTA" VIDEO=true PROVE=true FINESTRA="echo si" PAUSA=1 DURATA=60 FALLITI_MAX=3)
[ "$esito" = 1 ] && [ "$(cat "$T/n")" = 4 ]; et $? "dopo tre giri falliti di fila esce con errore ($(cat "$T/n") giri)"
[ "$(commit_origine)" = $((prima + 1)) ]; et $? "e quello che aveva gia' pubblicato resta"

echo "== un giro che scrive a meta' e poi fallisce non pubblica niente =="
nuovo; prima=$(commit_origine); rm -f "$T/n"
# giro 2: scrive una riga e poi fallisce; gli altri giri non portano niente
MEZZO="n=\$(cat $T/n 2>/dev/null || echo 0); n=\$((n+1)); echo \$n > $T/n; if [ \$n -eq 2 ]; then echo '// mezzo' >> src/calendario-dati.js; false; fi"
esito=$(gira IMPORTA="$MEZZO" VIDEO=true PROVE=true FINESTRA="echo si" PAUSA=1 DURATA=5)
[ "$(cat "$T/n")" -ge 3 ]; et $? "dopo il giro fallito si riprova ($(cat "$T/n") giri)"
[ "$(commit_origine)" = "$prima" ] && ! git -C "$T/o.git" show HEAD:src/calendario-dati.js | grep -q "// mezzo"
et $? "e la riga scritta a meta' non arriva online: nessun commit"

echo "== GitHub non risponde all'aggiornamento: il giro non va avanti su una copia vecchia =="
nuovo; prima=$(commit_origine)
git -C "$T/w" remote set-url origin "$T/non-esiste.git"
esito=$(gira IMPORTA="$CAMBIA" VIDEO=true PROVE=true FINESTRA="echo no" PAUSA=1 DURATA=60)
[ "$esito" = 1 ]; et $? "esce con errore invece di importare su una copia vecchia"
grep -q "non riesco ad aggiornarmi" "$T/uscita"; et $? "e dice perche'"

echo "== le prove non passano coi dati nuovi =="
nuovo; prima=$(commit_origine)
esito=$(gira IMPORTA="$CAMBIA" VIDEO=true PROVE=false FINESTRA="echo no" PAUSA=1 DURATA=60)
[ "$esito" = 1 ]; et $? "esce con errore"
[ "$(commit_origine)" = "$prima" ]; et $? "e non pubblica dati che rompono l'app"

echo "== qualcun altro pubblica mentre il giro dorme =="
nuovo; prima=$(commit_origine); rm -f "$T/n"
# al secondo giro, prima di importare, arriva un commit "da fuori" sull'origine
ALTRO="n=\$(cat $T/n 2>/dev/null || echo 0); n=\$((n+1)); echo \$n > $T/n; if [ \$n -eq 2 ]; then git clone -q $T/o.git $T/altro && git -C $T/altro -c user.name=x -c user.email=x@x commit -q --allow-empty -m 'da fuori' && git -C $T/altro push -q; rm -rf $T/altro; fi; $CAMBIA"
esito=$(gira IMPORTA="$ALTRO" VIDEO=true PROVE=true FINESTRA="echo si" PAUSA=1 DURATA=4)
git -C "$T/o.git" log --format=%s | grep -q "da fuori"; et $? "il commit arrivato da fuori resta"
[ "$esito" = 0 ]; et $? "e il giro non si rompe: riparte dall'ultima versione"

echo
if [ $ko -eq 0 ]; then verde "tutto a posto ($ok controlli)"; else rosso "$ko problemi su $((ok+ko))"; fi
exit $([ $ko -eq 0 ] && echo 0 || echo 1)
