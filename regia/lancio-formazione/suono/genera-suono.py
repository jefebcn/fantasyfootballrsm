"""Musica ed effetti del video "Lancio Fantatitano: la formazione".

Composti qui, da codice, e non presi da una libreria: cosi' non ci sono
diritti da verificare per l'inserzione (decisione C.3 C del foglio di regia).
Il foglio fissa i tempi (D.1, D.2): 120 BPM, la minore, un suono che sale fino
a 1,0 s, l'esplosione sul taglio a 1,0 s, il colpo finale a 19,5 s e la coda
fino a 20,0 s. Versione 2 (dopo la nota di Alex sul "tempo morto"): l'accento
su "salvata" va a 11,1 s, e prima del marchio c'e' una pausa che sale (14,0-15,0 s)
e cade sul marchio a 15,0 s. Gli altri colpi (parole che sbattono, passaggi,
giocatori che entrano, coriandoli) sono effetti separati, messi nel video.

    python3 regia/lancio-formazione/suono/genera-suono.py <cartella-uscita>

Scrive musica-grezza.wav e gli effetti sfx-*.wav (44,1 kHz).
La normalizzazione a -14 LUFS la fa ffmpeg, dopo (vedi in fondo).
"""
import sys
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

SR = 44100
BPM = 120
BEAT = 60 / BPM            # 0,5 s
DUR = 20.0
RNG = np.random.default_rng(7)   # rumore sempre uguale: il file si rifa' identico


def t(n):
    return np.arange(int(n * SR)) / SR


def lp(x, f):
    return sosfilt(butter(4, f, 'low', fs=SR, output='sos'), x)


def hp(x, f):
    return sosfilt(butter(4, f, 'high', fs=SR, output='sos'), x)


def bp(x, lo, hi):
    return sosfilt(butter(2, [lo, hi], 'band', fs=SR, output='sos'), x)


def add(buf, at, sig, gain=1.0):
    i = int(at * SR)
    j = min(len(buf), i + len(sig))
    if i < len(buf):
        buf[i:j] += sig[: j - i] * gain


def hz(nota):
    """'A1' -> 55 Hz. Solo le note che servono."""
    nomi = {'C': -9, 'D': -7, 'E': -5, 'F': -4, 'G': -2, 'A': 0, 'B': 2}
    return 440 * 2 ** ((nomi[nota[0]] + 12 * (int(nota[1:]) - 4)) / 12)


# --- strumenti -----------------------------------------------------------
def kick():
    x = t(0.4)
    f = 48 + 110 * np.exp(-x / 0.03)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.14)
    s[:60] += RNG.normal(0, 0.4, 60)            # il "click" d'attacco
    return s


def basso(f, lun=0.22):
    x = t(lun)
    s = np.sin(2 * np.pi * f * x) + 0.3 * np.sin(2 * np.pi * 2 * f * x)
    env = np.minimum(1, x / 0.005) * np.exp(-x / 0.12)
    return lp(s * env, 400)


def hat(lun=0.05):
    x = t(lun)
    return hp(RNG.normal(0, 1, len(x)), 7000) * np.exp(-x / 0.012)


def clap():
    x = t(0.18)
    s = bp(RNG.normal(0, 1, len(x)), 900, 2600)
    env = np.exp(-x / 0.05)
    for k in (0.0, 0.011, 0.022):                # tre battute ravvicinate, come mani
        env += np.where((x >= k) & (x < k + 0.008), 0.8, 0)
    return s * env


def accordo(note, lun=0.3, aper=2600):
    x = t(lun)
    s = np.zeros_like(x)
    for n in note:
        f = hz(n)
        for h in range(1, 9):                    # dente di sega troncato
            s += np.sin(2 * np.pi * f * h * x * (1 + 0.002 * (h % 2))) / h
    env = np.minimum(1, x / 0.004) * np.exp(-x / (lun * 0.45))
    return lp(s * env, aper) / len(note)


def impatto(lun=1.0):
    x = t(lun)
    boom = np.sin(2 * np.pi * (40 + 30 * np.exp(-x / 0.05)) * x) * np.exp(-x / 0.35)
    rumore = lp(RNG.normal(0, 1, len(x)), 3000) * np.exp(-x / 0.12)
    return boom * 1.2 + rumore * 0.6


def piatto(lun=1.4):
    x = t(lun)
    return hp(RNG.normal(0, 1, len(x)), 5000) * np.exp(-x / 0.45)


