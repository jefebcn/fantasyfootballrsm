#!/usr/bin/env bash
# L'avviso dei nuovi iscritti: prova di supabase/avviso-nuovi-iscritti.sql
#
# Stesso impianto della prova del promemoria pianificato (pianificato.sh, i
# cui commenti qui sotto valgono anche per questa): un Postgres vuoto e un
# pg_net finto che segna le chiamate in una tabella. Si guarda che il file si
# fermi senza le due righe riempite, che l'avviso parta alla CONFERMA e una
# volta sola, che il nome venga ripulito dall'HTML, che la chiave non la
# legga nessuno e che un errore nell'avviso non blocchi mai un'iscrizione.
#
#
# Quel file si lancia UNA VOLTA a mano nel SQL Editor, e se sbaglia qualcosa
# non lo si scopre da un test che non esiste: lo si scopre il giorno dopo,
# perche' nessuno ha ricevuto l'avviso della formazione. Qui gira per davvero
# su un Postgres vuoto.
#
# pg_cron e pg_net non esistono in questo Postgres, e non si possono
# installare: al loro posto si mettono due estensioni FINTE con lo stesso nome
# e la stessa firma — un file .control e un .sql nella cartella delle
# estensioni. Cosi' il file si esegue parola per parola, comprese le due righe
# "create extension", e le chiamate HTTP finiscono in una tabella dove si
# possono guardare: indirizzo, intestazioni, token.
#
# Quello che questa prova NON dice: che su Supabase quelle due estensioni si
# chiamino cosi' e che pg_net stia nello schema "net". Il nome delle estensioni
# e' quello della documentazione di Supabase, e lo schema la funzione lo cerca
# da sola invece di darlo per scontato.
#
#   ./supabase/prove/pianificato.sh
set -uo pipefail
cd "$(dirname "$0")/../.."
RADICE=$(pwd)
PORTA=${PORTA:-5473}
export PATH=/usr/lib/postgresql/16/bin:/usr/lib/postgresql/15/bin:$PATH

rosso() { printf '\033[31m%s\033[0m\n' "$*"; }
verde() { printf '\033[32m%s\033[0m\n' "$*"; }
ok=0; ko=0
et() { if [ "$1" = 0 ]; then verde "  ok  $2"; ok=$((ok+1)); else rosso "  KO  $2"; ko=$((ko+1)); fi; }

