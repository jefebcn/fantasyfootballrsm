#!/usr/bin/env python3
"""Ritaglia i personaggi dalle tavole media/avatar/calciatoriN.png.

Ogni tavola porta quattro caricature su un campo verde. Lo sfondo si toglie dal
colore — il verde e' l'unica cosa in cui il canale verde domina gli altri due —
ma non basta: le righe bianche del campo sono dello stesso bianco delle maglie,
e passano dietro ai personaggi collegandoli fra loro. Ricostruire il disegno
seguendo i pixel attaccati li unirebbe tutti e quattro in un blocco solo.

Quindi: un'apertura morfologica cancella le righe, che sono sottili, e lascia in
piedi i personaggi, che sono masse. Da quei nuclei si torna indietro con una
dilatazione CONTENUTA, quanto basta a recuperare dita e tacchetti senza
riagganciare una riga che passa vicino.

I vuoti verdi dentro la sagoma — fra braccio e corpo, fra le gambe — restano
trasparenti. Riempirli sembra piu' pulito e invece lascia macchie verdi.

I numeri partono da 101 e non riusano quelli dei personaggi vecchi: chi aveva
scelto il 7 per la sua squadra deve continuare a vedere il 7, non qualcun altro.

    python3 scripts/ritaglia-calciatori.py [--prova]
"""
import sys
from pathlib import Path
from PIL import Image, ImageFilter
import numpy as np
from scipy import ndimage as ndi

RADICE = Path(__file__).resolve().parent.parent / 'media' / 'avatar'
PRIMO = 101          # da dove parte la numerazione dei nuovi
LATO_MAX = 900       # i webp finali: piu' di cosi' non serve, si vedono a 150px

def personaggi(tavola):
    """Le maschere dei quattro personaggi, da sinistra a destra."""
    a = np.array(Image.open(tavola).convert('RGB')).astype(int)
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    non_verde = ~((g > r + 25) & (g > b + 25))
    nuclei = ndi.binary_opening(non_verde, np.ones((25, 25)))
    lab, quanti = ndi.label(nuclei)
    dim = ndi.sum(nuclei, lab, range(1, quanti + 1))
    scelti = [i + 1 for i, s in enumerate(dim) if s > 20000]
    scelti.sort(key=lambda i: np.where(lab == i)[1].min())
    for i in scelti:
        nucleo = lab == i
        m = ndi.binary_dilation(nucleo, np.ones((15, 15))) & non_verde
        pezzi, _ = ndi.label(m)
        yield m & (pezzi == pezzi[np.where(nucleo)][0])

def main():
    prova = '--prova' in sys.argv
    n = PRIMO
    for tavola in sorted(RADICE.glob('calciatori*.png')):
        im = Image.open(tavola).convert('RGB')
        for m in personaggi(tavola):
            ys, xs = np.where(m)
            fuori = im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)).convert('RGBA')
            alfa = Image.fromarray((m[ys.min():ys.max() + 1, xs.min():xs.max() + 1] * 255)
                                   .astype(np.uint8), 'L').filter(ImageFilter.GaussianBlur(0.8))
            fuori.putalpha(alfa)
            fuori.thumbnail((LATO_MAX, LATO_MAX), Image.LANCZOS)
            print(f'  {n}.webp  {fuori.size[0]}x{fuori.size[1]}  da {tavola.name}')
            if not prova:
                fuori.save(RADICE / f'{n}.webp', quality=88, method=6)
            n += 1
    print(f'\n{n - PRIMO} personaggi, numerati da {PRIMO} a {n - 1}.'
          + ('  prova: niente e\' stato scritto.' if prova else ''))

if __name__ == '__main__':
    main()
