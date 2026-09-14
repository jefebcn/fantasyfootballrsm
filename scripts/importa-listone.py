#!/usr/bin/env python3
"""
Costruisce il listone reale del Campionato Sammarinese da Transfermarkt.

Produce data/listone.json: 16 società con le rose vere (nome, ruolo, numero,
età, valore di mercato). Da lanciare a mano quando le rose cambiano, non a
ogni avvio: il risultato viene versionato nel repository.

Cortesia verso la fonte: una richiesta per società, in fila, con una pausa
in mezzo. Sedici richieste in tutto.
"""
import json, re, time, sys, subprocess, pathlib

UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/120.0 Safari/537.36')
BASE = 'https://www.transfermarkt.it'
COMP = f'{BASE}/campionato-sammarinese/startseite/wettbewerb/SMR1'
PAUSA = 3.0
TENTATIVI = 4
RADICE = pathlib.Path(__file__).resolve().parent.parent

# Transfermarkt usa etichette fini; il fantacalcio ne vuole quattro.
RUOLI = {
    'Portiere': 'P',
    'Difensore centrale': 'D', 'Terzino destro': 'D', 'Terzino sinistro': 'D',
    'Difensore': 'D', 'Libero': 'D',
    'Mediano': 'C', 'Centrocampista centrale': 'C', 'Interno di centrocampo': 'C',
    'Trequartista': 'C', 'Esterno destro': 'C', 'Esterno sinistro': 'C',
    'Ala destra': 'C', 'Ala sinistra': 'C', 'Centrocampista': 'C',
    'Punta centrale': 'A', 'Seconda punta': 'A', 'Attaccante': 'A',
    # etichette generiche di reparto, usate da alcune società
    'Difesa': 'D', 'Centrocampo': 'C', 'Attacco': 'A',
    'Esterno di destra': 'C', 'Esterno di sinistra': 'C', 'Portiere ': 'P',
}

def prendi(url):
    """
    Via curl e non urllib: rispetta da sé proxy e certificati dell'ambiente.
    Transfermarkt risponde 405 a raffica se le richieste sono troppo ravvicinate,
    quindi si riprova aspettando sempre di più invece di insistere subito.
    """
    ultimo = ''
    for tentativo in range(TENTATIVI):
        r = subprocess.run(
            ['curl', '-sS', '--fail', '-m', '40', '-A', UA,
             '-H', 'Accept-Language: it-IT,it;q=0.9',
             '-H', 'Accept: text/html,application/xhtml+xml', url],
            capture_output=True)
        if r.returncode == 0:
            return r.stdout.decode('utf-8', 'replace')
        ultimo = r.stderr.decode()[:160]
        if tentativo < TENTATIVI - 1:
            attesa = 5 * (2 ** tentativo)
            print(f'      riprovo fra {attesa}s ({ultimo.strip()[-30:]})', flush=True)
            time.sleep(attesa)
    raise RuntimeError(f'curl fallito dopo {TENTATIVI} tentativi: {ultimo}')

def valore_in_euro(s):
    """«50 mila €» / «1,20 mln €» / «-» → intero in euro, oppure None."""
    s = (s or '').replace('\xa0', ' ').strip()
    m = re.search(r'([\d.,]+)\s*(mila|mln)?', s)
    if not m or not m.group(1):
        return None
    n = m.group(1).replace('.', '').replace(',', '.')
    try:
        n = float(n)
    except ValueError:
        return None
    if m.group(2) == 'mila':
        n *= 1_000
    elif m.group(2) == 'mln':
        n *= 1_000_000
    return int(n) if n else None

def societa():
    h = prendi(COMP)
    out = {}
    for m in re.finditer(r'href="/([^"/]+)/kader/verein/(\d+)/saison_id/(\d+)"', h):
        slug, vid, saison = m.groups()
        if vid in out:
            continue
        nome = re.search(rf'href="/[^"]*/startseite/verein/{vid}[^"]*"[^>]*title="([^"]+)"', h)
        out[vid] = {'id': vid, 'slug': slug, 'saison': saison,
                    'nome': nome.group(1) if nome else slug.replace('-', ' ').title()}
    return list(out.values())

