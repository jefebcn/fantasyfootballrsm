#!/usr/bin/env python3
"""
Da media/magliahome.jfif ricava la base ricolorabile della maglia.

La foto è verde oliva: usata così sarebbe uguale per tutte le squadre. Qui si
tiene solo la FORMA (canale alfa) e la LUCE (grigi): il colore lo mette poi il
browser, fondendo la tinta della squadra sotto i grigi. Così la maglia resta
fotografica ma cambia colore davvero.

    python3 scripts/make-maglia.py
"""
import pathlib
from collections import deque
from PIL import Image, ImageFilter

RADICE = pathlib.Path(__file__).resolve().parent.parent
SORGENTE = RADICE / 'media' / 'magliahome.jfif'
USCITA = RADICE / 'media' / 'maglia-base.webp'
LARGA = 560           # basta per il doppio della misura a schermo
FONDO = 232           # oltre questo il pixel è "bianco di studio"
# I grigi non scendono a zero: su una tinta scura il nero pieno mangerebbe il
# colore e la maglia sembrerebbe una macchia.
MIN, MAX = 0.30, 1.0


def ritaglia_fondo(im):
    """Alfa per riempimento dai bordi: il bianco DENTRO la maglia resta."""
    w, h = im.size
    px = im.load()
    fuori = bytearray(w * h)
    coda = deque()
    for x in range(w):
        for y in (0, h - 1):
            coda.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            coda.append((x, y))
    while coda:
        x, y = coda.pop()
        i = y * w + x
        if fuori[i]:
            continue
        r, g, b = px[x, y][:3]
        if r < FONDO or g < FONDO or b < FONDO:
            continue
        fuori[i] = 1
        if x > 0: coda.append((x - 1, y))
        if x < w - 1: coda.append((x + 1, y))
        if y > 0: coda.append((x, y - 1))
        if y < h - 1: coda.append((x, y + 1))
    alfa = Image.frombytes('L', (w, h), bytes(255 if not v else 0 for v in fuori))
    # Un filo di sfocatura toglie la scalettatura del riempimento.
    return alfa.filter(ImageFilter.GaussianBlur(0.8)).point(lambda v: 0 if v < 110 else 255)


def main():
    im = Image.open(SORGENTE).convert('RGB')
    alfa = ritaglia_fondo(im)

    box = alfa.getbbox()
    im, alfa = im.crop(box), alfa.crop(box)
    alt = round(im.height * LARGA / im.width)
    im = im.resize((LARGA, alt), Image.LANCZOS)
    alfa = alfa.resize((LARGA, alt), Image.LANCZOS)

    # Luce della foto, riportata in una fascia che lascia respirare la tinta.
    luce = im.convert('L')
    lo, hi = luce.getextrema()
    scala = (hi - lo) or 1
    luce = luce.point(lambda v: round(255 * (MIN + (MAX - MIN) * (v - lo) / scala)))

    fuori = Image.merge('RGBA', (luce, luce, luce, alfa))
    # WebP invece di PNG: 30 KB contro 236, e la copertina si apre subito.
    fuori.save(USCITA, quality=88, method=6)
    print(f'{USCITA.relative_to(RADICE)} · {fuori.size[0]}x{fuori.size[1]} · '
          f'{USCITA.stat().st_size // 1024} KB')


if __name__ == '__main__':
    main()
