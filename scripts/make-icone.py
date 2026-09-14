"""
Ritaglia le due tavole di icone in file singoli.

  media/iconemenu.png    griglia 4x3, icona + etichetta sotto  -> media/icone/menu/
  media/iconeeventi.png  griglia 6x4, icona + etichetta sotto  -> media/icone/eventi/

Per ogni cella: isola la banda superiore (l'icona, separata dall'etichetta da una
riga vuota), rifila i bordi e rende trasparente solo lo sfondo *collegato al bordo*,
così i bianchi interni all'icona restano (il pallone, i cartellini, la coppa).

Uso: python3 scripts/make-icone.py
"""
import os
from collections import deque, Counter
from PIL import Image

TAVOLE = [
    ('media/iconemenu.png', 'media/icone/menu', 4, 3, [
        'leghe', 'vice-allenatore', 'guide', 'squadre',
        'live', 'assist', 'trasferimenti', 'statistiche',
        'voti', 'fantascore', 'probabili', 'quotazioni',
    ]),
    ('media/iconeeventi.png', 'media/icone/eventi', 6, 4, [
        'assist', 'assist-x2', 'autogol', 'gol', 'gol-x2', 'gol-pareggio',
        'gol-vittoria', 'gol-subito', 'rigore-segnato', 'rigore-sbagliato', 'rigore-parato', 'porta-inviolata',
        'sostituzione-out', 'sostituzione-in', 'fuorigioco', 'ammonizione', 'espulsione', 'espulsione-x2',
        'azione-pericolosa', 'corner', 'calcio-inizio', 'capitano', 'palo', 'recupero',
    ]),
]
LATO = 128          # lato del PNG finale: in app si vedono fra 18 e 44px
TOLL = 26           # quanto un pixel può somigliare allo sfondo restando "sfondo"


def vicino(a, b, toll=TOLL):
    return abs(a[0] - b[0]) <= toll and abs(a[1] - b[1]) <= toll and abs(a[2] - b[2]) <= toll


def bande(mask, w, h):
    """Righe con inchiostro, raggruppate in bande contigue: la prima è l'icona."""
    pieno = [any(mask[y * w + x] for x in range(w)) for y in range(h)]
    out, inizio = [], None
    for y in range(h):
        if pieno[y] and inizio is None: inizio = y
        elif not pieno[y] and inizio is not None:
            if y - inizio > 3: out.append((inizio, y))
            inizio = None
    if inizio is not None and h - inizio > 3: out.append((inizio, h))
    return out


def scontorna(im):
    """Toglie lo sfondo partendo dai bordi: i bianchi interni all'icona restano."""
    im = im.convert('RGBA')
    w, h = im.size
    px = im.load()
    bordo = [px[x, y][:3] for x in range(w) for y in (0, h - 1)] + [px[x, y][:3] for y in range(h) for x in (0, w - 1)]
    sfondo = Counter(bordo).most_common(1)[0][0]
    visti = [[False] * h for _ in range(w)]
    coda = deque()
    for x in range(w):
        for y in (0, h - 1):
            if vicino(px[x, y][:3], sfondo): coda.append((x, y)); visti[x][y] = True
    for y in range(h):
        for x in (0, w - 1):
            if vicino(px[x, y][:3], sfondo) and not visti[x][y]: coda.append((x, y)); visti[x][y] = True
    while coda:
        x, y = coda.popleft()
        px[x, y] = (255, 255, 255, 0)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not visti[nx][ny] and vicino(px[nx, ny][:3], sfondo):
                visti[nx][ny] = True; coda.append((nx, ny))
    return im


def quadra(im, lato=LATO, margine=0.06):
    box = im.getbbox()
    if box: im = im.crop(box)
    scala = (lato * (1 - 2 * margine)) / max(im.size)
    im = im.resize((max(1, round(im.width * scala)), max(1, round(im.height * scala))), Image.LANCZOS)
    out = Image.new('RGBA', (lato, lato), (0, 0, 0, 0))
    out.paste(im, ((lato - im.width) // 2, (lato - im.height) // 2), im)
    return out


for sorgente, cartella, cols, rows, nomi in TAVOLE:
    if not os.path.exists(sorgente):
        print(f'salto {sorgente}: non trovato'); continue
    os.makedirs(cartella, exist_ok=True)
    tav = Image.open(sorgente).convert('RGB')
    W, H = tav.size
    cw, ch = W / cols, H / rows
    fatti = 0
    for r in range(rows):
        for c in range(cols):
            i = r * cols + c
            if i >= len(nomi): continue
            # inset: evita le righe della griglia ai bordi della cella
            cella = tav.crop((round(c * cw) + 3, round(r * ch) + 3, round((c + 1) * cw) - 3, round((r + 1) * ch) - 3))
            w, h = cella.size
            px = cella.load()
            bordo = [px[x, y] for x in range(w) for y in (0, h - 1)]
            sfondo = Counter(bordo).most_common(1)[0][0]
            mask = [not vicino(px[x, y], sfondo, 18) for y in range(h) for x in range(w)]
            bs = bande(mask, w, h)
            if not bs:
                print(f'  {nomi[i]}: cella vuota'); continue
            a, b = bs[0]                                   # prima banda = icona
            icona = quadra(scontorna(cella.crop((0, max(0, a - 2), w, min(h, b + 2)))))
            icona.save(os.path.join(cartella, nomi[i] + '.png'))
            fatti += 1
    print(f'{cartella}: {fatti} icone')