def rosa(c, sconosciuti):
    from bs4 import BeautifulSoup
    url = f"{BASE}/{c['slug']}/kader/verein/{c['id']}/saison_id/{c['saison']}"
    s = BeautifulSoup(prendi(url), 'lxml')
    t = s.select_one('table.items')
    if not t:
        return []
    fuori = []
    for tr in t.select('tbody > tr'):
        tds = tr.find_all('td', recursive=False)
        if len(tds) < 6:
            continue
        a = tds[1].select_one('a[href*="/profil/spieler/"]')
        if not a:
            continue
        nome = re.sub(r'\s+', ' ', a.get_text(' ', strip=True))
        testo = re.sub(r'\s+', ' ', tds[1].get_text(' ', strip=True))
        etichetta = testo[len(nome):].strip() or '?'
        ruolo = RUOLI.get(etichetta)
        if not ruolo:
            sconosciuti[etichetta] = sconosciuti.get(etichetta, 0) + 1
            ruolo = 'C'
        eta = re.sub(r'\D', '', tds[2].get_text(strip=True))
        fuori.append({
            'tmId': re.search(r'/profil/spieler/(\d+)', a['href']).group(1),
            'nome': nome,
            'ruolo': ruolo,
            'ruoloEsteso': etichetta,
            'numero': (tds[0].get_text(strip=True) or None),
            'eta': int(eta) if eta else None,
            'valore': valore_in_euro(tds[5].get_text(strip=True)),
        })
    return fuori

# Transfermarkt usa le ragioni sociali complete; noi gli id brevi di src/data.js.
NOSTRI = {
    'Tre Fiori Fc': 'trefiori', 'La Fiorita 1967': 'lafiorita',
    'Ss Folgore Falciano': 'folgore', 'Ac Virtus Acquaviva': 'virtus',
    'Fc Domagnano': 'domagnano', 'Sp Tre Penne': 'trepenne',
    'Ac Juvenes Dogana': 'juvenes', 'Ss Cosmos': 'cosmos',
    'Sp Cailungo': 'cailungo', 'Ss Pennarossa': 'pennarossa',
    'Ss San Giovanni': 'sangiovanni', 'Fc Fiorentino': 'fiorentino',
    'Ac Libertas': 'libertas', 'Sc Faetano': 'faetano',
    'San Marino Academy': 'academy', 'Ss Murata': 'murata',
}
# Estremi di quotazione per ruolo, gli stessi che usava il listone generato.
QUOT = {'P': (6, 22), 'D': (5, 24), 'C': (5, 30), 'A': (6, 40)}

def quota(giocatori):
    """
    Quotazione dal valore di mercato, per posizione dentro il proprio ruolo.
    Più di metà dei tesserati non ha un valore su Transfermarkt: ordinarli per
    valore assoluto li schiaccerebbe tutti in fondo, mentre il rango dentro il
    ruolo distribuisce anche loro in modo sensato. A parità, decide l'età (i
    più giovani valgono un filo meno) e poi il nome, così il risultato non
    cambia da un'esecuzione all'altra.
    """
    for ruolo, (lo, hi) in QUOT.items():
        gruppo = [g for g in giocatori if g['ruolo'] == ruolo]
        gruppo.sort(key=lambda g: (g['valore'] or 0, -(g['eta'] or 99), g['nome']))
        n = len(gruppo)
        for i, g in enumerate(gruppo):
            pct = (i / (n - 1)) if n > 1 else 0.5
            g['quotazione'] = round(lo + (hi - lo) * pct)

