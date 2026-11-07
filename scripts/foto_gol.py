"""
La foto della storia di un gol, dalla FSGC (Alex, 7/11).

Dietro la storia ci va una foto vera della FSGC, sempre col credito
«©FSGC/Fotografo» scritto sull'immagine:
  1. il marcatore, se c'e' una sua foto di questa stagione con la maglia della
     squadra (social/gol/foto-giocatori.json). Una foto gia' uscita va bene lo
     stesso: un giocatore di foto ne ha una o due;
  2. se no, la sua squadra (social/gol/foto-squadre.json): giocatori di quella
     squadra in primo piano, mai un avversario, che col nome del marcatore
     sotto sembrerebbe lui;
  3. se no, nessuna foto: la storia esce con la grafica di prima.

Le foto le sceglie una persona guardandole. Le didascalie FSGC spesso
raccontano la partita e non dicono chi c'e' nella foto. La galleria completa
(Flickr, un album per giornata con il fotografo in ogni foto) ha molte piu'
foto ma senza nomi: da li' si allargano gli elenchi.

  python3 scripts/foto_gol.py domagnano_23     (prova: stampa cosa sceglie)

indice() resta per cercare foto nuove da guardare: elenca gli articoli FSGC
della stagione con foto e didascalia (foto-indice.json).
"""
import html
import json
import os
import pathlib
import re
import sys
import urllib.request

RADICE = pathlib.Path(__file__).resolve().parent.parent
SITO = 'https://www.fsgc.sm'
ELENCO = SITO + '/it/news/campionato-sammarinese/9'
UA = {'User-Agent': 'Mozilla/5.0 (Fantatitano; foto FSGC con credito)'}
STAGIONE_DAL = '2026-08-20'          # la maglia deve essere quella di quest'anno

# come la squadra compare nelle didascalie FSGC
PAROLE_CLUB = {
    'academy': ['academy'], 'cailungo': ['cailungo'], 'cosmos': ['cosmos'], 'domagnano': ['domagnano'],
    'faetano': ['faetano'], 'fiorentino': ['fiorentino'], 'folgore': ['folgore'], 'juvenes': ['juvenes'],
    'lafiorita': ['fiorita'], 'libertas': ['libertas'], 'murata': ['murata'], 'pennarossa': ['pennarossa'],
    'sangiovanni': ['san giovanni'], 'trefiori': ['tre fiori'], 'trepenne': ['tre penne'], 'virtus': ['virtus'],
}


def norm(s):
    s = html.unescape(s or '').lower()
    for a, b in (('àáâ', 'a'), ('èéê', 'e'), ('ìí', 'i'), ('òó', 'o'), ('ùú', 'u')):
        s = re.sub(f'[{a}]', b, s)
    return ' ' + re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9]', ' ', s)).strip() + ' '


def giocatori():
    """id -> (nome, cognome, club), con gli stessi id di src/data.js: il listone
    e poi gli extra, numerati per squadra nello stesso ordine."""
    out, conta = {}, {}
    for f in ('listone-dati.js', 'listone-extra.js'):
        testo = (RADICE / 'src' / f).read_text(encoding='utf-8')
        for club, nome, cognome in re.findall(r'^\s*\["([a-z]+)","((?:[^"\\]|\\.)*)","((?:[^"\\]|\\.)*)"', testo, re.M):
            conta[club] = conta.get(club, 0) + 1
            out[f'{club}_{conta[club]}'] = (json.loads(f'"{nome}"'), json.loads(f'"{cognome}"'), club)
    return out


def _get(url, binario=False):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=25) as r:
        d = r.read()
    return d if binario else d.decode('utf-8', 'replace')


def _dettaglio(url, nid):
    t = _get(url)
    tit = re.search(r'<meta property="og:title" content="([^"]*)"', t)
    titolo = html.unescape(tit.group(1)) if tit else ''
    g = re.search(r'\((\d{2})/(\d{2})/(\d{4})\)', titolo)
    img = re.search(r'(/cdn/news/[^"\'?) ]+/\d+/1200x670\.jpg)', t)
    cap = re.search(r'(©FSGC(?:/[^|<"]+)?)\s*\|\s*([^<"]+)', t)
    return {'id': nid, 'url': url, 'titolo': titolo,
            'data': f'{g.group(3)}-{g.group(2)}-{g.group(1)}' if g else None,
            'foto': SITO + img.group(1) if img else None,
            'credito': cap.group(1).strip() if cap else '©FSGC',
            'didascalia': html.unescape(cap.group(2).strip()) if cap else ''}


