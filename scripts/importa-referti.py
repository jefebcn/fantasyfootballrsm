#!/usr/bin/env python3
"""
Marcatori, cartellini, sostituzioni, formazioni e campo veri, dai referti
di Transfermarkt. Produce src/eventi-dati.js.

Due pagine per partita: il referto (gol, cartellini, cambi, campo) e le
formazioni (undici iniziali e panchina). Servono entrambe: senza le
formazioni non si sa chi era in campo, e il Voto Titano parte da lì.

I giocatori si agganciano per identificativo Transfermarkt tramite
data/mappa-giocatori.json, non per nome: fra i tesserati sammarinesi gli
omonimi esistono davvero.

Da rilanciare dopo importa-calendario.py, ogni settimana.

    python3 scripts/importa-referti.py

Transfermarkt blocca per indirizzo IP chi fa molte richieste di seguito
(risponde 405 «Human Verification»). Per questo lo script va piano, riprova
aspettando sempre di più, e soprattutto SALVA A OGNI PARTITA: se viene
interrotto, al rilancio riprende da dove era rimasto invece di ricominciare.
Se si blocca del tutto, basta riprovare più tardi o da un'altra rete.

Quando data/referti.json è completo lo script scrive src/eventi-dati.js;
solo a quel punto data.js può importarlo.
"""
import json, re, subprocess, sys, time, pathlib

UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/120.0 Safari/537.36')
BASE = 'https://www.transfermarkt.it'
CAL = f'{BASE}/campionato-sammarinese/gesamtspielplan/wettbewerb/SMR1/saison_id/2026'
RADICE = pathlib.Path(__file__).resolve().parent.parent
PAUSA = 8.0        # Transfermarkt limita duramente: meglio lenti che respinti
TENTATIVI = 5

CLUB = {
    'SS Folgore': 'folgore', 'Murata': 'murata', 'Juvenes-Dogana': 'juvenes',
    'Faetano': 'faetano', 'San Marino Ac.': 'academy', 'Fiorentino': 'fiorentino',
    'Cailungo': 'cailungo', 'Domagnano': 'domagnano', 'Cosmos': 'cosmos',
    'Libertas': 'libertas', 'San Giovanni': 'sangiovanni', 'Tre Penne': 'trepenne',
    'Tre Fiori': 'trefiori', 'Pennarossa': 'pennarossa', 'Virtus': 'virtus',
    'La Fiorita': 'lafiorita',
}


def prendi(url):
    ultimo = ''
    for t in range(TENTATIVI):
        r = subprocess.run(['curl', '-sS', '--fail', '-m', '40', '-A', UA,
                            '-H', 'Accept-Language: it-IT,it;q=0.9', url], capture_output=True)
        if r.returncode == 0:
            return r.stdout.decode('utf-8', 'replace')
        ultimo = r.stderr.decode()[:120]
        if t < TENTATIVI - 1:
            attesa = 30 * (2 ** t)
            print(f'      riprovo fra {attesa}s', flush=True)
            time.sleep(attesa)
    raise RuntimeError(f'non scaricabile: {ultimo}')


def minuto(li):
    """
    Transfermarkt disegna il minuto come sprite CSS, non come testo: è la loro
    difesa contro l'estrazione. La griglia ha celle da 36px e dieci colonne per
    riga, quindi minuto = riga*10 + colonna + 1. Il recupero resta testo ("+4").
    """
    u = li.select_one('.sb-aktion-uhr')
    if not u:
        return None
    sp = u.select_one('span')
    base = None
    if sp and sp.get('style'):
        m = re.search(r'background-position:\s*-?(\d+)px\s+-?(\d+)px', sp['style'])
        if m:
            col, riga = int(m.group(1)) // 36, int(m.group(2)) // 36
            base = riga * 10 + col + 1
    extra = re.search(r'\+(\d+)', u.get_text(strip=True) or '')
    if base is None:
        return None
    return base + (int(extra.group(1)) if extra else 0)


def tm_id(a):
    m = re.search(r'/spieler/(\d+)', a.get('href', '') or '')
    return m.group(1) if m else None


