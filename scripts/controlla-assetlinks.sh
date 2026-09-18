#!/usr/bin/env bash
# Il collegamento fra il sito e l'app Android, controllato dove conta: in rete.
#
# COSA FA QUESTO FILE. Un'app pubblicata su Play come TWA e' il sito dentro
# una finestra. Android apre quella finestra SENZA la barra dell'indirizzo solo
# se il sito dichiara, in /.well-known/assetlinks.json, che quel pacchetto e
# quella chiave di firma sono suoi. Se il file manca, e' servito col tipo
# sbagliato o l'impronta non e' quella vera, l'app si apre lo stesso — ma con
# la barra del browser in cima, e sembra un sito aperto per sbaglio.
#
# L'IMPRONTA NON E' QUELLA DEL TUO COMPUTER. Con la firma di Play (quella
# predefinita) il pacchetto viene rifirmato da Google: l'impronta da mettere
# qui e' quella che il Play Console mostra in
#   Test and release → Setup → App signing → App signing key certificate → SHA-256.
# Quella del keystore locale e' l'upload key, e serve solo a caricare.
#
#   ./scripts/controlla-assetlinks.sh                  guarda il file locale
#   ./scripts/controlla-assetlinks.sh https://…        e anche quello in rete
set -uo pipefail
cd "$(dirname "$0")/.."
FILE=.well-known/assetlinks.json
SITO=${1:-}
ok=0; ko=0
verde() { printf '\033[32m  ok  %s\033[0m\n' "$*"; ok=$((ok+1)); }
rosso() { printf '\033[31m  KO  %s\033[0m\n' "$*"; ko=$((ko+1)); }

[ -f "$FILE" ] || { rosso "manca $FILE"; exit 1; }
python3 - "$FILE" <<'PY'
import json, re, sys
d = json.load(open(sys.argv[1]))
assert isinstance(d, list) and d, 'deve essere una lista con almeno una voce'
t = d[0]['target']
print('pacchetto:', t['package_name'])
imp = t['sha256_cert_fingerprints']
assert d[0]['relation'] == ['delegate_permission/common.handle_all_urls'], 'relation sbagliata'
assert t['namespace'] == 'android_app', 'namespace sbagliato'
buone = [x for x in imp if re.fullmatch(r'([0-9A-F]{2}:){31}[0-9A-F]{2}', x)]
print('impronte:', len(imp), '· valide:', len(buone))
sys.exit(0 if buone else 3)
PY
case $? in
  0) verde "il file e' JSON valido e l'impronta ha la forma giusta" ;;
  3) rosso "l'impronta e' ancora il segnaposto: mettici la SHA-256 della chiave di firma di Play" ;;
  *) rosso "il file non e' JSON valido come lo vuole Android" ;;
esac

if [ -n "$SITO" ]; then
  url="${SITO%/}/.well-known/assetlinks.json"
  corpo=$(curl -sS -m 20 -o /tmp/al.json -w '%{http_code} %{content_type}' "$url") || { rosso "$url non risponde"; exit 1; }
  stato=${corpo%% *}; tipo=${corpo#* }
  [ "$stato" = 200 ] && verde "in rete risponde 200" || rosso "in rete risponde $stato (Android si aspetta 200, senza redirect)"
  case "$tipo" in application/json*) verde "servito come application/json" ;;
    *) rosso "servito come '$tipo': Android vuole application/json" ;; esac
  if diff -q <(python3 -c 'import json,sys;print(json.dumps(json.load(open("/tmp/al.json")),sort_keys=True))') \
             <(python3 -c 'import json,sys;print(json.dumps(json.load(open(".well-known/assetlinks.json")),sort_keys=True))') >/dev/null 2>&1; then
    verde "quello in rete e' identico a quello nel repository"
  else
    rosso "quello in rete e' diverso da quello nel repository: manca un deploy?"
  fi
fi
echo
[ $ko -eq 0 ] && printf '\033[32mtutto a posto (%s controlli)\033[0m\n' "$ok" || printf '\033[31m%s problemi\033[0m\n' "$ko"
exit $([ $ko -eq 0 ] && echo 0 || echo 1)
