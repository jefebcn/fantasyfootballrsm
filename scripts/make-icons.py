"""Genera le icone PNG (tre torri su azzurro Titano) senza dipendenze esterne."""
import struct, zlib, os, math

AZZURRO = (0x1B, 0x84, 0xC6); NOTTE = (0x07, 0x2F, 0x4C); BIANCO = (255, 255, 255); ORO = (0xFF, 0xC9, 0x4D)

def png(path, size, pixels):
    raw = b''.join(b'\x00' + bytes(px for x in range(size) for px in pixels[y][x]) for y in range(size))
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    open(path, 'wb').write(data)

def draw(size, pad=0.0, rounded=True):
    """Sfondo azzurro Titano con le tre torri merlate, stendardo e finestre ad arco."""
    px = [[(0, 0, 0, 0)] * size for _ in range(size)]
    r = size * (0.22 if rounded else 0)
    def inside(x, y):
        if not rounded: return True
        cx = min(max(x, r), size - r); cy = min(max(y, r), size - r)
        return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
    for y in range(size):
        for x in range(size):
            if inside(x + .5, y + .5):
                t = y / size
                px[y][x] = (int(AZZURRO[0] * (1 - t) + NOTTE[0] * t), int(AZZURRO[1] * (1 - t) + NOTTE[1] * t), int(AZZURRO[2] * (1 - t) + NOTTE[2] * t), 255)
    sfondo = [row[:] for row in px]          # serve per ritagliare le finestre

    # stesse coordinate del simbolo SVG (viewBox 64), riscalate
    s = size * (1 - 2 * pad); o = size * pad
    U = lambda v: o + s * v / 64.0
    def blocco(x, y, w, h, col=BIANCO):
        for yy in range(int(U(y)), int(U(y + h))):
            for xx in range(int(U(x)), int(U(x + w))):
                if 0 <= yy < size and 0 <= xx < size and inside(xx + .5, yy + .5): px[yy][xx] = (*col, 255)
    def merli(x0, x1, y, h, n):
        w = (x1 - x0) / (n + (n - 1) * 0.42); gap = w * 0.42
        for i in range(n): blocco(x0 + i * (w + gap), y, w, h)
    def finestra(x, y, w, h):
        rr = w / 2.0
        for yy in range(int(U(y)), int(U(y + h))):
            for xx in range(int(U(x)), int(U(x + w))):
                if not (0 <= yy < size and 0 <= xx < size): continue
                cy = U(y + rr)
                if yy < cy:                       # arco superiore
                    dx = (xx - U(x + rr)) / max(1e-6, U(x + rr) - U(x)); dy = (yy - cy) / max(1e-6, cy - U(y))
                    if dx * dx + dy * dy > 1: continue
                px[yy][xx] = sfondo[yy][xx]

    BASE = 57
    blocco(12, 26, 10, BASE - 26); merli(12, 22, 22, 4.2, 3); blocco(22.9, 25, 2.4, 4.2)
    blocco(26, 16, 12, BASE - 16); merli(26, 38, 11.8, 4.4, 4); blocco(38.9, 14.8, 2.4, 4.4)
    blocco(42, 28, 10, BASE - 28); merli(42, 52, 24, 4.2, 3); blocco(52.9, 27, 2.4, 4.2)
    blocco(30.3, 2.6, 1.5, 9.4, ORO)                                  # asta
    for i in range(int(U(8.4)) - int(U(3.4))):                        # stendardo
        yy = int(U(3.4)) + i
        larg = (U(38.6) - U(31.8)) * (1 - abs(i - (U(8.4) - U(3.4)) / 2) / ((U(8.4) - U(3.4)) / 2))
        for xx in range(int(U(31.8)), int(U(31.8) + larg)):
            if 0 <= yy < size and 0 <= xx < size: px[yy][xx] = (*ORO, 255)
    finestra(15.2, 33, 3.4, 6); finestra(28.4, 23.5, 3.6, 6.4); finestra(32.6, 34, 3.6, 6.4); finestra(45.2, 35, 3.4, 6)
    return px

os.makedirs('icons', exist_ok=True)
png('icons/icon-512.png', 512, draw(512))
png('icons/icon-192.png', 192, draw(192))
png('icons/apple-touch-icon.png', 180, draw(180, rounded=False))
png('icons/maskable-512.png', 512, draw(512, pad=0.12, rounded=False))
print('icons ok')