def indice(cartella, pagine=8):
    """Gli articoli del campionato di questa stagione con foto e didascalia.
    Quelli gia' letti stanno in cartella/foto-indice.json e non si riscaricano."""
    cartella = pathlib.Path(cartella); cartella.mkdir(parents=True, exist_ok=True)
    f = cartella / 'foto-indice.json'
    gia = {a['id']: a for a in json.loads(f.read_text())} if f.exists() else {}
    for pg in range(1, pagine + 1):
        try:
            t = _get(ELENCO + (f'?page={pg}' if pg > 1 else ''))
        except Exception:
            break
        nuovi = 0
        for url, slug, nid in re.findall(r'href="(https://www\.fsgc\.sm/it/notizia/([^"/]+)/(\d+))"', t):
            nid = int(nid)
            if nid in gia or not slug.startswith('campionato'):
                continue
            try:
                gia[nid] = _dettaglio(url, nid); nuovi += 1
            except Exception:
                continue
        vecchi = [a for a in gia.values() if a.get('data') and a['data'] < STAGIONE_DAL]
        if vecchi and not nuovi:
            break                       # siamo arrivati alla stagione scorsa
    f.write_text(json.dumps(sorted(gia.values(), key=lambda a: -a['id']), ensure_ascii=False))
    return [a for a in gia.values() if a.get('foto') and a.get('didascalia') and (a.get('data') or '') >= STAGIONE_DAL
            and not re.search(r'coppa|scors|archivio', norm(a['didascalia']))]


def _nominati(cap, tutti):
    """I giocatori nominati nella didascalia, per cognome: [(id, posizione)]."""
    out = []
    for pid, (_, cognome, _) in tutti.items():
        c = norm(cognome)
        if len(c.strip()) >= 4 and c in cap:
            out.append((pid, cap.index(c)))
    return out


def _centro(cap, cognome, nominati, tutti):
    """Dove sta il giocatore nella foto, dalle parole della didascalia (0 sinistra, 1 destra)."""
    dopo = lambda pos: cap[pos:pos + 45]
    i = cap.find(norm(cognome))
    if i >= 0 and 'sinistra' in dopo(i): return 0.3
    if i >= 0 and 'destra' in dopo(i): return 0.7
    # «X (a sinistra) a duello con lui» non dice dove sta lui: resta il centro
    return 0.5


def _elenco(nome):
    f = RADICE / 'social' / 'gol' / nome
    return {k: v for k, v in json.loads(f.read_text(encoding='utf-8')).items() if not k.startswith('_')} if f.exists() else {}


def foto_per(pid, articoli=None, tutti=None):
    """La foto per il gol di pid: prima lui (social/gol/foto-giocatori.json),
    poi la sua squadra (foto-squadre.json). None: la storia esce con la grafica.

    Solo foto guardate e scelte a mano. Le didascalie FSGC spesso raccontano la
    partita e non chi c'e' nella foto («doppiette per Guidotti e Cremonini...,
    inaugurata da Lisi (in foto)»): sceglierle in automatico ha messo un
    avversario in primo piano accanto al nome del marcatore."""
    for x in _elenco('foto-giocatori.json').get(pid, [])[:1]:
        return {**x, 'tipo': 'giocatore'}
    club = (tutti or {}).get(pid, (None, None, pid.rsplit('_', 1)[0]))[2]
    return foto_squadra(club)


def foto_squadra(club, articoli=None, tutti=None):
    for x in _elenco('foto-squadre.json').get(club, [])[:1]:
        return {**x, 'tipo': 'squadra'}
    return None


def scarica(scelta, cartella):
    """La foto in cartella/foto/fsgc_<id>.jpg (una volta sola)."""
    d = pathlib.Path(cartella) / 'foto'; d.mkdir(parents=True, exist_ok=True)
    f = d / f"fsgc_{scelta['id']}.jpg"   # gli id Flickr sono lunghi, quelli degli articoli no: non si scontrano
    if not f.exists():
        f.write_bytes(_get(scelta['foto'], binario=True))
    return str(f)


if __name__ == '__main__':
    tutti = giocatori()
    s = foto_per(sys.argv[1], None, tutti)
    print(json.dumps(s, ensure_ascii=False, indent=1) if s else 'nessuna foto')
