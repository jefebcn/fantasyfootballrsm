#!/usr/bin/env bash
# L'import dei dati FSGC e' ancora vivo?
#
# Sabato 19 settembre l'app era su, il server era su, e per chi la usa era
# rotta lo stesso: le partite del venerdi' sera non c'erano. Non era rotto
# niente — era tardi. L'import girava una volta al giorno e GitHub le corse
# pianificate le accoda: il cron delle 05:30 e' partito alle 09:55, alle 10:09,
# alle 10:06, tutte le volte quattro ore e mezza dopo.
#
# Una sentinella che guarda solo se le porte rispondono non se ne accorge.
# Questa guarda l'ultima corsa RIUSCITA del lavoro che porta dentro i dati: se
# e' vecchia, nell'app i risultati sono vecchi, e non importa quanto e' su il
# sito.
#
#   REPO=jefebcn/fantasyfootballrsm ./scripts/controlla-import.sh
#   ORE_MASSIME=8 GH_TOKEN=... ./scripts/controlla-import.sh
#
# Uscita 0 = fresco (o non verificabile), 1 = vecchio.
set -uo pipefail

REPO=${REPO:-jefebcn/fantasyfootballrsm}
LAVORO=${LAVORO:-dati-fsgc.yml}
# Otto ore e non due: il lavoro si propone ogni due ore, ma chi lo serve e'
# GitHub, e i ritardi misurati arrivano a quattro ore e mezza. Sotto le otto si
# suonerebbe per un ritardo normale, e una sentinella che suona per niente e'
# una che non guarda piu' nessuno.
ORE_MASSIME=${ORE_MASSIME:-8}

intestazioni=(-H 'Accept: application/vnd.github+json')
[ -n "${GH_TOKEN:-}" ] && intestazioni+=(-H "Authorization: Bearer $GH_TOKEN")

# Le ultime venti corse SENZA filtro, e la scelta si fa qui. Col filtro
# ?status=success GitHub rispondeva in ritardo di ore: il 30 settembre alle
# 14:04 dava come ultima riuscita quella delle 22:10 del giorno prima, mentre
# l'elenco normale aveva gia' quelle delle 05:24 e delle 12:26 — e la
# sentinella ha suonato per niente.
api="https://api.github.com/repos/$REPO/actions/workflows/$LAVORO/runs?per_page=20"
risposta=$(curl -sS --max-time 25 "${intestazioni[@]}" "$api" || true)

# Due righe: l'ultima riuscita (quando e' finita) e l'ultima in corsa (quando
# e' partita). "?" = la risposta non si legge; "mai" = venti corse e nessuna
# riuscita, che invece e' proprio il guasto da segnalare.
scelte=$(printf '%s' "$risposta" | python3 -c 'import json,sys
try: corse = json.load(sys.stdin)["workflow_runs"]
except Exception: print("?"); print(""); sys.exit()
riuscite = sorted(c["updated_at"] for c in corse if c.get("conclusion") == "success")
in_corsa = sorted(c.get("run_started_at") or c["created_at"] for c in corse if c.get("status") == "in_progress")
print(riuscite[-1] if riuscite else ("mai" if corse else "?"))
print(in_corsa[-1] if in_corsa else "")' 2>/dev/null)
quando=$(printf '%s\n' "$scelte" | sed -n 1p)
partito=$(printf '%s\n' "$scelte" | sed -n 2p)

[ "$quando" = mai ] && quando=""

if [ "$quando" = "?" ] || [ -z "$scelte" ]; then
  # Non sapere non e' un guasto: l API puo' rispondere male, e far fallire la
  # sentinella per questo vorrebbe dire un rosso che non parla dell app.
  echo "::warning::non sono riuscito a leggere le corse dell'import: controllo saltato"
  exit 0
fi

if [ -n "$quando" ]; then
  ore=$(python3 -c 'import datetime,sys
q = datetime.datetime.fromisoformat(sys.argv[1].replace("Z", "+00:00"))
print(round((datetime.datetime.now(datetime.timezone.utc) - q).total_seconds() / 3600, 1))' "$quando")

  echo "ultimo import riuscito: $quando ($ore ore fa)"
  if python3 -c 'import sys; sys.exit(0 if float(sys.argv[1]) <= float(sys.argv[2]) else 1)' "$ore" "$ORE_MASSIME"; then
    echo "i dati sono freschi"
    exit 0
  fi
else
  echo "nessun import riuscito nelle ultime venti corse"
fi

# Nei giorni di partita l'import resta acceso piu' di cinque ore e ricontrolla
# la FSGC ogni 20 minuti (scripts/importa-in-giro.sh): la corsa risulta
# "riuscita" solo quando finisce, ma intanto i dati li ha gia' pubblicati.
# Un turno IN CORSO partito da meno di ORE_MASSIME e' vivo. Se invece si
# pianta, GitHub lo chiude a timeout e la sentinella dopo suona.
if [ -n "$partito" ]; then
  da=$(python3 -c 'import datetime,sys
q = datetime.datetime.fromisoformat(sys.argv[1].replace("Z", "+00:00"))
print(round((datetime.datetime.now(datetime.timezone.utc) - q).total_seconds() / 3600, 1))' "$partito")
  if python3 -c 'import sys; sys.exit(0 if float(sys.argv[1]) <= float(sys.argv[2]) else 1)' "$da" "$ORE_MASSIME"; then
    echo "un turno dell'import e' in corsa da $da ore: i dati li sta portando lui"
    exit 0
  fi
fi
echo "::error::l'import dei dati FSGC non va a buon fine da ${ore:-troppe} ore: nell'app i risultati sono vecchi"
exit 1
