#!/usr/bin/env python3
"""
I gol in diretta: guarda le partite in corso sul sito della FSGC e, a ogni gol
nuovo, fa la sua storia (scripts/storie-gol.mjs).

La FSGC aggiorna la pagina della partita mentre si gioca: punteggio, marcatore
e minuto ci sono gia' durante la gara (verificato il 24/10 su Murata-Domagnano
e Fiorentino-Cailungo); i cambi arrivano dopo il fischio. Qui si legge la pagina
ogni minuto con gli stessi strumenti dell'import (scripts/importa-fsgc.py).

Con --pubblica ogni storia passa a scripts/pubblica-storia.mjs, che la mette
su Instagram solo se la variabile STORIE_GOL e' «on» (altrimenti e' una prova).
Con --dati-db i dati del database (aderenti, possesso) si rileggono ogni mezz'ora.

    python3 scripts/gol-in-diretta.py --dati db.json --uscita /tmp/gol
    python3 scripts/gol-in-diretta.py --dati-db --pubblica --per 19000    (su GitHub)

Righe che scrive: STORIA, PUBBLICATA/PROVA/GIA' FATTA/TETTO (dalla
pubblicazione), ANNULLATO (un gol sparito dalla pagina), ATTESA (punteggio
cambiato ma marcatore non ancora scritto), ERRORE, FINE.
"""
import argparse, importlib.util, json, pathlib, subprocess, sys, time
from datetime import datetime

RADICE = pathlib.Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('fsgc', RADICE / 'scripts' / 'importa-fsgc.py')
fsgc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fsgc)

# Dieci minuti prima del calcio d'inizio, fino a tre ore e mezza dopo. Tre e
# mezza e non due e mezza: l'orario della FSGC porta il fuso scritto a mano
# (+02:00 anche dopo il ritorno all'ora solare, 25/10), e un'ora di scarto
# lascerebbe scoperto il secondo tempo.
PRIMA = 10 * 60
DOPO = 210 * 60


def dice(*a):
    print(*a, flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--uscita', default=str(RADICE / 'social' / 'gol' / 'diretta'))
    ap.add_argument('--dati', default=None)
    ap.add_argument('--ogni', type=int, default=60)
    ap.add_argument('--anche-vecchi', action='store_true', help='fa la storia anche dei gol gia\' segnati alla partenza')
    ap.add_argument('--dati-db', action='store_true', help='rilegge aderenti e possesso dal database (scripts/dati-storie.mjs)')
    ap.add_argument('--pubblica', action='store_true')
    ap.add_argument('--per', type=int, default=0, help='secondi, poi esce: su GitHub il turno dopo prende il posto')
    a = ap.parse_args()
    avvio = time.time()
    letti_db = 0
    uscita = pathlib.Path(a.uscita)
    uscita.mkdir(parents=True, exist_ok=True)
    stato_f = uscita / 'stato.json'
    stato = json.loads(stato_f.read_text()) if stato_f.exists() else {'visti': {}, 'n': 0, 'attese': []}
    idx = fsgc.indice_giocatori()
    primo = True
    while True:
        ora = time.time()
        if a.per and ora - avvio > a.per:
            dice('FINE turno finito')
            break
        if a.dati_db and ora - letti_db > 1800:
            a.dati = str(uscita / 'dati.json')
            subprocess.run(['node', str(RADICE / 'scripts' / 'dati-storie.mjs'), a.dati])
            letti_db = ora
        try:
            cal = fsgc.calendario()
        except Exception as e:
            dice('ERRORE calendario FSGC:', e)
            time.sleep(a.ogni)
            continue
        quando = lambda c: datetime.fromisoformat(c['quando']).timestamp()
        oggi = [c for c in cal if c['url'] and c['quando'] and abs(quando(c) - ora) < 12 * 3600]
        vive = [c for c in oggi if quando(c) - PRIMA <= ora <= quando(c) + DOPO]
        if not vive and all(ora > quando(c) + DOPO for c in oggi):
            dice('FINE nessuna partita in corso o in arrivo')
            break
        for c in vive:
            chiave = f"{c['g']}-{c['casa']}-{c['ospite']}"
            try:
                t = fsgc.tabellino(c['url'], idx, (c['casa'], c['ospite']))
            except Exception as e:
                dice('ERRORE', chiave, e)
                continue
            ref = {'g': c['g'], 'casa': c['casa'], 'ospite': c['ospite'], 'arbitro': t.get('arbitro'),
                   'titolari': t.get('titolari'), 'eventi': t['eventi'], 'cambi': t.get('cambi', [])}
            gol = [f"{chiave}-{m}-{pid}" for pid, m, tipo in t['eventi'] if tipo in ('goal', 'own_goal')]
            visti = stato['visti'].setdefault(chiave, [])
            for v in [v for v in visti if v not in gol]:
                dice('ANNULLATO', v)
                visti.remove(v)
            nuovi = [x for x in gol if x not in visti]
            if primo and not a.anche_vecchi:
                visti.extend(nuovi)
                nuovi = []
            segnati = (c['gc'] or 0) + (c['go'] or 0)
            if segnati > len(gol) and f"{chiave}-{segnati}" not in stato['attese']:
                stato['attese'].append(f"{chiave}-{segnati}")
                dice('ATTESA', chiave, f"{c['gc']}-{c['go']}", 'marcatore non ancora scritto')
            if nuovi:
                f = uscita / f'{chiave}.json'
                f.write_text(json.dumps(ref, ensure_ascii=False))
                cmd = ['node', str(RADICE / 'scripts' / 'storie-gol.mjs'), '--referto', str(f), '--solo', ','.join(nuovi),
                       '--n', str(stato['n']), '--uscita', str(uscita)] + (['--dati', a.dati] if a.dati else [])
                r = subprocess.run(cmd, capture_output=True, text=True)
                for riga in r.stdout.splitlines():
                    if not riga.startswith('STORIA'):
                        continue
                    dice(riga)
                    if a.pubblica:
                        jpg = pathlib.Path(riga.split()[1])
                        p = subprocess.run(['node', str(RADICE / 'scripts' / 'pubblica-storia.mjs'), str(jpg), jpg.stem],
                                           capture_output=True, text=True)
                        dice((p.stdout.strip() or p.stderr.strip()[-300:] or 'ERRORE pubblicazione senza risposta'))
                if r.returncode:
                    dice('ERRORE storia', chiave, r.stderr.strip()[-300:])
                else:
                    visti.extend(nuovi)
                    stato['n'] += len(nuovi)
        stato_f.write_text(json.dumps(stato))
        primo = False
        time.sleep(a.ogni)


if __name__ == '__main__':
    main()