def salita(lun=1.0):
    """Il suono che sale fino al taglio: rumore che si apre e un tono che sale."""
    x = t(lun)
    rumore = RNG.normal(0, 1, len(x))
    s = np.zeros_like(x)
    pezzi = 20
    for k in range(pezzi):                        # filtro che si apre a gradini corti
        a, b = k * len(x) // pezzi, (k + 1) * len(x) // pezzi
        s[a:b] = bp(rumore, 300 + 6000 * (k / pezzi) ** 2, 400 + 9000 * (k / pezzi) ** 2 + 200)[a:b]
    tono = np.sin(2 * np.pi * np.cumsum(220 + 660 * (x / lun) ** 2) / SR)
    env = (x / lun) ** 2
    return (s * 0.8 + tono * 0.25) * env


# --- la musica ---------------------------------------------------------------
def musica():
    L = np.zeros(int(DUR * SR))
    R = np.zeros(int(DUR * SR))
    mono = np.zeros(int(DUR * SR))

    # 0,0-1,0 s: sale, e a 1,0 s esplode (il taglio su SERIE A)
    add(mono, 0.0, salita(1.0), 0.55)
    add(mono, 1.0, impatto(1.2), 0.9)
    add(mono, 1.0, piatto(1.6), 0.25)

    # giri di due secondi (una battuta), dal taglio in poi: la-fa-do-sol
    giro = [('A1', ['A3', 'C4', 'E4']), ('F1', ['F3', 'A3', 'C4']),
            ('C2', ['C4', 'E4', 'G4']), ('G1', ['G3', 'B3', 'D4'])]
    battuta = 1.0
    k = 0
    while battuta < 19.5 - 1e-6:
        radice, triade = giro[k % 4]
        for b in range(4):                        # i quattro battiti della battuta
            at = battuta + b * BEAT
            if at >= 19.5 - 1e-6:
                break
            pausa = 14.0 - 1e-6 <= at < 15.0 - 1e-6   # 14,0-15,0 s: niente cassa ne' basso, sale
            if not pausa:
                add(mono, at, kick(), 0.95)
                add(mono, at + BEAT / 2, basso(hz(radice)), 0.75)   # basso in levare
            add(mono, at + BEAT / 2, hat(), 0.18)
            if b in (1, 3):
                add(mono, at, clap(), 0.35)
        # accordi: sul primo battito e in levare sul terzo
        stab = accordo(triade, 0.32)
        add(L, battuta, stab, 0.32); add(R, battuta + 0.012, stab, 0.32)
        add(L, battuta + 2 * BEAT + BEAT / 2, stab, 0.22); add(R, battuta + 2 * BEAT + BEAT / 2 + 0.012, stab, 0.22)
        battuta += 4 * BEAT
        k += 1

    # 11,1 s: l'accento su "Formazione salvata"
    add(mono, 11.1, piatto(1.4), 0.3)
    acc = accordo(['C4', 'E4', 'G4', 'C5'], 0.8, 3400)
    add(L, 11.1, acc, 0.35); add(R, 11.112, acc, 0.35)

    # 14,0-15,0 s: la pausa sale (rullo che accelera + rumore che si apre), 15,0 s cade sul marchio
    add(mono, 14.0, salita(1.0), 0.5)
    for k in range(16):
        at = 14.0 + 1.0 * (1 - (1 - k / 16) ** 1.6)   # i colpi si stringono verso 15,0
        add(mono, at, clap(), 0.12 + 0.25 * k / 16)
    add(mono, 15.0, impatto(1.2), 0.9)
    add(mono, 15.0, piatto(1.6), 0.28)

    # 19,5 s: il colpo finale, e la coda fino a 20,0 s
    add(mono, 19.5, kick(), 1.0)
    add(mono, 19.5, impatto(0.5), 0.7)
    fine = accordo(['A2', 'A3', 'C4', 'E4'], 0.5, 3000)
    add(L, 19.5, fine, 0.4); add(R, 19.512, fine, 0.4)

    L += mono
    R += mono
    coda = int(0.08 * SR)                         # niente click sull'ultimo campione
    for c in (L, R):
        c[-coda:] *= np.linspace(1, 0, coda)
    st = np.stack([L, R], 1)
    return st / np.max(np.abs(st)) * 0.89


# --- gli effetti ---------------------------------------------------------------
def sfx_fendente():
    """Soffio che sale per 0,2 s, poi il colpo a 50 Hz. Il colpo cade a 0,2 s
    del file: nel video il file parte a 0,8 s, cosi' il colpo e' a 1,0 s."""
    x = t(0.2)
    soffio = bp(RNG.normal(0, 1, len(x)), 1500, 9000) * (x / 0.2) ** 1.5
    y = t(0.6)
    colpo = np.sin(2 * np.pi * (50 + 60 * np.exp(-y / 0.03)) * y) * np.exp(-y / 0.18)
    s = np.concatenate([soffio * 0.7, colpo])
    return s / np.max(np.abs(s)) * 0.89