def scrivi_modulo(dati):
    """
    Un modulo JS invece di un fetch: l'app non ha passaggi di compilazione e
    buildSeason() è sincrona, quindi il listone deve essere già lì all'import.
    """
    tutti = []
    for c in dati:
        cid = NOSTRI.get(c['nome'])
        if not cid:
            print(f"  ATTENZIONE: società senza corrispondenza: {c['nome']}", file=sys.stderr)
            continue
        for g in c['giocatori']:
            g['clubId'] = cid
            tutti.append(g)
    quota(tutti)
    righe = []
    for g in sorted(tutti, key=lambda g: (g['clubId'], 'PDCA'.index(g['ruolo']), -g['quotazione'], g['nome'])):
        parti = g['nome'].split()
        nome, cognome = (' '.join(parti[:-1]) or parti[-1]), parti[-1]
        righe.append('  [%s,%s,%s,%s,%d,%s]' % (
            json.dumps(g['clubId']), json.dumps(nome), json.dumps(cognome),
            json.dumps(g['ruolo']), g['quotazione'], json.dumps(g['eta'])))
    testo = (
        '/**\n'
        ' * Listone reale del Campionato Sammarinese.\n'
        ' *\n'
        ' * GENERATO da scripts/importa-listone.py — non modificare a mano.\n'
        ' * Fonte: Transfermarkt. Rilanciare lo script quando le rose cambiano.\n'
        ' *\n'
        ' * Forma compatta per non gonfiare il file: [clubId, nome, cognome, ruolo, quotazione, eta]\n'
        ' */\n'
        'export const LISTONE = [\n' + ',\n'.join(righe) + ',\n];\n')
    f = RADICE / 'src' / 'listone-dati.js'
    f.write_text(testo, encoding='utf-8')
    print(f'scritto {f.relative_to(RADICE)} — {len(tutti)} giocatori')

    # Mappa id Transfermarkt → id nostro, nello stesso ordine con cui data.js
    # numera i tesserati. Serve a importa-referti.py per agganciare i marcatori
    # per identificativo e non per nome: gli omonimi qui esistono davvero.
    per_club = {}
    mappa = {}
    for g in sorted(tutti, key=lambda g: (g['clubId'], 'PDCA'.index(g['ruolo']), -g['quotazione'], g['nome'])):
        per_club[g['clubId']] = per_club.get(g['clubId'], 0) + 1
        mappa[g['tmId']] = f"{g['clubId']}_{per_club[g['clubId']]}"
    m = RADICE / 'data' / 'mappa-giocatori.json'
    m.write_text(json.dumps(mappa, indent=0), encoding='utf-8')
    print(f'scritto {m.relative_to(RADICE)} — {len(mappa)} corrispondenze')

def main():
    cs = societa()
    print(f'società trovate: {len(cs)}')
    sconosciuti = {}
    dati = []
    for i, c in enumerate(cs, 1):
        try:
            r = rosa(c, sconosciuti)
        except Exception as e:
            print(f'  [{i}/{len(cs)}] {c["nome"]}: ERRORE {e}', file=sys.stderr)
            r = []
        print(f'  [{i}/{len(cs)}] {c["nome"]:<28} {len(r):>3} giocatori')
        dati.append({**c, 'giocatori': r})
        if i < len(cs):
            time.sleep(PAUSA)
    if sconosciuti:
        print('\netichette di ruolo non mappate (finite in C):')
        for k, v in sorted(sconosciuti.items(), key=lambda x: -x[1]):
            print(f'   {v:>3} × {k}')
    d = RADICE / 'data'
    d.mkdir(exist_ok=True)
    fuori = d / 'listone.json'
    fuori.write_text(json.dumps({'fonte': 'Transfermarkt', 'competizione': 'Campionato Sammarinese',
                                 'societa': dati}, ensure_ascii=False, indent=1), encoding='utf-8')
    tot = sum(len(c['giocatori']) for c in dati)
    print(f'\nscritto {fuori.relative_to(RADICE)} — {len(dati)} società, {tot} giocatori')
    scrivi_modulo(dati)

if __name__ == '__main__':
    main()