# ---- le due estensioni finte
EXT=$(ls -d /usr/share/postgresql/*/extension 2>/dev/null | tail -1)
[ -n "$EXT" ] || { rosso "non trovo la cartella delle estensioni di Postgres"; exit 1; }
FINTE=()
metti() { # nome, corpo sql
  local n=$1; shift
  if [ -e "$EXT/$n.control" ]; then rosso "$n esiste per davvero: questa prova lo sostituirebbe"; exit 1; fi
  printf "comment = 'finta, per le prove di Fantatitano'\ndefault_version = '1.0'\nrelocatable = false\n" > "$EXT/$n.control"
  printf '%s\n' "$1" > "$EXT/$n--1.0.sql"
  FINTE+=("$EXT/$n.control" "$EXT/$n--1.0.sql")
}
metti pg_net "
create schema net;
create table net.chiamate (id bigserial primary key, url text, headers jsonb, body jsonb, timeout_ms int);
create table net._http_response (id bigint primary key, status_code int, content text, error_msg text);
create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}',
    headers jsonb default '{\"Content-Type\": \"application/json\"}', timeout_milliseconds int default 5000)
  returns bigint language plpgsql as \$\$
  declare i bigint;
  begin
    insert into net.chiamate (url, headers, body, timeout_ms) values (url, headers, body, timeout_milliseconds) returning id into i;
    -- la risposta che darebbe la funzione vera quando non c'e' niente da spedire
    insert into net._http_response (id, status_code, content)
      values (i, 200, '{\"spedite\":0,\"iscritti\":1,\"motivo\":\"nessun lock nella finestra\"}');
    return i;
  end \$\$;
"

DATI=$(mktemp -d)
PROPRIETARIO=postgres
id -u postgres >/dev/null 2>&1 || PROPRIETARIO=$(id -un)
chown -R "$PROPRIETARIO" "$DATI" 2>/dev/null || true
COME() { if [ "$(id -un)" = "$PROPRIETARIO" ]; then bash -c "$1"; else su "$PROPRIETARIO" -c "$1"; fi; }
pulisci() {
  COME "PATH=$PATH pg_ctl -D $DATI -m immediate stop" >/dev/null 2>&1 || true
  rm -rf "$DATI"; rm -f "${FINTE[@]}"
}
trap pulisci EXIT
COME "PATH=$PATH initdb -D $DATI -U postgres --auth=trust" >/dev/null
COME "PATH=$PATH pg_ctl -D $DATI -o '-p $PORTA -k /tmp' -l $DATI/log start" >/dev/null
for _ in $(seq 1 30); do psql -h /tmp -p "$PORTA" -U postgres -c 'select 1' >/dev/null 2>&1 && break; sleep 0.5; done
psql -h /tmp -p "$PORTA" -U postgres -q -c 'drop database if exists prova' -c 'create database prova'
P=(psql -h /tmp -p "$PORTA" -U postgres -d prova -q -v ON_ERROR_STOP=1)
Q() { psql -h /tmp -p "$PORTA" -U postgres -d prova -t -A -c "$1"; }

"${P[@]}" -f supabase/prove/ambiente.sql >/dev/null 2>&1

echo "== il file com'e' scaricato non deve creare niente =="
USCITA=$("${P[@]}" -f supabase/avviso-nuovi-iscritti.sql 2>&1); ESITO=$?
[ $ESITO -ne 0 ] && echo "$USCITA" | grep -qi "chiave di Resend"; et $? "senza la chiave si ferma e dice quale riga riempire"
[ "$(Q "select count(*) from pg_trigger where tgname = 'avvisa_nuovo_iscritto'")" = 0 ]; et $? "e non ha creato il trigger"

riempi() { # chiave, indirizzo
  sed -e "/chiave    text := /s|LA-CHIAVE-DI-RESEND|$1|" \
      -e "/indirizzo text := /s|IL-TUO-INDIRIZZO|$2|" supabase/avviso-nuovi-iscritti.sql
}
riempi 're_chiave_di_prova_abcdef123456' 'IL-TUO-INDIRIZZO' > /tmp/avv-mezzo.sql
USCITA=$("${P[@]}" -f /tmp/avv-mezzo.sql 2>&1); ESITO=$?
[ $ESITO -ne 0 ] && echo "$USCITA" | grep -qi "indirizzo"; et $? "senza l'indirizzo si ferma"
riempi 'chiave-sbagliata-senza-prefisso' 'alex@esempio.it' > /tmp/avv-sbagliata.sql
USCITA=$("${P[@]}" -f /tmp/avv-sbagliata.sql 2>&1); ESITO=$?
[ $ESITO -ne 0 ]; et $? "una chiave che non comincia con re_ la rifiuta"
# Alex, 10/10: su Resend nella lista c'e' l'ID della chiave, non la chiave
riempi '4f8a2c1e-9b7d-4e3a-8c6f-1a2b3c4d5e6f' 'alex@esempio.it' > /tmp/avv-sbagliata.sql
USCITA=$("${P[@]}" -f /tmp/avv-sbagliata.sql 2>&1)
echo "$USCITA" | grep -q "comincia con «4f8»" && echo "$USCITA" | grep -q "ID della chiave"; et $? "con l'ID della chiave al posto del valore dice proprio quello"
[ "$(Q "select count(*) from pg_trigger where tgname = 'avvisa_nuovo_iscritto'")" = 0 ]; et $? "e non ha creato il trigger"

echo "== col file riempito =="
CHIAVE='re_chiave_di_prova_abcdef123456'
# incollata con uno spazio davanti e uno dietro, come capita copiando
riempi " $CHIAVE " ' Alex@Esempio.it ' > /tmp/avv-pieno.sql
USCITA=$("${P[@]}" -f /tmp/avv-pieno.sql 2>&1); ESITO=$?
[ $ESITO -eq 0 ]; et $? "si esegue senza errori$([ $ESITO -eq 0 ] || echo ": $(echo "$USCITA" | grep -i error | head -1)")"

ULTIMA="select %s from net.chiamate order by id desc limit 1"
U() { Q "$(printf "$ULTIMA" "$1")"; }
N0=$(Q "select count(*) from net.chiamate")
Q "insert into auth.users (id, email, raw_user_meta_data) values ('11111111-1111-1111-1111-111111111111', 'nuovo@esempio.it', '{\"display_name\":\"<b>Marco</b>\"}')" >/dev/null
[ "$(Q "select count(*) from net.chiamate")" = "$N0" ]; et $? "chi si registra e non conferma non fa partire niente"
Q "update auth.users set email_confirmed_at = now() where id = '11111111-1111-1111-1111-111111111111'" >/dev/null
[ "$(Q "select count(*) from net.chiamate")" = "$((N0+1))" ]; et $? "alla conferma parte un'e-mail"
[ "$(U url)" = "https://api.resend.com/emails" ]; et $? "verso l'API di Resend"
[ "$(U "headers->>'Authorization'")" = "Bearer $CHIAVE" ]; et $? "con la chiave nell'intestazione"
[ "$(U "body->'to'->>0")" = "alex@esempio.it" ]; et $? "all'indirizzo scritto nel file"
U "body->>'subject'" | grep -q "Nuovo iscritto"; et $? "con l'oggetto giusto ($(U "body->>'subject'"))"
U "body->>'html'" | grep -q "&lt;b&gt;Marco"; et $? "e il nome scelto dall'iscritto non diventa HTML"
U "body->>'html'" | grep -q "nuovo@esempio.it"; et $? "e dice l'e-mail dell'iscritto"

Q "update auth.users set email_confirmed_at = now(), last_sign_in_at = now() where id = '11111111-1111-1111-1111-111111111111'" >/dev/null
[ "$(Q "select count(*) from net.chiamate")" = "$((N0+1))" ]; et $? "un secondo aggiornamento non manda un'altra e-mail"
Q "insert into auth.users (email, email_confirmed_at) values ('subito@esempio.it', now())" >/dev/null
[ "$(Q "select count(*) from net.chiamate")" = "$((N0+2))" ]; et $? "un account che nasce gia' confermato fa partire l'avviso"
[ "$(Q "select count(*) from interno.avvisi_iscritti where request_id is not null")" = 2 ]; et $? "le richieste sono segnate nel registro"
Q "select stato from interno.avvisi_iscritti_ultimi limit 1" | grep -q "200"; et $? "e la vista ne mostra la risposta"

echo "== un avviso rotto non blocca un'iscrizione =="
cat > /tmp/avv-rotto.sql <<'SQL'
create or replace function net.http_post(url text, body jsonb default '{}', params jsonb default '{}',
    headers jsonb default '{}', timeout_milliseconds int default 5000)
  returns bigint language plpgsql as $$ begin raise exception 'rete giu'; end $$;
SQL
"${P[@]}" -f /tmp/avv-rotto.sql >/dev/null 2>&1
ESITO=$(Q "insert into auth.users (email, email_confirmed_at) values ('rotto@esempio.it', now()) returning 'creato'" 2>&1)
echo "$ESITO" | grep -q "^creato"; et $? "con Resend irraggiungibile l'account si crea lo stesso ($(echo "$ESITO" | head -1 | cut -c1-40))"

echo "== la chiave non la legge chi non deve =="
for ruolo in anon authenticated service_role; do
  NEG=$(psql -h /tmp -p "$PORTA" -U postgres -d prova -t -A -c "set role $ruolo; select chiave from interno.avviso_iscritti_config" 2>&1)
  echo "$NEG" | grep -qiE "permission denied"; et $? "$ruolo non legge la chiave"
done

echo "== si puo' rilanciare =="
USCITA=$("${P[@]}" -f /tmp/avv-pieno.sql 2>&1); ESITO=$?
[ $ESITO -eq 0 ]; et $? "rieseguito non da' errori$([ $ESITO -eq 0 ] || echo ": $(echo "$USCITA" | grep -i error | head -1)")"
[ "$(Q "select count(*) from pg_trigger where tgname = 'avvisa_nuovo_iscritto'")" = 1 ]; et $? "e il trigger resta uno"

rm -f /tmp/avv-mezzo.sql /tmp/avv-sbagliata.sql /tmp/avv-pieno.sql /tmp/avv-rotto.sql
echo
if [ $ko -eq 0 ]; then verde "tutto a posto ($ok controlli)"; else rosso "$ko problemi su $((ok+ko))"; fi
exit $([ $ko -eq 0 ] && echo 0 || echo 1)
