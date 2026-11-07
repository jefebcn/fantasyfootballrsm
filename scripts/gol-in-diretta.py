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

Con --avvisa ogni gol nuovo (non gli autogol) diventa anche una notifica per
chi ha il marcatore fra i titolari (052, Alex 04/11).

Righe che scrive: STORIA, AVVISO, PUBBLICATA/PROVA/GIA' FATTA/TETTO (dalla
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


def avvisa_gol(tag, giocatore, giornata, minuto):
    """La notifica «Gol di X!» a chi ha il marcatore fra i titolari della
    giornata (052). La spedisce la funzione del promemoria, che chiede al
    database chi avvisare e segna l'avviso: lo stesso gol non parte due volte
    neanche se il turno riparte. Senza URL o token non fa niente e lo dice."""
    import os, urllib.request
    url = ''.join(os.environ.get('SUPABASE_FUNCTIONS_URL', '').split()).rstrip('/')
    token = ''.join(os.environ.get('PROMEMORIA_TOKEN', '').split())
    nome = ''.join(os.environ.get('PROMEMORIA_FUNZIONE', '').split()) or 'promemoria'
    if not url or not token:
        return f'AVVISO saltato {tag}: SUPABASE_FUNCTIONS_URL o PROMEMORIA_TOKEN mancanti'
    corpo = json.dumps({'tipo': 'gol', 'tag': tag, 'giocatore': giocatore, 'giornata': giornata, 'minuto': minuto}).encode()
    req = urllib.request.Request(f'{url}/{nome}', data=corpo, method='POST',
                                 headers={'x-promemoria-token': token, 'content-type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return f'AVVISO {tag} {r.status} {r.read().decode()[:200]}'
    except Exception as e:
        return f'AVVISO ERRORE {tag}: {e}'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--uscita', default=str(RADICE / 'social' / 'gol' / 'diretta'))
    ap.add_argument('--dati', default=None)
    ap.add_argument('--ogni', type=int, default=60)
    ap.add_argument('--anche-vecchi', action='store_true', help='fa la storia anche dei gol gia\' segnati alla partenza')
    ap.add_argument('--dati-db', action='store_true', help='rilegge aderenti e possesso dal database (scripts/dati-storie.mjs)')
    ap.add_argument('--pubblica', action='store_true')
    ap.add_argument('--avvisa', action='store_true', help='notifica il gol a chi ha il marcatore fra i titolari (052)')
    ap.add_argument('--per', type=int, default=0, help='secondi, poi esce: su GitHub il turno dopo prende il posto')
    ap.add_argument('--foto', action='store_true', help='storie con la foto FSGC del marcatore o della squadra (scripts/foto_gol.py)')
    a = ap.parse_args()
    avvio = time.time()
    letti_db = 0
    uscita = pathlib.Path(a.uscita)
    uscita.mkdir(parents=True, exist_ok=True)
    stato_f = uscita / 'stato.json'
    stato = json.loads(stato_f.read_text()) if stato_f.exists() else {'visti': {}, 'n': 0, 'attese': []}
    idx = fsgc.indice_giocatori()
    # Le foto (Alex, 7/11): quelle scelte a mano in social/gol/foto-giocatori.json
    # e foto-squadre.json. Se qualcosa va storto si va avanti con la grafica di
    # prima: una storia senza foto e' meglio di nessuna storia.
    FG, giocatori, articoli = None, {}, []
    if a.foto:
        try:
            spec_f = importlib.util.spec_from_file_location('foto_gol', RADICE / 'scripts' / 'foto_gol.py')
            FG = importlib.util.module_from_spec(spec_f); spec_f.loader.exec_module(FG)
            giocatori = FG.giocatori()
        except Exception as e:
            dice('ERRORE foto:', e); FG = None
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
            # CHI e' un gol: l'n-esimo della sua squadra in quella partita. Non
            # il minuto ne' il marcatore: la FSGC li corregge a partita in
            # corso (24/10, Murata-Domagnano: il 2-1 scritto al 68', poi al 67')
            # e con loro nella chiave la correzione sembrava un gol nuovo, con
            # una seconda storia. Il minuto e il marcatore restano nella storia.
            gol, conta, dettagli = {}, {}, {}
            for m, pid, tipo in sorted((m, pid, tipo) for pid, m, tipo in t['eventi'] if tipo in ('goal', 'own_goal')):
                suo = pid.rsplit('_', 1)[0]
                sq = suo if tipo == 'goal' else (c['ospite'] if suo == c['casa'] else c['casa'])
                conta[sq] = conta.get(sq, 0) + 1
                gol[f"{chiave}-{sq}-{conta[sq]}"] = f"{chiave}-{m}-{pid}"
                dettagli[f"{chiave}-{sq}-{conta[sq]}"] = (pid, m, tipo)
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
            if nuovi and a.avvisa:
                for x in nuovi:
                    pid, m, tipo = dettagli[x]
                    if tipo == 'goal':      # l'autogol no: non si festeggia un malus
                        dice(avvisa_gol(x, pid, c['g'], m))
            if nuovi:
                f = uscita / f'{chiave}.json'
                f.write_text(json.dumps(ref, ensure_ascii=False))
                chi = {gol[x]: x for x in nuovi}      # id della storia -> chiave stabile
                cmd = ['node', str(RADICE / 'scripts' / 'storie-gol.mjs'), '--referto', str(f), '--solo', ','.join(chi),
                       '--n', str(stato['n']), '--uscita', str(uscita)] + (['--dati', a.dati] if a.dati else [])
                if FG:
                    mappa = {}
                    for x in nuovi:
                        pid, m, tipo = dettagli[x]
                        sq = x.split('-')[-2]          # la squadra che ha segnato (l'autogol vale per l'altra)
                        try:
                            sc = FG.foto_per(pid, articoli, giocatori) if tipo == 'goal' else FG.foto_squadra(sq, articoli, giocatori)
                            if sc:
                                mappa[gol[x]] = {'file': FG.scarica(sc, uscita), 'credito': sc['credito'],
                                                 'centro': sc.get('centro', 0.5), 'tipo': sc['tipo']}
                        except Exception as e:
                            dice('ERRORE foto', x, e)
                    if mappa:
                        mf = uscita / f'{chiave}-foto.json'
                        mf.write_text(json.dumps(mappa, ensure_ascii=False))
                        cmd += ['--foto-map', str(mf)]
                r = subprocess.run(cmd, capture_output=True, text=True)
                for riga in r.stdout.splitlines():
                    if not riga.startswith('STORIA'):
                        continue
                    dice(riga)
                    if a.pubblica:
                        jpg = pathlib.Path(riga.split()[1])
                        p = subprocess.run(['node', str(RADICE / 'scripts' / 'pubblica-storia.mjs'), str(jpg), chi.get(jpg.stem, jpg.stem)],
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
