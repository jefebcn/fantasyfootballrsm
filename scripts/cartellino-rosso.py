#!/usr/bin/env python3
"""Ricava il cartellino rosso da quello giallo, ruotando la tinta.

Nella tavola nuova il rosso diretto non c'e': il disegno etichettato
"Espulsione" e' giallo+rosso, che pero' e' il DOPPIO giallo, e finisce infatti
su espulsione-x2. Il rosso diretto e' un cartellino solo.

Ma un cartellino rosso e' lo stesso oggetto di quello giallo in un altro
colore, quindi non c'e' niente da inventare: si prende il giallo della tavola e
gli si ruota la tinta fino al rosso della tavola stessa — misurato sul
cartellino rosso che nel doppio giallo c'e' gia'. Ombre, riflesso e bordi
sfumati restano quelli, perche' si tocca solo la tinta e si lascia stare
quanto e' chiaro o scuro ogni pixel.

I grigi e i bianchi non si toccano: sotto una certa saturazione la tinta non
vuol dire niente e ruotarla sporcherebbe il riflesso.

    python3 scripts/cartellino-rosso.py
"""
import colorsys
from pathlib import Path
from PIL import Image
import numpy as np

RADICE = Path(__file__).resolve().parent.parent / 'media'
SORGENTI = RADICE / 'icone-sorgenti' / 'eventi'

TINTA_GIALLO, SAT_GIALLO = 0.1072, 0.924   # misurate su espulsione-x2
TINTA_ROSSO, SAT_ROSSO = 0.9675, 0.957

def main():
    src = Image.open(SORGENTI / 'ammonizione.png').convert('RGBA')
    a = np.array(src).astype(float)
    rgb, alpha = a[:, :, :3] / 255, a[:, :, 3]
    giro = (TINTA_ROSSO - TINTA_GIALLO) % 1.0
    fuori = np.zeros_like(rgb)
    for y in range(rgb.shape[0]):
        for x in range(rgb.shape[1]):
            if alpha[y, x] == 0:
                continue
            h, s, v = colorsys.rgb_to_hsv(*rgb[y, x])
            if s > 0.25:                       # solo il colore, non grigi e riflessi
                h = (h + giro) % 1.0
                s = min(1.0, s * (SAT_ROSSO / SAT_GIALLO))
            fuori[y, x] = colorsys.hsv_to_rgb(h, s, v)
    out = np.dstack([np.clip(fuori * 255, 0, 255), alpha]).astype(np.uint8)
    Image.fromarray(out, 'RGBA').save(SORGENTI / 'espulsione.png')
    # anche in uso a piena risoluzione: la rimpicciolisce normalizza-icone.py
    Image.fromarray(out, 'RGBA').save(RADICE / 'icone' / 'eventi' / 'espulsione.png')
    print(f'espulsione.png dal giallo, tinta ruotata di {giro:.4f}  ({src.size[0]}x{src.size[1]})')

if __name__ == '__main__':
    main()
