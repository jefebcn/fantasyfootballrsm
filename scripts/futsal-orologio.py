#!/usr/bin/env python3
"""
Quanto ci mette la FSGC a pubblicare un referto di futsal.

Ogni volta che gira guarda le partite di una giornata e scrive in
data/futsal-orologio.json solo quello che è cambiato dall'ultima volta:
stato (In programma / In corso / Concluso), risultato, quanti giocatori in
distinta e quanti gol fra gli eventi. Da lì si legge, partita per partita:

  - quanto dopo il calcio d'inizio la pagina dice «Concluso»;
  - quanto dopo il referto è completo (distinte e gol che tornano col risultato).

È quello che decide quando far girare l'importazione e quando dire agli
iscritti che i voti ci sono.

    python3 scripts/futsal-orologio.py 7          # un giro sulla 7ª
    python3 scripts/futsal-orologio.py 7 --riepilogo
"""
import json, sys, time, pathlib, importlib.util
from datetime import datetime, timezone

RADICE = pathlib.Path(__file__).resolve().parent.parent
FILE = RADICE / 'data' / 'futsal-orologio.json'

_spec = importlib.util.spec_from_file_location('futsal', RADICE / 'scripts' / 'importa-futsal.py')
fut = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(fut)


def ora_iso():
    return datetime.now(timezone.utc).isoformat(timespec='seconds')


def giro(n):
    log = json.loads(FILE.read_text(encoding='utf-8')) if FILE.exists() else {}
    cal = [p for p in fut.calendario() if p['g'] == n and p['url']]
    adesso = time.time()
    for p in cal:
        k = f"{p['g']}:{p['casa']}:{p['ospite']}"
        voce = log.setdefault(k, {'inizio': p['quando'], 'url': p['url'], 'osservazioni': []})
        # prima del calcio d'inizio non c'e' niente da guardare
        if p['quando'] and datetime.fromisoformat(p['quando']).timestamp() > adesso + 600:
            continue
        try:
            t = fut.tabellino(p['url'], (p['casa'], p['ospite']))
        except Exception as e:  # una pagina che non risponde si riprova al giro dopo
            print(f'  {k}: errore {e}', file=sys.stderr)
            continue
        gol = sum(1 for e in t['eventi'] if e[2] in ('goal', 'own_goal'))
        stato = {'stato': t['stato'], 'risultato': None if p['gc'] is None else f"{p['gc']}-{p['go']}",
                 'distinte': [len(t['distinte'][0]), len(t['distinte'][1])], 'gol_eventi': gol,
                 'eventi': len(t['eventi'])}
        ultimo = voce['osservazioni'][-1] if voce['osservazioni'] else None
        if not ultimo or any(ultimo.get(c) != v for c, v in stato.items()):
            voce['osservazioni'].append({'quando': ora_iso(), **stato})
            print(f"  {k}: {stato}")
        voce['ultimo_controllo'] = ora_iso()
        time.sleep(fut.PAUSA)
    FILE.write_text(json.dumps(log, ensure_ascii=False, indent=1), encoding='utf-8')


def completo(o):
    if o['stato'] != 'finished' or not o['risultato']:
        return False
    a, b = map(int, o['risultato'].split('-'))
    return o['gol_eventi'] == a + b and min(o['distinte']) > 0


def riepilogo(n):
    log = json.loads(FILE.read_text(encoding='utf-8')) if FILE.exists() else {}
    minuti = lambda a, b: round((datetime.fromisoformat(b) - datetime.fromisoformat(a)).total_seconds() / 60)
    for k, v in sorted(log.items()):
        if not k.startswith(f'{n}:'):
            continue
        fin = next((o for o in v['osservazioni'] if o['stato'] == 'finished'), None)
        ok = next((o for o in v['osservazioni'] if completo(o)), None)
        print(f"{k:32} inizio {v['inizio'][11:16]}  "
              f"concluso {'+%d min' % minuti(v['inizio'], fin['quando']) if fin else '—':>10}  "
              f"referto completo {'+%d min' % minuti(v['inizio'], ok['quando']) if ok else '—':>10}  "
              f"(ultimo controllo {v.get('ultimo_controllo', '—')[5:16]})")


if __name__ == '__main__':
    n = int(sys.argv[1])
    riepilogo(n) if '--riepilogo' in sys.argv else giro(n)
