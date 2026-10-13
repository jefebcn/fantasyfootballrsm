#!/usr/bin/env python3
"""
Video degli highlights dal canale YouTube della FSGC.

Perche' da qui e non dall'API di YouTube: il feed RSS del canale e' pubblico,
non vuole una chiave, non ha quote e non obbliga a mettere un segreto nel
frontend. Il browser pero' non puo' leggerlo da solo (YouTube non manda le
intestazioni CORS), quindi si fa qui e si scrive un file statico, come gia'
si fa per calendario ed eventi.

I titoli del canale hanno una forma fissa:

    Campionato Sammarinese 2026-27, 3. giornata | Cosmos - Pennarossa 6-1

da cui si ricavano giornata e squadre, e quindi a quale partita appartiene il
video. Dalla 5ª (12/10) la FSGC li scrive senza la giornata:

    Campionato Sammarinese 2026-27 | HL Cosmos - Juvenes Dogana 1-0

e allora la giornata si trova nel calendario: la partita fra quelle due
squadre, in quell'ordine, giocata nei giorni prima della pubblicazione. Senza
questo i video della 5ª finivano fra «Dal canale» e la giornata restava
ferma alla 4ª. Quelli che non seguono la forma (i sondaggi sul gol piu' bello, le
interviste) restano come video del canale, senza partita.

Produce src/video-dati.js. Da rilanciare insieme a importa-fsgc.py.

    python3 scripts/importa-video.py
"""
import json, re, subprocess, sys, pathlib, unicodedata

CANALE = 'UCkVV6s3cR5JYY5AU6g96knA'   # @federazionesammarinesegiuo3026
FEED = f'https://www.youtube.com/feeds/videos.xml?channel_id={CANALE}'
RADICE = pathlib.Path(__file__).resolve().parent.parent

CLUB = {
    'folgore': 'folgore', 'murata': 'murata', 'juvenesdogana': 'juvenes', 'juvenes': 'juvenes',
    'faetano': 'faetano', 'sanmarinoacademy': 'academy', 'academy': 'academy', 'fiorentino': 'fiorentino',
    'cailungo': 'cailungo', 'domagnano': 'domagnano', 'cosmos': 'cosmos',
    'libertas': 'libertas', 'sangiovanni': 'sangiovanni', 'trepenne': 'trepenne',
    'trefiori': 'trefiori', 'pennarossa': 'pennarossa', 'virtus': 'virtus',
    'lafiorita': 'lafiorita',
}


def chiave(nome):
    """'La Fiorita' → 'lafiorita'. Toglie accenti, spazi e punteggiatura."""
    n = unicodedata.normalize('NFKD', nome).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z]', '', n.lower())


def prendi(url):
    r = subprocess.run(['curl', '-sS', '--fail', '-L', '-m', '40', url], capture_output=True)
    if r.returncode != 0:
        raise RuntimeError(f'non scaricabile: {r.stderr.decode()[:160]}')
    return r.stdout.decode('utf-8', 'replace')


def calendario():
    """Le partite di src/calendario-dati.js: [(giornata, casa, ospite, 'AAAA-MM-GG')]."""
    f = RADICE / 'src' / 'calendario-dati.js'
    if not f.exists():
        return []
    return [(int(n), a, b, d) for n, a, b, d in
            re.findall(r'\[(\d+),"([a-z0-9]+)","([a-z0-9]+)","(\d{4}-\d{2}-\d{2})', f.read_text(encoding='utf-8'))]


def giornata_di(casa, ospite, quando, cal):
    """La giornata della partita casa-ospite giocata fino a 10 giorni prima di `quando`."""
    if not quando:
        return None
    from datetime import date
    q = date.fromisoformat(quando)
    giuste = [(d, n) for n, a, b, d in cal if a == casa and b == ospite
              and 0 <= (q - date.fromisoformat(d)).days <= 10]
    return max(giuste)[1] if giuste else None


