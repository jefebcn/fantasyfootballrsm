#!/usr/bin/env python3
"""Trasforma media/nuova-aggiorna.jpg nella maschera dell'icona Aggiorna.

E' un disegno nero su bianco, quindi diventa una maschera senza fatica: la
trasparenza esce dal nero, e il colore glielo mette la CSS come alle sagome
della barra in basso. Sulla testata sono bianche su blu, e domani potrebbero
essere di un altro colore senza toccare il file.

    python3 scripts/ritaglia-aggiorna.py [--prova]
"""
import sys
from pathlib import Path
from PIL import Image
import numpy as np

RADICE = Path(__file__).resolve().parent.parent / 'media'

def main():
    prova = '--prova' in sys.argv
    a = np.array(Image.open(RADICE / 'nuova-aggiorna.jpg').convert('L')).astype(float)
    # nero pieno = opaco, bianco = trasparente, con la sfumatura in mezzo
    alfa = np.clip((205 - a) / 90, 0, 1)
    vivo = alfa > 0.15
    ys, xs = np.where(vivo)
    ritaglio = alfa[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    im = Image.fromarray((ritaglio * 255).astype(np.uint8), 'L')
    fuori = Image.new('RGBA', im.size, (255, 255, 255, 255))
    fuori.putalpha(im)
    print(f'aggiorna: inchiostro {fuori.size[0]}x{fuori.size[1]}')
    if not prova:
        for cartella in ('icone-sorgenti', 'icone'):
            (RADICE / cartella / 'nav').mkdir(parents=True, exist_ok=True)
            fuori.save(RADICE / cartella / 'nav' / 'aggiorna.png')
        print('scritta.')

if __name__ == '__main__':
    main()
