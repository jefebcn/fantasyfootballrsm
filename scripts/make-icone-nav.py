#!/usr/bin/env python3
"""
Ritaglia media/iconenav.jpg in maschere singole per la barra di navigazione.

Queste icone sono sagome scure su bianco, non disegni a colori: si salvano
come MASCHERE (forma opaca, sfondo trasparente) invece che come immagini.
Così il colore lo decide la CSS con currentColor, e la voce attiva può
diventare blu mentre le altre restano grigie — che è l'unica cosa che la
barra in basso deve saper dire.

    python3 scripts/make-icone-nav.py
"""
import pathlib
from PIL import Image

RADICE = pathlib.Path(__file__).resolve().parent.parent
SORGENTE = RADICE / 'media' / 'iconenav.jpg'
USCITA = RADICE / 'media' / 'icone' / 'nav'
COLONNE, RIGHE = 5, 3
LATO = 128
SOGLIA = 200          # sopra questa luminosità è sfondo

NOMI = [
    'pallone-freccia', 'campo', 'pallone-scambio', 'cono-pallone', 'fischietto',
    'fiamma', 'allenatore', 'scarpino-scambio', 'maglia-andamento', 'grafico',
    'maglia-10', 'coppa', 'lavagna', 'calendario', 'borsa',
]


def ritaglia(im, riga, col):
    w, h = im.size
    cw, ch = w // COLONNE, h // RIGHE
    return im.crop((col * cw, riga * ch, (col + 1) * cw, (riga + 1) * ch))


def maschera(cella):
    """Da sagoma scura su bianco a maschera: opaca dove c'è inchiostro."""
    g = cella.convert('L')
    alpha = g.point(lambda v: 0 if v > SOGLIA else 255 - v)
    box = alpha.getbbox()
    if box:
        alpha = alpha.crop(box)
    # quadrata con un margine, così tutte le icone pesano otticamente uguale
    lato = max(alpha.size)
    tela = Image.new('L', (lato, lato), 0)
    tela.paste(alpha, ((lato - alpha.size[0]) // 2, (lato - alpha.size[1]) // 2))
    tela = tela.resize((LATO - 16, LATO - 16), Image.LANCZOS)
    fuori = Image.new('L', (LATO, LATO), 0)
    fuori.paste(tela, (8, 8))
    # bianco pieno con l'alpha della sagoma: la CSS ci mette sopra il colore
    return Image.merge('RGBA', (Image.new('L', (LATO, LATO), 255),) * 3 + (fuori,))


def main():
    im = Image.open(SORGENTE).convert('RGB')
    USCITA.mkdir(parents=True, exist_ok=True)
    for i, nome in enumerate(NOMI):
        m = maschera(ritaglia(im, i // COLONNE, i % COLONNE))
        m.save(USCITA / f'{nome}.png')
        print(f'  {nome}.png  ({m.getbbox()})')
    print(f'\nscritte {len(NOMI)} maschere in {USCITA.relative_to(RADICE)}')


if __name__ == '__main__':
    main()
