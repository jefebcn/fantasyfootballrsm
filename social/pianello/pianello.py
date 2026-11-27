"""Immagini per la notizia del FantaFutsal su Il Pianello (27/11/2026).
Niente foto IA, niente nomi di giocatori, niente indirizzo del sito nella grafica.
uso: python3 pianello.py <kit> <cartella>"""
import sys, math
from PIL import Image, ImageDraw, ImageFilter
K, N = sys.argv[1], sys.argv[2]
sys.path.insert(0, K)
from brand import font, band, grain, WHITE, LIME, PURPLE, AD

OR = (255, 75, 43)


def logo(img, x, y, h=46):
    """Marchio del lancio del futsal (src/lancio-futsal.js, 1-14/12): la corona originale,
    meta' viola Fantatitano e meta' arancio futsal, taglio sulla punta centrale."""
    m = Image.open(AD + "crown_mask.png")
    w = int(m.width * h / m.height)
    m = m.resize((w, h), Image.LANCZOS)
    cr = Image.new("RGBA", (w, h), PURPLE + (255,))
    cut = round(w * .512)
    cr.paste(Image.new("RGBA", (w - cut, h), OR + (255,)), (cut, 0))
    cr.putalpha(m)
    img.alpha_composite(cr, (x, y))
    f = font("anton", int(h * 0.92))
    d = ImageDraw.Draw(img)
    tx = x + w + int(h * 0.28); ty = y + h // 2
    d.text((tx, ty), "FANTA", font=f, fill=WHITE, anchor="lm")
    d.text((tx + d.textlength("FANTA", font=f), ty), "TITANO", font=f, fill=LIME, anchor="lm")
NERO = (17, 17, 17)
SCURO = (42, 42, 42)
GRIGIO = (200, 200, 205)
PALLA = Image.open(f"{N}/pallone.png").convert("RGBA").crop((52, 52, 548, 548))


def sfondo(w, h):
    im = Image.new("RGBA", (w, h), NERO + (255,))
    d = ImageDraw.Draw(im)
    # pannello scuro in diagonale e taglio arancione, come nel benvenuto dell'app
    d.polygon([(int(w * .42), 0), (w, 0), (w, h), (int(w * .18), h)], fill=(26, 26, 26))
    s = int(min(w, h) * .022)
    d.polygon([(int(w * .30), h), (int(w * .30) + s * 3, h), (w, int(h * .62) - s), (w, int(h * .62) + s * 2)], fill=OR)
    return im


def palla(h):
    return PALLA.resize((h, h), Image.LANCZOS)


