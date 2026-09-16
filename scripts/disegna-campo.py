#!/usr/bin/env python3
"""Disegna la sagoma del campo per la barra in basso.

Questa e' l'unica icona dell'app disegnata in codice invece che a mano, e c'e'
un motivo. La barra la mostra a 26 punti, cioe' 78 pixel su un iPhone a 3x, e a
quella grandezza un campo da calcio disegnato per bene — perimetro, meta'
campo, cerchio, due aree di rigore, due aree piccole, quattro archi d'angolo,
i dischetti — diventa rumore: il tratto viene sotto i due pixel e si legge come
una velatura grigia invece che come un segno. Le altre quattro sagome della
barra hanno tratti da 3,4 a 6,9 pixel e restano nette.

Qui si tengono tre segni soli — rettangolo, meta' campo, cerchio — con il
tratto calcolato per finire a 3,5 pixel sullo schermo, cioe' come il
calendario. Ingrossare il disegno pieno non bastava: provandolo, a quattro
pixel le aree di rigore si riempiono e il campo diventa una macchia.

Si disegna otto volte piu' grande e si rimpicciolisce: e' il modo di avere i
bordi sfumati puliti senza dover disegnare a mano l'antialiasing.

    python3 scripts/disegna-campo.py [--prova]
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np
from scipy import ndimage as ndi

RADICE = Path(__file__).resolve().parent.parent / 'media' / 'icone'
TELA = 128
SU = 8                      # quanto si disegna piu' grandi

RAPPORTO = 76 / 112         # un campo e' largo circa una volta e mezza l'altezza
LATO_MAX = 120              # lo stesso tetto che usa normalizza-icone.py per la barra
# Il bersaglio e' lo spessore del calendario, la piu' leggera fra le altre
# quattro. Non si puo' fissare il tratto a mano: il righello (mezza larghezza
# mediana sui pixel oltre la soglia) sottostima di circa una volta e mezza,
# perche' i bordi sfumati restano sotto soglia. Quindi si disegna, si misura
# come fa la prova, e si corregge finche' non combacia.
BERSAGLIO = 5.7

def spessore(alfa):
    """Mezza larghezza mediana per due: lo stesso righello della prova."""
    m = np.array(alfa) > 128
    return 2 * np.median(ndi.distance_transform_edt(m)[m]) if m.any() else 0.0


def disegna(largo, tratto):
    LARGO = max(8, round(largo))
    ALTO = max(6, round(largo * RAPPORTO))
    L, A, T = LARGO * SU, ALTO * SU, max(1, round(tratto)) * SU
    im = Image.new('L', (L, A), 0)
    d = ImageDraw.Draw(im)
    mezzo = T // 2
    d.rectangle([mezzo, mezzo, L - 1 - mezzo, A - 1 - mezzo], outline=255, width=T)
    d.line([(L // 2, mezzo), (L // 2, A - 1 - mezzo)], fill=255, width=T)
    r = A // 4
    d.ellipse([L // 2 - r, A // 2 - r, L // 2 + r, A // 2 + r], outline=255, width=T)

    im = im.resize((LARGO, ALTO), Image.LANCZOS)
    tela = Image.new('L', (TELA, TELA), 0)
    tela.paste(im, ((TELA - LARGO) // 2, (TELA - ALTO) // 2))
    return tela


def riquadro(alfa, soglia=40, minimo=8):
    """Lo stesso righello di normalizza-icone.py."""
    m = np.array(alfa) > soglia
    xs = np.where(m.sum(axis=0) >= minimo)[0]
    ys = np.where(m.sum(axis=1) >= minimo)[0]
    return xs[-1] - xs[0] + 1, ys[-1] - ys[0] + 1


def main():
    prova = '--prova' in sys.argv
    # Due cose da far combaciare insieme: lo spessore del tratto e la larghezza
    # dell'inchiostro. Quest'ultima deve arrivare esatta al tetto della barra,
    # se no normalizza-icone.py la riscala e con lei si perde la taratura del
    # tratto, che e' tutto il punto di questo script.
    largo, tratto = LATO_MAX, BERSAGLIO * 1.5
    for _ in range(12):
        tela = disegna(largo, tratto)
        letto = spessore(tela)
        w, h = riquadro(tela)
        if abs(letto - BERSAGLIO) < 0.3 and w == LATO_MAX:
            break
        largo *= LATO_MAX / w
        tratto *= BERSAGLIO / max(letto, 0.5)
    # maschera: la forma sta nell'alfa, il colore lo mette la CSS
    fuori = Image.new('RGBA', (TELA, TELA), (255, 255, 255, 255))
    fuori.putalpha(tela)
    print(f'campo: inchiostro {w}x{h} sulla tela da {TELA}, tratto disegnato {round(tratto)}px, '
          f'misurato {letto:.1f} -> {letto * 78 / TELA:.1f}px sullo schermo (calendario: 3,4)')
    if not prova:
        fuori.save(RADICE / 'nav' / 'campo.png')
        (RADICE.parent / 'icone-sorgenti' / 'nav').mkdir(parents=True, exist_ok=True)
        fuori.save(RADICE.parent / 'icone-sorgenti' / 'nav' / 'campo.png')
        print('scritta.')

if __name__ == '__main__':
    main()
