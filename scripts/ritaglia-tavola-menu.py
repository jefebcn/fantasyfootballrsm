#!/usr/bin/env python3
"""Ritaglia media/nuove-icone-menu.jpg nelle icone del menu e nelle sagome della barra.

La tavola arriva come JPEG e la trasparenza e' DISEGNATA: la scacchiera grigia
non e' un canale alpha, sono pixel. Quindi lo sfondo va tolto davvero. Si puo'
fare, e bene, perche' la scacchiera ha due proprieta' che il disegno non ha:
e' grigia (rosso, verde e blu uguali) e sta in una fascia di luminosita' nota.

Due gruppi, due strategie diverse, perche' sono due cose diverse:

MENU — disegni a colori. Lo sfondo e' "grigio e nella fascia", ma solo quello
ATTACCATO AL BORDO: senza questa regola il grigio DENTRO un'icona sparirebbe, e
le persone di squadre, la calcolatrice di voti e le foto di vice-allenatore si
bucherebbero. E' la stessa regola che usava make-icone.py per le vecchie.

BARRA — sagome bianche, che diventano maschere: l'app ci mette dentro il colore
via CSS ed e' cosi' che la voce attiva diventa blu. Qui il grigio non serve:
basta la luce, perche' il bianco (255) sta lontanissimo dalla scacchiera (63-98)
e la sfumatura del bordo viene fuori pulita da sola. Con la regola del menu si
mangiava il 15% del grafico, che e' tutto linee sottili.

La fascia dello sfondo scende fino a 18 e non si ferma a 45 perche' l'ombra
portata sotto ogni icona scurisce la scacchiera: fermandosi prima restavano
attaccati i dentini dei quadretti scuri.

    python3 scripts/ritaglia-tavola-menu.py [--prova]
"""
import sys
from pathlib import Path
from PIL import Image, ImageFilter
import numpy as np
from scipy import ndimage as ndi

RADICE = Path(__file__).resolve().parent.parent / 'media'
TAVOLA = RADICE / 'nuove-icone-menu.jpg'

# riga di tessere -> (gruppo, nomi in ordine)
GRIGLIA = [
    (69, 229, 'menu', ['assist', 'fantascore', 'guide', 'leghe', 'live', 'probabili']),
    (314, 453, 'menu', ['quotazioni', 'squadre', 'statistiche', 'trasferimenti', 'vice-allenatore', 'voti']),
    (599, 736, 'nav', ['campo', 'maglia-10', 'calendario', 'coppa', 'grafico']),
]

def bande(v, soglia=1, minimo=12):
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

def main():
    prova = '--prova' in sys.argv
    im = Image.open(TAVOLA).convert('RGB')
    a = np.array(im).astype(float)
    luce = a.mean(axis=2)
    colore = a.max(axis=2) - a.min(axis=2)

    # --- fondo del menu: grigio, nella fascia, e attaccato al bordo
    grezzo = (colore < 16) & (luce > 18) & (luce < 115)
    etichette, _ = ndi.label(grezzo)
    ai_bordi = set(etichette[0].tolist()) | set(etichette[-1].tolist()) \
             | set(etichette[:, 0].tolist()) | set(etichette[:, -1].tolist())
    ai_bordi.discard(0)
    # erosione di 1: il bordo sfumato dal JPEG e' meta' disegno e meta' scacchiera
    pieno = ndi.binary_erosion(~np.isin(etichette, list(ai_bordi)), np.ones((3, 3)))

    # --- fondo della barra: basta la luce, il bianco e' lontano dal grigio
    bianco = np.clip((luce - 118) / 40, 0, 1)


    for y0, y1, gruppo, nomi in GRIGLIA:
        guida = pieno if gruppo == 'menu' else (bianco > 0.25)
        colonne = bande(guida[y0:y1 + 1].sum(axis=0))
        if len(colonne) != len(nomi):
            print(f'riga {y0}-{y1}: attese {len(nomi)} icone, trovate {len(colonne)}', file=sys.stderr)
            return 1
        uscita = RADICE / 'icone-sorgenti' / gruppo
        in_uso = RADICE / 'icone' / gruppo
        uscita.mkdir(parents=True, exist_ok=True)
        for (x0, x1), nome in zip(colonne, nomi):
            if gruppo == 'menu':
                m = pieno[y0:y1 + 1, x0:x1 + 1]
                ys, xs = np.where(m)
                taglio = (x0 + xs.min(), y0 + ys.min(), x0 + xs.max() + 1, y0 + ys.max() + 1)
                alfa = Image.fromarray((m[ys.min():ys.max() + 1, xs.min():xs.max() + 1] * 255)
                                       .astype(np.uint8), 'L').filter(ImageFilter.GaussianBlur(0.7))
                fuori = im.crop(taglio).convert('RGBA')
            else:
                al = bianco[y0:y1 + 1, x0:x1 + 1]
                m = al > 0.25
                ys, xs = np.where(m)
                ritaglio = al[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
                alfa = Image.fromarray((ritaglio * 255).astype(np.uint8), 'L')
                # maschera: la forma sta nell'alfa, il colore lo mette la CSS
                fuori = Image.new('RGBA', alfa.size, (255, 255, 255, 255))
            fuori.putalpha(alfa)
            print(f'  {gruppo:5} {nome:18} {fuori.size[0]:3}x{fuori.size[1]}')
            if not prova:
                fuori.save(uscita / f'{nome}.png')
                fuori.save(in_uso / f'{nome}.png')
    print('\nprova: niente e\' stato scritto.' if prova else '\nscritte.')
    return 0

if __name__ == '__main__':
    sys.exit(main())
