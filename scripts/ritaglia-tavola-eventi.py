#!/usr/bin/env python3
"""Ritaglia media/nuove-icone.png nelle singole icone evento.

La tavola arriva con lo sfondo GIA' trasparente, che e' la ragione per cui si
puo' usare: le vecchie erano su bianco, e togliere il bianco si mangiava i
bordi sfumati e le ombre, cioe' proprio quello che le fa sembrare nitide.

La griglia non e' regolare (cinque icone nelle prime tre righe, sei nell'ultima,
spaziature che ballano), quindi le celle non si calcolano dividendo: si trovano
guardando dove c'e' inchiostro. Le bande alte sono le icone, quelle basse le
etichette sotto, e si scartano per altezza.

Tre icone nella tavola non tornano e NON vengono scritte:
  - fuorigioco    disegnato con due cartellini, identico a espulsione; il
                  fuorigioco lo segnala la bandierina del guardalinee
  - rigore-parato disegnato col fischietto, identico a calcio-inizio; un rigore
                  parato vuole il guantone, ed e' arrivato a parte — il suo
                  originale sta in media/icone-sorgenti/eventi/rigore-parato.png
                  e questo script non lo tocca
  - espulsione    disegnato giallo+rosso, che pero' e' il DOPPIO GIALLO: quel
                  disegno finisce quindi su espulsione-x2, ed espulsione (il
                  rosso diretto, un cartellino solo) resta quella vecchia
Restano vecchie anche gol-pareggio e porta-inviolata, che nella tavola non ci
sono.

    python3 scripts/ritaglia-tavola-eventi.py [--prova]
"""
import sys
from pathlib import Path
from PIL import Image
import numpy as np

RADICE = Path(__file__).resolve().parent.parent
TAVOLA = RADICE / 'media' / 'nuove-icone.png'
# I ritagli a piena risoluzione restano qui: sono la sorgente, e da li'
# normalizza-icone.py ricampiona UNA volta sola invece di ritoccare il file
# gia' rimpicciolito. Su un'icona con tratti sottili il doppio ritocco si
# vede: alla grandezza di schermo cambiava in media il 6% dei pixel.
USCITA = RADICE / 'media' / 'icone-sorgenti' / 'eventi'
IN_USO = RADICE / 'media' / 'icone' / 'eventi'

# Nomi riga per riga, come stanno nella tavola. None = disegno da scartare.
GRIGLIA = [
    ['assist', 'assist-x2', 'autogol', 'gol', 'gol-x2'],
    ['gol-vittoria', 'gol-subito', 'rigore-segnato', 'rigore-sbagliato', None],
    ['sostituzione-out', 'sostituzione-in', None, 'ammonizione', 'espulsione-x2'],
    ['azione-pericolosa', 'corner', 'calcio-inizio', 'capitano', 'palo', 'recupero'],
]

def bande(v, soglia=2, minimo=6):
    """Gli intervalli in cui il vettore resta sopra soglia."""
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
    USCITA.mkdir(parents=True, exist_ok=True)
    im = Image.open(TAVOLA).convert('RGBA')
    vivo = np.array(im)[:, :, 3] > 30
    # le bande alte sono le icone, quelle da trenta pixel le etichette
    righe = [b for b in bande(vivo.sum(axis=1)) if b[1] - b[0] > 60]
    if len(righe) != len(GRIGLIA):
        print(f'attese {len(GRIGLIA)} righe di icone, trovate {len(righe)}: {righe}', file=sys.stderr)
        return 1
    scritte = scartate = 0
    for (r0, r1), nomi in zip(righe, GRIGLIA):
        colonne = bande(vivo[r0:r1 + 1].sum(axis=0), soglia=1, minimo=10)
        if len(colonne) != len(nomi):
            print(f'riga {r0}-{r1}: attese {len(nomi)} icone, trovate {len(colonne)}', file=sys.stderr)
            return 1
        for (c0, c1), nome in zip(colonne, nomi):
            if nome is None:
                scartate += 1
                continue
            cella = im.crop((c0, r0, c1 + 1, r1 + 1))
            # la banda e' alta quanto l'icona piu' alta della riga: si rifila
            m = np.array(cella)[:, :, 3] > 30
            ys, xs = np.where(m)
            cella = cella.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
            print(f'  {nome:20} {cella.size[0]:3}x{cella.size[1]:<3}')
            if not prova:
                cella.save(USCITA / f'{nome}.png')
                # anche in uso, a piena risoluzione: ci pensa poi
                # normalizza-icone.py a rimpicciolirla, una volta sola
                cella.save(IN_USO / f'{nome}.png')
            scritte += 1
    print(f'\n{scritte} ritagliate, {scartate} scartate.'
          + ('  prova: niente e\' stato scritto.' if prova else ''))
    return 0

if __name__ == '__main__':
    sys.exit(main())
