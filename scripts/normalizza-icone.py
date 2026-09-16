#!/usr/bin/env python3
"""Porta le icone di un gruppo alla stessa grandezza ottica.

Il difetto sta nei file, non nel CSS: dentro uno stesso gruppo le icone erano
disegnate con inchiostri molto diversi sulla stessa tela, e sullo schermo una
veniva grande il doppio dell'altra. Nella barra in basso il calendario era
disegnato a META' SCALA degli altri — inchiostro 64x62 contro i 112x108 della
coppa — e un artefatto da sette pixel sul bordo destro faceva credere il
contrario a chi misurava il riquadro alpha senza soglia.

Ogni icona viene ritagliata sull'inchiostro vero, riscalata perche' la sua
dimensione ottica (media geometrica di base e altezza) sia la stessa per tutte
quelle del gruppo, e rimessa al centro della tela. Il rapporto fra base e
altezza NON si tocca: un campo resta largo e una coppa resta alta, ma pesano
uguale. E' il modo in cui si normalizza un set di icone: non riquadri identici,
peso identico.

    python3 scripts/normalizza-icone.py            tutti i gruppi
    python3 scripts/normalizza-icone.py menu       solo quello
    python3 scripts/normalizza-icone.py --prova    i numeri, senza scrivere

Rilanciarlo non fa danni: su icone gia' normalizzate i numeri non cambiano.
Gli originali restano comunque nella storia di git.
"""
import sys, math
from pathlib import Path
from PIL import Image
import numpy as np

RADICE = Path(__file__).resolve().parent.parent / 'media' / 'icone'
TELA = 128

# Il lato massimo e' diverso fra i gruppi perche' e' diverso il margine con cui
# sono stati disegnati. Va tenuto fermo: cambiarlo rimescola icone gia' a posto.
#
# `icone` elenca quali toccare. Per la barra in basso e' scritto a mano: nella
# cartella ci sono anche dieci disegni avanzati da un set precedente che non usa
# nessuno (mask() viene chiamata in un punto solo, con questi cinque nomi), e
# ritoccarli sarebbe rumore. Per il menu invece servono tutti.
GRUPPI = {
    'nav':  {'ottica': 100.0, 'max_lato': 112,
             'icone': ['campo', 'maglia-10', 'calendario', 'coppa', 'grafico']},
    'menu': {'ottica': 100.0, 'max_lato': 122, 'icone': None},
    # Eventi: qui il tetto lo detta il palo, 113x73, che e' una porta vista di
    # lato. A grandezza ottica 100 vorrebbe essere largo 132 e sulla tela non ci
    # sta: con 122 si ferma a 98, cioe' il 2% sotto. E' il solo che non arriva.
    'eventi': {'ottica': 100.0, 'max_lato': 122, 'icone': None},
}

def riquadro(alpha, soglia=40, minimo=8):
    """Il riquadro dell'inchiostro che si vede davvero.

    `minimo` pixel per riga e per colonna: senza, una traccia sperduta di sette
    pixel sul bordo del calendario allargava la misura da 64 a 112 e faceva
    sembrare l'icona grande il doppio di quello che era.
    """
    m = np.array(alpha) > soglia
    xs = np.where(m.sum(axis=0) >= minimo)[0]
    ys = np.where(m.sum(axis=1) >= minimo)[0]
    if not len(xs) or not len(ys):
        raise ValueError('icona senza inchiostro')
    return int(xs[0]), int(ys[0]), int(xs[-1]) + 1, int(ys[-1]) + 1

