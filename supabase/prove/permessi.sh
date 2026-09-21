#!/usr/bin/env bash
# Chi puo' chiamare cosa. Una prova sola, e nasce da un buco vero.
#
# Il 17 settembre, da fuori e con la sola chiave pubblicabile che sta nel
# frontend, il ruolo anonimo riusciva a eseguire le funzioni del database.
# Su una faceva danno: da_avvisare() restituisce endpoint, p256dh e auth di
# ogni iscrizione al push — quanto basta per spedire una notifica al telefono
# di qualcuno — e non controlla chi la chiama, perche' doveva essere
# raggiungibile solo dal service role.
#
# La causa era un permesso dato AL RUOLO anon dai valori predefiniti del
# progetto Supabase, mentre le migrazioni revocavano da PUBLIC. Due cose
# diverse: la revoca non revocava niente. Il Postgres delle prove non aveva
# quei valori predefiniti, quindi qui era tutto verde.
#
# Questa prova tiene il conto: per ogni funzione dell'app, chi la puo'
# eseguire e chi no. Se una migrazione nuova se ne dimentica, diventa rossa
# prima di arrivare sul database vero.
#
#   ./supabase/prove/permessi.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
PORTA=${PORTA:-5467}
export PATH=/usr/lib/postgresql/16/bin:/usr/lib/postgresql/15/bin:$PATH

rosso() { printf '\033[31m%s\033[0m\n' "$*"; }
verde() { printf '\033[32m%s\033[0m\n' "$*"; }
GUAI=0
ko() { rosso "  KO  $*"; GUAI=$((GUAI+1)); }
ok() { verde "  ok  $*"; }

DATI=$(mktemp -d)
PROPRIETARIO=postgres
id -u postgres >/dev/null 2>&1 || PROPRIETARIO=$(id -un)
chown -R "$PROPRIETARIO" "$DATI" 2>/dev/null || true
COME() { if [ "$(id -un)" = "$PROPRIETARIO" ]; then bash -c "$1"; else su "$PROPRIETARIO" -c "$1"; fi; }
COME "PATH=$PATH initdb -D $DATI -U postgres --auth=trust" >/dev/null
COME "PATH=$PATH pg_ctl -D $DATI -o '-p $PORTA -k /tmp' -l $DATI/log start" >/dev/null
trap 'COME "PATH=$PATH pg_ctl -D $DATI -m immediate stop" >/dev/null 2>&1 || true; rm -rf "$DATI"' EXIT
for _ in $(seq 1 30); do psql -h /tmp -p "$PORTA" -U postgres -c 'select 1' >/dev/null 2>&1 && break; sleep 0.5; done

psql -h /tmp -p "$PORTA" -U postgres -q -c 'create database prova'
Q() { psql -h /tmp -p "$PORTA" -U postgres -d prova -q -v ON_ERROR_STOP=1 "$@"; }
V() { psql -h /tmp -p "$PORTA" -U postgres -d prova -t -A -c "$1" | tr -d '[:space:]'; }

