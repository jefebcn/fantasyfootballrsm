#!/usr/bin/env python3
"""
Alza di uno l'ultimo numero della versione del service worker.

Perche' serve: la cache e' stale-while-revalidate, cioe' serve prima quello che
ha e poi aggiorna. Senza cambiare VERSION, chi ha l'app installata vedrebbe i
dati della settimana prima al primo avvio e quelli nuovi solo al secondo. Con
una versione nuova la shell viene riscaricata subito, e src/video-dati.js sta
proprio nell'elenco di precache.

    python3 scripts/bump-sw.py          # fcs-v4.2.0 -> fcs-v4.2.1
    python3 scripts/bump-sw.py --dry    # dice cosa farebbe e non tocca niente
"""
import pathlib, re, sys

SW = pathlib.Path(__file__).resolve().parent.parent / 'sw.js'
RE = re.compile(r"(const VERSION = 'fcs-v)(\d+)\.(\d+)\.(\d+)(';)")


def main():
    testo = SW.read_text(encoding='utf-8')
    m = RE.search(testo)
    if not m:
        print('versione non trovata in sw.js: la riga attesa e\' '
              "\"const VERSION = 'fcs-vX.Y.Z';\"", file=sys.stderr)
        return 1
    vecchia = f'{m.group(2)}.{m.group(3)}.{m.group(4)}'
    nuova = f'{m.group(2)}.{m.group(3)}.{int(m.group(4)) + 1}'
    print(f'fcs-v{vecchia} -> fcs-v{nuova}')
    if '--dry' in sys.argv:
        return 0
    SW.write_text(RE.sub(lambda x: f'{x.group(1)}{nuova}{x.group(5)}', testo, count=1), encoding='utf-8')
    return 0


if __name__ == '__main__':
    sys.exit(main())