def referto(url, mappa):
    from bs4 import BeautifulSoup
    s = BeautifulSoup(prendi(url), 'lxml')
    fuori = {'campo': None, 'arbitro': None, 'eventi': [], 'cambi': []}

    z = s.select_one('.sb-zusatzinfos')
    if z:
        testo = re.sub(r'\s+', ' ', z.get_text(' ', strip=True))
        arb = re.search(r'Arbitro:\s*(.+?)(?:\s+Spettatori|$)', testo)
        if arb:
            fuori['arbitro'] = arb.group(1).strip()
        fuori['campo'] = re.split(r'\s*Arbitro:', testo)[0].strip() or None

    def nostro(a):
        t = tm_id(a)
        return mappa.get(t) if t else None

    for li in s.select('#sb-tore li'):
        az = li.select_one('.sb-aktion-aktion')
        if not az:
            continue
        link = az.select("a.wichtig")
        if not link:
            continue
        testo = re.sub(r'\s+', ' ', az.get_text(' ', strip=True))
        pid = nostro(link[0])
        m = minuto(li)
        if pid:
            tipo = 'own_goal' if 'Autorete' in testo else 'goal'
            fuori['eventi'].append({'playerId': pid, 'minute': m, 'type': tipo})
        # l'assist è il secondo giocatore citato, quando c'è
        if 'Assist' in testo and len(link) > 1:
            ap = nostro(link[1])
            if ap:
                fuori['eventi'].append({'playerId': ap, 'minute': m, 'type': 'assist'})

    for li in s.select('#sb-karten li'):
        az = li.select_one('.sb-aktion-aktion')
        a = az.select_one('a.wichtig') if az else None
        if not a:
            continue
        pid = nostro(a)
        if not pid:
            continue
        testo = re.sub(r'\s+', ' ', az.get_text(' ', strip=True))
        if re.search(r'2\.\s*Giallo|Giallo-?rosso', testo, re.I):
            tipo = 'second_yellow'
        elif re.search(r'Rosso', testo, re.I):
            tipo = 'red_direct'
        else:
            tipo = 'yellow'
        fuori['eventi'].append({'playerId': pid, 'minute': minuto(li), 'type': tipo})

    for li in s.select('#sb-wechsel li'):
        ein = li.select_one('.sb-aktion-wechsel-ein a.wichtig')
        aus = li.select_one('.sb-aktion-wechsel-aus a.wichtig')
        if not (ein and aus):
            continue
        dentro, fuoriP = nostro(ein), nostro(aus)
        if dentro and fuoriP:
            fuori['cambi'].append({'in': dentro, 'out': fuoriP, 'minute': minuto(li)})
    return fuori


def formazioni(url, mappa):
    """Undici iniziali e panchina, nell'ordine in cui compaiono: casa poi ospiti."""
    from bs4 import BeautifulSoup
    s = BeautifulSoup(prendi(url), 'lxml')
    titolari, panchina = [], []
    for b in s.select('div.box'):
        t = b.select_one('.content-box-headline, h2')
        if not t:
            continue
        tit = re.sub(r'\s+', ' ', t.get_text(' ', strip=True))
        ids, visti = [], set()
        for a in b.select('a[href*="/profil/spieler/"]'):
            i = tm_id(a)
            if i and i not in visti:
                visti.add(i)
                p = mappa.get(i)
                if p:
                    ids.append(p)
        if 'Undici iniziali' in tit:
            titolari.append(ids)
        elif 'Panchina' in tit:
            panchina.append(ids)
    return titolari, panchina


