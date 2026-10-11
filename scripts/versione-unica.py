#!/usr/bin/env python3
"""
Dice se main ha bisogno di una versione nuova del service worker: «si» o «no».

PERCHE'. La versione la alzano in due: l'import automatico (a ogni giro con
dati nuovi) e chi pubblica una modifica all'app. Tutti e due partono dalla
versione di main e aggiungono uno, quindi se si incrociano escono con lo
stesso numero. L'11/10 e' successo due volte in un'ora: la home nuova e
l'import erano entrambi alla 4.2.154, e chi aveva gia' preso quella
dell'import la home nuova non l'avrebbe scaricata mai — il service worker
riscarica l'app solo quando cambia la versione.

Serve una versione nuova quando fra PRIMA e DOPO sono cambiati file
dell'app e la versione non e' salita.

    python3 scripts/versione-unica.py PRIMA DOPO     # due commit di git
"""
import re, subprocess, sys

# Quello che il telefono non scarica: cambiarlo non chiede una versione nuova.
FUORI = ('supabase/', 'scripts/', 'prove/', 'tests/', '.github/', '.claude/', 'data/', 'docs/', 'design/index.html')
RE = re.compile(r"const VERSION = 'fcs-v(\d+)\.(\d+)\.(\d+)'")


def versione(testo):
    m = RE.search(testo or '')
    return tuple(int(x) for x in m.groups()) if m else None


def dell_app(f):
    return not f.startswith(FUORI) and not f.endswith('.md') and f not in ('package.json', 'package-lock.json', 'eslint.config.js')


def serve(prima, dopo, cambiati):
    """prima/dopo: le versioni (tuple); cambiati: i file toccati in mezzo."""
    if not any(dell_app(f) for f in cambiati):
        return False
    return prima is not None and dopo is not None and dopo <= prima


def git(*a):
    return subprocess.run(['git', *a], capture_output=True, text=True, check=True).stdout


def main():
    prima, dopo = sys.argv[1], sys.argv[2]
    cambiati = [f for f in git('diff', '--name-only', prima, dopo).splitlines() if f]
    vp, vd = versione(git('show', f'{prima}:sw.js')), versione(git('show', f'{dopo}:sw.js'))
    si = serve(vp, vd, cambiati)
    print('si' if si else 'no')
    app = [f for f in cambiati if dell_app(f)]
    print(f'versione {vp} -> {vd}, file dell\'app cambiati: {len(app)}' + (f' (es. {app[0]})' if app else ''), file=sys.stderr)
    return 0


if __name__ == '__main__':
    sys.exit(main())