def _posa(ink, nw, nh, dx=0, dy=0):
    """L'inchiostro riscalato e rimesso al centro della tela.

    `dx`/`dy` servono a raddrizzare le icone con tratti staccati: dopo il
    salvataggio la sfumatura di una riga di movimento puo' scendere sotto la
    soglia da un lato solo, e il riquadro che si rilegge risulta spostato.
    """
    tela = Image.new('RGBA', (TELA, TELA), (0, 0, 0, 0))
    tela.paste(ink.resize((nw, nh), Image.LANCZOS),
               ((TELA - nw) // 2 + dx, (TELA - nh) // 2 + dy))
    return tela


def normalizza(percorso, ottica, max_lato, prova, sorgente=None):
    """Porta un'icona alla grandezza ottica del gruppo.

    Con `sorgente` (il ritaglio a piena risoluzione) il ricampionamento e'
    sempre UNO, anche quando la misura va aggiustata: si riparte ogni volta
    dai pixel originali invece di ritoccare il file gia' rimpicciolito.

    L'aggiustamento serve perche' salvare cambia la misura: su un'icona con
    tratti sottili — le righe di movimento di azione-pericolosa, il "2" di
    assist-x2 — la sfumatura del bordo scende sotto la soglia e il riquadro
    si legge piu' piccolo del dovuto. Senza ripartire dall'originale, il
    giro dopo la si allargava, e ogni giro costava una ricampionatura: alla
    grandezza di schermo cambiava in media il 6% dei pixel.
    """
    im = Image.open(percorso).convert('RGBA')
    x0, y0, x1, y1 = riquadro(im.split()[3])
    w, h = x1 - x0, y1 - y0
    k = min(ottica / math.sqrt(w * h), max_lato / w, max_lato / h)
    nw, nh = max(1, round(w * k)), max(1, round(h * k))

    centrata = (abs(x0 - (TELA - w) // 2) <= 1 and abs(y0 - (TELA - h) // 2) <= 1)
    # Gia' a posto: non la si tocca, cosi' rilanciare lo script non costa
    # niente e non cambia un byte.
    if abs(k - 1) < 0.005 and (nw, nh) == (w, h) and centrata:
        return (w, h), (nw, nh)

    if sorgente is None or not sorgente.exists():
        if not prova:
            _posa(im.crop((x0, y0, x1, y1)), nw, nh).save(percorso)
        return (w, h), (nw, nh)

    src = Image.open(sorgente).convert('RGBA')
    sb = riquadro(src.split()[3])
    ink = src.crop(sb)
    sw, sh = sb[2] - sb[0], sb[3] - sb[1]
    k = min(ottica / math.sqrt(sw * sh), max_lato / sw, max_lato / sh)
    dx = dy = 0
    for _ in range(8):
        nw, nh = max(1, round(sw * k)), max(1, round(sh * k))
        tela = _posa(ink, nw, nh, dx, dy)
        mb = riquadro(tela.split()[3])
        mw, mh = mb[2] - mb[0], mb[3] - mb[1]
        letta = math.sqrt(mw * mh)
        # il tetto sul lato vince sempre: li' la misura giusta e' quella, non il bersaglio
        al_tetto = max(nw, nh) >= max_lato
        fuori = round((TELA - mw) / 2 - mb[0]), round((TELA - mh) / 2 - mb[1])
        if (al_tetto or abs(letta / ottica - 1) < 0.005) and max(abs(fuori[0]), abs(fuori[1])) <= 1:
            break
        dx += fuori[0]; dy += fuori[1]
        if not al_tetto:
            k *= ottica / letta
    if not prova:
        tela.save(percorso)
    return (w, h), (mb[2] - mb[0], mb[3] - mb[1])

def main():
    voci = [a for a in sys.argv[1:] if not a.startswith('-')]
    prova = '--prova' in sys.argv
    gruppi = voci or list(GRUPPI)
    for g in gruppi:
        if g not in GRUPPI:
            print(f'gruppo sconosciuto: {g} (ce ne sono {", ".join(GRUPPI)})'); continue
        cfg = GRUPPI[g]
        print(f'\n--- {g} (ottica {cfg["ottica"]:.0f}, lato max {cfg["max_lato"]}) ---')
        print(f'  {"icona":22} {"prima":>11} {"dopo":>11}   scarto')
        esiti = []
        cartella = RADICE / g
        file = ([cartella / f'{n}.png' for n in cfg['icone']] if cfg['icone']
                else sorted(cartella.glob('*.png')))
        for p in file:
            sorg = RADICE.parent / 'icone-sorgenti' / g / p.name
            (w, h), (nw, nh) = normalizza(p, cfg['ottica'], cfg['max_lato'], prova, sorg)
            o = math.sqrt(nw * nh)
            esiti.append(o)
            print(f'  {p.stem:22} {w:4}x{h:<6} {nw:4}x{nh:<6}   {100*(o/cfg["ottica"]-1):+5.1f}%')
        peggio = max(abs(o / cfg['ottica'] - 1) for o in esiti)
        print(f'  scarto peggiore dal bersaglio: {peggio*100:.1f}%')
    print('\nprova: niente e\' stato scritto.' if prova else '\nscritte.')

if __name__ == '__main__':
    main()