def main():
    mappa = json.loads((RADICE / 'data' / 'mappa-giocatori.json').read_text(encoding='utf-8'))
    from bs4 import BeautifulSoup
    s = BeautifulSoup(prendi(CAL), 'lxml')

    partite = []
    for b in s.select('div.box'):
        t = b.select_one('.content-box-headline, h2')
        m = re.match(r'(\d+)\.Giornata', re.sub(r'\s+', ' ', t.get_text(' ', strip=True))) if t else None
        if not m:
            continue
        n = int(m.group(1))
        for tr in b.select('table tr'):
            sq = [a for a in tr.select('a[href*="/verein/"]') if a.get_text(strip=True)]
            ref = tr.select_one('a[href*="spielbericht"]')
            if len(sq) < 2 or not ref:
                continue
            casa, osp = sq[0].get_text(strip=True), sq[-1].get_text(strip=True)
            if casa not in CLUB or osp not in CLUB:
                continue
            if not re.match(r'^\s*\d+:\d+\s*$', ref.get_text(strip=True)):
                continue                              # non ancora giocata
            partite.append({'giornata': n, 'casa': CLUB[casa], 'ospite': CLUB[osp],
                            'url': BASE + ref['href']})
    print(f'partite giocate da importare: {len(partite)}')

    # Ripresa: le partite già scaricate non si riscaricano. Con questa
    # limitazione una passata sola non basta quasi mai, e senza ripresa ogni
    # riavvio ributterebbe via il lavoro fatto.
    f = RADICE / 'data' / 'referti.json'
    risultato = json.loads(f.read_text(encoding='utf-8')) if f.exists() else []
    fatte = {(r['giornata'], r['casa'], r['ospite']) for r in risultato}
    restanti = [p for p in partite if (p['giornata'], p['casa'], p['ospite']) not in fatte]
    if fatte:
        print(f'già presenti: {len(fatte)} — da scaricare: {len(restanti)}')
    partite = restanti
    for i, p in enumerate(partite, 1):
        etichetta = f"{p['casa']}–{p['ospite']} (g{p['giornata']})"
        try:
            r = referto(p['url'], mappa)
            time.sleep(PAUSA)
            tit, pan = formazioni(p['url'].replace('/index/spielbericht/', '/aufstellung/spielbericht/'), mappa)
        except Exception as e:
            print(f'  [{i}/{len(partite)}] {etichetta}: ERRORE {e}', file=sys.stderr)
            continue
        gol = sum(1 for e in r['eventi'] if e['type'] in ('goal', 'own_goal'))
        print(f"  [{i}/{len(partite)}] {etichetta:<34} {len(r['eventi'])} eventi ({gol} gol), "
              f"{len(r['cambi'])} cambi, titolari {'+'.join(str(len(x)) for x in tit) or '—'}, "
              f"campo: {r['campo'] or '—'}")
        risultato.append({**p, **r, 'titolari': tit, 'panchina': pan})
        # Salvataggio a ogni partita: un'interruzione non deve costare tutto.
        f.write_text(json.dumps(risultato, ensure_ascii=False, indent=1), encoding='utf-8')
        if i < len(partite):
            time.sleep(PAUSA)

    print(f'\nscritto {f.relative_to(RADICE)} — {len(risultato)} partite')
    scrivi_modulo(risultato)


def scrivi_modulo(referti):
    """Modulo JS: data.js lo importa e basta, senza scaricare niente all'avvio."""
    voci = []
    for r in referti:
        eventi = [[e['playerId'], e['minute'], e['type']] for e in r['eventi'] if e['minute'] is not None]
        cambi = [[c['in'], c['out'], c['minute']] for c in r['cambi'] if c['minute'] is not None]
        voci.append('  {g:%d,casa:%s,ospite:%s,campo:%s,arbitro:%s,titolari:%s,eventi:%s,cambi:%s}' % (
            r['giornata'], json.dumps(r['casa']), json.dumps(r['ospite']),
            json.dumps(r['campo']), json.dumps(r['arbitro']),
            json.dumps(r['titolari']), json.dumps(eventi), json.dumps(cambi)))
    testo = ('/**\n'
             ' * Referti veri del Campionato Sammarinese: marcatori, assist, cartellini,\n'
             ' * sostituzioni, undici iniziali, campo e arbitro.\n'
             ' *\n'
             ' * GENERATO da scripts/importa-referti.py — non modificare a mano.\n'
             ' * Fonte: Transfermarkt. Rilanciare ogni settimana dopo importa-calendario.py.\n'
             ' *\n'
             ' * eventi: [idGiocatore, minuto, tipo] · cambi: [entra, esce, minuto]\n'
             ' * titolari: [undici di casa, undici ospiti]\n'
             ' */\n'
             'export const REFERTI = [\n%s,\n];\n') % (',\n'.join(voci))
    m = RADICE / 'src' / 'eventi-dati.js'
    m.write_text(testo, encoding='utf-8')
    tot = sum(len(r['eventi']) for r in referti)
    print(f'scritto {m.relative_to(RADICE)} — {len(referti)} referti, {tot} eventi')


if __name__ == '__main__':
    main()
