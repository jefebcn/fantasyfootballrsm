"""
Le icone di Fantatitano, dalle tavole disegnate per il progetto.

  media/icone-sorgenti/fantatitano/menu.png    12 icone illustrate  -> media/icone/menu/
  media/icone-sorgenti/fantatitano/lega.png    15 icone illustrate  -> media/icone/lega/
  media/icone-sorgenti/fantatitano/eventi.png  11 eventi di partita -> media/icone/eventi/
  media/icone-sorgenti/fantatitano/nav.png      7 sagome            -> media/icone/nav/

Le tavole sono state generate il 24/10/2026 per Fantatitano (lime, viola,
blu notte, le tre torri sullo scudo della lega) e prendono il posto delle
icone di prima, che venivano da materiale di riferimento di un'altra app.

Come si ritaglia: le icone stanno in righe e colonne separate da bianco, e
non in una griglia esatta. Si trovano le righe (le fasce orizzontali con
inchiostro), poi in ogni riga le colonne, e ogni riquadro e' un'icona, nel
loro ordine di lettura. Lo sfondo si toglie partendo dai bordi, cosi' i
bianchi dentro l'icona (il pallone, le maglie) restano. Le sagome della barra
diventano nero su trasparente: il colore lo mette la CSS (mask in ui.js).

Uso: python3 scripts/icone-fantatitano.py
"""
import os
from collections import deque
from PIL import Image, ImageOps, ImageFilter

RADICE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SORGENTI = os.path.join(RADICE, 'media', 'icone-sorgenti', 'fantatitano')
LATO = 128          # in app si vedono fra 18 e 44px
SOGLIA = 236        # sopra, e' carta bianca

TAVOLE = [
    ('menu', ['leghe', 'vice-allenatore', 'guide', 'squadre',
              'live', 'assist', 'trasferimenti', 'statistiche',
              'voti', 'scheda', 'probabili', 'quotazioni'], False),
    ('lega', ['andamento', 'calcola', 'calendario', 'chat', 'classifica',
              'impostazioni', 'la-mia-squadra', 'live', 'premi', 'probabili-formazioni',
              'rose', 'scambi', 'strumenti', 'supporto', 'trofei'], False),
    # la dodicesima (una stella) non serve: None la salta
    ('eventi', ['gol', 'assist', 'autogol', 'ammonizione',
                'espulsione', 'espulsione-x2', 'rigore-sbagliato', 'rigore-parato',
                'sostituzione-in', 'sostituzione-out', 'capitano', None], False),
    # l'ottava (una bandierina) non serve: la bandierina dell'app sta nello sprite
    ('nav', ['campo', 'maglia-10', 'calendario', 'coppa',
             'grafico', 'pallone-scambio', 'fischietto', None], True),
]


def inchiostro(px):
    return min(px[:3]) < SOGLIA


def fasce(pieni, minimo=6, unisci=28):
    """Indici consecutivi pieni, raggruppati: [(inizio, fine)]. Due fasce a
    meno di `unisci` pixel sono la stessa icona (l'asta e la bandiera)."""
    out, inizio = [], None
    for i, p in enumerate(pieni + [False]):
        if p and inizio is None: inizio = i
        elif not p and inizio is not None:
            if out and inizio - out[-1][1] < unisci: out[-1] = (out[-1][0], i)
            elif i - inizio >= minimo: out.append((inizio, i))
            inizio = None
    return out


def riquadri(tav):
    w, h = tav.size
    px = tav.load()
    righe = fasce([any(inchiostro(px[x, y]) for x in range(0, w, 2)) for y in range(h)])
    out = []
    for a, b in righe:
        colonne = fasce([any(inchiostro(px[x, y]) for y in range(a, b, 2)) for x in range(w)])
        out += [(x0, a, x1, b) for x0, x1 in colonne]
    return out


def scontorna(im):
    """Toglie la carta partendo dai bordi: i bianchi interni restano."""
    im = im.convert('RGBA')
    w, h = im.size
    px = im.load()
    visti = bytearray(w * h)
    coda = deque((x, y) for x in range(w) for y in (0, h - 1))
    coda += deque((x, y) for y in range(h) for x in (0, w - 1))
    while coda:
        x, y = coda.popleft()
        if visti[y * w + x] or inchiostro(px[x, y]): continue
        visti[y * w + x] = 1
        # il bordo antialiasato verso la carta: trasparenza graduale, non un alone bianco
        px[x, y] = (255, 255, 255, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not visti[ny * w + nx]: coda.append((nx, ny))
    return im


def sagoma(im):
    """Nero su trasparente: l'opacita' e' quanto il pixel e' scuro."""
    g = ImageOps.grayscale(im)
    alfa = g.point(lambda v: 0 if v > 200 else min(255, int((255 - v) * 1.25)))
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    out.putalpha(alfa)
    return out


def adesivo(im, spessore=7):
    """Un bordo bianco tutto intorno, come un adesivo: gli eventi stanno anche
    su fondo scuro, e la porta del rigore sbagliato o il contorno nero del
    pallone sparivano sul blu notte."""
    a = im.getchannel('A').point(lambda v: 255 if v > 40 else 0)
    gonfio = a.filter(ImageFilter.MaxFilter(spessore * 2 + 1)).filter(ImageFilter.GaussianBlur(1))
    sotto = Image.new('RGBA', im.size, (255, 255, 255, 0))
    sotto.putalpha(gonfio)
    sotto.alpha_composite(im)
    return sotto


def quadra(im, margine=0.06):
    box = im.getbbox()
    if box: im = im.crop(box)
    scala = (LATO * (1 - 2 * margine)) / max(im.size)
    im = im.resize((max(1, round(im.width * scala)), max(1, round(im.height * scala))), Image.LANCZOS)
    out = Image.new('RGBA', (LATO, LATO), (0, 0, 0, 0))
    out.paste(im, ((LATO - im.width) // 2, (LATO - im.height) // 2), im)
    return out


def main():
    for nome, nomi, solo_sagoma in TAVOLE:
        tav = Image.open(os.path.join(SORGENTI, nome + '.png')).convert('RGB')
        rq = riquadri(tav)
        if len(rq) != len(nomi):
            raise SystemExit(f'{nome}: trovate {len(rq)} icone, ne servono {len(nomi)}')
        cartella = os.path.join(RADICE, 'media', 'icone', nome)
        os.makedirs(cartella, exist_ok=True)
        for (x0, y0, x1, y1), n in zip(rq, nomi):
            if not n: continue
            pezzo = tav.crop((max(0, x0 - 4), max(0, y0 - 4), x1 + 4, y1 + 4))
            icona = sagoma(pezzo) if solo_sagoma else scontorna(pezzo)
            if nome == 'eventi':
                # spazio per il bordo, prima di gonfiarlo
                icona = ImageOps.expand(icona, border=12, fill=(255, 255, 255, 0))
                icona = adesivo(icona)
            quadra(icona).save(os.path.join(cartella, n + '.png'), optimize=True)
        print(f'{nome}: {sum(1 for n in nomi if n)} icone')


if __name__ == '__main__':
    main()
