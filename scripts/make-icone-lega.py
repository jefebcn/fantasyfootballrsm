#!/usr/bin/env python3
"""
Ritaglia media/iconelega.png in 15 icone singole.

Tavola 4x4: in ogni cella l'icona sta sopra e l'etichetta sotto. Si tiene
solo la prima fascia d'inchiostro dall'alto, come per le altre tavole, così
la scritta non finisce dentro l'icona.

Queste sono a due tinte di blu, non sagome: si usano dove servono a
riconoscere una voce (menu, impostazioni), non dove serve indicare uno
stato — per quello ci sono le maschere in media/icone/nav.

    python3 scripts/make-icone-lega.py
"""
import pathlib
from PIL import Image

RADICE = pathlib.Path(__file__).resolve().parent.parent
SORGENTE = RADICE / 'media' / 'iconelega.png'
USCITA = RADICE / 'media' / 'icone' / 'lega'
COLONNE, RIGHE = 4, 4
LATO = 128

# La tavola ripete lo stesso grafico (barre con freccia) nella prima e nella
# quarta riga: la seconda copia si salta, restano 15 icone distinte.
SALTA = object()
NOMI = [
    'andamento', 'trofei', 'calcola', 'calendario',
    'classifica', 'probabili-formazioni', 'impostazioni', 'la-mia-squadra',
    'premi', 'rose', 'scambi', 'strumenti',
    SALTA, 'supporto', 'chat', 'live',
]


def fasce_orizzontali(im):
    """Fasce di righe che contengono inchiostro, su tutta la tavola."""
    w, h = im.size
    px = im.load()
    def ink(x, y):
        r, g, b, a = px[x, y]
        return a > 40 and not (r > 240 and g > 240 and b > 240)
    piene = [any(ink(x, y) for x in range(w)) for y in range(h)]
    fuori, inizio = [], None
    for y, p in enumerate(piene + [False]):
        if p and inizio is None:
            inizio = y
        elif not p and inizio is not None:
            fuori.append((inizio, y)); inizio = None
    return fuori


def ritaglia(im, y0, y1, col):
    """Una cella: la colonna col della fascia fra y0 e y1, ritagliata al contenuto."""
    w = im.size[0]
    cw = w // COLONNE
    cella = im.crop((col * cw, y0, (col + 1) * cw, y1))
    box = cella.split()[3].point(lambda v: 255 if v > 40 else 0).getbbox()
    if not box:
        return None
    cella = cella.crop(box)
    lato = max(cella.size)
    tela = Image.new('RGBA', (lato, lato), (0, 0, 0, 0))
    tela.paste(cella, ((lato - cella.size[0]) // 2, (lato - cella.size[1]) // 2))
    tela = tela.resize((LATO - 16, LATO - 16), Image.LANCZOS)
    fuori = Image.new('RGBA', (LATO, LATO), (0, 0, 0, 0))
    fuori.paste(tela, (8, 8), tela)
    return fuori


def main():
    im = Image.open(SORGENTE).convert('RGBA')
    # il fondo bianco della tavola diventa trasparente
    px = im.load()
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            r, g, b, a = px[x, y]
            if r > 240 and g > 240 and b > 240:
                px[x, y] = (r, g, b, 0)

    # Le righe non sono equidistanti: dividendo in quattro parti uguali il
    # taglio cadeva dentro l'etichetta della riga precedente, e quattro icone
    # su sedici venivano sostituite dalla scritta. Si usano le fasce vere:
    # quelle alte sono le icone, quelle basse le etichette.
    fasce = fasce_orizzontali(im)
    alte = [f for f in fasce if f[1] - f[0] >= 20]
    if len(alte) != RIGHE:
        raise SystemExit(f'attese {RIGHE} fasce di icone, trovate {len(alte)}: {alte}')

    USCITA.mkdir(parents=True, exist_ok=True)
    fatte = 0
    for r, (y0, y1) in enumerate(alte):
        for c in range(COLONNE):
            i = r * COLONNE + c
            if i >= len(NOMI) or NOMI[i] is SALTA:
                continue
            ic = ritaglia(im, y0, y1, c)
            if ic is None:
                print(f'  {NOMI[i]}: cella vuota'); continue
            ic.save(USCITA / f'{NOMI[i]}.png')
            fatte += 1
    print(f'scritte {fatte} icone in {USCITA.relative_to(RADICE)}')


if __name__ == '__main__':
    main()
