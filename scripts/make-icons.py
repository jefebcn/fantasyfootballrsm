"""Genera le icone PNG (tre torri su azzurro Titano) senza dipendenze esterne."""
import struct, zlib, os, math

AZZURRO = (0x1B, 0x84, 0xC6); NOTTE = (0x07, 0x2F, 0x4C); BIANCO = (255, 255, 255); ORO = (0xFF, 0xC9, 0x4D)

def png(path, size, pixels):
    raw = b''.join(b'\x00' + bytes(px for x in range(size) for px in pixels[y][x]) for y in range(size))
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    open(path, 'wb').write(data)

def draw(size, pad=0.0, rounded=True):
    px = [[(0, 0, 0, 0)] * size for _ in range(size)]
    r = size * (0.22 if rounded else 0)
    inner = size * pad
    def inside(x, y):
        if not rounded: return True
        cx = min(max(x, r), size - r); cy = min(max(y, r), size - r)
        return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
    for y in range(size):
        for x in range(size):
            if inside(x + .5, y + .5):
                t = y / size
                px[y][x] = (int(AZZURRO[0] * (1 - t) + NOTTE[0] * t), int(AZZURRO[1] * (1 - t) + NOTTE[1] * t), int(AZZURRO[2] * (1 - t) + NOTTE[2] * t), 255)
    # tre torri: (x0, larghezza, altezza) in frazione dell'area utile
    s = size - 2 * inner; ox = inner; base_y = inner + s * 0.80
    towers = [(0.14, 0.16, 0.30), (0.42, 0.20, 0.50), (0.72, 0.14, 0.24)]
    for tx, tw, th in towers:
        x0 = int(ox + s * tx); x1 = int(ox + s * (tx + tw)); y0 = int(base_y - s * th); y1 = int(base_y)
        for y in range(y0, y1):
            for x in range(x0, x1): px[y][x] = (*BIANCO, 255)
        # merli
        mw = max(2, (x1 - x0) // 5); mh = max(2, int(s * 0.035))
        for i, x in enumerate(range(x0, x1, mw)):
            if i % 2 == 0:
                for yy in range(max(0, y0 - mh), y0):
                    for xx in range(x, min(x1, x + mw)): px[yy][xx] = (*BIANCO, 255)
    # penna sulla torre centrale (Cesta)
    cx = int(ox + s * 0.52); top = int(base_y - s * 0.50 - s * 0.035)
    for yy in range(top - int(s * 0.10), top):
        for xx in range(cx - 1, cx + 2): px[yy][xx] = (*ORO, 255)
    for i in range(int(s * 0.06)):
        for xx in range(cx + 2, cx + 2 + int(s * 0.06) - i): px[top - int(s * 0.10) + i][xx] = (*ORO, 255)
    # monte
    for y in range(int(base_y), int(inner + s * 0.92)):
        for x in range(int(ox + s * 0.04), int(ox + s * 0.96)):
            if inside(x + .5, y + .5): px[y][x] = (0x35, 0xB3, 0x7E, 255)
    return px

os.makedirs('icons', exist_ok=True)
png('icons/icon-512.png', 512, draw(512))
png('icons/icon-192.png', 192, draw(192))
png('icons/apple-touch-icon.png', 180, draw(180, rounded=False))
png('icons/maskable-512.png', 512, draw(512, pad=0.12, rounded=False))
print('icons ok')
