"""
Ricava dal logo originale (media/logo.png) gli asset dell'app:
 - media/logo-mask.png  sagoma su fondo trasparente, usata come maschera CSS:
                        l'app la colora con currentColor, così funziona su chiaro e su scuro
 - icons/*.png          icone PWA: logo bianco sul gradiente Azzurro Titano

Uso:  python3 scripts/make-logo.py [sorgente]
Il file sorgente può essere nero su bianco o già ritagliato con trasparenza.
"""
import sys, os
from PIL import Image

AZZURRO, NOTTE = (0x1B, 0x84, 0xC6), (0x07, 0x2F, 0x4C)
SRC = sys.argv[1] if len(sys.argv) > 1 else 'media/logo.png'


CHIARO, SCURO = 232, 120   # soglie: sopra è sfondo, sotto è inchiostro pieno


def sagoma(path):
    """Estrae la sagoma: alpha 255 sull'inchiostro, 0 sullo sfondo, sfumato sui bordi.

    La soglia serve perché un JPEG porta artefatti attorno al nero: senza,
    lo sfondo resterebbe velato invece che trasparente.
    """
    im = Image.open(path).convert('RGBA')
    px = im.load()
    w, h = im.size
    ha_alpha = any(px[x, y][3] < 250 for x in range(0, w, 7) for y in range(0, h, 7))
    m = Image.new('L', (w, h), 0)
    mp = m.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if ha_alpha:
                mp[x, y] = a
                continue
            lum = (r * 299 + g * 587 + b * 114) // 1000
            if lum >= CHIARO: v = 0
            elif lum <= SCURO: v = 255
            else: v = int((CHIARO - lum) * 255 / (CHIARO - SCURO))
            mp[x, y] = v
    return m


def ritaglia(m, margine=0.06):
    box = m.getbbox()
    if not box:
        raise SystemExit('Il file sembra vuoto: nessuna sagoma trovata.')
    m = m.crop(box)
    lato = int(max(m.size) * (1 + 2 * margine))
    out = Image.new('L', (lato, lato), 0)
    out.paste(m, ((lato - m.width) // 2, (lato - m.height) // 2))
    return out


def maschera(m, lato=512):
    q = m.resize((lato, lato), Image.LANCZOS)
    out = Image.new('RGBA', (lato, lato), (255, 255, 255, 0))
    out.putalpha(q)
    out.paste((255, 255, 255), (0, 0), q)   # sagoma bianca, per l'uso come immagine
    out.putalpha(q)
    return out


def icona(m, lato, pad=0.18, tondo=True):
    im = Image.new('RGBA', (lato, lato), (0, 0, 0, 0))
    p = im.load()
    r = lato * 0.22 if tondo else 0
    for y in range(lato):
        t = y / lato
        col = (int(AZZURRO[0] * (1 - t) + NOTTE[0] * t), int(AZZURRO[1] * (1 - t) + NOTTE[1] * t), int(AZZURRO[2] * (1 - t) + NOTTE[2] * t), 255)
        for x in range(lato):
            if tondo:
                cx = min(max(x + .5, r), lato - r); cy = min(max(y + .5, r), lato - r)
                if (x + .5 - cx) ** 2 + (y + .5 - cy) ** 2 > r * r:
                    continue
            p[x, y] = col
    dentro = int(lato * (1 - 2 * pad))
    q = m.resize((dentro, dentro), Image.LANCZOS)
    bianco = Image.new('RGBA', (dentro, dentro), (255, 255, 255, 255))
    im.paste(bianco, (int(lato * pad), int(lato * pad)), q)
    return im


if not os.path.exists(SRC):
    raise SystemExit(f'Manca {SRC}: mettici il logo (PNG o JPG) e rilancia.')
m = ritaglia(sagoma(SRC))
os.makedirs('icons', exist_ok=True)
maschera(m).save('media/logo-mask.png')

# La maschera viaggia dentro il CSS come data URI: niente richiesta separata,
# niente riquadro pieno se l'immagine non arriva, e funziona anche offline.
import base64
b64 = base64.b64encode(open('media/logo-mask.png', 'rb').read()).decode()
open('styles/logo.css', 'w').write(
    '/* Generato da scripts/make-logo.py — non modificare a mano. */\n'
    '.logo{display:inline-block;width:24px;height:24px;flex:none;background-color:currentColor;\n'
    f'  -webkit-mask:url(data:image/png;base64,{b64}) center/contain no-repeat;\n'
    f'  mask:url(data:image/png;base64,{b64}) center/contain no-repeat}}\n')
print('styles/logo.css:', round(len(b64) / 1024), 'KB di maschera')
icona(m, 512).save('icons/icon-512.png')
icona(m, 192).save('icons/icon-192.png')
icona(m, 180, tondo=False).save('icons/apple-touch-icon.png')
icona(m, 512, pad=0.28, tondo=False).save('icons/maskable-512.png')
print('fatto: media/logo-mask.png e icons/*.png')
