#!/usr/bin/env python3
"""Porta le icone della barra in basso alla stessa grandezza ottica.

Erano disegnate tutte larghe uguale (112px su una tela da 128) ma alte da 62 a
108: sullo schermo il calendario veniva alto 11,6pt e la coppa 20,2. Peggio, il
calendario era disegnato a meta' scala degli altri — inchiostro 64x62 — e un
artefatto da sette pixel sul bordo destro faceva credere il contrario a chi
misurava il riquadro alpha senza soglia.

Qui ogni icona viene ritagliata sull'inchiostro vero, riscalata perche' la sua
dimensione ottica (media geometrica di base e altezza) sia la stessa per tutte,
e rimessa al centro della tela. Il rapporto fra base e altezza non si tocca:
un campo resta largo e una coppa resta alta, ma pesano uguale.

    python3 scripts/normalizza-icone-nav.py [--prova]
"""
import sys, math
from pathlib import Path
from PIL import Image
import numpy as np

CARTELLA = Path(__file__).resolve().parent.parent / 'media' / 'icone' / 'nav'
NAV = ['campo', 'maglia-10', 'calendario', 'coppa', 'grafico']
TELA = 128          # le icone stanno su una tela quadrata
OTTICA = 100.0      # dimensione ottica voluta, in pixel di tela
MAX_LATO = 112      # nessun lato puo' superare questo: resta un margine di 8

def riquadro(alpha, soglia=40, minimo=8):
    """Il riquadro dell'inchiostro che si vede davvero.

    `minimo` pixel per riga e per colonna: senza, una traccia sperduta di sette
    pixel sul bordo del calendario allargava la misura da 64 a 112 e faceva
    sembrare l'icona grande il doppio di quello che e'.
    """
    m = np.array(alpha) > soglia
    xs = np.where(m.sum(axis=0) >= minimo)[0]
    ys = np.where(m.sum(axis=1) >= minimo)[0]
    if not len(xs) or not len(ys):
        raise ValueError('icona vuota')
    return int(xs[0]), int(ys[0]), int(xs[-1]) + 1, int(ys[-1]) + 1

def normalizza(percorso, prova=False):
    im = Image.open(percorso).convert('RGBA')
    x0, y0, x1, y1 = riquadro(im.split()[3])
    ink = im.crop((x0, y0, x1, y1))
    w, h = ink.size
    k = OTTICA / math.sqrt(w * h)
    k = min(k, MAX_LATO / w, MAX_LATO / h)      # niente deve sbordare
    nw, nh = max(1, round(w * k)), max(1, round(h * k))
    fuori = Image.new('RGBA', (TELA, TELA), (0, 0, 0, 0))
    fuori.paste(ink.resize((nw, nh), Image.LANCZOS), ((TELA - nw) // 2, (TELA - nh) // 2))
    if not prova:
        fuori.save(percorso)
    return (w, h), (nw, nh)

def main():
    prova = '--prova' in sys.argv
    print(f"{'icona':13} {'prima':>11} {'dopo':>11}   resa a 26pt")
    for n in NAV:
        p = CARTELLA / f'{n}.png'
        (w, h), (nw, nh) = normalizza(p, prova)
        s = 26 / TELA
        print(f'{n:13} {w:4}x{h:<6} {nw:4}x{nh:<6}   {nw*s:4.1f} x {nh*s:4.1f}')
    print('\nprova: niente e\' stato scritto' if prova else '\nscritte.')

if __name__ == '__main__':
    main()
