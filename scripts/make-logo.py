"""
Ricava dai due originali gli asset dell'app:
 - media/logo-mask.png  la corona (da media/logo.png), sagoma su fondo
                        trasparente usata come maschera CSS: l'app la colora
                        con currentColor, così funziona su chiaro e su scuro
 - icons/*.png          icone PWA: logo bianco sul gradiente Azzurro Titano
 - styles/logo.css      le due maschere in base64: .logo (la corona) e
                        .marchio (il marchio intero, da media/logoenter.jfif —
                        corona, FANTATITANO e il motto in un pezzo solo)

Uso:  python3 scripts/make-logo.py [sorgente] [sorgente-marchio]
I file sorgente possono essere neri su bianco, colorati su bianco, o già
ritagliati con trasparenza.
"""
import sys, os
from PIL import Image

AZZURRO, NOTTE = (0x1B, 0x84, 0xC6), (0x07, 0x2F, 0x4C)
SRC = sys.argv[1] if len(sys.argv) > 1 else 'media/logo.png'
SRC_MARCHIO = sys.argv[2] if len(sys.argv) > 2 else 'media/logoenter.jfif'


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


# La maschera viaggia in base64 DENTRO styles/logo.css, che si carica a ogni
# apertura: la sua misura e' peso su ogni avvio, non su una richiesta a parte.
# Il marchio piu' grande che l'app disegna e' 64px (l'accesso e lo splash),
# che su uno schermo a tripla densita' fa 192 pixel veri. Una maschera da 256
# li copre con margine, e a 512 non si guadagna niente: confrontate a 192px,
# la differenza fra le due e' 0,27 livelli su 255. Costa 15 kB in meno.
LATO_MASCHERA = 256


def maschera(m, lato=LATO_MASCHERA):
    q = m.resize((lato, lato), Image.LANCZOS)
    out = Image.new('RGBA', (lato, lato), (255, 255, 255, 0))
    out.putalpha(q)
    out.paste((255, 255, 255), (0, 0), q)   # sagoma bianca, per l'uso come immagine
    out.putalpha(q)
    return out


# IL MARCHIO INTERO, per lo splash.
#
# Non e' quadrato: ritagliarlo dentro un quadrato come la corona vorrebbe dire
# due fasce vuote e un disegno piu' piccolo del necessario. Qui si tiene la
# sua forma e la CSS riceve anche le proporzioni, cosi' la scatola non le
# sbaglia.
#
# LA LARGHEZZA, e il formato. Anche questa maschera viaggia in base64 dentro
# styles/logo.css, che si carica a ogni apertura: ogni kilobyte e' peso sul
# primo disegno, e lo splash e' proprio la schermata che non deve aspettare.
#
# Misurato: portate tutte a 690px (i pixel veri di 230px su uno schermo a
# tripla densita') e confrontate con la sagoma piena, le riduzioni si
# scostano dal riferimento di 2,96 - 2,33 - 1,85 - 1,40 livelli su 255 a 320,
# 384, 448 e 512 di larghezza, e pesano 12, 15, 17 e 20 kB di base64. A 448
# lo scostamento e' meno di un livello su cento e i 3 kB in piu' fino a 512
# non comprano niente che si veda.
#
# WebP senza perdita e non PNG: la stessa sagoma a 448 costa 17 kB di base64
# in WebP e 26 in PNG. Una maschera e' quasi tutta trasparenza e bordi
# sfumati, cioe' esattamente dove WebP guadagna.
LARGO_MARCHIO = 448


def ritaglia_libero(m, margine=0.02):
    box = m.getbbox()
    if not box:
        raise SystemExit('Il file del marchio sembra vuoto: nessuna sagoma trovata.')
    m = m.crop(box)
    dx, dy = int(m.width * margine), int(m.height * margine)
    out = Image.new('L', (m.width + 2 * dx, m.height + 2 * dy), 0)
    out.paste(m, (dx, dy))
    return out


def maschera_larga(m, largo=LARGO_MARCHIO):
    alto = max(1, round(m.height * largo / m.width))
    q = m.resize((largo, alto), Image.LANCZOS)
    out = Image.new('RGBA', (largo, alto), (255, 255, 255, 0))
    out.paste((255, 255, 255), (0, 0), q)
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
# La sagoma sta in una variabile CSS e non scritta due volte. Servono due
# proprieta' — quella prefissata per i Safari vecchi e quella standard — e
# prima ognuna si portava la sua copia del base64: lo stesso disegno, due
# volte, su un file che si carica a ogni apertura.
righe = ['/* Generato da scripts/make-logo.py — non modificare a mano. */\n',
         '.logo{display:inline-block;width:24px;height:24px;flex:none;background-color:currentColor;\n',
         f'  --sagoma:url(data:image/png;base64,{b64});\n',
         '  -webkit-mask:var(--sagoma) center/contain no-repeat;\n',
         '  mask:var(--sagoma) center/contain no-repeat}\n']
b64m = ''
if os.path.exists(SRC_MARCHIO):
    mm = maschera_larga(ritaglia_libero(sagoma(SRC_MARCHIO)))
    mm.save('media/marchio-mask.webp', lossless=True, quality=100, method=6)
    b64m = base64.b64encode(open('media/marchio-mask.webp', 'rb').read()).decode()
    righe += [
        '/* Il marchio intero: corona, nome e motto in un pezzo solo. aspect-ratio\n'
        '   e non un\'altezza fissa, cosi\' la scatola ha le proporzioni del disegno\n'
        '   e la maschera non si deforma ne\' lascia aria intorno. */\n',
        f'.marchio{{display:block;width:230px;aspect-ratio:{mm.width}/{mm.height};flex:none;background-color:currentColor;\n',
        f'  --marchio:url(data:image/webp;base64,{b64m});\n',
        '  -webkit-mask:var(--marchio) center/contain no-repeat;\n',
        '  mask:var(--marchio) center/contain no-repeat}\n']
else:
    print(f'nota: manca {SRC_MARCHIO}, .marchio non viene generato')
open('styles/logo.css', 'w').write(''.join(righe))
print('styles/logo.css:', round(len(b64) / 1024), 'KB di corona +', round(len(b64m) / 1024), 'KB di marchio')
icona(m, 512).save('icons/icon-512.png')
icona(m, 192).save('icons/icon-192.png')
icona(m, 180, tondo=False).save('icons/apple-touch-icon.png')
icona(m, 512, pad=0.28, tondo=False).save('icons/maskable-512.png')
print('fatto: media/logo-mask.png e icons/*.png')