def sfx_tick():
    x = t(0.03)
    s = np.sin(2 * np.pi * 2000 * x) * np.exp(-x / 0.008)
    return s / np.max(np.abs(s)) * 0.6


def sfx_conferma():
    out = []
    for f in (880, 1320):
        x = t(0.125)
        s = (np.sin(2 * np.pi * f * x) + 0.25 * np.sin(2 * np.pi * 2 * f * x)) * np.minimum(1, x / 0.005) * np.exp(-x / 0.07)
        out.append(s)
    s = np.concatenate(out)
    return s / np.max(np.abs(s)) * 0.8


def sfx_colpo():
    """Una parola che sbatte: tonfo basso e uno schiocco."""
    x = t(0.45)
    tonfo = np.sin(2 * np.pi * (55 + 90 * np.exp(-x / 0.025)) * x) * np.exp(-x / 0.13)
    schiocco = bp(RNG.normal(0, 1, len(x)), 1200, 6000) * np.exp(-x / 0.02)
    s = tonfo + 0.5 * schiocco
    return s / np.max(np.abs(s)) * 0.89


def sfx_soffio():
    """Passaggio: rumore che si apre e si richiude in 0,4 s, picco a 0,3 s."""
    x = t(0.4)
    rumore = RNG.normal(0, 1, len(x))
    s = np.zeros_like(x)
    pezzi = 16
    for k in range(pezzi):
        a, b = k * len(x) // pezzi, (k + 1) * len(x) // pezzi
        c = 600 + 5000 * np.sin(np.pi * min(1, (k + 0.5) / pezzi / 0.75) / 2) ** 2
        s[a:b] = bp(rumore, c * 0.6, min(c * 1.6, 16000))[a:b]
    env = np.where(x < 0.3, (x / 0.3) ** 2, np.exp(-(x - 0.3) / 0.03))
    s = s * env
    return s / np.max(np.abs(s)) * 0.7


def sfx_pop():
    """Un giocatore che entra in campo, una pastiglia che spunta."""
    x = t(0.1)
    f = 500 + 900 * (1 - np.exp(-x / 0.02))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.minimum(1, x / 0.002) * np.exp(-x / 0.03)
    return s / np.max(np.abs(s)) * 0.6


def sfx_scintille():
    """Il campo pieno: una manciata di campanelli acuti."""
    x = t(0.7)
    s = np.zeros_like(x)
    for k, f in enumerate([2637, 3136, 3520, 4186, 3951, 5274]):
        at = k * 0.06
        y = t(0.7 - at)
        add(s, at, np.sin(2 * np.pi * f * y) * np.exp(-y / 0.12), 1.0)
    return s / np.max(np.abs(s)) * 0.5


def sfx_coriandoli():
    """La conferma: uno scoppio e la carta che crepita."""
    x = t(0.8)
    scoppio = bp(RNG.normal(0, 1, len(x)), 300, 4000) * np.exp(-x / 0.03)
    crepitio = hp(RNG.normal(0, 1, len(x)), 4000) * (RNG.random(len(x)) > 0.985) * np.exp(-x / 0.3) * 3
    s = scoppio + crepitio
    return s / np.max(np.abs(s)) * 0.7


def scrivi(cartella, nome, s):
    wavfile.write(cartella / nome, SR, (np.clip(s, -1, 1) * 32767).astype(np.int16))


if __name__ == '__main__':
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    scrivi(out, 'musica-grezza.wav', musica())
    scrivi(out, 'sfx-fendente.wav', sfx_fendente())
    scrivi(out, 'sfx-tick.wav', sfx_tick())
    scrivi(out, 'sfx-conferma.wav', sfx_conferma())
    scrivi(out, 'sfx-colpo.wav', sfx_colpo())
    scrivi(out, 'sfx-soffio.wav', sfx_soffio())
    scrivi(out, 'sfx-pop.wav', sfx_pop())
    scrivi(out, 'sfx-scintille.wav', sfx_scintille())
    scrivi(out, 'sfx-coriandoli.wav', sfx_coriandoli())
    # poi:  ffmpeg -i musica-grezza.wav -af loudnorm=I=-14:TP=-1:LRA=11 -ar 44100 musica.wav
