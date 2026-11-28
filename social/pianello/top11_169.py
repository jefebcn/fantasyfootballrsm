"""La Top 11 della giornata in 16:9 per la rubrica settimanale su Il Pianello.
Stesso campo, personaggi e stemmi del post del kit (render.top11), disegnati
direttamente a 1920x1080: niente ingrandimenti del post, quindi niente immagine
morbida. Niente foto, niente crediti, niente «FSGC», niente indirizzo del sito.
uso: AVATAR=1 python3 top11_169.py <kit> <data.json> <cartella>
     (data.json: quello di ft_data.mjs del kit, lo stesso dei post)"""
import sys, os, json
from PIL import Image, ImageDraw
K, DATA, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
sys.path.insert(0, K)
os.environ.setdefault("AVATAR", "1")
from brand import font, band, headline, logo, glow, grain, stemma, WHITE, LIME, PURPLE, BLACK
from render import pitch, roles_rows, v, fit, CARD, MUTED

W, H = 1920, 1080
D = json.load(open(DATA))
L = D["lastMatchday"]; n = L["number"]; xi = L["bestXI"]; b0 = L["top"][0]

img = Image.new("RGBA", (W, H), (8, 8, 14, 255))
glow(img, 300, H, 900, (40, 10, 140), 255)
glow(img, W - 200, 60, 520, PURPLE, 150)

# colonna di sinistra: marchio, titolo, il migliore, i numeri della giornata
X = 72; COL = 640
logo(img, X, 64, dark=True, h=54)
y = headline(img, X, 180, [[("LA TOP 11", WHITE)]], size=170)
y = band(img, X - 6, y + 22, f"GIORNATA {n}", size=118, bg=LIME, fg=BLACK, angle=-3)

d = ImageDraw.Draw(img)
y += 56
d.text((X, y), "IL MIGLIORE", font=font("m800", 28), fill=LIME)
y += 44
fn = fit(b0["full"].upper(), "anton", COL, 76)
d.text((X, y), b0["full"].upper(), font=fn, fill=WHITE)
y += fn.size + 26
stemma(img, b0.get("clubId"), X + 22, y + 20, 44); d = ImageDraw.Draw(img)
d.text((X + 58, y + 20), f"{b0['club']} · fantavoto {v(b0['fv'])}", font=font("m700", 34), fill=WHITE, anchor="lm")

# tre caselle coi numeri della giornata
y += 76
nums = [("GOL", str(L["goals"])), ("PARTITE", str(len(L["results"]))), ("MIGLIOR VOTO", v(b0["fv"]))]
gap = 18; cw = (COL - gap * 2) // 3; ch = 130
for i, (lab, val) in enumerate(nums):
    x0 = X + i * (cw + gap)
    d.rounded_rectangle((x0, y, x0 + cw, y + ch), radius=20, fill=CARD)
    d.text((x0 + cw / 2, y + 54), val, font=font("anton", 70), fill=LIME, anchor="mm")
    d.text((x0 + cw / 2, y + 106), lab, font=fit(lab, "m800", cw - 24, 24), fill=MUTED, anchor="mm")

# firma lime e viola in basso a sinistra, come nei post
d.polygon([(0, H - 16), (340, H - 16), (324, H), (0, H)], fill=LIME)
d.polygon([(356, H - 16), (530, H - 16), (514, H), (340, H)], fill=PURPLE)

# a destra il campo del post, alla risoluzione giusta
pitch(img, (790, 56, W - 56, H - 56), roles_rows({"A": xi["A"], "C": xi["C"], "D": xi["D"], "P": xi["P"]}),
      lambda p: f"{p['clubShort']} · {v(p['fv'])}")

os.makedirs(OUT, exist_ok=True)
dest = f"{OUT}/top11-g{n}-1920x1080.jpg"
grain(img).convert("RGB").save(dest, quality=95)
print(dest)
