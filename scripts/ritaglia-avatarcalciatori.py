#!/usr/bin/env python3
"""Ritaglia i personaggi dalle tavole in media/avatar-sorgenti.

Queste tavole arrivano gia' con il canale alfa: lo sfondo e' trasparente, non
verde come le prime quattro. Quindi niente scontorno a colori — qui il problema
e' solo separare i disegni fra loro.

Quasi tutti sono gia' staccati e basta prendere i pezzi attaccati. Ma in quattro
tavole due o piu' figure si sfiorano — una mano che tocca una spalla — e
verrebbero fuori come un personaggio solo, due giocatori in un avatar.

La dimensione da sola non li distingue — 152k px sono due figure in tavola-09,
90k ne sono una in tavola-01 — ma dentro una stessa tavola i disegni hanno
tutti la stessa taglia. Quella taglia la dice la tavola, ed e' il metro con cui
si riconoscono le macchie doppie e si sa in quanti pezzi aprirle: il resto lo
fa un'erosione che cerca la strozzatura e uno spartiacque che restituisce a
ogni pezzo il suo contorno vero.

Il conto torna: 10, 15, 15, 15, 15, 10, 15, 10, 10, 15 — quanti se ne contano
guardando le tavole.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from skimage.segmentation import watershed

RADICE = Path(__file__).resolve().parent.parent
SORGENTI = RADICE / 'media' / 'avatar-sorgenti'
USCITA = RADICE / 'media' / 'avatar'
PRIMO = 101                 # 1-21 sono gli avatar di copertina: non si toccano

OPACO = 40                  # sotto questo l'alfa e' sfrangia, non disegno
PIENO = 128                 # da qui in su e' disegno pieno, non sfumatura di bordo
MINIMA = 20000              # px di disegno: sotto, e' una palla o una scheggia
                            # (il salto e' netto: 27k il piu' piccolo disegno,
                            #  11k la palla piu' grossa)
NUCLEO = 8000               # un pezzo eroso sotto questo e' rumore, non figura
EROSIONI = tuple(range(2, 27, 2))   # fin dove si insiste a cercare la strozzatura
SOGLIA = 1.55               # oltre tante volte la taglia tipica non e' una figura sola
LATO = 512                  # il lato lungo del ritaglio salvato
MARGINE = 6


def disco(r):
    y, x = np.ogrid[-r:r + 1, -r:r + 1]
    return x * x + y * y <= r * r


def separa(m, tipica, giri=4):
    """Divide una macchia che contiene piu' figure incollate.

    Quanto sia grande non basta a dirlo: in tavola-09 un pezzo da 152k px sono
    due figure, in tavola-01 uno da 90k e' una figura sola. Ma DENTRO una
    tavola i disegni sono tutti della stessa taglia, e quella taglia la dice
    la tavola stessa: la mediana dei suoi pezzi. Un pezzo che pesa quanto due
    figure tipiche sono due figure, e il conto dice anche in quante dividerlo.

    Sapere il bersaglio serve, perche' l'erosione da sola sbaglia in tutte e
    due le direzioni. In tavola-04 due figure unite si spezzano in tre a meta'
    strada — un braccio si stacca prima del resto — e tornano due piu' avanti;
    in tavola-07 quattro figure in catena restano tre fino a sedici pixel,
    perche' due si sovrappongono per un tratto largo. Si prende la prima
    erosione che arriva al numero giusto, e il contorno vero lo rimette a
    posto lo spartiacque.

    Lavora dentro il rettangolo della macchia: erosioni e spartiacque costano
    quanto l'area che toccano, e sulla tavola intera sarebbe tutto sprecato.
    """
    quanti = m.sum()
    if giri <= 0 or quanti < SOGLIA * tipica:
        return [m]
    ys, xs = np.where(m)
    if not len(ys):
        return []
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    if (y1 - y0, x1 - x0) != m.shape:
        fuori = []
        for d in separa(m[y0:y1, x0:x1], tipica, giri):
            piena = np.zeros(m.shape, bool)
            piena[y0:y1, x0:x1] = d
            fuori.append(piena)
        return fuori

    bersaglio = max(2, round(quanti / tipica))
    scelta = None
    for r in EROSIONI:
        g, q = ndi.label(ndi.binary_erosion(m, disco(r)))
        dim = np.bincount(g.ravel())
        nuclei = [n for n in range(1, q + 1) if dim[n] >= NUCLEO]
        if len(nuclei) > (len(scelta[1]) if scelta else 1):
            scelta = (g, nuclei)
        if len(nuclei) >= bersaglio:
            break
    if not scelta:
        return [m]
    g, nuclei = scelta
    semi = np.zeros(m.shape, np.int32)
    for i, n in enumerate(nuclei, 1):
        semi[g == n] = i
    # Lo spartiacque corre lungo la strozzatura: ogni pixel torna al nucleo
    # piu' vicino DENTRO la macchia, quindi i contorni restano quelli veri.
    etichette = watershed(ndi.distance_transform_edt(~ndi.binary_erosion(m, disco(1))), semi, mask=m)
    fuori = []
    for i in range(1, len(nuclei) + 1):
        fuori.extend(separa(etichette == i, tipica, giri - 1))
    return fuori


def intero(m, solido):
    """Solo il disegno vero e proprio, senza briciole del vicino.

    Dopo uno spartiacque puo' restare dalla parte sbagliata un frammento —
    la punta di uno scarpino, un dito — che appartiene al disegno accanto.
    Sull'avatar si vede: un coriandolo giallo che galleggia sopra la testa di
    un giocatore in blu.

    Contare i pezzi attaccati non basta, e qui sta il punto: il coriandolo
    sembra staccato e non lo e'. Lo tiene un velo di pixel quasi trasparenti,
    alfa fra 40 e 128, che non si vedono ma bastano a fare un ponte. Contati
    sull'alfa pieno sono due pezzi, contati sul velo uno solo.

    Quindi si guarda chi e' attaccato a chi nel PIENO, si tiene il pezzo
    grande, e gli si ridanno intorno i pixel sfumati che sono suoi — quattro
    pixel, quanto e' larga la sfumatura di un contorno. Il coriandolo sta
    decine di pixel piu' in la': il suo velo non lo salva.
    """
    g, q = ndi.label(m & solido)
    if q <= 1:
        return m
    dim = np.bincount(g.ravel())
    dim[0] = 0
    grosso = g == int(dim.argmax())
    return ndi.binary_dilation(grosso, disco(4)) & m


def pezzi(alfa):
    """Le figure della tavola, come maschere booleane."""
    ink = alfa > OPACO
    g, q = ndi.label(ink)
    dim = np.bincount(g.ravel())
    grandi = [n for n in range(1, q + 1) if dim[n] >= MINIMA]
    # La taglia tipica della tavola. Mediana e non media: le poche macchie
    # incollate pesano il doppio o il quadruplo delle altre, e una media se ne
    # lascerebbe tirare.
    tipica = float(np.median([dim[n] for n in grandi]))
    solido = alfa > PIENO
    for n in grandi:
        for m in separa(g == n, tipica):
            yield intero(m, solido)


def ritaglia(im, m):
    ys, xs = np.where(m)
    y0, y1 = max(0, ys.min() - MARGINE), min(m.shape[0], ys.max() + 1 + MARGINE)
    x0, x1 = max(0, xs.min() - MARGINE), min(m.shape[1], xs.max() + 1 + MARGINE)
    # fuori dalla figura si azzera: due disegni vicini possono condividere il
    # rettangolo, e senza questo il secondo spunterebbe in un angolo del primo
    a = np.asarray(im).copy()
    a[..., 3] = np.where(m, a[..., 3], 0)
    taglio = Image.fromarray(a[y0:y1, x0:x1])
    w, h = taglio.size
    k = LATO / max(w, h)
    return taglio.resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS) if k < 1 else taglio


def main():
    tavole = sorted(SORGENTI.glob('tavola-*.png'))
    if not tavole:
        sys.exit(f'nessuna tavola in {SORGENTI}')
    n = PRIMO
    for t in tavole:
        im = Image.open(t).convert('RGBA')
        quanti = 0
        for m in pezzi(np.asarray(im)[..., 3]):
            # method=4 e non 6: il 6 ci mette 3,7 secondi a immagine per
            # risparmiare 1 kB su 32 — otto minuti di encoder su tutta la
            # cartella, per il 3% di peso.
            ritaglia(im, m).save(USCITA / f'{n}.webp', quality=88, method=4)
            n += 1
            quanti += 1
        print(f'{t.name}: {quanti} personaggi')
    print(f'totale {n - PRIMO}, da {PRIMO} a {n - 1}')


if __name__ == '__main__':
    main()
