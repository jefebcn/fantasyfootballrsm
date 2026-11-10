#!/usr/bin/env python3
"""
Il catalogo delle foto FSGC per giocatori e squadre, da guardare (Alex, 7/11:
«un posto dove salvare tutte queste immagini, per sapere sempre dove trovarle»).

Il catalogo vero sono due file nel repository, gli stessi che usano le storie
dei gol:
  social/gol/foto-giocatori.json   id giocatore -> foto in cui c'e' lui
  social/gol/foto-squadre.json     id squadra   -> foto di gruppo
Questo script ne fa una pagina HTML con le miniature dentro (la pagina non
puo' caricare immagini da altri siti), divisa per squadra, con chi manca.

    python3 scripts/catalogo-foto.py uscita.html
"""
import base64, html, io, json, pathlib, re, sys, urllib.request

RADICE = pathlib.Path(__file__).resolve().parent.parent
UA = {'User-Agent': 'Mozilla/5.0 (Fantatitano; foto FSGC con credito)'}
# le maglie viste nelle foto di questa stagione: aiutano a riconoscere le squadre nella galleria
MAGLIE = {
    'domagnano': 'giallorossa a righe, nera e lime fuori', 'virtus': 'verde, rosa fuori (come il Murata: guarda la didascalia)', 'murata': 'rosa, bianconera a righe fuori', 'trepenne': 'nera',
    'folgore': 'rossa in casa, bianca fuori', 'fiorentino': 'azzurra', 'lafiorita': 'gialla, bianca fuori',
    'libertas': 'granata', 'cosmos': 'gialloverde', 'trefiori': 'gialloblu', 'academy': 'blu scuro con stemma SM, bianca fuori',
    'juvenes': 'biancorossa a righe, nera fuori', 'cailungo': 'nera', 'pennarossa': 'rossa',
}


def leggi(nome):
    d = json.loads((RADICE / 'social' / 'gol' / nome).read_text(encoding='utf-8'))
    return {k: v for k, v in d.items() if not k.startswith('_')}


def squadre():
    testo = (RADICE / 'src' / 'data.js').read_text(encoding='utf-8')
    return {i: n for i, n in re.findall(r"\{ id: '([a-z]+)', name: '([^']+)'", testo)}


def fonte(x):
    """La pagina da cui viene la foto: l'articolo FSGC o la foto su Flickr."""
    m = re.search(r'/cdn/news/([^/]+)/(\d+)/', x['foto'])
    return f'https://www.fsgc.sm/it/notizia/{m.group(1)}/{m.group(2)}' if m else x.get('pagina', x['foto'])


def miniatura(url, cache):
    if url in cache:
        return cache[url]
    from PIL import Image
    dati = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read()
    im = Image.open(io.BytesIO(dati)).convert('RGB')
    im.thumbnail((560, 560))
    b = io.BytesIO(); im.save(b, 'JPEG', quality=72)
    cache[url] = 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()
    return cache[url]


def main(uscita):
    sys.path.insert(0, str(RADICE / 'scripts'))
    import foto_gol
    tutti = foto_gol.giocatori()
    G, S, nomi = leggi('foto-giocatori.json'), leggi('foto-squadre.json'), squadre()
    cache, blocchi = {}, []
    n_g = sum(len(v) for v in G.values()); n_s = sum(len(v) for v in S.values())
    for club, nome in sorted(nomi.items(), key=lambda x: x[1]):
        carte = []
        for x in S.get(club, []):
            carte.append(('squadra', 'Foto di gruppo', x))
        for pid, foto in sorted(G.items(), key=lambda kv: tutti.get(kv[0], ('', kv[0], ''))[1]):
            if tutti.get(pid, ('', '', pid.rsplit('_', 1)[0]))[2] != club:
                continue
            n, c, _ = tutti.get(pid, ('', pid, club))
            for x in foto:
                carte.append(('giocatore', f'{n} {c}', x))
        if carte:
            corpo = '\n'.join(
                f'''<figure class="carta {tipo}"><img src="{miniatura(x['foto'], cache)}" alt="{html.escape(chi)}" loading="lazy">
<figcaption><b>{html.escape(chi)}</b><span class="tipo">{'giocatore' if tipo == 'giocatore' else 'squadra'}</span>
<span class="nota">{html.escape(x.get('nota', ''))}</span>
<span class="cred">{html.escape(x['credito'])} · <a href="{fonte(x)}" target="_blank" rel="noopener">dove sta</a></span></figcaption></figure>'''
                for tipo, chi, x in carte)
        else:
            corpo = '<p class="vuoto">Nessuna foto ancora: le storie dei gol escono con la grafica di prima.</p>'
        manca = '' if club in S else '<span class="pill manca">manca la foto di gruppo</span>'
        maglia = f'<span class="pill">maglia {html.escape(MAGLIE[club])}</span>' if club in MAGLIE else ''
        blocchi.append(f'<section class="club" data-club="{club}" data-nomi="{html.escape(" ".join([nome] + [c[1] for c in carte]).lower())}">'
                       f'<header><h2>{html.escape(nome)}</h2>{maglia}{manca}</header><div class="griglia">{corpo}</div></section>')
    senza = [nomi[c] for c in sorted(nomi, key=lambda c: nomi[c]) if c not in S]
    pagina = (RADICE / 'scripts' / 'catalogo-foto.html').read_text(encoding='utf-8')
    pagina = (pagina.replace('{{BLOCCHI}}', '\n'.join(blocchi))
              .replace('{{N_GIOCATORI}}', str(len(G))).replace('{{N_FOTO}}', str(n_g + n_s))
              .replace('{{N_SQUADRE}}', str(len(S))).replace('{{SENZA}}', html.escape(', '.join(senza)) or 'nessuna'))
    pathlib.Path(uscita).write_text(pagina, encoding='utf-8')
    print(f'scritto {uscita}: {n_g + n_s} foto, {len(G)} giocatori, {len(S)} squadre')


if __name__ == '__main__':
    main(sys.argv[1])
