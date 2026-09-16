#!/usr/bin/env python3
"""Ritaglia media/nuove-icone-lega.jpg nelle quindici icone della pagina Gestione.

Anche questa e' un JPEG su fondo pieno, ma stavolta le icone sono appoggiate
direttamente sul fondo: nelle versioni precedenti ognuna stava dentro una
tessera grigia arrotondata, e la tessera era stampata nei pixel insieme al
disegno. Cinque di queste icone SONO pannelli scuri — la calcolatrice, i
cursori, il campo, la nuvoletta, la coppa — e un pannello scuro su una tessera
scura non si separa: sono lo stesso colore. Senza tessera si separa eccome.

Il fondo non e' piatto: ha una vignettatura, va da 25 agli angoli a 59 al
centro, e il corpo della calcolatrice sta a 60. Una soglia fissa quindi non
basta, e si stima il fondo come superficie: una quadrica ai minimi quadrati,
raffinata tre volte tenendo solo i pixel che le restano vicini. Lo scarto
residuo e' di 3 livelli su 255.

Poi vale la regola di sempre: e' fondo solo quello ATTACCATO AL BORDO. Cosi'
l'interno scuro della calcolatrice, che e' circondato dal suo bordo chiaro,
resta al suo posto invece di sparire.

    python3 scripts/ritaglia-tavola-lega.py [--prova]
"""
import sys
from pathlib import Path
from PIL import Image, ImageFilter
import numpy as np
from scipy import ndimage as ndi

RADICE = Path(__file__).resolve().parent.parent / 'media'
TAVOLA = RADICE / 'nuove-icone-lega.jpg'
USCITA = RADICE / 'icone-sorgenti' / 'lega'
IN_USO = RADICE / 'icone' / 'lega'

GRIGLIA = [
    ['andamento', 'calcola', 'calendario', 'chat', 'classifica'],
    ['impostazioni', 'la-mia-squadra', 'live', 'premi', 'probabili-formazioni'],
    ['rose', 'scambi', 'strumenti', 'supporto', 'trofei'],
]

def bande(v, soglia=1, minimo=14):
    out, inizio = [], None
    for i, x in enumerate(v):
        if x >= soglia and inizio is None:
            inizio = i
        elif x < soglia and inizio is not None:
            if i - 1 - inizio >= minimo:
                out.append((inizio, i - 1))
            inizio = None
    if inizio is not None and len(v) - 1 - inizio >= minimo:
        out.append((inizio, len(v) - 1))
    return out

def superficie(luce, dentro):
    """La quadrica che meglio segue il fondo, sui soli pixel indicati."""
    h, w = luce.shape
    yy, xx = np.mgrid[0:h, 0:w]
    X, Y = xx / w, yy / h
    basi = np.stack([np.ones_like(X), X, Y, X * X, X * Y, Y * Y], axis=-1)
    c, *_ = np.linalg.lstsq(basi[dentro], luce[dentro], rcond=None)
    return basi @ c

def main():
    prova = '--prova' in sys.argv
    im = Image.open(TAVOLA).convert('RGB')
    luce = np.array(im).astype(float).mean(axis=2)

    vicino = luce < 72
    for _ in range(3):
        vicino = luce < superficie(luce, vicino) + 9
    fondo = superficie(luce, vicino)

    grezzo = luce < fondo + 10
    etichette, _ = ndi.label(grezzo)
    ai_bordi = set(etichette[0].tolist()) | set(etichette[-1].tolist()) \
             | set(etichette[:, 0].tolist()) | set(etichette[:, -1].tolist())
    ai_bordi.discard(0)
    # erosione di 1: il bordo sfumato dal JPEG e' meta' disegno e meta' fondo
    pieno = ndi.binary_erosion(~np.isin(etichette, list(ai_bordi)), np.ones((3, 3)))

    # le bande alte sono le icone; titolo ed etichette sono righe basse
    righe = [b for b in bande(pieno.sum(axis=1), 25, 10) if b[1] - b[0] > 60]
    if len(righe) != len(GRIGLIA):
        print(f'attese {len(GRIGLIA)} righe di icone, trovate {len(righe)}: {righe}', file=sys.stderr)
        return 1
    USCITA.mkdir(parents=True, exist_ok=True)
    for (r0, r1), nomi in zip(righe, GRIGLIA):
        colonne = bande(pieno[r0:r1 + 1].sum(axis=0))
        if len(colonne) != len(nomi):
            print(f'riga {r0}-{r1}: attese {len(nomi)} icone, trovate {len(colonne)}', file=sys.stderr)
            return 1
        for (c0, c1), nome in zip(colonne, nomi):
            m = pieno[r0:r1 + 1, c0:c1 + 1]
            ys, xs = np.where(m)
            fuori = im.crop((c0 + xs.min(), r0 + ys.min(), c0 + xs.max() + 1, r0 + ys.max() + 1)).convert('RGBA')
            alfa = Image.fromarray((m[ys.min():ys.max() + 1, xs.min():xs.max() + 1] * 255)
                                   .astype(np.uint8), 'L').filter(ImageFilter.GaussianBlur(0.7))
            fuori.putalpha(alfa)
            print(f'  {nome:22} {fuori.size[0]:3}x{fuori.size[1]}')
            if not prova:
                fuori.save(USCITA / f'{nome}.png')
                fuori.save(IN_USO / f'{nome}.png')
    print('\nprova: niente e\' stato scritto.' if prova else '\nscritte.')
    return 0

if __name__ == '__main__':
    sys.exit(main())