def smonta(titolo, quando='', cal=None):
    """→ (giornata, casa, ospite) oppure None se il titolo non e' di una partita."""
    m = re.search(r'(\d+)\s*\.?\s*giornata\s*\|\s*(.+?)\s+-\s+(.+?)\s*$', titolo, re.I)
    n = None
    if m:
        n = int(m.group(1))
        casa, ospite = m.group(2), m.group(3)
    else:
        # la forma della 5ª: «… | HL Casa - Ospite 1-0», senza la giornata
        m = re.search(r'\|\s*(?:HL\s+)?(.+?)\s+-\s+(.+?)\s*$', titolo, re.I)
        if not m:
            return None
        casa, ospite = m.group(1), m.group(2)
    # in coda al nome dell'ospite c'e' spesso il risultato: "Pennarossa 6-1"
    ospite = re.sub(r'\s+\d+\s*[-–]\s*\d+\s*$', '', ospite)
    a, b = CLUB.get(chiave(casa)), CLUB.get(chiave(ospite))
    if not a or not b:
        print(f'  ? squadre non riconosciute: "{casa}" / "{ospite}"', file=sys.stderr)
        return None
    if n is None:
        n = giornata_di(a, b, quando, cal if cal is not None else calendario())
        if n is None:
            print(f'  ? giornata non trovata nel calendario: {a}-{b} ({quando})', file=sys.stderr)
            return None
    return n, a, b


def main():
    xml = prendi(FEED)
    voci = re.findall(r'<entry>(.*?)</entry>', xml, re.S)
    print(f'{len(voci)} video nel feed')
    partite, canale = [], []
    cal = calendario()
    for v in voci:
        vid = re.search(r'<yt:videoId>(.*?)</yt:videoId>', v)
        tit = re.search(r'<media:title>(.*?)</media:title>', v) or re.search(r'<title>(.*?)</title>', v)
        pub = re.search(r'<published>(.*?)</published>', v)
        if not (vid and tit):
            continue
        vid, titolo, quando = vid.group(1), tit.group(1).strip(), (pub.group(1)[:10] if pub else '')
        # &amp; e compagnia, che nel titolo ci finiscono
        for a, b in [('&amp;', '&'), ('&lt;', '<'), ('&gt;', '>'), ('&quot;', '"'), ('&#39;', "'")]:
            titolo = titolo.replace(a, b)
        p = smonta(titolo, quando, cal)
        if p:
            partite.append([p[0], p[1], p[2], vid, quando])
        else:
            canale.append([vid, titolo, quando])

    partite.sort(key=lambda r: (r[0], r[1]))
    canale.sort(key=lambda r: r[2], reverse=True)
    testa = ('/**\n * Video degli highlights dal canale YouTube della FSGC.\n *\n'
             ' * GENERATO da scripts/importa-video.py — non modificare a mano.\n'
             f' * Canale: https://www.youtube.com/channel/{CANALE}\n'
             ' * Il feed tiene solo gli ultimi 15 video: rilanciare ogni settimana,\n'
             ' * insieme a importa-fsgc.py, se no le giornate vecchie si perdono.\n *\n'
             ' * PARTITE: [giornata, casa, ospite, idVideo, dataISO]\n'
             ' * CANALE:  [idVideo, titolo, dataISO] — quelli non legati a una partita\n */\n')
    f = RADICE / 'src' / 'video-dati.js'
    vecchie = {}
    if f.exists():   # il feed e' corto: si tiene quello che c'era gia'
        t = f.read_text(encoding='utf-8')
        m = re.search(r'export const PARTITE = (\[.*?\]);', t, re.S)
        if m:
            # La virgola finale prima di "]" e' legittima in JavaScript — la
            # scrive questo stesso script, qui sotto, mettendo una virgola dopo
            # ogni riga — ma NON e' json valido. Quindi json.loads() moriva con
            # "Expecting value", e questo blocco non ha mai funzionato: il file
            # non veniva riscritto affatto, cioe' i video nuovi non entravano
            # mai. Il passo nel workflow ha continue-on-error, quindi cadeva
            # senza far rumore.
            for r in json.loads(re.sub(r',(\s*])', r'\1', m.group(1))):
                vecchie[(r[0], r[1], r[2])] = r
    for r in partite:
        vecchie[(r[0], r[1], r[2])] = r
    unite = sorted(vecchie.values(), key=lambda r: (r[0], r[1]))
    corpo = (f'export const CANALE = "{CANALE}";\n'
             'export const PARTITE = [\n' + ''.join(f'  {json.dumps(r, ensure_ascii=False)},\n' for r in unite) + '];\n'
             'export const VIDEO_CANALE = [\n' + ''.join(f'  {json.dumps(r, ensure_ascii=False)},\n' for r in canale[:12]) + '];\n')
    f.write_text(testa + corpo, encoding='utf-8')
    print(f'scritto src/video-dati.js — {len(unite)} partite ({len(partite)} dal feed, '
          f'{len(unite) - len(partite)} già presenti), {len(canale[:12])} altri video')


if __name__ == '__main__':
    main()
