#!/usr/bin/env python3
"""
Scontorna i personaggi di media/avatarN.jpg e li salva in media/avatar/N.webp.

Le immagini hanno lo sfondo dipinto dentro. Qui si toglie partendo dai BORDI e
allargandosi finche' il colore resta simile a quello da cui si e' partiti: cosi'
un fondo piatto se ne va tutto, mentre i colori uguali che stanno DENTRO il
personaggio (una maglia bianca, un occhio) restano, perche' non sono attaccati
al bordo.

Funziona dove il fondo e' una tinta piatta o una sfumatura dolce. Dove c'e' una
foto vera dietro (uno stadio, un muro di graffiti) non basta: lo script lo dice
invece di consegnare un ritaglio sbagliato.

    python3 scripts/make-avatar.py
"""
import pathlib
import sys
import numpy as np
from PIL import Image, ImageFilter
from collections import deque

RADICE = pathlib.Path(__file__).resolve().parent.parent
USCITA = RADICE / 'media' / 'avatar'
ALTEZZA = 620          # il doppio abbondante della misura a schermo
TOLLERANZA = 40        # quanto puo' scostarsi dal colore di partenza del bordo
COPERTURA_MAX = 0.82   # oltre questa quota di pixel tolti, il ritaglio e' sospetto
COPERTURA_MIN = 0.12   # sotto, lo sfondo non e' stato riconosciuto
# Alzare la tolleranza su 2 e 4 (fondo fotografico) non aiuta: il
# riempimento supera il contorno e si mangia il personaggio. Restano alla
# tolleranza normale, e lo script segnala che vanno rifatti su fondo piatto.
TOLLERANZA_DURA = {}


def maschera_sfondo(arr, tol):
    """Riempimento dai quattro bordi: torna True dove c'e' sfondo."""
    h, w, _ = arr.shape
    fuori = np.zeros((h, w), dtype=bool)
    coda = deque()
    # Si parte da ogni pixel del bordo, ognuno col proprio colore di riferimento.
    for x in range(w):
        for y in (0, h - 1):
            if not fuori[y, x]: fuori[y, x] = True; coda.append((y, x, arr[y, x]))
    for y in range(h):
        for x in (0, w - 1):
            if not fuori[y, x]: fuori[y, x] = True; coda.append((y, x, arr[y, x]))
    while coda:
        y, x, rif = coda.pop()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if ny < 0 or nx < 0 or ny >= h or nx >= w or fuori[ny, nx]:
                continue
            # Il confronto e' col colore DI PARTENZA di quel bordo, non col
            # vicino: confrontando col vicino il riempimento striscia dentro al
            # personaggio seguendo le sfumature, e si mangia tutto (99%).
            if np.abs(arr[ny, nx].astype(int) - rif.astype(int)).max() <= tol:
                fuori[ny, nx] = True
                coda.append((ny, nx, rif))
    return fuori


def solo_pezzo_grosso(tenuti):
    """Del soggetto si tiene solo la macchia piu' grande: i frammenti staccati
    (schegge di muro, macchie di folla sfocata) se ne vanno da soli."""
    h, w = tenuti.shape
    visto = np.zeros((h, w), dtype=bool)
    migliore, misura_migliore = None, 0
    for y0 in range(h):
        for x0 in range(w):
            if not tenuti[y0, x0] or visto[y0, x0]:
                continue
            coda = deque([(y0, x0)]); visto[y0, x0] = True; pezzo = [(y0, x0)]
            while coda:
                y, x = coda.pop()
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and tenuti[ny, nx] and not visto[ny, nx]:
                        visto[ny, nx] = True; coda.append((ny, nx)); pezzo.append((ny, nx))
            if len(pezzo) > misura_migliore:
                misura_migliore, migliore = len(pezzo), pezzo
    fuori = np.zeros((h, w), dtype=bool)
    if migliore:
        ys, xs = zip(*migliore); fuori[np.array(ys), np.array(xs)] = True
    return fuori


def scontorna(percorso, tol=TOLLERANZA):
    im = Image.open(percorso).convert('RGB')
    arr = np.asarray(im)
    fuori = maschera_sfondo(arr, tol)
    tenuti = solo_pezzo_grosso(~fuori)
    fuori = ~tenuti
    quota = fuori.mean()

    alfa = Image.fromarray(np.where(fuori, 0, 255).astype(np.uint8), 'L')
    # Un filo di sfocatura e poi soglia: toglie la scalettatura del riempimento.
    alfa = alfa.filter(ImageFilter.GaussianBlur(1.2)).point(lambda v: 0 if v < 128 else 255)
    alfa = alfa.filter(ImageFilter.GaussianBlur(0.7))   # bordo morbido

    fuori_im = im.copy(); fuori_im.putalpha(alfa)
    box = alfa.point(lambda v: 255 if v > 20 else 0).getbbox()
    if not box:
        return None, quota
    fuori_im = fuori_im.crop(box)
    larga = round(fuori_im.width * ALTEZZA / fuori_im.height)
    return fuori_im.resize((larga, ALTEZZA), Image.LANCZOS), quota


def main():
    USCITA.mkdir(parents=True, exist_ok=True)
    sospetti = []
    for n in range(1, 10):
        src = RADICE / 'media' / f'avatar{n}.jpg'
        if not src.exists():
            print(f'  {n}: manca {src.name}'); continue
        # 2 e 4 hanno una foto vera dietro (stadio, muro di graffiti): il
        # riempimento si ferma troppo presto, serve piu' margine.
        ritaglio, quota = scontorna(src, TOLLERANZA_DURA.get(n, TOLLERANZA))
        if ritaglio is None:
            sospetti.append((n, 'ritaglio vuoto')); continue
        fuori = USCITA / f'{n}.webp'
        ritaglio.save(fuori, quality=90, method=6)
        nota = ''
        if quota > COPERTURA_MAX: nota = 'SOSPETTO: tolto quasi tutto'
        elif quota < COPERTURA_MIN: nota = 'SOSPETTO: sfondo non riconosciuto'
        if nota: sospetti.append((n, nota))
        print(f'  {n}: sfondo tolto {quota:6.1%}  →  {ritaglio.size[0]}x{ritaglio.size[1]}  '
              f'{fuori.stat().st_size // 1024} KB  {nota}')
    if sospetti:
        print('\nDa guardare a occhio:', ', '.join(f'{n} ({m})' for n, m in sospetti))


if __name__ == '__main__':
    sys.setrecursionlimit(10000)
    main()