def titolo(im, x, y, size):
    """pallone + FANTA (bianco) FUTSAL (arancione); torna la x di fine e il fondo."""
    d = ImageDraw.Draw(im)
    f = font("anton", size)
    bb = d.textbbox((0, 0), "FANTA", font=f)
    cap = bb[3] - bb[1]
    p = palla(int(cap * 1.08))
    im.alpha_composite(p, (x, y + (cap - p.height) // 2))
    tx = x + p.width + int(size * .14)
    d.text((tx, y - bb[1]), "FANTA", font=f, fill=WHITE)
    tx2 = tx + d.textlength("FANTA", font=f)
    d.text((tx2, y - bb[1]), "FUTSAL", font=f, fill=OR)
    end = tx2 + d.textlength("FUTSAL", font=f)
    # sottolineatura arancione inclinata
    u = int(size * .07)
    d.polygon([(tx, y + cap + u), (end, y + cap + u * .4), (end, y + cap + u * 1.4), (tx, y + cap + u * 2)], fill=OR)
    return end, y + cap + u * 2


def testo(im, x, y, righe, size, fname="m700", col=WHITE, lh=1.25):
    d = ImageDraw.Draw(im)
    f = font(fname, size)
    for r in righe:
        d.text((x, y), r, font=f, fill=col)
        y += int(size * lh)
    return y


def punti(im, x, y, righe, size, maxw):
    d = ImageDraw.Draw(im)
    f = font("m600", size)
    for r in righe:
        q = int(size * .5)
        d.polygon([(x, y + q * .5), (x + q * 1.2, y + q * .5), (x + q * .9, y + q * 1.6), (x - q * .3, y + q * 1.6)], fill=OR)
        # a capo se serve
        parole, riga, out = r.split(), "", []
        for p in parole:
            t = (riga + " " + p).strip()
            if d.textlength(t, font=f) > maxw and riga:
                out.append(riga); riga = p
            else:
                riga = t
        out.append(riga)
        for o in out:
            d.text((x + q * 2, y), o, font=f, fill=WHITE)
            y += int(size * 1.3)
        y += int(size * .55)
    return y


def telefono(scr, h):
    s = Image.open(scr).convert("RGB")
    w = int(s.width * h / s.height)
    s = s.resize((w, h), Image.LANCZOS)
    b = max(10, h // 55); r = int(h * .068)
    ph = Image.new("RGBA", (w + 2 * b, h + 2 * b), (0, 0, 0, 0))
    d = ImageDraw.Draw(ph)
    d.rounded_rectangle((0, 0, ph.width - 1, ph.height - 1), radius=r + b, fill=(10, 10, 12))
    d.rounded_rectangle((2, 2, ph.width - 3, ph.height - 3), radius=r + b - 2, outline=(80, 80, 88), width=3)
    m = Image.new("L", s.size, 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, w - 1, h - 1), radius=r, fill=255)
    ph.paste(s, (b, b), m)
    return ph


def metti(im, ph, x, y, ang=0):
    if ang:
        ph = ph.rotate(ang, expand=True, resample=Image.BICUBIC)
    sh = Image.new("RGBA", ph.size, (0, 0, 0, 0)); sh.putalpha(ph.getchannel("A").point(lambda v: int(v * .6)))
    sh = sh.filter(ImageFilter.GaussianBlur(24))
    im.alpha_composite(sh, (x + 12, y + 26)); im.alpha_composite(ph, (x, y))
    return ph.size


def firma(im, size):
    w, h = im.size
    d = ImageDraw.Draw(im)
    d.polygon([(0, h - 14), (300, h - 14), (286, h), (0, h)], fill=OR)
    d.polygon([(314, h - 14), (470, h - 14), (456, h), (300, h)], fill=WHITE)


SCR = f"{N}/iscrizione.png"
PUNTI = ["Gratis, con lo stesso account del calcio",
         "Una rosa di 8 giocatori veri più la Porta",
         "Punti dai referti ufficiali delle partite"]

# ---------- post 1080x1350 ----------
im = sfondo(1080, 1350)
logo(im, 56, 50, h=54)
_, yb = titolo(im, 60, 170, 132)
y = testo(im, 64, yb + 34, ["Il fanta del Campionato", "Sammarinese di Futsal"], 44, "m700")
y = band(im, 64, y + 40, "DAL 1° DICEMBRE", size=84, bg=OR, fg=WHITE, angle=-2.5)
y = testo(im, 70, y + 18, ["si parte martedì"], 34, "m600", GRIGIO)
punti(im, 70, y + 60, PUNTI, 31, 420)
metti(im, telefono(SCR, 730), 650, 515, ang=-5)
testo(im, 70, 1250, ["Nell'app Fantatitano"], 30, "m700", WHITE)
grain(im).convert("RGB").save(f"{N}/pianello-post-1080x1350.jpg", quality=95)

# ---------- sito 1200x675 ----------
im = sfondo(1200, 675)
logo(im, 48, 34, h=44)
_, yb = titolo(im, 50, 118, 104)
y = testo(im, 54, yb + 22, ["Il fanta del Campionato Sammarinese di Futsal"], 30, "m700")
y = band(im, 54, y + 28, "DAL 1° DICEMBRE", size=72, bg=OR, fg=WHITE, angle=-2.5)
y = testo(im, 58, y + 12, ["si parte martedì"], 26, "m600", GRIGIO)
punti(im, 58, y + 34, PUNTI[:1] + PUNTI[2:], 24, 600)
metti(im, telefono(SCR, 560), 836, 40, ang=-5)
grain(im).convert("RGB").save(f"{N}/pianello-sito-1200x675.jpg", quality=95)

# ---------- storia 1080x1920 (fasce di Instagram: 250 px sopra e sotto) ----------
im = sfondo(1080, 1920)
logo(im, 56, 258, h=58)
_, yb = titolo(im, 60, 370, 138)
y = testo(im, 64, yb + 36, ["Il fanta del Campionato", "Sammarinese di Futsal"], 46, "m700")
y = band(im, 64, y + 44, "DAL 1° DICEMBRE", size=104, bg=OR, fg=WHITE, angle=-2.5)
y = testo(im, 70, y + 18, ["da martedì, gratis nell'app"], 36, "m600", GRIGIO)
hph = 1790 - (y + 60)
ph = telefono(SCR, hph)
pw = ph.rotate(-4, expand=True).size[0]
metti(im, ph, (1080 - pw) // 2 + 30, y + 50, ang=-4)
grain(im).convert("RGB").save(f"{N}/pianello-storia-1080x1920.jpg", quality=95)
print("ok")
