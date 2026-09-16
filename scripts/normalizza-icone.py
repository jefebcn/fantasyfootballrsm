#!/usr/bin/env python3
"""Porta le icone di un gruppo alla stessa grandezza ottica.

Il difetto sta nei file, non nel CSS: dentro uno stesso gruppo le icone erano
disegnate con inchiostri molto diversi sulla stessa tela, e sullo schermo una
veniva grande il doppio dell'altra. Nella barra in basso il calendario era
disegnato a META' SCALA degli altri — inchiostro 64x62 contro i 112x108 della
coppa — e un artefatto da sette pixel sul bordo destro faceva credere il
contrario a chi misurava il riquadro alpha senza soglia.

Ogni icona viene ritagliata sull'inchiostro vero, riscalata perche' la sua
dimensione ottica (media geometrica di base e altezza) sia la stessa per tutte
quelle del gruppo, e rimessa al centro della tela. Il rapporto fra base e
altezza NON si tocca: un campo resta largo e una coppa resta alta, ma pesano
uguale. E' il modo in cui si normalizza un set di icone: non riquadri identici,
peso identico.

    python3 scripts/normalizza-icone.py            tutti i gruppi
    python3 scripts/normalizza-icone.py menu       solo quello
    python3 scripts/normalizza-icone.py --prova    i numeri, senza scrivere

Rilanciarlo non fa danni: su icone gia' normalizzate i numeri non cambiano.
Gli originali restano comunque nella storia di git.
"""
import sys, math
from pathlib import Path
from PIL import Image
import numpy as np

RADICE = Path(__file__).resolve().parent.parent / 'media' / 'icone'
TELA = 128

# Il lato massimo e' diverso fra i gruppi perche' e' diverso il margine con cui
# sono stati disegnati. Va tenuto fermo: cambiarlo rimescola icone gia' a posto.
#
# `icone` elenca quali toccare. Per la barra in basso e' scritto a mano: nella
# cartella ci sono anche dieci disegni avanzati da un set precedente che non usa
# nessuno (mask() viene chiamata in un punto solo, con questi cinque nomi), e
# ritoccarli sarebbe rumore. Per il menu invece servono tutti.
GRUPPI = {
    'nav':  {'ottica': 100.0, 'max_lato': 112,
             'icone': ['campo', 'maglia-10', 'calendario', 'coppa', 'grafico']},
    'menu': {'ottica': 100.0, 'max_lato': 122, 'icone': None},
}

def riquadro(alpha, soglia=40, minimo=8):
    """Il riquadro dell'inchiostro che si vede davvero.

    `minimo` pixel per riga e per colonna: senza, una traccia sperduta di sette
    pixel sul bordo del calendario allargava la misura da 64 a 112 e faceva
    sembrare l'icona grande il doppio di quello che era.
    """
    m = np.array(alpha) > soglia
    xs = np.where(m.sum(axis=0) >= minimo)[0]
    ys = np.where(m.sum(axis=1) >= minimo)[0]
    if not len(xs) or not len(ys):
        raise ValueError('icona senza inchiostro')
    return int(xs[0]), int(ys[0]), int(xs[-1]) + 1, int(ys[-1]) + 1

def normalizza(percorso, ottica, max_lato, prova):
    im = Image.open(percorso).convert('RGBA')
    x0, y0, x1, y1 = riquadro(im.split()[3])
    ink = im.crop((x0, y0, x1, y1))
    w, h = ink.size
    k = min(ottica / math.sqrt(w * h), max_lato / w, max_lato / h)
    nw, nh = max(1, round(w * k)), max(1, round(h * k))
    # Gia' a posto: non la si tocca. Il ritocco costerebbe una ricampionatura
    # in piu' per niente, e un pixel sfumato che al secondo giro supera la
    # soglia basterebbe a far ripartire il giro all'infinito.
    centrata = (abs(x0 - (TELA - w) // 2) <= 1 and abs(y0 - (TELA - h) // 2) <= 1)
    if abs(k - 1) < 0.005 and (nw, nh) == (w, h) and centrata:
        return (w, h), (nw, nh)
    tela = Image.new('RGBA', (TELA, TELA), (0, 0, 0, 0))
    tela.paste(ink.resize((nw, nh), Image.LANCZOS), ((TELA - nw) // 2, (TELA - nh) // 2))
    if not prova:
        tela.save(percorso)
    return (w, h), (nw, nh)

def main():
    voci = [a for a in sys.argv[1:] if not a.startswith('-')]
    prova = '--prova' in sys.argv
    gruppi = voci or list(GRUPPI)
    for g in gruppi:
        if g not in GRUPPI:
            print(f'gruppo sconosciuto: {g} (ce ne sono {", ".join(GRUPPI)})'); continue
        cfg = GRUPPI[g]
        print(f'\n--- {g} (ottica {cfg["ottica"]:.0f}, lato max {cfg["max_lato"]}) ---')
        print(f'  {"icona":22} {"prima":>11} {"dopo":>11}   scarto')
        esiti = []
        cartella = RADICE / g
        file = ([cartella / f'{n}.png' for n in cfg['icone']] if cfg['icone']
                else sorted(cartella.glob('*.png')))
        for p in file:
            (w, h), (nw, nh) = normalizza(p, cfg['ottica'], cfg['max_lato'], prova)
            o = math.sqrt(nw * nh)
            esiti.append(o)
            print(f'  {p.stem:22} {w:4}x{h:<6} {nw:4}x{nh:<6}   {100*(o/cfg["ottica"]-1):+5.1f}%')
        peggio = max(abs(o / cfg['ottica'] - 1) for o in esiti)
        print(f'  scarto peggiore dal bersaglio: {peggio*100:.1f}%')
    print('\nprova: niente e\' stato scritto.' if prova else '\nscritte.')

if __name__ == '__main__':
    main()
