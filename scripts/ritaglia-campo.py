#!/usr/bin/env python3
"""Ritaglia la sagoma del campo da media/nuova-campo.jpg.

Il campo e' l'icona piu' difficile della barra: a 26 punti, cioe' 78 pixel su
un iPhone a 3x, un campo disegnato a linee sottili ha il tratto sotto i due
pixel e si legge come una velatura grigia invece che come un segno. Le altre
quattro sagome stanno fra 3,4 e 6,9 pixel.

La soluzione e' un campo PIENO con le marcature incise dentro. Funziona per un
motivo che non e' ovvio: queste sono MASCHERE, l'app ci mette il colore via
CSS, e conta solo la forma. Le righe incise sono oro piu' scuro, quindi il
ritaglio le lascia fuori e nella maschera diventano BUCHI. Il risultato non e'
un rettangolo cieco: e' un campo con perimetro, meta' campo, cerchio, aree di
rigore e archi d'angolo, tutti alla larghezza giusta perche' sono lo spazio fra
due masse piene invece che un tratto sottile.

Da qui viene anche il vincolo: l'originale deve essere l'oro su fondo scuro,
non un PNG gia' trasparente. In un PNG l'incisione sarebbe colore e non alfa, e
la maschera verrebbe fuori come un blocco pieno senza marcature.

    python3 scripts/ritaglia-campo.py [--prova]
"""
import sys
from pathlib import Path
from PIL import Image, ImageFilter
import numpy as np
from scipy import ndimage as ndi

RADICE = Path(__file__).resolve().parent.parent / 'media'
TAVOLA = RADICE / 'nuova-campo.jpg'

def main():
    prova = '--prova' in sys.argv
    a = np.array(Image.open(TAVOLA).convert('RGB')).astype(float)
    luce, colore = a.mean(axis=2), a.max(axis=2) - a.min(axis=2)
    # l'oro e' chiaro E caldo; il fondo e' scuro, le incisioni sono oro spento
    oro = ndi.binary_opening((luce > 80) & (colore > 25), np.ones((3, 3)))

    def bande(v, soglia, minimo):
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

    righe = [b for b in bande(oro.sum(axis=1), 20, 10) if b[1] - b[0] > 90]
    if not righe:
        print('nessuna riga di icone trovata', file=sys.stderr)
        return 1
    r0, r1 = righe[0]
    c0, c1 = bande(oro[r0:r1 + 1].sum(axis=0), 1, 40)[0]   # la prima e' il campo
    m = oro[r0:r1 + 1, c0:c1 + 1]
    ys, xs = np.where(m)
    ritaglio = m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    alfa = Image.fromarray((ritaglio * 255).astype(np.uint8), 'L').filter(ImageFilter.GaussianBlur(0.6))
    fuori = Image.new('RGBA', alfa.size, (255, 255, 255, 255))
    fuori.putalpha(alfa)
    print(f'campo {fuori.size[0]}x{fuori.size[1]}, inchiostro al {100 * ritaglio.mean():.0f}% del riquadro')
    if not prova:
        (RADICE / 'icone-sorgenti' / 'nav').mkdir(parents=True, exist_ok=True)
        fuori.save(RADICE / 'icone-sorgenti' / 'nav' / 'campo.png')
        fuori.save(RADICE / 'icone' / 'nav' / 'campo.png')
        print('scritta.')
    return 0

if __name__ == '__main__':
    sys.exit(main())