echo "== schema, migrazioni e i permessi predefiniti di Supabase =="
Q -f supabase/prove/ambiente.sql >/dev/null
Q -f supabase/schema.sql >/dev/null
for m in supabase/migrations/*.sql; do Q -f "$m" >/dev/null; done
ok "applicati"

# Le funzioni che vivono dentro le policy RLS e i trigger: valutate col ruolo
# di chi interroga, non tirano fuori niente e restano aperte di proposito.
# Se ne aggiungi una al database, aggiungila qui: e' una scelta, e va scritta.
APERTE="is_judge is_league_admin is_league_member my_member_id matchday_is_frozen
        matchday_lock_at matchday_of current_user_id log_change guard_frozen trade_conta"
# E una che scrive, aperta all'anonimo di proposito: conta_sponsor (018). La
# fascia dello sponsor la vede chiunque apra l'app, anche prima di avere un
# account, e un contatore che conta solo gli iscritti non e' il numero che si
# porta a un rinnovo. Ha tre limiti, ed e' per quelli che sta in questo
# elenco invece che fuori: accetta due soli tipi, scrive solo su uno sponsor
# dentro la sua finestra, e non restituisce niente — non e' una porta per
# leggere. I limiti li provano supabase/prove/funzioni.sql e il controllo
# qui sotto.
APERTE="$APERTE conta_sponsor"
# Su una riga sola, con uno spazio davanti e dietro: il confronto piu' sotto
# cerca " nome " e i ritorni a capo dell'elenco lo facevano fallire per gli
# ultimi di ogni riga. Preso dal guardiano stesso alla prima corsa, che e' il
# modo in cui si scopre che un controllo controlla.
APERTE=" $(echo $APERTE) "

echo "== nessuna funzione dell'app raggiungibile dal ruolo anonimo =="
LISTA=$(psql -h /tmp -p "$PORTA" -U postgres -d prova -t -A -F' ' -c "
  select p.proname, p.oid::regprocedure
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname='public' and p.prokind='f' and p.prosecdef
     and has_function_privilege('anon', p.oid, 'execute')")
SFUGGITE=0
while read -r nome firma; do
  [ -z "$nome" ] && continue
  case "$APERTE" in
    *" $nome "*) ;;
    *) ko "$nome e' eseguibile da anon — manca un revoke nella migrazione ($firma)"; SFUGGITE=1 ;;
  esac
done <<< "$LISTA"
[ "$SFUGGITE" = 0 ] && ok "nessuna, a parte quelle aperte di proposito"

echo "== la sola funzione che l'anonimo puo' scrivere non apre altro =="
# Aperta si', ma limitata: se un giorno restituisse righe invece di void
# diventerebbe un modo per leggere il database senza account, e se l'anonimo
# avesse i permessi sulla tabella il contatore si potrebbe riempire a mano.
if [ "$(V "select pg_get_function_result('public.conta_sponsor(uuid,text)'::regprocedure)")" = void ]; then
  ok "conta_sponsor non restituisce niente"
else
  ko "conta_sponsor ora restituisce qualcosa: da anonimo diventa una finestra sul database"
fi
for pr in select insert update delete; do
  if [ "$(V "select has_table_privilege('anon','public.sponsor_conteggi','$pr')")" = f ]; then
    ok "l'anonimo non ha $pr sui conteggi"
  else
    ko "l'anonimo ha $pr su sponsor_conteggi: il rendiconto si scrive a mano"
  fi
done

echo "== le due del service role sono chiuse anche a chi ha fatto l'accesso =="
for f in "da_avvisare(int)" "promemoria_da_rifare(int,text[])"; do
  for ruolo in anon authenticated; do
    if [ "$(V "select has_function_privilege('$ruolo','public.$f','execute')")" = t ]; then
      ko "$f e' eseguibile da $ruolo"
    else
      ok "$f chiusa a $ruolo"
    fi
  done
  [ "$(V "select has_function_privilege('service_role','public.$f','execute')")" = t ] \
    && ok "$f aperta al service role, che e' chi la usa" \
    || ko "$f non e' eseguibile dal service role: il promemoria non parte piu'"
done

echo "== e l'app funziona ancora: chi ha fatto l'accesso arriva alle sue =="
# Se un revoke e' scritto troppo largo, questa e' la prova che lo prende:
# revocare da PUBLIC senza rimettere il grant spegne l'iscrizione alle leghe.
for f in "create_league(text,text,text,text,text)" "join_league(text,text,text,text)" \
         "entra_come_vice(text)" "elimina_profilo()" "abbandona_lega(uuid)" \
         "chiudi_giornata(int)" "proponi_scambio(uuid,uuid,jsonb,jsonb,int,text)" \
         "offri(uuid,text,int)" "sync_matchday_locks(jsonb)" \
         "compra_giocatore(uuid,text)" "vendi_giocatore(uuid,text)" "mercato_aperto(uuid)"; do
  [ "$(V "select has_function_privilege('authenticated','public.$f','execute')")" = t ] \
    && ok "$f" \
    || ko "$f non e' piu' eseguibile da chi ha fatto l'accesso"
done

echo
if [ "$GUAI" = 0 ]; then verde "tutto a posto"; else rosso "$GUAI problemi"; exit 1; fi
