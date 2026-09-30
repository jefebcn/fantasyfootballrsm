#!/usr/bin/env bash
# L'import dei dati FSGC, in giro finche' si gioca.
#
# PERCHE'. GitHub fa partire l'import "ogni due ore" ma lo serve ogni 4-7
# (misurato il 29-30 settembre). Farlo partire da fuori — dal database o da
# un altro servizio — vuole una chiave di GitHub, ed e' il passo che non si
# riesce a fare (30 settembre). Pero' un lavoro di GitHub puo' restare acceso
# fino a sei ore, e il permesso di scrivere i dati ce l'ha gia'.
#
# Quindi: nei giorni di partita (scripts/finestra-partite.mjs) non si fa un
# giro e basta — si resta accesi e si ricontrolla la FSGC ogni 20 minuti, per
# un po' piu' di cinque ore. Nel frattempo GitHub mette in coda la corsa
# successiva, che parte appena questa finisce: le partenze in ritardo di
# GitHub diventano la fine di un turno e l'inizio del prossimo, non un buco.
# Fuori dai giorni di partita il giro e' uno, come prima.
#
# OGNI GIRO riparte dall'ultima versione di main (qualcuno puo' aver
# pubblicato nel frattempo, anche questo stesso lavoro), importa, e se ci sono
# dati nuovi fa quello che faceva il lavoro di prima: versione nuova del
# service worker, calendario dei lock, prove, commit, push.
#
# QUANDO SI FERMA MALE, e deve vedersi:
#  - l'import fallisce al PRIMO giro: la FSGC non risponde adesso, esce 1
#    (come prima: un rosso visibile e' meglio di dati vecchi spacciati per
#    nuovi);
#  - l'import fallisce per FALLITI_MAX giri di fila (un'ora): esce 1;
#  - le prove non passano coi dati nuovi: non committa niente ed esce 1.
# Un giro fallito ogni tanto invece e' la FSGC che singhiozza: si segna e si
# riprova al giro dopo, e i file mezzi scritti si buttano (reset) — un commit
# con dati parziali non deve esistere.
#
# Tutti i comandi si possono sostituire da fuori, e cosi' lo prova
# prove/import-in-giro.sh senza la FSGC e senza GitHub.
set -uo pipefail

PAUSA=${PAUSA:-1200}             # 20 minuti fra un giro e l'altro
DURATA=${DURATA:-19200}          # 5h20m: il lavoro ne ha 6, il resto serve a chiudere
FALLITI_MAX=${FALLITI_MAX:-3}
RAMO=${RAMO:-main}
IMPORTA=${IMPORTA:-"python3 scripts/importa-fsgc.py"}
VIDEO=${VIDEO:-"python3 scripts/importa-video.py"}
PROVE=${PROVE:-"npm test"}
FINESTRA=${FINESTRA:-"node scripts/finestra-partite.mjs"}

inizio=$(date +%s)
giro=0
falliti=0

# Un giro. Risponde 0 = fatto (con o senza dati nuovi), 2 = fallito ma si puo'
# riprovare, 1 = fallito e bisogna fermarsi (le prove non passano).
un_giro() {
  # dall'ultima versione di main: i file mezzi scritti di un giro fallito, o un
  # commit che non e' riuscito a partire, qui spariscono. Se GitHub non
  # risponde, il giro NON va avanti su una copia vecchia: conta come fallito.
  if ! { git fetch -q origin "$RAMO" && git reset -q --hard "origin/$RAMO"; }; then
    echo "::warning::non riesco ad aggiornarmi da GitHub"
    return 2
  fi

  if ! bash -c "$IMPORTA"; then
    echo "::warning::l'import non e' andato"
    git reset -q --hard "origin/$RAMO"
    return 2
  fi
  bash -c "$VIDEO" || echo "::warning::gli highlights non si sono aggiornati (non blocca: i voti vengono dai referti)"

  if git diff --quiet -- src/; then
    echo "niente di nuovo dalla FSGC"
    return 0
  fi
  git diff --stat -- src/
  python3 scripts/bump-sw.py
  node scripts/genera-lock.mjs
  if ! git diff --quiet -- supabase/migrations/012-calendario-lock.sql; then
    echo "::warning::Il calendario dei lock e' cambiato: carica supabase/migrations/012-calendario-lock.sql nell'SQL Editor di Supabase, se no il server chiude le formazioni nel giorno vecchio."
  fi
  if ! bash -c "$PROVE"; then
    echo "::error::le prove non passano coi dati nuovi: non committo niente"
    return 1
  fi
  git add src/ sw.js supabase/migrations/012-calendario-lock.sql
  git commit -q -m "dati: import automatico del $(date -u +'%d/%m/%Y')" \
                -m "$(git diff --cached --stat -- src/ | tail -1)"
  if git push -q origin "HEAD:$RAMO"; then
    echo "dati nuovi pubblicati"
  else
    # qualcuno ha pubblicato nel frattempo: al giro dopo si riparte da la' e
    # i dati si ritrovano, perche' la FSGC li ha ancora
    echo "::warning::push non riuscito, riprovo al giro dopo"
  fi
  return 0
}

while :; do
  giro=$((giro + 1))
  echo "::group::giro $giro ($(date -u +%H:%M) UTC)"
  un_giro; esito=$?
  echo "::endgroup::"

  case $esito in
    0) falliti=0 ;;
    1) exit 1 ;;
    2)
      falliti=$((falliti + 1))
      echo "::warning::giro $giro fallito ($falliti di fila)"
      if [ "$giro" -eq 1 ]; then
        echo "::error::al primo giro non va: la FSGC (o GitHub) non risponde adesso"
        exit 1
      fi
      if [ "$falliti" -ge "$FALLITI_MAX" ]; then
        echo "::error::l'import non va da $falliti giri di fila"
        exit 1
      fi
      ;;
  esac

  if [ "$(bash -c "$FINESTRA")" != "si" ]; then
    echo "non si gioca: un giro basta"
    break
  fi
  if [ $(( $(date +%s) - inizio + PAUSA )) -ge "$DURATA" ]; then
    echo "turno finito dopo $giro giri: la prossima corsa prende il posto"
    break
  fi
  sleep "$PAUSA"
done
